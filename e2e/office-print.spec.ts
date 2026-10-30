import { test, expect, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'

// Print preview in the three editors. The preview IS the printed document — the
// same paged HTML is what Print sends — so these read the pages inside the
// preview's own frame, and count real print() calls from any frame.
const WD = 'src/tools/word-editor/io/__fixtures__/'
const PP = 'src/tools/powerpoint-editor/io/__fixtures__/'

async function stubPrint(p: Page) {
  // Runs in every frame, the hidden print frame included.
  await p.addInitScript(() => {
    window.print = () => { const t = window.top as unknown as { __printed?: number }; t.__printed = (t.__printed || 0) + 1 }
  })
}
async function open(p: Page, app: string, file: string) {
  await p.goto(`/en/apps/${app}/`)
  await p.getByTestId('office-file-input').setInputFiles(file)
  await expect(p.getByTestId('office-title')).toBeVisible({ timeout: 20_000 })
  const ok = p.getByTestId('office-loss-ok')
  if (await ok.isVisible().catch(() => false)) await ok.click()
}
async function preview(p: Page) {
  await p.getByTestId('office-file').click()
  await p.getByTestId('office-print').click()
  await expect(p.getByTestId('office-preview-frame')).toBeVisible({ timeout: 20_000 })
  return p.frameLocator('[data-testid="office-preview-frame"]')
}

test('Word: the preview is real pages, with the page break, header and page numbers, and Print prints it', async ({ page: p }) => {
  await stubPrint(p)
  await open(p, 'word-editor', WD + 'python-docx.docx')
  await p.getByTestId('wd-footer').fill('Page {page} of {pages}')
  const f = await preview(p)
  await expect(p.getByTestId('office-preview-pages')).toHaveAttribute('data-pages', '2')
  const pages = f.locator('.pv-pg')
  await expect(pages).toHaveCount(2)
  await expect(pages.nth(0)).toContainText('Quarterly report')
  // The explicit break decides where page two starts.
  await expect(pages.nth(1).locator('.pv-area')).toContainText('After the break')
  // Running header on every page, and the footer's page numbers filled in.
  await expect(pages.nth(0).locator('.pv-run').first()).toHaveText('Confidential')
  await expect(pages.nth(0).locator('.pv-run').last()).toHaveText('Page 1 of 2')
  await expect(pages.nth(1).locator('.pv-run').last()).toHaveText('Page 2 of 2')
  expect(await p.evaluate(() => (window as unknown as { __printed?: number }).__printed || 0)).toBe(0)
  await p.getByTestId('office-preview-print').click()
  await expect.poll(() => p.evaluate(() => (window as unknown as { __printed?: number }).__printed || 0)).toBe(1)
  await p.getByTestId('office-preview-close').click()
  await expect(p.getByTestId('office-preview')).toHaveCount(0)
})

test('Word: a long document breaks between paragraphs, never through a line', async ({ page: p }) => {
  await p.goto('/en/apps/word-editor/')
  await p.getByTestId('office-new').click()
  await p.getByTestId('wd-editor').click()
  for (let i = 1; i <= 70; i++) { await p.keyboard.type(`Paragraph number ${i} of the long document.`); await p.keyboard.press('Enter') }
  const f = await preview(p)
  const n = Number(await p.getByTestId('office-preview-pages').getAttribute('data-pages'))
  expect(n).toBeGreaterThan(1)
  // Every page's visible slice ends exactly at a paragraph's bottom: nothing is cut.
  const cut = await f.locator('body').evaluate(() => {
    const out: number[] = []
    document.querySelectorAll('.pv-pg').forEach((pg) => {
      const area = pg.querySelector('.pv-area') as HTMLElement
      const a = area.getBoundingClientRect()
      for (const el of area.querySelectorAll('p')) { const r = el.getBoundingClientRect(); if (r.top < a.bottom - 0.5 && r.bottom > a.bottom + 0.5) out.push(r.bottom - a.bottom) }
    })
    return out
  })
  expect(cut).toEqual([])
})

test('Excel: a wide sheet prints landscape, scaled to fit, with every column', async ({ page: p }) => {
  await p.goto('/en/apps/excel-editor/')
  await p.getByTestId('office-new').click()
  await expect(p.getByTestId('xl-active')).toHaveAttribute('data-cell', 'A1')
  for (let c = 0; c < 14; c++) { await p.keyboard.type(`Col${c + 1}`); await p.keyboard.press('Tab') }
  await p.keyboard.press('Enter')
  const f = await preview(p)
  const pg = f.locator('.pv-pg').first()
  await expect(pg).toContainText('Col1')
  await expect(pg).toContainText('Col14')
  const box = await pg.evaluate((el) => ({ w: el.getBoundingClientRect().width, h: el.getBoundingClientRect().height, table: el.querySelector('table')!.getBoundingClientRect().right, right: el.querySelector('.pv-area')!.getBoundingClientRect().right }))
  expect(box.w).toBeGreaterThan(box.h)
  // Scaled down rather than cut off at the right-hand margin.
  expect(box.table).toBeLessThanOrEqual(box.right + 1)
})

test('PowerPoint: one shown slide to a sheet, at the slide\'s proportions', async ({ page: p }) => {
  await open(p, 'powerpoint-editor', PP + 'python-pptx.pptx')
  const f = await preview(p)
  await expect(f.locator('.pv-pg')).toHaveCount(4)
  await expect(f.locator('.pv-pg').first()).toContainText('Product launch')
  const r = await f.locator('.pv-pg').first().evaluate((el) => el.getBoundingClientRect().width / el.getBoundingClientRect().height)
  expect(r).toBeCloseTo(16 / 9, 1)
})

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 800 } })
  test('a document opens at its natural layout, the whole page shown, not reflowed into a column', async ({ page: p }) => {
    await open(p, 'word-editor', WD + 'python-docx.docx')
    const page = p.getByTestId('wd-page')
    await expect(page).toBeVisible()
    // Laid out at the page's real width (Letter is 816px) …
    expect(await page.evaluate((el) => (el as HTMLElement).offsetWidth)).toBeGreaterThan(780)
    // … and scaled to fit the screen, so all of it is in view.
    await expect.poll(async () => Number(await page.locator('xpath=..').getAttribute('data-zoom'))).toBeLessThan(0.6)
    const b = (await page.boundingBox())!
    expect(b.x).toBeGreaterThanOrEqual(0)
    expect(b.x + b.width).toBeLessThanOrEqual(390)
    // Choosing a zoom is respected, not refitted.
    await p.getByTestId('tab-view').click()
    expect(await p.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  })
})

