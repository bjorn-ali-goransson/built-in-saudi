import { test, expect, type Browser, type Page } from '@playwright/test'
// The deployed function's own code, in memory: the same passkey ceremonies,
// the same poll rules, the same "what suits everyone" that decides a push.
import { findTimeService } from '../functions/findTimeCore.js'

// Find a Time end to end, two people in two time zones:
//
//   Amal (Riyadh) makes a poll inviting Badr and Chen, signs up with a passkey,
//   and marks tomorrow 10:00–12:00 her time. Badr (London, three hours behind)
//   opens the link, takes his name with a passkey of his own, and finds the
//   same slots drawn at 07:00 — then marks 07:30–09:30 his time. Amal's page,
//   which nobody reloads, turns 10:30–12:00 gold within its live poll, Badr is
//   ticked as answered, Chen is still waiting, and a subscriber is pushed the
//   new consensus. Badr then deletes everything kept about him, and Amal's
//   page drops him.
//
// Passkeys are real WebAuthn against Chromium's virtual authenticator; the
// backend answers the production URL through page.route.

const BASE = process.env.BASE_URL || 'http://localhost:4173'
const FN = 'https://us-central1-blitz-ksa.cloudfunctions.net/find-time'

type Store = Map<string, Record<string, unknown>>
function memoryStore() {
  const data = new Map<string, Store>()
  const col = (c: string) => { if (!data.has(c)) data.set(c, new Map()); return data.get(c)! }
  return {
    data,
    async get(c: string, id: string) { const v = col(c).get(id); return v ? structuredClone(v) : null },
    async set(c: string, id: string, obj: Record<string, unknown>) { col(c).set(id, structuredClone(obj)) },
    async del(c: string, id: string) { col(c).delete(id) },
    async find(c: string, field: string, value: unknown) {
      return [...col(c)].filter(([, v]) => Array.isArray(v[field]) && (v[field] as unknown[]).includes(value)).map(([id, v]) => ({ ...structuredClone(v), id }))
    },
  }
}

const pushed: { endpoint: string; payload: { title: string; body: string; url: string } }[] = []
const store = memoryStore()
const service = findTimeService({
  store,
  secret: 'e2e-secret',
  rp: { id: new URL(BASE).hostname, name: 'Built in Saudi' },
  origins: [new URL(BASE).origin],
  notify: async (sub, payload) => { pushed.push({ endpoint: sub.endpoint, payload }) },
}) as Record<string, (b: Record<string, unknown>) => Promise<unknown>>

async function person(browser: Browser, timezoneId: string): Promise<Page> {
  const ctx = await browser.newContext({ timezoneId, locale: 'en-GB' })
  const page = await ctx.newPage()
  await page.route(FN, async (route) => {
    const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors })
    const b = route.request().postDataJSON() as Record<string, unknown>
    try {
      const out = await service[String(b.action)](b)
      await route.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify(out) })
    } catch (e) {
      const err = e as { status?: number; message: string }
      await route.fulfill({ status: err.status || 500, headers: cors, contentType: 'application/json', body: JSON.stringify({ error: err.message }) })
    }
  })
  const cdp = await ctx.newCDPSession(page)
  await cdp.send('WebAuthn.enable')
  await cdp.send('WebAuthn.addVirtualAuthenticator', {
    options: { protocol: 'ctap2', transport: 'internal', hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true },
  })
  return page
}

/** Drag on the grid from one slot's cell to another's, as a mouse would. */
async function drag(page: Page, from: number, to: number) {
  const a = page.getByTestId(`ft-cell-${from}`)
  const b = page.getByTestId(`ft-cell-${to}`)
  // Centred, not merely "in view": at the scroller's top edge a cell sits
  // under the sticky day header, which is what a press would then land on.
  await a.evaluate((el) => el.scrollIntoView({ block: 'center', behavior: 'instant' }))
  const ra = (await a.boundingBox())!
  const rb = (await b.boundingBox())!
  await page.mouse.move(ra.x + ra.width / 2, ra.y + ra.height / 2)
  await page.mouse.down()
  await page.mouse.move(rb.x + rb.width / 2, rb.y + rb.height / 2, { steps: 6 })
  await page.mouse.up()
}

