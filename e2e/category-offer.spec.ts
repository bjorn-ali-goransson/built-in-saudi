import { test, expect } from '@playwright/test'

// "You asked for a family — here is the family."
//
// `node evals/tieprobe.mjs` measured what nobody had asked: how often is the
// top result decided by a coin toss? On benched queries, rarely (4.4%) and
// almost always rightly. On a GENERIC word it collapses — «حاسبة» is an
// 18-way tie, so the site answered it with one arbitrary calculator out of
// twenty. `evals/categoryprobe.mjs` then measured the offer itself: it fires
// on 35/35 category queries and on 0 of 272 benched ones, 0 of 440 tool names
// and 0 unanswerable queries.

const search = async (page: import('@playwright/test').Page, q: string, locale = 'en') => {
  await page.goto(`/${locale}`)
  await page.getByRole('searchbox').fill(q)
}

test('a query that names a category offers the category page', async ({ page }) => {
  await search(page, 'calculator')
  const offer = page.getByTestId('category-offer')
  await expect(offer).toBeVisible()
  await expect(offer).toHaveAttribute('data-category', 'calculators')
  await offer.click()
  await expect(page).toHaveURL(/\/en\/c\/calculators\/$/)
})

test('the Arabic singular reaches the plural label — the 18-way tie', async ({ page }) => {
  // «حاسبة» is neither a substring nor a subsequence of the label «حاسبات»,
  // which is exactly why the terms are written out rather than derived.
  await search(page, 'حاسبة', 'ar')
  await expect(page.getByTestId('category-offer')).toHaveAttribute('data-category', 'calculators')
  await search(page, 'حاسبات', 'ar')
  await expect(page.getByTestId('category-offer')).toHaveAttribute('data-category', 'calculators')
  await search(page, 'الحاسبة', 'ar')
  await expect(page.getByTestId('category-offer')).toHaveAttribute('data-category', 'calculators')
})

test('"free pdf tools" — the phrasing the category pages were written for', async ({ page }) => {
  await search(page, 'free pdf tools')
  await expect(page.getByTestId('category-offer')).toHaveAttribute('data-category', 'pdf')
})

test('a query naming ONE tool never gets a category card', async ({ page }) => {
  // The card sits ABOVE the real results, so a false positive costs more than
  // a miss. Measured at 0 across 272 benched queries; these are the ones
  // closest to a category name.
  for (const q of ['merge pdf', 'compress image', 'image to text', 'vat calculator', 'حاسبة الزكاة']) {
    await search(page, q)
    await expect(page.getByTestId('category-offer'), `"${q}" should not offer a category`).toHaveCount(0)
  }
})

test('the results are untouched — this is an offer, not a re-ranking', async ({ page }) => {
  await search(page, 'pdf')
  const withOffer = await page.locator('[data-testid^="tool-"]').evaluateAll((e) => e.length)
  expect(withOffer).toBeGreaterThan(3)
  // The first result is still a tool, and Enter still opens it.
  await page.getByRole('searchbox').press('Enter')
  await expect(page).toHaveURL(/\/en\/apps\//)
})

test('the offer counts the tools actually in the category', async ({ page }) => {
  await search(page, 'pdf')
  await expect(page.getByTestId('category-offer')).toBeVisible()
  const text = await page.getByTestId('category-offer-count').textContent()
  const n = Number((text || '').replace(/\D/g, ''))
  expect(n).toBeGreaterThan(5)

  await page.goto('/en/c/pdf/')
  const listed = await page.locator('[data-testid^="tool-"]').evaluateAll((e) => e.length)
  expect(n).toBe(listed)
})

test('the launcher offers it too, because the two surfaces must match', async ({ page }) => {
  await page.goto('/en/apps/qr-code')
  await page.getByTestId('app-launcher').click()
  await page.getByTestId('launcher-search').fill('calculator')
  const offer = page.getByTestId('category-offer')
  await expect(offer).toBeVisible()
  await offer.click()
  await expect(page).toHaveURL(/\/en\/c\/calculators\/$/)
})

test('it is not in the arrow-key sequence', async ({ page }) => {
  // The keys walk the tools; slipping a differently-shaped row into that
  // sequence would make Enter mean two things depending on where you were.
  await search(page, 'calculator')
  await expect(page.getByTestId('category-offer')).toBeVisible()
  await page.getByRole('searchbox').press('ArrowDown')
  await expect(page.getByTestId('result-active')).toBeVisible()
  await page.getByRole('searchbox').press('Enter')
  await expect(page).toHaveURL(/\/en\/apps\//)
})
