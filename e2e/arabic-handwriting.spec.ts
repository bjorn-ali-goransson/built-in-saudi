import { test, expect } from '@playwright/test'

const ZWJ = '\u200D'

test('shows a letter in all four positional forms, using joiners', async ({ page }) => {
  await page.goto('/en/apps/arabic-handwriting')
  // The default selection is baa, which joins on both sides.
  const strip = page.getByTestId('ah-form-strip')
  await expect(strip).toBeVisible()
  const isolated = await page.getByTestId('ah-form-isolated').innerText()
  const initial = await page.getByTestId('ah-form-initial').innerText()
  const medial = await page.getByTestId('ah-form-medial').innerText()
  const final = await page.getByTestId('ah-form-final').innerText()
  // The forms are the SAME character wearing joiners — not four separate
  // codepoints from the deprecated presentation-forms block.
  expect(isolated).toContain('ب')
  expect(initial).toContain('ب' + ZWJ)
  expect(medial).toContain(ZWJ + 'ب' + ZWJ)
  expect(final).toContain(ZWJ + 'ب')
})

test('a non-joining letter has no initial or medial form, and says so', async ({ page }) => {
  await page.goto('/en/apps/arabic-handwriting')
  await page.getByTestId('ah-none').click()
  // Raa never joins to what follows it.
  await page.getByTestId('ah-letter-ر').click()
  await expect(page.getByTestId('ah-form-isolated')).toContainText('ر')
  await expect(page.getByTestId('ah-form-final')).toContainText('ر')
  // Those two cells must be empty rather than showing the isolated shape.
  await expect(page.getByTestId('ah-form-initial')).toContainText('—')
  await expect(page.getByTestId('ah-form-medial')).toContainText('—')
})

test('the row count follows the letters and forms chosen', async ({ page }) => {
  await page.goto('/en/apps/arabic-handwriting')
  await page.getByTestId('ah-none').click()
  await expect(page.getByTestId('ah-nothing')).toBeVisible()
  await expect(page.getByTestId('ah-download')).toBeDisabled()

  await page.getByTestId('ah-letter-ب').click()
  await page.getByTestId('ah-rows').fill('2')
  // 4 forms x 2 rows.
  await expect(page.getByTestId('ah-count')).toContainText('8 rows')

  await page.getByTestId('ah-forms').uncheck()
  // 1 shape x 2 rows.
  await expect(page.getByTestId('ah-count')).toContainText('2 rows')
})

test('a word can be practised instead of single letters', async ({ page }) => {
  await page.goto('/en/apps/arabic-handwriting')
  await page.getByTestId('ah-mode-text').click()
  await page.getByTestId('ah-text').fill('محمد')
  await expect(page.getByTestId('ah-preview')).toBeVisible()
  await expect(page.getByTestId('ah-download')).toBeEnabled()
})

test('the preview canvas actually draws something', async ({ page }) => {
  await page.goto('/en/apps/arabic-handwriting')
  const inked = await page.getByTestId('ah-preview').evaluate((c: HTMLCanvasElement) => {
    const ctx = c.getContext('2d')!
    const d = ctx.getImageData(0, 0, c.width, c.height).data
    let n = 0
    for (let i = 3; i < d.length; i += 4) if (d[i] > 10) n++
    return n
  })
  // A blank canvas would pass a "is it visible" check and teach nothing.
  expect(inked).toBeGreaterThan(500)
})

test('downloads a PDF', async ({ page }) => {
  await page.goto('/en/apps/arabic-handwriting')
  const dl = page.waitForEvent('download')
  await page.getByTestId('ah-download').click()
  expect((await dl).suggestedFilename()).toBe('arabic-handwriting.pdf')
})

test('works in Arabic too', async ({ page }) => {
  await page.goto('/ar/apps/arabic-handwriting')
  await expect(page.getByTestId('ah-letters')).toBeVisible()
  await expect(page.getByTestId('ah-form-isolated')).toBeVisible()
})
