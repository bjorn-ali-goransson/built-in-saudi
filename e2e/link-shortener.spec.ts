import { test, expect } from '@playwright/test'
import { MockApi, ok, notFound, stubGoogleSignIn } from './support/mockApi'

// The link shortener is a Google-auth backend tool with no prior coverage, and
// its /s/<code> redirect page (ShortLinkPage) was untested too.

test('link shortener: sign in, then shorten a URL (mocked)', async ({ page }) => {
  const api = new MockApi(page)
  await stubGoogleSignIn(page)
  await api.on('**/my-links', ok({ links: [] }))
  await api.on('**/shorten', ok({ code: 'abc123', short: 'built-in-saudi.com/s/abc123', url: 'https://example.com', expiresAt: Date.now() + 1e10 }))

  await page.goto('/en/apps/link-shortener')
  await page.getByTestId('link-url').fill('https://example.com/a/very/long/path?with=query')
  await page.getByTestId('link-shorten').click()

  // Signed-out → the login modal; the stub's rendered button signs in, and the
  // pending URL is shortened automatically.
  await page.getByTestId('link-login-modal').getByRole('button').click()

  await expect(page.getByTestId('link-list')).toContainText('abc123')
  api.expectCalled('**/shorten', 1)
})

test('link shortener: shorten failure surfaces an error, no link added', async ({ page }) => {
  const api = new MockApi(page)
  await stubGoogleSignIn(page)
  await api.on('**/my-links', ok({ links: [] }))
  await api.on('**/shorten', ({ count }) => (count === 1 ? { status: 500, json: { error: 'Couldn’t shorten that link.' } } : ok({ code: 'x', short: 's', url: 'u', expiresAt: 0 })))

  await page.goto('/en/apps/link-shortener')
  await page.getByTestId('link-url').fill('https://example.com/thing')
  await page.getByTestId('link-shorten').click()
  await page.getByTestId('link-login-modal').getByRole('button').click()

  await expect(page.getByTestId('link-shortener')).toContainText('shorten')
  await expect(page.getByTestId('link-list')).toHaveCount(0)
})

test('/s/:code resolves and redirects to the target', async ({ page }) => {
  const api = new MockApi(page)
  // Redirect to a same-origin page so the nav stays inside the test server.
  await api.on('**/resolve-link*', ok({ url: 'http://localhost:4173/en/apps/qr-code' }))

  await page.goto('/s/abc123')
  await page.waitForURL(/\/en\/apps\/qr-code/)
  await expect(page.getByTestId('qr-code')).toBeVisible()
  api.expectCalled('**/resolve-link*', 1)
})

test('/s/:code shows "not found" for an expired/unknown code', async ({ page }) => {
  const api = new MockApi(page)
  await api.on('**/resolve-link*', notFound())

  await page.goto('/s/nope')
  await expect(page.getByText('Link not found')).toBeVisible()
})
