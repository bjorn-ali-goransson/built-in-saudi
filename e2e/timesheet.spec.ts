import { test, expect } from '@playwright/test'
import { readNumber } from './helpers'

// Time card calculator. Found by a web sweep: it is one of the highest-traffic
// free-tool categories on the web (timecardcalculator.net, redcort, My Hours,
// Clockshark, CalculatorSoup all publish one) and this site had none.

const set = async (page: import('@playwright/test').Page, day: string, start: string, end: string, brk = 0) => {
  await page.getByTestId(`ts-start-${day}`).fill(start)
  await page.getByTestId(`ts-end-${day}`).fill(end)
  await page.getByTestId(`ts-break-${day}`).fill(String(brk))
}

const clearAll = async (page: import('@playwright/test').Page) => {
  for (const d of ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']) {
    await page.getByTestId(`ts-start-${d}`).fill('')
    await page.getByTestId(`ts-end-${d}`).fill('')
    await page.getByTestId(`ts-break-${d}`).fill('0')
  }
}

test('a plain shift totals, with the break taken off', async ({ page }) => {
  await page.goto('/en/apps/timesheet')
  await clearAll(page)
  await set(page, 'sun', '08:00', '17:00', 60)
  await expect(page.getByTestId('ts-hhmm-sun')).toHaveText('8:00')
  await expect(page.getByTestId('ts-total')).toHaveText('8:00')
})

test('an overnight shift is not a negative day', async ({ page }) => {
  // The case most of the generic calculators refuse or report as minus sixteen
  // hours — and a night shift is exactly the week somebody totals by hand.
  await page.goto('/en/apps/timesheet')
  await clearAll(page)
  await set(page, 'sun', '22:00', '06:00', 30)
  await expect(page.getByTestId('ts-hhmm-sun')).toHaveText('7:30')
  await expect(page.getByTestId('ts-overnight-sun')).toBeVisible()
})

test('decimal hours are not the minutes with a dot in front', async ({ page }) => {
  // 7:20 is 7.33, not 7.20. That conversion is where hand-totalled sheets go
  // wrong, which is why both columns are shown.
  await page.goto('/en/apps/timesheet')
  await clearAll(page)
  await set(page, 'sun', '09:00', '16:20', 0)
  await expect(page.getByTestId('ts-hhmm-sun')).toHaveText('7:20')
  await expect(page.getByTestId('ts-dec-sun')).toContainText('7.33')
})

test('a break longer than the shift is called a mistake, not a negative', async ({ page }) => {
  await page.goto('/en/apps/timesheet')
  await clearAll(page)
  await set(page, 'sun', '09:00', '10:00', 120)
  await expect(page.getByTestId('ts-invalid-sun')).toBeVisible()
  await expect(page.getByTestId('ts-hhmm-sun')).toHaveText('0:00')
})

test('overtime per DAY and per WEEK are different answers', async ({ page }) => {
  // Five nine-hour days is 5 hours of overtime daily and none against a 48-hour
  // week. Which applies is the employer's basis, so it is asked, not assumed.
  await page.goto('/en/apps/timesheet')
  await clearAll(page)
  for (const d of ['sun', 'mon', 'tue', 'wed', 'thu']) await set(page, d, '08:00', '17:00', 0)
  await expect(page.getByTestId('ts-total')).toHaveText('45:00')
  await expect(page.getByTestId('ts-overtime')).toHaveText('5:00')

  await page.getByTestId('ts-basis').selectOption('weekly')
  await expect(page.getByTestId('ts-threshold')).toHaveValue('48')
  await expect(page.getByTestId('ts-overtime')).toHaveText('0:00')
})

test('Ramadan shortens the standard day to six hours', async ({ page }) => {
  // A Saudi statutory reduction no generic calculator knows, and it changes
  // what counts as overtime for a whole month.
  await page.goto('/en/apps/timesheet')
  await clearAll(page)
  await set(page, 'sun', '09:00', '17:00', 0)
  await expect(page.getByTestId('ts-overtime')).toHaveText('0:00')
  await page.getByTestId('ts-ramadan').check()
  await expect(page.getByTestId('ts-threshold')).toHaveValue('6')
  await expect(page.getByTestId('ts-overtime')).toHaveText('2:00')
})

test('overtime is paid at 150%, not at the plain rate', async ({ page }) => {
  await page.goto('/en/apps/timesheet')
  await clearAll(page)
  await set(page, 'sun', '08:00', '18:00', 0) // 10h: 8 regular + 2 overtime
  await page.getByTestId('ts-rate').fill('100')
  // 8 x 100 + 2 x 150 = 1100, not 10 x 100 = 1000.
  await expect(page.getByTestId('ts-pay')).toContainText('1,100')
})

test('the pay figure only appears once a rate is given', async ({ page }) => {
  await page.goto('/en/apps/timesheet')
  await expect(page.getByTestId('ts-pay')).toHaveCount(0)
  await page.getByTestId('ts-rate').fill('50')
  await expect(page.getByTestId('ts-pay')).toBeVisible()
})

test('it points at the tool that owns the labour rules', async ({ page }) => {
  // Two tools asserting the same statute is how they drift apart.
  await page.goto('/en/apps/timesheet')
  await page.getByTestId('ts-more-rules').click()
  await expect(page).toHaveURL(/\/en\/apps\/leave-overtime$/)
})

test('works in Arabic, including the computed numbers', async ({ page }) => {
  await page.goto('/ar/apps/timesheet')
  await clearAll(page)
  await set(page, 'sun', '08:00', '17:00', 60)
  await page.getByTestId('ts-rate').fill('100')
  // An Arabic test that only asserts prose is not testing the Arabic rendering
  // of anything computed.
  const pay = await readNumber(page, 'ts-pay')
  expect(pay).toBe(800)
  await expect(page.getByTestId('ts-row-sun')).toContainText('الأحد')
})