test('the library card is the first printed page, drawn — not a sketch', async ({ page: p }) => {
  for (const [app, file] of [['word-editor', WD + 'python-docx.docx'], ['excel-editor', 'src/tools/excel-editor/io/__fixtures__/openpyxl-rich.xlsx'], ['powerpoint-editor', PP + 'python-pptx.pptx']]) {
    await open(p, app, file)
    await p.getByTestId('office-back').click()
    const img = p.getByTestId('office-doc').first().locator('img')
    await expect(img).toHaveAttribute('src', /^data:image\/jpeg;base64,/, { timeout: 10_000 })
    // Drawn from the page: it has ink on it, not a blank white sheet.
    const inked = await img.evaluate(async (el: HTMLImageElement) => {
      await el.decode()
      const c = document.createElement('canvas'); c.width = el.naturalWidth; c.height = el.naturalHeight
      const g = c.getContext('2d')!; g.drawImage(el, 0, 0)
      const d = g.getImageData(0, 0, c.width, c.height).data
      let dark = 0
      for (let i = 0; i < d.length; i += 4) if (d[i] + d[i + 1] + d[i + 2] < 600) dark++
      return dark
    })
    expect(inked, app).toBeGreaterThan(50)
  }
})

test.describe('opening several files at once', () => {
  test('each file shows up at once, converts in turn, and none opens by itself', async ({ page: p }) => {
    await p.goto('/en/apps/word-editor/')
    await p.getByTestId('office-file-input').setInputFiles([
      { name: 'python-docx.docx', mimeType: 'application/octet-stream', buffer: readFileSync(WD + 'python-docx.docx') },
      { name: 'layout.docx', mimeType: 'application/octet-stream', buffer: readFileSync(WD + 'layout.docx') },
      { name: 'old.docx', mimeType: 'application/octet-stream', buffer: Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0, 0, 0, 0]) },
    ])
    // A card for each, before any conversion has finished.
    await expect(p.getByTestId('office-job')).toHaveCount(3)
    await expect(p.getByTestId('office-batch')).toBeVisible()
    // The two real files become documents with a rendered page; the bad one says why.
    await expect(p.getByTestId('office-doc')).toHaveCount(2, { timeout: 30_000 })
    await expect(p.getByTestId('office-job')).toHaveCount(1, { timeout: 30_000 })
    await expect(p.getByTestId('office-job')).toHaveAttribute('data-state', 'error')
    await expect(p.getByTestId('office-import-error')).toContainText('old binary Office file')
    await expect(p).not.toHaveURL(/doc=/)
    await expect(p.getByTestId('office-library')).toBeVisible()
    // Read back from storage, not the screen: both stored, both with a page picture of phone resolution.
    const stored = await p.evaluate(() => new Promise<{ title: string; thumb?: string }[]>((res) => {
      const r = indexedDB.open('bis-docs')
      r.onsuccess = () => { const q = r.result.transaction('docs').objectStore('docs').getAll(); q.onsuccess = () => res(q.result) }
    }))
    expect(stored).toHaveLength(2)
    for (const d of stored) expect(d.thumb).toMatch(/^data:image\/jpeg/)
    const w = await p.evaluate((src) => new Promise<number>((res) => { const i = new Image(); i.onload = () => res(Math.min(i.naturalWidth, i.naturalHeight)); i.src = src }), stored[0].thumb!)
    expect(w).toBeGreaterThanOrEqual(500)
    await p.getByTestId('office-job-dismiss').click()
    await expect(p.getByTestId('office-job')).toHaveCount(0)
  })

  test('one file still opens straight into the editor', async ({ page: p }) => {
    await p.goto('/en/apps/excel-editor/')
    await p.getByTestId('office-file-input').setInputFiles('src/tools/excel-editor/io/__fixtures__/openpyxl-rich.xlsx')
    await expect(p.getByTestId('xl-grid')).toBeVisible()
    await expect(p).toHaveURL(/doc=/)
  })
})

