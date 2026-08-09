import { test, expect } from '@playwright/test'
import { createHash } from 'node:crypto'

// The optional breach check on `password-strength`.
//
// Found by a web sweep of the privacy-tool market: metadata stripping and
// redaction are crowded and we ship both, but nothing here could answer whether
// a password is already KNOWN — which entropy cannot tell you, since a password
// can look strong and be in every wordlist there is.
//
// The whole design rests on one claim: the password never leaves the device,
// because only the first five characters of its SHA-1 are sent. These cases
// exist to make that claim testable rather than promised.

const PW = 'correct-horse-battery-staple-9137'
// Computed HERE rather than in the page, so the mock is installed before the
// first navigation. `addInitScript` added AFTER a `goto` did not take effect on
// the reload, and the test quietly hit the REAL service and read its "not
// found" as a pass — a green that proved nothing about our own comparison.
const SUFFIX = createHash('sha1').update(PW).digest('hex').toUpperCase().slice(5)
// SHA-1 of the above, uppercase. The mock answers with a body containing this
// suffix so a "found" can be driven without touching the real service.
/**
 * Returns a counter, so every case can assert the mock was actually USED.
 *
 * A glob (`**\/__hibp/**`) did not match and the request fell through to the
 * dev server, where the SPA fallback answers **200 with index.html** rather than
 * 404 — the trap this repo already records for `public/` assets. The body then
 * contains no matching suffix, so the page reported "not in the corpus" and
 * three cases passed having tested the fallback instead of the comparison.
 * A regex matches, and the hit count is what stops it happening again.
 */
const mock = async (page: import('@playwright/test').Page, body: (prefix: string) => string, status = 200) => {
  const hits = { n: 0 }
  // `context.route`, not `page.route`: this site registers a network-first
  // service worker, and a fetch it handles is not seen by a page-level route.
  // The request still shows up in `page.on('request')`, which is why the first
  // version of these cases looked fine — the listener saw it and the mock never
  // served it.
  await page.context().route(/\/__hibp\//, async (route) => {
    hits.n++
    const prefix = route.request().url().split('/').pop() ?? ''
    await route.fulfill({ status, body: body(prefix), contentType: 'text/plain' })
  })
  await page.addInitScript(() => {
    ;(window as unknown as { __HIBP: string }).__HIBP = '/__hibp/'
  })
  return hits
}

test('the password itself never appears in any request', async ({ page }) => {
  // The claim the whole feature rests on. Matched on the literal password, and
  // separately on every request body, because a leak we cannot read is still a
  // leak — the same two assertions the file-privacy guard makes.
  const leaked: string[] = []
  const bodies: string[] = []
  const hits = await mock(page, () => '0000000000000000000000000000000000000:5')
  page.on('request', (r) => {
    const url = r.url()
    const body = r.postData() ?? ''
    if (url.includes(PW) || body.includes(PW)) leaked.push(url.slice(0, 120))
    if (body) bodies.push(`${r.method()} ${url.slice(0, 120)}`)
  })

  await page.goto('/en/apps/password-strength')
  await page.getByTestId('pw-input').fill(PW)
  await page.getByTestId('pw-breach-run').click()
  await expect(page.getByTestId('pw-breach-safe')).toBeVisible({ timeout: 15_000 })

  expect(hits.n, 'the mock was never used, so this tested nothing').toBe(1)
  expect(leaked, 'the password appeared in a request').toEqual([])
  expect(bodies, 'a request carried a body').toEqual([])
})

test('exactly five hex characters are sent, and nothing else', async ({ page }) => {
  // "The password is absent" would also pass if we sent nothing at all, or the
  // wrong thing. This asserts what IS sent.
  const urls: string[] = []
  await mock(page, () => '0000000000000000000000000000000000000:5')
  page.on('request', (r) => { if (r.url().includes('/__hibp/')) urls.push(r.url()) })

  await page.goto('/en/apps/password-strength')
  await page.getByTestId('pw-input').fill(PW)
  await page.getByTestId('pw-breach-run').click()
  await expect(page.getByTestId('pw-breach-safe')).toBeVisible({ timeout: 15_000 })

  expect(urls).toHaveLength(1)
  const sent = urls[0].split('/').pop()!
  expect(sent).toMatch(/^[0-9A-F]{5}$/)
})

