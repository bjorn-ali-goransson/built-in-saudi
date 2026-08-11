import { test, expect, type Page } from '@playwright/test'
import { readNumber } from './helpers'

// Product Pricing & Margin.
//
// Found by a web sweep of the small-seller vertical. Every margin calculator on
// the web starts from a price NET of tax, because that is how the countries
// they were written in quote a price. Here the advertised price must INCLUDE
// VAT — the Ministry of Commerce is explicit that a SAR 100 shelf price means a
// SAR 100 invoice — so the number on the product page is not the money you get.
//
// Every figure below was computed independently before the spec was written.

const load = async (page: Page, locale = 'en') => {
  await page.goto(`/${locale}/apps/pricing`)
  await expect(page.getByTestId('pricing')).toBeVisible()
}

const fill = async (page: Page, cost: string, displayed: string, fee: string) => {
  await page.getByTestId('pr-cost').fill(cost)
  await page.getByTestId('pr-displayed').fill(displayed)
  await page.getByTestId('pr-fee').fill(fee)
}

test('the displayed price is split into the tax that was never yours', async ({ page }) => {
  await load(page)
  await fill(page, '50', '100', '0')
  // 100 / 1.15 = 86.96 revenue; the other 13.04 is ZATCA's.
  expect(await readNumber(page, 'pr-net')).toBeCloseTo(86.96, 1)
  expect(await readNumber(page, 'pr-vat')).toBeCloseTo(13.04, 1)
})

test('the fee is taken on the GROSS, not on the revenue', async ({ page }) => {
  await load(page)
  await fill(page, '50', '100', '2.5')
  // 2.5% of the whole 100, not of the 86.96.
  expect(await readNumber(page, 'pr-fee-out')).toBeCloseTo(2.5, 2)
  // 86.96 - 50 - 2.50 = 34.46
  expect(await readNumber(page, 'pr-profit')).toBeCloseTo(34.46, 1)
})

test('markup and margin are both shown, and they differ', async ({ page }) => {
  await load(page)
  await fill(page, '50', '100', '0')
  // profit 36.96 on revenue 86.96 = 42.5% margin; on cost 50 = 73.9% markup.
  const margin = await readNumber(page, 'pr-margin')
  const markup = await readNumber(page, 'pr-markup')
  expect(margin).toBeCloseTo(42.5, 0)
  expect(markup).toBeCloseTo(73.9, 0)
  // The whole point of showing both: the flattering one is much bigger.
  expect(markup).toBeGreaterThan(margin)
})

test('the price to display for a real 40% margin is not the textbook one', async ({ page }) => {
  // The measurement the tool exists for. A generic calculator says 83.33;
  // displayed here that earns 28.1%, not 40%. The honest answer is 100.66.
  await load(page)
  await fill(page, '50', '100', '2.5')
  await page.getByTestId('pr-target').fill('40')
  expect(await readNumber(page, 'pr-need')).toBeCloseTo(100.66, 0)
  await expect(page.getByTestId('pr-naive')).toContainText('83.33')
  await expect(page.getByTestId('pr-naive')).toContainText('28.1%')
})

test('and charging that price really does produce the margin asked for', async ({ page }) => {
  // Without this the case above would pass against any confident-looking
  // number. Feed the tool's own answer back in and the margin must come out.
  await load(page)
  await fill(page, '50', '100.66', '2.5')
  expect(await readNumber(page, 'pr-margin')).toBeCloseTo(40, 0)
})

test('an unreachable margin says so instead of printing a huge number', async ({ page }) => {
  // 95% margin against a 12% fee has no solution — the denominator goes
  // negative. A vast number would look like an answer.
  await load(page)
  await fill(page, '50', '100', '12')
  await page.getByTestId('pr-target').fill('95')
  await expect(page.getByTestId('pr-unreachable')).toBeVisible()
  await expect(page.getByTestId('pr-need')).toContainText('—')
})

test('a sale below cost is called a loss', async ({ page }) => {
  await load(page)
  await fill(page, '100', '100', '2.5')
  await expect(page.getByTestId('pr-loss')).toBeVisible()
  expect(await readNumber(page, 'pr-profit')).toBeLessThan(0)
})

test('it refuses to supply a fee table and says why', async ({ page }) => {
  // The `iqama-fees` rule: name what you will not compute.
  await load(page)
  await expect(page.getByTestId('pr-no-table')).toContainText('negotiated')
  await expect(page.getByTestId('pr-fee')).toHaveValue('2.5')
})

test('it works in Arabic, and the numbers are Arabic too', async ({ page }) => {
  await load(page, 'ar')
  await fill(page, '50', '100', '0')
  expect(await readNumber(page, 'pr-net')).toBeCloseTo(86.96, 1)
  await expect(page.getByTestId('pr-vat-note')).toContainText('وزارة التجارة')
  await expect(page.getByTestId('pr-net')).not.toContainText(/[0-9]/)
})

test('it carries a financial disclaimer naming ZATCA', async ({ page }) => {
  await load(page)
  const d = page.getByTestId('disclaimer')
  await expect(d).toHaveAttribute('data-kind', 'financial')
  await expect(d).toContainText('ZATCA')
})
