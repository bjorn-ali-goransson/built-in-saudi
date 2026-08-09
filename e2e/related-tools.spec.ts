import { test, expect } from '@playwright/test'

// Every tool page links to every other tool in a crawlable block — right for a
// crawler, useless for a person. This is the short list, and the interesting
// part is what it refuses to show.

// The CARDS, not every link in the nav. The nav also carries the
// "More in <category>" link now, and a locator meaning "all links here"
// was only ever an approximation of "all related tools".
const row = (page: import('@playwright/test').Page) => page.getByTestId('related-grid')
// The surrounding nav, for the heading and the category link.
const nav = (page: import('@playwright/test').Page) => page.getByTestId('related-tools')

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
  await expect(nav(page)).toContainText('أدوات ذات صلة')
  await expect(page.getByTestId('related-qibla')).toBeVisible()
})

// --- Measured at 203 tools: 81 pages (40%) showed NO related row at all
// (`node evals/relatedcheck.mjs`). "Nothing rather than something arbitrary" is
// the right answer to a bad suggestion and the wrong answer to a page: a tool
// with no row is somewhere the catalogue leads you and cannot lead you out of.

test('no tool page is a dead end any more', async ({ page }) => {
  // Each of these had an empty row: nothing in a cluster, nothing above the
  // lexical threshold. They are filled from the tool's own category now.
  for (const id of ['dice-roller', 'base64', 'flashcards', 'coordinates', 'calls']) {
    await page.goto(`/en/apps/${id}`)
    await expect(row(page), `${id} should not be a dead end`).toBeVisible()
    await expect(row(page).locator('a')).not.toHaveCount(0)
  }
})

test('a category sibling fills the row, it does not take it over', async ({ page }) => {
  // The order is curated cluster, then lexical match, then category — so a real
  // relation still comes first and the filler only occupies what is left.
  await page.goto('/en/apps/qr-code')
  const links = row(page).locator('a')
  await expect(links.first()).toContainText(/reader/i)
})

test('the row is still capped rather than listing a whole category', async ({ page }) => {
  // The crawlable block below already links to every tool; this row exists
  // because a list of 200 is the same as no list.
  await page.goto('/en/apps/image-compressor')
  const n = await row(page).locator('a').count()
  expect(n).toBeGreaterThan(0)
  expect(n).toBeLessThanOrEqual(4)
})
