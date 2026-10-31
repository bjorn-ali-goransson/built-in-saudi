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
  await page.goto(`/${locale}/apps/pdf-merge`)
  await page.getByTestId('pm-file').setInputFiles({ name: 'doc.pdf', mimeType: 'application/pdf', buffer: buf })
  await expect(page.getByTestId('pm-grid')).toBeVisible({ timeout: 30_000 })
}

async function save(page: import('@playwright/test').Page) {
  const dl = page.waitForEvent('download')
  await page.getByTestId('pm-save').click()
  const file = await dl
  const stream = await file.createReadStream()
  const chunks: Buffer[] = []
  for await (const c of stream) chunks.push(c as Buffer)
  return readBack(new Uint8Array(Buffer.concat(chunks)))
}

test('reorders pages, and the saved file really is in the new order', async ({ page }) => {
  await load(page, await numberedPdf(['ONE', 'TWO', 'THREE']))
  await expect(page.getByTestId('pm-count')).toHaveText('3 of 3 pages')
  // Move the third page to the front.
  await page.getByTestId('pm-left-2').click()
  await page.getByTestId('pm-left-1').click()
  const pages = await save(page)
  expect(pages.map((p) => p.text)).toEqual(['THREE', 'ONE', 'TWO'])
})

test('removes a page, and it is gone from the file', async ({ page }) => {
  await load(page, await numberedPdf(['ONE', 'TWO', 'THREE']))
  await page.getByTestId('pm-delete-1').click()
  await expect(page.getByTestId('pm-count')).toHaveText('2 of 3 pages')
  await expect(page.getByTestId('pm-removed')).toContainText('1 page removed')
  const pages = await save(page)
  expect(pages.map((p) => p.text)).toEqual(['ONE', 'THREE'])
})

test('rotation is written into the PDF, not just the preview', async ({ page }) => {
  await load(page, await numberedPdf(['ONE', 'TWO']))
  await page.getByTestId('pm-rotate-0').click()
  const pages = await save(page)
  expect(pages[0].rotate).toBe(90)
  expect(pages[1].rotate).toBe(0)
})

test('rotation ADDS to what the page already had', async ({ page }) => {
  // A page saved at 90° that the user turns 90° more must end at 180°. Setting
  // the rotation instead of adding it silently un-rotates the source document.
  await load(page, await numberedPdf(['ONE', 'TWO'], 90))
  await page.getByTestId('pm-rotate-0').click()
  const pages = await save(page)
  expect(pages[0].rotate).toBe(180)
})

test('turn-everything works on every page at once', async ({ page }) => {
  await load(page, await numberedPdf(['ONE', 'TWO', 'THREE']))
  await page.getByTestId('pm-rotate-all').click()
  await expect(page.getByTestId('pm-all-turned')).toHaveText('90°')
  const pages = await save(page)
  expect(pages.map((p) => p.rotate)).toEqual([90, 90, 90])
})

test('putting everything back undoes the lot', async ({ page }) => {
  await load(page, await numberedPdf(['ONE', 'TWO', 'THREE']))
  await page.getByTestId('pm-delete-0').click()
  await page.getByTestId('pm-rotate-0').click()
  await page.getByTestId('pm-restore').click()
  await expect(page.getByTestId('pm-count')).toHaveText('3 of 3 pages')
  const pages = await save(page)
  expect(pages.map((p) => p.text)).toEqual(['ONE', 'TWO', 'THREE'])
  expect(pages.map((p) => p.rotate)).toEqual([0, 0, 0])
})

test('removing every page disables saving rather than writing an empty file', async ({ page }) => {
  await load(page, await numberedPdf(['ONE']))
  await page.getByTestId('pm-delete-0').click()
  await expect(page.getByTestId('pm-empty')).toBeVisible()
  await expect(page.getByTestId('pm-save')).toBeDisabled()
})

test('text survives, because pages are copied and not re-drawn', async ({ page }) => {
  await load(page, await numberedPdf(['ONE', 'TWO']))
  await page.getByTestId('pm-rotate-0').click()
  const pages = await save(page)
  // A tool that rasterised would give back an image and no text at all.
  expect(pages[0].text).toBe('ONE')
})

test('works in Arabic too', async ({ page }) => {
  await load(page, await numberedPdf(['ONE', 'TWO']), 'ar')
  await expect(page.getByTestId('pm-grid')).toBeVisible()
  await expect(page.getByTestId('pm-count')).toContainText('2')
})

// Merge PDF took over Images to PDF and Organise PDF Pages in November 2026, so
// one file can carry pages from several PDFs AND pictures, in any order.
test('two PDFs and a picture become one file, in the order arranged', async ({ page }) => {
  await page.goto('/en/apps/pdf-merge')
  await page.getByTestId('pm-file').setInputFiles([
    { name: 'a.pdf', mimeType: 'application/pdf', buffer: await numberedPdf(['ONE', 'TWO']) },
    { name: 'b.pdf', mimeType: 'application/pdf', buffer: await numberedPdf(['THREE']) },
  ])
  await expect(page.getByTestId('pm-count')).toHaveText('3 of 3 pages')
  // A picture added afterwards lands at the end, and can be moved like a page.
  await page.getByTestId('pm-file-more').setInputFiles('e2e/fixtures/diff-small.png')
  await expect(page.getByTestId('pm-count')).toHaveText('4 of 4 pages')
  await expect(page.getByTestId('pm-label-3')).toHaveText('Picture')
  await page.getByTestId('pm-left-3').click()
  const pages = await save(page)
  expect(pages.map((p) => p.text)).toEqual(['ONE', 'TWO', '', 'THREE'])
})

test('a picture on A4 gets an A4 page, and its own size otherwise', async ({ page }) => {
  const sizes = async () => {
    const dl = page.waitForEvent('download')
    await page.getByTestId('pm-save').click()
    const stream = await (await dl).createReadStream()
    const chunks: Buffer[] = []
    for await (const c of stream) chunks.push(c as Buffer)
    const doc = await PDFDocument.load(new Uint8Array(Buffer.concat(chunks)))
    return doc.getPages().map((p) => [Math.round(p.getWidth()), Math.round(p.getHeight())])
  }
  await page.goto('/en/apps/pdf-merge')
  await page.getByTestId('pm-file').setInputFiles('e2e/fixtures/diff-small.png')
  await expect(page.getByTestId('pm-grid')).toBeVisible()
  const own = await sizes()
  expect(own[0][0]).toBeLessThan(400)
  await page.getByTestId('pm-size-a4').click()
  const a4 = await sizes()
  expect([...a4[0]].sort()).toEqual([595, 842])
})

for (const from of ['pdf-organise', 'images-to-pdf']) {
  test(`${from} now lives in Merge PDF`, async ({ page }) => {
    await page.goto(`/en/apps/${from}`)
    await expect(page).toHaveURL(/\/en\/apps\/pdf-merge\/?$/)
  })
}
