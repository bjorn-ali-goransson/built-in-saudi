import { test, expect } from '@playwright/test'

// Times are pinned against the Prayer Times app's own engine (adhan, Umm
// al-Qura) rather than hard-coded, so this checks the timetable's shape and the
// properties that make a printed sheet correct — not the ephemeris.
async function load(page: import('@playwright/test').Page, locale = 'en') {
  await page.goto(`/${locale}/apps/prayer-timetable`)
  await expect(page.getByTestId('pt-table')).toBeVisible()
}

test('prints every day of the chosen month', async ({ page }) => {
  await load(page)
  await page.getByTestId('pt-month').fill('2026-02')
  await expect(page.getByTestId('pt-table').locator('tbody tr')).toHaveCount(28)
  await page.getByTestId('pt-month').fill('2026-03')
  await expect(page.getByTestId('pt-table').locator('tbody tr')).toHaveCount(31)
})

test('every prayer has a time, in order through the day', async ({ page }) => {
  await load(page)
  await page.getByTestId('pt-month').fill('2026-03')
  const read = async (k: string) => (await page.getByTestId(`pt-${k}-15`).innerText()).trim()
  const mins = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m }
  const fajr = await read('fajr')
  const sunrise = await read('sunrise')
  const dhuhr = await read('dhuhr')
  const asr = await read('asr')
  const maghrib = await read('maghrib')
  const isha = await read('isha')
  for (const t of [fajr, sunrise, dhuhr, asr, maghrib, isha]) expect(t).toMatch(/^\d{2}:\d{2}$/)
  // The order of the day is the one property that cannot be wrong.
  expect(mins(fajr)).toBeLessThan(mins(sunrise))
  expect(mins(sunrise)).toBeLessThan(mins(dhuhr))
  expect(mins(dhuhr)).toBeLessThan(mins(asr))
  expect(mins(asr)).toBeLessThan(mins(maghrib))
  expect(mins(maghrib)).toBeLessThan(mins(isha))
})

// The timezone is a context option, so this one gets its own block.
test.describe('read from another timezone', () => {
  test.use({ timezoneId: 'Europe/London' })
  test('the times follow the place, not the reader', async ({ page }) => {
  // A sheet computed for Riyadh must read the same wherever the laptop thinks
  // it is — the bug that made sun-times wrong until its timezone was pinned.
  await load(page)
  await page.getByTestId('pt-month').fill('2026-03')
  await page.getByTestId('pt-city').selectOption('riyadh')
  const dhuhr = await page.getByTestId('pt-dhuhr-15').innerText()
  const [h] = dhuhr.split(':').map(Number)
  // Riyadh's Dhuhr is around noon local time, never around 09:00 London.
  expect(h).toBeGreaterThanOrEqual(11)
  expect(h).toBeLessThanOrEqual(13)
  })
})

test('changing the city changes the times', async ({ page }) => {
  await load(page)
  await page.getByTestId('pt-month').fill('2026-03')
  await page.getByTestId('pt-city').selectOption('makkah')
  const makkah = await page.getByTestId('pt-maghrib-15').innerText()
  await page.getByTestId('pt-city').selectOption('dammam')
  const dammam = await page.getByTestId('pt-maghrib-15').innerText()
  // Dammam is nearly 11 degrees east of Makkah; sunset is meaningfully earlier.
  expect(dammam).not.toBe(makkah)
  await expect(page.getByTestId('pt-place')).toHaveText('Dammam')
})

test('sunrise and the Hijri column can be turned off', async ({ page }) => {
  await load(page)
  await expect(page.getByTestId('pt-col-sunrise')).toBeVisible()
  await page.getByTestId('pt-sunrise').uncheck()
  await expect(page.getByTestId('pt-col-sunrise')).toHaveCount(0)
  await expect(page.getByTestId('pt-hijri-1')).toBeVisible()
  await page.getByTestId('pt-hijri').uncheck()
  await expect(page.getByTestId('pt-hijri-1')).toHaveCount(0)
})

test('the 12-hour clock is an option', async ({ page }) => {
  await load(page)
  await page.getByTestId('pt-month').fill('2026-03')
  await expect(page.getByTestId('pt-maghrib-15')).toHaveText(/^\d{2}:\d{2}$/)
  await page.getByTestId('pt-hour12').check()
  await expect(page.getByTestId('pt-maghrib-15')).toContainText(/am|pm/i)
})

test('says plainly that the mosque wins', async ({ page }) => {
  await load(page)
  const note = page.getByTestId('disclaimer')
  await expect(note).toHaveAttribute('data-kind', 'religious')
  await expect(note).toContainText('the mosque is right')
})

test('downloads the month', async ({ page }) => {
  await load(page)
  await page.getByTestId('pt-month').fill('2026-03')
  const dl = page.waitForEvent('download')
  await page.getByTestId('pt-download').click()
  expect((await dl).suggestedFilename()).toBe('prayer-times-2026-03.pdf')
})

test('works in Arabic too', async ({ page }) => {
  await load(page, 'ar')
  await expect(page.getByTestId('pt-col-fajr')).toHaveText('الفجر')
})
