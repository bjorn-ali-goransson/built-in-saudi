import { test, expect } from '@playwright/test'

// The "link another device" flow: /call/?c=<code>&add=1 opens an add-device
// screen that registers this device under the same call link (shared push).

test('add-device screen renders and names the owner', async ({ page }) => {
  await page.goto('/call/?c=abcdef234&add=1&n=Sara')
  await expect(page.getByTestId('call-add-device')).toBeVisible()
  await expect(page.getByTestId('call-add-heading')).toContainText('Sara')
  await expect(page.getByTestId('call-add-btn')).toBeVisible()
})

test('add-device linking fails gracefully without push (no crash)', async ({ page }) => {
  // No notification permission in headless → subscribeDevice returns null →
  // the link attempt surfaces an error instead of throwing.
  await page.goto('/call/?c=abcdef234&add=1')
  await page.getByTestId('call-add-btn').click()
  await expect(page.getByTestId('call-add-err')).toBeVisible()
  await expect(page.getByTestId('call-add-device')).toBeVisible()
})

// The ordinary caller flow is unchanged: /call/?c=<code> (no add) still calls.
test('call link without add=1 shows the caller flow', async ({ page }) => {
  await page.goto('/call/?c=abcdef234&n=Sara')
  await expect(page.getByTestId('call-link-call')).toBeVisible()
  await expect(page.getByTestId('call-add-device')).toHaveCount(0)
})
