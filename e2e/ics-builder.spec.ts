import { test, expect } from '@playwright/test'

async function make(page: import('@playwright/test').Page, locale = 'en') {
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.goto(`/${locale}/apps/ics-builder`)
  await expect(page.getByTestId('ics-output')).toBeVisible()
}
const text = (page: import('@playwright/test').Page) => page.getByTestId('ics-output').innerText()

test('folds long lines at 75 octets, counted in bytes', async ({ page }) => {
  // The step most generators skip, and the reason a long description makes
  // Outlook reject the file. The limit is octets, so Arabic hits it in half the
  // characters English does — which is why this checks both.
  await make(page)
  await page.getByTestId('ics-description').fill('x'.repeat(300))
  const ics = await text(page)
  const enc = new TextEncoder()
  for (const line of ics.split('\n')) {
    expect(enc.encode(line.replace(/\r$/, '')).length).toBeLessThanOrEqual(75)
  }
  // Continuation lines begin with exactly one space.
  expect(ics).toMatch(/\n [x]/)

  await page.getByTestId('ics-description').fill('م'.repeat(200))
  const arabic = await text(page)
  for (const line of arabic.split('\n')) {
    expect(enc.encode(line.replace(/\r$/, '')).length).toBeLessThanOrEqual(75)
  }
})

test('escapes the characters that are structural in the format', async ({ page }) => {
  await make(page)
  // A comma, a semicolon and a backslash are all structural in RFC 5545 — left
  // raw, the semicolon starts a parameter and the rest of the title vanishes.
  await page.getByTestId('ics-summary').fill(String.raw`Lunch, then a review; part 2\3`)
  const ics = await text(page)
  expect(ics).toContain(String.raw`SUMMARY:Lunch\, then a review\; part 2\\3`)
})

test('an all-day event is a date, and its end is the day after', async ({ page }) => {
  await make(page)
  await page.getByTestId('ics-date').fill('2026-03-10')
  await page.getByTestId('ics-all-day').check()
  const ics = await text(page)
  expect(ics).toContain('DTSTART;VALUE=DATE:20260310')
  // DTEND is exclusive for dates: a single-day event ends on the 11th, or it
  // shows up a day short in every calendar that reads it correctly.
  expect(ics).toContain('DTEND;VALUE=DATE:20260311')
  expect(ics).not.toContain('T000000')
})

test('a timed event is written as UTC so the moment travels', async ({ page }) => {
  await make(page)
  await page.getByTestId('ics-date').fill('2026-03-10')
  await page.getByTestId('ics-start').fill('09:00')
  await page.getByTestId('ics-end').fill('10:30')
  const ics = await text(page)
  expect(ics).toMatch(/DTSTART:\d{8}T\d{6}Z/)
  expect(ics).toMatch(/DTEND:\d{8}T\d{6}Z/)
})

test('rejects an end before the start instead of emitting a broken file', async ({ page }) => {
  await make(page)
  await page.getByTestId('ics-start').fill('14:00')
  await page.getByTestId('ics-end').fill('09:00')
  await expect(page.getByTestId('ics-error')).toContainText('end is before the start')
  await expect(page.getByTestId('ics-download')).toBeDisabled()
})

test('repeats and reminders come out as RRULE and VALARM', async ({ page }) => {
  await make(page)
  await page.getByTestId('ics-repeat').selectOption('weekly')
  await page.getByTestId('ics-count').fill('8')
  await page.getByTestId('ics-alarm').selectOption('30')
  const ics = await text(page)
  expect(ics).toContain('RRULE:FREQ=WEEKLY;COUNT=8')
  expect(ics).toContain('BEGIN:VALARM')
  expect(ics).toContain('TRIGGER:-PT30M')
})

test('reads back what it wrote, unfolding and unescaping', async ({ page }) => {
  await make(page)
  await page.getByTestId('ics-summary').fill('Review, round 2')
  await page.getByTestId('ics-description').fill('y'.repeat(200))
  await page.getByTestId('ics-copy').click()
  const ics = await page.evaluate(() => navigator.clipboard.readText())

  await page.getByTestId('ics-tab-read').click()
  await page.getByTestId('ics-raw').fill(ics)
  await expect(page.getByTestId('ics-found')).toContainText('1 event')
  // The comma survives the round trip, and the folded description is rejoined.
  await expect(page.getByTestId('ics-event-0')).toContainText('Review, round 2')
})

test('reads a file it did not write, including one from a real calendar', async ({ page }) => {
  await make(page)
  await page.getByTestId('ics-tab-read').click()
  await page.getByTestId('ics-raw').fill([
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'BEGIN:VEVENT',
    'UID:abc@example.com',
    'DTSTART:20260401T060000Z',
    'DTEND:20260401T070000Z',
    String.raw`SUMMARY:Standup\, daily`,
    'LOCATION:Meeting room 3',
    'RRULE:FREQ=DAILY;COUNT=5',
    'END:VEVENT', 'END:VCALENDAR',
  ].join('\r\n'))
  const row = page.getByTestId('ics-event-0')
  await expect(row).toContainText('Standup, daily')
  await expect(row).toContainText('Meeting room 3')
  await expect(row).toContainText('FREQ=DAILY')
})

test('text that is not a calendar says so', async ({ page }) => {
  await make(page)
  await page.getByTestId('ics-tab-read').click()
  await page.getByTestId('ics-raw').fill('just some notes I pasted')
  await expect(page.getByTestId('ics-none')).toBeVisible()
})

test('downloads a file named after the event', async ({ page }) => {
  await make(page)
  await page.getByTestId('ics-summary').fill('Team meeting')
  const dl = page.waitForEvent('download')
  await page.getByTestId('ics-download').click()
  expect((await dl).suggestedFilename()).toBe('Team-meeting.ics')
})

test('works in Arabic too', async ({ page }) => {
  await make(page, 'ar')
  await page.getByTestId('ics-summary').fill('اجتماع الفريق')
  await expect(page.getByTestId('ics-output')).toContainText('اجتماع الفريق')
})
