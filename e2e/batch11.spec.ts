import { test, expect } from '@playwright/test'
import { PDFDocument, StandardFonts } from 'pdf-lib'

async function pagesPdf(n: number): Promise<Buffer> {
  const pdf = await PDFDocument.create()
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  for (let i = 1; i <= n; i++) {
    const page = pdf.addPage([400, 560])
    page.drawText(`PAGE ${i}`, { x: 40, y: 500, size: 28, font })
  }
  return Buffer.from(await pdf.save())
}

async function readDownload(dl: import('@playwright/test').Download): Promise<Uint8Array> {
  const stream = await dl.createReadStream()
  const chunks: Buffer[] = []
  for await (const c of stream) chunks.push(c as Buffer)
  return new Uint8Array(Buffer.concat(chunks))
}

test.describe('booklet imposition', () => {
  test('states the sheet count and pads to a multiple of four', async ({ page }) => {
    await page.goto('/en/apps/pdf-booklet')
    await page.getByTestId('pb-file').setInputFiles({ name: 'doc.pdf', mimeType: 'application/pdf', buffer: await pagesPdf(6) })
    await expect(page.getByTestId('pb-pages')).toHaveText('6 pages')
    // 6 pages → padded to 8 → 4 printed sides.
    await expect(page.getByTestId('pb-sheets')).toHaveText('4 printed sides')
    await expect(page.getByTestId('pb-padded')).toContainText('2 blank pages')
  })

  test('the saddle-stitch order is last-beside-first, walking inwards', async ({ page }) => {
    await page.goto('/en/apps/pdf-booklet')
    await page.getByTestId('pb-file').setInputFiles({ name: 'doc.pdf', mimeType: 'application/pdf', buffer: await pagesPdf(8) })
    const order = page.getByTestId('pb-order')
    // Sheet 1 front: 8 · 1. Its back: 2 · 7. Then 6 · 3, and 4 · 5.
    await expect(order).toContainText('8 · 1')
    await expect(order).toContainText('2 · 7')
    await expect(order).toContainText('6 · 3')
  })

  test('imposing produces a landscape PDF with half the pages', async ({ page }) => {
    await page.goto('/en/apps/pdf-booklet')
    await page.getByTestId('pb-file').setInputFiles({ name: 'doc.pdf', mimeType: 'application/pdf', buffer: await pagesPdf(8) })
    const dl = page.waitForEvent('download')
    await page.getByTestId('pb-apply').click()
    const file = await dl
    expect(file.suggestedFilename()).toBe('doc-booklet.pdf')
    const out = await PDFDocument.load(await readDownload(file))
    expect(out.getPageCount()).toBe(4)
    // Two portrait pages side by side, so the sheet is landscape.
    const p = out.getPage(0)
    expect(p.getWidth()).toBeGreaterThan(p.getHeight())
  })

  test('4-up keeps the sheet portrait and quarters the page count', async ({ page }) => {
    await page.goto('/en/apps/pdf-booklet')
    await page.getByTestId('pb-file').setInputFiles({ name: 'doc.pdf', mimeType: 'application/pdf', buffer: await pagesPdf(8) })
    await page.getByTestId('pb-mode').selectOption('nup4')
    await expect(page.getByTestId('pb-sheets')).toHaveText('2 printed sides')
    const dl = page.waitForEvent('download')
    await page.getByTestId('pb-apply').click()
    const out = await PDFDocument.load(await readDownload(await dl))
    expect(out.getPageCount()).toBe(2)
    const p = out.getPage(0)
    expect(p.getHeight()).toBeGreaterThan(p.getWidth())
  })
})

test.describe('page numbers and watermark', () => {
  test('previews the number the first numbered page will carry', async ({ page }) => {
    await page.goto('/en/apps/pdf-stamp')
    await expect(page.getByTestId('ps-preview')).toContainText('1')
    await page.getByTestId('ps-format').selectOption('page-n-of-total')
    await expect(page.getByTestId('ps-preview')).toContainText('Page 1 of 10')
    // A cover page: numbering starts on page 2 and that page is called 1.
    await page.getByTestId('ps-startat').fill('2')
    await page.getByTestId('ps-firstnumber').fill('1')
    await expect(page.getByTestId('ps-preview')).toContainText('Page 1')
  })

  test('Arabic-Indic numerals are an option', async ({ page }) => {
    await page.goto('/en/apps/pdf-stamp')
    await page.getByTestId('ps-format').selectOption('arabic-indic')
    await expect(page.getByTestId('ps-preview')).toContainText('١')
  })

  test('stamping keeps the page count and the original text', async ({ page }) => {
    await page.goto('/en/apps/pdf-stamp')
    await page.getByTestId('ps-file').setInputFiles({ name: 'doc.pdf', mimeType: 'application/pdf', buffer: await pagesPdf(3) })
    await page.getByTestId('ps-watermark').fill('DRAFT')
    const dl = page.waitForEvent('download')
    await page.getByTestId('ps-apply').click()
    const file = await dl
    expect(file.suggestedFilename()).toBe('doc-stamped.pdf')
    const out = await PDFDocument.load(await readDownload(file))
    expect(out.getPageCount()).toBe(3)
  })

  test('says a watermark is decoration, not protection', async ({ page }) => {
    await page.goto('/en/apps/pdf-stamp')
    await expect(page.getByText(/decoration, not protection/)).toBeVisible()
  })
})

