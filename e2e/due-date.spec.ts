import { test, expect } from '@playwright/test'
import { readNumber } from './helpers'

// A pregnancy due-date calculator was on every Arabic tool site we compete with
// and on none of ours, next to a calorie calculator and a water-intake one.

const set = async (page: import('@playwright/test').Page, iso: string) => {
  await page.getByTestId('dd-date').fill(iso)
}

// Built in LOCAL terms, never toISOString(): east of Greenwich those disagree
// between local midnight and UTC midnight.
function daysAgo(n: number) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  const p = (x: number) => String(x).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

test('280 days from the last period, in both calendars', async ({ page }) => {
  await page.goto('/en/apps/due-date')
  await set(page, '2026-01-01')
  // 1 Jan 2026 + 280 days = 8 October 2026.
  await expect(page.getByTestId('dd-edd')).toContainText('8 October 2026')
  // The Hijri date is the local half of the tool, so it is asserted, not assumed.
  await expect(page.getByTestId('dd-edd-hijri')).toContainText('1448')
})

test('a longer cycle moves the due date, and says so', async ({ page }) => {
  // The thing most calculators quietly get wrong: Naegele's rule assumes
  // ovulation on day 14, so a 35-day cycle is a week later, not the same day.
  await page.goto('/en/apps/due-date')
  await set(page, '2026-01-01')
  await page.getByTestId('dd-cycle').fill('35')
  await expect(page.getByTestId('dd-edd')).toContainText('15 October 2026')
  await expect(page.getByTestId('dd-shift')).toContainText('7 days longer')
})

test('a shorter cycle moves it the other way', async ({ page }) => {
  await page.goto('/en/apps/due-date')
  await set(page, '2026-01-01')
  await page.getByTestId('dd-cycle').fill('21')
  await expect(page.getByTestId('dd-edd')).toContainText('1 October 2026')
  await expect(page.getByTestId('dd-shift')).toContainText('7 days shorter')
})

test('the exact bases do not offer a cycle length at all', async ({ page }) => {
  // An IVF transfer date is known to the day; asking for a cycle beside it
  // would imply a guess at ovulation that is not being made.
  await page.goto('/en/apps/due-date')
  await expect(page.getByTestId('dd-cycle')).toBeVisible()
  await page.getByTestId('dd-basis').selectOption('ivf5')
  await expect(page.getByTestId('dd-cycle')).toHaveCount(0)
  await set(page, '2026-01-01')
  // A day-5 blastocyst is 19 days past a notional LMP: 1 Jan - 19 + 280.
  await expect(page.getByTestId('dd-edd')).toContainText('19 September 2026')
})

test('a scan-given due date is taken as given', async ({ page }) => {
  await page.goto('/en/apps/due-date')
  await page.getByTestId('dd-basis').selectOption('edd')
  await set(page, '2026-10-08')
  await expect(page.getByTestId('dd-edd')).toContainText('8 October 2026')
})

test('reports how far along, and which trimester', async ({ page }) => {
  await page.goto('/en/apps/due-date')
  await set(page, daysAgo(100))
  // 100 days = 14 weeks 2 days, which is the second trimester.
  await expect(page.getByTestId('dd-gestation')).toContainText('14 weeks and 2 days')
  await expect(page.getByTestId('dd-trimester')).toContainText('second')
})

test('a future date is refused rather than computed', async ({ page }) => {
  await page.goto('/en/apps/due-date')
  const d = new Date()
  d.setDate(d.getDate() + 30)
  const p = (x: number) => String(x).padStart(2, '0')
  await set(page, `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`)
  await expect(page.getByTestId('dd-future')).toBeVisible()
  await expect(page.getByTestId('dd-edd')).toHaveCount(0)
})

test('it refuses to pretend the date is an appointment', async ({ page }) => {
  await page.goto('/en/apps/due-date')
  await set(page, '2026-01-01')
  await expect(page.getByTestId('dd-not-a-date')).toContainText('37 to 42 weeks')
  await expect(page.getByTestId('disclaimer')).toHaveAttribute('data-kind', 'medical')
})

test('works in Arabic, including the numbers', async ({ page }) => {
  await page.goto('/ar/apps/due-date')
  await set(page, '2026-01-01')
  await expect(page.getByTestId('dd-trimester')).toContainText('الثلث')
  // An Arabic test that only asserts prose is not testing the Arabic rendering
  // of anything computed.
  const weeks = await readNumber(page, 'dd-gestation')
  expect(weeks).toBeGreaterThan(0)
  await expect(page.getByTestId('dd-milestones')).toContainText('١٤٤')
})
