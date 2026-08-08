import { test, expect } from '@playwright/test'

async function open(page: import('@playwright/test').Page, kwh?: string, locale = 'en') {
  await page.goto(`/${locale}/apps/electricity-bill`)
  await expect(page.getByTestId('electricity-bill')).toBeVisible()
  if (kwh) await page.getByTestId('eb-kwh').fill(kwh)
}

const num = async (page: import('@playwright/test').Page, id: string) =>
  Number((await page.getByTestId(id).innerText()).replace(/[^\d.]/g, ''))

test.describe('electricity bill estimate', () => {
  test('below the threshold it is one rate plus the fee and VAT', async ({ page }) => {
    // 1000 kWh × 0.18 = 180, + 10 meter = 190, + 15% = 218.50
    await open(page, '1000')
    expect(await num(page, 'eb-total')).toBeCloseTo(218.5, 1)
    await expect(page.getByTestId('eb-high')).toHaveCount(0)
  })

  test('crossing 6,000 costs pennies, not a repriced bill', async ({ page }) => {
    // The whole reason the tool exists. 5,999 -> 6,001 must differ by cents.
    await open(page, '5999')
    const before = await num(page, 'eb-total')
    await page.getByTestId('eb-kwh').fill('6001')
    const after = await num(page, 'eb-total')
    expect(after - before).toBeLessThan(1)
    expect(after).toBeGreaterThan(before)
  })

  test('only the units above the threshold carry the higher rate', async ({ page }) => {
    // 7,000 kWh = 6,000 × 0.18 + 1,000 × 0.30 = 1080 + 300 = 1380 energy.
    await open(page, '7000')
    await expect(page.getByTestId('eb-high')).toContainText('1,000 kWh at 30 halalas')
    // If it repriced everything it would be 7000 × 0.30 = 2100 before VAT.
    const total = await num(page, 'eb-total')
    expect(total).toBeCloseTo((1380 + 10) * 1.15, 0)
    expect(total).toBeLessThan(2100)
  })

  test('the marginal rate reflects where you are', async ({ page }) => {
    await open(page, '4000')
    await expect(page.getByTestId('eb-marginal')).toContainText('18')
    await page.getByTestId('eb-kwh').fill('6500')
    await expect(page.getByTestId('eb-marginal')).toContainText('30')
  })

  test('it says how far the higher rate is, and stops saying it once passed', async ({ page }) => {
    await open(page, '4500')
    await expect(page.getByTestId('eb-threshold')).toContainText('1,500 kWh before')
    await page.getByTestId('eb-kwh').fill('6500')
    await expect(page.getByTestId('eb-threshold')).toContainText('past the threshold')
  })

  test('another 500 kWh costs more once you are in the upper band', async ({ page }) => {
    await open(page, '1000')
    const cheap = await num(page, 'eb-plus500')
    await page.getByTestId('eb-kwh').fill('6500')
    const dear = await num(page, 'eb-plus500')
    expect(dear).toBeGreaterThan(cheap)
  })

  test('zero consumption still owes the meter fee and its VAT', async ({ page }) => {
    await open(page, '0')
    expect(await num(page, 'eb-total')).toBeCloseTo(11.5, 1)
  })

  test('the myth is stated in words, not just implied by the numbers', async ({ page }) => {
    await open(page, '4500')
    await expect(page.getByTestId('eb-myth')).toContainText('not hundreds')
  })

  test('it carries a financial disclaimer naming what it cannot see', async ({ page }) => {
    await open(page)
    const d = page.getByTestId('disclaimer')
    await expect(d).toHaveAttribute('data-kind', 'financial')
    await expect(d).toContainText('subsidy')
  })

  test('it works in Arabic', async ({ page }) => {
    await open(page, '7000', 'ar')
    await expect(page.getByTestId('eb-myth')).toContainText('لا مئات الريالات')
  })
})
