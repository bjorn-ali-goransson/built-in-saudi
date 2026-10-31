import { test, expect } from '@playwright/test'
import { PDFDocument, StandardFonts } from 'pdf-lib'

/** A real PDF with real text in it, so the extractor is exercised end to end. */
async function textPdf(lines: string[][]): Promise<Buffer> {
  const pdf = await PDFDocument.create()
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  for (const pageLines of lines) {
    const page = pdf.addPage([400, 400])
    pageLines.forEach((line, i) => {
      page.drawText(line, { x: 40, y: 340 - i * 24, size: 14, font })
    })
  }
  return Buffer.from(await pdf.save())
}

/** A PDF with a page but no text — what a scan looks like to an extractor. */
async function blankPdf(): Promise<Buffer> {
  const pdf = await PDFDocument.create()
  pdf.addPage([400, 400])
  return Buffer.from(await pdf.save())
}

/** A 16-bit PCM WAV: 1 second of a 440Hz tone, then 1 second of silence. */
function makeWav(seconds = 2, sampleRate = 8000): Buffer {
  const frames = seconds * sampleRate
  const buf = Buffer.alloc(44 + frames * 2)
  buf.write('RIFF', 0)
  buf.writeUInt32LE(36 + frames * 2, 4)
  buf.write('WAVE', 8)
  buf.write('fmt ', 12)
  buf.writeUInt32LE(16, 16)
  buf.writeUInt16LE(1, 20)
  buf.writeUInt16LE(1, 22)
  buf.writeUInt32LE(sampleRate, 24)
  buf.writeUInt32LE(sampleRate * 2, 28)
  buf.writeUInt16LE(2, 32)
  buf.writeUInt16LE(16, 34)
  buf.write('data', 36)
  buf.writeUInt32LE(frames * 2, 40)
  for (let i = 0; i < frames; i++) {
    const t = i / sampleRate
    const v = t < seconds / 2 ? Math.sin(2 * Math.PI * 440 * t) * 0.8 : 0
    buf.writeInt16LE(Math.round(v * 32767), 44 + i * 2)
  }
  return buf
}

test.describe('pdf to text', () => {

  test('the OCR tool inherits the password ask from the same extractor', async ({ page }) => {
    // A scanned payslip that is ALSO password-protected is the exact document
    // this tool is for, and it used to be turned away at the door. Sharing
    // pdf-to-text's extractor means the capability arrived here for free — the
    // panel is one component so three tools cannot drift into three answers.
    await page.goto('/en/apps/pdf-ocr')
    await page.getByTestId('pk-file').setInputFiles('e2e/fixtures/locked.pdf')
    await expect(page.getByTestId('pk-lock-panel')).toBeVisible()
    await page.getByTestId('pk-lock-input').fill('wrong')
    await page.getByTestId('pk-lock-unlock').click()
    await expect(page.getByTestId('pk-lock-wrong')).toBeVisible()
    await page.getByTestId('pk-lock-input').fill('letmein')
    await page.getByTestId('pk-lock-unlock').click()
    await expect(page.getByTestId('pk-lock-panel')).toHaveCount(0)
  })
})

