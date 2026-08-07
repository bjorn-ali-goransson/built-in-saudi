import { test, expect } from '@playwright/test'

const open = async (page: import('@playwright/test').Page, locale = 'en') => {
  await page.goto(`/${locale}/apps/vat-registration`)
  await expect(page.getByTestId('vat-registration')).toBeVisible()
}

test.describe('do I need to register for VAT', () => {
  test('below the voluntary threshold, nothing is required', async ({ page }) => {
    await open(page)
    await page.getByTestId('vr-past').fill('100000')
    await expect(page.getByTestId('vr-status')).toContainText('No registration required')
  })

  test('between the thresholds it is a choice, and says what the choice costs', async ({ page }) => {
    await open(page)
    await page.getByTestId('vr-past').fill('200000')
    await expect(page.getByTestId('vr-status')).toContainText('may register voluntarily')
    await expect(page.getByTestId('vr-body')).toContainText('reclaim input VAT')
  })

  test('at the mandatory threshold it is mandatory, exactly at the line', async ({ page }) => {
    await open(page)
    await page.getByTestId('vr-past').fill('374999')
    await expect(page.getByTestId('vr-status')).toContainText('may register voluntarily')
    await page.getByTestId('vr-past').fill('375000')
    await expect(page.getByTestId('vr-status')).toContainText('mandatory')
  })

  test('expecting to cross next year makes it due now', async ({ page }) => {
    await open(page)
    // A new business with almost no history but a signed contract ahead.
    await page.getByTestId('vr-past').fill('0')
    await page.getByTestId('vr-next').fill('500000')
    await expect(page.getByTestId('vr-status')).toContainText('mandatory')
    await expect(page.getByTestId('vr-expected')).toBeVisible()
  })

  test('the rolling window catches what a calendar year misses', async ({ page }) => {
    await open(page)
    await page.getByTestId('vr-detailed').click()
    // 200k in the back half of one year and 200k in the front half of the next:
    // neither calendar year reaches 375k, but a rolling twelve months does.
    for (const i of [6, 7, 8, 9, 10, 11]) await page.getByTestId(`vr-m-${i}`).fill('35000')
    for (const i of [12, 13, 14, 15, 16, 17]) await page.getByTestId(`vr-m-${i}`).fill('35000')
    await expect(page.getByTestId('vr-peak')).toContainText('420,000')
    await expect(page.getByTestId('vr-status')).toContainText('mandatory')
  })

  test('it names the month the clock started, and the deadline', async ({ page }) => {
    await open(page)
    await page.getByTestId('vr-detailed').click()
    // A single big month crosses outright, and it is not the latest one.
    await page.getByTestId('vr-m-4').fill('400000')
    await expect(page.getByTestId('vr-crossed')).toBeVisible()
    await expect(page.getByTestId('vr-deadline')).toBeVisible()
    await expect(page.getByTestId('vr-deadline-note')).toContainText('30 days')
  })

  test('a short history still counts — six months can cross', async ({ page }) => {
    await open(page)
    await page.getByTestId('vr-detailed').click()
    for (const i of [12, 13, 14, 15, 16, 17]) await page.getByTestId(`vr-m-${i}`).fill('70000')
    await expect(page.getByTestId('vr-peak')).toContainText('420,000')
    await expect(page.getByTestId('vr-status')).toContainText('mandatory')
  })

  test('it states which supplies count, since that is the other common error', async ({ page }) => {
    await open(page)
    const counts = page.getByTestId('vr-counts')
    await expect(counts).toContainText('zero-rated supplies both count')
    await expect(counts).toContainText('Exempt supplies')
  })

  test('it carries a legal disclaimer naming ZATCA', async ({ page }) => {
    await open(page)
    const d = page.getByTestId('disclaimer')
    await expect(d).toHaveAttribute('data-kind', 'legal')
    await expect(d).toContainText('Zakat, Tax and Customs Authority')
  })

  test('it works in Arabic', async ({ page }) => {
    await open(page, 'ar')
    await page.getByTestId('vr-past').fill('400000')
    await expect(page.getByTestId('vr-status')).toContainText('إلزامي')
  })
})
