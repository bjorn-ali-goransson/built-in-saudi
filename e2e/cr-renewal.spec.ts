import { test, expect, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'

// Commercial registration renewal.
//
// Found by sweeping what a small BUSINESS here must work out — every earlier
// Saudi sweep had mined what an individual must. Figures corroborated across
// several independent Ministry-of-Commerce summaries before being encoded.
//
// The tool exists for one misreading: renewal opens 90 days BEFORE expiry and
// there is a further 90 days AFTER it, so the deadline gets treated as six
// months. It is not — fines run from the expiry date, the business trades on a
// lapsed register throughout, and past the grace the commercial identity can be
// cancelled, which is not a fine but starting again.
//
// The clock is FIXED, not installed: these are countdowns, and under a clock
// that advances an assertion measures page-load time.

test.use({ timezoneId: 'Asia/Riyadh' })

const load = async (page: Page, expiry: string, locale = 'en') => {
  await page.clock.setFixedTime(new Date('2026-06-01T09:00:00'))
  await page.goto(`/${locale}/apps/cr-renewal`)
  await expect(page.getByTestId('cr-renewal')).toBeVisible()
  await page.getByTestId('cr-expiry').fill(expiry)
}

test('the four phases are distinguished, not collapsed into "renew soon"', async ({ page }) => {
  // Too early to renew.
  await load(page, '2026-12-01')
  await expect(page.getByTestId('cr-phase')).toHaveAttribute('data-phase', 'early')

  // Inside the 90 days before expiry.
  await page.getByTestId('cr-expiry').fill('2026-07-15')
  await expect(page.getByTestId('cr-phase')).toHaveAttribute('data-phase', 'open')

  // Expired, but inside the grace.
  await page.getByTestId('cr-expiry').fill('2026-05-01')
  await expect(page.getByTestId('cr-phase')).toHaveAttribute('data-phase', 'grace')

  // Past the grace.
  await page.getByTestId('cr-expiry').fill('2026-01-01')
  await expect(page.getByTestId('cr-phase')).toHaveAttribute('data-phase', 'lapsed')
})

test('the window opens exactly 90 days before, and the grace ends 90 days after', async ({ page }) => {
  await load(page, '2026-09-01')
  // 1 Sep minus 90 days = 3 June; plus 90 = 30 November.
  await expect(page.getByTestId('cr-opens')).toContainText('3 Jun 2026')
  await expect(page.getByTestId('cr-grace')).toContainText('30 Nov 2026')
})

test('the grace period says outright that it is not an extension', async ({ page }) => {
  await load(page, '2026-05-01')
  await expect(page.getByTestId('cr-phase')).toContainText('fines are already running')
  await expect(page.getByTestId('cr-grace-note')).toContainText('not')
  await expect(page.getByTestId('cr-grace-note')).toContainText('cancelled')
})

test('an unpaid Chamber subscription is shown as the blocker it is', async ({ page }) => {
  // Same shape as a lapsed Fahes blocking an istimara renewal: a prerequisite
  // that makes an otherwise available renewal fail on the day.
  await load(page, '2026-07-15')
  await expect(page.getByTestId('cr-blocked')).toHaveCount(0)
  await page.getByTestId('cr-chamber').uncheck()
  await expect(page.getByTestId('cr-blocked')).toContainText('Chamber')
})

test('it refuses to total the fee, and says which parts it cannot see', async ({ page }) => {
  // Third tool to make this call. The Chamber subscription is banded by capital
  // and activity and the municipal licence is per square metre by zone.
  await load(page, '2026-07-15')
  await expect(page.getByTestId('cr-fee')).toContainText('200')
  await expect(page.getByTestId('cr-fee')).toContainText('cannot see')
})

test('the three dates export to a calendar, each with its own uid', async ({ page }) => {
  await load(page, '2026-09-01')
  const dl = page.waitForEvent('download')
  await page.getByTestId('cr-ics').click()
  const ics = readFileSync((await (await dl).path())!, 'utf8')
  const uids = ics.match(/UID:.*/g) ?? []
  expect(uids.length).toBe(3)
  expect(new Set(uids).size).toBe(3)
  expect(ics).toContain('20260603')
  expect(ics).toContain('20261130')
})

test('it works in Arabic, with Arabic-Indic digits in the dates', async ({ page }) => {
  await load(page, '2026-09-01', 'ar')
  const t = await page.getByTestId('cr-opens').innerText()
  expect(t).toMatch(/[٠-٩]/)
  expect(t).not.toMatch(/[0-9]/)
})
