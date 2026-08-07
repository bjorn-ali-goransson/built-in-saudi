import { test, expect } from '@playwright/test'

async function load(page: import('@playwright/test').Page, locale = 'en') {
  await page.goto(`/${locale}/apps/attendance-sheet`)
  await page.getByTestId('as-sample').click()
  await expect(page.getByTestId('as-preview')).toBeVisible()
}

test('skips the weekend, and it is Friday and Saturday by default', async ({ page }) => {
  // The detail every generic register gets wrong. A Sunday start with the Saudi
  // week gives five columns before the first skip.
  await load(page)
  await page.getByTestId('as-start').fill('2026-03-01') // a Sunday
  await page.getByTestId('as-columns').fill('5')
  const heads = await page.getByTestId('as-preview').locator('thead th').allInnerTexts()
  // Sun 1 → Thu 5, with no 6th (Friday) or 7th (Saturday).
  expect(heads.join(' ')).toContain('1')
  expect(heads.join(' ')).toContain('5')
  expect(heads.join(' ')).not.toContain('6')
  expect(heads.join(' ')).not.toContain('7')
})

test('the weekend can be moved for a school that works another week', async ({ page }) => {
  await load(page)
  await page.getByTestId('as-start').fill('2026-03-01')
  await page.getByTestId('as-columns').fill('5')
  // Switch to a Saturday-Sunday weekend: now the 1st (Sunday) is skipped.
  await page.getByTestId('as-day-5').click() // Friday off the weekend
  await page.getByTestId('as-day-6').click() // Saturday off the weekend
  await page.getByTestId('as-day-0').click() // Sunday on
  const heads = await page.getByTestId('as-preview').locator('thead th').allInnerTexts()
  expect(heads.join(' ')).toContain('6') // Friday now a school day
})

test('numbered and custom headings replace the dates', async ({ page }) => {
  await load(page)
  await page.getByTestId('as-mode-sessions').click()
  await page.getByTestId('as-columns').fill('3')
  await expect(page.getByTestId('as-col-0')).toHaveText('1')
  await expect(page.getByTestId('as-col-2')).toHaveText('3')

  await page.getByTestId('as-mode-custom').click()
  await page.getByTestId('as-headings').fill('Quiz 1, Quiz 2, Project')
  await expect(page.getByTestId('as-col-0')).toHaveText('Quiz 1')
  await expect(page.getByTestId('as-col-2')).toHaveText('Project')
})

test('every student gets a row, in the order given', async ({ page }) => {
  await load(page)
  await expect(page.getByTestId('as-size')).toContainText('8 students')
  await expect(page.getByTestId('as-row-0')).toContainText('Ahmed Al-Otaibi')
  await expect(page.getByTestId('as-row-7')).toContainText('Reem Al-Anazi')
})

test('a long class splits across pages', async ({ page }) => {
  await page.goto('/en/apps/attendance-sheet')
  await page.getByTestId('as-names').fill(Array.from({ length: 30 }, (_, i) => `Student ${i + 1}`).join('\n'))
  // 22 rows per landscape page.
  await expect(page.getByTestId('as-pages')).toHaveText('2 pages')
  await page.getByTestId('as-landscape').uncheck()
  await expect(page.getByTestId('as-pages')).toHaveText('1 page')
})

test('the total column can be turned off', async ({ page }) => {
  await load(page)
  await expect(page.getByTestId('as-preview')).toContainText('Total')
  await page.getByTestId('as-total').uncheck()
  await expect(page.getByTestId('as-preview')).not.toContainText('Total')
})

test('downloads a PDF', async ({ page }) => {
  await load(page)
  const dl = page.waitForEvent('download')
  await page.getByTestId('as-download').click()
  expect((await dl).suggestedFilename()).toBe('attendance-sheet.pdf')
})

test('works in Arabic too', async ({ page }) => {
  await load(page, 'ar')
  await expect(page.getByTestId('as-preview')).toContainText('أحمد العتيبي')
})
