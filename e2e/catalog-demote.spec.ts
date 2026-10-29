import { test, expect } from '@playwright/test'

// The catalogue demotes the tools its own analytics say almost nobody opens
// (lib/toolSections `demote`, counts in tools/popularity.ts). The property that
// matters is that a demoted tool is ONE TAP away rather than gone — and that
// search, which is how most people reach a tool they can name, is untouched.
// Which tools are demoted is pinned by src/lib/toolSections.test.ts; these
// cases drive one that the counts put there, and would need a new example if
// a future regeneration lifted it.

const DEMOTED = 'robots-txt' // 0 views Aug–Oct 2026, filed under Web

test('a demoted tool waits behind its section\'s "more", and the button brings it back', async ({ page }) => {
  await page.goto('/en')
  const web = page.getByTestId('section-Web')
  await expect(web).toBeVisible()
  await expect(web.getByTestId(`tool-${DEMOTED}`)).toHaveCount(0)
  const more = page.getByTestId('section-more-Web')
  await expect(more).toHaveText(/^\d+ more$/)
  await expect(more).toHaveAttribute('aria-expanded', 'false')
  await more.click()
  await expect(web.getByTestId(`tool-${DEMOTED}`)).toBeVisible()
  await expect(more).toHaveAttribute('aria-expanded', 'true')
  await web.getByTestId(`tool-${DEMOTED}`).click()
  await expect(page).toHaveURL(new RegExp(`/en/apps/${DEMOTED}/?$`))
})

test('the button speaks Arabic, with Arabic digits, on the Arabic side', async ({ page }) => {
  await page.goto('/ar')
  await expect(page.getByTestId('section-more-Web')).toHaveText(/^[٠-٩]+ أخرى$/)
})

test('search still finds a demoted tool by name, first', async ({ page }) => {
  await page.goto('/en')
  await page.locator('.tool-search__input').fill('robots.txt generator')
  await expect(page.getByTestId('result-active').getByTestId(`tool-${DEMOTED}`)).toBeVisible()
})

test('popular tools lead their section', async ({ page }) => {
  await page.goto('/en')
  // Saudi / Local leads with the most-opened tool in it, ahead of catalogue order.
  const first = page.getByTestId('section-Saudi / Local').locator('[data-testid^="tool-"]').first()
  await expect(first).toHaveAttribute('data-testid', 'tool-saudi-plate')
})

test('the launcher shows the same demotion as home, because it is the same sections', async ({ page }) => {
  await page.goto('/en/apps/qr-code')
  await page.keyboard.press('Control+k')
  const more = page.getByTestId('section-more-Web')
  await expect(more).toBeVisible()
  await more.click()
  await expect(page.getByTestId('section-Web').getByTestId(`tool-${DEMOTED}`)).toBeVisible()
})
