import { test, expect } from '@playwright/test'
import { MockApi, ok, serverError, stubGoogleSignIn } from './support/mockApi'

// Behavioral coverage for tools/pages the survey flagged as untested — each
// asserts real output, not just that a container is visible.

test('word counter counts words and characters', async ({ page }) => {
  await page.goto('/en/apps/text-counter')
  await expect(page.getByTestId('word-counter')).toBeVisible()
  await page.getByTestId('wc-input').fill('hello brave new world')
  const stats = page.getByTestId('wc-stats')
  await expect(stats).toContainText('4') // words
  await expect(stats).toContainText('21') // characters
})

test.describe('qibla with a fixed location', () => {
  test.use({ geolocation: { latitude: 24.7136, longitude: 46.6753 }, permissions: ['geolocation'] }) // Riyadh

  test('qibla computes a bearing and distance to Mecca', async ({ page }) => {
    await page.goto('/en/apps/qibla')
    await expect(page.getByTestId('qibla')).toBeVisible()
    await expect(page.getByTestId('qibla-bearing')).toContainText('°')
    await expect(page.getByTestId('qibla-distance')).toContainText(/\d/)
  })
})

test('diacritize: add tashkeel to Arabic text (mocked backend + sign-in)', async ({ page }) => {
  const api = new MockApi(page)
  await stubGoogleSignIn(page)
  // Match the Cloud Function host, not the tool's own /apps/diacritize page URL.
  await api.on('**cloudfunctions.net/diacritize', ok({ ok: true, text: 'اَلسَّلَامُ عَلَيْكُمْ' }))

  await page.goto('/ar/apps/diacritize')
  await page.getByTestId('dc-input').fill('السلام عليكم')
  await page.getByTestId('dc-run').click() // signs in on demand, then runs

  await expect(page.getByTestId('dc-output')).toContainText('اَلسَّلَامُ')
  api.expectCalled('**cloudfunctions.net/diacritize', 1)
})

test('diacritize: rejects non-Arabic before any backend call', async ({ page }) => {
  const api = new MockApi(page)
  await api.on('**cloudfunctions.net/diacritize', serverError())
  await page.goto('/en/apps/diacritize')
  await page.getByTestId('dc-input').fill('hello there')
  await page.getByTestId('dc-run').click()
  await expect(page.getByTestId('dc-err')).toBeVisible()
  api.expectCalled('**cloudfunctions.net/diacritize', 0) // never left the client
})

test('an unknown route renders the 404 page', async ({ page }) => {
  await page.goto('/en/definitely-not-a-real-page')
  await expect(page.getByText('404')).toBeVisible()
  await expect(page.getByText('Nothing here')).toBeVisible()
})

test('the Terms page renders and names the ATS CV Optimizer', async ({ page }) => {
  await page.goto('/en/terms')
  await expect(page.getByRole('heading', { name: 'ATS CV Optimizer' })).toBeVisible()
})
