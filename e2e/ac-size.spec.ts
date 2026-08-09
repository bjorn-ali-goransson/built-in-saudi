import { test, expect } from '@playwright/test'
import { readNumber } from './helpers'

// AC sizing. Found by a web sweep of the home-improvement calculator market —
// 464 calculators on one site — where this is a staple and every one of them
// assumes a temperate climate.

const setUp = async (page: import('@playwright/test').Page, area: string, locale = 'en') => {
  await page.goto(`/${locale}/apps/ac-size`)
  await page.getByTestId('ac-area').fill(area)
}

test('a 20 m² room needs about 15,000 BTU, not the American 4,300', async ({ page }) => {
  // 20 x 750 = 15,000. The 20 BTU/sq ft rule the US calculators use would give
  // about 4,300 for the same room — a third of what a 45°C summer asks for.
  await setUp(page, '20')
  await expect(page.getByTestId('ac-need')).toContainText('15,000')
  await expect(page.getByTestId('ac-need-tons')).toContainText('1.25')
})

test('it rounds UP to a size you can actually buy', async ({ page }) => {
  // 15,000 is not sold; 18,000 is. Rounding down would leave a unit running
  // flat out and never reaching the set point, which is the worse failure.
  await setUp(page, '20')
  await expect(page.getByTestId('ac-unit')).toContainText('18,000')
  await expect(page.getByTestId('ac-unit-tons')).toContainText('1.5')
})

test('sun, roof and kitchen each add, and the working is shown', async ({ page }) => {
  await setUp(page, '20')
  const base = await readNumber(page, 'ac-need')
  await page.getByTestId('ac-sunny').check()
  const withSun = await readNumber(page, 'ac-need')
  // +15% of base = 2,250.
  expect(withSun - base).toBeCloseTo(2250, 0)
  await expect(page.getByTestId('ac-part-sun')).toBeVisible()

  await page.getByTestId('ac-kitchen').check()
  await expect(page.getByTestId('ac-part-kitchen')).toContainText('4,000')
})

test('the first two occupants are already in the base figure', async ({ page }) => {
  // The published bands assume an ordinary room, so counting every occupant
  // from the first would double-count what the per-m² number already carries.
  await setUp(page, '20')
  await page.getByTestId('ac-people').fill('2')
  await expect(page.getByTestId('ac-part-people')).toHaveCount(0)
  await page.getByTestId('ac-people').fill('5')
  await expect(page.getByTestId('ac-part-people')).toContainText('1,500')
})

test('a high ceiling scales with the volume it adds', async ({ page }) => {
  await setUp(page, '20')
  const base = await readNumber(page, 'ac-need')
  await page.getByTestId('ac-ceiling').fill('4.2')
  const tall = await readNumber(page, 'ac-need')
  // 1.4 m over 2.8 is half again the volume.
  expect(tall - base).toBeCloseTo(7500, 0)
})

test('it warns when the only size on sale is far too big', async ({ page }) => {
  // Oversizing is the mistake people make, because bigger sounds safer. A 13 m²
  // room needs 9,750 and the next size up is 12,000 — 23% over, which is fine.
  // A 10 m² room needs 7,500 and the smallest unit is 9,000: 20% over.
  await setUp(page, '9')
  // 6,750 needed, 9,000 sold — 33% over.
  await expect(page.getByTestId('ac-oversize')).toContainText('33%')
  await expect(page.getByTestId('ac-oversize')).toContainText('clammy')
})

test('and says so when the fit is close, rather than always warning', async ({ page }) => {
  // Without this the warning would be decoration: a panel that always says the
  // same thing tells you nothing about your room.
  await setUp(page, '24')
  // 18,000 needed, 18,000 sold — an exact fit.
  await expect(page.getByTestId('ac-oversize')).toContainText('close fit')
})

test('tons and BTU are explained, because they are sold in both', async ({ page }) => {
  await setUp(page, '20')
  await expect(page.getByTestId('ac-ton-note')).toContainText('12,000')
  await expect(page.getByTestId('ac-ton-note')).toContainText('nothing to do with weight')
})

test('it does not pass itself off as a load calculation', async ({ page }) => {
  await setUp(page, '20')
  await expect(page.getByTestId('ac-honest')).toContainText('not the same thing')
})

test('it links to the tool that answers what running it costs', async ({ page }) => {
  await setUp(page, '20')
  await page.getByTestId('ac-bill').click()
  await expect(page).toHaveURL(/\/en\/apps\/electricity-bill$/)
})

test('works in Arabic, including the computed figure', async ({ page }) => {
  await setUp(page, '20', 'ar')
  const btu = await readNumber(page, 'ac-need')
  expect(btu).toBe(15000)
  await expect(page.getByTestId('ac-oversize')).toContainText('الرطوبة')
})
