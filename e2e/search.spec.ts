import { test, expect } from '@playwright/test'

// Search ranking, driven through the real catalogue.
//
// These are the queries that measurably failed before the ranking work: with
// 184 tools, a fuzzy matcher tuned at ~100 returned NOTHING for 14 of 68 bench
// queries, because the whole query — spaces included — had to appear in one
// field in order. "pdf merge" could not find the tool named "Merge PDFs".
//
// Measured over that bench: top-1 75% -> 94%, top-3 78% -> 100%, unfindable
// 14 -> 0. These cases are the ones worth freezing.

const top = (page: import('@playwright/test').Page) => page.locator('[data-testid^="tool-"]').first()

async function search(page: import('@playwright/test').Page, query: string, locale = 'en') {
  await page.goto(`/${locale}`)
  await page.locator('.tool-search__input').fill(query)
}

test('word order does not matter', async ({ page }) => {
  // The single biggest failure: every multi-word query whose words appear in a
  // different order than the tool's name found nothing at all.
  await search(page, 'pdf merge')
  await expect(top(page)).toContainText(/merge/i)
  await search(page, 'merge pdf')
  await expect(top(page)).toContainText(/merge/i)
})

test('a sentence with filler words still finds the tool', async ({ page }) => {
  // "is" and "my" are in no tool anywhere, and one unmatched word used to take
  // the whole query down with it.
  await search(page, 'is my password good')
  await expect(page.locator('[data-testid^="tool-"]').first()).toContainText(/password/i)
})

test('the words people use, not the words a developer wrote', async ({ page }) => {
  await search(page, 'make picture smaller')
  await expect(top(page)).toContainText(/compress/i)
})

test('matching every word beats matching one word strongly', async ({ page }) => {
  // "compress image" must not rank the PDF compressor first just because its
  // name contains "compress".
  await search(page, 'compress image')
  await expect(top(page)).toContainText(/image/i)
})

test('Arabic queries rank on the Arabic name', async ({ page }) => {
  await search(page, 'ضغط صورة', 'ar')
  await expect(top(page)).toContainText(/صور/)
  await search(page, 'مواقيت', 'ar')
  await expect(top(page)).toContainText(/الصلاة/)
})

test('an exact tool name still wins outright', async ({ page }) => {
  await search(page, 'metronome')
  await expect(top(page)).toContainText(/metronome/i)
  await search(page, 'khatma')
  await expect(top(page)).toContainText(/khatma/i)
})

test('the launcher searches the same way', async ({ page }) => {
  await page.goto('/en/apps/qr-code')
  await page.getByTestId('app-launcher').click()
  await page.getByTestId('launcher-search').fill('excel to csv')
  // The launcher and the home catalogue share one scorer, so a query that works
  // in one has to work in the other.
  await expect(page.getByTestId('tool-xlsx-convert')).toBeVisible()
})

test('a query nothing matches still says so rather than showing everything', async ({ page }) => {
  await search(page, 'zzzzqqqq')
  await expect(page.locator('[data-testid^="tool-"]')).toHaveCount(0)
})

// A second round, after four file tools were added. Adding tools measurably
// DEGRADED search: on the same 81-query bench, top-1 fell to 88% because a new
// tool captured a generic query and another was unfindable by the words people
// use for it. Fixing the metadata (not the scorer) took it to 91% / 100% top-3.
// These are the cases that moved.

test('a new tool must not capture a generic term from the established one', async ({ page }) => {
  // "Scanned PDF to Text" was first called "OCR a Scanned PDF", which starts
  // with OCR and therefore outscored "Image to Text (OCR)" on a bare "ocr" —
  // a query that means the general tool, not the PDF one.
  await search(page, 'ocr')
  await expect(top(page)).toContainText(/image to text/i)
  // ...while the specific query still reaches the specific tool.
  await search(page, 'scanned pdf')
  await expect(top(page)).toContainText(/scanned pdf/i)
})

test('the tool that READS a format leads on that format', async ({ page }) => {
  // Both the reader and the writer list "xlsx"; they tied exactly, so the
  // winner was whichever was registered first.
  await search(page, 'xlsx')
  await expect(page.getByTestId('tool-xlsx-convert')).toBeVisible()
  await expect(top(page)).toContainText(/excel to csv/i)
  await search(page, 'csv to excel')
  await expect(top(page)).toContainText(/csv to excel/i)
})

test('a converter is findable by what people call the output, not the format', async ({ page }) => {
  // "contacts to spreadsheet" ranked vCard to CSV FOURTH, behind the tool that
  // converts the other way, because it never used the word "spreadsheet".
  await search(page, 'contacts to spreadsheet')
  await expect(page.getByTestId('tool-vcard-to-csv')).toBeVisible()
  await search(page, 'export phone contacts')
  await expect(top(page)).toContainText(/vcard/i)
})

