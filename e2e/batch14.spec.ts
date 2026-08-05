import { test, expect } from '@playwright/test'

test.describe('saudi plate converter', () => {
  test('converts Arabic input to both halves, mirroring the letter order', async ({ page }) => {
    await page.goto('/en/apps/saudi-plate')
    await page.getByTestId('sp-input').fill('ا ب ح 4321')
    await expect(page.getByTestId('sp-latin')).toHaveText('A B J 4321')
    // The Arabic half runs the other way — that reversal is the whole point.
    await expect(page.getByTestId('sp-arabic')).toHaveText('ح ب ا ٤٣٢١')
  })

  test('accepts Latin input just as happily', async ({ page }) => {
    await page.goto('/en/apps/saudi-plate')
    await page.getByTestId('sp-input').fill('ABJ1234')
    await expect(page.getByTestId('sp-latin')).toHaveText('A B J 1234')
    await expect(page.getByTestId('sp-arabic')).toHaveText('ح ب ا ١٢٣٤')
  })

  test('accepts Arabic-Indic digits and digits typed first', async ({ page }) => {
    await page.goto('/en/apps/saudi-plate')
    await page.getByTestId('sp-input').fill('١٢٣٤ ا ب ح')
    await expect(page.getByTestId('sp-latin')).toHaveText('A B J 1234')
  })

  test('the fixed code table is not a transliteration', async ({ page }) => {
    await page.goto('/en/apps/saudi-plate')
    // ح → J and م → Z are the two that surprise people; if these ever drift to
    // a phonetic guess the tool is wrong in the way that matters.
    await expect(page.getByTestId('sp-letter-J')).toContainText('ح')
    await expect(page.getByTestId('sp-letter-Z')).toContainText('م')
    await expect(page.getByTestId('sp-table').locator('> button')).toHaveCount(17)
  })

  test('a letter that plates do not use is named rather than silently dropped', async ({ page }) => {
    await page.goto('/en/apps/saudi-plate')
    await page.getByTestId('sp-input').fill('ش ب ح 1234')
    await expect(page.getByTestId('sp-unknown')).toContainText('ش')
    await expect(page.getByTestId('sp-unknown')).toContainText('17 letters')
  })

  test('tapping a letter in the table types it', async ({ page }) => {
    await page.goto('/en/apps/saudi-plate')
    await page.getByTestId('sp-letter-A').click()
    await page.getByTestId('sp-letter-B').click()
    await expect(page.getByTestId('sp-latin')).toContainText('A B')
  })

  test('works in Arabic too', async ({ page }) => {
    await page.goto('/ar/apps/saudi-plate')
    await page.getByTestId('sp-example').click()
    await expect(page.getByTestId('sp-latin')).toHaveText('A B J 4321')
  })
})

test.describe('short address checker', () => {
  test('accepts a well-formed code and breaks it into its parts', async ({ page }) => {
    await page.goto('/en/apps/short-address')
    await page.getByTestId('sa-input').fill('RRRD2929')
    await expect(page.getByTestId('sa-valid')).toBeVisible()
    await expect(page.getByTestId('sa-normalised')).toHaveText('RRRD2929')
    await expect(page.getByTestId('sa-parts').locator('> div')).toHaveCount(5)
    await expect(page.getByTestId('sa-parts')).toContainText('Building number')
  })

  test('normalises spacing, case and Arabic-Indic digits', async ({ page }) => {
    await page.goto('/en/apps/short-address')
    await page.getByTestId('sa-input').fill('rrrd ٢٩٢٩')
    await expect(page.getByTestId('sa-normalised')).toHaveText('RRRD2929')
    await expect(page.getByTestId('sa-valid')).toBeVisible()
  })

  test('catches the digits-first transposition and shows the corrected form', async ({ page }) => {
    await page.goto('/en/apps/short-address')
    await page.getByTestId('sa-input').fill('2929RRRD')
    await expect(page.getByTestId('sa-issue')).toContainText('digits came first')
    await expect(page.getByTestId('sa-normalised')).toHaveText('RRRD2929')
  })

  test('a confusable character is corrected out loud, not silently', async ({ page }) => {
    await page.goto('/en/apps/short-address')
    await page.getByTestId('sa-input').fill('RRRD29O9')
    await expect(page.getByTestId('sa-normalised')).toHaveText('RRRD2909')
    // Silently rewriting someone's shipping code would be worse than rejecting it.
    await expect(page.getByTestId('sa-fixed')).toContainText('O→0')
  })

  test('rejects the wrong length with a reason', async ({ page }) => {
    await page.goto('/en/apps/short-address')
    await page.getByTestId('sa-input').fill('RRRD292')
    await expect(page.getByTestId('sa-issue')).toContainText('exactly eight')
    await expect(page.getByTestId('sa-valid')).toHaveCount(0)
  })

  test('does not pretend it can resolve a code to an address', async ({ page }) => {
    await page.goto('/en/apps/short-address')
    await expect(page.getByText(/Only Saudi Post can turn a code into an actual address/)).toBeVisible()
    await page.getByTestId('sa-input').fill('RRRD2929')
    await expect(page.getByTestId('sa-lookup')).toHaveAttribute('href', /splonline\.com\.sa/)
  })

  test('works in Arabic too', async ({ page }) => {
    await page.goto('/ar/apps/short-address')
    await page.getByTestId('sa-example').click()
    await expect(page.getByTestId('sa-normalised')).toHaveText('RRRD2929')
  })
})
