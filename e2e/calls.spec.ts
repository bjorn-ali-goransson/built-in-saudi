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

// A host start now auto-opens the Share modal; close it before driving the call UI.
async function closeShare(p: import('@playwright/test').Page) {
  const x = p.getByTestId('call-share-close')
  if (await x.count()) await x.click()
}

async function ctx(browser: Browser, signal: string) {
  const c = await browser.newContext({ permissions: ['camera', 'microphone'] })
  await c.addInitScript((url) => { (window as unknown as { __CALL_SIGNAL: string }).__CALL_SIGNAL = url }, signal)
  return c
}

test('share button opens a modal with a QR before joining a call', async ({ browser }) => {
  const c = await ctx(browser, base)
  const p = await c.newPage()
  await p.goto('/en/apps/calls')
  await p.getByTestId('call-name').fill('Host')
  await p.getByTestId('call-share').click()
  await expect(p.getByTestId('call-share-modal')).toBeVisible()
  await expect(p.getByTestId('call-share-qr')).toBeVisible({ timeout: 10_000 })
  await expect(p.getByTestId('call-share-do')).toBeVisible()
  await c.close()
})

test('the browser Back button leaves an active call and returns to a clean lobby', async ({ browser }) => {
  const c = await ctx(browser, base)
  const p = await c.newPage()
  await p.goto('/en/apps/calls?code=deadroom') // a stale room somewhere in history
  await p.goto('/en/apps/calls')
  await p.getByTestId('call-name').fill('Host')
  await p.getByTestId('call-start').click()
  await expect(p.getByTestId('calls-live')).toBeVisible({ timeout: 15_000 })
  await p.goBack() // Back should LEAVE the call, not surface the stale ?room=
  await expect(p.getByTestId('calls-live')).toHaveCount(0)
  await expect(p.getByTestId('call-start')).toBeVisible()
  await expect(p.getByTestId('call-join')).toHaveCount(0)
  expect(new URL(p.url()).searchParams.get('code')).toBeNull()
  await c.close()
})

test('a dead ?code= link is verified first and shows "meeting ended" (not the join form)', async ({ browser }) => {
  const c = await ctx(browser, base)
  const p = await c.newPage()
  await p.goto('/en/apps/calls?code=nosuchroom')
  // Probed as gone → the ended screen, never the "enter name / ask to join" lobby.
  await expect(p.getByTestId('call-ended')).toBeVisible({ timeout: 10_000 })
  await expect(p.getByTestId('call-join')).toHaveCount(0)
  await expect(p.getByTestId('call-name')).toHaveCount(0)
  await c.close()
})

test('each shared file gets its own whiteboard (separate from the pure board)', async ({ browser }) => {
  const c = await ctx(browser, base)
  const p = await c.newPage()
  await p.goto('/en/apps/calls')
  await p.getByTestId('call-name').fill('Host')
  await p.getByTestId('call-start').click()
  await expect(p.getByTestId('calls-live')).toBeVisible({ timeout: 15_000 })
  await closeShare(p)
  // Inject a tiny PNG through the hidden file input → opens in the file view.
  await p.evaluate(() => {
    const b64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
    const bytes = Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0))
    const dt = new DataTransfer(); dt.items.add(new File([bytes], 'p.png', { type: 'image/png' }))
    const inp = document.querySelector('input[type=file]') as HTMLInputElement
    inp.files = dt.files; inp.dispatchEvent(new Event('change', { bubbles: true }))
  })
  await expect(p.locator('[data-testid=calls-live] main img')).toBeVisible()
  const ink = () => p.evaluate(() => {
    const cv = document.querySelector('[data-testid=calls-live] canvas') as HTMLCanvasElement
    const d = cv.getContext('2d')!.getImageData(0, 0, cv.width, cv.height).data
    let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 10) n++; return n
  })
  const box = (await p.locator('[data-testid=calls-live] canvas').boundingBox())!
  await p.mouse.move(box.x + 80, box.y + 80); await p.mouse.down(); await p.mouse.move(box.x + 180, box.y + 150); await p.mouse.up()
  expect(await ink()).toBeGreaterThan(0) // drew on the file's board
  await p.getByTestId('call-view').click(); await p.getByTestId('view-board').click()
  await expect.poll(ink).toBe(0) // pure whiteboard is a separate, empty board
  await p.getByTestId('call-filelist').getByTestId('call-file-open').click() // desktop docked panel
  await expect.poll(ink).toBeGreaterThan(0) // back on the file → its drawing persists
  await c.close()
})

