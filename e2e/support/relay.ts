// An in-memory stand-in for the Calls/Messages Cloud Functions, shared by the
// Messages and editor-collaboration specs: the signaling relay (same protocol as
// functions/call.js `callSignal`) plus `call-msg`/`call-register`/`call-dm`, with
// permissive CORS so the localhost preview can reach it. It RECORDS every body it
// receives, which is what lets a spec assert that no message text, document
// content or file byte ever reached a server.
import { createServer, type Server } from 'node:http'
import type { Browser, BrowserContext } from '@playwright/test'

export interface Relay {
  base: string
  bodies: string[]
  pushes: { code: string; from: string; env: string; sealed: boolean; id: string }[]
  links: Set<string>
  close(): Promise<void>
}

export async function startRelay(): Promise<Relay> {
  const rooms = new Map<string, { count: number; msgs: { seq: number; from: string; to: string; type: string; payload: unknown }[] }>()
  const bodies: string[] = []
  const pushes: Relay['pushes'] = []
  const links = new Set<string>()
  const server: Server = createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
    if (req.method === 'OPTIONS') { res.writeHead(204); return res.end() }
    let body = ''
    req.on('data', (c) => (body += c))
    req.on('end', () => {
      bodies.push(body)
      let b: Record<string, unknown> = {}
      try { b = JSON.parse(body || '{}') } catch { /* */ }
      const path = (req.url || '/').split('?')[0]
      res.setHeader('Content-Type', 'application/json')
      if (path.endsWith('/call-register')) { links.add(String(b.code)); return res.end(JSON.stringify({ ok: true })) }
      if (path.endsWith('/call-msg')) {
        if (!links.has(String(b.code))) { res.writeHead(404); return res.end(JSON.stringify({ ok: false, error: 'no such link' })) }
        pushes.push({ code: String(b.code), from: String(b.from), env: String(b.env), sealed: !!b.sealed, id: String(b.id) })
        return res.end(JSON.stringify({ ok: true, delivered: 1 }))
      }
      if (path.endsWith('/call-dm') || path.endsWith('/touch')) return res.end(JSON.stringify({ ok: true, delivered: 0 }))
      // Signaling.
      const room = String(b.room || '')
      let r = rooms.get(room)
      if (!r) { r = { count: 0, msgs: [] }; rooms.set(room, r) }
      if (b.action === 'poll') {
        const since = Number(b.since) || 0
        const msgs = r.msgs.filter((m) => m.seq > since && m.from !== b.from && (m.to === 'all' || m.to === b.from))
        return res.end(JSON.stringify({ ok: true, seq: r.count, msgs }))
      }
      r.msgs.push({ seq: r.count, from: String(b.from), to: String(b.to || 'all'), type: String(b.type), payload: b.payload ?? null })
      r.count++
      res.end(JSON.stringify({ ok: true, seq: r.count - 1 }))
    })
  })
  await new Promise<void>((ok) => server.listen(0, () => ok()))
  const addr = server.address()
  const base = `http://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : 0}`
  return { base, bodies, pushes, links, close: () => new Promise((ok) => server.close(() => ok())) }
}

/** A browser context pointed at the relay, with the media flags WebRTC needs headless. */
export async function relayContext(browser: Browser, relay: Relay, opts: { permissions?: string[] } = {}): Promise<BrowserContext> {
  const c = await browser.newContext({ permissions: opts.permissions || [] })
  await c.addInitScript((u) => {
    const w = window as unknown as { __CALL_SIGNAL: string; __CALL_FN: string }
    w.__CALL_SIGNAL = u + '/call-signal'
    w.__CALL_FN = u
  }, relay.base)
  return c
}