const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i)

test('a group finds a time across time zones, live, with passkeys', async ({ browser }) => {
  // --- Amal, in Riyadh, makes the poll -------------------------------------
  const amal = await person(browser, 'Asia/Riyadh')
  await amal.goto('/en/apps/find-time')
  await amal.getByTestId('ft-title').fill('Kick-off')
  await amal.getByTestId('ft-your-name').fill('Amal')
  await amal.getByTestId('ft-invitee').fill('Badr')
  await amal.getByTestId('ft-invitee').press('Enter')
  await amal.getByTestId('ft-invitee').fill('Chen')
  await amal.getByTestId('ft-create').click()
  // No session yet: the passkey sheet, with her name carried over.
  await expect(amal.getByTestId('ft-auth-name')).toHaveValue('Amal')
  await amal.getByTestId('ft-create-key').click()
  await expect(amal.getByTestId('ft-poll-title')).toHaveText('Kick-off')
  await expect(amal.getByTestId('ft-signed-in')).toContainText('Amal')
  await expect(amal.getByTestId('ft-people').locator('li')).toHaveCount(3)
  const link = await amal.getByTestId('ft-link').inputValue()
  const code = new URL(link).searchParams.get('p')!
  expect(code).toMatch(/^[a-z0-9]{8}$/)

  // The poll starts at her midnight: slot 48 is tomorrow 00:00 in Riyadh, so
  // 68 is tomorrow 10:00 there. Mark 10:00–12:00.
  await expect(amal.getByTestId('ft-cell-68')).toHaveAttribute('aria-label', /10:00/)
  await drag(amal, 68, 71)
  await expect(amal.getByTestId('ft-saving')).toHaveText('Saved')
  for (const s of range(68, 71)) await expect(amal.getByTestId(`ft-cell-${s}`)).toHaveAttribute('data-mine', '1')
  for (const s of [67, 72]) await expect(amal.getByTestId(`ft-cell-${s}`)).not.toHaveAttribute('data-mine', '1')
  await expect(amal.getByTestId('ft-person-Amal')).toHaveAttribute('data-answered', '1')

  // Somebody asks to be told when the consensus changes.
  await service.subscribe({ code, sub: { endpoint: 'https://push.example/amal', keys: { p256dh: 'k', auth: 'a' } }, locale: 'en' })

  // --- Badr, in London, opens the link ------------------------------------
  const badr = await person(browser, 'Europe/London')
  await badr.goto(link.replace(new URL(link).origin, ''))
  await expect(badr.getByTestId('ft-zone')).toContainText('Europe/London')
  await expect(badr.getByTestId('ft-zone')).toContainText('Asia/Riyadh')
  // The same instant, on his clock: three hours earlier.
  await expect(badr.getByTestId('ft-cell-68')).toHaveAttribute('aria-label', /07:00/)
  await expect(badr.getByTestId('ft-cell-68')).toHaveAttribute('data-free', '1')
  // Amal's name is held; his and Chen's are offered.
  await expect(badr.getByTestId('ft-iam-Amal')).toHaveCount(0)
  await badr.getByTestId('ft-iam-Badr').click()
  await expect(badr.getByTestId('ft-auth-name')).toHaveValue('Badr')
  await badr.getByTestId('ft-create-key').click()
  await expect(badr.getByTestId('ft-who')).toHaveCount(0)
  await expect(badr.getByTestId('ft-person-Badr')).toContainText('you')

  // 07:30–09:30 London = 10:30–12:30 Riyadh: slots 69..72.
  await drag(badr, 69, 72)
  await expect(badr.getByTestId('ft-saving')).toHaveText('Saved')
  for (const s of range(69, 71)) await expect(badr.getByTestId(`ft-cell-${s}`)).toHaveAttribute('data-everyone', '1')

  // --- Amal's page catches up on its own -----------------------------------
  for (const s of range(69, 71)) await expect(amal.getByTestId(`ft-cell-${s}`)).toHaveAttribute('data-everyone', '1', { timeout: 10_000 })
  await expect(amal.getByTestId('ft-cell-68')).not.toHaveAttribute('data-everyone', '1')
  await expect(amal.getByTestId('ft-cell-72')).not.toHaveAttribute('data-everyone', '1')
  await expect(amal.getByTestId('ft-person-Badr')).toHaveAttribute('data-answered', '1')
  await expect(amal.getByTestId('ft-person-Chen')).toHaveAttribute('data-answered', '0')
  await expect(amal.getByTestId('ft-person-Chen')).toContainText('opened the link')
  // Listed in her own time: 10:30 to 12:00.
  await expect(amal.getByTestId('ft-suit')).toHaveCount(1)
  await expect(amal.getByTestId('ft-suit')).toContainText('10:30–12:00')
  await expect(badr.getByTestId('ft-suit')).toContainText('07:30–09:00')

  // The subscriber was told, once, in words and with a link back.
  expect(pushed).toHaveLength(1)
  expect(pushed[0].payload.body).toBe('3 times suit all 2 who answered (of 3).')
  expect(pushed[0].payload.url).toContain(`/en/apps/find-time?p=${code}`)
  // A change that leaves the consensus alone is not news.
  await drag(badr, 72, 72) // unmark 72, outside what suits everyone
  await expect(badr.getByTestId('ft-cell-72')).not.toHaveAttribute('data-mine', '1')
  await expect(badr.getByTestId('ft-saving')).toHaveText('Saved')
  expect(pushed).toHaveLength(1)

  // --- Badr deletes everything kept about him ------------------------------
  await badr.getByRole('button', { name: 'Your data' }).click()
  await expect(badr.getByTestId('ft-data-polls').locator('li')).toHaveCount(1)
  await expect(badr.getByTestId('ft-data-polls')).toContainText('Kick-off')
  await badr.getByTestId('ft-delete-all').click()
  await expect(badr.getByTestId('ft-data-deleted')).toBeVisible()
  // Read back from the store, not from the page that did it.
  expect([...store.data.get('ftUsers')!.values()].map((u) => u.name)).toEqual(['Amal'])
  await expect(amal.getByTestId('ft-person-Badr')).toHaveCount(0, { timeout: 10_000 })
  await expect(amal.getByTestId('ft-cell-70')).not.toHaveAttribute('data-everyone', '1')
})

test('the Arabic week reads right to left, today first on the right', async ({ browser }) => {
  const page = await person(browser, 'Asia/Riyadh')
  await page.goto('/ar/apps/find-time')
  await page.getByTestId('ft-title').fill('اجتماع')
  await page.getByTestId('ft-your-name').fill('سارة')
  await page.getByTestId('ft-create').click()
  await page.getByTestId('ft-create-key').click()
  await expect(page.getByTestId('ft-poll-title')).toHaveText('اجتماع')
  // In her own zone the poll is exactly seven days, starting today.
  await expect(page.locator('[data-testid^="ft-day-"]')).toHaveCount(7)
  // Position on screen, not DOM order: the first day is the rightmost column.
  const x = async (i: number) => (await page.getByTestId(`ft-day-${i}`).boundingBox())!.x
  expect(await x(0)).toBeGreaterThan(await x(1))
  expect(await x(1)).toBeGreaterThan(await x(6))
  // And a drag still marks what it covers.
  await drag(page, 60, 62)
  for (const s of range(60, 62)) await expect(page.getByTestId(`ft-cell-${s}`)).toHaveAttribute('data-mine', '1')
  await page.screenshot({ path: process.env.FT_SHOT || 'test-results/find-time-ar.png', fullPage: true })
})
