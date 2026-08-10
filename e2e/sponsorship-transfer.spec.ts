import { test, expect } from '@playwright/test'
import { readNumber } from './helpers'

// Sponsorship transfer (نقل الكفالة).
//
// Found by a web sweep of what changed in Saudi rules for individuals in 2026.
// The fee is corroborated across independent legal summaries — 2,000 / 4,000 /
// 6,000 by the WORKER's transfer count, then 6,000 thereafter — as is Article
// 40 putting it on the new employer, and the 60-day window after a contract
// ends.
//
// Every date case pins the clock: a deadline tool that reads today's date is
// asserting the season, which this repo has already paid for twice.

const load = async (page: import('@playwright/test').Page, locale = 'en', at = '2026-06-01') => {
  await page.clock.install({ time: new Date(`${at}T09:00:00`) })
  await page.goto(`/${locale}/apps/sponsorship-transfer`)
  await expect(page.getByTestId('sponsorship-transfer')).toBeVisible()
}

test('the fee is TIERED, not the flat 2,000 everybody quotes', async ({ page }) => {
  await load(page)
  expect(await readNumber(page, 'st-fee')).toBe(2000)
  await page.getByTestId('st-prev-1').click()
  expect(await readNumber(page, 'st-fee')).toBe(4000)
  await page.getByTestId('st-prev-2').click()
  expect(await readNumber(page, 'st-fee')).toBe(6000)
})

test('and it stops climbing at 6,000 rather than running away', async ({ page }) => {
  await load(page)
  await page.getByTestId('st-prev-3').click()
  expect(await readNumber(page, 'st-fee')).toBe(6000)
})

test('planning two more adds the right two tiers, not double the first', async ({ page }) => {
  await load(page)
  // From zero: 2,000 + 4,000.
  expect(await readNumber(page, 'st-two')).toBe(6000)
  await page.getByTestId('st-prev-2').click()
  // From two: 6,000 + 6,000.
  expect(await readNumber(page, 'st-two')).toBe(12000)
})

test('the most useful thing on the page is that it is not the worker’s money', async ({ page }) => {
  // The same shape as `iqama-fees` naming the work-permit levy: a number is
  // less useful than knowing who owes it.
  await load(page)
  await expect(page.getByTestId('st-article40')).toContainText('40')
  await expect(page.getByTestId('st-article40')).toContainText('new employer')
})

test('any one of the named grounds removes the need for consent', async ({ page }) => {
  // Independent legal routes with the same consequence, so they are separate
  // yes/no grounds rather than a choice between them.
  await load(page)
  await expect(page.getByTestId('st-consent')).toContainText('needs your current employer')
  await page.getByTestId('st-ground-wagesUnpaid').check()
  await expect(page.getByTestId('st-consent')).toContainText('without your current employer')
  await page.getByTestId('st-ground-wagesUnpaid').uncheck()
  await expect(page.getByTestId('st-consent')).toContainText('needs your current employer')
  await page.getByTestId('st-ground-contractExpired').check()
  await expect(page.getByTestId('st-consent')).toContainText('without your current employer')
})

test('the 60-day window is counted from the contract end', async ({ page }) => {
  await load(page, 'en', '2026-06-01')
  await page.getByTestId('st-end').fill('2026-05-15')
  // 15 May + 60 days = 14 July; from 1 June that is 43 days away.
  await expect(page.getByTestId('st-deadline')).toContainText('14 July 2026')
  await expect(page.getByTestId('st-deadline')).toContainText('43 days left')
})

test('a window that has closed says so, rather than counting down to the past', async ({ page }) => {
  // Both directions: without a case where it has NOT passed, a hard-coded
  // warning would pass the first one.
  await load(page, 'en', '2026-09-01')
  await page.getByTestId('st-end').fill('2026-05-15')
  await expect(page.getByTestId('st-deadline')).toContainText('window has closed')
})

test('the deadline exports to a calendar with a reminder ahead of it', async ({ page }) => {
  await load(page, 'en', '2026-06-01')
  await page.getByTestId('st-end').fill('2026-05-15')
  const [dl] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('st-ics').click(),
  ])
  const fs = await import('node:fs')
  const ics = fs.readFileSync((await dl.path())!, 'utf8')
  expect(ics).toContain('DTSTART;VALUE=DATE:20260714')
  // Exclusive end, as a DATE value requires.
  expect(ics).toContain('DTEND;VALUE=DATE:20260715')
  expect(ics).toContain('TRIGGER:-P14D')
})

test('the number it REFUSES to compute is named', async ({ page }) => {
  // One source reports a maximum of four transfers and the others do not
  // mention it. An uncorroborated figure does not go in — the `iqama-fees`
  // rule — and a tool that invented a cap would tell somebody their case is
  // impossible when it may not be.
  await load(page)
  await expect(page.getByTestId('st-cap')).toContainText('four')
  await expect(page.getByTestId('st-cap')).toContainText('does not apply a cap')
})

test('it shows both calendars, because the card may be either', async ({ page }) => {
  await load(page, 'en', '2026-06-01')
  await page.getByTestId('st-end').fill('2026-05-15')
  await expect(page.getByTestId('st-deadline-hijri')).toContainText('AH')
})

test('it works in Arabic, with Arabic-Indic digits in the fee', async ({ page }) => {
  await load(page, 'ar')
  const t = await page.getByTestId('st-fee').textContent()
  expect(t).toMatch(/[٠-٩]/)
  expect(t).not.toMatch(/[0-9]/)
  expect(await readNumber(page, 'st-fee')).toBe(2000)
})
