import { test, expect } from '@playwright/test'

// The table tools read their input three different ways, and the odd ones out
// had a real bug in them.
//
// `lib/tableFile.ts` exists so that "read whatever table file the user has" is
// written once — CSV by sniffing the delimiter, .xlsx through the zip-and-XML
// reader, and an explicit REFUSAL for .xls and Apple Numbers, which are
// entirely different formats. Two tools used it. csv-vcard had an inline copy
// that handled .xlsx and then fell through to `file.text()` for everything
// else, so a legacy .xls — an OLE compound file — was decoded as text and
// parsed as a table. It showed a grid of mojibake and no error, while the
// tool's own error copy already claimed .xls did not work.
//
// csv-clean and csv-merge could not open a spreadsheet at all, which is odd in
// a site that also ships "Excel to CSV": the advice was to round-trip through
// another tool.

test('csv-vcard refuses a legacy .xls rather than parsing its bytes as text', async ({ page }) => {
  await page.goto('/en/apps/csv-vcard')
  await page.getByTestId('cv-file').setInputFiles('e2e/fixtures/legacy.xls')
  await expect(page.getByTestId('file-error')).toContainText('.xls')
  // And it does not pretend to have read anything.
  await expect(page.getByTestId('cv-count')).toHaveCount(0)
})

test('csv-vcard still opens a real .xlsx', async ({ page }) => {
  await page.goto('/en/apps/csv-vcard')
  await page.getByTestId('cv-file').setInputFiles('e2e/fixtures/sample.xlsx')
  await expect(page.getByTestId('file-error')).toHaveCount(0)
})

test('csv-clean opens a spreadsheet, and refuses the old format by name', async ({ page }) => {
  await page.goto('/en/apps/csv-clean')
  await page.getByTestId('cc-file').setInputFiles('e2e/fixtures/sample.xlsx')
  await expect(page.getByTestId('cc-input')).not.toBeEmpty()
  await page.getByTestId('cc-file').setInputFiles('e2e/fixtures/legacy.xls')
  await expect(page.getByTestId('file-error')).toContainText('.xls')
})

test('csv-merge opens a spreadsheet on either side', async ({ page }) => {
  await page.goto('/en/apps/csv-merge')
  await page.getByTestId('cm-file-a').setInputFiles('e2e/fixtures/sample.xlsx')
  await expect(page.getByTestId('cm-text-a')).not.toBeEmpty()
  await page.getByTestId('cm-file-b').setInputFiles('e2e/fixtures/legacy.xls')
  await expect(page.getByTestId('file-error')).toContainText('.xls')
})

test('a pasted CSV is passed through byte for byte, not re-serialised', async ({ page }) => {
  // A paste box should show what you gave it. Round-tripping every text file
  // through the parser would renormalise the user's quoting for no reason.
  await page.goto('/en/apps/csv-clean')
  await page.getByTestId('cc-file').setInputFiles({
    name: 'odd.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('a,b\n"keep  ""this"" exactly",2\n'),
  })
  await expect(page.getByTestId('cc-input')).toHaveValue('a,b\n"keep  ""this"" exactly",2\n')
})
