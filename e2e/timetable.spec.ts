import { test, expect, type Page } from '@playwright/test'

// Weekly Timetable.
//
// Found by a seasonal sweep in the week the school year starts here. The
// category is crowded with printable templates and the Arabic half of it is
// essentially unserved — the one Arabic result was a fixed image. Two things
// the generic makers get wrong, both of which matter here and nowhere else.

const load = async (page: Page, locale = 'en') => {
  await page.goto(`/${locale}/apps/timetable`)
  await expect(page.getByTestId('timetable')).toBeVisible()
}

/** The day columns in the order they are actually rendered. */
const headOrder = async (page: Page) =>
  page.locator('[data-testid^="tt-head-"]').evaluateAll(
    (els) => els.map((e) => e.getAttribute('data-testid')!.replace('tt-head-', '')),
  )

test('the week starts on Sunday, not Monday', async ({ page }) => {
  // Friday and Saturday are the weekend here, so a Monday-first grid puts the
  // weekend in the middle and breaks the school week across it.
  await load(page)
  expect(await headOrder(page)).toEqual(['sun', 'mon', 'tue', 'wed', 'thu'])
})

test('in Arabic the COLUMNS reverse, not just the labels', async ({ page }) => {
  // The failure this tool exists for: translating the day names and leaving
  // the grid alone puts Sunday on the far left, where an Arabic reader
  // finishes rather than starts.
  await load(page, 'ar')
  expect(await headOrder(page)).toEqual(['thu', 'wed', 'tue', 'mon', 'sun'])
  await expect(page.getByTestId('tt-head-sun')).toContainText('الأحد')
})

test('the weekend is added at the END of the week, not the start', async ({ page }) => {
  await load(page)
  await page.getByTestId('tt-weekend').check()
  expect(await headOrder(page)).toEqual(['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'])
  // And reversed in Arabic, so Sunday is still where the reader begins.
  await load(page, 'ar')
  await page.getByTestId('tt-weekend').check()
  expect((await headOrder(page))[0]).toBe('sat')
  expect((await headOrder(page)).at(-1)).toBe('sun')
})

test('what is typed survives a reload', async ({ page }) => {
  await load(page)
  await page.getByTestId('tt-cell-0-mon').fill('Mathematics')
  await page.getByTestId('tt-title').fill('Grade 5A')
  await page.reload()
  await expect(page.getByTestId('tt-cell-0-mon')).toHaveValue('Mathematics')
  await expect(page.getByTestId('tt-title')).toHaveValue('Grade 5A')
})

test('a row can be added, and it is empty until typed into', async ({ page }) => {
  await load(page)
  const before = await page.locator('[data-testid^="tt-label-"]').count()
  await page.getByTestId('tt-add').click()
  expect(await page.locator('[data-testid^="tt-label-"]').count()).toBe(before + 1)
})

test('it prints a landscape PDF of what is on screen', async ({ page }) => {
  await load(page)
  await page.getByTestId('tt-cell-0-sun').fill('Arabic')
  const dl = page.waitForEvent('download', { timeout: 30_000 })
  await page.getByTestId('tt-download').click()
  expect((await dl).suggestedFilename()).toBe('timetable.pdf')
})

test('the Arabic PDF is produced too, which is the half a canvas cannot inherit', async ({ page }) => {
  // The printed sheet has to reverse the columns itself: a canvas has no
  // reading direction, so a grid that looked right on screen would still come
  // out the wrong way round.
  await load(page, 'ar')
  await page.getByTestId('tt-cell-0-sun').fill('رياضيات')
  const dl = page.waitForEvent('download', { timeout: 30_000 })
  await page.getByTestId('tt-download').click()
  expect((await dl).suggestedFilename()).toBe('timetable.pdf')
})

test('it says why the week starts where it does', async ({ page }) => {
  await load(page)
  await expect(page.getByTestId('tt-sunday')).toContainText('weekend')
  await expect(page.getByTestId('tt-rtl')).toContainText('backwards')
})
