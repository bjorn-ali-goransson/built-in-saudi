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

