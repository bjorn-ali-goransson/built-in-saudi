import { test, expect } from '@playwright/test'
import { readNumber } from './helpers'

// Saudi public holidays.
//
// Found by a CODE SWEEP: the site already had Umm al-Qura conversion and an
// Islamic events table with an `upcomingEvents()` nothing called, while the
// search returned NOTHING for «الإجازات الرسمية» and the vehicle-registration
// tool for «كم باقي على العيد».
//
// Every date case pins the clock. A holiday tool that reads today's date is
// asserting the season — the same failure this repo already recorded for
// `medicine-schedule` and `id-expiry`, and it would fire here every year.

const go = async (page: import('@playwright/test').Page, iso: string, locale = 'en') => {
  await page.clock.install({ time: new Date(`${iso}T09:00:00`) })
  await page.goto(`/${locale}/apps/saudi-holidays`)
  await expect(page.getByTestId('saudi-holidays')).toBeVisible()
}

test('the two fixed holidays are on their decreed dates', async ({ page }) => {
  await go(page, '2027-01-05')
  await expect(page.getByTestId('sh-foundingDay')).toContainText('22 February')
  await expect(page.getByTestId('sh-nationalDay')).toContainText('23 September')
})

test('the Eid holidays MOVE, and are labelled as moving', async ({ page }) => {
  // Half the list is fixed by decree and half follows the Hijri year, which is
  // why a hand-typed list is half-stale within a year.
  await go(page, '2027-01-05')
  const a = await page.getByTestId('sh-eidFitr').textContent()
  await page.getByTestId('sh-year-2028').click()
  const b = await page.getByTestId('sh-eidFitr').textContent()
  expect(b).not.toBe(a)
  await expect(page.getByTestId('sh-eidFitr')).toContainText('Moves each year')
  await expect(page.getByTestId('sh-foundingDay')).toContainText('Fixed date')
})

test('the Eid al-Fitr holiday is 4 days and starts the day after 29 Ramadan', async ({ page }) => {
  await go(page, '2027-01-05')
  await expect(page.getByTestId('sh-eidFitr')).toContainText('4 days')
  await expect(page.getByTestId('sh-eidAdha')).toContainText('4 days')
  await expect(page.getByTestId('sh-nationalDay')).toContainText('1 day')
  // The panel states which case this year is, rather than assuming one.
  await expect(page.getByTestId('sh-before')).toContainText('29 Ramadan')
})

test('the year totals ten days', async ({ page }) => {
  // 4 + 4 + 1 + 1, which is the figure HRSD publishes.
  await go(page, '2027-01-05')
  expect(await readNumber(page, 'sh-total')).toBe(10)
})

test('the countdown counts to the next holiday, not to the first of the year', async ({ page }) => {
  // Asked in October, the answer must be next year's Founding Day rather than
  // nothing — the reason `nextHoliday` looks into the following year at all.
  await go(page, '2027-10-05')
  await expect(page.getByTestId('sh-next')).toContainText('Founding Day')
  await expect(page.getByTestId('sh-next-when')).toContainText('In 1')
})

test('a holiday running today says so instead of counting to it', async ({ page }) => {
  await go(page, '2027-02-22')
  await expect(page.getByTestId('sh-next')).toContainText('Founding Day')
  await expect(page.getByTestId('sh-next-when')).toContainText('today')
})

test('the four rules the published lists leave out are all stated', async ({ page }) => {
  await go(page, '2027-01-05')
  await expect(page.getByTestId('sh-sighting')).toContainText('Umm al-Qura')
  await expect(page.getByTestId('sh-weekend-rule')).toBeVisible()
  await expect(page.getByTestId('sh-leave')).toBeVisible()
  await expect(page.getByTestId('sh-sector')).toContainText('112')
})

test('a fixed holiday landing on the weekend is flagged as compensated', async ({ page }) => {
  // 22 February 2025 is a Saturday. Both directions matter: without a year in
  // which it does NOT fire, a hard-coded flag would pass the first case.
  await go(page, '2025-01-05')
  await expect(page.getByTestId('sh-weekend-foundingDay')).toBeVisible()
  await page.getByTestId('sh-year-2026').click()
  // 22 February 2026 is a Sunday — a working day here.
  await expect(page.getByTestId('sh-weekend-foundingDay')).toHaveCount(0)
})

test('Arabic renders Arabic-Indic digits in the total', async ({ page }) => {
  // An Arabic test that only asserts prose tests nothing about the Arabic
  // rendering of anything computed.
  await go(page, '2027-01-05', 'ar')
  const t = await page.getByTestId('sh-total').textContent()
  expect(t).toMatch(/[٠-٩]/)
  expect(await readNumber(page, 'sh-total')).toBe(10)
})

test('the Islamic calendar still marks its holidays after the map was shared', async ({ page }) => {
  // `HOLIDAY_BY_HIJRI` replaced a copy of the same six entries that lived in
  // this tool. If the derivation were wrong, every marker would silently go.
  await page.goto('/en/apps/islamic-calendar')
  await expect(page.getByTestId('cal-hol-ramadan')).toBeVisible()
  await expect(page.getByTestId('cal-hol-eidAdha')).toBeVisible()
})

test('National Day inside an Eid holiday is NOT compensated', async ({ page }) => {
  // It really happened: in 2015 the Eid al-Adha break covered 23 September.
  // Swept the years 1990–2070 to find one rather than assuming the branch was
  // reachable — a branch no test can reach is not a passing branch, which is
  // the lesson `vehicle-renewal` already paid for.
  await go(page, '2015-06-01')
  await expect(page.getByTestId('sh-swallowed-nationalDay')).toBeVisible()
  // And the weekend flag must not ALSO fire on it — the rule is one or other.
  await expect(page.getByTestId('sh-weekend-nationalDay')).toHaveCount(0)
})

test('a Gregorian year holding TWO Eid al-Fitr holidays shows both', async ({ page }) => {
  // The Hijri year is eleven days shorter, so this happens — 2033 is the next
  // one. Assuming one of each would silently drop a holiday in exactly the
  // year somebody looked it up.
  await go(page, '2033-06-01')
  await expect(page.getByTestId('sh-list').getByTestId('sh-eidFitr')).toHaveCount(2)
  expect(await readNumber(page, 'sh-total')).toBe(14)
})
