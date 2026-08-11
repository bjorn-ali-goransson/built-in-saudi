import { test, expect } from '@playwright/test'

// Functional coverage for the #154 worker offload: each test drives a real file
// through the tool and asserts the worker-produced output.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAIAAAAC64paAAACf0lEQVR4nAXBwQAAIBAAwQMIIIAAAgjgAAIIIICe+wgggAACCCCAAAI4kGZEBCd4IQhRSIIKWShCFZrQhSFMYQlbOMIVnmCCiMM5vCM4oiM51JEdxVEdzdEdwzEdy7Edx3Edz2EOEY/zeE/wRE/yqCd7iqd6mqd7hmd6lmd7jud6nsc8IgEX8IEQiIEU0EAOlEANtEAPjMAMrMAOnMANvIAFRCIu4iMhEiMpopEcKZEaaZEeGZEZWZEdOZEbeRGLiCRcwidCIiZSQhM5URI10RI9MRIzsRI7cRI38RKWEFGc4pWgRCUpqmSlKFVpSleGMpWlbOUoV3mKKSIZl/GZkImZlNFMzpRMzbRMz4zMzKzMzpzMzbyMZUQKruALoRALqaCFXCiFWmiFXhiFWViFXTiFW3gFK4hUXMVXQiVWUkUruVIqtdIqvTIqs7Iqu3Iqt/IqVhFpuIZvhEZspIY2cqM0aqM1emM0ZmM1duM0buM1rCHScR3fCZ3YSR3t5E7p1E7r9M7ozM7q7M7p3M7rWEdk4AZ+EAZxkAY6yIMyqIM26IMxmIM12IMzuIM3sIHIxE38JEziJE10kidlUidt0idjMidrsidncidvYhORhVv4RVjERVroIi/Koi7aoi/GYi7WYi/O4i7ewhYiG7fxm7CJm7TRTd6UTd20Td+Mzdyszd6czd28jW1EDu7gD+EQD+mgh3woh3poh34Yh3lYh304h3t4BzuIXNzFX8IlXtJFL/lSLvXSLv0yLvOyLvtyLvfyLnYRebiHf4RHfKSHPvKjPOqjPfpjPOZjPfbjPO7jPewhYjjDG8GIRjLUyEYxqtGMbgxjGsvYxjGu8QwzPsfjLF9mkRmmAAAAAElFTkSuQmCC',
  'base64',
)
const file = { name: 'tiny.png', mimeType: 'image/png', buffer: PNG }

test('image compressor encodes via the worker', async ({ page }) => {
  await page.goto('/en/apps/image-compressor')
  await page.setInputFiles('input[type=file]', file)
  await expect(page.getByTestId('imgcomp-result')).toBeVisible()
})

test('format converter converts via the worker', async ({ page }) => {
  await page.goto('/en/apps/image-format-converter')
  await page.setInputFiles('input[type=file]', file)
  await expect(page.getByTestId('ifc-result')).toBeVisible()
})

test('cropper produces output via the worker', async ({ page }) => {
  await page.goto('/en/apps/image-cropper')
  await page.setInputFiles('input[type=file]', file)
  await expect(page.getByTestId('crop-result')).toBeVisible()
})

test('steganography hides and reveals via the worker', async ({ page }) => {
  await page.goto('/en/apps/steganography')
  await page.setInputFiles('input[type=file]', file)
  await page.getByTestId('stego-message').fill('hi')
  const dl = page.waitForEvent('download')
  await page.getByTestId('stego-embed').click()
  const download = await dl
  // saveAs with a .png suffix so the re-upload gets an image/png mime type
  const path = `${await download.path()}.png`
  await download.saveAs(path)
  // round-trip: reveal the message from the downloaded PNG
  await page.getByTestId('stego-reveal').click()
  await page.setInputFiles('input[type=file]', path)
  await expect(page.getByTestId('stego-revealed')).toHaveValue('hi')
})

test('zip inspector lists entries via the worker', async ({ page }) => {
  // minimal zip: one stored file "a.txt" containing "hi"
  const zip = Buffer.from(
    'UEsDBAoAAAAAAFB381ysKpPYAgAAAAIAAAAFABwAYS50eHRVVAkAA/fJXGr3yVxqdXgLAAEE6AMAAAToAwAAaGlQSwECHgMKAAAAAABQd/NcrCqT2AIAAAACAAAABQAYAAAAAAABAAAAtIEAAAAAYS50eHRVVAUAA/fJXGp1eAsAAQToAwAABOgDAABQSwUGAAAAAAEAAQBLAAAAQQAAAAAA',
    'base64',
  )
  await page.goto('/en/apps/archive-inspector')
  await page.setInputFiles('input[type=file]', { name: 't.zip', mimeType: 'application/zip', buffer: zip })
  await expect(page.getByTestId('zip-format')).toHaveText('ZIP')
  await expect(page.getByTestId('zip-list')).toContainText('a.txt')
})

