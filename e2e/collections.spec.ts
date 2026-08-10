import { test, expect } from '@playwright/test'
import { readFileSync, existsSync } from 'node:fs'

// Curated collections that cut ACROSS the categories.
//
// Measured with `node evals/tieprobe.mjs`: after the category offer shipped, 46
// single-word queries still tied three ways or wider and only NINE named a
// category. The widest of the rest are a season, an audience and a verb —
// «رمضان», «معلم», «مقارنة» — each picking tools out of four or five different
// categories, so no recategorising could ever reach them.
//
// They share the `/c/` route with the categories on purpose: a category and a
// collection are the same thing to a reader, so a second URL space would be two
// mental models for one idea.

const SLUGS = ['ramadan', 'teaching', 'compare'] as const

test('each collection has a page listing its curated tools', async ({ page }) => {
  for (const slug of SLUGS) {
    await page.goto(`/en/c/${slug}/`)
    await expect(page.getByTestId('category-page'), slug).toBeVisible()
    await expect(page.getByTestId('category-page')).toHaveAttribute('data-category', `collection:${slug}`)
    const n = await page.locator('[data-testid^="tool-"]').count()
    expect(n, `${slug} listed nothing`).toBeGreaterThan(3)
  }
})

test('the tools are in the CURATED order, not registry order', async ({ page }) => {
  // A `filter` over the registry would silently reimpose the catalogue's order
  // on a list that was written to read in a particular sequence.
  await page.goto('/en/c/compare/')
  const ids = await page.locator('[data-testid^="tool-"]')
    .evaluateAll((els) => els.map((e) => e.getAttribute('data-testid')!.replace('tool-', '')))
  expect(ids.slice(0, 4)).toEqual(['text-diff', 'json-diff', 'sheet-diff', 'image-diff'])
})

test('a collection pulls from several DIFFERENT categories', async ({ page }) => {
  // That is the whole reason it exists rather than being a filing mistake.
  await page.goto('/en/c/ramadan/')
  const ids = await page.locator('[data-testid^="tool-"]')
    .evaluateAll((els) => els.map((e) => e.getAttribute('data-testid')!.replace('tool-', '')))
  expect(ids).toContain('prayer-times')     // Islamic
  expect(ids).toContain('zakat-calculator') // a calculator
  expect(ids).toContain('timesheet')        // Saudi / Local
  expect(ids).toContain('water-intake')     // health
})

test('searching the collection word offers the collection', async ({ page }) => {
  for (const [q, slug] of [['ramadan', 'ramadan'], ['teacher', 'teaching'], ['compare', 'compare']] as const) {
    await page.goto('/en')
    await page.getByRole('searchbox').fill(q)
    const offer = page.getByTestId('category-offer')
    await expect(offer, q).toBeVisible()
    await expect(offer).toHaveAttribute('data-category', slug)
    await expect(offer).toHaveAttribute('data-kind', 'collection')
  }
})

test('the Arabic words that measured as wide ties now reach a group', async ({ page }) => {
  // «رمضان» was a 6-way tie answered with the Hijri calendar; «معلم» a 6-way
  // answered with a seating chart.
  for (const [q, slug] of [['رمضان', 'ramadan'], ['معلم', 'teaching'], ['مقارنة', 'compare']] as const) {
    await page.goto('/ar')
    await page.getByRole('searchbox').fill(q)
    await expect(page.getByTestId('category-offer'), q).toHaveAttribute('data-category', slug)
  }
})

test('a category name still beats a collection term', async ({ page }) => {
  // The categories are indexed first on purpose.
  await page.goto('/en')
  await page.getByRole('searchbox').fill('islamic')
  await expect(page.getByTestId('category-offer')).toHaveAttribute('data-kind', 'category')
})

test('the group pages are one graph — collections link to categories and back', async ({ page }) => {
  await page.goto('/en/c/ramadan/')
  await expect(page.getByTestId('category-link-islamic')).toBeVisible()
  await page.goto('/en/c/pdf/')
  await expect(page.getByTestId('category-link-ramadan')).toBeVisible()
})

test('an unknown slug is still a 404, not an empty group', async ({ page }) => {
  await page.goto('/en/c/not-a-real-group/')
  await expect(page.getByTestId('category-page')).toHaveCount(0)
})

test('the prerendered HTML carries its OWN description, not the site default', async ({ page }) => {
  // The failure `check-tool-registry` exists for, in a new place: a page with
  // no `seo.ts` entry keeps the DEFAULT description forever, and a search
  // engine treats every such page as the same page.
  void page
  const descs = new Set<string>()
  for (const slug of SLUGS) {
    for (const locale of ['en', 'ar']) {
      const file = `dist/${locale}/c/${slug}/index.html`
      expect(existsSync(file), `${file} was not prerendered`).toBe(true)
      const html = readFileSync(file, 'utf8')
      const m = /<meta\s+name="description"\s+content="([^"]+)"/.exec(html)
      expect(m, `${file} has no description`).toBeTruthy()
      descs.add(m![1])
      // And the crawlable block really lists the tools, not just the heading.
      expect(html, `${file} lists no tools`).toContain('/apps/')
    }
  }
  // Six pages, six distinct descriptions.
  expect(descs.size).toBe(SLUGS.length * 2)
})

test('it works in Arabic', async ({ page }) => {
  await page.goto('/ar/c/teaching/')
  await expect(page.getByTestId('category-title')).toContainText('المعلّمين')
  expect(await page.locator('[data-testid^="tool-"]').count()).toBeGreaterThan(3)
})
