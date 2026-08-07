import { test, expect } from '@playwright/test'

// Dates relative to "now", so the spec does not rot on a fixed calendar.
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const shift = (years: number, days = 0) => {
  const d = new Date()
  d.setFullYear(d.getFullYear() + years)
  d.setDate(d.getDate() + days)
  return iso(d)
}

async function open(page: import('@playwright/test').Page, opts: { first: string; expiry: string; kind?: 'private' | 'public' }, locale = 'en') {
  await page.goto(`/${locale}/apps/vehicle-renewal`)
  await expect(page.getByTestId('vehicle-renewal')).toBeVisible()
  if (opts.kind === 'public') await page.getByTestId('vh-public').click()
  await page.getByTestId('vh-first').fill(opts.first)
  await page.getByTestId('vh-expiry').fill(opts.expiry)
}

test.describe('fahes and istimara due dates', () => {
  test('a new private car is exempt, and says paying early buys nothing', async ({ page }) => {
    await open(page, { first: shift(-1), expiry: shift(0, 60) })
    await expect(page.getByTestId('vh-exempt')).toBeVisible()
    await expect(page.getByTestId('vh-exempt')).toContainText('Exempt until')
    await expect(page.getByTestId('vh-inspection')).toHaveCount(0)
  })

  test('a taxi gets two years, not three', async ({ page }) => {
    // At two and a half years old: still exempt as a private car, due as a taxi.
    const first = shift(-2, -180)
    await open(page, { first, expiry: shift(0, 60) })
    await expect(page.getByTestId('vh-exempt')).toBeVisible()
    await page.getByTestId('vh-public').click()
    await expect(page.getByTestId('vh-exempt')).toHaveCount(0)
    await expect(page.getByTestId('vh-inspection')).toBeVisible()
  })

  test('the exemption ends on the third anniversary, to the day', async ({ page }) => {
    // The date the first inspection falls due, and the one nobody has a
    // reminder for. A day either side of it changes the answer.
    await open(page, { first: shift(-3, 2), expiry: shift(0, 60) })
    await expect(page.getByTestId('vh-exempt')).toBeVisible()
    await page.getByTestId('vh-first').fill(shift(-3, -2))
    await expect(page.getByTestId('vh-exempt')).toHaveCount(0)
    await expect(page.getByTestId('vh-inspection')).toBeVisible()
  })

  test('an overdue inspection blocks a renewable registration, and says so first', async ({ page }) => {
    // Past the exemption, last inspected 13 months ago, registration expiring
    // inside its window: renewable on paper, refused at the counter.
    await open(page, { first: shift(-5), expiry: shift(0, 20) })
    await page.getByTestId('vh-last').fill(shift(-1, -30))
    const blocked = page.getByTestId('vh-blocked')
    await expect(blocked).toBeVisible()
    await expect(blocked).toContainText('Inspection first')
    await expect(page.getByTestId('vh-inspection')).toContainText('Overdue')
  })

  test('a vehicle past its exemption with nothing on record is due now', async ({ page }) => {
    await open(page, { first: shift(-5), expiry: shift(0, 200) })
    await expect(page.getByTestId('vh-inspection')).toContainText('Overdue')
  })

  test('a recent inspection pushes the next one a year out', async ({ page }) => {
    await open(page, { first: shift(-5), expiry: shift(0, 200) })
    await page.getByTestId('vh-last').fill(shift(0, -30))
    const insp = page.getByTestId('vh-inspection')
    await expect(insp).toContainText('Next due')
    await expect(insp).not.toContainText('Overdue')
  })

  test('the renewal window opens 180 days before expiry, and not before', async ({ page }) => {
    await open(page, { first: shift(-1), expiry: shift(0, 200) })
    await expect(page.getByTestId('vh-window')).toContainText('Not yet renewable')
    await page.getByTestId('vh-expiry').fill(shift(0, 100))
    await expect(page.getByTestId('vh-window')).toContainText('You can renew now')
  })

  test('an expired registration is reported as expired, not as a countdown', async ({ page }) => {
    await open(page, { first: shift(-1), expiry: shift(0, -10) })
    await expect(page.getByTestId('vh-registration')).toContainText('Expired')
  })

  test('every date carries its Hijri equivalent, because the card may be either', async ({ page }) => {
    await open(page, { first: shift(-1), expiry: shift(0, 60) })
    await expect(page.getByTestId('vh-registration')).toContainText('Hijri')
    await expect(page.getByTestId('vh-exempt')).toContainText('Hijri')
  })

  test('it carries an official disclaimer, and admits what it cannot see', async ({ page }) => {
    await open(page, { first: shift(-1), expiry: shift(0, 60) })
    const d = page.getByTestId('disclaimer')
    await expect(d).toHaveAttribute('data-kind', 'official')
    // Fines can block a renewal for reasons no date arithmetic can know.
    await expect(d).toContainText('fines')
  })

  test('it works in Arabic', async ({ page }) => {
    await open(page, { first: shift(-1), expiry: shift(0, 60) }, 'ar')
    await expect(page.getByTestId('vh-exempt')).toContainText('معفاة حتى')
  })
})
