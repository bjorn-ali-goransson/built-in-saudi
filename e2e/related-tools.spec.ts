import { test, expect } from '@playwright/test'

// Every tool page links to every other tool in a crawlable block — right for a
// crawler, useless for a person. This is the short list, and the interesting
// part is what it refuses to show.

const row = (page: import('@playwright/test').Page) => page.getByTestId('related-tools')

test('a format family suggests its own family', async ({ page }) => {
  // Derived from the scorer: these share vocabulary, so relatedness is visible
  // to a lexical matcher and needs no curation.
  await page.goto('/en/apps/csv-to-xlsx')
  await expect(row(page)).toBeVisible()
  await expect(page.getByTestId('related-xlsx-convert')).toBeVisible()
})

test('a life-domain cluster is curated, because no scorer can see it', async ({ page }) => {
  // GOSI, gratuity and leave share no words at all. Measured, the scorer put
  // gosi-salary next to ip-subnet and calorie-needs.
  await page.goto('/en/apps/gosi-salary')
  await expect(page.getByTestId('related-end-of-service')).toBeVisible()
  await expect(page.getByTestId('related-leave-overtime')).toBeVisible()
  await expect(page.getByTestId('related-ip-subnet')).toHaveCount(0)
  await expect(page.getByTestId('related-calorie-needs')).toHaveCount(0)
})

test('the VAT tools point at each other', async ({ page }) => {
  await page.goto('/en/apps/vat-registration')
  await expect(page.getByTestId('related-vat-calculator')).toBeVisible()
  await expect(page.getByTestId('related-zatca-qr')).toBeVisible()
})

test('a related link actually goes there', async ({ page }) => {
  await page.goto('/en/apps/qr-code')
  await page.getByTestId('related-qr-reader').click()
  await expect(page).toHaveURL(/\/en\/apps\/qr-reader/)
})

test('it never suggests the tool you are already on', async ({ page }) => {
  await page.goto('/en/apps/pdf-to-text')
  await expect(page.getByTestId('related-pdf-to-text')).toHaveCount(0)
})

test('it shows at most four, so it stays a short list', async ({ page }) => {
  await page.goto('/en/apps/image-compressor')
  const links = row(page).locator('[data-testid^="related-"]')
  await expect(links).toHaveCount(4)
})

test('the row is localized, not an English fallback', async ({ page }) => {
  await page.goto('/ar/apps/prayer-times')
  await expect(row(page)).toContainText('أدوات ذات صلة')
  await expect(page.getByTestId('related-qibla')).toBeVisible()
})
