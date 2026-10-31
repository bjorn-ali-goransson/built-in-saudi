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