test('mobile: file bar docks under the toolbar and the view dropdown stays on screen', async ({ browser }) => {
  const c = await ctx(browser, base)
  const p = await c.newPage()
  await p.setViewportSize({ width: 390, height: 800 })
  await p.goto('/en/apps/calls')
  await p.getByTestId('call-name').fill('M')
  await p.getByTestId('call-start').click()
  await expect(p.getByTestId('calls-live')).toBeVisible({ timeout: 15_000 })
  await closeShare(p)
  await p.evaluate(() => {
    const b64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
    const bytes = Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0))
    const dt = new DataTransfer(); dt.items.add(new File([bytes], 'a-rather-long-file-name-1000240436.jpg', { type: 'image/png' }))
    const inp = document.querySelector('input[type=file]') as HTMLInputElement
    inp.files = dt.files; inp.dispatchEvent(new Event('change', { bubbles: true }))
  })
  // A file bar appears just under the toolbar on mobile.
  await expect(p.getByTestId('call-filebar')).toBeVisible()
  // The view dropdown opens within the viewport (no overflow), and upload lives in it.
  await p.getByTestId('call-view').click()
  await expect(p.getByTestId('call-upload')).toBeVisible()
  const panel = p.locator('div.z-40', { has: p.getByTestId('view-board') })
  const box = (await panel.boundingBox())!
  expect(box.x).toBeGreaterThanOrEqual(0)
  expect(box.x + box.width).toBeLessThanOrEqual(390)
  await c.close()
})

test('a waiting guest only knocks to the host — it cannot see the other participants', async ({ browser }) => {
  const ca = await ctx(browser, base), cb = await ctx(browser, base), cc = await ctx(browser, base)
  const pa = await ca.newPage(), pb = await cb.newPage(), pc = await cc.newPage()
  await pa.goto('/en/apps/calls'); await pa.getByTestId('call-name').fill('Alice'); await pa.getByTestId('call-start').click()
  await expect(pa.getByTestId('calls-live')).toBeVisible({ timeout: 15_000 }); await closeShare(pa)
  const room = new URL(pa.url()).searchParams.get('code') || ''
  // Bob joins and is admitted.
  await pb.goto(`/en/apps/calls?code=${room}`); await pb.getByTestId('call-name').fill('Bob'); await pb.getByTestId('call-join').click()
  await expect(pa.getByTestId('call-lobby-live')).toContainText('Bob', { timeout: 15_000 })
  await pa.getByTestId('call-admit').click()
  await expect(pb.getByTestId('calls-live')).toBeVisible({ timeout: 15_000 })
  // Carol joins → waits. She must NOT learn that Bob is in the meeting.
  await pc.goto(`/en/apps/calls?code=${room}`); await pc.getByTestId('call-name').fill('Carol'); await pc.getByTestId('call-join').click()
  await expect(pc.getByTestId('call-waiting')).toBeVisible({ timeout: 10_000 })
  await pc.waitForTimeout(3000) // allow any (leaked) presence to arrive
  expect(await pc.evaluate(() => document.body.innerText.includes('Bob'))).toBe(false)
  // …but the host DOES see Carol knocking.
  await expect(pa.getByTestId('call-lobby-live')).toContainText('Carol', { timeout: 10_000 })
  await ca.close(); await cb.close(); await cc.close()
})

