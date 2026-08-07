import { test, expect } from '@playwright/test'

const OLD = [
  'id,name,salary,dept',
  '1,Ahmed,12000,Engineering',
  '2,Sara,11000,Design',
  '3,Yousef,9000,Support',
].join('\n')

// Sara's salary changed, Yousef is gone, Noura is new, and the rows were
// re-ordered — which is exactly why matching by position would lie.
const NEW = [
  'id,name,salary,dept,grade',
  '4,Noura,10000,Design,B',
  '2,Sara,13000,Design,A',
  '1,Ahmed,12000,Engineering,A',
].join('\n')

async function load(page: import('@playwright/test').Page, older = OLD, newer = NEW, locale = 'en') {
  await page.goto(`/${locale}/apps/sheet-diff`)
  await page.getByTestId('sd-file-a').setInputFiles({ name: 'old.csv', mimeType: 'text/csv', buffer: Buffer.from(older, 'utf8') })
  await page.getByTestId('sd-file-b').setInputFiles({ name: 'new.csv', mimeType: 'text/csv', buffer: Buffer.from(newer, 'utf8') })
  await expect(page.getByTestId('sd-summary')).toBeVisible({ timeout: 15_000 })
}

test('matches rows by key, so re-ordering is not mistaken for change', async ({ page }) => {
  await load(page)
  await expect(page.getByTestId('sd-added')).toHaveText('1')     // Noura
  await expect(page.getByTestId('sd-removed')).toHaveText('1')   // Yousef
  await expect(page.getByTestId('sd-changed')).toHaveText('1')   // Sara
  // Ahmed moved from row 1 to row 3 and did not change — matching by position
  // would have called that two changes.
  await expect(page.getByTestId('sd-same')).toHaveText('1')
})

test('names the cell that changed, not just the row', async ({ page }) => {
  await load(page)
  const table = page.getByTestId('sd-table')
  await expect(table).toContainText('salary')
  await expect(table).toContainText('11000')
  await expect(table).toContainText('13000')
})

test('notices a column that appeared, without calling every row changed', async ({ page }) => {
  await load(page)
  await expect(page.getByTestId('sd-cols-added')).toContainText('grade')
  // Ahmed gained a grade and nothing else. Counting a new column as a change to
  // every row is technically true and useless — one added column would bury the
  // edits you were looking for — so rows are judged on the SHARED columns.
  await expect(page.getByTestId('sd-same')).toHaveText('1')
})

test('a column moved to a different position is not a change', async ({ page }) => {
  // Columns are matched by name for the same reason rows are matched by key: by
  // position, moving one column would report every cell after it as changed.
  const reordered = ['dept,id,salary,name', 'Engineering,1,12000,Ahmed', 'Design,2,11000,Sara', 'Support,3,9000,Yousef'].join('\n')
  await load(page, OLD, reordered)
  await expect(page.getByTestId('sd-none')).toBeVisible()
  await expect(page.getByTestId('sd-same')).toHaveText('3')
})

test('reports duplicate keys instead of quietly picking one', async ({ page }) => {
  const dupes = ['id,name', '1,Ahmed', '1,Ahmed Again', '2,Sara'].join('\n')
  await load(page, dupes, dupes)
  await expect(page.getByTestId('sd-dupes')).toContainText('duplicate key')
  await expect(page.getByTestId('sd-dupes')).toContainText('no single row to compare')
})

test('matching by position is offered, with a warning about what it means', async ({ page }) => {
  await load(page)
  await page.getByTestId('sd-mode-position').click()
  await expect(page.getByTestId('sd-position-note')).toContainText('only tells the truth if nobody sorted')
  // By position, the re-ordering now reads as three changed rows.
  await expect(page.getByTestId('sd-changed')).toHaveText('3')
})

test('a different key column changes what matches', async ({ page }) => {
  await load(page)
  await page.getByTestId('sd-key').selectOption('1') // name
  // Keyed on name, the same four people line up the same way.
  await expect(page.getByTestId('sd-added')).toHaveText('1')
  await expect(page.getByTestId('sd-removed')).toHaveText('1')
})

test('identical files report no differences', async ({ page }) => {
  await load(page, OLD, OLD)
  await expect(page.getByTestId('sd-none')).toBeVisible()
  await expect(page.getByTestId('sd-same')).toHaveText('3')
})

test('extra spaces can be ignored, or not', async ({ page }) => {
  const spaced = ['id,name,salary,dept', '1,  Ahmed ,12000,Engineering', '2,Sara,11000,Design', '3,Yousef,9000,Support'].join('\n')
  await load(page, OLD, spaced)
  await expect(page.getByTestId('sd-none')).toBeVisible()
  await page.getByTestId('sd-space').uncheck()
  await expect(page.getByTestId('sd-changed')).toHaveText('1')
})

test('exports the changes as a CSV', async ({ page }) => {
  await load(page)
  const dl = page.waitForEvent('download')
  await page.getByTestId('sd-download').click()
  expect((await dl).suggestedFilename()).toBe('changes.csv')
})

test('works in Arabic too', async ({ page }) => {
  await load(page, OLD, NEW, 'ar')
  await expect(page.getByTestId('sd-added')).toHaveText('1')
})