async function makePdf(pages: number): Promise<Buffer> {
  const { PDFDocument } = await import('pdf-lib')
  const pdf = await PDFDocument.create()
  for (let i = 0; i < pages; i++) pdf.addPage([200, 200])
  return Buffer.from(await pdf.save())
}
const asPdf = (name: string, buffer: Buffer) => ({ name, mimeType: 'application/pdf', buffer })

test('pdf merge counts pages and merges via the worker', async ({ page }) => {
  await page.goto('/en/apps/pdf-merge')
  await page.setInputFiles('input[type=file]', [asPdf('a.pdf', await makePdf(3)), asPdf('b.pdf', await makePdf(2))])
  await expect(page.getByTestId('pm-total')).toContainText('5')
  await page.getByTestId('pm-merge').click()
  await expect(page.getByTestId('pm-download')).toBeVisible()
})

test('pdf split extracts a range via the worker', async ({ page }) => {
  await page.goto('/en/apps/pdf-split')
  await page.setInputFiles('input[type=file]', asPdf('doc.pdf', await makePdf(3)))
  await expect(page.getByTestId('ps-count')).toContainText('3')
  await page.getByTestId('ps-range').fill('2-3')
  await page.getByTestId('ps-extract').click()
  await expect(page.getByTestId('ps-download')).toContainText('2')
})

test('pdf split bursts to single pages via the worker', async ({ page }) => {
  await page.goto('/en/apps/pdf-split')
  await page.setInputFiles('input[type=file]', asPdf('doc.pdf', await makePdf(3)))
  await page.getByTestId('ps-mode-burst').click()
  await page.getByTestId('ps-split').click()
  await expect(page.getByTestId('ps-zip')).toBeVisible()
  await expect(page.getByTestId('ps-page-2')).toBeVisible()
})

test('hash generator hashes a file via the worker', async ({ page }) => {
  await page.goto('/en/apps/hash-generator')
  await page.getByTestId('hash-mode-file').click()
  await page.setInputFiles('input[type=file]', { name: 'abc.txt', mimeType: 'text/plain', buffer: Buffer.from('abc') })
  await expect(page.getByTestId('hash-hex')).toHaveText('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
})

// pdf-lib ran on the MAIN THREAD in six tools, against #154. Measured on a
// desktop with synthetic text-only PDFs: a hundred pages cost 66ms to load,
// 20ms to mutate every page and 164ms to save — 249ms of frozen page, and
// three to six times that on a phone, during which nothing scrolls and no
// spinner turns. Imposition also embeds every source page into a new document,
// so the real figure is worse.
//
// `pdf-booklet` moved first because `impose.ts` is pure pdf-lib with no canvas.
// The others draw a watermark, a signature or a re-encoded image through one,
// and need `OffscreenCanvas` in `textImage.ts` — a larger change this does not
// block.
test('pdf booklet counts and imposes via the worker', async ({ page }) => {
  const requested: string[] = []
  page.on('request', (r) => { if (r.url().includes('impose.worker')) requested.push(r.url()) })

  await page.goto('/en/apps/pdf-booklet')
  await page.setInputFiles('input[type=file]', asPdf('doc.pdf', await makePdf(6)))
  await expect(page.getByTestId('pb-pages')).toContainText('6')

  const dl = page.waitForEvent('download')
  await page.getByTestId('pb-apply').click()
  expect((await dl).suggestedFilename()).toContain('booklet')

  // The count and the imposition both went through the worker script, which is
  // the thing that makes this not a main-thread freeze.
  expect(requested.length).toBeGreaterThan(0)
})

test('a completely blank page imposes instead of being called "not a PDF"', async ({ page }) => {
  // Found by moving this into a worker. pdf-lib refuses to embed a page with
  // no content stream — "Can't embed page with missing Contents" — and
  // `embedPages` defers that until `save()`, so the failure arrived far from
  // its cause and the tool reported "could not be read as a PDF". The file was
  // fine: a blank page in a booklet is ordinary, since a chapter opening on a
  // recto leaves one.
  //
  // On the main thread it surfaced as that wrong message; in the worker as a
  // promise that never settled, which is how it was finally noticed.
  await page.goto('/en/apps/pdf-booklet')
  await page.setInputFiles('input[type=file]', asPdf('blank.pdf', await makePdf(6)))
  await expect(page.getByTestId('pb-pages')).toContainText('6')
  const dl = page.waitForEvent('download')
  await page.getByTestId('pb-apply').click()
  expect((await dl).suggestedFilename()).toContain('booklet')
  await expect(page.locator('[data-why]')).toHaveCount(0)
})
