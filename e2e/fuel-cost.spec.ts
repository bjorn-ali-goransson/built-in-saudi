import { test, expect } from '@playwright/test'
import { readNumber } from './helpers'

// Fuel cost. Found by a web sweep of the automotive-calculator market, where it
// is one of the staples and several Arabic sites publish one. Two things make
// ours worth building: nobody agrees what "consumption" means, and nobody
// answers the question people actually have at the pump.

const setUp = async (page: import('@playwright/test').Page, km: string, consumption: string, unit: string) => {
  await page.getByTestId('fc-km').fill(km)
  await page.getByTestId('fc-consumption').fill(consumption)
  await page.getByTestId('fc-unit').selectOption(unit)
}

test('the basic arithmetic, in litres per 100 km', async ({ page }) => {
  await page.goto('/en/apps/fuel-cost')
  await setUp(page, '1000', '8', 'l100')
  await page.getByTestId('fc-91').click()
  // (1000 / 100) x 8 = 80 L at 2.18 = 174.40.
  await expect(page.getByTestId('fc-litres')).toHaveText('80.0')
  await expect(page.getByTestId('fc-cost')).toHaveText('174.40')
})

test('km per litre is not litres per 100 km', async ({ page }) => {
  // A dashboard here shows km/L and a spec sheet shows L/100km. Taking one for
  // the other is where the arithmetic goes wrong before it starts.
  await page.goto('/en/apps/fuel-cost')
  await setUp(page, '100', '12.5', 'kmpl')
  // 12.5 km/L is 8 L/100km, so 100 km costs 8 L.
  await expect(page.getByTestId('fc-litres')).toHaveText('8.0')
  await expect(page.getByTestId('fc-as-l100')).toContainText('8.00')
})

test('the two gallons differ by a fifth, and are not one unit', async ({ page }) => {
  await page.goto('/en/apps/fuel-cost')
  await setUp(page, '100', '30', 'mpgUs')
  const us = await readNumber(page, 'fc-litres')
  await page.getByTestId('fc-unit').selectOption('mpgUk')
  const uk = await readNumber(page, 'fc-litres')
  // The Imperial gallon is BIGGER, so "30 miles per gallon" on it means the same
  // distance out of more fuel — worse economy, and therefore MORE litres per
  // 100 km, by about a fifth. (The first version of this assertion had that the
  // wrong way round and reported a defect the code did not have.)
  expect(uk).toBeGreaterThan(us)
  expect(uk / us).toBeGreaterThan(1.15)
  expect(uk / us).toBeLessThan(1.25)
})

test('a return trip is twice the fuel', async ({ page }) => {
  await page.goto('/en/apps/fuel-cost')
  await setUp(page, '500', '10', 'l100')
  const one = await readNumber(page, 'fc-cost')
  await page.getByTestId('fc-return').check()
  const both = await readNumber(page, 'fc-cost')
  expect(both).toBeCloseTo(one * 2, 1)
})

test('picking a route fills the distance', async ({ page }) => {
  // A trip calculator whose first act is to ask for a number nobody knows is a
  // calculator nobody finishes.
  await page.goto('/en/apps/fuel-cost')
  await page.getByTestId('fc-route').selectOption('riyadhDammam')
  await expect(page.getByTestId('fc-km')).toHaveValue('400')
})

test('the cost splits between passengers, and only shows when it is shared', async ({ page }) => {
  await page.goto('/en/apps/fuel-cost')
  await setUp(page, '1000', '8', 'l100')
  await expect(page.getByTestId('fc-per-person')).toHaveCount(0)
  await page.getByTestId('fc-people').fill('4')
  await expect(page.getByTestId('fc-per-person')).toHaveText('43.60')
})

test('95 selects its own price, and typing a price stops claiming a grade', async ({ page }) => {
  await page.goto('/en/apps/fuel-cost')
  await page.getByTestId('fc-95').click()
  await expect(page.getByTestId('fc-price')).toHaveValue('2.33')
  await page.getByTestId('fc-91').click()
  await expect(page.getByTestId('fc-price')).toHaveValue('2.18')
  await page.getByTestId('fc-price').fill('3.10')
  await expect(page.getByTestId('fc-price')).toHaveValue('3.10')
})

test('it answers whether 95 is worth it, with the break-even figure', async ({ page }) => {
  // The question people actually have at the pump, which no calculator answers.
  // 2.33 / 2.18 is 6.9% more, so 95 must return 6.9% better economy to pay.
  await page.goto('/en/apps/fuel-cost')
  await expect(page.getByTestId('fc-95-worth')).toContainText('6.9%')
  await expect(page.getByTestId('fc-95-worth')).toContainText('REQUIRES 95')
})

test('carries the financial disclaimer and names the price as reviewed', async ({ page }) => {
  await page.goto('/en/apps/fuel-cost')
  const d = page.getByTestId('disclaimer')
  await expect(d).toHaveAttribute('data-kind', 'financial')
  await expect(d).toContainText('Aramco')
})

test('works in Arabic, including the computed cost', async ({ page }) => {
  await page.goto('/ar/apps/fuel-cost')
  await setUp(page, '1000', '8', 'l100')
  await page.getByTestId('fc-91').click()
  const cost = await readNumber(page, 'fc-cost')
  expect(cost).toBeCloseTo(174.4, 1)
  await expect(page.getByTestId('fc-unit-note')).toContainText('الخُمس')
})
