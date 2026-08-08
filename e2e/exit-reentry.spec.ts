import { test, expect } from '@playwright/test'
import { readNumber } from './helpers'

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
/** Local, not UTC — see the id-expiry note in CLAUDE.md. */
const inDays = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return iso(d) }

async function open(page: import('@playwright/test').Page, o: { depart?: string; ret?: string; iqama?: string } = {}, locale = 'en') {
  await page.goto(`/${locale}/apps/exit-reentry`)
  await expect(page.getByTestId('exit-reentry')).toBeVisible()
  if (o.iqama) await page.getByTestId('er-iqama').fill(o.iqama)
  if (o.depart) await page.getByTestId('er-depart').fill(o.depart)
  if (o.ret) await page.getByTestId('er-return').fill(o.ret)
}


test.describe('exit and re-entry visa fee', () => {
  test('a trip inside the base period costs only the base', async ({ page }) => {
    // Single: 200 covers two months, so 45 days is 200 and nothing more.
    await open(page, { depart: inDays(10), ret: inDays(55), iqama: inDays(400) })
    expect(await readNumber(page, 'er-total')).toBe(200)
    await expect(page.getByTestId('er-months')).toContainText('2 months')
  })

  test('31 days costs the same as 60, and 61 costs a month more', async ({ page }) => {
    // The step nobody sees coming: whole 30-day blocks, not pro rata.
    await open(page, { depart: inDays(10), ret: inDays(41), iqama: inDays(400) })
    expect(await readNumber(page, 'er-total')).toBe(200)
    await page.getByTestId('er-return').fill(inDays(70))
    expect(await readNumber(page, 'er-total')).toBe(200)
    await page.getByTestId('er-return').fill(inDays(71))
    expect(await readNumber(page, 'er-total')).toBe(300)
    await expect(page.getByTestId('er-months')).toContainText('3 months')
  })

  test('it warns how close you are to the next step', async ({ page }) => {
    await open(page, { depart: inDays(10), ret: inDays(69), iqama: inDays(400) })
    // 59 days used of the 60-day block: two days take it over.
    await expect(page.getByTestId('er-edge')).toContainText('2 more days')
    await expect(page.getByTestId('er-edge')).toContainText('100')
  })

  test('a multiple visa has its own base and its own monthly rate', async ({ page }) => {
    await open(page, { depart: inDays(10), ret: inDays(100), iqama: inDays(400) })
    await page.getByTestId('er-multiple').click()
    // 90 days = 3 months, all inside the base. 500 flat.
    expect(await readNumber(page, 'er-total')).toBe(500)
    await page.getByTestId('er-return').fill(inDays(101))
    // A fourth month at 200.
    expect(await readNumber(page, 'er-total')).toBe(700)
  })

  test('applying from abroad doubles each extra month', async ({ page }) => {
    await open(page, { depart: inDays(10), ret: inDays(71), iqama: inDays(400) })
    expect(await readNumber(page, 'er-total')).toBe(300)
    await page.getByTestId('er-outside').click()
    // The extra month becomes 200, not 100 — the base is unchanged.
    expect(await readNumber(page, 'er-total')).toBe(400)
  })

  test('a trip past the iqama is refused before the fee is discussed', async ({ page }) => {
    await open(page, { depart: inDays(10), ret: inDays(200), iqama: inDays(100) })
    const blocked = page.getByTestId('er-blocked')
    await expect(blocked).toBeVisible()
    await expect(blocked).toContainText('cannot be issued beyond it')
    // And it says the longest trip this iqama does allow, rather than only "no".
    await expect(blocked).toContainText('90 days')
  })

  test('renewing the iqama clears the block', async ({ page }) => {
    await open(page, { depart: inDays(10), ret: inDays(200), iqama: inDays(100) })
    await expect(page.getByTestId('er-blocked')).toBeVisible()
    await page.getByTestId('er-iqama').fill(inDays(400))
    await expect(page.getByTestId('er-blocked')).toHaveCount(0)
  })

  test('it carries an official disclaimer naming what it cannot see', async ({ page }) => {
    await open(page)
    const d = page.getByTestId('disclaimer')
    await expect(d).toHaveAttribute('data-kind', 'official')
    await expect(d).toContainText('fines')
  })

  test('it works in Arabic', async ({ page }) => {
    await open(page, { depart: inDays(10), ret: inDays(200), iqama: inDays(100) }, 'ar')
    await expect(page.getByTestId('er-blocked')).toContainText('إقامتك تنتهي أولًا')
  })
})
