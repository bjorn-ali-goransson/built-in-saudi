// A data-only WebRTC mesh: the transport under Messages and the collaborative
// editors.
//
// It is the Calls engine (`tools/calls/rtc.ts`) with everything about media and
// lobbies taken away, because those two apps need something different from a
// meeting: a room you can be in for hours with nobody "admitting" anyone, where
// the payload is JSON and files rather than audio. It talks to the SAME signaling
// relay — the relay only ever sees random peer ids and SDP, never a message, a
// document or a file name.
//
// Three things it has to get right, each of which otherwise fails silently:
//
// - **SCTP has a message size ceiling.** Chrome's data channel refuses (and, on
//   some versions, closes the channel over) a single message much past 256KB. A
//   document snapshot is easily bigger, so JSON larger than FRAG is split into
//   fragments and reassembled on the far side.
// - **Backpressure.** `send()` never blocks; it queues in `bufferedAmount`, and a
//   200MB file pushed in a loop will exhaust memory and kill the channel. Binary
//   sends wait for `bufferedamountlow` once the buffer is past HIGH_WATER.
// - **Exactly one side creates the channel.** Both creating one is the "two
//   channels, each side reading the one the other never writes to" bug. The
//   larger id initiates — the same rule as the Calls engine.

export type MeshState = 'connecting' | 'open' | 'closed'

export interface BlobMeta { id: string; name: string; size: number; mime: string; [k: string]: unknown }

export interface MeshHandlers {
  onPeer?(id: string, state: MeshState): void
  onMessage?(id: string, msg: unknown): void
  /** A whole blob arrived. */
  onBlob?(id: string, meta: BlobMeta, blob: Blob): void
  /** Progress of an incoming blob, 0..1. */
  onBlobProgress?(id: string, meta: BlobMeta, fraction: number): void
}

const SIGNAL_DEFAULT = 'https://us-central1-blitz-ksa.cloudfunctions.net/call-signal'
export const signalUrl = () => (typeof window !== 'undefined' && (window as unknown as { __CALL_SIGNAL?: string }).__CALL_SIGNAL) || SIGNAL_DEFAULT

const ICE: RTCIceServer[] = [
  { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
  { urls: ['stun:stun.cloudflare.com:3478'] },
]

export const FRAG = 48_000 // characters of JSON per fragment
const CHUNK = 16_384 // bytes of a blob per binary frame
const HIGH_WATER = 1_048_576
const LOW_WATER = 262_144

export const randomId = (n = 16) => {
  const a = new Uint8Array(n)
  crypto.getRandomValues(a)
  return Array.from(a, (b) => 'abcdefghijklmnopqrstuvwxyz0123456789'[b % 36]).join('')
}

/** Relay room names are 40 chars of [A-Za-z0-9_-]. */
export const roomName = (s: string) => s.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40)

interface Peer {
  pc: RTCPeerConnection
  dc?: RTCDataChannel
  pending: RTCIceCandidateInit[]
  polite: boolean
  makingOffer: boolean
  open: boolean
  frags: Map<string, string[]>
  blobs: Map<string, { meta: BlobMeta; parts: ArrayBuffer[]; got: number }>
}

/** Split a JSON string into fragment envelopes when it is too big for one message. */
export function fragment(json: string, id = randomId(8)): string[] {
  if (json.length <= FRAG) return [json]
  const n = Math.ceil(json.length / FRAG)
  const out: string[] = []
  for (let i = 0; i < n; i++) out.push(JSON.stringify({ __frag: id, i, n, d: json.slice(i * FRAG, (i + 1) * FRAG) }))
  return out
}
/** Feed one received text frame; returns the whole decoded message once complete, else undefined. */
export function defragment(store: Map<string, string[]>, text: string): { done: true; value: unknown } | { done: false } {
  let v: unknown
  try { v = JSON.parse(text) } catch { return { done: false } }
  const f = v as { __frag?: string; i?: number; n?: number; d?: string }
  if (!f || typeof f !== 'object' || typeof f.__frag !== 'string') return { done: true, value: v }
  const parts = store.get(f.__frag) || new Array<string>(f.n || 0)
  parts[f.i || 0] = f.d || ''
  store.set(f.__frag, parts)
  for (let i = 0; i < parts.length; i++) if (parts[i] === undefined) return { done: false }
  store.delete(f.__frag)
  try { return { done: true, value: JSON.parse(parts.join('')) } } catch { return { done: false } }
}

