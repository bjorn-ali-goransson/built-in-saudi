// P2P mesh call engine. Media (cam/mic/screen) and data (whiteboard, chat, files)
// flow directly between browsers over WebRTC; our only server contact is the
// signaling relay (offers/answers/ICE) — it never sees call content. STUN is
// public (address discovery only). No TURN → strict/symmetric NATs won't connect.
// Signaling relay URL; overridable in tests via window.__CALL_SIGNAL.
const FN = (typeof window !== 'undefined' && (window as unknown as { __CALL_SIGNAL?: string }).__CALL_SIGNAL) || 'https://us-central1-blitz-ksa.cloudfunctions.net/call-signal'

const ICE: RTCIceServer[] = [
  { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
  { urls: ['stun:stun.cloudflare.com:3478'] },
]

export type PeerState = 'connecting' | 'connected' | 'failed'
// Data messages (JSON) sent over the channel — the app interprets these.
export type DataMsg =
  | { t: 'chat'; name: string; text: string }
  | { t: 'wb'; op: 'stroke' | 'clear'; stroke?: number[]; color?: string; width?: number }
  | { t: 'name'; name: string }
  | { t: 'file-start'; id: string; name: string; size: number; mime: string }
  | { t: 'file-end'; id: string }

export interface CallHandlers {
  onLocal?(stream: MediaStream): void
  onPeerStream?(id: string, stream: MediaStream): void
  onPeer?(id: string, state: PeerState): void
  onLeave?(id: string): void
  onData?(id: string, msg: DataMsg): void
  onFileChunk?(id: string, chunk: ArrayBuffer): void
}

interface Peer { pc: RTCPeerConnection; dc?: RTCDataChannel; stream?: MediaStream; pending: RTCIceCandidateInit[] }

const rid = () => (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2)).replace(/-/g, '').slice(0, 16)
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export class CallRoom {
  readonly room: string
  readonly me = rid()
  private h: CallHandlers
  private peers = new Map<string, Peer>()
  private since = -1 // highest signaling seq seen; -1 so we also get seq 0
  private live = false
  local: MediaStream | null = null
  private camTrack: MediaStreamTrack | null = null
  private screen: MediaStream | null = null

  constructor(room: string, handlers: CallHandlers) { this.room = room; this.h = handlers }

  async start(video: boolean): Promise<void> {
    this.local = await navigator.mediaDevices.getUserMedia({ audio: true, video: video ? { width: 1280, height: 720 } : false })
    this.camTrack = this.local.getVideoTracks()[0] || null
    this.h.onLocal?.(this.local)
    this.live = true
    await this.post('send', { to: 'all', type: 'join' })
    this.pollLoop()
  }

  // ---- signaling relay -------------------------------------------------------
  private async post(action: 'send' | 'poll', extra: Record<string, unknown>): Promise<{ seq?: number; msgs?: { from: string; to: string; type: string; payload: unknown; seq: number }[] }> {
    const r = await fetch(FN, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ room: this.room, from: this.me, action, ...extra }) })
    return r.ok ? r.json() : {}
  }
  private send(type: string, to: string, payload?: unknown) { this.post('send', { to, type, payload }).catch(() => {}) }

  private async pollLoop() {
    while (this.live) {
      try {
        const d = await this.post('poll', { since: this.since })
        for (const m of d.msgs || []) { await this.onSignal(m.from, m.type, m.payload); if (m.seq > this.since) this.since = m.seq }
      } catch { /* transient */ }
      const settling = [...this.peers.values()].some((p) => p.pc.connectionState !== 'connected')
      await sleep(settling || this.peers.size === 0 ? 900 : 3500)
    }
  }

  private async onSignal(from: string, type: string, payload: unknown) {
    if (from === this.me) return
    if (type === 'join') { this.send('hello', from); this.maybeOffer(from) }
    else if (type === 'hello') this.maybeOffer(from)
    else if (type === 'offer') await this.onOffer(from, payload as RTCSessionDescriptionInit)
    else if (type === 'answer') { const p = this.peers.get(from); if (p) { await p.pc.setRemoteDescription(payload as RTCSessionDescriptionInit); await this.flush(from) } }
    else if (type === 'ice') { const c = payload as RTCIceCandidateInit; const p = this.peers.get(from); if (p && p.pc.remoteDescription) await p.pc.addIceCandidate(c).catch(() => {}); else p?.pending.push(c) }
    else if (type === 'leave') this.drop(from)
  }
  private async flush(id: string) { const p = this.peers.get(id); if (!p) return; for (const c of p.pending) await p.pc.addIceCandidate(c).catch(() => {}); p.pending = [] }

  // Deterministic initiator: the larger id offers → no glare.
  private maybeOffer(other: string) { if (!this.peers.has(other) && this.me > other) this.offer(other) }

  private mkPeer(id: string): Peer {
    const pc = new RTCPeerConnection({ iceServers: ICE })
    const peer: Peer = { pc, pending: [] }
    this.local?.getTracks().forEach((t) => pc.addTrack(t, this.local!))
    pc.onicecandidate = (e) => { if (e.candidate) this.send('ice', id, e.candidate.toJSON()) }
    pc.ontrack = (e) => { peer.stream = e.streams[0]; this.h.onPeerStream?.(id, e.streams[0]) }
    pc.onconnectionstatechange = () => {
      const s = pc.connectionState
      if (s === 'connected') this.h.onPeer?.(id, 'connected')
      else if (s === 'failed') this.h.onPeer?.(id, 'failed')
      if (s === 'failed' || s === 'closed') this.drop(id)
    }
    pc.ondatachannel = (e) => this.bindDc(id, peer, e.channel)
    this.peers.set(id, peer)
    this.h.onPeer?.(id, 'connecting')
    return peer
  }
  private async offer(id: string) {
    const peer = this.mkPeer(id)
    this.bindDc(id, peer, peer.pc.createDataChannel('bis', { ordered: true }))
    const o = await peer.pc.createOffer(); await peer.pc.setLocalDescription(o)
    this.send('offer', id, o)
  }
  private async onOffer(id: string, offer: RTCSessionDescriptionInit) {
    const peer = this.peers.get(id) || this.mkPeer(id)
    await peer.pc.setRemoteDescription(offer); await this.flush(id)
    const a = await peer.pc.createAnswer(); await peer.pc.setLocalDescription(a)
    this.send('answer', id, a)
  }
  private bindDc(id: string, peer: Peer, dc: RTCDataChannel) {
    peer.dc = dc; dc.binaryType = 'arraybuffer'
    dc.onmessage = (e) => {
      if (typeof e.data === 'string') { try { this.h.onData?.(id, JSON.parse(e.data)) } catch { /* ignore */ } }
      else this.h.onFileChunk?.(id, e.data as ArrayBuffer)
    }
  }

  // ---- app-facing send -------------------------------------------------------
  broadcast(msg: DataMsg) { const s = JSON.stringify(msg); for (const p of this.peers.values()) if (p.dc?.readyState === 'open') p.dc.send(s) }
  /** Send a file to everyone (chunked over each channel). */
  async sendFile(file: File) {
    const id = rid(), CH = 16 * 1024
    this.broadcast({ t: 'file-start', id, name: file.name, size: file.size, mime: file.type })
    const buf = await file.arrayBuffer()
    for (let o = 0; o < buf.byteLength; o += CH) {
      const slice = buf.slice(o, o + CH)
      for (const p of this.peers.values()) if (p.dc?.readyState === 'open') { while (p.dc.bufferedAmount > 4 * 1024 * 1024) await sleep(40); p.dc.send(slice) }
    }
    this.broadcast({ t: 'file-end', id })
  }

  // ---- media controls --------------------------------------------------------
  toggleMic(on: boolean) { this.local?.getAudioTracks().forEach((t) => (t.enabled = on)) }
  toggleCam(on: boolean) { this.local?.getVideoTracks().forEach((t) => (t.enabled = on)) }
  private replaceVideo(track: MediaStreamTrack | null) {
    for (const p of this.peers.values()) { const sender = p.pc.getSenders().find((s) => s.track?.kind === 'video'); if (sender) sender.replaceTrack(track).catch(() => {}) }
  }
  async shareScreen(): Promise<MediaStream | null> {
    try {
      this.screen = await navigator.mediaDevices.getDisplayMedia({ video: true })
      const track = this.screen.getVideoTracks()[0]
      this.replaceVideo(track)
      track.onended = () => this.stopScreen()
      return this.screen
    } catch { return null }
  }
  stopScreen() { this.screen?.getTracks().forEach((t) => t.stop()); this.screen = null; this.replaceVideo(this.camTrack) }

  private drop(id: string) { const p = this.peers.get(id); if (!p) return; try { p.pc.close() } catch { /* */ } this.peers.delete(id); this.h.onLeave?.(id) }
  leave() { this.live = false; this.send('leave', 'all'); this.stopScreen(); this.peers.forEach((p) => { try { p.pc.close() } catch { /* */ } }); this.peers.clear(); this.local?.getTracks().forEach((t) => t.stop()) }
}
