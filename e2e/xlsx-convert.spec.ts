import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const fx = (n: string) => readFileSync(fileURLToPath(new URL(`./fixtures/${n}`, import.meta.url)))

async function open(page: import('@playwright/test').Page, file: string, locale = 'en') {
  // Reading back what the tool copied is the cleanest way to assert the exact
  // CSV/JSON it produces, rather than eyeballing a rendered table.
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.goto(`/${locale}/apps/xlsx-convert`)
  await page.getByTestId('xl-file').setInputFiles({
    name: file,
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: fx(file),
  })
  await expect(page.getByTestId('xl-preview')).toBeVisible({ timeout: 20_000 })
}

test('reads shared strings, including a cell split across runs', async ({ page }) => {
  // A t="s" cell holds an INDEX into sharedStrings.xml. Miss that and every
  // text cell in a real Excel file reads as a number.
  await open(page, 'shared.xlsx')
  const table = page.getByTestId('xl-preview')
  await expect(table).toContainText('Item')
  await expect(table).toContainText('سماعات')
  // Excel splits a cell across <r> runs when part of it is styled differently;
  // taking only the first <t> would yield "Split".
  await expect(table).toContainText('SplitRun')
})

test('turns date-formatted numbers back into dates, custom format and built-in alike', async ({ page }) => {
  await open(page, 'shared.xlsx')
  const table = page.getByTestId('xl-preview')
  // 45658 with a date format is 2025-01-01, not "45658".
  await expect(table).toContainText('2025-01-01')
  await expect(table).not.toContainText('45658')
})

test('a missing cell stays a gap instead of shifting the row left', async ({ page }) => {
  await open(page, 'shared.xlsx')
  await page.getByTestId('xl-format-csv').click()
  await page.getByTestId('xl-copy').click()
  const csv = await page.evaluate(() => navigator.clipboard.readText())
  const rows = csv.split('\r\n')
  // Row 3 has no B cell at all; the 7 belongs in column C.
  const gapRow = rows.find((r) => r.startsWith('No date'))!
  expect(gapRow).toBe('No date,,7')
})

test('a formula comes out as its cached value', async ({ page }) => {
  await open(page, 'shared.xlsx')
  await expect(page.getByTestId('xl-preview')).toContainText('10')
})

test('reads a workbook written by a real spreadsheet library, with several sheets', async ({ page }) => {
  await open(page, 'sample.xlsx')
  await expect(page.getByTestId('xl-preview')).toContainText('Ahmed Al-Otaibi')
  await expect(page.getByTestId('xl-preview')).toContainText('2024-03-17')
  // The second sheet is Arabic-named and selectable.
  const options = await page.getByTestId('xl-sheet').locator('option').allInnerTexts()
  expect(options.join(' ')).toContain('الأرقام')
  await page.getByTestId('xl-sheet').selectOption({ index: 1 })
  await expect(page.getByTestId('xl-preview')).toContainText('قيمة')
})

test('exports JSON keyed by the header row', async ({ page }) => {
  await open(page, 'shared.xlsx')
  await page.getByTestId('xl-format-json').click()
  await page.getByTestId('xl-copy').click()
  const json = JSON.parse(await page.evaluate(() => navigator.clipboard.readText()))
  expect(Array.isArray(json)).toBe(true)
  expect(json[0]).toHaveProperty('Item')
  expect(json[0]).toHaveProperty('Ordered', '2025-01-01')
})

test('a file that is not a workbook is refused with a reason', async ({ page }) => {
  await page.goto('/en/apps/xlsx-convert')
  await page.getByTestId('xl-file').setInputFiles({
    name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('just some text'),
  })
  await expect(page.getByTestId('file-error')).toBeVisible({ timeout: 15_000 })
  await expect(page.getByTestId('file-error')).toContainText('.xls')
})

test('downloads a CSV named after the sheet', async ({ page }) => {
  await open(page, 'shared.xlsx')
  const dl = page.waitForEvent('download')
  await page.getByTestId('xl-download').click()
  expect((await dl).suggestedFilename()).toMatch(/Orders\.csv$/)
})

test('works in Arabic too', async ({ page }) => {
  await open(page, 'shared.xlsx', 'ar')
  await expect(page.getByTestId('xl-size')).toBeVisible()
})
