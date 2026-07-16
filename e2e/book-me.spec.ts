import { test, expect } from '@playwright/test'
import { createServer, type Server } from 'node:http'

// The Book Me sign-in is a full Google OAuth round-trip, so we stand up our own
// mock OAuth provider + backend (same shape as the real Cloud Functions) and
// point the client at it via the window overrides the app exposes for exactly
// this. This exercises the real redirect chain — including the static
// /oauth/callback/ forwarder page whose whole reason for existing is that the
// redirect URI must live on a domain we own (see functions/booking.js).
//
// The flow under test:
//   Publish → booking-google-start (mock IdP: instant consent)
//     → 302 /oauth/callback/?code&state  (the real static page in dist/)
//     → forwards to booking-google-callback (mock: mint session)
//     → 302 back to the dashboard #hsid=…&code=…  → signed in.

const BASE = process.env.BASE_URL || 'http://localhost:4173'

// Mint a session token in the app's format: base64url(JSON payload) + '.' + sig.
// The client only reads (never verifies) the payload, so the sig is a stub.
function makeHsid(payload: Record<string, unknown>) {
  const body = Buffer.from(JSON.stringify({ ...payload, exp: Date.now() + 30 * 86400000 })).toString('base64url')
  return `${body}.mocksig`
}

let server: Server, mock: string

test.beforeAll(async () => {
  server = createServer((req, res) => {
    const url = new URL(req.url || '/', mock)
    const path = url.pathname

    // CORS for the fetch() endpoints (host-status / get-config / save-schedule).
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
    if (req.method === 'OPTIONS') { res.writeHead(204); return res.end() }

    // --- Mock OAuth provider: the "consent screen" that instantly approves. ---
    // Real code 302s to accounts.google.com; here we jump straight to the
    // redirect URI (the static callback page on the app origin), as Google would
    // after the user consents.
    if (path === '/booking-google-start') {
      const code = url.searchParams.get('code') || ''
      const locale = url.searchParams.get('locale') === 'ar' ? 'ar' : 'en'
      const state = Buffer.from(JSON.stringify({ code, locale })).toString('base64url')
      const back = `${BASE}/oauth/callback/?code=mock-auth-code&state=${state}`
      res.writeHead(302, { Location: back })
      return res.end()
    }

    // --- Token exchange + host upsert, mirroring booking-google-callback. ---
    if (path === '/booking-google-callback') {
      let st: { code?: string; locale?: string } = {}
      try { st = JSON.parse(Buffer.from(url.searchParams.get('state') || '', 'base64url').toString()) } catch { /* ignore */ }
      const hostCode = st.code || 'mockcode'
      const hsid = makeHsid({ sub: 'mock-sub', email: 'host@example.com', name: 'Björn Test', cal: true })
      const locale = st.locale === 'ar' ? 'ar' : 'en'
      res.writeHead(302, { Location: `${BASE}/${locale}/apps/book-me#hsid=${hsid}&code=${hostCode}` })
      return res.end()
    }

    // --- JSON endpoints the dashboard polls once signed in. ---
    res.setHeader('Content-Type', 'application/json')
    if (path === '/host-status') return res.end(JSON.stringify({ ok: true, connected: true, calendar: true }))
    if (path === '/get-config') return res.end(JSON.stringify({ ok: true, config: null }))
    if (path === '/save-schedule') return res.end(JSON.stringify({ ok: true }))

    res.writeHead(404); res.end(JSON.stringify({ error: 'not-found' }))
  })
  await new Promise<void>((r) => server.listen(0, () => r()))
  const addr = server.address()
  mock = `http://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : 0}`
})
test.afterAll(() => server?.close())

test('unverified-app warning shows before sign-in', async ({ page }) => {
  await page.goto('/en/apps/book-me')
  await expect(page.getByTestId('unverified-warning')).toBeVisible()
  // The sign-in CTA is present; the connected-only "open page" control is not.
  await expect(page.getByTestId('save-schedule')).toBeVisible()
  await expect(page.getByTestId('open-page')).toHaveCount(0)
})

test('publish runs the full OAuth round-trip and signs the host in', async ({ page, context }) => {
  // Point both the client backend and the callback forwarder at the mock.
  await context.addInitScript(([fn, cb]) => {
    ;(window as unknown as { __BOOKING_FN: string }).__BOOKING_FN = fn
    ;(window as unknown as { __BOOKING_CALLBACK_FN: string }).__BOOKING_CALLBACK_FN = cb
  }, [mock, `${mock}/booking-google-callback`])

  await page.goto('/en/apps/book-me')
  await page.getByTestId('save-schedule').click()

  // Lands back on the dashboard, signed in: the connected-only control appears,
  // the pre-sign-in warning and CTA are gone, and the hash was cleaned up.
  await expect(page.getByTestId('open-page')).toBeVisible()
  await expect(page.getByTestId('unverified-warning')).toHaveCount(0)
  await expect(page.getByTestId('save-schedule')).toHaveCount(0)
  expect(new URL(page.url()).hash).toBe('')

  // Calendar was granted, so the reconnect/no-calendar warning must NOT show.
  await expect(page.getByTestId('cal-warning')).toHaveCount(0)
})
