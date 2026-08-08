import { test, expect } from '@playwright/test'

// Found by measuring untuned search queries: "stopwatch" returned nothing,
// because countdown counts down to a date and pomodoro runs fixed sprints.

async function open(page: import('@playwright/test').Page, locale = 'en') {
  await page.goto(`/${locale}/apps/stopwatch`)
  await expect(page.getByTestId('stopwatch')).toBeVisible()
}

/** mm:ss.t -> milliseconds, so assertions can be about elapsed time. */
async function shownMs(page: import('@playwright/test').Page): Promise<number> {
  const t = await page.getByTestId('sw-display').innerText()
  const m = /^(?:(\d+):)?(\d+):(\d+)\.(\d)$/.exec(t.trim())
  if (!m) throw new Error(`unexpected display: ${t}`)
  return (Number(m[1] ?? 0) * 3600 + Number(m[2]) * 60 + Number(m[3])) * 1000 + Number(m[4]) * 100
}

test.describe('stopwatch and timer', () => {
  test('the stopwatch counts up from zero', async ({ page }) => {
    await open(page)
    expect(await shownMs(page)).toBe(0)
    await page.getByTestId('sw-start').click()
    await page.waitForTimeout(1200)
    const after = await shownMs(page)
    expect(after).toBeGreaterThanOrEqual(1000)
    expect(after).toBeLessThan(3000)
  })

  test('stopping holds the time, and resuming carries on from it', async ({ page }) => {
    await open(page)
    await page.getByTestId('sw-start').click()
    await page.waitForTimeout(900)
    await page.getByTestId('sw-stop').click()
    const held = await shownMs(page)
    await page.waitForTimeout(600)
    // Paused means paused: no drift while stopped.
    expect(await shownMs(page)).toBe(held)
    await page.getByTestId('sw-start').click()
    await page.waitForTimeout(700)
    expect(await shownMs(page)).toBeGreaterThan(held)
  })

  test('laps record splits, not just running totals', async ({ page }) => {
    await open(page)
    await page.getByTestId('sw-start').click()
    await page.waitForTimeout(600)
    await page.getByTestId('sw-lap').click()
    await page.waitForTimeout(600)
    await page.getByTestId('sw-lap').click()
    await expect(page.getByTestId('sw-lap-0')).toBeVisible()
    await expect(page.getByTestId('sw-lap-1')).toBeVisible()
    const second = await page.getByTestId('sw-lap-1').innerText()
    // Split and total differ on the second lap; if they matched, the split
    // would just be the running total wearing a different label.
    const cells = second.split('\t').filter(Boolean)
    expect(cells[1]).not.toBe(cells[2])
  })

  test('reset clears the clock and the laps', async ({ page }) => {
    await open(page)
    await page.getByTestId('sw-start').click()
    await page.waitForTimeout(400)
    await page.getByTestId('sw-lap').click()
    await page.getByTestId('sw-reset').click()
    expect(await shownMs(page)).toBe(0)
    await expect(page.getByTestId('sw-laps')).toHaveCount(0)
  })

  test('the timer counts down and announces the end', async ({ page }) => {
    await open(page)
    await page.getByTestId('sw-down').click()
    await page.getByTestId('sw-minutes').fill('0')
    await page.getByTestId('sw-seconds').fill('2')
    expect(await shownMs(page)).toBe(2000)
    await page.getByTestId('sw-start').click()
    await expect(page.getByTestId('sw-done')).toBeVisible({ timeout: 6000 })
    // It stops at zero rather than counting into negative time.
    expect(await shownMs(page)).toBe(0)
  })

  test('the timer has no laps — they would mean nothing counting down', async ({ page }) => {
    await open(page)
    await page.getByTestId('sw-down').click()
    await expect(page.getByTestId('sw-lap')).toHaveCount(0)
  })

  test('switching modes starts clean rather than carrying a stale time', async ({ page }) => {
    await open(page)
    await page.getByTestId('sw-start').click()
    await page.waitForTimeout(500)
    await page.getByTestId('sw-down').click()
    await page.getByTestId('sw-up').click()
    expect(await shownMs(page)).toBe(0)
  })

  test('it works in Arabic', async ({ page }) => {
    await open(page, 'ar')
    await expect(page.getByTestId('sw-up')).toContainText('ساعة إيقاف')
  })
})
