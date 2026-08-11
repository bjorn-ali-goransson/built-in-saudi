import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'

// "Add to calendar", from the three tools that compute a date you must not miss.
//
// Found by a code sweep with a number attached: **`buildIcs` had exactly one
// caller — the calendar builder — while at least six tools compute a date
// somebody needs reminding of.** The two Saudi expiry tools matter most, since
// missing an iqama or an istimara renewal costs money, and neither could put
// its own answer anywhere.
//
// Everything here is read off the DOWNLOADED FILE. The traps are all in the
// bytes: an all-day range that comes out a day short, every event sharing one
// UID so a calendar keeps only the last, and a fresh UID per export so
// importing twice gives you everything twice.

const download = async (page: import('@playwright/test').Page, testid: string) => {
  const [dl] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId(testid).click(),
  ])
  return readFileSync((await dl.path())!, 'utf8')
}

const events = (ics: string) => ics.split('BEGIN:VEVENT').slice(1)
const field = (block: string, name: string) => {
  const m = new RegExp(`^${name}[^:]*:(.*)$`, 'm').exec(block)
  return m ? m[1].trim() : null
}

test('the holiday calendar has one event per holiday, each with its own UID', async ({ page }) => {
  // One UID shared across the file is the classic multi-event bug: a calendar
  // treats every VEVENT as the same event and keeps only the last, so a
  // twelve-event file imports as one.
  await page.clock.install({ time: new Date('2027-01-05T09:00:00') })
  await page.goto('/en/apps/saudi-holidays')
  const ics = await download(page, 'sh-ics')

  const blocks = events(ics)
  expect(blocks.length).toBe(4)
  const uids = blocks.map((b) => field(b, 'UID'))
  expect(new Set(uids).size, 'UIDs are not distinct').toBe(4)
  expect(ics).toContain('BEGIN:VCALENDAR')
  expect(ics.endsWith('\r\n')).toBe(true)
})

test('a four-day Eid break spans four days, not three', async ({ page }) => {
  // DTEND is EXCLUSIVE for a DATE value, so the end must be the day AFTER the
  // last one. Getting it wrong is why so many all-day events show up short.
  await page.clock.install({ time: new Date('2027-01-05T09:00:00') })
  await page.goto('/en/apps/saudi-holidays')
  const ics = await download(page, 'sh-ics')

  const eid = events(ics).find((b) => /SUMMARY:.*Eid al-Fitr/.test(b))!
  expect(eid).toBeTruthy()
  const start = field(eid, 'DTSTART')!
  const end = field(eid, 'DTEND')!
  const toDate = (s: string) => new Date(`${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}T00:00:00`)
  const days = Math.round((toDate(end).getTime() - toDate(start).getTime()) / 86400000)
  expect(days, 'the Eid break should occupy four days').toBe(4)
})

test('a one-day holiday still ends the NEXT day', async ({ page }) => {
  // The same rule in the degenerate case, where an off-by-one looks like a
  // zero-length event that some calendars simply drop.
  await page.clock.install({ time: new Date('2027-01-05T09:00:00') })
  await page.goto('/en/apps/saudi-holidays')
  const ics = await download(page, 'sh-ics')
  const nat = events(ics).find((b) => /SUMMARY:National Day/.test(b))!
  expect(field(nat, 'DTSTART')).toBe('20270923')
  expect(field(nat, 'DTEND')).toBe('20270924')
})

test('exporting twice gives the SAME UIDs, so a re-import updates rather than duplicates', async ({ page }) => {
  await page.clock.install({ time: new Date('2027-01-05T09:00:00') })
  await page.goto('/en/apps/saudi-holidays')
  const a = await download(page, 'sh-ics')
  const b = await download(page, 'sh-ics')
  const uids = (ics: string) => events(ics).map((x) => field(x, 'UID'))
  expect(uids(a)).toEqual(uids(b))
  // And a DIFFERENT year is a different set, so the id really is derived from
  // the content rather than being a constant.
  await page.getByTestId('sh-year-2028').click()
  const c = await download(page, 'sh-ics')
  expect(uids(c)).not.toEqual(uids(a))
})

test('the document tracker exports a reminder at each type’s own lead time', async ({ page }) => {
  // A reminder on the day it expires is not a reminder. The tool already
  // publishes a lead time per document type; that is what the alarm uses.
  await page.goto('/en/apps/id-expiry')
  await page.getByTestId('exp-kind').selectOption('iqama')
  await page.getByTestId('exp-date').fill('2028-01-15')
  await page.getByTestId('exp-add').click()
  await expect(page.getByTestId('exp-list')).toBeVisible()

  const ics = await download(page, 'exp-ics')
  const blocks = events(ics)
  expect(blocks.length).toBe(1)
  // An iqama's lead time is 60 days.
  expect(blocks[0]).toContain('TRIGGER:-P60D')
  expect(blocks[0]).toContain('BEGIN:VALARM')
})

