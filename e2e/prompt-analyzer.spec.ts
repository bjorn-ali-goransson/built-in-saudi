import { test, expect } from '@playwright/test'

// Smoke test: the tool renders and validates client-side before any sign-in /
// backend call. (The AI analysis itself needs Google auth + the live function,
// so it's out of scope for e2e.)
test('prompt analyzer renders and only recommends (never blocks) a short prompt', async ({ page }) => {
  await page.goto('/en/apps/prompt-analyzer')
  await expect(page.getByTestId('prompt-analyzer')).toBeVisible()
  await expect(page.getByTestId('pa-input')).toBeVisible()

  // A short prompt is not rejected — it only draws a soft recommendation to go
  // longer, and the Analyse button stays enabled so you can still run it (#246).
  await page.getByTestId('pa-input').fill('too short')
  await expect(page.getByTestId('pa-hint')).toContainText('longer')
  await expect(page.getByTestId('pa-err')).toHaveCount(0)
  await expect(page.getByTestId('pa-run')).toBeEnabled()
})
