import { test, expect } from '@playwright/test'

// At 194 tools the launcher is the fastest route to any of them, and it could
// only be reached by finding and clicking a 9-dot icon in the header — so on a
// keyboard the slow path was the only path.

const panel = (page: import('@playwright/test').Page) => page.getByTestId('app-launcher-panel')

test('Ctrl+K opens the launcher from anywhere on the site', async ({ page }) => {
  await page.goto('/en/apps/qr-code')
  await expect(panel(page)).toHaveCount(0)
  await page.keyboard.press('Control+k')
  await expect(panel(page)).toBeVisible()
  // And the search field is ready to type into, which is the point.
  await expect(page.getByTestId('launcher-search')).toBeFocused()
})

test('it toggles, and Escape still closes', async ({ page }) => {
  await page.goto('/en/apps/qr-code')
  await page.keyboard.press('Control+k')
  await expect(panel(page)).toBeVisible()
  await page.keyboard.press('Control+k')
  await expect(panel(page)).toHaveCount(0)
  await page.keyboard.press('Control+k')
  await page.keyboard.press('Escape')
  await expect(panel(page)).toHaveCount(0)
})

test('you can type straight into it and land on a tool', async ({ page }) => {
  await page.goto('/en/apps/qr-code')
  await page.keyboard.press('Control+k')
  await page.keyboard.type('iban')
  await page.getByTestId('tool-iban-validator').click()
  await expect(page).toHaveURL(/\/en\/apps\/iban-validator/)
})

test('a bare k does nothing, so typing in a tool is unaffected', async ({ page }) => {
  await page.goto('/en/apps/text-counter')
  await page.keyboard.press('k')
  await expect(panel(page)).toHaveCount(0)
})

test('it does not steal the key from a rich-text surface', async ({ page }) => {
  // A contenteditable may bind Cmd/Ctrl+K to "insert link"; taking that key
  // off it would break the tool in order to speed up leaving it.
  await page.goto('/en/apps/qr-code')
  await page.evaluate(() => {
    const d = document.createElement('div')
    d.contentEditable = 'true'
    d.id = 'rich'
    document.body.appendChild(d)
    d.focus()
  })
  await page.keyboard.press('Control+k')
  await expect(panel(page)).toHaveCount(0)
})

test('the shortcut is discoverable rather than a secret', async ({ page, viewport }) => {
  await page.goto('/en/apps/qr-code')
  await expect(page.getByTestId('app-launcher')).toHaveAttribute('title', /Ctrl K|⌘ K/)
  await page.keyboard.press('Control+k')
  // The hint shows where there is a keyboard to press it with.
  if ((viewport?.width ?? 0) >= 860) await expect(page.getByTestId('launcher-combo')).toBeVisible()
})

test('it works in Arabic too', async ({ page }) => {
  await page.goto('/ar/apps/qr-code')
  await page.keyboard.press('Control+k')
  await expect(panel(page)).toBeVisible()
})

test('on the home page it focuses the search instead of covering the catalogue', async ({ page }) => {
  // The 9-dot launcher is deliberately not rendered on home — home IS the
  // catalogue — so the shortcut was dead on the most visited page until the
  // spec caught it. Opening an overlay listing what is already listed
  // underneath would be the wrong fix.
  await page.goto('/en')
  await expect(page.getByTestId('app-launcher')).toHaveCount(0)
  await page.keyboard.press('Control+k')
  await expect(panel(page)).toHaveCount(0)
  await expect(page.locator('.tool-search__input')).toBeFocused()
})

test('on home it selects what is already typed, so the next keystroke replaces it', async ({ page }) => {
  await page.goto('/en')
  const input = page.locator('.tool-search__input')
  await input.fill('qr')
  await page.keyboard.press('Control+k')
  await page.keyboard.type('iban')
  await expect(input).toHaveValue('iban')
})

// Ctrl+K opened the search and you typed — and then had to reach for the mouse,
// which is the half of a command palette that makes it worth having.

test('type and press Enter to land on the top result', async ({ page }) => {
  await page.goto('/en/apps/qr-code')
  await page.keyboard.press('Control+k')
  await page.keyboard.type('iban')
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/\/en\/apps\/iban-validator/)
  // And the panel gets out of the way rather than covering where you landed.
  await expect(panel(page)).toHaveCount(0)
})

test('Enter on the home search does the same thing', async ({ page }) => {
  await page.goto('/en')
  await page.locator('.tool-search__input').fill('gosi')
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/\/en\/apps\/gosi-salary/)
})

test('Enter with nothing to open does nothing', async ({ page }) => {
  // A query matching no tool must not navigate anywhere, least of all to
  // whatever happened to be first before the search began.
  await page.goto('/en')
  await page.locator('.tool-search__input').fill('zzzzqqqq')
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/\/en\/?$/)
})

test('Enter works in Arabic, on the Arabic name', async ({ page }) => {
  await page.goto('/ar')
  await page.locator('.tool-search__input').fill('التأمينات')
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/\/ar\/apps\/gosi-salary/)
})
