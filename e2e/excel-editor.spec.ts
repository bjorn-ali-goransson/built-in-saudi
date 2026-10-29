import { test, expect, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { zipPart, zipNames } from './helpers'
import { startRelay, relayContext, type Relay } from './support/relay'

// The spreadsheet editor. Every claim that something was SAVED is read back
// through a different path than the one that wrote it: the IndexedDB record,
// the exported file's own XML, or the other browser in a live session.
const FIX = 'src/tools/excel-editor/io/__fixtures__/'

const cell = (p: Page, ref: string) => p.locator(`[data-testid="xl-grid"] div[data-cell="${ref}"]:not([data-testid])`).first()

async function at(p: Page, ref: string) {
  const m = ref.match(/^([A-Z]+)(\d+)$/)!
  const col = await p.locator(`[data-col-header="${m[1]}"]`).first().boundingBox()
  const row = await p.locator(`[data-row-header="${m[2]}"]`).first().boundingBox()
  return { x: col!.x + col!.width / 2, y: row!.y + row!.height / 2 }
}
async function clickCell(p: Page, ref: string, opts: { shift?: boolean } = {}) {
  const pt = await at(p, ref)
  if (opts.shift) await p.keyboard.down('Shift')
  await p.mouse.click(pt.x, pt.y)
  if (opts.shift) await p.keyboard.up('Shift')
  await expect(p.getByTestId('xl-active')).toHaveAttribute('data-cell', opts.shift ? /.+/ : ref)
}
async function typeIn(p: Page, ref: string, text: string, key = 'Enter') {
  await clickCell(p, ref)
  await p.keyboard.type(text)
  await p.keyboard.press(key)
}
async function newBlank(p: Page, locale = 'en') {
  await p.goto(`/${locale}/apps/excel-editor/`)
  await p.getByTestId('office-new').click()
  await expect(p.getByTestId('xl-grid')).toBeVisible()
  await expect(p.getByTestId('xl-active')).toHaveAttribute('data-cell', 'A1')
}
/** The stored workbook, read straight from IndexedDB — not from the screen. */
async function storedBook(p: Page): Promise<{ title: string; data: { sheets: { name: string; cells: Record<string, { input: string; fmt?: Record<string, unknown> }> }[] } }[]> {
  return p.evaluate(() => new Promise((resolve, reject) => {
    const r = indexedDB.open('bis-docs')
    r.onerror = () => reject(r.error)
    r.onsuccess = () => {
      const tx = r.result.transaction('docs', 'readonly').objectStore('docs').getAll()
      tx.onsuccess = () => resolve((tx.result as { kind: string }[]).filter((d) => d.kind === 'excel') as never)
    }
  }))
}
async function saved(p: Page) { await expect(p.getByTestId('office-status')).toHaveAttribute('data-status', 'saved') }

test('library: start blank, type values and a formula, and it recalculates', async ({ page: p }) => {
  await p.goto('/en/apps/excel-editor/')
  await expect(p.getByTestId('office-empty')).toBeVisible()
  await p.getByTestId('office-new').click()
  await typeIn(p, 'A1', '40')
  await p.keyboard.type('2')
  await p.keyboard.press('Enter')
  await p.keyboard.type('=A1+A2')
  await p.keyboard.press('Enter')
  await expect(cell(p, 'A3')).toHaveText('42')
  await typeIn(p, 'A1', '100')
  await expect(cell(p, 'A3')).toHaveText('102')
  // The formula bar shows the formula, not the value.
  await clickCell(p, 'A3')
  await expect(p.getByTestId('xl-formula-input')).toHaveValue('=A1+A2')
  await expect(p.getByTestId('xl-namebox')).toHaveValue('A3')
})

test('autosave reaches IndexedDB, and reopening the document shows it again', async ({ page: p }) => {
  await newBlank(p)
  await typeIn(p, 'B2', 'Riyadh')
  await typeIn(p, 'C2', '=LEN(B2)')
  await p.getByTestId('office-title').fill('Cities')
  await saved(p)
  const docs = await storedBook(p)
  const d = docs.find((x) => x.title === 'Cities')!
  expect(d.data.sheets[0].cells['1,1'].input).toBe('Riyadh')
  expect(d.data.sheets[0].cells['1,2'].input).toBe('=LEN(B2)')
  await p.getByTestId('office-back').click()
  await expect(p.getByTestId('office-doc-title').filter({ hasText: 'Cities' })).toBeVisible()
  await p.getByTestId('office-doc-open').first().click()
  await expect(cell(p, 'C2')).toHaveText('6')
})

test('clicking another cell commits the edit (the commonest way to finish typing)', async ({ page: p }) => {
  await newBlank(p)
  await clickCell(p, 'A1')
  await p.keyboard.type('typed then clicked away')
  await clickCell(p, 'D4')
  await expect(cell(p, 'A1')).toHaveText('typed then clicked away')
  await saved(p)
  expect((await storedBook(p))[0].data.sheets[0].cells['0,0'].input).toBe('typed then clicked away')
})

test('leaving the grid altogether also commits — focus moving out is a finish too', async ({ page: p }) => {
  await newBlank(p)
  await clickCell(p, 'B2')
  await p.keyboard.type('typed then left')
  await p.getByTestId('office-title').click()
  await expect(cell(p, 'B2')).toHaveText('typed then left')
})

test('Escape abandons an edit; Tab moves right; F2 edits in place', async ({ page: p }) => {
  await newBlank(p)
  await typeIn(p, 'A1', 'keep', 'Tab')
  await expect(p.getByTestId('xl-active')).toHaveAttribute('data-cell', 'B1')
  await clickCell(p, 'A1')
  await p.keyboard.type('discard')
  await p.keyboard.press('Escape')
  await expect(cell(p, 'A1')).toHaveText('keep')
  await p.keyboard.press('F2')
  await p.keyboard.type('er')
  await p.keyboard.press('Enter')
  await expect(cell(p, 'A1')).toHaveText('keeper')
})

test('while typing a formula, clicking cells writes their references', async ({ page: p }) => {
  await newBlank(p)
  await typeIn(p, 'A1', '5')
  await typeIn(p, 'B1', '7')
  await clickCell(p, 'C1')
  await p.keyboard.type('=')
  await expect(p.getByTestId('xl-formula-input')).toHaveValue('=')
  const a1 = await at(p, 'A1')
  await p.mouse.click(a1.x, a1.y)
  await p.keyboard.type('*')
  const b1 = await at(p, 'B1')
  await p.mouse.click(b1.x, b1.y)
  await p.keyboard.press('Enter')
  await expect(cell(p, 'C1')).toHaveText('35')
  await clickCell(p, 'C1')
  await expect(p.getByTestId('xl-formula-input')).toHaveValue('=A1*B1')
})

test('unclosed parentheses are closed on commit, and suggestions offer functions', async ({ page: p }) => {
  await newBlank(p)
  await typeIn(p, 'A1', '3')
  await clickCell(p, 'A2')
  await p.keyboard.type('=ROU')
  await expect(p.getByTestId('xl-fn-hint').filter({ hasText: 'ROUND' }).first()).toBeVisible()
  await p.keyboard.press('Escape')
  await typeIn(p, 'A2', '=SUM(A1,4')
  await expect(cell(p, 'A2')).toHaveText('7')
})

test('the fill handle continues a series and moves formulas', async ({ page: p }) => {
  await newBlank(p)
  await typeIn(p, 'A1', '1')
  await typeIn(p, 'A2', '3')
  await typeIn(p, 'B1', '=A1*10')
  await clickCell(p, 'A1')
  await clickCell(p, 'B2', { shift: true })
  const h = await p.getByTestId('xl-fill-handle').boundingBox()
  const to = await at(p, 'A5')
  await p.mouse.move(h!.x + 4, h!.y + 4)
  await p.mouse.down()
  await p.mouse.move(to.x, to.y, { steps: 6 })
  await p.mouse.up()
  await expect(cell(p, 'A5')).toHaveText('9')
  await expect(cell(p, 'B3')).toHaveText('50')
  await expect(cell(p, 'B5')).toHaveText('90')
})

test('copy and paste within the sheet moves a formula by the distance pasted', async ({ page: p, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await newBlank(p)
  await typeIn(p, 'A1', '2')
  await typeIn(p, 'A2', '3')
  await typeIn(p, 'B1', '=A1*100')
  await clickCell(p, 'B1')
  await p.keyboard.press('Control+c')
  await expect(p.getByTestId('xl-marquee')).toBeVisible()
  await clickCell(p, 'B2')
  await p.keyboard.press('Control+v')
  await expect(cell(p, 'B2')).toHaveText('300')
  await clickCell(p, 'B2')
  await expect(p.getByTestId('xl-formula-input')).toHaveValue('=A2*100')
})

test('cut and paste MOVES, keeping references, and clears the source', async ({ page: p, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await newBlank(p)
  await typeIn(p, 'A1', '8')
  await typeIn(p, 'B1', '=A1+1')
  await clickCell(p, 'B1')
  await p.keyboard.press('Control+x')
  await clickCell(p, 'D4')
  await p.keyboard.press('Control+v')
  await expect(cell(p, 'D4')).toHaveText('9')
  await expect(cell(p, 'B1')).toHaveCount(0)
})

test('a tab-separated paste from another program fills a block', async ({ page: p, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await newBlank(p)
  await p.evaluate(() => navigator.clipboard.writeText('Name\tScore\nNoura\t9\nOmar\t7\n'))
  await clickCell(p, 'B2')
  await p.keyboard.press('Control+v')
  await expect(cell(p, 'C3')).toHaveText('9')
  await expect(cell(p, 'B4')).toHaveText('Omar')
})

test('undo takes a change back and redo restores it', async ({ page: p }) => {
  await newBlank(p)
  await typeIn(p, 'A1', 'one')
  await typeIn(p, 'A1', 'two')
  await p.keyboard.press('Control+z')
  await expect(cell(p, 'A1')).toHaveText('one')
  await p.getByTestId('office-undo').click()
  await expect(cell(p, 'A1')).toHaveCount(0)
  await p.getByTestId('office-redo').click()
  await expect(cell(p, 'A1')).toHaveText('one')
  await p.keyboard.press('Control+y')
  await expect(cell(p, 'A1')).toHaveText('two')
})

test('formatting from the ribbon and the keyboard, kept in the stored document', async ({ page: p }) => {
  await newBlank(p)
  await typeIn(p, 'A1', '1234.5')
  await clickCell(p, 'A1')
  await p.getByTestId('xl-bold').click()
  await expect(p.getByTestId('xl-bold')).toHaveAttribute('aria-pressed', 'true')
  await p.keyboard.press('Control+i')
  await p.getByTestId('xl-numfmt').selectOption('currency')
  await expect(cell(p, 'A1')).toContainText('1,234.50')
  await p.getByTestId('xl-fill').click()
  await p.getByTestId('xl-fill-fff2cc').click()
  await saved(p)
  const fmt = (await storedBook(p))[0].data.sheets[0].cells['0,0'].fmt!
  expect(fmt).toMatchObject({ bold: true, italic: true, numFmt: 'currency', bg: '#fff2cc' })
  await expect(cell(p, 'A1')).toHaveCSS('font-weight', '700')
})

test('inserting and deleting rows keeps formulas pointing at the same data', async ({ page: p }) => {
  await newBlank(p)
  await typeIn(p, 'A1', '10')
  await typeIn(p, 'A2', '20')
  await typeIn(p, 'A3', '=SUM(A1:A2)')
  await clickCell(p, 'A2')
  await p.getByTestId('xl-insert-cells').click()
  await p.getByTestId('xl-insert-row-above').click()
  await expect(cell(p, 'A4')).toHaveText('30')
  await clickCell(p, 'A4')
  await expect(p.getByTestId('xl-formula-input')).toHaveValue('=SUM(A1:A3)')
  await clickCell(p, 'A1')
  await p.getByTestId('xl-delete-cells').click()
  await p.getByTestId('xl-delete-rows').click()
  await expect(cell(p, 'A3')).toHaveText('20')
})

test('sort a table by the active column, keeping the header', async ({ page: p }) => {
  await newBlank(p)
  for (const [ref, v] of [['A1', 'Name'], ['B1', 'Score'], ['A2', 'Omar'], ['B2', '7'], ['A3', 'Noura'], ['B3', '9'], ['A4', 'Ali'], ['B4', '3']]) await typeIn(p, ref, v)
  await clickCell(p, 'B3')
  await p.getByTestId('xl-sort-desc').click()
  await expect(cell(p, 'A1')).toHaveText('Name')
  await expect(cell(p, 'A2')).toHaveText('Noura')
  await expect(cell(p, 'A4')).toHaveText('Ali')
})

test('filter hides the rows that do not match and says how many are shown', async ({ page: p }) => {
  await newBlank(p)
  for (const [ref, v] of [['A1', 'City'], ['A2', 'Riyadh'], ['A3', 'Jeddah'], ['A4', 'Riyadh']]) await typeIn(p, ref, v)
  await clickCell(p, 'A2')
  await p.getByTestId('tab-data').click()
  await p.getByTestId('xl-filter').click()
  await p.getByTestId('xl-filter-btn').first().click()
  await p.locator('[data-testid="xl-filter-value"][data-value="Jeddah"]').uncheck()
  await p.getByTestId('xl-filter-apply').click()
  await expect(cell(p, 'A3')).toHaveCount(0)
  await expect(cell(p, 'A4')).toHaveText('Riyadh')
  await expect(p.getByTestId('xl-filter-status')).toContainText('2 of 3')
  await p.getByTestId('xl-clear-filter').click()
  await expect(cell(p, 'A3')).toHaveText('Jeddah')
})

test('sheets: add, rename (formulas follow), and refuse to delete the last', async ({ page: p }) => {
  await newBlank(p)
  await p.getByTestId('xl-add-sheet').click()
  await expect(p.getByTestId('xl-sheet-tab')).toHaveCount(2)
  await typeIn(p, 'A1', '21')
  await p.getByTestId('xl-sheet-tab').first().click()
  await typeIn(p, 'A1', '=Sheet2!A1*2')
  await expect(cell(p, 'A1')).toHaveText('42')
  await p.getByTestId('xl-sheet-tab').nth(1).dblclick()
  await p.getByTestId('xl-rename-sheet-input').fill('Data 2026')
  await p.getByTestId('xl-rename-sheet-save').click()
  await expect(p.getByTestId('xl-sheet-tab').nth(1)).toHaveText('Data 2026')
  await p.getByTestId('xl-sheet-tab').first().click()
  await clickCell(p, 'A1')
  await expect(p.getByTestId('xl-formula-input')).toHaveValue("='Data 2026'!A1*2")
  await expect(cell(p, 'A1')).toHaveText('42')
  await p.getByTestId('xl-sheet-tab').nth(1).click({ button: 'right' })
  await p.getByTestId('xl-tab-delete').click()
  await expect(p.getByTestId('xl-sheet-tab')).toHaveCount(1)
  await expect(cell(p, 'A1')).toHaveText('#REF!')
  await p.getByTestId('xl-sheet-tab').first().click({ button: 'right' })
  await p.getByTestId('xl-tab-delete').click()
  await expect(p.getByTestId('xl-toast')).toContainText('at least one sheet')
})

test('a chart drawn from the selection, re-typed from the Chart tab, and moving with the data', async ({ page: p }) => {
  await newBlank(p)
  for (const [ref, v] of [['A1', 'Month'], ['B1', 'Sales'], ['A2', 'Jan'], ['B2', '10'], ['A3', 'Feb'], ['B3', '30']]) await typeIn(p, ref, v)
  await clickCell(p, 'A1')
  await clickCell(p, 'B3', { shift: true })
  await p.getByTestId('tab-insert').click()
  await p.getByTestId('xl-chart-column').click()
  await expect(p.getByTestId('xl-chart')).toBeVisible()
  await expect(p.getByTestId('chart-bar')).toHaveCount(2)
  await expect(p.getByTestId('tab-chart')).toHaveAttribute('aria-selected', 'true')
  await p.getByTestId('xl-chart-type-pie').click()
  await expect(p.getByTestId('chart-slice')).toHaveCount(2)
  await p.getByTestId('xl-chart-title').fill('Quarter')
  await p.getByTestId('xl-chart-title').press('Enter')
  await expect(p.getByTestId('chart-title')).toHaveText('Quarter')
  // The chart is a view of the cells: change a cell and the slice changes.
  await typeIn(p, 'B3', '10')
  await expect(p.locator('[data-testid="chart-slice"] title').first()).toContainText('10')
})

test('merge cells keeps the top-left value and unmerge splits them again', async ({ page: p }) => {
  await newBlank(p)
  await typeIn(p, 'A1', 'Title')
  await typeIn(p, 'B1', 'gone')
  await clickCell(p, 'A1')
  await clickCell(p, 'C1', { shift: true })
  await p.getByTestId('xl-merge').click()
  await expect(p.getByTestId('xl-toast')).toBeVisible()
  const box = await cell(p, 'A1').boundingBox()
  const c = await p.locator('[data-col-header="C"]').boundingBox()
  expect(box!.x + box!.width).toBeGreaterThan(c!.x + c!.width - 3)
  await expect(cell(p, 'B1')).toHaveCount(0)
  await clickCell(p, 'A1')
  await p.getByTestId('xl-merge').click()
  const after = await cell(p, 'A1').boundingBox()
  expect(after!.width).toBeLessThan(box!.width / 2)
})

test('find and replace across the sheet', async ({ page: p }) => {
  await newBlank(p)
  for (const [ref, v] of [['A1', 'Jeddah'], ['A2', 'Riyadh'], ['A3', 'jeddah port']]) await typeIn(p, ref, v)
  await p.keyboard.press('Control+h')
  await p.getByTestId('xl-find-input').fill('jeddah')
  await expect(p.getByTestId('xl-find-count')).toHaveText('1 of 2')
  await p.getByTestId('xl-replace-input').fill('Makkah')
  await p.getByTestId('xl-replace-all').click()
  await expect(cell(p, 'A1')).toHaveText('Makkah')
  await expect(cell(p, 'A3')).toHaveText('Makkah port')
  await expect(p.getByTestId('xl-find-message')).toContainText('2')
})

test('freeze the top row: it stays while the sheet scrolls', async ({ page: p }) => {
  await newBlank(p)
  await typeIn(p, 'A1', 'Header')
  await p.getByTestId('tab-view').click()
  await p.getByTestId('xl-freeze-top').click()
  await expect(p.getByTestId('xl-pane-top')).toBeVisible()
  const before = await cell(p, 'A1').boundingBox()
  await p.getByTestId('xl-grid').evaluate((el) => { el.scrollTop = 2000 })
  await expect(p.locator('[data-row-header="2"]')).toHaveCount(0)
  const after = await cell(p, 'A1').boundingBox()
  expect(Math.round(after!.y)).toBe(Math.round(before!.y))
})

test('a drop-down list on a cell offers its options and writes the pick', async ({ page: p }) => {
  await newBlank(p)
  await clickCell(p, 'B2')
  await p.getByTestId('tab-data').click()
  await p.getByTestId('xl-validation').click()
  await p.getByTestId('xl-validation-options').fill('Open\nClosed\nPending')
  await p.getByTestId('xl-validation-save').click()
  await p.getByTestId('xl-validation-btn').click()
  await p.getByTestId('xl-validation-list').getByText('Closed').click()
  await expect(cell(p, 'B2')).toHaveText('Closed')
})

test('notes and links on cells', async ({ page: p }) => {
  await newBlank(p)
  await typeIn(p, 'A1', 'Site')
  await clickCell(p, 'A1')
  await p.getByTestId('tab-insert').click()
  await p.getByTestId('xl-insert-note').click()
  await p.getByTestId('xl-note-text').fill('Remember to check')
  await p.getByTestId('xl-note-save').click()
  await expect(p.getByTestId('xl-note-marker')).toBeVisible()
  await p.keyboard.press('Control+k')
  await p.getByTestId('xl-link-url').fill('built-in-saudi.com')
  await p.getByTestId('xl-link-save').click()
  await saved(p)
  const c = (await storedBook(p))[0].data.sheets[0].cells['0,0'] as { note?: string; link?: string }
  expect(c.note).toBe('Remember to check')
  expect(c.link).toBe('https://built-in-saudi.com')
})

test('opening a real .xlsx from openpyxl: values, formulas, merges and what did not come across', async ({ page: p }) => {
  await p.goto('/en/apps/excel-editor/')
  await p.getByTestId('office-file-input').setInputFiles(FIX + 'openpyxl-rich.xlsx')
  await expect(p.getByTestId('xl-grid')).toBeVisible({ timeout: 20_000 })
  await expect(cell(p, 'D6')).toHaveText('618.5')
  await expect(cell(p, 'B8')).toHaveText('7.5%')
  await expect(cell(p, 'B13')).toHaveText('#DIV/0!')
  // Sales, Settings and an Arabic-named summary sheet.
  await expect(p.getByTestId('xl-sheet-tab')).toHaveCount(3)
  await expect(p.getByTestId('xl-sheet-tab').nth(2)).toHaveText('الملخص')
  await expect(p.getByTestId('xl-pane-top')).toBeVisible()
  await expect(p.getByTestId('xl-image')).toBeVisible()
})

test('opening a CSV with Arabic text and a semicolon delimiter', async ({ page: p }) => {
  await p.goto('/en/apps/excel-editor/')
  await p.getByTestId('office-file-input').setInputFiles({ name: 'people.csv', mimeType: 'text/csv', buffer: Buffer.from('﻿الاسم;العمر\nنورة;31\nعمر;28\n') })
  await expect(cell(p, 'A2')).toHaveText('نورة')
  await expect(cell(p, 'B3')).toHaveText('28')
})

test('a damaged or legacy file is named, not opened as junk', async ({ page: p }) => {
  await p.goto('/en/apps/excel-editor/')
  await p.getByTestId('office-file-input').setInputFiles({ name: 'old.xlsx', mimeType: 'application/octet-stream', buffer: Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0, 0, 0, 0]) })
  await expect(p.getByTestId('office-import-error')).toContainText('old binary Office file')
})

test('Download as .xlsx: the file holds the formula and its cached value', async ({ page: p }) => {
  await newBlank(p)
  await typeIn(p, 'A1', '6')
  await typeIn(p, 'A2', '=A1*7')
  await p.getByTestId('office-file').click()
  const [dl] = await Promise.all([p.waitForEvent('download'), p.getByTestId('office-export-xlsx').click()])
  const buf = readFileSync(await dl.path())
  expect(zipNames(buf)).toContain('xl/workbook.xml')
  const sheet = zipPart(buf, 'xl/worksheets/sheet1.xml')
  expect(sheet).toMatch(/<f>A1\*7<\/f><v>42<\/v>/)
})

test('Save to a file on this device writes the workbook back to it on every save', async ({ page: p }) => {
  // The picker is a dialog no test can drive, so it is replaced — by a REAL file
  // handle from the origin-private file system, which is writable, survives
  // being stored in IndexedDB like a picked one, and can be read back.
  await p.addInitScript(() => {
    const pick = async () => (await navigator.storage.getDirectory()).getFileHandle('budget.xlsx', { create: true })
    ;(window as unknown as Record<string, unknown>).showSaveFilePicker = pick
    ;(window as unknown as Record<string, unknown>).showOpenFilePicker = async () => [await pick()]
  })
  await newBlank(p)
  await typeIn(p, 'A1', 'linked')
  await p.getByTestId('office-file').click()
  await p.getByTestId('office-link').click()
  await expect(p.getByTestId('office-status')).toContainText('budget.xlsx')
  await typeIn(p, 'A2', 'second save')
  await p.keyboard.press('Control+s')
  await saved(p)
  const bytes = async () => p.evaluate(async () => Array.from(new Uint8Array(await (await (await (await navigator.storage.getDirectory()).getFileHandle('budget.xlsx')).getFile()).arrayBuffer())))
  await expect.poll(async () => { const b = Buffer.from(await bytes()); return b.length > 0 && zipNames(b).includes('xl/workbook.xml') ? JSON.stringify(zipNames(b).map((n) => (n.endsWith('.xml') ? zipPart(b, n) : '')).join('')) : '' }).toContain('second save')
})

test('templates compute: the budget totals and its chart', async ({ page: p }) => {
  await p.goto('/en/apps/excel-editor/')
  await p.getByTestId('office-template-budget').click()
  await expect(cell(p, 'B8')).toContainText('10,150.00')
  await expect(p.getByTestId('chart-bar')).toHaveCount(12)
})

test('Arabic: the interface and a template sheet run right to left', async ({ page: p }) => {
  await p.goto('/ar/apps/excel-editor/')
  await p.getByTestId('office-template-invoice').click()
  await expect(p.getByTestId('xl-grid')).toHaveAttribute('data-rtl', '1')
  await expect(p.getByTestId('tab-home')).toHaveText('الرئيسية')
  // Column A is on the RIGHT in a right-to-left sheet.
  const a = await p.locator('[data-col-header="A"]').boundingBox()
  const b = await p.locator('[data-col-header="B"]').boundingBox()
  expect(a!.x).toBeGreaterThan(b!.x)
  // 12 × 350 + 2,500 = 6,700; VAT 1,005; total 7,705 — the formulas ran.
  await expect(cell(p, 'D12')).toContainText('7,705.00')
})

test('library: rename, duplicate and delete a document', async ({ page: p }) => {
  await newBlank(p)
  await p.getByTestId('office-title').fill('Original')
  await saved(p)
  await p.getByTestId('office-back').click()
  await p.getByTestId('office-doc-menu').first().click()
  await p.getByTestId('office-doc-duplicate').click()
  await expect(p.getByTestId('office-doc')).toHaveCount(2)
  await p.getByTestId('office-doc-menu').first().click()
  await p.getByTestId('office-doc-rename').click()
  await p.getByTestId('office-rename-input').fill('Renamed')
  await p.getByTestId('office-rename-go').click()
  await expect(p.getByTestId('office-doc-title').filter({ hasText: 'Renamed' })).toBeVisible()
  await p.getByTestId('office-doc-menu').first().click()
  await p.getByTestId('office-doc-delete').click()
  await p.getByTestId('office-confirm-delete-go').click()
  await expect(p.getByTestId('office-doc')).toHaveCount(1)
})

test.describe('live co-editing, with the owner as the truth', () => {
  let relay: Relay
  test.beforeAll(async () => { relay = await startRelay() })
  test.afterAll(async () => { await relay.close() })

  async function hostAndJoin(browser: import('@playwright/test').Browser, role: 'edit' | 'view' = 'edit') {
    const oc = await relayContext(browser, relay)
    const owner = await oc.newPage()
    await newBlank(owner)
    await typeIn(owner, 'A1', 'secret-owner-value')
    await owner.getByTestId('office-share').click()
    if (role === 'view') await owner.getByTestId('collab-role-view').click()
    await owner.getByTestId('collab-start').click()
    const link = await owner.getByTestId('collab-link').inputValue()
    await owner.getByTestId('sheet-close').click()
    const gc = await relayContext(browser, relay)
    const guest = await gc.newPage()
    await guest.goto(link.replace(/^https?:\/\/[^/]+/, ''))
    await guest.getByTestId('collab-name').fill('Omar')
    await guest.getByTestId('office-join-go').click()
    await expect(cell(guest, 'A1')).toHaveText('secret-owner-value', { timeout: 30_000 })
    return { owner, guest }
  }

  test('a guest sees the owner document and edits flow both ways', async ({ browser }) => {
    const { owner, guest } = await hostAndJoin(browser)
    await typeIn(guest, 'B1', 'from-guest')
    await expect(cell(owner, 'B1')).toHaveText('from-guest')
    await typeIn(owner, 'C1', '=LEN(B1)')
    await expect(cell(guest, 'C1')).toHaveText('10')
    // The owner's copy is the one that is saved.
    await saved(owner)
    expect((await storedBook(owner)).some((d) => d.data.sheets[0].cells['0,1']?.input === 'from-guest')).toBe(true)
    // A structural edit from the guest waits for the owner and lands the same everywhere.
    await clickCell(guest, 'A1')
    await guest.getByTestId('xl-insert-cells').click()
    await guest.getByTestId('xl-insert-row-above').click()
    await expect(cell(owner, 'A2')).toHaveText('secret-owner-value')
    await expect(cell(guest, 'A2')).toHaveText('secret-owner-value')
    // Presence: the owner sees where the guest is.
    await expect(owner.getByTestId('xl-peer')).toBeVisible()
    // Chat travels too.
    await guest.getByTestId('office-share').click()
    await guest.getByTestId('collab-chat-input').fill('hello there')
    await guest.getByTestId('collab-chat-send').click()
    await expect(owner.getByTestId('office-unread')).toHaveText('1')
    // Nothing the two typed ever reached the relay.
    for (const s of ['secret-owner-value', 'from-guest', 'hello there']) expect(relay.bodies.some((b) => b.includes(s))).toBe(false)
  })

  test('a view-only guest cannot edit, and is told so', async ({ browser }) => {
    const { owner, guest } = await hostAndJoin(browser, 'view')
    await expect(guest.getByTestId('office-viewonly')).toBeVisible()
    await clickCell(guest, 'B2')
    await guest.keyboard.type('nope')
    await guest.keyboard.press('Enter')
    await expect(cell(guest, 'B2')).toHaveCount(0)
    await expect(cell(owner, 'B2')).toHaveCount(0)
  })

  test('when the owner ends the session, the guest is told and can keep a copy', async ({ browser }) => {
    const { owner, guest } = await hostAndJoin(browser)
    await owner.getByTestId('office-share').click()
    await owner.getByTestId('collab-stop').click()
    await expect(guest.getByTestId('office-banner')).toBeVisible({ timeout: 15_000 })
    await guest.getByTestId('office-banner-save').click()
    await expect(guest.getByTestId('xl-grid')).toBeVisible()
    await expect.poll(async () => (await storedBook(guest)).length).toBe(1)
  })
})
