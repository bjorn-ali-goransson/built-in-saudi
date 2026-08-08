import { test, expect } from '@playwright/test'

// The catalogue's jump bar. Measured before building it: the home page is 7.4
// screens on desktop and 9.6 on a phone, with sixteen section headings and no
// way to reach one but scrolling. These cases hold the fix in place.

test.describe('catalogue section nav', () => {
  test('jumps from the very bottom, and lands clear of the sticky bars', async ({ page }) => {
    await page.goto('/en')
    // The bottom is the worst case: a jump list you must scroll to the top to
    // use has saved nobody anything, which is why this does not start at 0.
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
    await expect(page.getByTestId('section-nav')).toBeVisible()

    await page.getByTestId('section-nav-Design').click()
    const head = page.getByTestId('section-Design')
    await expect(head).toBeInViewport()
    // Not merely "in the viewport" — not underneath the header + the bar.
    await expect.poll(async () => Math.round((await head.boundingBox())!.y)).toBeGreaterThan(100)
  })

  test('the active chip follows the scroll, not only the click', async ({ page }) => {
    await page.goto('/en')
    await expect(page.getByTestId('section-nav-__rec')).toHaveAttribute('aria-current', 'true')
    // Scroll there by hand: "you are here" is the half that separates this from
    // a row of links, and it has to survive being scrolled past.
    await page.getByTestId('section-PDF').scrollIntoViewIfNeeded()
    await page.mouse.wheel(0, 200)
    await expect(page.getByTestId('section-nav-PDF')).toHaveAttribute('aria-current', 'true')
    await expect(page.getByTestId('section-nav-__rec')).not.toHaveAttribute('aria-current', 'true')
  })

  test('is not rendered over search results', async ({ page }) => {
    // Results are one flat grid — there is nothing to jump between, and a bar
    // of catalogue sections above them would point at rows that are not there.
    await page.goto('/en')
    await page.getByRole('searchbox').fill('pdf merge')
    await expect(page.getByTestId('section-nav')).toHaveCount(0)
    await page.getByRole('searchbox').fill('')
    await expect(page.getByTestId('section-nav')).toBeVisible()
  })

  test('works inside the launcher, which scrolls itself and not the window', async ({ page }) => {
    // The case most likely to break silently: the overlay is its own scroll
    // container, so a window-based jump would do nothing at all here.
    await page.goto('/en/apps/qr-code')
    await page.getByTestId('app-launcher').click()
    await expect(page.getByTestId('section-nav')).toBeVisible()
    const y = () => page.evaluate(() => {
      const el = document.querySelector('[data-testid="section-nav"]')!.parentElement!
      return el.scrollTop
    })
    expect(await y()).toBe(0)
    await page.getByTestId('section-nav-Design').click()
    await expect.poll(y).toBeGreaterThan(200)
    await expect(page.getByTestId('section-Design')).toBeInViewport()
  })

  test('the page never scrolls sideways because of it', async ({ page }) => {
    // The bar scrolls horizontally; the page must not. That is the trade a
    // full-bleed bar out of a padded container gets wrong.
    for (const size of [{ width: 390, height: 844 }, { width: 1280, height: 900 }]) {
      await page.setViewportSize(size)
      await page.goto('/en')
      const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
      expect(over).toBeLessThanOrEqual(0)
    }
  })

  test('Arabic renders it and jumps too', async ({ page }) => {
    await page.goto('/ar')
    await expect(page.getByTestId('section-nav')).toBeVisible()
    await page.getByTestId('section-nav-PDF').click()
    await expect(page.getByTestId('section-PDF')).toBeInViewport()
  })
})
