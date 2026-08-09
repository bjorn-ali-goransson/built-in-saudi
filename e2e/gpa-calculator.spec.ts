import { test, expect } from '@playwright/test'
import { readNumber } from './helpers'

// GPA calculator. Found by a web sweep of the student-tools market, where every
// site publishes one and we had none — only admission-score, which weights
// Qudurat and Tahsili for ADMISSION and is a different question.

const setRow = async (page: import('@playwright/test').Page, i: number, credits: number, grade: string) => {
  await page.getByTestId(`gpa-credits-${i}`).fill(String(credits))
  await page.getByTestId(`gpa-grade-${i}`).selectOption(grade)
}

// Reduce to a single row, so a case states exactly the grades it is about.
const onlyOne = async (page: import('@playwright/test').Page) => {
  await page.getByTestId('gpa-remove-2').click()
  await page.getByTestId('gpa-remove-1').click()
}

test('a GPA is weighted by credit hours, not an average of grades', async ({ page }) => {
  await page.goto('/en/apps/gpa-calculator')
  // A+ over 1 credit and F over 9: (5 x 1 + 1 x 9) / 10 = 1.40, not 3.00.
  await onlyOne(page)
  await setRow(page, 0, 1, 'A+')
  await page.getByTestId('gpa-add').click()
  await setRow(page, 1, 9, 'F')
  await expect(page.getByTestId('gpa-value')).toHaveText('1.40')
  await expect(page.getByTestId('gpa-credits')).toHaveText('10')
})

test('a fail is worth 1.00 out of five, which is the whole point', async ({ page }) => {
  await page.goto('/en/apps/gpa-calculator')
  await onlyOne(page)
  await setRow(page, 0, 3, 'F')
  await expect(page.getByTestId('gpa-value')).toHaveText('1.00')
  await expect(page.getByTestId('gpa-scale-4')).toBeVisible()
  await page.getByTestId('gpa-scale-4').click()
  // The same F on the 4-point scale is zero.
  await expect(page.getByTestId('gpa-value')).toHaveText('0.00')
})

test('converting grade by grade disagrees with the formula everyone publishes', async ({ page }) => {
  // Straight Ds: 2.00 out of 5. The shortcut says 1.60 out of 4; the grades say
  // 1.00. The shortcut flatters a weak record, which is why both are shown.
  await page.goto('/en/apps/gpa-calculator')
  await onlyOne(page)
  await setRow(page, 0, 3, 'D')
  await expect(page.getByTestId('gpa-value')).toHaveText('2.00')
  await expect(page.getByTestId('gpa-converted')).toHaveText('1.00')
  await expect(page.getByTestId('gpa-linear')).toHaveText('1.60')
  await expect(page.getByTestId('gpa-convert-why')).toContainText('flatters')
})

test('and it agrees where the scales genuinely line up', async ({ page }) => {
  // Without this the case above could pass against a converter that always
  // disagrees, which would be just as wrong in the other direction.
  await page.goto('/en/apps/gpa-calculator')
  await onlyOne(page)
  await setRow(page, 0, 3, 'A+')
  await expect(page.getByTestId('gpa-value')).toHaveText('5.00')
  await expect(page.getByTestId('gpa-converted')).toHaveText('4.00')
  await expect(page.getByTestId('gpa-linear')).toHaveText('4.00')
  await expect(page.getByTestId('gpa-convert-why')).toContainText('agree')
})

test('the classification follows the published bands', async ({ page }) => {
  await page.goto('/en/apps/gpa-calculator')
  await onlyOne(page)
  await setRow(page, 0, 3, 'A')        // 4.75 -> Excellent
  await expect(page.getByTestId('gpa-class')).toHaveText('Excellent')
  await setRow(page, 0, 3, 'B')        // 4.00 -> Very good
  await expect(page.getByTestId('gpa-class')).toHaveText('Very good')
  await setRow(page, 0, 3, 'C')        // 3.00 -> Good
  await expect(page.getByTestId('gpa-class')).toHaveText('Good')
  await setRow(page, 0, 3, 'D')        // 2.00 -> Pass
  await expect(page.getByTestId('gpa-class')).toHaveText('Pass')
  await setRow(page, 0, 3, 'F')        // 1.00 -> below
  await expect(page.getByTestId('gpa-class')).toContainText('Below')
})

test('a cumulative GPA is not the average of two averages', async ({ page }) => {
  await page.goto('/en/apps/gpa-calculator')
  await onlyOne(page)
  await setRow(page, 0, 3, 'C')       // 3.00 over 3 credits
  await page.getByTestId('gpa-cumulative').check()
  await page.getByTestId('gpa-prior').fill('4')
  await page.getByTestId('gpa-prior-credits').fill('100')
  // (4.00 x 100 + 3.00 x 3) / 103 = 3.97, not 3.50.
  await expect(page.getByTestId('gpa-value')).toHaveText('3.97')
  await expect(page.getByTestId('gpa-prior-caveat')).toBeVisible()
})

test('the letter table shows both scales side by side', async ({ page }) => {
  await page.goto('/en/apps/gpa-calculator')
  const row = page.getByTestId('gpa-letter-F')
  await expect(row).toContainText('1.00')
  await expect(row).toContainText('0.00')
  await expect(row).toContainText('< 60')
})

test('removing courses never leaves an empty form', async ({ page }) => {
  await page.goto('/en/apps/gpa-calculator')
  await onlyOne(page)
  await page.getByTestId('gpa-remove-0').click()
  await expect(page.getByTestId('gpa-row-0')).toBeVisible()
})

test('carries the official disclaimer naming the registrar', async ({ page }) => {
  await page.goto('/en/apps/gpa-calculator')
  const d = page.getByTestId('disclaimer')
  await expect(d).toHaveAttribute('data-kind', 'official')
  await expect(d).toContainText('registrar')
})

test('works in Arabic, including the computed number', async ({ page }) => {
  await page.goto('/ar/apps/gpa-calculator')
  await page.getByTestId('gpa-remove-2').click()
  await page.getByTestId('gpa-remove-1').click()
  await page.getByTestId('gpa-credits-0').fill('3')
  await page.getByTestId('gpa-grade-0').selectOption('A+')
  const gpa = await readNumber(page, 'gpa-value')
  expect(gpa).toBe(5)
  await expect(page.getByTestId('gpa-class')).toHaveText('ممتاز')
})
