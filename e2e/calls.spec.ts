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

test('guest waits in the lobby, host admits, then they connect and chat', async ({ browser }) => {
  const a = await ctx(browser, base), b = await ctx(browser, base)
  const pa = await a.newPage(), pb = await b.newPage()

  // A starts a call → grab the generated room code
  await pa.goto('/en/apps/calls')
  await pa.getByTestId('call-name').fill('Alice')
  await pa.getByTestId('call-start').click()
  await expect(pa.getByTestId('calls-live')).toBeVisible({ timeout: 15_000 })
  const room = new URL(pa.url()).searchParams.get('room') || '' // code is reflected into the URL
  expect(room.length).toBeGreaterThan(4)

  // B asks to join → lands in the waiting lobby, NOT in the call yet
  await pb.goto(`/en/apps/calls?room=${room}`)
  await pb.getByTestId('call-name').fill('Bob')
  await pb.getByTestId('call-join').click()
  await expect(pb.getByTestId('call-waiting')).toBeVisible({ timeout: 10_000 })
  await expect(pb.getByTestId('calls-live')).toHaveCount(0)

  // A (host) sees Bob knocking and lets him in
  await expect(pa.getByTestId('call-lobby-live')).toContainText('Bob', { timeout: 15_000 })
  await pa.getByTestId('call-admit').click()

  // now B is admitted into the call
  await expect(pb.getByTestId('calls-live')).toBeVisible({ timeout: 15_000 })

  // each sees the other as a participant tile (cameras are off by default)
  await expect(pa.getByTestId('call-participants-panel')).toContainText('Bob', { timeout: 25_000 })
  await expect(pb.getByTestId('call-participants-panel')).toContainText('Alice', { timeout: 25_000 })

  // A opens chat and sends; B receives over the data channel
  await pa.getByRole('button', { name: 'Chat', exact: true }).click()
  await pa.getByPlaceholder('Message…').fill('hello-from-alice')
  await pa.getByRole('button', { name: 'Send', exact: true }).click()
  await pb.getByRole('button', { name: 'Chat', exact: true }).click()
  await expect(pb.getByTestId('call-chat-panel').getByText('hello-from-alice')).toBeVisible({ timeout: 15_000 })

  // No device is opened at join (privacy-first). Alice turns her camera ON — this
  // must lazily acquire + renegotiate so Bob actually receives her video track.
  // (The video tiles live in the participants panel, so open it on Bob.)
  await pa.getByTestId('call-cam').click()
  await pb.getByTestId('call-participants').click()
  await expect.poll(async () => pb.evaluate(() => {
    const vids = [...document.querySelectorAll('[data-testid=calls-live] video')] as HTMLVideoElement[]
    return vids.some((v) => v.srcObject instanceof MediaStream && v.srcObject.getVideoTracks().length > 0)
  }), { timeout: 20_000 }).toBe(true)

  await a.close(); await b.close()
})
