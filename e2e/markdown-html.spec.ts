import { test, expect } from '@playwright/test'

// Markdown → HTML.
//
// Found by a code sweep: `lib/markdown.ts` parses to Block[] and there were
// renderers for .docx and .epub and NONE for HTML, while `htmlToMd.ts` has gone
// the other way since long before either. The parser's most obvious output was
// the one it did not have.
//
// The load-bearing cases are the escaping ones. Raw HTML does not pass through
// — the parser has no HTML node — so a <script> in the source is text, and text
// is escaped. That is a limitation as much as a safeguard, and it is only worth
// anything if it also holds for the href, which is the half people forget.

const load = async (page: import('@playwright/test').Page, md?: string, locale = 'en') => {
  await page.goto(`/${locale}/apps/markdown-html`)
  await expect(page.getByTestId('markdown-html')).toBeVisible()
  if (md !== undefined) await page.getByTestId('mh-input').fill(md)
}

const out = (page: import('@playwright/test').Page) => page.getByTestId('mh-output').inputValue()

test('the blocks all render', async ({ page }) => {
  await load(page)
  const html = await out(page)
  expect(html).toContain('<h1')
  expect(html).toContain('<h2')
  expect(html).toContain('<strong>nowhere</strong>')
  expect(html).toContain('<em>good</em>')
  expect(html).toContain('<ul>')
  expect(html).toContain('<ol>')
  expect(html).toContain('<blockquote>')
  expect(html).toContain('<table>')
  expect(html).toContain('<th>')
  // The language goes on the <code>, which is what every highlighter reads.
  expect(html).toContain('<code class="language-js">')
})

test('a script tag comes out as TEXT, not as a script', async ({ page }) => {
  await load(page, 'Hello <script>alert(1)</script> world')
  const html = await out(page)
  expect(html).toContain('&lt;script&gt;')
  expect(html).not.toContain('<script>')
})

test('the preview really is inert — the browser is the judge', async ({ page }) => {
  // The preview injects our own output. A string assertion cannot tell escaped
  // from unescaped once it is in the DOM; counting <script> elements can.
  await load(page, 'Hello <script>window.__PWNED = 1</script> world')
  await page.getByTestId('mh-view-preview').click()
  await expect(page.getByTestId('mh-preview')).toContainText('<script>')
  const scripts = await page.getByTestId('mh-preview').locator('script').count()
  expect(scripts, 'a script element reached the DOM').toBe(0)
  expect(await page.evaluate(() => (window as unknown as { __PWNED?: number }).__PWNED)).toBeUndefined()
})

test('a javascript: link is dropped but its label is kept', async ({ page }) => {
  // Escaping the TEXT and then writing whatever it said into an href has
  // escaped nothing. Losing the label as well would lose content.
  await load(page, '[click me](javascript:alert(1))')
  const html = await out(page)
  expect(html).toContain('>click me</a>')
  expect(html).not.toContain('javascript:')
  expect(html).toContain('href="#"')
})

test('an ordinary link survives untouched', async ({ page }) => {
  // Without this, the case above passes against a renderer that drops every
  // href.
  await load(page, '[the survey](https://example.com/wells) and [mail](mailto:a@b.com) and [rel](/docs/x)')
  const html = await out(page)
  expect(html).toContain('href="https://example.com/wells"')
  expect(html).toContain('href="mailto:a@b.com"')
  expect(html).toContain('href="/docs/x"')
})

test('headings get stable ids derived from their text', async ({ page }) => {
  // Counted ids silently break every link into a document the moment a section
  // is added above.
  await load(page, '# The road to Najd\n\ntext\n\n## What we carried\n\nmore')
  const html = await out(page)
  expect(html).toContain('id="the-road-to-najd"')
  expect(html).toContain('id="what-we-carried"')
})

test('two identical headings do not share an id', async ({ page }) => {
  // Two sections really can share a title; a duplicate id makes the second
  // unlinkable and is invalid HTML besides.
  await load(page, '## Notes\n\na\n\n## Notes\n\nb')
  const html = await out(page)
  expect(html).toContain('id="notes"')
  expect(html).toContain('id="notes-2"')
})

test('the standalone file sets BOTH dir and lang for Arabic', async ({ page }) => {
  // Setting one without the other is the half-done RTL support this repo
  // already documents for EPUB.
  await load(page, '# عنوان\n\nنصّ عربي.')
  await page.getByTestId('mh-standalone').click()
  await page.getByTestId('mh-lang').selectOption('ar')
  const html = await out(page)
  expect(html).toContain('lang="ar"')
  expect(html).toContain('dir="rtl"')
  expect(html).toContain('<!doctype html>')
  expect(html).toContain('<meta charset="utf-8">')
})

test('an English document does NOT claim to be right to left', async ({ page }) => {
  // Without this the case above passes against a writer that hard-codes rtl.
  await load(page)
  await page.getByTestId('mh-standalone').click()
  const html = await out(page)
  expect(html).toContain('dir="ltr"')
  expect(html).not.toContain('dir="rtl"')
})

test('the fragment carries no wrapper at all', async ({ page }) => {
  await load(page, '# Title\n\ntext')
  const html = await out(page)
  expect(html).not.toContain('<!doctype')
  expect(html).not.toContain('<html')
  expect(html.trim().startsWith('<h1')).toBe(true)
})

test('the title falls back to the document’s own first heading', async ({ page }) => {
  await load(page, '# The road to Najd\n\ntext')
  await page.getByTestId('mh-standalone').click()
  expect(await out(page)).toContain('<title>The road to Najd</title>')
})

test('it round-trips through the tool that goes the other way', async ({ page }) => {
  // The inverse is the strongest test either direction has — which is how
  // building `docx-markdown` found two real defects in the .docx writer.
  await load(page, '# Heading\n\nSome **bold** and a [link](https://example.com).\n\n- one\n- two')
  const html = await out(page)

  await page.goto('/en/apps/paste-to-markdown')
  // Its input is a contentEditable that converts RENDERED html, so the HTML is
  // put in as markup rather than typed as text — which is what a real paste
  // from a browser does.
  await page.getByTestId('md-input').evaluate((el, h) => {
    el.innerHTML = h
    el.dispatchEvent(new Event('input', { bubbles: true }))
  }, html)
  const md = await page.getByTestId('md-output').inputValue()
  expect(md).toContain('# Heading')
  expect(md).toContain('**bold**')
  expect(md).toContain('[link](https://example.com)')
  expect(md).toContain('- one')
})

test('the download is a real .html file', async ({ page }) => {
  await load(page, '# Title\n\ntext')
  await page.getByTestId('mh-standalone').click()
  const [dl] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('mh-download').click(),
  ])
  expect(dl.suggestedFilename()).toMatch(/\.html$/)
  const fs = await import('node:fs')
  expect(fs.readFileSync((await dl.path())!, 'utf8')).toContain('<!doctype html>')
})

test('it works in Arabic', async ({ page }) => {
  await load(page, '# عنوان\n\nنصّ **عريض**.', 'ar')
  const html = await out(page)
  expect(html).toContain('<strong>عريض</strong>')
  await expect(page.getByTestId('mh-safe')).toContainText('script')
})