// Binary frame: [0x42 'B'][u8 idLen][id utf8][payload]
export function encodeBinaryFrame(id: string, payload: Uint8Array): Uint8Array {
  const idb = new TextEncoder().encode(id)
  const out = new Uint8Array(2 + idb.length + payload.length)
  out[0] = 0x42
  out[1] = idb.length
  out.set(idb, 2)
  out.set(payload, 2 + idb.length)
  return out
}
export function decodeBinaryFrame(buf: ArrayBuffer): { id: string; payload: ArrayBuffer } | null {
  const u = new Uint8Array(buf)
  if (u[0] !== 0x42) return null
  const n = u[1]
  return { id: new TextDecoder().decode(u.subarray(2, 2 + n)), payload: buf.slice(2 + n) }
}

export class Mesh {
  readonly me: string
  readonly room: string
  private peers = new Map<string, Peer>()
  private since = -1
  private active = false
  private h: MeshHandlers
  private kick: (() => void) | null = null

  constructor(room: string, handlers: MeshHandlers, me = randomId()) {
    this.room = roomName(room)
    this.h = handlers
    this.me = me
  }

  get connected(): string[] { return [...this.peers.entries()].filter(([, p]) => p.open).map(([id]) => id) }
  isOpen(id: string): boolean { return !!this.peers.get(id)?.open }

  start(): void {
    if (this.active) return
    this.active = true
    this.signal('hello', 'all')
    void this.pollLoop()
  }

  stop(): void {
    if (!this.active) return
    this.active = false
    this.signal('leave', 'all')
    for (const id of [...this.peers.keys()]) this.drop(id)
    this.kick?.()
  }

  /** Send JSON to one peer. Returns false when that peer is not open. */
  send(id: string, msg: unknown): boolean {
    const p = this.peers.get(id)
    if (!p?.dc || p.dc.readyState !== 'open') return false
    try { for (const f of fragment(JSON.stringify(msg))) p.dc.send(f) } catch { return false }
    return true
  }
  broadcast(msg: unknown): number {
    let n = 0
    for (const id of this.peers.keys()) if (this.send(id, msg)) n++
    return n
  }

  /** Stream a blob to one peer with backpressure. Resolves true once queued in full. */
  async sendBlob(id: string, meta: BlobMeta, blob: Blob, onProgress?: (f: number) => void): Promise<boolean> {
    const p = this.peers.get(id)
    if (!p?.dc || p.dc.readyState !== 'open') return false
    const dc = p.dc
    dc.bufferedAmountLowThreshold = LOW_WATER
    if (!this.send(id, { __blob: 'start', meta })) return false
    let sent = 0
    for (let off = 0; off < blob.size; off += CHUNK) {
      if (dc.readyState !== 'open') return false
      if (dc.bufferedAmount > HIGH_WATER) {
        await new Promise<void>((r) => {
          const done = () => { dc.removeEventListener('bufferedamountlow', done); dc.removeEventListener('close', done); r() }
          dc.addEventListener('bufferedamountlow', done)
          dc.addEventListener('close', done)
        })
        if (dc.readyState !== 'open') return false
      }
      const part = new Uint8Array(await blob.slice(off, off + CHUNK).arrayBuffer())
      try { dc.send(encodeBinaryFrame(meta.id, part) as unknown as ArrayBuffer) } catch { return false }
      sent += part.length
      onProgress?.(blob.size ? sent / blob.size : 1)
    }
    return this.send(id, { __blob: 'end', id: meta.id })
  }

  // ---- signaling -------------------------------------------------------------

