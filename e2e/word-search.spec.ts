import { test, expect } from '@playwright/test'

// Word search. Found by a web sweep of the teacher-tools market, where it is one
// of the handful every free classroom site ships and we had none. The reason it
// is worth building rather than copying is Arabic, which the incumbents either
// get wrong or do not attempt.

const cells = (page: import('@playwright/test').Page) =>
  page.getByTestId('ws-grid').locator('[data-cell]')

const gridText = async (page: import('@playwright/test').Page) =>
  (await cells(page).allTextContents()).join('')

test('places the words and says how many', async ({ page }) => {
  await page.goto('/en/apps/word-search')
  await page.getByTestId('ws-words').fill('RIYADH\nJEDDAH\nMECCA')
  await expect(page.getByTestId('ws-placed')).toContainText('3 of 3')
  await expect(page.getByTestId('ws-rejected')).toHaveCount(0)
})

test('the same seed gives the same puzzle, a new one gives a different puzzle', async ({ page }) => {
  // A teacher who reprints after a paper jam must get the same sheet, or the
  // answer key in their hand belongs to a different puzzle.
  await page.goto('/en/apps/word-search')
  await page.getByTestId('ws-words').fill('RIYADH\nJEDDAH\nMECCA')
  const first = await gridText(page)
  const seed = await page.getByTestId('ws-seed').inputValue()

  await page.getByTestId('ws-reseed').click()
  await expect(page.getByTestId('ws-seed')).not.toHaveValue(seed)
  const second = await gridText(page)
  expect(second).not.toBe(first)

  // Typing the PRINTED seed back in returns the original puzzle exactly. The
  // first version of this case could only compare lengths, because there was
  // nowhere to type the seed in — the sheet printed a number the tool would not
  // accept. That is why the field is an input.
  await page.getByTestId('ws-seed').fill(seed)
  await expect.poll(() => gridText(page)).toBe(first)
})

test('a word too long for the grid is reported, not silently dropped', async ({ page }) => {
  await page.goto('/en/apps/word-search')
  await page.getByTestId('ws-words').fill('CAT\nDOG')
  await page.getByTestId('ws-size').fill('8')
  await page.getByTestId('ws-words').fill('CAT\nDOG\nSUPERCALIFRAGILISTIC')
  await page.getByTestId('ws-size').fill('8')
  await expect(page.getByTestId('ws-rejected')).toContainText('SUPERCALIFRAGILISTIC')
})

test('an English grid is filled with English letters, not Arabic', async ({ page }) => {
  // Filler from the wrong alphabet makes every real word findable at a glance,
  // which is the whole puzzle gone.
  await page.goto('/en/apps/word-search')
  await page.getByTestId('ws-words').fill('RIYADH\nJEDDAH')
  const text = await gridText(page)
  expect(text).toMatch(/^[A-Z]+$/)
})

test('an Arabic grid is filled with Arabic letters', async ({ page }) => {
  await page.goto('/ar/apps/word-search')
  await page.getByTestId('ws-words').fill('الرياض\nجدة\nمكة')
  const text = await gridText(page)
  expect(text).toMatch(/^[\u0621-\u064A]+$/)
  await expect(page.getByTestId('ws-arabic-note')).toBeVisible()
})

test('alef forms are matched the way a solver matches them', async ({ page }) => {
  // أ إ آ ا look different and are one letter to the eye. If the grid keeps the
  // typed form, a child hunting for the word never finds it even though it is
  // there. The grid must therefore contain the BARE alef.
  await page.goto('/ar/apps/word-search')
  await page.getByTestId('ws-words').fill('إستقلال')
  await expect(page.getByTestId('ws-placed')).toContainText('1')
  const text = await gridText(page)
  expect(text).not.toContain('إ')
  // And the clue keeps the spelling that was typed.
  await expect(page.getByTestId('ws-words')).toHaveValue('إستقلال')
})

test('ta marbuta and alef maqsura are folded too', async ({ page }) => {
  await page.goto('/ar/apps/word-search')
  await page.getByTestId('ws-words').fill('مكة\nمستشفى')
  const text = await gridText(page)
  expect(text).not.toContain('ة')
  expect(text).not.toContain('ى')
})

test('harakat are stripped rather than taking a cell of their own', async ({ page }) => {
  // A combining mark in a cell is a cell the solver cannot see.
  await page.goto('/ar/apps/word-search')
  await page.getByTestId('ws-words').fill('مَدْرَسَة')
  await expect(page.getByTestId('ws-placed')).toContainText('1')
  const text = await gridText(page)
  expect(text).not.toMatch(/[\u064B-\u0652]/)
})

test('forwards-only keeps the puzzle easy', async ({ page }) => {
  await page.goto('/en/apps/word-search')
  await page.getByTestId('ws-words').fill('RIYADH\nJEDDAH\nMECCA')
  await page.getByTestId('ws-d2').click()
  await expect(page.getByTestId('ws-placed')).toContainText('3 of 3')
})

test('downloads a printable sheet', async ({ page }) => {
  await page.goto('/en/apps/word-search')
  await page.getByTestId('ws-title').fill('Cities')
  await page.getByTestId('ws-words').fill('RIYADH\nJEDDAH')
  const dl = page.waitForEvent('download', { timeout: 30_000 })
  await page.getByTestId('ws-download').click()
  expect((await dl).suggestedFilename()).toBe('Cities.pdf')
})

test('an empty list says so instead of drawing an empty grid', async ({ page }) => {
  await page.goto('/en/apps/word-search')
  await page.getByTestId('ws-words').fill('')
  await expect(page.getByTestId('ws-empty')).toBeVisible()
  await expect(page.getByTestId('ws-grid')).toHaveCount(0)
})
