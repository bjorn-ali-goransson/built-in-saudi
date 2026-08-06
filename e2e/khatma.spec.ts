import { test, expect } from '@playwright/test'

test('a 30-day plan covers the whole mushaf, once, with no gaps', async ({ page }) => {
  // The one property that matters: every page from 1 to 604 is read exactly
  // once, and each day starts where the last one stopped.
  await page.goto('/en/apps/khatma')
  await page.getByTestId('kh-days').fill('30')
  const rows = await page.getByTestId('kh-plan').locator('tbody tr').count()
  expect(rows).toBe(30)

  const ranges = await page.getByTestId('kh-plan').locator('tbody tr').evaluateAll((trs) =>
    trs.map((tr) => (tr.children[2].textContent ?? '').split('–').map(Number)))
  expect(ranges[0][0]).toBe(1)
  expect(ranges[ranges.length - 1][1]).toBe(604)
  for (let i = 1; i < ranges.length; i++) expect(ranges[i][0]).toBe(ranges[i - 1][1] + 1)
})

test('the remainder is spread over the early days, not dumped on the last', async ({ page }) => {
  await page.goto('/en/apps/khatma')
  await page.getByTestId('kh-days').fill('7')
  const sizes = await page.getByTestId('kh-plan').locator('tbody tr').evaluateAll((trs) =>
    trs.map((tr) => {
      const [a, b] = (tr.children[2].textContent ?? '').split('–').map(Number)
      return b - a + 1
    }))
  // 604 / 7 = 86.28..., so days differ by at most one page — never a 40-page
  // final day, which is what a naive "give the rest to the last day" does.
  expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1)
  expect(sizes.reduce((a, b) => a + b, 0)).toBe(604)
})

test('a plan by juz starts each day on a juz boundary', async ({ page }) => {
  await page.goto('/en/apps/khatma')
  await page.getByTestId('kh-days').fill('30')
  await page.getByTestId('kh-unit-juz').click()
  const starts = await page.getByTestId('kh-plan').locator('tbody tr').evaluateAll((trs) =>
    trs.map((tr) => Number((tr.children[2].textContent ?? '').split('–')[0])))
  const JUZ = [1, 22, 42, 62, 82, 102, 121, 142, 162, 182, 201, 222, 242, 262, 282,
    302, 322, 342, 362, 382, 402, 422, 442, 462, 482, 502, 522, 542, 562, 582]
  for (const s of starts) expect(JUZ).toContain(s)
})

test('resting on Fridays still finishes the whole mushaf', async ({ page }) => {
  await page.goto('/en/apps/khatma')
  await page.getByTestId('kh-days').fill('30')
  await page.getByTestId('kh-fridays').check()
  const rows = page.getByTestId('kh-plan').locator('tbody tr')
  await expect(rows).toHaveCount(30)
  // No row may fall on a Friday, and the last page is still 604.
  const last = await rows.last().evaluate((tr) => tr.children[2].textContent ?? '')
  expect(Number(last.split('–')[1])).toBe(604)
})

test('progress is remembered on this device', async ({ page }) => {
  await page.goto('/en/apps/khatma')
  await page.getByTestId('kh-done-1').check()
  await page.getByTestId('kh-done-2').check()
  await expect(page.getByTestId('kh-progress')).toContainText('2 of 30')
  await page.reload()
  await expect(page.getByTestId('kh-done-1')).toBeChecked()
  await page.getByTestId('kh-reset').click()
  await expect(page.getByTestId('kh-progress')).toContainText('0 of 30')
})

test('names the mushaf its page numbers belong to', async ({ page }) => {
  await page.goto('/en/apps/khatma')
  await expect(page.getByTestId('kh-mushaf-note')).toContainText('Madani')
  await expect(page.getByTestId('kh-mushaf-note')).toContainText('604')
})

test('the Ramadan preset jumps to Ramadan', async ({ page }) => {
  await page.goto('/en/apps/khatma')
  const before = await page.getByTestId('kh-start').inputValue()
  await page.getByTestId('kh-preset-ramadan').click()
  const after = await page.getByTestId('kh-start').inputValue()
  expect(after).not.toBe(before)
  await expect(page.getByTestId('kh-ramadan')).toContainText('Ramadan begins')
})

test('downloads a printable plan', async ({ page }) => {
  await page.goto('/en/apps/khatma')
  const dl = page.waitForEvent('download')
  await page.getByTestId('kh-download').click()
  expect((await dl).suggestedFilename()).toBe('khatma-plan.pdf')
})

test('works in Arabic too', async ({ page }) => {
  await page.goto('/ar/apps/khatma')
  await expect(page.getByTestId('kh-plan')).toBeVisible()
  await expect(page.getByTestId('kh-rate')).toBeVisible()
})
