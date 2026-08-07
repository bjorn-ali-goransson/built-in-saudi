import { test, expect } from '@playwright/test'

async function open(page: import('@playwright/test').Page, locale = 'en') {
  await page.goto(`/${locale}/apps/gosi-salary`)
  await expect(page.getByTestId('gosi-salary')).toBeVisible()
}

async function fill(page: import('@playwright/test').Page, basic: string, housing: string, other: string) {
  await page.getByTestId('gs-basic').fill(basic)
  await page.getByTestId('gs-housing').fill(housing)
  await page.getByTestId('gs-other').fill(other)
}

test.describe('gosi and net salary', () => {
  test('contributions ignore allowances outside the base', async ({ page }) => {
    await open(page)
    // Base is 10000 + 2000 = 12000. The 3000 transport is paid but not charged.
    await fill(page, '10000', '2000', '3000')
    await expect(page.getByTestId('gs-base')).toContainText('12,000')
    await expect(page.getByTestId('gs-excluded')).toContainText('3,000')
    // Old scheme: 9% pension + 0.75% SANED = 9.75% of 12,000 = 1,170.
    await expect(page.getByTestId('gs-deduction')).toContainText('1,170')
    // Take-home is gross (15,000) minus the deduction, NOT 9.75% of gross.
    await expect(page.getByTestId('gs-gross')).toContainText('15,000')
    await expect(page.getByTestId('gs-net')).toContainText('13,830')
  })

  test('a non-Saudi employee has nothing deducted', async ({ page }) => {
    await open(page)
    await fill(page, '20000', '5000', '0')
    await page.getByTestId('gs-expat').click()
    await expect(page.getByTestId('gs-deduction')).toContainText('0')
    await expect(page.getByTestId('gs-no-deduction')).toBeVisible()
    await expect(page.getByTestId('gs-expat-note')).toBeVisible()
    // The employer still pays occupational hazards: 2% of 25,000 = 500.
    await expect(page.getByTestId('gs-er-hazards')).toContainText('500')
    await expect(page.getByTestId('gs-net')).toContainText('25,000')
    // And the scheme question is irrelevant, so it is not asked.
    await expect(page.getByTestId('gs-scheme')).toHaveCount(0)
  })

  test('the two systems give different answers on the same salary', async ({ page }) => {
    await open(page)
    await fill(page, '10000', '0', '0')
    // Old: 9.75% of 10,000 = 975.
    await expect(page.getByTestId('gs-deduction')).toContainText('975')
    await page.getByTestId('gs-new').click()
    // New scheme in 2026: pension 10% + SANED 0.75% = 10.75% = 1,075.
    await page.getByTestId('gs-year-2026').click()
    await expect(page.getByTestId('gs-deduction')).toContainText('1,075')
    // And it keeps rising: 2028 is 11% + 0.75% = 11.75%.
    await page.getByTestId('gs-year-2028').click()
    await expect(page.getByTestId('gs-deduction')).toContainText('1,175')
  })

  test('the wage ceiling stops the contribution, and says so', async ({ page }) => {
    await open(page)
    await fill(page, '50000', '10000', '0')
    await expect(page.getByTestId('gs-base')).toContainText('45,000')
    await expect(page.getByTestId('gs-capped')).toContainText('15,000')
    await expect(page.getByTestId('gs-cap-note')).toBeVisible()
    // 9.75% of the CAP, not of the 60,000 actually earned.
    await expect(page.getByTestId('gs-deduction')).toContainText('4,387.5')
  })

  test('the employer side is shown in full, including its own cost', async ({ page }) => {
    await open(page)
    await fill(page, '10000', '0', '0')
    // Employer: 9% pension + 2% hazards + 0.75% SANED on 10,000.
    await expect(page.getByTestId('gs-er-pension')).toContainText('900')
    await expect(page.getByTestId('gs-er-hazards')).toContainText('200')
    await expect(page.getByTestId('gs-er-saned')).toContainText('75')
    // Cost to employer is the gross plus their 1,175.
    await expect(page.getByTestId('gs-cost')).toContainText('11,175')
  })

  test('the rising schedule is shown so the increase is not a surprise', async ({ page }) => {
    await open(page)
    const table = page.getByTestId('gs-schedule')
    await expect(table).toContainText('2024')
    await expect(table).toContainText('2028')
    await expect(table).toContainText('9.75%')
    await expect(table).toContainText('11.75%')
  })

  test('it carries a financial disclaimer naming the authority', async ({ page }) => {
    await open(page)
    const d = page.getByTestId('disclaimer')
    await expect(d).toBeVisible()
    await expect(d).toHaveAttribute('data-kind', 'financial')
    await expect(d).toContainText('General Organization for Social Insurance')
  })

  test('it works in Arabic', async ({ page }) => {
    await open(page, 'ar')
    await fill(page, '10000', '0', '0')
    await expect(page.getByTestId('gs-expat-note')).toHaveCount(0)
    await page.getByTestId('gs-expat').click()
    await expect(page.getByTestId('gs-expat-note')).toContainText('غير السعودي')
  })
})
