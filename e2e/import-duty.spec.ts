import { test, expect } from '@playwright/test'
import { readNumber } from './helpers'

// Import duty and VAT on a parcel from abroad.
//
// Found by sweeping an untried vertical: what people calculate when buying
// online from outside the country. The category exists elsewhere; what the
// incumbents do not say is that "under SAR 1,000 is duty-free" is true and
// "nothing to pay" is not — the 15% VAT applies at any value.
//
// Figures corroborated across two independent customs guides before being
// encoded: 5% on CIF for most goods, 0% for books/medicines/basic food/GCC,
// ~20% protected, 100% tobacco, SAR 1,000 personal exemption from DUTY only,
// and VAT charged on the landed value INCLUDING the duty.

const load = async (page: import('@playwright/test').Page, locale = 'en') => {
  await page.goto(`/${locale}/apps/import-duty`)
  await expect(page.getByTestId('import-duty')).toBeVisible()
}

const set = async (page: import('@playwright/test').Page, id: string, v: string) => {
  await page.getByTestId(id).fill(v)
}

const parcel = async (page: import('@playwright/test').Page, goods: string, shipping = '0') => {
  await set(page, 'id-goods', goods)
  await set(page, 'id-shipping', shipping)
  await set(page, 'id-insurance', '0')
}

test('a "duty-free" parcel still owes the VAT — the whole point', async ({ page }) => {
  await load(page)
  await parcel(page, '300')
  expect(await readNumber(page, 'id-duty')).toBe(0)
  // 15% of 300.
  expect(await readNumber(page, 'id-vat')).toBe(45)
  expect(await readNumber(page, 'id-charges')).toBe(45)
  await expect(page.getByTestId('id-waived')).toBeVisible()
  await expect(page.getByTestId('id-myth')).toContainText('nothing to pay')
})

test('postage pushes a parcel over the line', async ({ page }) => {
  // Customs values at CIF, so a SAR 950 item with SAR 100 postage is a
  // SAR 1,050 shipment — and the duty falls on the whole 1,050.
  await load(page)
  await parcel(page, '950', '40')
  expect(await readNumber(page, 'id-duty')).toBe(0)
  await set(page, 'id-shipping', '100')
  expect(await readNumber(page, 'id-cif')).toBe(1050)
  // 5% of the WHOLE 1,050, not of the 50 above the line.
  expect(await readNumber(page, 'id-duty')).toBe(52.5)
  await expect(page.getByTestId('id-waived')).toHaveCount(0)
})

test('the two rates do not add up to 20%', async ({ page }) => {
  // VAT is charged on the landed value including duty, so 5% + 15% is 20.75%.
  await load(page)
  await parcel(page, '5000', '200')
  const eff = await readNumber(page, 'id-effective')
  expect(eff).toBeGreaterThan(20.7)
  expect(eff).toBeLessThan(20.8)
  await expect(page.getByTestId('id-compound')).toContainText('20.75')
})

test('under the line the effective rate is exactly the VAT', async ({ page }) => {
  // Without this, the 20.75% case could pass against a tool that always
  // charged duty.
  await load(page)
  await parcel(page, '500')
  expect(await readNumber(page, 'id-effective')).toBe(15)
})

test('a commercial shipment gets no exemption', async ({ page }) => {
  await load(page)
  await parcel(page, '300')
  expect(await readNumber(page, 'id-duty')).toBe(0)
  await page.getByTestId('id-personal').uncheck()
  expect(await readNumber(page, 'id-duty')).toBe(15)
  expect(await readNumber(page, 'id-effective')).toBeCloseTo(20.75, 1)
})

test('a zero-rated parcel pays VAT and nothing else, at any value', async ({ page }) => {
  await load(page)
  await parcel(page, '2000')
  await page.getByTestId('id-band').selectOption('zero')
  expect(await readNumber(page, 'id-duty')).toBe(0)
  expect(await readNumber(page, 'id-vat')).toBe(300)
  expect(await readNumber(page, 'id-effective')).toBe(15)
})

test('tobacco is 100%, which the bands have to be able to express', async ({ page }) => {
  await load(page)
  await parcel(page, '1000', '100')
  await page.getByTestId('id-band').selectOption('tobacco')
  expect(await readNumber(page, 'id-duty')).toBe(1100)
})

test('the cliff is shown in money, and only when there is duty to owe', async ({ page }) => {
  await load(page)
  await parcel(page, '900', '120')
  await expect(page.getByTestId('id-cliff')).toBeVisible()
  await page.getByTestId('id-band').selectOption('zero')
  // Nothing to fall off when the rate is zero.
  await expect(page.getByTestId('id-cliff')).toHaveCount(0)
})

test('the shipping note says which side of the line the parcel is on', async ({ page }) => {
  await load(page)
  await parcel(page, '900', '120')
  await expect(page.getByTestId('id-shipping-note')).toContainText('over the line')
  await set(page, 'id-shipping', '10')
  await expect(page.getByTestId('id-shipping-note')).toContainText('under the line')
})

test('the number it REFUSES to compute is named', async ({ page }) => {
  // The carrier's own clearance fee differs by company and by shipment;
  // guessing would put a number on the page nobody could check.
  await load(page)
  await expect(page.getByTestId('id-carrier')).toContainText('carrier')
})

test('it works in Arabic, with Arabic-Indic digits', async ({ page }) => {
  await load(page, 'ar')
  await parcel(page, '300')
  const t = await page.getByTestId('id-charges').textContent()
  expect(t).toMatch(/[٠-٩]/)
  expect(t).not.toMatch(/[0-9]/)
  expect(await readNumber(page, 'id-charges')).toBe(45)
})
