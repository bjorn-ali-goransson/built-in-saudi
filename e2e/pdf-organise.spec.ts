import { test, expect } from '@playwright/test'
import { PDFDocument, StandardFonts, degrees } from 'pdf-lib'
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'

/** A PDF whose pages say ONE, TWO, THREE — so order is checkable, not assumed. */
async function numberedPdf(words: string[], rotateFirst = 0): Promise<Buffer> {
  const pdf = await PDFDocument.create()
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  words.forEach((w, i) => {
    const page = pdf.addPage([400, 400])
    page.drawText(w, { x: 40, y: 200, size: 40, font })
    if (i === 0 && rotateFirst) page.setRotation(degrees(rotateFirst))
  })
  return Buffer.from(await pdf.save())
}

/** Page-by-page text and rotation, read back out of the saved file. */
async function readBack(bytes: Uint8Array) {
  const doc = await pdfjs.getDocument({ data: bytes, useWorkerFetch: false, isEvalSupported: false }).promise
  const out: { text: string; rotate: number }[] = []
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    const content = await page.getTextContent()
    out.push({
      text: (content.items as { str?: string }[]).map((x) => x.str ?? '').join('').trim(),
      rotate: page.rotate,
    })
  }
  return out
}

async function load(page: import('@playwright/test').Page, buf: Buffer, locale = 'en') {
  await page.goto(`/${locale}/apps/pdf-organise`)
  await page.getByTestId('po-file').setInputFiles({ name: 'doc.pdf', mimeType: 'application/pdf', buffer: buf })
  await expect(page.getByTestId('po-grid')).toBeVisible({ timeout: 30_000 })
}

async function save(page: import('@playwright/test').Page) {
  const dl = page.waitForEvent('download')
  await page.getByTestId('po-save').click()
  const file = await dl
  const stream = await file.createReadStream()
  const chunks: Buffer[] = []
  for await (const c of stream) chunks.push(c as Buffer)
  return readBack(new Uint8Array(Buffer.concat(chunks)))
}

test('reorders pages, and the saved file really is in the new order', async ({ page }) => {
  await load(page, await numberedPdf(['ONE', 'TWO', 'THREE']))
  await expect(page.getByTestId('po-count')).toHaveText('3 of 3 pages')
  // Move the third page to the front.
  await page.getByTestId('po-left-2').click()
  await page.getByTestId('po-left-1').click()
  const pages = await save(page)
  expect(pages.map((p) => p.text)).toEqual(['THREE', 'ONE', 'TWO'])
})

test('removes a page, and it is gone from the file', async ({ page }) => {
  await load(page, await numberedPdf(['ONE', 'TWO', 'THREE']))
  await page.getByTestId('po-delete-1').click()
  await expect(page.getByTestId('po-count')).toHaveText('2 of 3 pages')
  await expect(page.getByTestId('po-removed')).toContainText('1 page removed')
  const pages = await save(page)
  expect(pages.map((p) => p.text)).toEqual(['ONE', 'THREE'])
})

test('rotation is written into the PDF, not just the preview', async ({ page }) => {
  await load(page, await numberedPdf(['ONE', 'TWO']))
  await page.getByTestId('po-rotate-0').click()
  const pages = await save(page)
  expect(pages[0].rotate).toBe(90)
  expect(pages[1].rotate).toBe(0)
})

test('rotation ADDS to what the page already had', async ({ page }) => {
  // A page saved at 90° that the user turns 90° more must end at 180°. Setting
  // the rotation instead of adding it silently un-rotates the source document.
  await load(page, await numberedPdf(['ONE', 'TWO'], 90))
  await page.getByTestId('po-rotate-0').click()
  const pages = await save(page)
  expect(pages[0].rotate).toBe(180)
})

test('turn-everything works on every page at once', async ({ page }) => {
  await load(page, await numberedPdf(['ONE', 'TWO', 'THREE']))
  await page.getByTestId('po-rotate-all').click()
  await expect(page.getByTestId('po-all-turned')).toHaveText('90°')
  const pages = await save(page)
  expect(pages.map((p) => p.rotate)).toEqual([90, 90, 90])
})

test('putting everything back undoes the lot', async ({ page }) => {
  await load(page, await numberedPdf(['ONE', 'TWO', 'THREE']))
  await page.getByTestId('po-delete-0').click()
  await page.getByTestId('po-rotate-0').click()
  await page.getByTestId('po-restore').click()
  await expect(page.getByTestId('po-count')).toHaveText('3 of 3 pages')
  const pages = await save(page)
  expect(pages.map((p) => p.text)).toEqual(['ONE', 'TWO', 'THREE'])
  expect(pages.map((p) => p.rotate)).toEqual([0, 0, 0])
})

test('removing every page disables saving rather than writing an empty file', async ({ page }) => {
  await load(page, await numberedPdf(['ONE']))
  await page.getByTestId('po-delete-0').click()
  await expect(page.getByTestId('po-empty')).toBeVisible()
  await expect(page.getByTestId('po-save')).toBeDisabled()
})

test('text survives, because pages are copied and not re-drawn', async ({ page }) => {
  await load(page, await numberedPdf(['ONE', 'TWO']))
  await page.getByTestId('po-rotate-0').click()
  const pages = await save(page)
  // A tool that rasterised would give back an image and no text at all.
  expect(pages[0].text).toBe('ONE')
})

test('works in Arabic too', async ({ page }) => {
  await load(page, await numberedPdf(['ONE', 'TWO']), 'ar')
  await expect(page.getByTestId('po-grid')).toBeVisible()
  await expect(page.getByTestId('po-count')).toContainText('2')
})