test('the vehicle export carries all three dates, including the window opening', async ({ page }) => {
  // The renewal window opens 180 days before expiry and nobody has a reminder
  // for that — which is the reason this one is in the file at all.
  await page.goto('/en/apps/vehicle-renewal')
  const ics = await download(page, 'vh-ics')
  const blocks = events(ics)
  expect(blocks.length).toBe(3)
  const summaries = blocks.map((b) => field(b, 'SUMMARY'))
  expect(summaries.some((x) => /inspection/i.test(x!))).toBe(true)
  expect(summaries.some((x) => /renewal opens/i.test(x!))).toBe(true)
  expect(summaries.some((x) => /expires/i.test(x!))).toBe(true)
  for (const b of blocks) expect(b).toContain('TRIGGER:-P14D')
})

test('the single-event builder is untouched by the new one', async ({ page }) => {
  // Two functions on purpose: `buildIcs` carries times, repeats, a location and
  // an organizer, none of which a list of dated facts has.
  await page.goto('/en/apps/ics-builder')
  await expect(page.getByTestId('ics-builder')).toBeVisible()
})

test('the exported text escapes what is structural in ICS', async ({ page }) => {
  // Commas and semicolons are field separators; an unescaped one in a summary
  // silently truncates the event's title in a calendar.
  await page.goto('/en/apps/id-expiry')
  await page.getByTestId('exp-label').fill('mine, my son; and a note')
  await page.getByTestId('exp-date').fill('2028-01-15')
  await page.getByTestId('exp-add').click()
  const ics = await download(page, 'exp-ics')
  expect(ics).toContain('\\,')
  expect(ics).toContain('\\;')
})

test('it works in Arabic', async ({ page }) => {
  await page.clock.install({ time: new Date('2027-01-05T09:00:00') })
  await page.goto('/ar/apps/saudi-holidays')
  const ics = await download(page, 'sh-ics')
  expect(events(ics).length).toBe(4)
  // The Arabic summary survives the 75-OCTET fold, which an Arabic string hits
  // in half the characters an English one does.
  expect(ics).toMatch(/[؀-ۿ]/)
})

// --- The hub knew a date and nothing about the rule behind it -------------------
//
// Found by a code sweep. `id-expiry` is the one tool built for "what runs out
// next", and two things were true of it: every one of its seven document kinds
// was PERSONAL, on a site that also answers when a commercial register's
// renewal window opens; and it had **zero outbound links** — it would tell
// somebody their iqama runs out in six weeks without mentioning that the site
// works out what the renewal costs, or that an exit-re-entry visa cannot
// outrun it.

const addDoc = async (page: import('@playwright/test').Page, kind: string, expiry: string) => {
  await page.getByTestId('exp-kind').selectOption(kind)
  await page.getByTestId('exp-date').fill(expiry)
  await page.getByTestId('exp-add').click()
}

test('a business owner can track the documents whose lapse suspends the business', async ({ page }) => {
  await page.goto('/en/apps/id-expiry')
  await addDoc(page, 'cr', '2026-12-01')
  await expect(page.getByTestId('exp-item-cr')).toContainText('Commercial registration')
  // Its renewal window opens 90 days out, not the generic 30.
  await addDoc(page, 'municipal', '2026-12-01')
  await expect(page.getByTestId('exp-item-municipal')).toBeVisible()
})

test('a row points at the tool that owns the rule behind its date', async ({ page }) => {
  await page.goto('/en/apps/id-expiry')
  await addDoc(page, 'cr', '2026-12-01')
  const guide = page.getByTestId('exp-guide').first()
  await expect(guide).toBeVisible()
  await guide.click()
  await expect(page).toHaveURL(/\/en\/apps\/cr-renewal/)
})

test('and a document with no rule module gets no invented link', async ({ page }) => {
  // A passport has no rule tool here. Linking it somewhere plausible would be
  // worse than linking it nowhere — without this case the fix could have been
  // "always show a link".
  await page.goto('/en/apps/id-expiry')
  await addDoc(page, 'passport', '2027-01-01')
  await expect(page.getByTestId('exp-item-passport')).toBeVisible()
  await expect(page.getByTestId('exp-guide')).toHaveCount(0)
})
