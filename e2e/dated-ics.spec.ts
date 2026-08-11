import { test, expect, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'

// Two tools that compute a date somebody needs reminding of, and could not put
// it anywhere.
//
// `lib/ics.ts` was generalised out of the calendar builder precisely because
// "at least six tools compute a date somebody needs reminding of, and the
// writer had exactly one caller". Five tools export now; these are the sixth
// and seventh, and each carries its own judgement about what the reminder
// should SAY — which is the part that is not boilerplate.

test.use({ timezoneId: 'Asia/Riyadh' })

const icsFrom = async (page: Page, testid: string) => {
  const dl = page.waitForEvent('download')
  await page.getByTestId(testid).click()
  return readFileSync((await (await dl).path())!, 'utf8')
}

/** Every DATE-valued line in the file, as YYYYMMDD. */
const dates = (ics: string, key: 'DTSTART' | 'DTEND') =>
  (ics.match(new RegExp(`${key};VALUE=DATE:(\\d{8})`, 'g')) ?? [])
    .map((l) => l.slice(-8))

test.describe('ovulation', () => {
  const open = async (page: Page) => {
    await page.goto('/en/apps/ovulation')
    await page.getByTestId('ov-date').fill('2026-03-01')
    await page.getByTestId('ov-cycle').fill('28')
  }

  test('the fertile window exports as a RANGE, ending the day after the last day', async ({ page }) => {
    // DTEND is EXCLUSIVE for a DATE value. The window is six days — five before
    // ovulation plus the day itself — so a file whose DTEND is the last day
    // would silently give five, losing the day that matters most.
    await open(page)
    const ics = await icsFrom(page, 'ov-ics')
    const starts = dates(ics, 'DTSTART')
    const ends = dates(ics, 'DTEND')
    expect(starts.length).toBe(3)
    // Day 1 IS the first day of bleeding, so on a 28-day cycle from 1 March
    // ovulation is cycle day 14 = 14 March — not 15, which is the off-by-one
    // `ovulation.ts` already records having got wrong once. The window opens
    // five days earlier on 9 March and runs through the 14th, so DTEND — being
    // exclusive — is the 15th.
    expect(starts[0]).toBe('20260309')
    expect(ends[0]).toBe('20260315')
  })

  test('each event has its own uid, or a calendar keeps only the last', async ({ page }) => {
    await open(page)
    const ics = await icsFrom(page, 'ov-ics')
    const uids = ics.match(/UID:.*/g) ?? []
    expect(uids.length).toBe(3)
    expect(new Set(uids).size).toBe(3)
  })

  test('the wording can be made discreet, and is shown before anything downloads', async ({ page }) => {
    // A calendar is often the one thing on a screen other people see — mirrored
    // to a work laptop, open in a meeting.
    await open(page)
    await expect(page.getByTestId('ov-ics-preview')).toContainText('Fertile window')
    await page.getByTestId('ov-discreet').check()
    await expect(page.getByTestId('ov-ics-preview')).toContainText('Personal')
    const ics = await icsFrom(page, 'ov-ics')
    expect(ics).toContain('SUMMARY:Personal')
    expect(ics).not.toContain('Fertile')
  })
})

test.describe('due date', () => {
  const open = async (page: Page) => {
    await page.goto('/en/apps/due-date')
    await page.getByTestId('dd-date').fill('2026-01-01')
  }

  test('the full-term WINDOW is exported, not only the date', async ({ page }) => {
    // About 1 baby in 25 arrives on the due date and 37–42 weeks is all full
    // term. A calendar carrying one dated entry teaches the opposite of what
    // the page says three inches below it.
    await open(page)
    const ics = await icsFrom(page, 'dd-ics')
    expect(dates(ics, 'DTSTART').length).toBe(2)
    // LMP 1 Jan + 259 days = 17 Sep; + 294 = 22 Oct, so DTEND is 23 Oct.
    expect(dates(ics, 'DTSTART')[0]).toBe('20260917')
    expect(dates(ics, 'DTEND')[0]).toBe('20261023')
    // And the due date itself is in there, worded as a midpoint.
    expect(ics).toContain('20261008')
    expect(ics).toMatch(/SUMMARY:Estimated due date/)
  })

  test('the reason the window is included is stated on the page', async ({ page }) => {
    await open(page)
    await expect(page.getByTestId('dd-ics-why')).toContainText('appointment')
  })
})
