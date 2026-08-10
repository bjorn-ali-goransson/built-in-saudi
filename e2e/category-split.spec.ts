import { test, expect } from '@playwright/test'

// Calculators was 27 tools, and a security collection.
//
// `node evals/catalogshape.mjs` measured the outlier: **Calculators at 27, 1.8x
// the median** — the same shape that split Saudi / Local at 31 and Developer at
// 32 before it, and measurably the reason «حاسبة» is an 18-way tie. A BMI
// calculator and a VAT calculator share the word "calculator" and nothing else:
// health is a subject and time is a subject; "calculator" is a shape.
//
// Security went the other way, on purpose. A CATEGORY would have moved
// `password-generator` out of Generators, breaking the measured "a bare noun
// goes to the tool that MAKES the thing" tie ordering, and would have pulled
// the redaction tools out of the format families people actually hunt in. A
// collection says "these are all privacy tools" without moving any of them.

test('the health tools are their own group now', async ({ page }) => {
  await page.goto('/en/c/health/')
  await expect(page.getByTestId('category-page')).toHaveAttribute('data-category', 'Health')
  const ids = await page.locator('[data-testid^="tool-"]')
    .evaluateAll((els) => els.map((e) => e.getAttribute('data-testid')!.replace('tool-', '')))
  expect(ids).toContain('calorie-needs')
  expect(ids).toContain('ovulation')
  expect(ids).toContain('medicine-schedule')
  // And NOT the things that merely share the word "calculator".
  expect(ids).not.toContain('vat-calculator')
})

test('the time and date tools are their own group now', async ({ page }) => {
  await page.goto('/en/c/time/')
  const ids = await page.locator('[data-testid^="tool-"]')
    .evaluateAll((els) => els.map((e) => e.getAttribute('data-testid')!.replace('tool-', '')))
  expect(ids).toContain('working-days')
  expect(ids).toContain('stopwatch')
  expect(ids).toContain('timezone-planner')
  expect(ids).not.toContain('calorie-needs')
})

test('Calculators is what is left, and is much smaller', async ({ page }) => {
  await page.goto('/en/c/calculators/')
  const n = await page.locator('[data-testid^="tool-"]').count()
  // 27 before the split, 11 after. A conservative ceiling, so this tests the
  // split rather than one exact roster.
  expect(n).toBeLessThan(16)
  expect(n).toBeGreaterThan(6)
})

test('a security collection exists WITHOUT moving anything out of its category', async ({ page }) => {
  await page.goto('/en/c/security/')
  const ids = await page.locator('[data-testid^="tool-"]')
    .evaluateAll((els) => els.map((e) => e.getAttribute('data-testid')!.replace('tool-', '')))
  expect(ids).toContain('password-generator')
  expect(ids).toContain('pdf-redact')
  expect(ids).toContain('cert-decoder')

  // The point of the collection: each is still filed where people hunt for it.
  await page.goto('/en/c/generators/')
  const gen = await page.locator('[data-testid^="tool-"]')
    .evaluateAll((els) => els.map((e) => e.getAttribute('data-testid')!.replace('tool-', '')))
  expect(gen, 'password-generator must stay in Generators').toContain('password-generator')
  await page.goto('/en/c/pdf/')
  const pdf = await page.locator('[data-testid^="tool-"]')
    .evaluateAll((els) => els.map((e) => e.getAttribute('data-testid')!.replace('tool-', '')))
  expect(pdf, 'pdf-redact must stay in PDF').toContain('pdf-redact')
})

test('a bare noun still goes to the tool that MAKES the thing', async ({ page }) => {
  // The tie ordering a category move would have broken.
  await page.goto('/en')
  await page.getByRole('searchbox').fill('password')
  await page.getByRole('searchbox').press('Enter')
  await expect(page).toHaveURL(/\/en\/apps\/password-generator$/)
})

test('the new groups are offered from search', async ({ page }) => {
  for (const [q, slug] of [['health', 'health'], ['time', 'time'], ['security', 'security'], ['privacy', 'security']] as const) {
    await page.goto('/en')
    await page.getByRole('searchbox').fill(q)
    await expect(page.getByTestId('category-offer'), q).toHaveAttribute('data-category', slug)
  }
})

test('a family query that matches NO tool still gets the family', async ({ page }) => {
  // The bug this pass found. Measured over 51 queries naming a family, the
  // scorer returns nothing for three — `teaching`, «مطور», «مطورين» — because
  // no single tool contains the word. The offer used to render only in the
  // has-results branch, so the query that most needed the family got an empty
  // page on a site with fourteen tools for teachers.
  await page.goto('/en')
  await page.getByRole('searchbox').fill('teaching')
  await expect(page.locator('[data-testid^="tool-"]')).toHaveCount(0)
  const offer = page.getByTestId('category-offer')
  await expect(offer).toBeVisible()
  await offer.click()
  await expect(page).toHaveURL(/\/en\/c\/teaching\/$/)
})

test('the same in Arabic, where the dead family query is «مطور»', async ({ page }) => {
  await page.goto('/ar')
  await page.getByRole('searchbox').fill('مطور')
  await expect(page.locator('[data-testid^="tool-"]')).toHaveCount(0)
  await expect(page.getByTestId('category-offer')).toHaveAttribute('data-category', 'developer')
})

test('the launcher does the same, because the two surfaces must match', async ({ page }) => {
  await page.goto('/ar/apps/qr-code')
  await page.getByTestId('app-launcher').click()
  await page.getByTestId('launcher-search').fill('teaching')
  await expect(page.getByTestId('category-offer')).toBeVisible()
})

test('a query that matches nothing AND names nothing stays empty', async ({ page }) => {
  // Without this, the fix above could have been "always show something", which
  // is the adware move this repo names explicitly.
  await page.goto('/en')
  await page.getByRole('searchbox').fill('zzzzqqqq')
  await expect(page.getByTestId('category-offer')).toHaveCount(0)
  await expect(page.locator('[data-testid^="tool-"]')).toHaveCount(0)
})

test('the split groups appear on the home catalogue', async ({ page }) => {
  await page.goto('/en')
  await expect(page.getByTestId('section-Health')).toBeVisible()
  await expect(page.getByTestId('section-Time & Date')).toBeVisible()
})

test('it works in Arabic', async ({ page }) => {
  await page.goto('/ar/c/time/')
  await expect(page.getByTestId('category-title')).toContainText('الوقت')
  await page.goto('/ar/c/health/')
  await expect(page.getByTestId('category-title')).toContainText('صحية')
})
