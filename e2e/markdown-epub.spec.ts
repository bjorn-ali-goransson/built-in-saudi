import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { zipPart, zipNames } from './helpers'

// Markdown to EPUB.
//
// A code sweep found this needed nothing new: lib/zip.ts writes STORE-ONLY
// archives, which is exactly what an EPUB's mimetype entry requires, and
// lib/markdown.ts already supplied the structure. The site could read an EPUB
// (epub-text) and not write one.

const MD = `# One

First chapter, with **bold** and a [link](https://example.com).

- alpha
- beta

# Two

Second chapter.

> quoted
`

async function load(page: import('@playwright/test').Page, md = MD, locale = 'en') {
  await page.goto(`/${locale}/apps/markdown-epub`)
  await page.getByTestId('me-input').fill(md)
}

test('chapters split at the headings, and the list IS the table of contents', async ({ page }) => {
  await load(page)
  await expect(page.getByTestId('me-chapters').locator('li')).toHaveText(['One', 'Two'])
})

test('a document written entirely in ## still becomes chapters', async ({ page }) => {
  // The split is at the SHALLOWEST heading level the document uses. A rule that
  // only looked for `#` would give one enormous chapter and an empty contents.
  await load(page, '## Alpha\n\ntext\n\n## Beta\n\ntext')
  await expect(page.getByTestId('me-chapters').locator('li')).toHaveText(['Alpha', 'Beta'])
})

test('text before the first heading is kept, not dropped', async ({ page }) => {
  // Losing content silently is the failure that matters in a converter.
  await load(page, 'A preamble.\n\n# One\n\ntext')
  await expect(page.getByTestId('me-chapters').locator('li')).toHaveCount(2)
})

test('the file is a real EPUB, checked off the raw bytes', async ({ page }) => {
  await load(page)
  await page.getByTestId('me-title').fill('The Sands')
  const dl = page.waitForEvent('download', { timeout: 30_000 })
  await page.getByTestId('me-download').click()
  const file = await dl
  expect(file.suggestedFilename()).toBe('The Sands.epub')

  const buf = readFileSync(await file.path())
  expect(buf.subarray(0, 2).toString('latin1')).toBe('PK')
  // The mimetype entry must be FIRST and STORED — that is how a reader
  // identifies the file without inflating anything. Local header: name length
  // at 26, name at 30, compression method at 8.
  expect(buf.readUInt16LE(8)).toBe(0)
  const nameLen = buf.readUInt16LE(26)
  expect(buf.subarray(30, 30 + nameLen).toString('latin1')).toBe('mimetype')
  expect(buf.subarray(30 + nameLen, 30 + nameLen + 20).toString('latin1')).toBe('application/epub+zip')

  // Everything after `mimetype` is DEFLATED now (the writer compresses; only
  // this first entry is forced stored), so the parts are inflated rather than
  // grepped out of the whole file as latin1. Node's zlib is somebody else's
  // implementation, so this is still not our own reader.
  const names = zipNames(buf)
  // META-INF/container.xml is the one path the spec fixes.
  expect(names).toContain('META-INF/container.xml')
  expect(names).toContain('OEBPS/content.opf')
  // EPUB 3 wants a nav document, or the book opens with no contents at all.
  expect(zipPart(buf, 'OEBPS/nav.xhtml')).toContain('epub:type="toc"')
  // Every spine item must be in the manifest too.
  const opf = zipPart(buf, 'OEBPS/content.opf')
  expect(opf).toContain('<itemref idref="ch1"/>')
  expect(opf).toContain('href="ch1.xhtml"')
})

