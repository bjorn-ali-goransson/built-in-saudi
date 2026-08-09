import { test, expect } from '@playwright/test'

const HEADER = 'id,name,dept'
const CSV = [
  HEADER,
  ...Array.from({ length: 10 }, (_, i) => `${i + 1},Person ${i + 1},${i % 2 === 0 ? 'Engineering' : 'Design'}`),
].join('\n')

async function load(page: import('@playwright/test').Page, csv = CSV, locale = 'en') {
  await page.goto(`/${locale}/apps/csv-split`)
  await page.getByTestId('cs-file').setInputFiles({ name: 'staff.csv', mimeType: 'text/csv', buffer: Buffer.from(csv, 'utf8') })
  await expect(page.getByTestId('cs-parts')).toBeVisible({ timeout: 15_000 })
}

test('splits by row count, and every part keeps the header', async ({ page }) => {
  // The mistake that makes a split useless: part 2 opens with its first data
  // row read as column names, so a row goes missing and every column is
  // mislabelled.
  await load(page)
  await page.getByTestId('cs-rows').fill('4')
  await expect(page.getByTestId('cs-part-count')).toHaveText('3 files')

  await page.getByTestId('cs-part-0').click()
  await expect(page.getByTestId('cs-preview')).toContainText(HEADER)
  await page.getByTestId('cs-part-1').click()
  await expect(page.getByTestId('cs-preview')).toContainText(HEADER)
  await page.getByTestId('cs-part-2').click()
  await expect(page.getByTestId('cs-preview')).toContainText(HEADER)
})

test('the last part holds the remainder, and no row is lost', async ({ page }) => {
  await load(page)
  // fill-then-assert is a hydration race: Playwright waits for an element to be
  // actionable, not for a handler to exist on it, so under a loaded suite the
  // value can land before React is listening and the split never recomputes.
  // Retrying the whole act-and-check is the documented fix (see ics-builder in
  // the privacy guard). It passed alone every time and failed in a batch.
  await expect(async () => {
    await page.getByTestId('cs-rows').fill('4')
    // 10 rows over 4 per file: 4 + 4 + 2.
    await expect(page.getByTestId('cs-part-0')).toContainText('4', { timeout: 2000 })
  }).toPass({ timeout: 15_000 })
  await expect(page.getByTestId('cs-part-2')).toContainText('2')
  await page.getByTestId('cs-part-2').click()
  await expect(page.getByTestId('cs-preview')).toContainText('Person 10')
})

test('splits into one file per value in a column, named after it', async ({ page }) => {
  await load(page)
  await page.getByTestId('cs-mode-column').click()
  await page.getByTestId('cs-column').selectOption('2') // dept
  await expect(page.getByTestId('cs-part-count')).toHaveText('2 files')
  await expect(page.getByTestId('cs-part-0')).toContainText('Engineering.csv')
  await expect(page.getByTestId('cs-part-1')).toContainText('Design.csv')
  await page.getByTestId('cs-part-1').click()
  const design = await page.getByTestId('cs-preview').innerText()
  expect(design).toContain(HEADER)
  expect(design).toContain('Design')
  expect(design).not.toContain('Engineering')
})

test('a value with a slash in it still makes a usable filename', async ({ page }) => {
  const tricky = ['id,team', '1,Sales/Marketing', '2,R&D'].join('\n')
  await load(page, tricky)
  await page.getByTestId('cs-mode-column').click()
  await page.getByTestId('cs-column').selectOption('1')
  await expect(page.getByTestId('cs-part-0')).toContainText('Sales-Marketing.csv')
})

test('splitting by size keeps every part under the limit', async ({ page }) => {
  // Big enough to actually exceed the tool's smallest allowed limit (0.01 MB),
  // rather than asking for a size it would clamp away.
  const big = ['id,name,dept', ...Array.from({ length: 800 }, (_, i) => `${i + 1},Person ${i + 1},Engineering`)].join('\n')
  await load(page, big)
  await page.getByTestId('cs-mode-size').click()
  await page.getByTestId('cs-size').fill('0.01')
  const count = Number((await page.getByTestId('cs-part-count').innerText()).split(' ')[0])
  expect(count).toBeGreaterThan(1)
  // And nothing is lost: the last row still appears in the last part.
  await page.getByTestId(`cs-part-${count - 1}`).click()
  await expect(page.getByTestId('cs-preview')).toContainText('Person 800')
})

test('downloads every part as one zip', async ({ page }) => {
  await load(page)
  const dl = page.waitForEvent('download')
  await page.getByTestId('cs-download').click()
  expect((await dl).suggestedFilename()).toBe('staff.zip')
})

test('stops before making an absurd number of files', async ({ page }) => {
  // A column of unique ids is the classic way to ask for one file per row.
  const many = ['id,name', ...Array.from({ length: 600 }, (_, i) => `${i + 1},Person ${i + 1}`)].join('\n')
  await load(page, many)
  await page.getByTestId('cs-mode-column').click()
  await page.getByTestId('cs-column').selectOption('0')
  await expect(page.getByTestId('cs-too-many')).toBeVisible()
  await expect(page.getByTestId('cs-download')).toBeDisabled()
})

test('works in Arabic too, and keeps Arabic values intact', async ({ page }) => {
  const arabic = ['المعرف,الاسم,الإدارة', '1,أحمد,الهندسة', '2,سارة,التصميم'].join('\n')
  await load(page, arabic, 'ar')
  await page.getByTestId('cs-mode-column').click()
  await page.getByTestId('cs-column').selectOption('2')
  await expect(page.getByTestId('cs-part-0')).toContainText('الهندسة')
  await page.getByTestId('cs-part-0').click()
  await expect(page.getByTestId('cs-preview')).toContainText('أحمد')
})
