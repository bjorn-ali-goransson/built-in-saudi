import { test, expect } from '@playwright/test'

// Smoke test: the tool renders its upload hero client-side. The AI rebuild, the
// ATS score radar and the follow-up questions all need Google auth + the live
// function, so they're out of scope for e2e (same stance as the Prompt Analyzer).
test('ats cv optimizer renders the upload hero', async ({ page }) => {
  await page.goto('/en/apps/ats-cv-optimizer')
  await expect(page.getByTestId('ats-cv-optimizer')).toBeVisible()
  await expect(page.getByText('Optimize your CV')).toBeVisible()
  await expect(page.getByTestId('cv-file')).toBeAttached()
})

// The old /apps/cv-generator URL redirects to the new id.
test('old cv-generator URL redirects to ats-cv-optimizer', async ({ page }) => {
  await page.goto('/en/apps/cv-generator')
  await expect(page).toHaveURL(/\/en\/apps\/ats-cv-optimizer$/)
  await expect(page.getByTestId('ats-cv-optimizer')).toBeVisible()
})
