import { test, expect, type Page } from '@playwright/test'
import { PDFDocument, StandardFonts } from 'pdf-lib'

// Compare PDFs.
//
// Found by sweeping life events, then confirmed against the market: PDF compare
// is a crowded, high-demand category and nearly every one of them UPLOADS both
// documents — while the file people compare is a contract against its previous
// draft, a payslip against last month, a policy against the version they
// signed. That is the whole thesis of this site, applied to the document least
// suited to leaving a machine.
//
// It needed no new dependency: `extractPdf` already reads with pdf.js, and
// `lib/wordDiff.ts` is the missing middle — LCS over LINES to bound the cost,
// then over WORDS only inside a region the line pass already called changed.

async function pdf(pages: string[][]): Promise<Buffer> {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  for (const lines of pages) {
    const page = doc.addPage([500, 400])
    lines.forEach((line, i) => page.drawText(line, { x: 40, y: 340 - i * 22, size: 12, font }))
  }
  return Buffer.from(await doc.save())
}

const compare = async (page: Page, a: Buffer, b: Buffer, locale = 'en') => {
  await page.goto(`/${locale}/apps/pdf-diff`)
  await page.getByTestId('pd-file-a').setInputFiles({ name: 'v1.pdf', mimeType: 'application/pdf', buffer: a })
  await page.getByTestId('pd-file-b').setInputFiles({ name: 'v2.pdf', mimeType: 'application/pdf', buffer: b })
  await expect(page.getByTestId('pd-share')).toBeVisible({ timeout: 30_000 })
}

const V1 = [[
  'This agreement is made between the parties.',
  'The term of this agreement is thirty days.',
  'Payment falls due on the first of the month.',
]]

test('it names the words that changed, not the lines around them', async ({ page }) => {
  const v2 = [[
    'This agreement is made between the parties.',
    'The term of this agreement is sixty days.',
    'Payment falls due on the first of the month.',
  ]]
  await compare(page, await pdf(V1), await pdf(v2))
  // The changed WORD, not the whole clause: a line-level answer would
  // highlight the entire sentence and tell you nothing.
  await expect(page.getByTestId('pd-del')).toContainText('thirty')
  await expect(page.getByTestId('pd-add')).toContainText('sixty')
  await expect(page.getByTestId('pd-del')).not.toContainText('agreement')
})

test('identical documents are reported as identical, not as 0.0% different', async ({ page }) => {
  // Without this the tool could report a change on every comparison and the
  // case above would still pass.
  await compare(page, await pdf(V1), await pdf(V1))
  await expect(page.getByTestId('pd-share')).toContainText('identical')
  await expect(page.getByTestId('pd-add')).toHaveCount(0)
})

test('a paragraph inserted at the top does not make the rest look rewritten', async ({ page }) => {
  // The reason this aligns text rather than pixels. Everything after an
  // insertion moves down the page, so a picture comparison calls the whole
  // remainder different.
  const v2 = [[
    'A new recital has been added above everything else.',
    'This agreement is made between the parties.',
    'The term of this agreement is thirty days.',
    'Payment falls due on the first of the month.',
  ]]
  await compare(page, await pdf(V1), await pdf(v2))
  await expect(page.getByTestId('pd-add')).toContainText('recital')
  // Exactly one added run, and nothing removed.
  await expect(page.getByTestId('pd-add')).toHaveCount(1)
  await expect(page.getByTestId('pd-del')).toHaveCount(0)
})

test('a change is attributed to the page it is on', async ({ page }) => {
  const a = await pdf([['Page one is unchanged.'], ['The figure is one hundred.']])
  const b = await pdf([['Page one is unchanged.'], ['The figure is two hundred.']])
  await compare(page, a, b)
  await expect(page.getByTestId('pd-add')).toHaveAttribute('data-page', '2')
  await expect(page.getByTestId('pd-add')).toContainText('page 2')
})

test('context is off by default, because the changes are the answer', async ({ page }) => {
  const v2 = [['This agreement is made between the parties.',
    'The term of this agreement is sixty days.',
    'Payment falls due on the first of the month.']]
  await compare(page, await pdf(V1), await pdf(v2))
  await expect(page.getByTestId('pd-same')).toHaveCount(0)
  await page.getByTestId('pd-context').check()
  expect(await page.getByTestId('pd-same').count()).toBeGreaterThan(0)
})

test('a scan is named as a scan and routed to OCR', async ({ page }) => {
  // An empty page array makes a PDF with nothing extractable — what a scan
  // looks like to a text extractor. Comparing two of those would report them
  // identical, which is true and useless.
  await page.goto('/en/apps/pdf-diff')
  await page.getByTestId('pd-file-a').setInputFiles({
    name: 'scan.pdf', mimeType: 'application/pdf', buffer: await pdf([[], []]),
  })
  await expect(page.getByTestId('pd-scanned')).toBeVisible({ timeout: 30_000 })
  await page.getByTestId('pd-ocr').click()
  await expect(page).toHaveURL(/\/en\/apps\/pdf-ocr/)
})

test('it says why it compares text rather than pixels, and offers the other tool', async ({ page }) => {
  await page.goto('/en/apps/pdf-diff')
  await expect(page.getByTestId('pd-why')).toContainText('re-flow')
})

test('it works in Arabic', async ({ page }) => {
  const v2 = [['This agreement is made between the parties.',
    'The term of this agreement is sixty days.',
    'Payment falls due on the first of the month.']]
  await compare(page, await pdf(V1), await pdf(v2), 'ar')
  await expect(page.getByTestId('pd-add')).toContainText('صفحة')
})
