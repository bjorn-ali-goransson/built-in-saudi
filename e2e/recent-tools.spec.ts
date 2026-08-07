import { test, expect } from '@playwright/test'

// At 192 tools the catalogue is a place you visit once; the three or four you
// came back for are the whole point of the launcher. Until now there was no way
// to reach them but scrolling thirteen sections or typing the name again.

const recent = (page: import('@playwright/test').Page) => page.getByTestId('section-__recent')

test('a tool you opened is waiting at the top next time', async ({ page }) => {
  await page.goto('/en/apps/qr-code')
  await page.goto('/en/apps/iban-validator')
  await page.goto('/en')
  const row = recent(page)
  await expect(row).toBeVisible()
  // Most recent first.
  const ids = await row.locator('[data-testid^="tool-"]').evaluateAll(
    (els) => els.map((e) => e.getAttribute('data-testid')),
  )
  expect(ids).toEqual(['tool-iban-validator', 'tool-qr-code'])
})

test('a recent tool still appears under its own category', async ({ page }) => {
  // Deliberately unlike Recommended, which consumes its tools: recents change
  // as you use the site, and a catalogue that reshuffles because of yesterday
  // is worse than a repeated tile.
  await page.goto('/en/apps/iban-validator')
  await page.goto('/en')
  await expect(recent(page).getByTestId('tool-iban-validator')).toBeVisible()
  await expect(page.getByTestId('section-Saudi / Local').getByTestId('tool-iban-validator')).toBeVisible()
})

test('the launcher shows the same recents as the home catalogue', async ({ page }) => {
  await page.goto('/en/apps/password-generator')
  await page.goto('/en/apps/unit-converter')
  await page.getByTestId('app-launcher').click()
  const row = page.getByTestId('app-launcher-panel').getByTestId('section-__recent')
  await expect(row.getByTestId('tool-unit-converter')).toBeVisible()
  await expect(row.getByTestId('tool-password-generator')).toBeVisible()
})

test('opening a tool again moves it to the front rather than duplicating it', async ({ page }) => {
  await page.goto('/en/apps/qr-code')
  await page.goto('/en/apps/iban-validator')
  await page.goto('/en/apps/qr-code')
  await page.goto('/en')
  const ids = await recent(page).locator('[data-testid^="tool-"]').evaluateAll(
    (els) => els.map((e) => e.getAttribute('data-testid')),
  )
  expect(ids).toEqual(['tool-qr-code', 'tool-iban-validator'])
})

test('the row is not there at all before anything has been opened', async ({ page }) => {
  await page.goto('/en')
  await expect(recent(page)).toHaveCount(0)
})

test('it never grows past a shortcut', async ({ page }) => {
  const ids = ['qr-code', 'iban-validator', 'password-generator', 'unit-converter',
    'json-formatter', 'uuid-generator', 'base64', 'slugify', 'text-counter', 'hash-generator']
  for (const id of ids) await page.goto(`/en/apps/${id}`)
  await page.goto('/en')
  await expect(recent(page).locator('[data-testid^="tool-"]')).toHaveCount(8)
})

test('a tool that no longer exists is dropped, not rendered blank', async ({ page }) => {
  await page.goto('/en')
  await page.evaluate(() => localStorage.setItem('bis-recent-tools', JSON.stringify(['qr-code', 'a-tool-we-retired'])))
  await page.reload()
  await expect(recent(page).locator('[data-testid^="tool-"]')).toHaveCount(1)
  await expect(recent(page).getByTestId('tool-qr-code')).toBeVisible()
})

test('it works in Arabic', async ({ page }) => {
  await page.goto('/ar/apps/qibla')
  await page.goto('/ar')
  await expect(recent(page)).toContainText('مؤخرًا')
})
