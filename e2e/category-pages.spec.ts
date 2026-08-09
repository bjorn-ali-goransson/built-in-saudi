import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'

// Category landing pages, at /<locale>/c/<slug>/.
//
// Measured before building them: a category was an in-page jump on the home
// catalogue and nothing else — not linkable, not shareable, and with no page
// for a search engine to land on. "Free PDF tools" is the shape of query people
// type, and the only page answering it was home, which lists all 207 tools and
// is therefore about nothing in particular.

const SLUGS = ['pdf', 'images', 'saudi', 'islamic', 'arabic', 'calculators', 'text',
  'converters', 'developer', 'files', 'generators', 'design', 'web', 'business', 'communication']

test('every category is prerendered in both locales with its OWN description', async () => {
  // Not through the browser: this is about the static HTML a crawler is served
  // before any JavaScript runs. A page whose description is the site default is
  // the exact silent failure the tool-registry check exists to catch.
  const seen = new Set<string>()
  for (const slug of SLUGS) {
    for (const locale of ['en', 'ar']) {
      const html = readFileSync(`dist/${locale}/c/${slug}/index.html`, 'utf8')
      // Whitespace-tolerant on purpose: index.html wraps some head tags
      // across lines, and a naive single-line regex is exactly how the
      // default description once survived on every page unnoticed.
      const desc = /<meta\s+name="description"\s+content="([^"]*)"/.exec(html)?.[1] ?? ''
      expect(desc, `${locale}/${slug}`).not.toBe('')
      expect(desc, `${locale}/${slug} is using the site default`).not.toContain('A growing toolbox')
      expect(seen.has(desc), `${locale}/${slug} duplicates another category`).toBe(false)
      seen.add(desc)
      // Canonical and the crawlable block must both use the trailing-slash form.
      expect(html).toContain(`href="https://built-in-saudi.com/${locale}/c/${slug}/"`)
      expect(html).toContain('<h1>')
    }
  }
})

test('the prerendered page lists its own tools and links every other category', async () => {
  const html = readFileSync('dist/en/c/pdf/index.html', 'utf8')
  expect(html).toContain('/en/apps/pdf-merge/')
  expect(html).toContain('/en/apps/pdf-split/')
  // Not a tool from another category.
  expect(html).not.toContain('/en/apps/qibla/')
  // Fifteen pages that each link only back to home are fifteen leaves.
  for (const slug of SLUGS.filter((s) => s !== 'pdf')) {
    expect(html, `pdf page should link /c/${slug}/`).toContain(`/en/c/${slug}/`)
  }
})

test('every category URL is in the sitemap, with a trailing slash', async () => {
  const xml = readFileSync('public/sitemap.xml', 'utf8')
  for (const slug of SLUGS) {
    for (const locale of ['en', 'ar']) {
      expect(xml).toContain(`<loc>https://built-in-saudi.com/${locale}/c/${slug}/</loc>`)
    }
  }
})

test('the page renders and holds only that category', async ({ page }) => {
  await page.goto('/en/c/pdf')
  await expect(page.getByTestId('category-page')).toHaveAttribute('data-category', 'PDF')
  await expect(page.getByTestId('category-title')).toContainText('PDF')
  await expect(page.getByTestId('tool-pdf-merge')).toBeVisible()
  await expect(page.getByTestId('tool-qibla')).toHaveCount(0)
  const count = Number((await page.getByTestId('category-count').textContent())!.replace(/\D/g, ''))
  expect(count).toBeGreaterThan(5)
})

test('a section heading on the catalogue goes to its category page', async ({ page }) => {
  // The heading was a plain div, so the only way into a category was to scroll
  // to it and stay there.
  await page.goto('/en')
  await page.getByTestId('section-head-PDF').click()
  await expect(page).toHaveURL(/\/en\/c\/pdf$/)
  await expect(page.getByTestId('category-page')).toBeVisible()
})

test('a curated section has no category page and therefore no link', async ({ page }) => {
  // Recommended and Duʿāʾ are hand-picked lists that cut across the categories;
  // a URL for one would be a URL nobody could keep meaningful.
  await page.goto('/en')
  await expect(page.getByTestId('section-head-__rec')).toHaveCount(0)
  await expect(page.getByTestId('section-__rec')).toBeVisible()
})

test('an unknown slug is a 404, not an empty category', async ({ page }) => {
  await page.goto('/en/c/not-a-category')
  await expect(page.getByTestId('category-page')).toHaveCount(0)
  await expect(page.getByTestId('not-found')).toBeVisible()
})

test('Arabic gets its own page, in Arabic', async ({ page }) => {
  await page.goto('/ar/c/islamic')
  await expect(page.getByTestId('category-title')).toContainText('إسلامية')
  await expect(page.getByTestId('tool-qibla')).toBeVisible()
  await page.getByTestId('category-link-pdf').click()
  await expect(page).toHaveURL(/\/ar\/c\/pdf$/)
})