test('nothing is requested until the button is pressed', async ({ page }) => {
  // A network call about a password must be asked for, not triggered by typing.
  let calls = 0
  await mock(page, () => '')
  page.on('request', (r) => { if (r.url().includes('/__hibp/')) calls++ })
  await page.goto('/en/apps/password-strength')
  await page.getByTestId('pw-input').fill(PW)
  await expect(page.getByTestId('pw-score')).toBeVisible()
  await page.waitForTimeout(1200)
  expect(calls).toBe(0)
})

test('a matching suffix is reported as found, with the count', async ({ page }) => {
  // The mock returns the suffix the page will actually compute, so the test
  // drives the real comparison rather than a stubbed verdict.
  await mock(page, () => `${SUFFIX}:4211\nAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA:0`)
  await page.goto('/en/apps/password-strength')
  await page.getByTestId('pw-input').fill(PW)
  await page.getByTestId('pw-breach-run').click()
  await expect(page.getByTestId('pw-breach-found')).toContainText('4,211')
})

test('a padding decoy with a count of zero is not a match', async ({ page }) => {
  // The service pads its reply with random hashes at count 0 so the response
  // size says nothing. Treating one as a hit would be a false alarm on a
  // password that never leaked.
  const hits = await mock(page, () => `${SUFFIX}:0`)
  await page.goto('/en/apps/password-strength')
  await page.getByTestId('pw-input').fill(PW)
  await page.getByTestId('pw-breach-run').click()
  await expect(page.getByTestId('pw-breach-safe')).toBeVisible()
  expect(hits.n).toBe(1)
})

test('a failed check says so rather than reporting safe', async ({ page }) => {
  // "Safe" is the one wrong answer this can give.
  await mock(page, () => 'nope', 503)
  await page.goto('/en/apps/password-strength')
  await page.getByTestId('pw-input').fill(PW)
  await page.getByTestId('pw-breach-run').click()
  await expect(page.getByTestId('pw-breach-error')).toBeVisible()
  await expect(page.getByTestId('pw-breach-safe')).toHaveCount(0)
})

test('editing the password clears a stale verdict', async ({ page }) => {
  await mock(page, () => '0000000000000000000000000000000000000:5')
  await page.goto('/en/apps/password-strength')
  await page.getByTestId('pw-input').fill(PW)
  await page.getByTestId('pw-breach-run').click()
  await expect(page.getByTestId('pw-breach-safe')).toBeVisible()
  await page.getByTestId('pw-input').fill(PW + 'x')
  await expect(page.getByTestId('pw-breach-safe')).toHaveCount(0)
})

test('the page no longer claims to have no network code', async ({ page }) => {
  // It used to say "this page has no network code at all", which stopped being
  // true the moment this shipped. Leaving that would be the exact dishonesty
  // the site exists against.
  await page.goto('/en/apps/password-strength')
  await page.getByTestId('pw-input').fill('x')
  await expect(page.getByTestId('pw-breach-how')).toContainText('never sent')
  await expect(page.getByTestId('password-strength')).not.toContainText('no network code')
})

test('works in Arabic', async ({ page }) => {
  const hits = await mock(page, () => '0000000000000000000000000000000000000:5')
  await page.goto('/ar/apps/password-strength')
  await page.getByTestId('pw-input').fill(PW)
  await page.getByTestId('pw-breach-run').click()
  await expect(page.getByTestId('pw-breach-safe')).toContainText('تُسرَّب')
  expect(hits.n).toBe(1)
})
