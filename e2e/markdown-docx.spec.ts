import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'

// Markdown to Word.
//
// Found by a code sweep: the site could already write a real .docx and exactly
// one tool did (the CV optimizer). What was missing was the other half — a
// Markdown parser — and that same parser is what makes Markdown to EPUB and
// Markdown to PDF buildable later.

const MD = `# Title

Some **bold** and *italic* and \`code\`.

## Second

- one
- two

1. first
2. second

> quoted

| A | B |
| --- | --- |
| 1 | 2 |

---

\`\`\`
line one
line two
\`\`\`
`

async function load(page: import('@playwright/test').Page, md = MD, locale = 'en') {
  await page.goto(`/${locale}/apps/markdown-docx`)
  await page.getByTestId('md-input').fill(md)
}

test('the outline reports what the writer understood', async ({ page }) => {
  // The outline is the honest preview: it shows the parse, which is the thing
  // that can be wrong. A rendered imitation of Word would look right and prove
  // nothing.
  await load(page)
  const kinds = await page.getByTestId('md-outline').locator('li').evaluateAll(
    (els) => els.map((e) => e.getAttribute('data-kind')),
  )
  expect(kinds).toEqual([
    'heading', 'para', 'heading', 'list', 'list', 'quote', 'table', 'rule', 'code',
  ])
})

test('a heading right after a paragraph is not swallowed into it', async ({ page }) => {
  // The classic naive-parser bug: a paragraph runs to the next blank line, so
  // "text\n## Heading" comes out as one paragraph and the heading is lost.
  await load(page, 'text here\n## Heading\nmore text')
  const kinds = await page.getByTestId('md-outline').locator('li').evaluateAll(
    (els) => els.map((e) => e.getAttribute('data-kind')),
  )
  expect(kinds).toEqual(['para', 'heading', 'para'])
})

test('a bulleted list followed by a numbered one is two lists', async ({ page }) => {
  await load(page, '- a\n- b\n1. one\n2. two')
  const kinds = await page.getByTestId('md-outline').locator('li').evaluateAll(
    (els) => els.map((e) => e.getAttribute('data-kind')),
  )
  expect(kinds).toEqual(['list', 'list'])
})

test('a table needs its separator row, or it is just paragraphs', async ({ page }) => {
  // Without this, any prose containing a pipe becomes a one-row table.
  await load(page, 'a | b\nc | d')
  const kinds = await page.getByTestId('md-outline').locator('li').evaluateAll(
    (els) => els.map((e) => e.getAttribute('data-kind')),
  )
  expect(kinds).toEqual(['para'])
})

test('CRLF input parses the same as LF', async ({ page }) => {
  // A .md written on Windows arrives with \r on every line, which turns the
  // closing ``` into ```\r and matches no fence test.
  await load(page, '# One\r\n\r\n```\r\ncode\r\n```\r\n')
  const kinds = await page.getByTestId('md-outline').locator('li').evaluateAll(
    (els) => els.map((e) => e.getAttribute('data-kind')),
  )
  expect(kinds).toEqual(['heading', 'code'])
})

test('the .docx is a real Word file, checked off the raw bytes', async ({ page }) => {
  await load(page)
  const dl = page.waitForEvent('download', { timeout: 30_000 })
  await page.getByTestId('md-download').click()
  const file = await dl
  // The first heading names the file: a downloads folder full of
  // "document.docx" is what that saves you from.
  expect(file.suggestedFilename()).toBe('Title.docx')

  const path = await file.path()
  const buf = readFileSync(path)
  // Read as bytes, NOT through our own reader: two hand-written
  // implementations agreeing is weaker evidence than one being right, because
  // a shared misconception would satisfy both.
  expect(buf.subarray(0, 2).toString('latin1')).toBe('PK')
  const raw = buf.toString('latin1')
  for (const part of ['[Content_Types].xml', '_rels/.rels', 'word/document.xml']) {
    expect(raw, `missing part ${part}`).toContain(part)
  }
  // Stored entries: compression method 0 in every local header.
  const method = buf.readUInt16LE(8)
  expect(method).toBe(0)
})

