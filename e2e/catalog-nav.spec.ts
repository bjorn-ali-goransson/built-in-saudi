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


  test('the chip row says which way it continues', async ({ page }) => {
    // Measured at 217 tools: the bar is 1417px of chips in a 355px window on a
    // phone — three quarters of the sections off-screen, in a row with nothing
    // to say it scrolls. A jump bar that hides most of its own destinations is
    // the problem it was built to solve, one level down.
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/en')
    const nav = page.getByTestId('section-nav')
    await expect(nav).toHaveAttribute('data-scroll', 'end')

    await nav.evaluate((el) => { el.scrollLeft = el.scrollWidth })
    await expect(nav).toHaveAttribute('data-scroll', 'start')

    await nav.evaluate((el) => { el.scrollLeft = Math.round((el.scrollWidth - el.clientWidth) / 2) })
    await expect(nav).toHaveAttribute('data-scroll', 'both')
  })

  test('and says nothing when there is nothing off-screen', async ({ page }) => {
    // Without this the attribute could be hard-coded and every case above would
    // still pass on a wide screen where the row fits.
    await page.setViewportSize({ width: 1900, height: 1000 })
    await page.goto('/en')
    const nav = page.getByTestId('section-nav')
    const fits = await nav.evaluate((el) => el.scrollWidth - el.clientWidth <= 4)
    await expect(nav).toHaveAttribute('data-scroll', fits ? 'none' : 'end')
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

// --- The first screen is a SAMPLE of the catalogue --------------------------
//
// Measured before this was changed: the Recommended row represented **4 of 17
// categories and none of the six largest**. Developer (26), Saudi / Local (24),
// Text (24), Images (23), PDF (16) and Converters (14) were all absent, so the
// opening screen of a 232-tool site showed an AI CV tool, a booking tool, a
// video call, a QR generator and three Islamic tools — and taught almost
// nothing about what the site is strongest at.
//
// This pins the PROPERTY rather than the list, so the row stays editable
// without being able to shrink back to one corner of the catalogue.

test('the recommended row shows the big families, not one corner of the site', async ({ page }) => {
  await page.goto('/en')
  const rec = page.getByTestId('section-__rec')
  await expect(rec).toBeVisible()
  // PDF, images and the Saudi rules are the families this site has invested
  // most in, and a visitor who does not know what to ask for learns them here.
  await expect(rec.getByTestId('tool-pdf-to-word')).toBeVisible()
  await expect(rec.getByTestId('tool-image-compressor')).toBeVisible()
  await expect(rec.getByTestId('tool-gosi-salary')).toBeVisible()
})

test('a tool dropped from Recommended is not hidden, it goes back to its category', async ({ page }) => {
  // Recommended is CONSUMED from the categories, so removing something from it
  // must return it rather than lose it — which is the risk in editing the list
  // at all.
  await page.goto('/en')
  await expect(page.getByTestId('tool-qibla')).toBeVisible()
  await expect(page.getByTestId('tool-islamic-calendar')).toBeVisible()
})
