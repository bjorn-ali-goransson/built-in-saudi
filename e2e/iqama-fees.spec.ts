import { test, expect } from '@playwright/test'
import { readNumber } from './helpers'

async function open(
  page: import('@playwright/test').Page,
  o: { months?: 3 | 6 | 9 | 12; dependents?: string; domestic?: boolean } = {},
  locale = 'en',
) {
  await page.goto(`/${locale}/apps/iqama-fees`)
  await expect(page.getByTestId('iqama-fees')).toBeVisible()
  if (o.dependents !== undefined) await page.getByTestId('if-dependents').fill(o.dependents)
  if (o.months) await page.getByTestId(`if-period-${o.months}`).click()
  if (o.domestic) await page.getByTestId('if-domestic').check()
}

test.describe('iqama renewal cost', () => {
  test('with no dependents it is the iqama fee alone', async ({ page }) => {
    await open(page, { dependents: '0' })
    expect(await readNumber(page, 'if-total')).toBe(650)
    await expect(page.getByTestId('if-none')).toBeVisible()
    await expect(page.getByTestId('if-shock')).toHaveCount(0)
  })

  test('the dependent fee is per person per MONTH, for the whole period', async ({ page }) => {
    // The misconception the tool exists for. A spouse and two children for a
    // year is 3 x 400 x 12 = 14,400, not 3 x 400.
    await open(page, { dependents: '3' })
    expect(await readNumber(page, 'if-dependents-total')).toBe(14_400)
    expect(await readNumber(page, 'if-total')).toBe(15_050)
    await expect(page.getByTestId('if-breakdown')).toContainText('400')
  })

  test('the dependent fee dwarfs the iqama fee, and the tool says by how much', async ({ page }) => {
    await open(page, { dependents: '3' })
    // 14,400 of 15,050 is 96%.
    await expect(page.getByTestId('if-shock')).toContainText('96')
  })

  test('a shorter period charges the iqama fee pro rata, not a discount', async ({ page }) => {
    await open(page, { dependents: '0', months: 3 })
    // 650/12 x 3 = 162.5, charged as 163.
    expect(await readNumber(page, 'if-iqama')).toBe(163)
    // Four of those is 652, i.e. the same year to within the rounding — the
    // point is that quarterly SPLITS the cost rather than reducing it.
    await open(page, { dependents: '0', months: 12 })
    expect(await readNumber(page, 'if-iqama')).toBe(650)
  })

  test('quarterly is offered as a way to split the payment, and withdrawn once taken', async ({ page }) => {
    await open(page, { dependents: '2', months: 12 })
    await expect(page.getByTestId('if-lever')).toContainText('splits it')
    await open(page, { dependents: '2', months: 3 })
    await expect(page.getByTestId('if-lever')).toContainText('shortest period')
  })

  test('a domestic worker pays the lower iqama fee', async ({ page }) => {
    await open(page, { dependents: '0', domestic: true })
    expect(await readNumber(page, 'if-total')).toBe(600)
  })

  test('it says outright that the work permit levy is not the workers to pay', async ({ page }) => {
    // The most useful thing on the page is not a number: an expat seeing this
    // deducted is looking at something unlawful.
    await open(page)
    const who = page.getByTestId('if-who')
    await expect(who).toContainText('Article 40')
    await expect(who).toContainText('employer')
  })

  test('late renewal penalties escalate', async ({ page }) => {
    await open(page)
    const late = page.getByTestId('if-late')
    await expect(late).toContainText('500')
    await expect(late).toContainText('2,000')
  })

  test('it carries an official disclaimer that names what it refuses to compute', async ({ page }) => {
    await open(page)
    const d = page.getByTestId('disclaimer')
    await expect(d).toHaveAttribute('data-kind', 'official')
    await expect(d).toContainText('work permit levy')
  })

  test('it works in Arabic, numbers included', async ({ page }) => {
    await open(page, { dependents: '3' }, 'ar')
    await expect(page.getByTestId('if-who')).toContainText('المادة الأربعون')
    expect(await readNumber(page, 'if-total')).toBe(15_050)
  })
})
