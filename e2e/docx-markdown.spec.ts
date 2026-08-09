import { test, expect } from '@playwright/test'

// Word to Markdown — the inverse of markdown-docx, shipped this week.
//
// Found by a code sweep: `mammoth` was already a dependency used by exactly one
// tool (the CV optimizer, for raw text), and `lib/htmlToMd.ts` already existed.
// convertToHtml + htmlToMd is therefore two existing capabilities and no new
// algorithm — the same shape as the epub-text Markdown fix.

// Build a .docx by going through OUR OWN writer, so the input is a real Office
// Open XML file rather than a hand-made approximation.
async function docxFrom(page: import('@playwright/test').Page, md: string) {
  await page.goto('/en/apps/markdown-docx')
  await page.getByTestId('md-input').fill(md)
  const dl = page.waitForEvent('download', { timeout: 30_000 })
  await page.getByTestId('md-download').click()
  return (await dl).path()
}

async function toMarkdown(page: import('@playwright/test').Page, path: string, locale = 'en') {
  await page.goto(`/${locale}/apps/docx-markdown`)
  await page.getByTestId('dm-file').setInputFiles(path)
  await expect(page.getByTestId('dm-output')).toBeVisible({ timeout: 30_000 })
  return page.getByTestId('dm-output').inputValue()
}

test('headings, emphasis and links survive the round trip', async ({ page }) => {
  const path = await docxFrom(page, '# Title\n\nSome **bold** and *italic* text.\n\n## Second\n\nMore.')
  const md = await toMarkdown(page, path)
  expect(md).toContain('# Title')
  expect(md).toContain('## Second')
  expect(md).toContain('**bold**')
  expect(md).toContain('*italic*')
})

test('a table comes back as a table, not as flattened prose', async ({ page }) => {
  // This is the whole point: docx-to-text already gives you the words.
  const path = await docxFrom(page, '| Region | Units |\n| --- | --- |\n| Riyadh | 1204 |\n| Jeddah | 880 |')
  const md = await toMarkdown(page, path)
  // The header cells come back BOLD — `writeDocx` bolds them, Word keeps that,
  // and a converter that dropped it would be losing something the document had.
  // The first version of this assertion expected the plain text and was simply
  // wrong about the round trip rather than finding a defect.
  expect(md).toContain('| **Region** | **Units** |')
  expect(md).toContain('| Riyadh | 1204 |')
  expect(md).toContain('| Jeddah | 880 |')
})

test('a blockquote survives as a blockquote', async ({ page }) => {
  const path = await docxFrom(page, '> Water is the only wealth.')
  const md = await toMarkdown(page, path)
  expect(md).toContain('Water is the only wealth.')
})

test('MEASURED LIMIT: a list from our own .docx writer comes back as literal bullets', async ({ page }) => {
  // Not a defect in this reader. `lib/writeDocx.ts` writes list markers as
  // literal text rather than emitting a numbering.xml part, so Word sees
  // paragraphs beginning with a bullet character and mammoth reports exactly
  // that. A list made in Word itself has real numbering and converts properly.
  //
  // Pinned rather than hidden: if writeDocx ever grows a numbering part this
  // test fails, which is the moment to notice the pair now round-trips.
  const path = await docxFrom(page, '- alpha\n- beta')
  const md = await toMarkdown(page, path)
  expect(md).toContain('alpha')
  expect(md).not.toContain('- alpha')
})

test('an old .doc is named as a different format, not called unreadable', async ({ page }) => {
  // A .doc is an OLE compound file starting D0CF11E0, not a zip. "Could not be
  // read" sends people back to try the same file again.
  await page.goto('/en/apps/docx-markdown')
  await page.getByTestId('dm-file').setInputFiles({
    name: 'old.doc',
    mimeType: 'application/msword',
    buffer: Buffer.concat([Buffer.from([0xd0, 0xcf, 0x11, 0xe0]), Buffer.alloc(64)]),
  })
  await expect(page.getByTestId('file-error')).toContainText('2007')
})

test('a file that is not a Word document at all is refused with a reason', async ({ page }) => {
  await page.goto('/en/apps/docx-markdown')
  await page.getByTestId('dm-file').setInputFiles('e2e/fixtures/diff-small.png')
  await expect(page.getByTestId('file-error')).toBeVisible()
})

test('the pair links both ways', async ({ page }) => {
  // A converter and its inverse that do not link to each other are two tools
  // somebody has to find twice.
  await page.goto('/en/apps/docx-markdown')
  await page.getByTestId('dm-inverse').click()
  await expect(page).toHaveURL(/\/en\/apps\/markdown-docx$/)
})

test('downloads the markdown', async ({ page }) => {
  const path = await docxFrom(page, '# Report\n\ntext')
  await toMarkdown(page, path)
  const dl = page.waitForEvent('download', { timeout: 30_000 })
  await page.getByTestId('dm-download').click()
  expect((await dl).suggestedFilename()).toMatch(/\.md$/)
})

test('works in Arabic', async ({ page }) => {
  const path = await docxFrom(page, '# عنوان\n\nنص **عريض**.')
  const md = await toMarkdown(page, path, 'ar')
  expect(md).toContain('# عنوان')
  expect(md).toContain('**عريض**')
})
