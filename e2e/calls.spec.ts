import { test, expect, type Browser } from '@playwright/test'
import { createServer, type Server } from 'node:http'

// Fake camera/mic + auto-grant, so getUserMedia works headless.
test.use({ launchOptions: { args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required'] } })

// A tiny in-memory stand-in for the signaling Cloud Function (same protocol),
// with permissive CORS so the localhost preview can reach it.
let server: Server, base: string
const rooms = new Map<string, { count: number; msgs: { seq: number; from: string; to: string; type: string; payload: unknown }[] }>()

test.beforeAll(async () => {
  server = createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
    if (req.method === 'OPTIONS') { res.writeHead(204); return res.end() }
    let body = ''
    req.on('data', (c) => (body += c))
    req.on('end', () => {
      const b = JSON.parse(body || '{}')
      let r = rooms.get(b.room); if (!r) { r = { count: 0, msgs: [] }; rooms.set(b.room, r) }
      if (b.action === 'poll') {
        const msgs = r.msgs.filter((m) => m.seq > (b.since || 0) && m.from !== b.from && (m.to === 'all' || m.to === b.from))
        res.end(JSON.stringify({ ok: true, seq: r.count, msgs }))
      } else {
        r.msgs.push({ seq: r.count, from: b.from, to: b.to || 'all', type: b.type, payload: b.payload ?? null })
        r.count++
        res.end(JSON.stringify({ ok: true, seq: r.count - 1 }))
      }
    })
  })
  await new Promise<void>((res) => server.listen(0, () => res()))
  const addr = server.address()
  base = `http://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : 0}`
})
test.afterAll(() => server?.close())

async function ctx(browser: Browser, signal: string) {
  const c = await browser.newContext({ permissions: ['camera', 'microphone'] })
  await c.addInitScript((url) => { (window as unknown as { __CALL_SIGNAL: string }).__CALL_SIGNAL = url }, signal)
  return c
}

test('two peers connect P2P and exchange a chat message', async ({ browser }) => {
  const a = await ctx(browser, base), b = await ctx(browser, base)
  const pa = await a.newPage(), pb = await b.newPage()

  // A starts a call → grab the generated room code
  await pa.goto('/en/apps/calls')
  await pa.getByTestId('call-name').fill('Alice')
  await pa.getByTestId('call-start').click()
  await expect(pa.getByTestId('calls-live')).toBeVisible({ timeout: 15_000 })
  const room = (await pa.locator('.font-mono').first().textContent())!.trim()
  expect(room.length).toBeGreaterThan(4)

  // B joins that room
  await pb.goto(`/en/apps/calls?room=${room}`)
  await pb.getByTestId('call-name').fill('Bob')
  await pb.getByTestId('call-join').click()
  await expect(pb.getByTestId('calls-live')).toBeVisible({ timeout: 15_000 })

  // both should see 2 video tiles (their own + the peer) once connected
  await expect(pa.locator('video')).toHaveCount(2, { timeout: 25_000 })
  await expect(pb.locator('video')).toHaveCount(2, { timeout: 25_000 })

  // A opens chat and sends; B receives over the data channel
  await pa.getByRole('button', { name: /Chat/ }).click()
  await pa.getByPlaceholder('Message…').fill('hello-from-alice')
  await pa.getByRole('button', { name: 'Send', exact: true }).click()
  await pb.getByRole('button', { name: /Chat/ }).click()
  await expect(pb.getByText('hello-from-alice')).toBeVisible({ timeout: 15_000 })

  await a.close(); await b.close()
})
