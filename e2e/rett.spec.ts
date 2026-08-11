import { test, expect, type Page } from '@playwright/test'
import { readNumber } from './helpers'

// Real Estate Transaction Tax.
//
// Found by a web sweep that turned up a direct competitor with our exact pitch
// — a Saudi calculator hub, client-side, 25+ calculators — and RETT is the
// ZATCA tax neither of us had. Every figure below was computed independently
// before the spec was written, not read off the running tool.

const load = async (page: Page, locale = 'en') => {
  await page.goto(`/${locale}/apps/rett`)
  await expect(page.getByTestId('rett')).toBeVisible()
}

const fill = async (page: Page, value: string, late = '0') => {
  await page.getByTestId('rt-value').fill(value)
  await page.getByTestId('rt-late').fill(late)
}

test('five per cent of the disposal, and nothing else', async ({ page }) => {
  await load(page)
  await fill(page, '2000000')
  // 2,000,000 x 5% = 100,000.
  expect(await readNumber(page, 'rt-tax')).toBe(100000)
  expect(await readNumber(page, 'rt-total')).toBe(100000)
})

test('the 15% VAT does not also apply, and the overstatement is named', async ({ page }) => {
  // The belief the tool exists to correct. RETT REPLACED VAT on real estate;
  // budgeting 5% + 15% on a two-million-riyal flat overstates it by 300,000.
  await load(page)
  await fill(page, '2000000')
  await expect(page.getByTestId('rt-vat')).toContainText('replaced')
  // `readNumber` is for a number standing alone; this one sits in a sentence
  // that also contains "5%" and "15%", so it would read 515300000.
  await expect(page.getByTestId('rt-vat-over')).toContainText('300,000')
})

test('the first-home relief TAPERS above the ceiling rather than cutting off', async ({ page }) => {
  // The opposite of the customs threshold, which is a cliff. A 1.5M first home
  // is not disqualified: the state bears 5% of the first 1,000,000 = 50,000,
  // and 5% of the remaining 500,000 = 25,000 is the buyer's.
  await load(page)
  await fill(page, '1500000')
  await page.getByTestId('rt-first-home').check()
  expect(await readNumber(page, 'rt-gross')).toBe(75000)
  expect(await readNumber(page, 'rt-relief')).toBe(50000)
  expect(await readNumber(page, 'rt-tax')).toBe(25000)
  await expect(page.getByTestId('rt-taper-now')).toBeVisible()
})

test('a first home under the ceiling is borne in full', async ({ page }) => {
  // Without this the taper case would pass against a tool that always charged
  // something.
  await load(page)
  await fill(page, '800000')
  await page.getByTestId('rt-first-home').check()
  expect(await readNumber(page, 'rt-tax')).toBe(0)
  await expect(page.getByTestId('rt-fully-borne')).toBeVisible()
  // And the "here is your excess" line does NOT appear when there is no excess.
  await expect(page.getByTestId('rt-taper-now')).toHaveCount(0)
})

test('the late penalty is 2% a month', async ({ page }) => {
  // 100,000 x 2% x 3 = 6,000. Much of the web still prints 5% a month, which
  // is the OLD figure; at 5% this would read 15,000.
  await load(page)
  await fill(page, '2000000', '3')
  expect(await readNumber(page, 'rt-penalty')).toBe(6000)
  expect(await readNumber(page, 'rt-total')).toBe(106000)
})

test('and it stops at 50% of the tax however long it runs', async ({ page }) => {
  // 40 months x 2% would be 80% of the tax; the cap holds it at 50,000.
  await load(page)
  await fill(page, '2000000', '40')
  expect(await readNumber(page, 'rt-penalty')).toBe(50000)
  await expect(page.getByTestId('rt-capped')).toBeVisible()
})

test('no penalty is shown when nothing is late', async ({ page }) => {
  await load(page)
  await fill(page, '2000000', '0')
  await expect(page.getByTestId('rt-penalty')).toHaveCount(0)
  await expect(page.getByTestId('rt-capped')).toHaveCount(0)
})

test('it names the exempt cases and refuses to decide them', async ({ page }) => {
  // The `iqama-fees` rule: name what you will not compute.
  await load(page)
  await expect(page.getByTestId('rt-exempt')).toContainText('cannot see')
  await expect(page.getByTestId('rt-exempt-list').locator('li')).toHaveCount(8)
})

test('it says the seller is the taxable person', async ({ page }) => {
  await load(page)
  await expect(page.getByTestId('rt-who')).toContainText('disposer')
})

test('it works in Arabic, and the numbers are Arabic too', async ({ page }) => {
  await load(page, 'ar')
  await fill(page, '1500000')
  await page.getByTestId('rt-first-home').check()
  // Same arithmetic, and `toFixed`/`toLocaleString` must not leak Latin digits.
  expect(await readNumber(page, 'rt-tax')).toBe(25000)
  // The contrast with the customs cliff, which is the point of the panel.
  await expect(page.getByTestId('rt-taper')).toContainText('عكس الحدّ الجمركي')
  await expect(page.getByTestId('rt-tax')).not.toContainText(/[0-9]/)
})

test('it carries an official disclaimer naming ZATCA', async ({ page }) => {
  await load(page)
  const d = page.getByTestId('disclaimer')
  await expect(d).toHaveAttribute('data-kind', 'official')
  await expect(d).toContainText('ZATCA')
})
