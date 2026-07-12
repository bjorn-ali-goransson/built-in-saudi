import { test, expect } from '@playwright/test'
import { PDFDocument } from 'pdf-lib'
import { readFileSync } from 'node:fs'

test('compresses an image-heavy PDF to a smaller, valid PDF', async ({ page }) => {
  await page.goto('/en/tools/pdf-compress')
  await expect(page.getByTestId('cmp-drop')).toBeVisible()

  // Build a big source PDF: a full-page high-quality JPEG of random noise
  // (noise barely compresses, so the source is large).
  const jpegDataUrl = await page.evaluate(() => {
    const c = document.createElement('canvas'); c.width = 1400; c.height = 1400
    const ctx = c.getContext('2d')!
    const img = ctx.createImageData(c.width, c.height)
    for (let i = 0; i < img.data.length; i += 4) {
      img.data[i] = Math.random() * 255; img.data[i + 1] = Math.random() * 255
      img.data[i + 2] = Math.random() * 255; img.data[i + 3] = 255
    }
    ctx.putImageData(img, 0, 0)
    return c.toDataURL('image/jpeg', 0.92)
  })
  const jpgBytes = Buffer.from(jpegDataUrl.split(',')[1], 'base64')
  const src = await PDFDocument.create()
  const jp = await src.embedJpg(jpgBytes)
  const pg = src.addPage([600, 600])
  pg.drawImage(jp, { x: 0, y: 0, width: 600, height: 600 })
  const srcBytes = Buffer.from(await src.save())

  await page.locator('input[type=file]').setInputFiles({ name: 'big.pdf', mimeType: 'application/pdf', buffer: srcBytes })
  await expect(page.getByTestId('cmp-info')).toBeVisible({ timeout: 15_000 })

  // Strong compression, then download
  await page.getByRole('button', { name: 'Smaller file' }).click()
  await page.getByTestId('cmp-run').click()
  const dl = page.waitForEvent('download', { timeout: 30_000 })
  await expect(page.getByTestId('cmp-download')).toBeVisible({ timeout: 30_000 })
  await page.getByTestId('cmp-download').click()
  const outBytes = new Uint8Array(readFileSync(await (await dl).path()))

  expect(outBytes.length).toBeLessThan(srcBytes.length) // actually smaller
  const outDoc = await PDFDocument.load(outBytes)           // valid PDF
  expect(outDoc.getPageCount()).toBe(1)
})
