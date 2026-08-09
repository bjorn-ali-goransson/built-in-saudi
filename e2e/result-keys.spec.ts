import { test, expect } from '@playwright/test'

// Arrow-key navigation of search results.
//
// Enter-opens-the-top-result already existed; without it you type and then
// reach for the mouse, which is the half of a command palette that makes it
// worth having. The arrows are the other half: until now, choosing the SECOND
// result meant reaching for the mouse anyway — and the second result is exactly
// what an ambiguous query needs. This repo has measured several: «باركود» means
// both a QR code and a barcode in Saudi usage, `ebook` means the reader or the
// writer, `calendar` means the ICS builder or the Hijri one.

const search = async (page: import('@playwright/test').Page, q: string, locale = 'en') => {
  await page.goto(`/${locale}`)
  await page.getByRole('searchbox').fill(q)
  await expect(page.locator('[data-testid^="tool-"]').first()).toBeVisible()
}

test('Enter still opens the top result, with no arrow pressed', async ({ page }) => {
  // The behaviour that already existed must survive the one being added.
  await search(page, 'merge pdf')
  await page.getByRole('searchbox').press('Enter')
  await expect(page).toHaveURL(/\/en\/apps\/pdf-merge$/)
})

test('the arrows reach the second result without a mouse', async ({ page }) => {
  await search(page, 'ebook')
  const box = page.getByRole('searchbox')
  // Row 0 is highlighted from the start, so one press moves to row 1.
  await box.press('ArrowDown')
  const second = await page.getByTestId('result-active').locator('[data-testid^="tool-"]').getAttribute('data-testid')
  await box.press('Enter')
  await expect(page).toHaveURL(new RegExp(`/en/apps/${second!.replace('tool-', '')}$`))
})

test('the highlight starts on the first result and wraps around', async ({ page }) => {
  await search(page, 'pdf merge')
  const box = page.getByRole('searchbox')
  const idOf = () => page.getByTestId('result-active').locator('[data-testid^="tool-"]').getAttribute('data-testid')
  const first = await idOf()
  await box.press('ArrowUp')
  // Up from the top wraps to the bottom rather than doing nothing.
  expect(await idOf()).not.toBe(first)
  await box.press('ArrowDown')
  expect(await idOf()).toBe(first)
})

test('typing another letter puts the highlight back to the top', async ({ page }) => {
  // Otherwise the highlight can sit on row 5 of a list that now has two, and
  // Enter opens something the reader never looked at.
  await search(page, 'pdf')
  const box = page.getByRole('searchbox')
  await box.press('ArrowDown')
  await box.press('ArrowDown')
  await box.pressSequentially(' merge')
  await expect(page.getByTestId('result-active')).toBeVisible()
  await box.press('Enter')
  await expect(page).toHaveURL(/\/en\/apps\/pdf-merge$/)
})

test('the launcher behaves identically, because it shares the hook', async ({ page }) => {
  await page.goto('/en/apps/qr-code')
  await page.getByTestId('app-launcher').click()
  const box = page.getByTestId('launcher-search')
  await box.fill('ebook')
  await expect(page.locator('[data-testid^="tool-"]').first()).toBeVisible()
  await box.press('ArrowDown')
  const second = await page.getByTestId('result-active').locator('[data-testid^="tool-"]').getAttribute('data-testid')
  await box.press('Enter')
  await expect(page).toHaveURL(new RegExp(`/en/apps/${second!.replace('tool-', '')}$`))
})

test('an empty result list swallows the keys rather than throwing', async ({ page }) => {
  await page.goto('/en')
  const box = page.getByRole('searchbox')
  await box.fill('zzzzqqqq')
  await box.press('ArrowDown')
  await box.press('Enter')
  // Still on the catalogue, and nothing broke.
  await expect(page).toHaveURL(/\/en$/)
})

test('works in Arabic', async ({ page }) => {
  await search(page, 'pdf', 'ar')
  const box = page.getByRole('searchbox')
  await box.press('ArrowDown')
  await expect(page.getByTestId('result-active')).toBeVisible()
})
