import { test, expect } from '@playwright/test'

async function open(page: import('@playwright/test').Page, o: { principal?: string; rate?: string; months?: string; paid?: string } = {}, locale = 'en') {
  await page.goto(`/${locale}/apps/early-settlement`)
  await expect(page.getByTestId('early-settlement')).toBeVisible()
  if (o.principal) await page.getByTestId('es-principal').fill(o.principal)
  if (o.rate !== undefined) await page.getByTestId('es-rate').fill(o.rate)
  if (o.months) await page.getByTestId('es-months').fill(o.months)
  if (o.paid !== undefined) await page.getByTestId('es-paid').fill(o.paid)
}

const num = async (page: import('@playwright/test').Page, id: string) =>
  Number((await page.getByTestId(id).innerText()).replace(/[^\d.]/g, ''))

test.describe('early loan settlement', () => {
  test('settling costs the balance plus three months, not the rest of the term', async ({ page }) => {
    // The whole point: the remaining term cost is waived, so settling must be
    // strictly cheaper than carrying on.
    await open(page, { principal: '150000', rate: '6.5', months: '60', paid: '24' })
    const total = await num(page, 'es-total')
    const continued = await num(page, 'es-continued')
    const balance = await num(page, 'es-balance')
    const comp = await num(page, 'es-compensation')
    expect(total).toBeCloseTo(balance + comp, 0)
    expect(total).toBeLessThan(continued)
  })

  test('the saving is the difference, and it is the headline', async ({ page }) => {
    await open(page, { principal: '150000', rate: '6.5', months: '60', paid: '24' })
    const saving = await num(page, 'es-saving')
    const total = await num(page, 'es-total')
    const continued = await num(page, 'es-continued')
    expect(saving).toBeCloseTo(continued - total, 0)
    expect(saving).toBeGreaterThan(0)
  })

  test('settling earlier saves more', async ({ page }) => {
    await open(page, { principal: '150000', rate: '6.5', months: '60', paid: '12' })
    const early = await num(page, 'es-saving')
    await page.getByTestId('es-paid').fill('48')
    const late = await num(page, 'es-saving')
    expect(early).toBeGreaterThan(late)
  })

  test('at zero rate there is nothing to save and nothing to charge', async ({ page }) => {
    await open(page, { principal: '120000', rate: '0', months: '60', paid: '20' })
    expect(await num(page, 'es-compensation')).toBe(0)
    expect(await num(page, 'es-saving')).toBe(0)
    // Balance is simply what has not been paid yet.
    expect(await num(page, 'es-balance')).toBeCloseTo(80000, 0)
  })

  test('the last months carry less than three months of cost', async ({ page }) => {
    // Two payments left cannot attract three months of term cost, and the
    // compensation must not exceed what continuing would have cost.
    await open(page, { principal: '150000', rate: '6.5', months: '60', paid: '58' })
    const comp = await num(page, 'es-compensation')
    const continued = await num(page, 'es-continued')
    expect(comp).toBeGreaterThan(0)
    expect(comp).toBeLessThan(continued)
    expect(await num(page, 'es-remaining')).toBe(2)
  })

  test('a fully paid loan has nothing left to settle', async ({ page }) => {
    await open(page, { principal: '150000', rate: '6.5', months: '60', paid: '60' })
    expect(await num(page, 'es-balance')).toBeCloseTo(0, 0)
    expect(await num(page, 'es-remaining')).toBe(0)
    expect(await num(page, 'es-compensation')).toBe(0)
  })

  test('it says the three months is a ceiling, not a fee', async ({ page }) => {
    await open(page)
    await expect(page.getByTestId('es-cap')).toContainText('no more than')
  })

  test('it carries a financial disclaimer that names what it cannot see', async ({ page }) => {
    await open(page)
    const d = page.getByTestId('disclaimer')
    await expect(d).toHaveAttribute('data-kind', 'financial')
    await expect(d).toContainText('administrative fees')
  })

  test('it works in Arabic', async ({ page }) => {
    await open(page, {}, 'ar')
    await expect(page.getByTestId('es-cap')).toContainText('لا يجوز للممول')
  })
})