  private signal(type: string, to: string, payload?: unknown) {
    fetch(signalUrl(), {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ room: this.room, from: this.me, action: 'send', to, type, payload }),
    }).catch(() => {})
  }

  private async pollLoop() {
    let idle = 0
    while (this.active) {
      let got = 0
      try {
        const r = await fetch(signalUrl(), {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ room: this.room, from: this.me, action: 'poll', since: this.since }),
        })
        const d = r.ok ? await r.json() : {}
        const msgs: { from: string; type: string; payload: unknown; seq: number }[] = d.msgs || []
        got = msgs.length
        for (const m of msgs) {
          if (m.seq > this.since) this.since = m.seq
          await this.onSignal(m.from, m.type, m.payload)
        }
      } catch { /* transient */ }
      // Fast while anything is forming; slow once everyone is connected, slower
      // still the longer nothing happens — a room can be open for hours and the
      // relay is a billed function.
      const settling = [...this.peers.values()].some((p) => !p.open)
      idle = got ? 0 : idle + 1
      const delay = got ? 100 : settling ? 400 : this.peers.size === 0 ? Math.min(1000 + idle * 150, 4000) : Math.min(2000 + idle * 200, 8000)
      await new Promise<void>((r) => { const t = setTimeout(r, delay); this.kick = () => { clearTimeout(t); r() } })
      this.kick = null
    }
  }

  private async onSignal(from: string, type: string, payload: unknown) {
    if (from === this.me) return
    if (type === 'hello') {
      if (!this.peers.has(from)) { this.signal('hello', from); this.mkPeer(from, this.me > from) }
    } else if (type === 'offer' || type === 'answer') {
      await this.onDesc(from, payload as RTCSessionDescriptionInit, type)
    } else if (type === 'ice') {
      const c = payload as RTCIceCandidateInit
      const p = this.peers.get(from)
      if (p?.pc.remoteDescription) await p.pc.addIceCandidate(c).catch(() => {})
      else p?.pending.push(c)
    } else if (type === 'leave') {
      this.drop(from)
    }
  }

  private mkPeer(id: string, initiator: boolean): Peer {
    const pc = new RTCPeerConnection({ iceServers: ICE })
    const peer: Peer = { pc, pending: [], polite: this.me < id, makingOffer: false, open: false, frags: new Map(), blobs: new Map() }
    pc.onnegotiationneeded = async () => {
      try { peer.makingOffer = true; await pc.setLocalDescription(); this.signal('offer', id, pc.localDescription) }
      catch { /* */ } finally { peer.makingOffer = false }
    }
    pc.onicecandidate = (e) => { if (e.candidate) this.signal('ice', id, e.candidate.toJSON()) }
    pc.onconnectionstatechange = () => {
      const s = pc.connectionState
      if (s === 'failed' || s === 'closed') {
        this.drop(id)
        // A failed path is often a NAT rebinding; say hello again and let it re-form.
        if (this.active && s === 'failed') { this.signal('hello', 'all'); this.kick?.() }
      }
    }
    pc.ondatachannel = (e) => this.bind(id, peer, e.channel)
    if (initiator) this.bind(id, peer, pc.createDataChannel('bis-mesh', { ordered: true }))
    this.peers.set(id, peer)
    this.h.onPeer?.(id, 'connecting')
    return peer
  }

  private bind(id: string, peer: Peer, dc: RTCDataChannel) {
    peer.dc = dc
    dc.binaryType = 'arraybuffer'
    dc.onopen = () => { peer.open = true; this.h.onPeer?.(id, 'open') }
    dc.onclose = () => { if (this.peers.get(id) === peer) this.drop(id) }
    dc.onmessage = (e) => {
      if (typeof e.data === 'string') {
        const r = defragment(peer.frags, e.data)
        if (!r.done) return
        const v = r.value as { __blob?: string; meta?: BlobMeta; id?: string }
        if (v && typeof v === 'object' && v.__blob === 'start' && v.meta) {
          peer.blobs.set(v.meta.id, { meta: v.meta, parts: [], got: 0 })
          this.h.onBlobProgress?.(id, v.meta, 0)
          return
        }
        if (v && typeof v === 'object' && v.__blob === 'end' && v.id) {
          const b = peer.blobs.get(v.id)
          peer.blobs.delete(v.id)
          if (b) this.h.onBlob?.(id, b.meta, new Blob(b.parts, { type: b.meta.mime || 'application/octet-stream' }))
          return
        }
        this.h.onMessage?.(id, r.value)
        return
      }
      const f = decodeBinaryFrame(e.data as ArrayBuffer)
      if (!f) return
      const b = peer.blobs.get(f.id)
      if (!b) return
      b.parts.push(f.payload)
      b.got += f.payload.byteLength
      this.h.onBlobProgress?.(id, b.meta, b.meta.size ? Math.min(1, b.got / b.meta.size) : 1)
    }
  }

  private async onDesc(id: string, desc: RTCSessionDescriptionInit, kind: 'offer' | 'answer') {
    const peer = this.peers.get(id) || this.mkPeer(id, false)
    const pc = peer.pc
    const collision = kind === 'offer' && (peer.makingOffer || pc.signalingState !== 'stable')
    if (collision && !peer.polite) return
    if (collision && pc.signalingState === 'have-local-offer') await pc.setLocalDescription({ type: 'rollback' }).catch(() => {})
    await pc.setRemoteDescription(desc).catch(() => {})
    for (const c of peer.pending) await pc.addIceCandidate(c).catch(() => {})
    peer.pending = []
    if (kind === 'offer') { await pc.setLocalDescription(); this.signal('answer', id, pc.localDescription) }
  }

  private drop(id: string) {
    const p = this.peers.get(id)
    if (!p) return
    this.peers.delete(id)
    try { p.dc?.close() } catch { /* */ }
    try { p.pc.close() } catch { /* */ }
    this.h.onPeer?.(id, 'closed')
  }
}

