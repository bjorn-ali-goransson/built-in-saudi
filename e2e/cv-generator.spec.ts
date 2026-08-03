import { test, expect } from '@playwright/test'

// Smoke test: the tool renders its upload hero client-side. The AI rebuild, the
// ATS score radar and the follow-up questions all need Google auth + the live
// function, so they're out of scope for e2e (same stance as the Prompt Analyzer).
test('cv generator renders the upload hero', async ({ page }) => {
  await page.goto('/en/apps/cv-generator')
  await expect(page.getByTestId('cv-generator')).toBeVisible()
  await expect(page.getByText('Optimize your CV')).toBeVisible()
  await expect(page.getByTestId('cv-file')).toBeAttached()
})
