import { test, expect } from '@playwright/test'

// Clearing the "Recently used" row.
//
// Found by sweeping for exports nothing references: `clearRecent` existed from
// the day recents shipped and had no caller. The catalogue showed what you had
// opened, on a shared device, with no way to clear it — on a site whose whole
// stance is that your data is yours.

const visit = async (page: import('@playwright/test').Page, id: string) => {
  await page.goto(`/en/apps/${id}`)
  // The visit is recorded from an effect, so wait for the store rather than for
  // time to pass — the documented rule for anything written from an effect.
  await expect.poll(() => page.evaluate(() => localStorage.getItem('bis-recent-tools')))
    .toContain(id)
}

test('what you opened shows up, and can be cleared again', async ({ page }) => {
  await visit(page, 'qr-code')
  await page.goto('/en')
  await expect(page.getByTestId('section-__recent')).toBeVisible()
  await expect(page.getByTestId('section-__recent').getByTestId('tool-qr-code')).toBeVisible()

  await page.getByTestId('clear-recent').click()
  // The whole section goes, because a "recently used" row with nothing in it is
  // not a row.
  await expect(page.getByTestId('section-__recent')).toHaveCount(0)
  await expect(page.getByTestId('clear-recent')).toHaveCount(0)
})

test('clearing it actually clears the store, not just the view', async ({ page }) => {
  await visit(page, 'qr-code')
  await page.goto('/en')
  await page.getByTestId('clear-recent').click()
  await expect.poll(() => page.evaluate(() => localStorage.getItem('bis-recent-tools')))
    .toBeFalsy()
  // And it stays cleared across a reload — a view-only clear would come back.
  await page.reload()
  await expect(page.getByTestId('section-__recent')).toHaveCount(0)
})

test('no other section offers a clear, because none of them is yours', async ({ page }) => {
  await visit(page, 'qr-code')
  await page.goto('/en')
  await expect(page.getByTestId('clear-recent')).toHaveCount(1)
})

test('it is there in the launcher too, which shares the catalogue', async ({ page }) => {
  await visit(page, 'qr-code')
  await page.goto('/en/apps/pdf-merge')
  await page.getByTestId('app-launcher').click()
  await expect(page.getByTestId('clear-recent')).toBeVisible()
  await page.getByTestId('clear-recent').click()
  await expect(page.getByTestId('section-__recent')).toHaveCount(0)
})

test('works in Arabic', async ({ page }) => {
  await page.goto('/ar/apps/qr-code')
  await expect.poll(() => page.evaluate(() => localStorage.getItem('bis-recent-tools'))).toContain('qr-code')
  await page.goto('/ar')
  await expect(page.getByTestId('clear-recent')).toHaveText('مسح')
  await page.getByTestId('clear-recent').click()
  await expect(page.getByTestId('section-__recent')).toHaveCount(0)
})
