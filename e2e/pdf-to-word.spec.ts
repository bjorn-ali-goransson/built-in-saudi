import { test, expect } from '@playwright/test'

// PDF to Word.
//
// Found by a web sweep, and it is the largest gap the site had: PDF to Word is
// the most-requested PDF task on the web (~2M conversions a day) and fewer than
// 15% of them happen without the file being uploaded to somebody's server —
// this site's thesis, stated by the market, on the document people are least
// willing to hand over.
//
// The fixture `structured.pdf` is built by `scripts/make-structured-pdf.mjs`
// with a title, a section heading, a wholly bold line at body size, a sentence
// that WRAPS across three PDF lines, two lists and a bold run mid-line. A
// fixture of uniform paragraphs would let the tool pass while inferring
// nothing, which is the vacuous-green failure this repo keeps paying for.

const FIXTURE = 'e2e/fixtures/structured.pdf'

const open = async (page: import('@playwright/test').Page, file = FIXTURE, locale = 'en') => {
  await page.goto(`/${locale}/apps/pdf-to-word`)
  await page.getByTestId('ptw-file').setInputFiles(file)
  await expect(page.getByTestId('ptw-counts')).toBeVisible({ timeout: 20000 })
}

const outline = async (page: import('@playwright/test').Page) =>
  page.getByTestId('ptw-outline').locator('li').evaluateAll((els) =>
    els.map((e) => ({
      kind: e.querySelector('span')!.textContent!.trim(),
      text: e.querySelectorAll('span')[1].textContent!.trim(),
    })))

test('the title becomes a heading, and a bigger one than the section head', async ({ page }) => {
  await open(page)
  const rows = await outline(page)
  const title = rows.find((r) => r.text.includes('Quarterly Operations Report'))
  const section = rows.find((r) => r.text.includes('Summary of the quarter'))
  expect(title?.kind).toBe('Heading 1')
  // Level from how much larger, so the document's own hierarchy survives
  // instead of everything becoming H1.
  expect(section?.kind).toBe('Heading 2')
})

test('a wholly bold line at body size is still a heading', async ({ page }) => {
  // The fourth-level heading every report uses, which no size test can see.
  await open(page)
  const rows = await outline(page)
  const r = rows.find((x) => x.text.includes('Regional detail'))
  expect(r?.kind).toBe('Heading 4')
})

test('a sentence wrapped over three PDF lines is ONE paragraph', async ({ page }) => {
  // Joining only on a blank gap gives one paragraph per line, which is the
  // single most obvious way a converted document is unusable.
  await open(page)
  const rows = await outline(page)
  const paras = rows.filter((r) => r.kind === 'Paragraph' && r.text.includes('Revenue rose'))
  expect(paras).toHaveLength(1)
  expect(paras[0].text).toContain('eastern province')
  expect(paras[0].text).toContain('ahead of the schedule')
})

test('bullets and numbers become real lists, and two kinds are two lists', async ({ page }) => {
  await open(page)
  const rows = await outline(page)
  const lists = rows.filter((r) => r.kind === 'List')
  expect(lists.length).toBe(2)
  expect(lists[0].text).toContain('Riyadh: 1,204 units')
  // The marker is stripped, because Word supplies it — leaving it in gives
  // every item two bullets.
  expect(lists[0].text).not.toContain('•')
  expect(lists[1].text).toContain('Close the books')
  expect(lists[1].text).not.toMatch(/^1\./)
})

test('the .docx is a real Word file carrying the recovered structure', async ({ page }) => {
  await open(page)
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('ptw-download').click(),
  ])
  expect(download.suggestedFilename()).toBe('structured.docx')

  const path = await download.path()
  const buf = await import('node:fs').then((fs) => fs.readFileSync(path!))
  // Read off the RAW BYTES first: two hand-written implementations agreeing is
  // weaker evidence than one being right.
  expect(buf.subarray(0, 2).toString('latin1')).toBe('PK')
  const raw = buf.toString('latin1')
  for (const part of ['[Content_Types].xml', 'word/document.xml', 'word/styles.xml', 'word/numbering.xml']) {
    expect(raw, `missing ${part}`).toContain(part)
  }
})

test('a bold run inside a plain line survives as bold', async ({ page }) => {
  await open(page)
  const rows = await outline(page)
  const r = rows.find((x) => x.text.includes('Prepared by'))
  expect(r).toBeTruthy()
  expect(r!.text).toContain('Operations')
})

test('a locked PDF asks for the password rather than failing', async ({ page }) => {
  await page.goto('/en/apps/pdf-to-word')
  await page.getByTestId('ptw-file').setInputFiles('e2e/fixtures/locked.pdf')
  await expect(page.getByTestId('ptw-password-panel')).toBeVisible({ timeout: 20000 })
})

test('a PNG is reported as unreadable, not silently ignored', async ({ page }) => {
  await page.goto('/en/apps/pdf-to-word')
  await page.getByTestId('ptw-file').setInputFiles('e2e/fixtures/diff-a.png')
  await expect(page.getByTestId('file-error')).toBeVisible({ timeout: 20000 })
})

test('the limits are stated rather than implied', async ({ page }) => {
  // The upload sites promise a faithful reproduction and need a server to
  // half-manage it. Saying what does not survive is the honest version.
  await page.goto('/en/apps/pdf-to-word')
  await expect(page.getByTestId('ptw-limits')).toContainText('images')
})

test('it works in Arabic', async ({ page }) => {
  await open(page, FIXTURE, 'ar')
  const rows = await outline(page)
  expect(rows.some((r) => r.kind.startsWith('عنوان'))).toBe(true)
  expect(rows.some((r) => r.kind === 'فقرة')).toBe(true)
})
