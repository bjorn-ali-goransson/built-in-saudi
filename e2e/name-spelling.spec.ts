import { test, expect } from '@playwright/test'

async function load(page: import('@playwright/test').Page, name = 'محمد عبدالله العتيبي', locale = 'en') {
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.goto(`/${locale}/apps/name-spelling`)
  await page.getByTestId('ns-input').fill(name)
  await expect(page.getByTestId('ns-part-0')).toBeVisible()
}

test('offers the spellings that actually appear on documents', async ({ page }) => {
  await load(page)
  // The five that turn up on real passports in one family.
  for (const spelling of ['Mohammed', 'Muhammad', 'Mohamed', 'Mohammad']) {
    await expect(page.getByTestId(`ns-option-0-${spelling}`)).toBeVisible()
  }
  await expect(page.getByTestId('ns-option-1-Abdullah')).toBeVisible()
  await expect(page.getByTestId('ns-option-2-Al-Otaibi')).toBeVisible()
})

test('marks which spellings are attested and which were assembled', async ({ page }) => {
  await load(page)
  // A spelling seen on documents must not be presented the same way as one the
  // tool built out of the letters — that difference is the honest part.
  await expect(page.getByTestId('ns-option-0-Mohammed')).toContainText('used on documents')
  const generated = page.getByTestId('ns-part-0').getByText('assembled letter by letter').first()
  await expect(generated).toBeVisible()
})

test('assembles the full name from the chosen part spellings', async ({ page }) => {
  await load(page)
  await expect(page.getByTestId('ns-full')).toHaveText('Mohammed Abdullah Al-Otaibi')
  await page.getByTestId('ns-option-0-Muhammad').click()
  await page.getByTestId('ns-option-2-Alotaibi').click()
  await expect(page.getByTestId('ns-full')).toHaveText('Muhammad Abdullah Alotaibi')
})

test('copies the assembled name', async ({ page }) => {
  await load(page)
  await page.getByTestId('ns-copy').click()
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('Mohammed Abdullah Al-Otaibi')
})

test('handles a name that is not in the table at all', async ({ page }) => {
  // Nothing attested here, so everything on offer must be honestly labelled.
  await load(page, 'زيدان')
  await expect(page.getByTestId('ns-part-0')).toContainText('assembled letter by letter')
  await expect(page.getByTestId('ns-part-0')).not.toContainText('used on documents')
  await expect(page.getByTestId('ns-full')).not.toHaveText('—')
})

test('a hamza spelling variant still finds the common name', async ({ page }) => {
  // أحمد and احمد are the same name; only one of them is usually typed.
  await load(page, 'احمد')
  await expect(page.getByTestId('ns-option-0-Ahmed')).toContainText('used on documents')
  await load(page, 'أحمد')
  await expect(page.getByTestId('ns-option-0-Ahmed')).toContainText('used on documents')
})

test('says outright that there is no correct spelling, and to copy the passport', async ({ page }) => {
  await load(page)
  await expect(page.getByTestId('ns-headline')).toContainText('no correct spelling')
  await expect(page.getByTestId('ns-advice')).toContainText('copy the spelling from it')
})

test('works in Arabic too', async ({ page }) => {
  await load(page, 'نورة القحطاني', 'ar')
  await expect(page.getByTestId('ns-full')).toHaveText('Noura Al-Qahtani')
})
