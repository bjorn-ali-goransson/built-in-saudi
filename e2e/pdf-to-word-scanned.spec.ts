import { test, expect, type Page } from '@playwright/test'
import { PDFDocument, StandardFonts } from 'pdf-lib'

// The branch `pdf-to-word` takes when the PDF has no text in it.
//
// Found by `node evals/untested-ui.mjs`, which asks the inverse of the coverage
// measure: a `data-testid` is put there to be driven, so one no spec references
// is a control or a state nobody has exercised. It reported **991 of 2877
// testids (34%) never referenced**, and `ptw-scanned` / `ptw-ocr` stood out
// because they are not a styling option — they are a BEHAVIOURAL branch that
// replaces the whole output with a redirect.
//
// It matters because it is the likeliest thing to be handed this tool. A
// scanned contract is exactly the document somebody wants as an editable Word
// file, and a Word file made from it would be empty — so the tool has to say
// so rather than hand over a blank document and let it be discovered later.
//
// `looksScanned` is "fewer than ten characters per page", shared with
// `pdf-to-text`. Both ends of that rule are pinned here.

async function pdf(pages: string[][]): Promise<Buffer> {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  for (const lines of pages) {
    const page = doc.addPage([400, 400])
    lines.forEach((line, i) => page.drawText(line, { x: 40, y: 340 - i * 24, size: 14, font }))
  }
  return Buffer.from(await doc.save())
}

const open = async (page: Page, buffer: Buffer, name = 'doc.pdf', locale = 'en') => {
  await page.goto(`/${locale}/apps/pdf-to-word`)
  await page.getByTestId('ptw-drop').locator('input[type=file]')
    .setInputFiles({ name, mimeType: 'application/pdf', buffer })
}

test('a picture-only PDF is named as a scan instead of converting to an empty document', async ({ page }) => {
  // Two pages with nothing extractable on them — what a scan looks like to a
  // text extractor.
  await open(page, await pdf([[], []]), 'scan.pdf')
  await expect(page.getByTestId('ptw-scanned')).toBeVisible({ timeout: 30_000 })
  // The testid is on the explanation, not the heading: it has to say WHY a
  // conversion would be useless, or "this looks like a scan" is a refusal with
  // no reason attached.
  await expect(page.getByTestId('ptw-scanned')).toContainText('almost no text')
  await expect(page.getByTestId('ptw-scanned')).toContainText('would be empty')
})

test('and it routes to OCR rather than leaving a dead end', async ({ page }) => {
  await open(page, await pdf([[]]), 'scan.pdf')
  await expect(page.getByTestId('ptw-ocr')).toBeVisible({ timeout: 30_000 })
  await page.getByTestId('ptw-ocr').click()
  await expect(page).toHaveURL(/\/en\/apps\/pdf-ocr/)
})

test('a PDF WITH text converts, and is not called a scan', async ({ page }) => {
  // The other half. Without it, a tool that called every PDF a scan would pass
  // the two cases above — the vacuous-green failure this repo keeps catching.
  await open(page, await pdf([[
    'Contract of employment',
    'This agreement is made in Riyadh between the parties named below,',
    'and sets out the terms on which the work is to be performed.',
  ]]), 'contract.pdf')
  await expect(page.getByTestId('ptw-scanned')).toHaveCount(0)
  await expect(page.getByTestId('ptw-download')).toBeVisible({ timeout: 30_000 })
})

test('the scan notice reads in Arabic too', async ({ page }) => {
  await open(page, await pdf([[]]), 'scan.pdf', 'ar')
  await expect(page.getByTestId('ptw-scanned')).toBeVisible({ timeout: 30_000 })
  await expect(page.getByTestId('ptw-scanned')).toContainText('صور')
})
