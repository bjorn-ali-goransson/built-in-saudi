import { test, expect } from '@playwright/test'

async function open(page: import('@playwright/test').Page, b = 'diff-b.png', locale = 'en') {
  await page.goto(`/${locale}/apps/image-diff`)
  await expect(page.getByTestId('image-diff')).toBeVisible()
  await page.getByTestId('idf-file-a').setInputFiles('e2e/fixtures/diff-a.png')
  await page.getByTestId('idf-file-b').setInputFiles(`e2e/fixtures/${b}`)
  await expect(page.getByTestId('idf-pct')).toBeVisible({ timeout: 15000 })
}

test.describe('compare images', () => {
  test('it reports the exact share of pixels that changed', async ({ page }) => {
    // The fixtures are built for this: 40x40 white against the same with a
    // 10x10 black corner. 100 of 1600 pixels = exactly 6.25%.
    await open(page)
    await expect(page.getByTestId('idf-pct')).toHaveText('6.25%')
    await expect(page.getByTestId('idf-counts')).toContainText('100')
    await expect(page.getByTestId('idf-counts')).toContainText('1,600')
  })

  test('identical images say so rather than showing an empty diff', async ({ page }) => {
    await open(page, 'diff-a.png')
    await expect(page.getByTestId('idf-pct')).toHaveText('0.00%')
    await expect(page.getByTestId('idf-identical')).toBeVisible()
  })

  test('different sizes compare the OVERLAP and say what was left out', async ({ page }) => {
    // The thing most tools fudge: scaling one to fit the other reports a
    // difference on every pixel, which is true and useless. 20x40 against
    // 40x40 leaves 800 pixels of the first image outside the comparison.
    await open(page, 'diff-small.png')
    const m = page.getByTestId('idf-mismatch')
    await expect(m).toBeVisible()
    await expect(m).toContainText('20 × 40')
    await expect(m).toContainText('800')
  })

  test('tolerance is adjustable and explained, not a hidden constant', async ({ page }) => {
    await open(page)
    await expect(page.getByTestId('idf-tolerance-why')).toContainText('rasteris')
    // Black against white is the maximum distance, so no tolerance hides it.
    await page.getByTestId('idf-tolerance').fill('30')
    await expect(page.getByTestId('idf-pct')).toHaveText('6.25%')
  })

  test('the three views are all reachable', async ({ page }) => {
    await open(page)
    await expect(page.getByTestId('idf-canvas')).toBeVisible()
    await page.getByTestId('idf-view-side').click()
    await expect(page.getByTestId('idf-side')).toBeVisible()
    await page.getByTestId('idf-view-slider').click()
    await expect(page.getByTestId('idf-slider')).toBeVisible()
  })

  test('one image alone is not a comparison', async ({ page }) => {
    await page.goto('/en/apps/image-diff')
    await page.getByTestId('idf-file-a').setInputFiles('e2e/fixtures/diff-a.png')
    await expect(page.getByTestId('idf-need-two')).toBeVisible()
    await expect(page.getByTestId('idf-pct')).toHaveCount(0)
  })

  test('it works in Arabic', async ({ page }) => {
    await open(page, 'diff-small.png', 'ar')
    await expect(page.getByTestId('idf-mismatch')).toContainText('المشتركة')
  })
})