test('a guest who leaves the lobby stays in the list, marked "left" (no admit button)', async ({ browser }) => {
  const ca = await ctx(browser, base), cb = await ctx(browser, base)
  const pa = await ca.newPage(), pb = await cb.newPage()
  await pa.goto('/en/apps/calls'); await pa.getByTestId('call-name').fill('Alice'); await pa.getByTestId('call-start').click()
  await expect(pa.getByTestId('calls-live')).toBeVisible({ timeout: 15_000 }); await closeShare(pa)
  const room = new URL(pa.url()).searchParams.get('code') || ''
  // Bob knocks and appears in the host's lobby with an admit button.
  await pb.goto(`/en/apps/calls?code=${room}`); await pb.getByTestId('call-name').fill('Bob'); await pb.getByTestId('call-join').click()
  await expect(pa.getByTestId('call-lobby-live')).toContainText('Bob', { timeout: 15_000 })
  await expect(pa.getByTestId('call-admit')).toBeVisible()
  // Bob leaves the lobby (closes the tab). He stays listed, but marked "left" with no admit button.
  await cb.close()
  await expect(pa.getByTestId('call-lobby-left')).toContainText('Bob', { timeout: 20_000 })
  await expect(pa.getByTestId('call-lobby-left')).toContainText('left')
  await expect(pa.getByTestId('call-admit')).toHaveCount(0)
  await ca.close()
})

test('guest waits in the lobby, host admits, then they connect and chat', async ({ browser }) => {
  const a = await ctx(browser, base), b = await ctx(browser, base)
  const pa = await a.newPage(), pb = await b.newPage()

  // A starts a call → grab the generated room code
  await pa.goto('/en/apps/calls')
  await pa.getByTestId('call-name').fill('Alice')
  await pa.getByTestId('call-start').click()
  await expect(pa.getByTestId('calls-live')).toBeVisible({ timeout: 15_000 })
  const room = new URL(pa.url()).searchParams.get('code') || '' // code is reflected into the URL
  expect(room.length).toBeGreaterThan(4)
  await closeShare(pa) // the host's auto-opened share dialog

  // A scribbles on the whiteboard BEFORE anyone else is admitted.
  const boxA = (await pa.locator('[data-testid=calls-live] canvas').boundingBox())!
  await pa.mouse.move(boxA.x + 60, boxA.y + 60); await pa.mouse.down(); await pa.mouse.move(boxA.x + 160, boxA.y + 140); await pa.mouse.up()

  // B asks to join → lands in the waiting lobby, NOT in the call yet
  await pb.goto(`/en/apps/calls?code=${room}`)
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

  // Whiteboard history: B (admitted above) should have received A's earlier scribble.
  const inkB = () => pb.evaluate(() => {
    const cv = document.querySelector('[data-testid=calls-live] canvas') as HTMLCanvasElement
    const d = cv.getContext('2d')!.getImageData(0, 0, cv.width, cv.height).data
    let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 10) n++; return n
  })
  await expect.poll(inkB, { timeout: 10_000 }).toBeGreaterThan(0)

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

  // A shared FILE carries its own whiteboard that syncs between peers (shared id).
  await pa.evaluate(() => {
    const b64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
    const bytes = Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0))
    const dt = new DataTransfer(); dt.items.add(new File([bytes], 'shared.png', { type: 'image/png' }))
    const inp = document.querySelector('input[type=file]') as HTMLInputElement
    inp.files = dt.files; inp.dispatchEvent(new Event('change', { bubbles: true }))
  })
  await expect(pb.locator('[data-testid=calls-live] main img')).toBeVisible({ timeout: 10_000 }) // B received + auto-opened it
  const boxA2 = (await pa.locator('[data-testid=calls-live] canvas').boundingBox())!
  await pa.mouse.move(boxA2.x + 70, boxA2.y + 70); await pa.mouse.down(); await pa.mouse.move(boxA2.x + 170, boxA2.y + 150); await pa.mouse.up()
  await expect.poll(inkB, { timeout: 10_000 }).toBeGreaterThan(0) // B sees A's drawing on the file's board

  await a.close(); await b.close()
})