test.describe('passport photo', () => {
  // 600×600 so it is larger than a 300dpi 35×45mm frame and the low-res warning stays off.
  const PHOTO = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64',
  )

  async function load(page: import('@playwright/test').Page) {
    await page.goto('/en/apps/passport-photo')
    // Draw a real 600×600 PNG in the page and hand it to the input, so the
    // decode path and the low-resolution check both see honest dimensions.
    const dataUrl = await page.evaluate(() => {
      const c = document.createElement('canvas')
      c.width = 600; c.height = 600
      const ctx = c.getContext('2d')!
      ctx.fillStyle = '#c8b89a'; ctx.fillRect(0, 0, 600, 600)
      ctx.fillStyle = '#3b2f22'; ctx.beginPath(); ctx.arc(300, 260, 120, 0, Math.PI * 2); ctx.fill()
      return c.toDataURL('image/png')
    })
    const buffer = Buffer.from(dataUrl.split(',')[1], 'base64')
    await page.getByTestId('pp-file').setInputFiles({ name: 'me.png', mimeType: 'image/png', buffer })
    await expect(page.getByTestId('pp-stage')).toBeVisible()
  }

  test('computes the pixel size for the chosen spec and DPI', async ({ page }) => {
    await page.goto('/en/apps/passport-photo')
    // Saudi 4×6cm at 300dpi = 472 × 709 px.
    await expect(page.getByTestId('pp-pixels')).toHaveText('472 × 709 px')
    await page.getByTestId('pp-spec').selectOption('passport-35x45')
    await expect(page.getByTestId('pp-pixels')).toHaveText('413 × 531 px')
    await page.getByTestId('pp-dpi').selectOption('600')
    await expect(page.getByTestId('pp-pixels')).toHaveText('827 × 1063 px')
  })

  test('exports a photo at exactly the spec size', async ({ page }) => {
    await load(page)
    const dl = page.waitForEvent('download')
    await page.getByTestId('pp-download').click()
    const file = await dl
    expect(file.suggestedFilename()).toBe('photo-saudi-4x6.jpg')
  })

  test('says how many copies fit on a print sheet', async ({ page }) => {
    await load(page)
    // 4×6in print is 152×102mm; a 40×60mm photo with a 2mm gap tiles 3 across, 1 down.
    await expect(page.getByTestId('pp-percount')).toContainText('3 copies')
    await page.getByTestId('pp-sheet').selectOption('a4')
    await expect(page.getByTestId('pp-percount')).toContainText('20 copies')
  })

  test('downloads the print sheet', async ({ page }) => {
    await load(page)
    const dl = page.waitForEvent('download')
    await page.getByTestId('pp-sheet-download').click()
    expect((await dl).suggestedFilename()).toBe('photo-sheet-4x6in.jpg')
  })

  test('warns when the source photo is too small to print', async ({ page }) => {
    await page.goto('/en/apps/passport-photo')
    await page.getByTestId('pp-file').setInputFiles({ name: 'tiny.png', mimeType: 'image/png', buffer: PHOTO })
    await expect(page.getByTestId('pp-lowres')).toBeVisible()
  })
})

test.describe('a locked PDF is named as such, and routed', () => {
  test('pdf-to-images asks for the password instead of calling everything locked', async ({ page }) => {
    // It used to report ANY load failure as "locked or encrypted", so a corrupt
    // file and a password-protected one got the same wrong answer.
    await page.goto('/en/apps/pdf-to-images')
    await page.getByTestId('p2i-file').setInputFiles('e2e/fixtures/locked.pdf')
    await expect(page.getByTestId('p2i-lock-panel')).toBeVisible()
    await page.getByTestId('p2i-lock-input').fill('wrong')
    await page.getByTestId('p2i-lock-unlock').click()
    await expect(page.getByTestId('p2i-lock-wrong')).toBeVisible()
    await page.getByTestId('p2i-lock-input').fill('letmein')
    await page.getByTestId('p2i-lock-unlock').click()
    await expect(page.getByTestId('p2i-lock-panel')).toHaveCount(0)
  })

  test('pdf-merge names the locked file and offers the way out', async ({ page }) => {
    // It had the copy and never rendered it: only pdf-split showed the route.
    await page.goto('/en/apps/pdf-merge')
    await page.getByTestId('pm-drop').locator('input[type="file"]')
      .setInputFiles('e2e/fixtures/locked.pdf')
    await expect(page.getByTestId('pm-to-text')).toBeVisible()
  })

  test('pdf-merge does not blame a damaged file on a password', async ({ page }) => {
    // It cannot take the password even if asked: pdf-lib writes the new file
    // and cannot decrypt. So the honest move is the route, not a prompt.
    await page.goto('/en/apps/pdf-merge')
    await page.getByTestId('pm-file').setInputFiles('e2e/fixtures/locked.pdf')
    await expect(page.getByTestId('pm-to-text')).toBeVisible()
    await expect(page.getByTestId('file-error')).toContainText('password-protected')

    // A file that is not a PDF at all must NOT be reported as locked — that was
    // the old copy's single message for every failure.
    await page.reload()
    await page.getByTestId('pm-file').setInputFiles({ name: 'broken.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 this is not really a pdf') })
    await expect(page.getByTestId('file-error')).toBeVisible()
    await expect(page.getByTestId('pm-to-text')).toHaveCount(0)
  })
})