test('the formatting survives as Word formatting, not as asterisks', async ({ page }) => {
  await load(page)
  const dl = page.waitForEvent('download', { timeout: 30_000 })
  await page.getByTestId('md-download').click()
  const raw = readFileSync(await (await dl).path()).toString('latin1')
  // Stored entries, so the XML is in the file verbatim and greppable.
  expect(raw).toContain('<w:b/>')       // bold
  expect(raw).toContain('<w:i/>')       // italic
  expect(raw).toContain('<w:tbl>')      // the table is a table
  expect(raw).toContain('Consolas')     // code is monospaced
  expect(raw).toContain('xml:space="preserve"')
  // The markers themselves must NOT survive as text.
  expect(raw).not.toContain('**bold**')
  expect(raw).not.toContain('| --- |')
})

test('a list is a real Word list, not a paragraph starting with a bullet', async ({ page }) => {
  // A list whose markers are characters is not a list to anything downstream:
  // Word will not continue it, a converter reads paragraphs, and a screen
  // reader does not announce "list of three items".
  await load(page, '- alpha\n- beta\n\n1. one\n2. two')
  const dl = page.waitForEvent('download', { timeout: 30_000 })
  await page.getByTestId('md-download').click()
  const raw = readFileSync(await (await dl).path()).toString('latin1')
  expect(raw).toContain('word/numbering.xml')
  expect(raw).toContain('<w:numPr>')
  // Each list gets its OWN numId, or the second ordered list continues the
  // first — 1, 2, 3 then 4, 5, 6.
  const ids = new Set([...raw.matchAll(/w:numId w:val="(\d+)"/g)].map((m) => m[1]))
  expect(ids.size).toBe(2)
  expect(raw).toContain('startOverride')
  // And the markers are no longer literal text.
  expect(raw).not.toContain('<w:t xml:space="preserve">1. </w:t>')
})

test('XML-special characters are escaped rather than breaking the file', async ({ page }) => {
  await load(page, 'a < b & c > d "quoted"')
  const dl = page.waitForEvent('download', { timeout: 30_000 })
  await page.getByTestId('md-download').click()
  const raw = readFileSync(await (await dl).path()).toString('latin1')
  expect(raw).toContain('a &lt; b &amp; c &gt; d')
})

test('a link keeps its address instead of losing it', async ({ page }) => {
  await load(page, 'See [the survey](https://example.com/wells).')
  const dl = page.waitForEvent('download', { timeout: 30_000 })
  await page.getByTestId('md-download').click()
  const raw = readFileSync(await (await dl).path()).toString('latin1')
  expect(raw).toContain('the survey')
  expect(raw).toContain('https://example.com/wells')
  await expect(page.getByTestId('md-link-note')).toBeVisible()
})

test('a binary file is refused with a reason, not silently ignored', async ({ page }) => {
  await page.goto('/en/apps/markdown-docx')
  await page.getByTestId('md-file').setInputFiles('e2e/fixtures/diff-small.png')
  await expect(page.getByTestId('file-error')).toBeVisible()
})

test('the output opens in our own Word READER, which is a separate implementation', async ({ page }) => {
  // The byte checks above prove the parts are there; this proves the document
  // is readable. Deliberately the LAST check and not the only one: two
  // hand-written implementations agreeing is weaker evidence than one being
  // right, because a shared misconception would satisfy both. So the structure
  // is read off the bytes and the round trip only answers "does the content
  // survive".
  await load(page, '# Report\n\nRiyadh had **1,204** units.\n\n- first\n- second\n')
  const dl = page.waitForEvent('download', { timeout: 30_000 })
  await page.getByTestId('md-download').click()
  const path = await (await dl).path()

  await page.goto('/en/apps/docx-to-text')
  await page.getByTestId('dx-file').setInputFiles(path)
  const out = page.getByTestId('dx-output')
  await expect(out).toContainText('Report', { timeout: 20_000 })
  await expect(out).toContainText('Riyadh had 1,204 units.')
  await expect(out).toContainText('first')
  // Word splits a word across runs at every formatting boundary, and the runs
  // concatenate with nothing between them — so a bold number must not come
  // back glued to the words either side of it.
  await expect(out).not.toContainText('had1,204')
  await expect(out).not.toContainText('1,204units')
})

test('works in Arabic', async ({ page }) => {
  await load(page, '# عنوان\n\nنص **عريض**.', 'ar')
  await expect(page.getByTestId('md-counts')).toBeVisible()
  const kinds = await page.getByTestId('md-outline').locator('li').evaluateAll(
    (els) => els.map((e) => e.getAttribute('data-kind')),
  )
  expect(kinds).toEqual(['heading', 'para'])
})
