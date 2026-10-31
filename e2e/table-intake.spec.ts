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
