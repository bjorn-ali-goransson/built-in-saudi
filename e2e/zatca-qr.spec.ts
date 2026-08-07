import { test, expect } from '@playwright/test'

// Payloads built to the ZATCA TLV spec (tag byte, LENGTH BYTE, value bytes,
// base64'd). Generated with the script recorded in the PR; each one isolates a
// property worth freezing.

// Arabic seller, correct 15% VAT, phase 1.
const ARABIC = 'ASLYtNix2YPYqSDYp9mE2YbZiNixINmE2YTYqtis2KfYsdipAg8zMDAwMDAwMDAwMDAwMDMDFDIwMjYtMDgtMDdUMTI6MzA6MDBaBAcxMTUwLjAwBQYxNTAuMDA='
// English seller, VAT that is 5% not 15%.
const BAD_VAT = 'AQlUZXN0IFNob3ACDzMwMDAwMDAwMDAwMDAwMwMUMjAyNi0wOC0wN1QxMjozMDowMFoEBjEwMC4wMAUENS4wMA=='
// VAT registration number that is not the Saudi shape.
const BAD_VATNO = 'AQlUZXN0IFNob3ACBTEyMzQ1AxQyMDI2LTA4LTA3VDEyOjMwOjAwWgQGMTE1LjAwBQUxNS4wMA=='
// The Arabic one plus a hash and a signature.
const PHASE2 = 'ASLYtNix2YPYqSDYp9mE2YbZiNixINmE2YTYqtis2KfYsdipAg8zMDAwMDAwMDAwMDAwMDMDFDIwMjYtMDgtMDdUMTI6MzA6MDBaBAcxMTUwLjAwBQYxNTAuMDAGBAECAwQHBAUGBwg='

async function paste(page: import('@playwright/test').Page, payload: string, locale = 'en') {
  await page.goto(`/${locale}/apps/zatca-qr`)
  await page.getByTestId('zq-input').fill(payload)
}

test('an Arabic seller name survives — the whole point of the format', async ({ page }) => {
  // The length byte counts BYTES. Arabic is two bytes a letter, so a decoder
  // that slices by character lands mid-field and everything after it is
  // nonsense. This is the test that catches that.
  await paste(page, ARABIC)
  await expect(page.getByTestId('zq-seller')).toHaveText('شركة النور للتجارة')
  await expect(page.getByTestId('zq-vatno')).toHaveText('300000000000003')
  await expect(page.getByTestId('zq-total')).toHaveText('1150.00')
  await expect(page.getByTestId('zq-vat')).toHaveText('150.00')
})

test('checks the arithmetic and flags a rate that is not 15%', async ({ page }) => {
  await paste(page, ARABIC)
  await expect(page.getByTestId('zq-rate')).toHaveText('15.0%')
  await expect(page.getByTestId('zq-note-vat-rate-off')).toHaveCount(0)

  await paste(page, BAD_VAT)
  await expect(page.getByTestId('zq-rate')).toHaveText('5.3%')
  // And it leaves room for the legitimate explanation rather than crying fraud.
  await expect(page.getByTestId('zq-note-vat-rate-off')).toContainText('zero-rated or exempt')
})

test('flags a VAT number that is not the Saudi shape', async ({ page }) => {
  await paste(page, BAD_VATNO)
  await expect(page.getByTestId('zq-note-bad-vat-number')).toContainText('15 digits')
  await paste(page, ARABIC)
  await expect(page.getByTestId('zq-note-bad-vat-number')).toHaveCount(0)
})

test('tells phase 1 from phase 2', async ({ page }) => {
  await paste(page, ARABIC)
  await expect(page.getByTestId('zq-note-phase-1')).toBeVisible()
  await paste(page, PHASE2)
  await expect(page.getByTestId('zq-note-phase-2')).toBeVisible()
  // The binary fields are shown as base64 rather than mangled into text.
  await expect(page.getByTestId('zq-fields')).toContainText('signature')
})

test('shows every field with its byte length', async ({ page }) => {
  await paste(page, ARABIC)
  const table = page.getByTestId('zq-fields')
  await expect(table).toContainText('sellerName')
  // The Arabic name is 18 characters and 34 bytes — the distinction the whole
  // decoder turns on.
  await expect(table).toContainText('34 B')
})

test('an ordinary QR is refused rather than half-read', async ({ page }) => {
  await paste(page, 'aHR0cHM6Ly9leGFtcGxlLmNvbQ==') // base64 of a URL
  await expect(page.getByTestId('zq-not-tlv')).toBeVisible()
  await expect(page.getByTestId('zq-result')).toHaveCount(0)
})

test('says it reads the invoice and does not verify it', async ({ page }) => {
  await paste(page, PHASE2)
  const note = page.getByTestId('disclaimer')
  await expect(note).toHaveAttribute('data-kind', 'official')
  await expect(note).toContainText('does not verify')
})

test('works in Arabic too', async ({ page }) => {
  await paste(page, ARABIC, 'ar')
  await expect(page.getByTestId('zq-seller')).toHaveText('شركة النور للتجارة')
  await expect(page.getByTestId('zq-note-phase-1')).toBeVisible()
})
