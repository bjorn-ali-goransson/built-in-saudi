import { test, expect } from '@playwright/test'
import { PDFDocument, StandardFonts } from 'pdf-lib'

/**
 * A PDF whose pages are described by their lines; an empty array of lines makes
 * a page with nothing extractable on it — which is what a scan looks like to a
 * text extractor.
 */
async function pdf(pages: string[][]): Promise<Buffer> {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  for (const lines of pages) {
    const page = doc.addPage([400, 400])
    lines.forEach((line, i) => page.drawText(line, { x: 40, y: 340 - i * 24, size: 14, font }))
  }
  return Buffer.from(await doc.save())
}

const pick = (page: import('@playwright/test').Page, buffer: Buffer, name = 'scan.pdf') =>
  page.getByTestId('pk-file').setInputFiles({ name, mimeType: 'application/pdf', buffer })

test.describe('ocr a scanned pdf', () => {
  test('a PDF that already has text is sent to the extractor instead', async ({ page }) => {
    await page.goto('/en/apps/pdf-ocr')
    await pick(page, await pdf([['Contract of employment', 'Signed in Riyadh on 1 March']]), 'contract.pdf')
    await expect(page.getByTestId('pk-has-text')).toBeVisible()
    await page.getByTestId('pk-use-extract').click()
    await expect(page).toHaveURL(/\/en\/apps\/pdf-to-text/)
  })

  test('a mixed file says only the picture pages were read by eye', async ({ page }) => {
    await page.goto('/en/apps/pdf-ocr')
    await pick(page, await pdf([['This page carries real selectable text in it'], []]))
    await expect(page.getByTestId('pk-some-text')).toBeVisible()
    await expect(page.getByTestId('pk-has-text')).toHaveCount(0)
  })

  test('a picture-only PDF gets no such banner and can be read', async ({ page }) => {
    test.slow() // loading the OCR engine and its language model is the slow part
    await page.goto('/en/apps/pdf-ocr')
    await pick(page, await pdf([[]]))
    await expect(page.getByTestId('pk-has-text')).toHaveCount(0)
    await expect(page.getByTestId('pk-some-text')).toHaveCount(0)

    await page.getByTestId('pk-run').click()
    // A blank page really has nothing on it, so the honest answer is "no text
    // found" — the point here is that the engine started, ran and reported.
    await expect(page.getByTestId('pk-pages')).toBeVisible({ timeout: 120_000 })
    await expect(page.getByTestId('pk-empty')).toBeVisible()
  })

  test('pages that already have text are kept as they are, not guessed at', async ({ page }) => {
    test.slow()
    await page.goto('/en/apps/pdf-ocr')
    await pick(page, await pdf([['Invoice number 12345 total 500 SAR'], []]))
    await page.getByTestId('pk-run').click()
    await expect(page.getByTestId('pk-page-0')).toContainText('Invoice number 12345', { timeout: 120_000 })
    await expect(page.getByTestId('pk-page-1')).toBeVisible()
    await expect(page.getByTestId('pk-download')).toBeEnabled()
  })

  test('the OCR engine and models are never fetched from a CDN', async ({ page }) => {
    test.slow()
    const offOrigin: string[] = []
    page.on('request', (r) => {
      const u = new URL(r.url())
      if (u.origin !== 'http://localhost:4173' && /tesseract|traineddata|\.wasm/.test(u.pathname)) offOrigin.push(r.url())
    })
    await page.goto('/en/apps/pdf-ocr')
    await pick(page, await pdf([[]]))
    await page.getByTestId('pk-run').click()
    await expect(page.getByTestId('pk-pages')).toBeVisible({ timeout: 120_000 })
    expect(offOrigin).toEqual([])
  })

  test('a file that is not a PDF is reported, not swallowed', async ({ page }) => {
    await page.goto('/en/apps/pdf-ocr')
    await page.getByTestId('pk-file').setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('just text') })
    await expect(page.getByTestId('file-error')).toBeVisible()
  })
})
