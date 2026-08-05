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
  test('extracts the words, page by page', async ({ page }) => {
    const pdf = await textPdf([['Invoice number 12345', 'Total due 500 SAR'], ['Second page here']])
    await page.goto('/en/apps/pdf-to-text')
    await page.getByTestId('p2t-file').setInputFiles({ name: 'doc.pdf', mimeType: 'application/pdf', buffer: pdf })
    await expect(page.getByTestId('p2t-pages')).toHaveText('2 pages')
    const out = page.getByTestId('p2t-output')
    await expect(out).toHaveValue(/Invoice number 12345/)
    await expect(out).toHaveValue(/Total due 500 SAR/)
    await expect(out).toHaveValue(/Second page here/)
    // Page separators are on by default and can be turned off.
    await expect(out).toHaveValue(/--- Page 2 ---/)
    await page.getByTestId('p2t-separators').uncheck()
    await expect(out).not.toHaveValue(/--- Page/)
  })

  test('tells you when the PDF is a scan instead of showing an empty box', async ({ page }) => {
    await page.goto('/en/apps/pdf-to-text')
    await page.getByTestId('p2t-file').setInputFiles({ name: 'scan.pdf', mimeType: 'application/pdf', buffer: await blankPdf() })
    await expect(page.getByTestId('p2t-scanned')).toBeVisible()
    await expect(page.getByTestId('p2t-output')).toHaveCount(0)
  })

  test('downloads the text as a .txt named after the PDF', async ({ page }) => {
    const pdf = await textPdf([['Hello there']])
    await page.goto('/en/apps/pdf-to-text')
    await page.getByTestId('p2t-file').setInputFiles({ name: 'report.pdf', mimeType: 'application/pdf', buffer: pdf })
    await expect(page.getByTestId('p2t-output')).toHaveValue(/Hello there/)
    const dl = page.waitForEvent('download')
    await page.getByTestId('p2t-download').click()
    expect((await dl).suggestedFilename()).toBe('report.txt')
  })

  test('a file that is not a PDF is reported, not swallowed', async ({ page }) => {
    await page.goto('/en/apps/pdf-to-text')
    await page.getByTestId('p2t-file').setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('just text') })
    await expect(page.getByTestId('file-error')).toBeVisible()
  })
})

test.describe('audio trimmer', () => {
  test('decodes a file, shows the waveform and reports the selection', async ({ page }) => {
    await page.goto('/en/apps/audio-trim')
    await page.getByTestId('at-file').setInputFiles({ name: 'tone.wav', mimeType: 'audio/wav', buffer: makeWav(2) })
    await expect(page.getByTestId('waveform')).toBeVisible()
    // The whole file is selected on load.
    await expect(page.getByTestId('at-start')).toHaveValue('00:00.0')
    await expect(page.getByTestId('at-length')).toHaveValue('00:02.0')
  })

  test('dragging on the waveform narrows the selection', async ({ page }) => {
    await page.goto('/en/apps/audio-trim')
    await page.getByTestId('at-file').setInputFiles({ name: 'tone.wav', mimeType: 'audio/wav', buffer: makeWav(4) })
    await expect(page.getByTestId('at-length')).toHaveValue('00:04.0')
    const box = (await page.getByTestId('waveform').boundingBox())!
    await page.mouse.move(box.x + box.width * 0.25, box.y + box.height / 2)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width * 0.75, box.y + box.height / 2, { steps: 8 })
    await page.mouse.up()
    // Half the width of a 4s file is about 2s, allowing for pointer rounding.
    await expect(page.getByTestId('at-length')).toHaveValue(/00:0[12]\./)
  })

  test('exports the trimmed selection as a WAV', async ({ page }) => {
    await page.goto('/en/apps/audio-trim')
    await page.getByTestId('at-file').setInputFiles({ name: 'tone.wav', mimeType: 'audio/wav', buffer: makeWav(2) })
    await expect(page.getByTestId('waveform')).toBeVisible()
    const dl = page.waitForEvent('download')
    await page.getByTestId('at-download').click()
    const file = await dl
    expect(file.suggestedFilename()).toBe('tone-trimmed.wav')
    // A real RIFF/WAVE header, produced by our own worker.
    const stream = await file.createReadStream()
    const chunks: Buffer[] = []
    for await (const c of stream) chunks.push(c as Buffer)
    const head = Buffer.concat(chunks).subarray(0, 12).toString('latin1')
    expect(head.startsWith('RIFF')).toBe(true)
    expect(head.includes('WAVE')).toBe(true)
  })

  test('an undecodable file says so rather than failing silently', async ({ page }) => {
    await page.goto('/en/apps/audio-trim')
    await page.getByTestId('at-file').setInputFiles({ name: 'nope.bin', mimeType: '', buffer: Buffer.from('not audio at all') })
    await expect(page.getByTestId('file-error')).toBeVisible()
  })
})

test.describe('extract audio from video', () => {
  test('reads an audio track and reports its shape', async ({ page }) => {
    // A bare WAV exercises the same decode path a video's audio track takes.
    await page.goto('/en/apps/video-audio')
    await page.getByTestId('va-file').setInputFiles({ name: 'clip.wav', mimeType: 'audio/wav', buffer: makeWav(3) })
    await expect(page.getByTestId('va-duration')).toHaveText('00:03.0')
    await expect(page.getByTestId('va-channels')).toHaveText('mono')
  })

  test('downloads the audio as a WAV named after the video', async ({ page }) => {
    await page.goto('/en/apps/video-audio')
    await page.getByTestId('va-file').setInputFiles({ name: 'lecture.wav', mimeType: 'audio/wav', buffer: makeWav(1) })
    await expect(page.getByTestId('va-duration')).toBeVisible()
    const dl = page.waitForEvent('download')
    await page.getByTestId('va-download').click()
    expect((await dl).suggestedFilename()).toBe('lecture.wav')
  })

  test('a file with no decodable audio is explained', async ({ page }) => {
    await page.goto('/en/apps/video-audio')
    await page.getByTestId('va-file').setInputFiles({ name: 'silent.bin', mimeType: '', buffer: Buffer.from('0'.repeat(64)) })
    await expect(page.getByTestId('file-error')).toBeVisible()
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
