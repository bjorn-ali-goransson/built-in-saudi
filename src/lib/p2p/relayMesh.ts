// A TEST-ONLY stand-in for Mesh that carries data through the signaling relay
// instead of a WebRTC data channel. Chosen when `window.__MESH_RELAY_ONLY` is
// set, which nothing in the product does — only e2e/support/relay.ts.
//
// Why it exists: the editors' live-session specs are about the SESSION — who is
// the owner, what a guest sees, how edits flow and are refused — and under CI
// load roughly one WebRTC join in forty never formed, failing a spec about
// something else entirely. Real WebRTC stays covered where it is the subject
// (the Messages and Calls specs, and one editor case that keeps the real mesh
// to prove the document never reaches the relay). Here, it would be noise.
//
// Two properties the real mesh has and this must keep:
// - **Order.** Every signal is its own fetch, so two in flight can reach the
//   relay in either order — and a guest applying commits 5 then 4 asks for a
//   resync it should never have needed. Sends are therefore posted one at a
//   time, in order; the relay's sequence number does the rest.
// - **No history.** The relay keeps a room's past messages, and a newcomer
//   polling from the start would replay an owner's earlier broadcasts as though
//   they were live. The first poll only learns where the room is.
import { randomId, roomName, signalUrl, type MeshHandlers } from './mesh'

export const relayOnly = () => typeof window !== 'undefined' && !!(window as unknown as { __MESH_RELAY_ONLY?: boolean }).__MESH_RELAY_ONLY

export class RelayMesh {
  readonly me: string
  readonly room: string
  private peers = new Set<string>()
  private since = -1
  private active = false
  private chain: Promise<unknown> = Promise.resolve()
  private h: MeshHandlers

  constructor(room: string, handlers: MeshHandlers, me = randomId()) {
    this.room = roomName(room)
    this.h = handlers
    this.me = me
  }

  get connected(): string[] { return [...this.peers] }
  isOpen(id: string): boolean { return this.peers.has(id) }

  start(): void {
    if (this.active) return
    this.active = true
    void this.loop()
  }

  stop(): void {
    if (!this.active) return
    this.active = false
    this.post('leave', 'all')
    for (const id of [...this.peers]) this.drop(id)
  }

  send(id: string, msg: unknown): boolean {
    if (!this.peers.has(id)) return false
    this.post('data', id, msg)
    return true
  }

  broadcast(msg: unknown): number {
    if (!this.peers.size) return 0
    this.post('data', 'all', msg)
    return this.peers.size
  }

  private post(type: string, to: string, payload?: unknown) {
    const body = JSON.stringify({ room: this.room, from: this.me, action: 'send', to, type, payload })
    this.chain = this.chain.then(() => fetch(signalUrl(), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body }).catch(() => {}))
  }

  private async poll(): Promise<{ seq?: number; msgs?: { from: string; type: string; payload: unknown; seq: number }[] }> {
    const r = await fetch(signalUrl(), {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ room: this.room, from: this.me, action: 'poll', since: this.since }),
    })
    return r.ok ? r.json() : {}
  }

  private async loop() {
    try { const d = await this.poll(); if (typeof d.seq === 'number') this.since = d.seq - 1 } catch { /* */ }
    this.post('hello', 'all')
    while (this.active) {
      let got = 0
      try {
        const d = await this.poll()
        for (const m of d.msgs || []) {
          got++
          if (m.seq > this.since) this.since = m.seq
          if (this.active) this.onSignal(m.from, m.type, m.payload)
        }
      } catch { /* transient */ }
      await new Promise((r) => setTimeout(r, got ? 30 : 120))
    }
  }

  private onSignal(from: string, type: string, payload: unknown) {
    if (from === this.me) return
    if (type === 'hello') {
      if (this.peers.has(from)) return
      this.post('hello', from)
      this.peers.add(from)
      this.h.onPeer?.(from, 'open')
    } else if (type === 'data') {
      if (this.peers.has(from)) this.h.onMessage?.(from, payload)
    } else if (type === 'leave') {
      this.drop(from)
    }
  }

  private drop(id: string) {
    if (!this.peers.delete(id)) return
    this.h.onPeer?.(id, 'closed')
  }
}
