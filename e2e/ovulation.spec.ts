import { test, expect } from '@playwright/test'

// Ovulation. Found by a web sweep of the health-calculator market — 124 on one
// site, 71 on another — where this is a staple and we had none, having just
// shipped its sibling `due-date`. Two things carry it, and both are corrections
// rather than arithmetic.

const setUp = async (page: import('@playwright/test').Page, date: string, cycle: number, locale = 'en') => {
  await page.goto(`/${locale}/apps/ovulation`)
  await page.getByTestId('ov-date').fill(date)
  await page.getByTestId('ov-cycle').fill(String(cycle))
}

test('on a 28-day cycle ovulation lands on day 14', async ({ page }) => {
  // The case everyone knows — and the control for the next test, which is the
  // one that matters.
  await setUp(page, '2026-03-01', 28)
  await expect(page.getByTestId('ov-ovulation')).toContainText('14 March 2026')
  await expect(page.getByTestId('ov-next')).toContainText('29 March 2026')
})

test('on a 35-day cycle it is day 21, not day 14', async ({ page }) => {
  // Counted back from the NEXT period, because the luteal phase is the steady
  // half. A calculator that adds 14 to the last period tells a woman with a
  // long cycle to try a week early — the commonest error in this category.
  await setUp(page, '2026-03-01', 35)
  await expect(page.getByTestId('ov-ovulation')).toContainText('21 March 2026')
  await expect(page.getByTestId('ov-day14')).toContainText('day 21')
  await expect(page.getByTestId('ov-day14')).toContainText('7 days early')
})

test('and on a short cycle it moves the other way', async ({ page }) => {
  // Without this the previous test would pass against something that always
  // adds a week.
  await setUp(page, '2026-03-01', 21)
  // Day 21 - 14 = day 7, which is 7 March when day 1 is 1 March. The first
  // version of this expected the 8th and was my arithmetic, not the tool's.
  await expect(page.getByTestId('ov-ovulation')).toContainText('7 March 2026')
  await expect(page.getByTestId('ov-day14')).toContainText('late')
})

test('the fertile window ENDS at ovulation, and is six days long', async ({ page }) => {
  // Sperm survive up to five days and an egg about one, so the days that matter
  // are the five before ovulation plus the day itself. Waiting for the
  // ovulation date is how people miss the window they were aiming at.
  await setUp(page, '2026-03-01', 28)
  await expect(page.getByTestId('ov-window')).toContainText('9 Mar')
  await expect(page.getByTestId('ov-window')).toContainText('14 March 2026')
  await expect(page.getByTestId('ov-days').locator('span')).toHaveCount(6)
  await expect(page.getByTestId('ov-before')).toContainText('before ovulation')
})

test('a 28-day cycle is told WHY "day 14" is repeated so often', async ({ page }) => {
  // The two rules coincide at 28 days, which is exactly why the wrong one
  // spread. Saying "they happen to be the same day" is more useful than
  // silence, and it is only true here.
  await setUp(page, '2026-03-01', 28)
  await expect(page.getByTestId('ov-day14')).toContainText('happen to be the same day')
})

test('a test date is the missed period, not the fertile window', async ({ page }) => {
  await setUp(page, '2026-03-01', 28)
  await expect(page.getByTestId('ov-test')).toContainText('29 March 2026')
})

test('the luteal phase is adjustable, and moves ovulation', async ({ page }) => {
  await setUp(page, '2026-03-01', 28)
  await page.getByTestId('ov-luteal').fill('12')
  // Next period unchanged at 29 March; ovulation 12 days before it.
  await expect(page.getByTestId('ov-ovulation')).toContainText('16 March 2026')
  await expect(page.getByTestId('ov-next')).toContainText('29 March 2026')
})

test('it links to its sibling rather than duplicating it', async ({ page }) => {
  await setUp(page, '2026-03-01', 28)
  await page.getByTestId('ov-due-date').click()
  await expect(page).toHaveURL(/\/en\/apps\/due-date$/)
})

test('carries the medical disclaimer, and admits what a calendar cannot know', async ({ page }) => {
  await setUp(page, '2026-03-01', 28)
  const d = page.getByTestId('disclaimer')
  await expect(d).toHaveAttribute('data-kind', 'medical')
  await expect(d).toContainText('cannot tell you whether you ovulated')
})

test('works in Arabic, with the Hijri dates', async ({ page }) => {
  await setUp(page, '2026-03-01', 35, 'ar')
  await expect(page.getByTestId('ov-window-hijri')).toContainText('١٤')
  await expect(page.getByTestId('ov-day14')).toContainText('٢١')
})