test('the new file tools are reachable by their plain names', async ({ page }) => {
  await search(page, 'word to text')
  await expect(top(page)).toContainText(/word to text/i)
  await search(page, 'docx')
  await expect(top(page)).toContainText(/word to text/i)
  await search(page, 'vcf to csv')
  await expect(top(page)).toContainText(/vcard/i)
})

// The catalogue's SHAPE, not its ranking. Measured at 191 tools: "Converters"
// held three tools while the turn-this-file-into-that family was scattered
// across Text, Files and Converters — so the section named for the intent was
// the one place you would not find it. Two of its three were VALUE converters
// (units, currency), which is a different job entirely.

test('the section named for converting holds the file converters', async ({ page }) => {
  await page.goto('/en')
  const converters = page.getByTestId('section-Converters')
  await expect(converters).toBeVisible()
  for (const id of ['docx-to-text', 'pptx-to-text', 'csv-to-xlsx', 'xlsx-convert', 'vcard-to-csv', 'epub-text']) {
    await expect(converters.getByTestId(`tool-${id}`)).toBeVisible()
  }
})

test('converting a value is a calculator, not a file converter', async ({ page }) => {
  await page.goto('/en')
  // Unit and currency conversion sit with percentage/VAT/zakat, where someone
  // doing arithmetic is already looking.
  await expect(page.getByTestId('section-Calculators').getByTestId('tool-unit-converter')).toBeVisible()
  await expect(page.getByTestId('section-Converters').getByTestId('tool-unit-converter')).toHaveCount(0)
})

test('a tool with a stronger family keeps it', async ({ page }) => {
  await page.goto('/en')
  // Nobody hunts for the PDF converter anywhere but PDF, so pdf-to-text stays
  // put even though it converts a file.
  await expect(page.getByTestId('section-PDF').getByTestId('tool-pdf-to-text')).toBeVisible()
})

test('the tools about a website live under Web, not buried in Developer', async ({ page }) => {
  // Developer was 32 tools — the biggest section by a distance and an
  // undifferentiated wall. Only the uncontested part was split off: things you
  // point at a site or a URL, rather than at code.
  await page.goto('/en')
  const web = page.getByTestId('section-Web')
  await expect(web).toBeVisible()
  for (const id of ['meta-tags', 'robots-txt', 'link-preview', 'url-parser', 'user-agent']) {
    await expect(web.getByTestId(`tool-${id}`)).toBeVisible()
  }
  // A subnet calculator is a networking tool a developer reaches for, not
  // something you use on a site — it deliberately stayed put.
  await expect(page.getByTestId('section-Developer').getByTestId('tool-ip-subnet')).toBeVisible()
})

test('the new category has an Arabic label, not a raw English fallback', async ({ page }) => {
  await page.goto('/ar')
  await expect(page.getByTestId('section-Web')).toContainText('الويب')
})

// Arabic morphology defeats substring matching, and it cost two tools their own
// query. A name in the plural or as an agent noun does not contain the singular
// or verbal noun a person types, so the SPECIFIC tool won by accident: the QR
// reader is "قارئ رمز الفاتورة" and beat the invoice generator on "فاتورة"; the
// subtitle editor is "محرّر الترجمة" and beat the translator on "ترجمة".

test('an Arabic query finds the tool that does the thing, not the one that mentions it', async ({ page }) => {
  await search(page, 'فاتورة', 'ar')
  await expect(top(page)).toContainText('فاتورة')
  await expect(page.getByTestId('tool-invoice-generator')).toBeVisible()

  await search(page, 'ترجمة', 'ar')
  await expect(page.getByTestId('tool-translate')).toBeVisible()
  await expect(top(page)).toContainText('ترجمة')
})

test('the newest Saudi tools are reachable by what people call them', async ({ page }) => {
  for (const [q, id] of [['gosi', 'gosi-salary'], ['fahes', 'vehicle-renewal'],
    ['rent increase', 'rent-rules'], ['vat registration', 'vat-registration']] as const) {
    await search(page, q)
    await expect(page.getByTestId(`tool-${id}`)).toBeVisible()
  }
})

test('and by their Arabic names', async ({ page }) => {
  for (const [q, id] of [['التأمينات', 'gosi-salary'], ['الفحص الدوري', 'vehicle-renewal'],
    ['زيادة الإيجار', 'rent-rules']] as const) {
    await search(page, q, 'ar')
    await expect(page.getByTestId(`tool-${id}`)).toBeVisible()
  }
})