test('an Arabic book turns its pages the right way, not only its text', async ({ page }) => {
  // Setting only the text direction gives a book that reads correctly and
  // turns backwards. That is the half most generators leave out.
  await load(page, '# فصل\n\nنص عربي.')
  await page.getByTestId('me-lang').selectOption('ar')
  await expect(page.getByTestId('me-rtl-note')).toBeVisible()
  const dl = page.waitForEvent('download', { timeout: 30_000 })
  await page.getByTestId('me-download').click()
  const buf = readFileSync(await (await dl).path())
  const opf = zipPart(buf, 'OEBPS/content.opf')
  // `page-progression-direction` is what turns the pages; `dir` is what runs
  // the text. They live in different parts, and setting only one gives a book
  // that reads correctly and turns backwards.
  expect(opf).toContain('page-progression-direction="rtl"')
  expect(opf).toContain('<dc:language>ar</dc:language>')
  expect(zipPart(buf, 'OEBPS/ch1.xhtml')).toContain('dir="rtl"')
})

test('an English book does NOT claim to be right-to-left', async ({ page }) => {
  // Without this the case above passes against a writer that hard-codes rtl.
  await load(page)
  const dl = page.waitForEvent('download', { timeout: 30_000 })
  await page.getByTestId('me-download').click()
  const buf = readFileSync(await (await dl).path())
  expect(zipPart(buf, 'OEBPS/content.opf')).not.toContain('page-progression-direction="rtl"')
  expect(zipPart(buf, 'OEBPS/ch1.xhtml')).toContain('dir="ltr"')
  await expect(page.getByTestId('me-rtl-note')).toHaveCount(0)
})

test('the formatting survives as markup, not as asterisks', async ({ page }) => {
  await load(page)
  const dl = page.waitForEvent('download', { timeout: 30_000 })
  await page.getByTestId('me-download').click()
  // Every chapter, joined. The old version grepped the whole archive, so it
  // never had to say WHERE it expected each thing — and the blockquote is in
  // chapter two, which only showed up once the check became precise.
  const buf = readFileSync(await (await dl).path())
  const raw = zipNames(buf).filter((n) => /^OEBPS\/ch\d+\.xhtml$/.test(n))
    .map((n) => zipPart(buf, n)).join('\n')
  expect(raw).toContain('<strong>bold</strong>')
  expect(raw).toContain('<li>alpha</li>')
  expect(raw).toContain('<blockquote>')
  // XHTML has real hyperlinks, unlike the .docx writer.
  expect(raw).toContain('<a href="https://example.com">link</a>')
  expect(raw).not.toContain('**bold**')
})

test('the book opens in our own EPUB READER, which is a separate implementation', async ({ page }) => {
  // Deliberately the last check and not the only one: two hand-written
  // implementations agreeing is weaker evidence than one being right, because
  // a shared misconception would satisfy both. So the structure is read off the
  // bytes above, and this only answers "does it open and is the content there".
  await load(page)
  await page.getByTestId('me-title').fill('The Sands')
  await page.getByTestId('me-author').fill('Aisha Al-Rashid')
  const dl = page.waitForEvent('download', { timeout: 30_000 })
  await page.getByTestId('me-download').click()
  const path = await (await dl).path()

  await page.goto('/en/apps/epub-text')
  await page.getByTestId('ep-file').setInputFiles(path)
  await expect(page.getByTestId('ep-meta')).toBeVisible({ timeout: 20_000 })
  await expect(page.getByTestId('ep-title')).toHaveText('The Sands')
  await expect(page.getByTestId('ep-authors')).toContainText('Aisha Al-Rashid')
  // Two chapters, in the spine order the book asks to be read in.
  await expect(page.getByTestId('ep-chapter-0')).toContainText('One')
  await expect(page.getByTestId('ep-chapter-1')).toContainText('Two')
  await expect(page.getByTestId('ep-output')).toContainText('First chapter')
})

test('a binary file is refused with a reason', async ({ page }) => {
  await page.goto('/en/apps/markdown-epub')
  await page.getByTestId('me-file').setInputFiles('e2e/fixtures/diff-small.png')
  await expect(page.getByTestId('file-error')).toBeVisible()
})

test('works in Arabic', async ({ page }) => {
  await load(page, '# مقدمة\n\nنص.\n\n# الفصل الأول\n\nنص.', 'ar')
  await expect(page.getByTestId('me-chapters').locator('li')).toHaveCount(2)
})