test('a guest stuck in the lobby can still open diagnostics (not just in-call)', async ({ browser }) => {
  const a = await ctx(browser, base), b = await ctx(browser, base)
  const pa = await a.newPage(), pb = await b.newPage()
  await pa.goto('/en/apps/calls'); await pa.getByTestId('call-name').fill('Alice'); await pa.getByTestId('call-start').click()
  await expect(pa.getByTestId('calls-live')).toBeVisible({ timeout: 15_000 }); await closeShare(pa)
  const room = new URL(pa.url()).searchParams.get('code') || ''

  // Bob joins with ?debug=1 and is left WAITING (host never admits). The bug panel
  // must be reachable from the waiting screen — previously it only existed in-call,
  // so a guest whose connection stalled had nothing to open.
  await pb.goto(`/en/apps/calls?code=${room}&debug=1`)
  await pb.getByTestId('call-name').fill('Bob'); await pb.getByTestId('call-join').click()
  await expect(pb.getByTestId('call-waiting')).toBeVisible({ timeout: 10_000 })
  // No button to tap — the panel auto-appears because the URL carries debug=1.
  await expect(pb.getByTestId('call-debug-wait')).toBeVisible()
  // The panel is live: it shows our own role and eventually the host as a peer.
  await expect(pb.getByTestId('call-debug')).toContainText('guest', { timeout: 5_000 })
  await expect(pb.getByTestId('call-debug')).not.toContainText('no peers connected', { timeout: 15_000 })
  await a.close(); await b.close()
})

test('device picker lists camera, microphone and speaker', async ({ browser }) => {
  const c = await ctx(browser, base)
  const p = await c.newPage()
  await p.goto('/en/apps/calls')
  await p.getByTestId('call-name').fill('Host')
  await p.getByTestId('call-start').click()
  await expect(p.getByTestId('calls-live')).toBeVisible({ timeout: 15_000 })
  await closeShare(p)
  await p.getByTestId('call-devices').click()
  const menu = p.locator('div.z-40', { hasText: 'Camera' })
  await expect(menu).toContainText('Camera')
  await expect(menu).toContainText('Microphone')
  await expect(menu).toContainText('Speaker')
  await c.close()
})

test('mobile: call opens as a whiteboard/dock split with tabs to switch to chat', async ({ browser }) => {
  const c = await ctx(browser, base)
  const p = await c.newPage()
  await p.setViewportSize({ width: 390, height: 800 })
  await p.goto('/en/apps/calls')
  await p.getByTestId('call-name').fill('M')
  await p.getByTestId('call-start').click()
  await expect(p.getByTestId('calls-live')).toBeVisible({ timeout: 15_000 })
  await closeShare(p)
  // Starts split: the participants dock is open at the bottom with its tab strip.
  await expect(p.getByTestId('call-participants-panel')).toBeVisible()
  await expect(p.getByTestId('call-dock-tabs')).toBeVisible()
  // The dock occupies the bottom of the screen, not the full height (whiteboard above).
  const dock = (await p.getByTestId('call-participants-panel').boundingBox())!
  expect(dock.y).toBeGreaterThan(300)
  // Tapping the Chat tab switches the same dock to chat.
  await p.getByTestId('call-dock-tab-chat').click()
  await expect(p.getByTestId('call-chat-panel')).toBeVisible()
  await expect(p.getByTestId('call-participants-panel')).toHaveCount(0)
  await c.close()
})

test('a debugging host propagates ?debug=1 into the invite link', async ({ browser }) => {
  const c = await ctx(browser, base)
  const p = await c.newPage()
  // Host is debugging → the shared invite must carry debug=1 so a non-technical
  // guest lands with diagnostics on, without being asked to tap anything.
  await p.goto('/en/apps/calls?debug=1')
  await p.getByTestId('call-name').fill('Host')
  await p.getByTestId('call-share').click()
  await expect(p.getByTestId('call-share-qr')).toBeVisible({ timeout: 10_000 })
  // openShareModal pushes the same join URL that feeds the QR / copy / native share.
  const url = new URL(p.url())
  expect(url.pathname).toContain('/apps/calls/join')
  expect(url.searchParams.get('code')).not.toBeNull()
  expect(url.searchParams.get('debug')).toBe('1')
  await c.close()
})
