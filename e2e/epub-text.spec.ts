import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// The fixture is built to carry every trap a naive EPUB reader falls into: the
// package file is NOT at OEBPS/content.opf, hrefs are relative to its folder,
// one of them climbs out with ../, and the spine order is the reverse of the
// filename order. See scratchpad/mkepub.py in the PR for how it is generated.
const EPUB = readFileSync(fileURLToPath(new URL('./fixtures/sample.epub', import.meta.url)))

async function load(page: import('@playwright/test').Page, locale = 'en') {
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.goto(`/${locale}/apps/epub-text`)
  await page.getByTestId('ep-file').setInputFiles({
    name: 'sample.epub', mimeType: 'application/epub+zip', buffer: EPUB,
  })
  await expect(page.getByTestId('ep-meta')).toBeVisible({ timeout: 20_000 })
}

test('finds the package file wherever it is, and reads the metadata', async ({ page }) => {
  // OEBPS/content.opf is a convention, not a rule. This book keeps it at
  // book/package.opf, and only META-INF/container.xml says so.
  await load(page)
  await expect(page.getByTestId('ep-title')).toHaveText('The Sands of Najd')
  await expect(page.getByTestId('ep-authors')).toContainText('Aisha Al-Rashid')
  await expect(page.getByTestId('ep-authors')).toContainText('Omar Bin Salem')
  await expect(page.getByTestId('ep-publisher')).toContainText('Riyadh Press')
  await expect(page.getByTestId('ep-identifier')).toContainText('9781234567897')
})

test('reads chapters in the spine order, not the filename order', async ({ page }) => {
  await load(page)
  await expect(page.getByTestId('ep-chapter-0')).toContainText('Chapter One')
  await expect(page.getByTestId('ep-chapter-1')).toContainText('Chapter Two')
  // Chapter Ten sorts BEFORE Chapter Two on a filename; the spine says last.
  await expect(page.getByTestId('ep-chapter-2')).toContainText('Chapter Ten')
})

test('resolves an href relative to the package file, including ../', async ({ page }) => {
  await load(page)
  // chapter10 lives at extra/chapter10.xhtml, reached from book/package.opf by
  // ../extra/. Resolving against the zip root instead would lose it entirely.
  await page.getByTestId('ep-chapter-2').click()
  await expect(page.getByTestId('ep-output')).toContainText('The last well was dry.')
})

test('block elements become line breaks instead of gluing words together', async ({ page }) => {
  await load(page)
  await page.getByTestId('ep-chapter-0').click()
  const text = await page.getByTestId('ep-output').innerText()
  // Two paragraphs must not run into one another.
  expect(text).not.toContain('cityIt ended')
  expect(text).toContain('The desert began at the edge of the city.')
  expect(text).toContain('It ended nowhere anyone had walked.')
})

test('leaves out script and style content', async ({ page }) => {
  await load(page)
  const text = await page.getByTestId('ep-output').innerText()
  expect(text).not.toContain('var x = 1')
  expect(text).not.toContain('color: red')
})

test('carries Arabic text through', async ({ page }) => {
  await load(page)
  await page.getByTestId('ep-chapter-1').click()
  await expect(page.getByTestId('ep-output')).toContainText('كان الطريق طويلًا')
})

test('counts the words and offers the whole book', async ({ page }) => {
  await load(page)
  await expect(page.getByTestId('ep-total')).toContainText('3 chapters')
  await page.getByTestId('ep-chapter-all').click()
  const whole = await page.getByTestId('ep-output').innerText()
  expect(whole).toContain('The desert began')
  expect(whole).toContain('The last well was dry.')
})

test('exports Markdown with headings', async ({ page }) => {
  await load(page)
  await page.getByTestId('ep-format-markdown').click()
  await page.getByTestId('ep-copy').click()
  const md = await page.evaluate(() => navigator.clipboard.readText())
  expect(md).toContain('# The Sands of Najd')
  expect(md).toContain('## Chapter One')
})

test('a file that is not an EPUB is refused with a reason', async ({ page }) => {
  await page.goto('/en/apps/epub-text')
  await page.getByTestId('ep-file').setInputFiles({
    name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('not a book'),
  })
  await expect(page.getByTestId('file-error')).toContainText('zip archive', { timeout: 15_000 })
})

test('downloads the text', async ({ page }) => {
  await load(page)
  const dl = page.waitForEvent('download')
  await page.getByTestId('ep-download').click()
  expect((await dl).suggestedFilename()).toBe('sample.txt')
})

test('works in Arabic too', async ({ page }) => {
  await load(page, 'ar')
  await expect(page.getByTestId('ep-total')).toContainText('فصل')
  await expect(page.getByTestId('ep-title')).toHaveText('The Sands of Najd')
})
