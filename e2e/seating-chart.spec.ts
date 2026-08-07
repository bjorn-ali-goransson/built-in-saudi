import { test, expect } from '@playwright/test'

async function load(page: import('@playwright/test').Page, locale = 'en') {
  await page.goto(`/${locale}/apps/seating-chart`)
  await page.getByTestId('sc-sample').click()
  await expect(page.getByTestId('sc-grid')).toBeVisible()
}

test('seats everyone once, and leaves the spare desks empty', async ({ page }) => {
  await load(page)
  // 20 names into 4 x 6 = 24 desks.
  await expect(page.getByTestId('sc-count')).toContainText('20 students · 24 desks')
  const seats = await page.getByTestId('sc-grid').locator('> div').allInnerTexts()
  expect(seats).toHaveLength(24)
  const filled = seats.filter((t) => t.trim() && t.trim() !== '·')
  expect(filled).toHaveLength(20)
  expect(new Set(filled).size).toBe(20)
})

test('the chart code makes the same arrangement again', async ({ page }) => {
  await load(page)
  const read = () => page.getByTestId('sc-grid').innerText()
  const before = await read()
  await page.getByTestId('sc-regenerate').click()
  expect(await read()).not.toBe(before)
  await page.getByTestId('sc-seed').fill('ABC123')
  expect(await read()).toBe(before)
})

test('keeps a named pair apart', async ({ page }) => {
  await load(page)
  await page.getByTestId('sc-apart-a').selectOption('Ahmed')
  await page.getByTestId('sc-apart-b').selectOption('Sara')
  await page.getByTestId('sc-apart-add').click()
  await expect(page.getByTestId('sc-apart-list')).toContainText('Ahmed ↮ Sara')
  await expect(page.getByTestId('sc-unsatisfied')).toHaveCount(0)

  // Prove it in the grid: the two must not be neighbours, diagonals included.
  const seats = await page.getByTestId('sc-grid').locator('> div').allInnerTexts()
  const cols = 6
  const ia = seats.findIndex((t) => t.trim() === 'Ahmed')
  const ib = seats.findIndex((t) => t.trim() === 'Sara')
  expect(ia).toBeGreaterThanOrEqual(0)
  expect(ib).toBeGreaterThanOrEqual(0)
  const dr = Math.abs(Math.floor(ia / cols) - Math.floor(ib / cols))
  const dc = Math.abs((ia % cols) - (ib % cols))
  expect(dr > 1 || dc > 1).toBe(true)
})

test('says when a rule cannot be honoured instead of ignoring it', async ({ page }) => {
  await page.goto('/en/apps/seating-chart')
  // Two people, two desks side by side: keeping them apart is impossible.
  await page.getByTestId('sc-names').fill('Ahmed\nSara')
  await page.getByTestId('sc-rows').fill('1')
  await page.getByTestId('sc-cols').fill('2')
  await page.getByTestId('sc-apart-a').selectOption('Ahmed')
  await page.getByTestId('sc-apart-b').selectOption('Sara')
  await page.getByTestId('sc-apart-add').click()
  await expect(page.getByTestId('sc-unsatisfied')).toContainText('could not be separated')
  await expect(page.getByTestId('sc-unsatisfied')).toContainText('Ahmed ↮ Sara')
})

test('the class view mirrors the teacher view, row by row', async ({ page }) => {
  await load(page)
  const readRows = async () => {
    const seats = await page.getByTestId('sc-grid').locator('> div').allInnerTexts()
    const rows: string[][] = []
    for (let i = 0; i < seats.length; i += 6) rows.push(seats.slice(i, i + 6).map((t) => t.trim()))
    return rows
  }
  const teacher = await readRows()
  await page.getByTestId('sc-view-class').click()
  const cls = await readRows()
  // Left and right swap from where the class sits; the rows themselves stay put.
  expect(cls[0]).toEqual([...teacher[0]].reverse())
  expect(cls[3]).toEqual([...teacher[3]].reverse())
})

test('warns when there are more students than desks', async ({ page }) => {
  await load(page)
  await page.getByTestId('sc-rows').fill('2')
  await page.getByTestId('sc-cols').fill('4')
  await expect(page.getByTestId('sc-over')).toContainText('12 more students than desks')
})

test('downloads a chart named after its code', async ({ page }) => {
  await load(page)
  const dl = page.waitForEvent('download')
  await page.getByTestId('sc-download').click()
  expect((await dl).suggestedFilename()).toBe('seating-ABC123.pdf')
})

test('works in Arabic too', async ({ page }) => {
  await load(page, 'ar')
  await expect(page.getByTestId('sc-grid')).toContainText('أحمد')
})
