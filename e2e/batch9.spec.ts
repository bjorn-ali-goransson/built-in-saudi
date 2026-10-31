import { test, expect } from '@playwright/test'

// Pin the browser zone: these planners render on the device clock, so the exact
// times below only hold for a known zone (the lesson from batch 7).
test.use({ timezoneId: 'UTC' })

test.describe('hijri age', () => {
  test('gives both ages, with the Hijri one ahead', async ({ page }) => {
    await page.goto('/en/apps/hijri-age')
    await page.getByTestId('ha-date').fill('1990-01-01')
    const hijri = Number(await page.getByTestId('ha-hijri').textContent())
    const greg = Number(await page.getByTestId('ha-greg').textContent())
    expect(greg).toBeGreaterThan(30)
    // ~1 extra Hijri year per 33 Gregorian ones.
    expect(hijri).toBeGreaterThan(greg)
    expect(hijri - greg).toBeLessThan(3)
  })

  test('accepts a Hijri date of birth', async ({ page }) => {
    await page.goto('/en/apps/hijri-age')
    await page.getByTestId('ha-cal-hijri').click()
    await page.getByTestId('ha-h-year').fill('1410')
    await expect(page.getByTestId('ha-hijri')).toHaveText(/^3[0-9]$/)
    await expect(page.getByTestId('ha-born')).toContainText(/19(89|90)/)
  })

  test('reports days lived and the next Hijri birthday', async ({ page }) => {
    await page.goto('/en/apps/hijri-age')
    await page.getByTestId('ha-date').fill('2000-06-15')
    const days = Number((await page.getByTestId('ha-days').textContent())!.replace(/,/g, ''))
    expect(days).toBeGreaterThan(9000)
    await expect(page.getByTestId('ha-next')).toBeVisible()
  })

  test('a future date of birth is refused', async ({ page }) => {
    await page.goto('/en/apps/hijri-age')
    await page.getByTestId('ha-date').fill('2099-01-01')
    await expect(page.getByTestId('ha-future')).toBeVisible()
  })
})
