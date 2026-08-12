import { test, expect, type Page } from '@playwright/test'
import { readNumber } from './helpers'

// Domestic Worker Entitlements.
//
// Found by sweeping a vertical never swept — Musaned and the households that
// employ a domestic worker. It turned up a defect in OUR OWN catalogue rather
// than a gap in the market: the Labour Law expressly excludes domestic workers,
// and `end-of-service` and `leave-overtime` answered as though it did not.
//
// Every figure was computed independently before the spec was written.

const load = async (page: Page, locale = 'en') => {
  await page.goto(`/${locale}/apps/domestic-worker`)
  await expect(page.getByTestId('domestic-worker')).toBeVisible()
}

const fill = async (page: Page, wage: string, years: string) => {
  await page.getByTestId('dw-wage').fill(wage)
  await page.getByTestId('dw-years').fill(years)
}

test('one month per FOUR years, not per year', async ({ page }) => {
  await load(page)
  await fill(page, '1500', '8')
  // 8 years = 2 completed four-year periods = 2 x 1,500.
  expect(await readNumber(page, 'dw-periods')).toBe(2)
  expect(await readNumber(page, 'dw-reward')).toBe(3000)
})

test('nothing is due before the first four years are complete', async ({ page }) => {
  // A commercial source states "2 years minimum, then a month per year", which
  // would give 4,500 here. The official rule gives nothing.
  await load(page)
  await fill(page, '1500', '3')
  expect(await readNumber(page, 'dw-reward')).toBe(0)
  await expect(page.getByTestId('dw-next')).toContainText('1 year')
})

test('the Labour Law figure is shown beside it, and it is far larger', async ({ page }) => {
  // The reason the tool exists: our own end-of-service tool gives 8,250 here.
  await load(page)
  await fill(page, '1500', '8')
  await expect(page.getByTestId('dw-diff')).toContainText('8,250')
  await expect(page.getByTestId('dw-diff')).toContainText('2.8')
})

test('and the gap widens with service', async ({ page }) => {
  // Without this, the case above would pass against a hard-coded ratio.
  await load(page)
  await fill(page, '1500', '12')
  expect(await readNumber(page, 'dw-reward')).toBe(4500)
  await expect(page.getByTestId('dw-diff')).toContainText('3.2')
})

test('annual leave is due after two years, and says so before that', async ({ page }) => {
  await load(page)
  await fill(page, '1500', '1')
  await expect(page.getByTestId('dw-leave')).toContainText('becomes due')
  await fill(page, '1500', '2')
  await expect(page.getByTestId('dw-leave')).toContainText('round-trip ticket')
})

test('sick pay is split full then half', async ({ page }) => {
  await load(page)
  await fill(page, '1500', '8')
  const rights = page.getByTestId('dw-rights')
  await expect(rights).toContainText('50')   // full-pay day on a 1,500 wage
  await expect(rights).toContainText('25')   // half-pay day
})

test('it names the wage-protection change and refuses the part-period question', async ({ page }) => {
  await load(page)
  await expect(page.getByTestId('dw-wps')).toContainText('2026')
  // The `iqama-fees` rule: name what you will not compute.
  await expect(page.getByTestId('dw-partial')).toContainText('not stated')
})

test('it works in Arabic, and the numbers are Arabic too', async ({ page }) => {
  await load(page, 'ar')
  await fill(page, '1500', '8')
  expect(await readNumber(page, 'dw-reward')).toBe(3000)
  await expect(page.getByTestId('dw-wps')).toContainText('مساند')
  await expect(page.getByTestId('dw-reward')).not.toContainText(/[0-9]/)
})

test('it carries a legal disclaimer naming Musaned', async ({ page }) => {
  await load(page)
  const d = page.getByTestId('disclaimer')
  await expect(d).toHaveAttribute('data-kind', 'legal')
  await expect(d).toContainText('Musaned')
})

// --- the correctness fix in the two tools that were answering this wrongly.

test('the Labour Law end-of-service tool says it does NOT cover a domestic worker', async ({ page }) => {
  await page.goto('/en/apps/end-of-service')
  await expect(page.getByTestId('eos-domestic')).toContainText('expressly excludes')
  await page.getByTestId('eos-domestic-link').click()
  await expect(page).toHaveURL(/\/en\/apps\/domestic-worker\/?$/)
})

test('and so does the leave and overtime tool', async ({ page }) => {
  await page.goto('/en/apps/leave-overtime')
  await expect(page.getByTestId('lo-domestic')).toContainText('30 days after two years')
  await page.getByTestId('lo-domestic-link').click()
  await expect(page).toHaveURL(/\/en\/apps\/domestic-worker\/?$/)
})

test('both say it in Arabic too', async ({ page }) => {
  for (const id of ['end-of-service', 'leave-overtime']) {
    await page.goto(`/ar/apps/${id}`)
    const note = page.getByTestId(id === 'end-of-service' ? 'eos-domestic' : 'lo-domestic')
    expect(/[؀-ۿ]/.test((await note.innerText()).trim())).toBe(true)
    await expect(note).toContainText('العمالة المنزلية')
  }
})
