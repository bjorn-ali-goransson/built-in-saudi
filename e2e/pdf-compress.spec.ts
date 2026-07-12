import { test, expect, type Page } from '@playwright/test'
import { PDFDocument, StandardFonts } from 'pdf-lib'
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'
import { readFileSync } from 'node:fs'

// A big, poorly-compressible JPEG (random noise) generated in the browser.
async function noiseJpeg(page: Page): Promise<Buffer> {
  const url = await page.evaluate(() => {
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
  return Buffer.from(url.split(',')[1], 'base64')
}

async function download(page: Page): Promise<Uint8Array> {
  const dl = page.waitForEvent('download', { timeout: 30_000 })
  await expect(page.getByTestId('cmp-download')).toBeVisible({ timeout: 30_000 })
  await page.getByTestId('cmp-download').click()
  return new Uint8Array(readFileSync(await (await dl).path()))
}

async function pageText(bytes: Uint8Array): Promise<string> {
  const doc = await pdfjs.getDocument({ data: bytes, useWorkerFetch: false, isEvalSupported: false }).promise
  const p = await doc.getPage(1)
  return (await p.getTextContent()).items.map((i: { str?: string }) => i.str || '').join(' ')
}

test.describe('pdf-compress', () => {
  test('Smallest (re-render) shrinks an image-heavy PDF to a valid PDF', async ({ page }) => {
    await page.goto('/en/tools/pdf-compress')
    const jpg = await noiseJpeg(page)
    const src = await PDFDocument.create()
    const pg = src.addPage([600, 600])
    pg.drawImage(await src.embedJpg(jpg), { x: 0, y: 0, width: 600, height: 600 })
    const srcBytes = Buffer.from(await src.save())

    await page.locator('input[type=file]').setInputFiles({ name: 'big.pdf', mimeType: 'application/pdf', buffer: srcBytes })
    await expect(page.getByTestId('cmp-info')).toBeVisible({ timeout: 15_000 })
    await page.getByRole('button', { name: 'Smallest' }).click()
    await page.getByRole('button', { name: 'Smaller file' }).click()
    await page.getByTestId('cmp-run').click()
    const out = await download(page)

    expect(out.length).toBeLessThan(srcBytes.length)
    expect((await PDFDocument.load(out)).getPageCount()).toBe(1)
  })

  test('Keep text mode shrinks images yet keeps text selectable', async ({ page }) => {
    await page.goto('/en/tools/pdf-compress')
    const jpg = await noiseJpeg(page)
    const src = await PDFDocument.create()
    const font = await src.embedFont(StandardFonts.Helvetica)
    const pg = src.addPage([600, 800])
    pg.drawImage(await src.embedJpg(jpg), { x: 0, y: 150, width: 600, height: 600 })
    pg.drawText('KEEPTHISTEXTSELECTABLE', { x: 40, y: 60, size: 22, font })
    const srcBytes = Buffer.from(await src.save())

    await page.locator('input[type=file]').setInputFiles({ name: 'doc.pdf', mimeType: 'application/pdf', buffer: srcBytes })
    await expect(page.getByTestId('cmp-info')).toBeVisible({ timeout: 15_000 })
    await page.getByRole('button', { name: 'Keep text', exact: true }).click()
    await page.getByRole('button', { name: 'Smaller file' }).click()
    await page.getByTestId('cmp-run').click()
    const out = await download(page)

    expect(out.length).toBeLessThan(srcBytes.length)              // image recompressed
    expect(await pageText(out)).toContain('KEEPTHISTEXTSELECTABLE') // text preserved
  })
})
