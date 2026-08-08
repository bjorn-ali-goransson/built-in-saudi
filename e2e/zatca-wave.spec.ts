import { test, expect } from '@playwright/test'
import { readNumber } from './helpers'

async function open(page: import('@playwright/test').Page, r: Partial<Record<number, string>> = {}, locale = 'en') {
  await page.goto(`/${locale}/apps/zatca-wave`)
  await expect(page.getByTestId('zatca-wave')).toBeVisible()
  for (const y of [2022, 2023, 2024]) {
    await page.getByTestId(`zw-${y}`).fill(r[y] ?? '0')
  }
}

test.describe('which e-invoicing wave am I in', () => {
  test('the rule uses the HIGHEST of the three years, not the latest', async ({ page }) => {
    // The misconception the tool exists for. A good 2022 followed by two quiet
    // years still puts the business in scope.
    await open(page, { 2022: '500000', 2023: '90000', 2024: '80000' })
    expect(await readNumber(page, 'zw-basis')).toBe(500_000)
    await expect(page.getByTestId('zw-wave')).toHaveText('24')
  })

  test('a bigger business gets an EARLIER deadline', async ({ page }) => {
    // Counterintuitive, and the reason someone can hand themselves months they
    // do not have: the thresholds fall over time, so crossing a higher one puts
    // you in an earlier wave.
    await open(page, { 2023: '400000' })
    await expect(page.getByTestId('zw-wave')).toHaveText('24')
    const later = await page.getByTestId('zw-deadline').innerText()
    await page.getByTestId('zw-2023').fill('800000')
    await expect(page.getByTestId('zw-wave')).toHaveText('23')
    const earlier = await page.getByTestId('zw-deadline').innerText()
    expect(earlier).not.toBe(later)
    // March 2026 is before June 2026.
    expect(new Date(earlier).getTime()).toBeLessThan(new Date(later).getTime())
  })

  test('a large business still gets wave 23, with the earlier-wave caveat', async ({ page }) => {
    // The bug this caught: the first version treated wave 23's OWN threshold as
    // the top of the earlier waves, so a business at 800,000 — which wave 23
    // plainly covers — was told it belonged to an unnamed earlier wave and shown
    // no date at all. A caveat must not replace an answer the rule gives.
    await open(page, { 2024: '5000000' })
    await expect(page.getByTestId('zw-wave')).toHaveText('23')
    await expect(page.getByTestId('zw-earlier')).toBeVisible()
  })

  test('under every announced threshold it says "not yet", not "never"', async ({ page }) => {
    await open(page, { 2023: '100000' })
    await expect(page.getByTestId('zw-none')).toContainText('not yet')
    await expect(page.getByTestId('zw-wave')).toHaveCount(0)
  })

  test('it counts down to the deadline, and says when it has passed', async ({ page }) => {
    // Wave 23 closed on 31 March 2026, which is in the past.
    await open(page, { 2022: '900000' })
    await expect(page.getByTestId('zw-wave')).toHaveText('23')
    await expect(page.getByTestId('zw-countdown')).toContainText('overdue')
    // Wave 25 is 1 February 2027, still ahead.
    await open(page, { 2022: '200000' })
    await expect(page.getByTestId('zw-countdown')).toContainText('days left')
  })

  test('it says the ZATCA notice is the official trigger, not this page', async ({ page }) => {
    await open(page, { 2023: '400000' })
    await expect(page.getByTestId('zw-notice')).toContainText('six months')
    await expect(page.getByTestId('zw-notice')).toContainText('not the notice')
  })

  test('it carries a legal disclaimer that admits waves get added', async ({ page }) => {
    await open(page)
    const d = page.getByTestId('disclaimer')
    await expect(d).toHaveAttribute('data-kind', 'legal')
    await expect(d).toContainText('added over time')
  })

  test('it works in Arabic, numbers included', async ({ page }) => {
    await open(page, { 2022: '500000' }, 'ar')
    await expect(page.getByTestId('zw-any-year')).toContainText('أي سنة')
    expect(await readNumber(page, 'zw-basis')).toBe(500_000)
  })
})
