import { test, expect, type Page } from '@playwright/test'

// Prayer times — the site's most prominent tool, and its thinnest-covered.
//
// Found by `node evals/coverageshape.mjs`, which ranks live tools by lines of
// tool code per assertion-bearing e2e case. At 929 lines against ONE case
// asserting "the hero is visible and there are at least five rows", it was the
// thin end of the whole catalogue by a distance — the shape `file-metadata` was
// in when writing its coverage found a real bug.
//
// Every expected time below was computed INDEPENDENTLY with `adhan` in node
// before this file was written, not read off the running tool. A test whose
// expectations came from the thing under test asserts only that it has not
// changed, which is not the same as asserting it is right.
//
//   Makkah (21.4225, 39.8262), Umm al-Qura, Asia/Riyadh
//   2026-03-15  fajr 05:14  sunrise 06:30  dhuhr 12:30  asr 15:54  maghrib 18:30  isha 20:00
//   2026-03-16  fajr 05:13
//
// The METHOD is the substance of these assertions. Umm al-Qura is what the
// Kingdom's own calendar uses; swapping the calculation method — a one-line
// change with nothing to catch it — moves every one of those times by minutes,
// on the one tool where a few minutes is the entire point.

test.use({ timezoneId: 'Asia/Riyadh' })

/** Makkah, 24-hour clock — pinned so no assertion depends on where CI sits. */
const setup = async (page: Page, iso: string, locale = 'en') => {
  // Seeded only when ABSENT. An init script runs on every navigation, so
  // setting these unconditionally re-wrote the saved city on reload — which
  // made the persistence case below fail against a tool that persists
  // perfectly. The harness was overwriting the very thing it was checking.
  await page.addInitScript(() => {
    if (!localStorage.getItem('bis-prayer-loc')) {
      localStorage.setItem('bis-prayer-loc', JSON.stringify({ mode: 'city', cityId: 'makkah' }))
    }
    localStorage.setItem('bis-prayer-24h', '1')
  })
  // setFixedTime, NOT install: the tool re-reads the clock every 30 seconds, so
  // under a fake clock that advances, a countdown assertion silently measures
  // how long the page took to load. The first run of this file expected
  // `in 8h 13m` — the arithmetic from 21:00:00 — and got 8h 12m, which was the
  // page having been open a minute of fake time. Fixing the clock outright is
  // what makes the minute mean something.
  await page.clock.setFixedTime(new Date(iso))
  await page.goto(`/${locale}/apps/prayer-times`)
  await expect(page.getByTestId('next-prayer')).toBeVisible()
}

const rowTime = (page: Page, key: string) =>
  page.getByTestId(`prow-${key}`).locator('.font-mono').innerText()

test('the five times are the Umm al-Qura ones, and the morning markers sit between them', async ({ page }) => {
  // 05:15 local — just after Fajr, so the window opens on today's Fajr and the
  // whole of today is on screen with no wrap and no duplicate row key.
  await setup(page, '2026-03-15T02:15:00Z')

  expect(await rowTime(page, 'fajr')).toBe('05:14')
  expect(await rowTime(page, 'dhuhr')).toBe('12:30')
  expect(await rowTime(page, 'asr')).toBe('15:54')
  expect(await rowTime(page, 'maghrib')).toBe('18:30')
  expect(await rowTime(page, 'isha')).toBe('20:00')

  // Sunrise is the END of Fajr, and Ḍuḥā is sunrise + 20 minutes. Neither is a
  // prayer with an adhan; they are markers, and they are only shown while it is
  // actually morning.
  expect(await rowTime(page, 'sunrise')).toBe('06:30')
  expect(await rowTime(page, 'duha')).toBe('06:50')
})

test('after Isha the next prayer is TOMORROW morning, not nothing', async ({ page }) => {
  // The classic way a prayer-times page breaks: `nextPrayer` answers "none"
  // once the last prayer of the day has passed, and a tool that takes that
  // literally shows an empty hero — or worse, a countdown that has run out —
  // for the several hours of the night when somebody is most likely to be
  // checking when Fajr is.
  await setup(page, '2026-03-15T18:00:00Z') // 21:00 local, an hour after Isha

  const hero = page.getByTestId('next-prayer')
  await expect(hero).toContainText('Next prayer')
  await expect(hero).toContainText('Fajr')
  // Tomorrow's Fajr (05:13), not today's (05:14) — a tool that recomputed the
  // SAME day would be a minute out here, which is exactly the bug this pins.
  await expect(page.getByTestId('hero-time')).toHaveText('05:13')
  // 21:00 to 05:13 is 8h 13m, and it must be counting DOWN to a future time.
  await expect(page.getByTestId('hero-count')).toHaveText('in 8h 13m')
})

test('during the iqama window the hero says it is time to pray, not how long until it', async ({ page }) => {
  // Two minutes after the Maghrib adhan. Announcing "next prayer: Isha, in 1h
  // 28m" at that moment is technically true and useless — the prayer being
  // called is the one happening now.
  await setup(page, '2026-03-15T15:32:00Z') // 18:32 local, Maghrib was 18:30

  const hero = page.getByTestId('next-prayer')
  await expect(hero).toContainText('Maghrib')
  await expect(hero).not.toContainText('Next prayer')
  await expect(page.getByTestId('hero-time')).toHaveText('18:30')
})

test('the morning markers are gone in the evening', async ({ page }) => {
  // Without this the marker case above would pass against a tool that showed
  // sunrise and Ḍuḥā at every hour of the day — including in the row where the
  // next prayer is Fajr, where "sunrise" is tomorrow's and reads as noise.
  await setup(page, '2026-03-15T18:00:00Z')
  await expect(page.getByTestId('prow-sunrise')).toHaveCount(0)
  await expect(page.getByTestId('prow-duha')).toHaveCount(0)
})

test('a chosen city survives a reload', async ({ page }) => {
  // Personalisation over preferences: the location is the one thing this tool
  // needs from a person, and asking twice is asking too often.
  await setup(page, '2026-03-15T02:15:00Z')
  await page.getByTestId('loc-chip').click()
  await page.getByTestId('loc-cities').getByRole('button', { name: 'Tabuk' }).click()
  await page.getByTestId('loc-save').click()
  await expect(page.getByTestId('loc-chip')).toContainText('Tabuk')

  // Tabuk is a long way north-west of Makkah, so the times must actually move.
  const fajrTabuk = await rowTime(page, 'fajr')
  expect(fajrTabuk).not.toBe('05:14')

  await page.reload()
  await expect(page.getByTestId('loc-chip')).toContainText('Tabuk')
  expect(await rowTime(page, 'fajr')).toBe(fajrTabuk)
})

test('in Arabic the times are in Arabic-Indic digits', async ({ page }) => {
  // An Arabic test that only asserts prose tests nothing about the Arabic
  // rendering of anything computed — and a time is computed.
  await setup(page, '2026-03-15T18:00:00Z', 'ar')
  const t = await page.getByTestId('hero-time').innerText()
  expect(t).toMatch(/[٠-٩]/)
  expect(t).not.toMatch(/[0-9]/)
})