test.describe('label sheets', () => {
  test('counts labels and sheets for the chosen stock', async ({ page }) => {
    await page.goto('/en/apps/label-sheet')
    await page.getByTestId('ls-entries').fill(Array.from({ length: 25 }, (_, i) => `Label ${i + 1}`).join('\n'))
    await expect(page.getByTestId('ls-count')).toHaveText('25 labels')
    // A4 3×7 = 21 per sheet, so 25 needs two.
    await expect(page.getByTestId('ls-sheets')).toHaveText('2 sheets')
  })

  test('starting mid-sheet pushes the labels onto a second sheet sooner', async ({ page }) => {
    await page.goto('/en/apps/label-sheet')
    await page.getByTestId('ls-entries').fill(Array.from({ length: 20 }, (_, i) => `L${i}`).join('\n'))
    await expect(page.getByTestId('ls-sheets')).toHaveText('1 sheet')
    await page.getByTestId('ls-startat').fill('10')
    await expect(page.getByTestId('ls-sheets')).toHaveText('2 sheets')
  })

  test('repeat mode fills the rest of the sheet from one label', async ({ page }) => {
    await page.goto('/en/apps/label-sheet')
    await page.getByTestId('ls-entries').fill('Return address')
    await page.getByTestId('ls-mode-repeat').click()
    await expect(page.getByTestId('ls-count')).toHaveText('21 labels')
    await page.getByTestId('ls-startat').fill('7')
    await expect(page.getByTestId('ls-count')).toHaveText('15 labels')
  })

  test('downloads a PDF of the right page count', async ({ page }) => {
    await page.goto('/en/apps/label-sheet')
    await page.getByTestId('ls-entries').fill(Array.from({ length: 25 }, (_, i) => `Label ${i + 1}`).join('\n'))
    const dl = page.waitForEvent('download')
    await page.getByTestId('ls-download').click()
    const file = await dl
    expect(file.suggestedFilename()).toBe('labels-a4-3x7.pdf')
    const out = await PDFDocument.load(await readDownload(file))
    expect(out.getPageCount()).toBe(2)
  })
})

test.describe('certificate generator', () => {
  test('one page per name, in a single PDF', async ({ page }) => {
    await page.goto('/en/apps/certificate')
    await page.getByTestId('ct-names').fill('Ahmed Al-Otaibi\nفاطمة النور\nKhalid')
    await expect(page.getByTestId('ct-count')).toHaveText('3 certificates')
    const dl = page.waitForEvent('download')
    await page.getByTestId('ct-download').click()
    const file = await dl
    expect(file.suggestedFilename()).toBe('certificates.pdf')
    const out = await PDFDocument.load(await readDownload(file))
    expect(out.getPageCount()).toBe(3)
    // Landscape A4 by default.
    const p = out.getPage(0)
    expect(p.getWidth()).toBeGreaterThan(p.getHeight())
  })

  test('the preview steps through the names', async ({ page }) => {
    await page.goto('/en/apps/certificate')
    await page.getByTestId('ct-names').fill('First\nSecond\nThird')
    await expect(page.getByTestId('ct-index')).toHaveText('1 of 3')
    await page.getByTestId('ct-next').click()
    await expect(page.getByTestId('ct-index')).toHaveText('2 of 3')
    await expect(page.getByTestId('ct-preview')).toBeVisible()
  })

  test('portrait is available and changes the page shape', async ({ page }) => {
    await page.goto('/en/apps/certificate')
    await page.getByTestId('ct-names').fill('Someone')
    await page.getByTestId('ct-landscape').uncheck()
    const dl = page.waitForEvent('download')
    await page.getByTestId('ct-download').click()
    const out = await PDFDocument.load(await readDownload(await dl))
    const p = out.getPage(0)
    expect(p.getHeight()).toBeGreaterThan(p.getWidth())
  })

  test('nothing to download without a name', async ({ page }) => {
    await page.goto('/en/apps/certificate')
    await expect(page.getByTestId('ct-download')).toBeDisabled()
    await expect(page.getByTestId('ct-count')).toHaveText('0 certificates')
  })
})
