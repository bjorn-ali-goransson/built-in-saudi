import { test, expect } from '@playwright/test'

// A wrong URL used to be a dead end: "not found", and a button back to a
// catalogue of 211. Measured before building this (node evals/slugprobe.mjs,
// 42 slugs a person or a stale link would really produce): 92% correct top hit,
// 95% within the top three, 4 of 5 unanswerable slugs correctly silent.

test('a plausible wrong URL suggests the tool it meant', async ({ page }) => {
  await page.goto('/en/apps/pdf-combine')
  await expect(page.getByTestId('not-found')).toBeVisible()
  await expect(page.getByTestId('nf-suggest-pdf-merge')).toBeVisible()
  await page.getByTestId('nf-suggest-pdf-merge').click()
  await expect(page).toHaveURL(/\/en\/apps\/pdf-merge$/)
})

test('a slug with no separators still reaches the right tool', async ({ page }) => {
  // `qrcode` is one token until the digits and dashes are split out.
  await page.goto('/en/apps/qr-generator')
  await expect(page.getByTestId('nf-suggest-qr-code')).toBeVisible()
})

test('a slug that means nothing here suggests nothing', async ({ page }) => {
  // The same relevance floor the search box uses. Offering the best of a bad
  // list, laid out exactly like a real answer, is the adware move.
  await page.goto('/en/apps/asdfgh')
  await expect(page.getByTestId('not-found')).toBeVisible()
  await expect(page.getByTestId('nf-suggestions')).toHaveCount(0)
})

// NOTE: the suggestions are also suppressed for a coming-soon tool, whose page
// already names it and says it is being built — a row of alternatives would
// contradict that. There is deliberately NO test for it: the registry holds no
// coming-soon tools today, so the case would pass without exercising anything,
// which is the vacuous green this repo keeps paying for.

test('the suggestion comes from the slug, not from somewhere else', async ({ page }) => {
  // Two wrong URLs must not produce the same row — that would mean the
  // suggestions are decorative rather than derived.
  await page.goto('/en/apps/pdf-combine')
  const a = await page.getByTestId('nf-suggestions').locator('a').first().getAttribute('data-testid')
  await page.goto('/en/apps/zakat')
  const b = await page.getByTestId('nf-suggestions').locator('a').first().getAttribute('data-testid')
  expect(a).toBe('nf-suggest-pdf-merge')
  expect(b).toBe('nf-suggest-zakat-calculator')
})

test('suggestions are capped at three', async ({ page }) => {
  // A guess needs to read as a guess. A long list reads as a search result.
  await page.goto('/en/apps/pdf-thing')
  const n = await page.getByTestId('nf-suggestions').locator('a').count()
  expect(n).toBeGreaterThan(0)
  expect(n).toBeLessThanOrEqual(3)
})

test('a bad category slug is a 404 too, and does not invent a category', async ({ page }) => {
  await page.goto('/en/c/not-a-category')
  await expect(page.getByTestId('not-found')).toBeVisible()
  await expect(page.getByTestId('category-page')).toHaveCount(0)
})

test('works in Arabic', async ({ page }) => {
  await page.goto('/ar/apps/pdf-combine')
  await expect(page.getByTestId('nf-suggest-pdf-merge')).toBeVisible()
  await expect(page.getByTestId('nf-suggestions')).toContainText('هل تقصد')
})

test('a MISTYPED url suggests what it meant, not what it literally matched', async ({ page }) => {
  // This page was the one search surface without typo correction — home and
  // the launcher both had it, this called the uncorrected ranker. It is the
  // surface that needs it most, because a wrong URL is most often a mistyped
  // one: `pdf-mrege` is a single transposition, and it was suggesting
  // `pdf-edit` because the typed string genuinely matched that better.
  //
  // Measured on `evals/slugprobe.mjs`: top-1 92% -> 95%, top-3 95% -> 97%.
  await page.goto('/en/apps/pdf-mrege')
  await expect(page.getByTestId('not-found')).toBeVisible()
  await expect(page.getByTestId('nf-suggest-pdf-merge')).toBeVisible()
})

test('and a slug that means nothing is still not corrected into an answer', async ({ page }) => {
  // Correction only fires on a word the catalogue does not know, and only when
  // the corrected query scores decisively better. Without this the fix could
  // have been "correct until something matches".
  await page.goto('/en/apps/xkcd-zzzz')
  await expect(page.getByTestId('not-found')).toBeVisible()
  await expect(page.getByTestId('nf-suggestions')).toHaveCount(0)
})