test('a card drawn at the old low resolution is redrawn sharp', async ({ page: p }) => {
  await p.goto('/en/apps/word-editor/')
  await p.getByTestId('office-file-input').setInputFiles(WD + 'python-docx.docx')
  await expect(p).toHaveURL(/doc=/)
  await p.goto('/en/apps/word-editor/')
  const store = (fn: string) => p.evaluate((fn) => new Promise<number>((res) => {
    const r = indexedDB.open('bis-docs')
    r.onsuccess = () => {
      const os = r.result.transaction('docs', 'readwrite').objectStore('docs')
      const q = os.getAll()
      q.onsuccess = () => {
        const d = q.result[0]
        if (fn === 'shrink') { const c = document.createElement('canvas'); c.width = 24; c.height = 18; d.thumb = c.toDataURL('image/jpeg'); os.put(d); res(0); return }
        const i = new Image(); i.onload = () => res(Math.min(i.naturalWidth, i.naturalHeight)); i.onerror = () => res(0); i.src = d.thumb
      }
    }
  }), fn)
  await store('shrink')
  await p.reload()
  await expect.poll(() => store('measure'), { timeout: 20_000 }).toBeGreaterThanOrEqual(500)
})

test.describe('the download button and the navbar', () => {
  for (const [tool, ext, ready] of [['word-editor', '.docx', 'wd-editor'], ['excel-editor', '.xlsx', 'xl-grid'], ['powerpoint-editor', '.pptx', 'sl-canvas']] as const) {
    for (const locale of ['en', 'ar'] as const) {
      test(`${tool} (${locale}): one tap downloads the ${ext}, from the inline-end corner`, async ({ page: p }) => {
        await p.goto(`/${locale}/apps/${tool}/`)
        await p.getByTestId('office-new').click()
        await expect(p.getByTestId(ready)).toBeVisible()
        const btn = p.getByTestId('office-download')
        const b = (await btn.boundingBox())!
        const vw = p.viewportSize()!.width
        if (locale === 'en') expect(vw - (b.x + b.width)).toBeLessThan(40)
        else expect(b.x).toBeLessThan(40)
        expect(p.viewportSize()!.height - (b.y + b.height)).toBeLessThan(80)
        if (tool === 'excel-editor') {
          const tabs = (await p.getByTestId('xl-tabs').boundingBox())!
          expect(b.y + b.height).toBeLessThanOrEqual(tabs.y)
        }
        const [dl] = await Promise.all([p.waitForEvent('download'), btn.click()])
        expect(dl.suggestedFilename()).toMatch(new RegExp(`\\${ext}$`))
      })
    }
  }

  test('Present is in the navbar, not the ribbon', async ({ page: p }) => {
    await p.goto('/en/apps/powerpoint-editor/')
    await p.getByTestId('office-new').click()
    await expect(p.locator('[data-testid="office-shell"] header [data-testid="sl-present-start"]')).toBeVisible()
    await p.getByTestId('sl-present-start').click()
    await expect(p.getByTestId('sl-show')).toBeVisible()
  })
})
