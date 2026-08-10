import { test, expect, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { readNumber } from './helpers'

// The 25% traffic-fine reduction under Article 75.
//
// Found by a web sweep of what changed in Saudi rules, and corroborated against
// the General Department of Traffic's own published FAQ (reported by Sabq,
// Al-Riyadh, Al-Yaum and Al-Mowaten) plus English summaries, before any number
// was encoded.
//
// The tool exists for one misreading: the 45 days are 30 to OBJECT plus 15 to
// PAY, running one after the other. Taken as concurrent they come to 30, and
// two weeks of the discount go for nothing.
//
// The clock is FIXED rather than installed — these are countdowns, and under a
// clock that advances an assertion measures how long the page took to load.

test.use({ timezoneId: 'Asia/Riyadh' })

const load = async (page: Page, locale = 'en') => {
  await page.clock.setFixedTime(new Date('2026-06-01T09:00:00'))
  await page.goto(`/${locale}/apps/traffic-fine`)
  await expect(page.getByTestId('traffic-fine')).toBeVisible()
}

const fill = async (page: Page, date: string, amount = '1000') => {
  await page.getByTestId('tf-date').fill(date)
  await page.getByTestId('tf-amount').fill(amount)
}

test('the discount runs 45 days, because 30 to object and 15 to pay are in series', async ({ page }) => {
  await load(page)
  await fill(page, '2026-05-20')
  // 20 May + 30 = 19 June to object; + 15 more = 4 July for the discount.
  await expect(page.getByTestId('tf-object-by')).toContainText('19 Jun 2026')
  await expect(page.getByTestId('tf-discount-until')).toContainText('4 Jul 2026')
  await expect(page.getByTestId('tf-pay-by')).toContainText('4 Jul 2026')
})

test('a fine in time costs 25% less, and the saving is named', async ({ page }) => {
  await load(page)
  await fill(page, '2026-05-20', '1000')
  expect(await readNumber(page, 'tf-payable')).toBe(750)
  await expect(page.getByTestId('tf-saved')).toContainText('250')
})

test('the 90-day extension carries the discount only 30 days further, not 90', async ({ page }) => {
  // The trap. The extension buys time to PAY; the reduction dies on day 75.
  await load(page)
  await fill(page, '2026-05-20', '1000')
  await page.getByTestId('tf-extended').check()
  // 4 July + 30 = 3 August for the discount; + 90 from 4 July = 2 October to pay.
  await expect(page.getByTestId('tf-discount-until')).toContainText('3 Aug 2026')
  await expect(page.getByTestId('tf-pay-by')).toContainText('2 Oct 2026')
  // Still discounted on 1 June, because day 75 has not arrived.
  expect(await readNumber(page, 'tf-payable')).toBe(750)
})

test('once the window has passed the full amount is due', async ({ page }) => {
  await load(page)
  // 1 January is far more than 45 days before the fixed 1 June.
  await fill(page, '2026-01-01', '1000')
  expect(await readNumber(page, 'tf-payable')).toBe(1000)
  await expect(page.getByTestId('tf-gone')).toBeVisible()
  await expect(page.getByTestId('tf-saved')).toHaveCount(0)
})

test('an excluded violation gets no reduction at any date', async ({ page }) => {
  // Without this the discount could be applied to every fine, which is the
  // assumption the excluded list exists to correct.
  await load(page)
  await fill(page, '2026-05-20', '1000')
  expect(await readNumber(page, 'tf-payable')).toBe(750)
  await page.getByTestId('tf-excluded').check()
  expect(await readNumber(page, 'tf-payable')).toBe(1000)
  await expect(page.getByTestId('tf-excl-note')).toBeVisible()
})

test('a violation before the scheme started is not covered, and says so', async ({ page }) => {
  await load(page)
  await fill(page, '2024-04-01', '1000')
  await expect(page.getByTestId('tf-before')).toBeVisible()
  expect(await readNumber(page, 'tf-payable')).toBe(1000)
})

test('the deadlines export to a calendar, all three of them', async ({ page }) => {
  await load(page)
  await fill(page, '2026-05-20')
  const dl = page.waitForEvent('download')
  await page.getByTestId('tf-ics').click()
  const path = await (await dl).path()
  const ics = readFileSync(path!, 'utf8')
  expect(ics).toContain('BEGIN:VCALENDAR')
  // Three events, each with its own uid — one uid across the file makes a
  // calendar treat them as the same event and keep only the last.
  const uids = ics.match(/UID:/g) ?? []
  expect(uids.length).toBe(3)
  expect(new Set(ics.match(/UID:.*/g)).size).toBe(3)
  expect(ics).toContain('20260619')
  expect(ics).toContain('20260704')
})

test('it refuses to pretend it can see your fines', async ({ page }) => {
  await load(page)
  await expect(page.getByTestId('tf-lookup')).toContainText('Absher')
})

test('the excluded list is written out rather than summarised', async ({ page }) => {
  await load(page)
  await expect(page.getByTestId('tf-excluded-list')).toContainText('periodic inspection')
  await expect(page.getByTestId('tf-excluded-list')).toContainText('drifting')
})

test('it works in Arabic, with Arabic-Indic digits', async ({ page }) => {
  await load(page, 'ar')
  await fill(page, '2026-05-20', '1000')
  const t = await page.getByTestId('tf-payable').innerText()
  expect(t).toMatch(/[٠-٩]/)
  expect(t).not.toMatch(/[0-9]/)
  expect(await readNumber(page, 'tf-payable')).toBe(750)
})
