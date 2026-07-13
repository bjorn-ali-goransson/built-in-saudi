// P2P mesh call engine. Media (cam/mic/screen) AND lobby control (names, knock,
// admit) flow directly between browsers over WebRTC data channels. Our only
// server contact is the signaling relay, which shuttles the WebRTC handshake
// (offer/answer/ICE) — random peer ids and SDP only, never names or content.
// A data-only connection forms first (no camera/mic); media is added lazily via
// renegotiation once the host admits a guest, so un-admitted guests never see or
// send any media, and their names are exchanged peer-to-peer, not via the relay.
const FN = (typeof window !== 'undefined' && (window as unknown as { __CALL_SIGNAL?: string }).__CALL_SIGNAL) || 'https://us-central1-blitz-ksa.cloudfunctions.net/call-signal'

const ICE: RTCIceServer[] = [
  { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
  { urls: ['stun:stun.cloudflare.com:3478'] },
]

export type PeerState = 'connecting' | 'connected' | 'failed'
export type Role = 'host' | 'guest'
export interface PeerInfo { name: string; role: Role; inCall: boolean; muted: boolean; cam: boolean; sharing: boolean; aspect: number }

// A whiteboard object (a pen/eraser stroke or a text label). Coords are in the
// centred, aspect-preserving board space; width/size are fractions of the board.
export type WbObj =
  | { id: string; kind: 'stroke'; pts: number[]; color: string; width: number; erase?: boolean }
  | { id: string; kind: 'text'; u: number; v: number; text: string; color: string; size: number; rot?: number }

// App data messages (JSON, `t`) sent over the channel between in-call peers.
export type DataMsg =
  | { t: 'chat'; name: string; text: string }
  | { t: 'wb'; op: 'start'; id: string; pt: number[]; color: string; width: number; erase: boolean }
  | { t: 'wb'; op: 'point'; id: string; pt: number[] }
  | { t: 'wb'; op: 'text'; obj: WbObj }
  | { t: 'wb'; op: 'remove'; id: string }
  | { t: 'wb'; op: 'clear' }
  | { t: 'file-start'; id: string; name: string; size: number; mime: string }
  | { t: 'file-end'; id: string }

// Control messages (JSON, `c`) — lobby presence, admission, force-mute; all P2P.
type Ctrl =
  | { c: 'info'; name: string; role: Role; inCall: boolean; muted: boolean; cam: boolean; sharing: boolean; aspect: number }
  | { c: 'admit' }
  | { c: 'fmute'; target: string; by: string }

export interface CallHandlers {
  onLocal?(stream: MediaStream): void
  onPeerStream?(id: string, stream: MediaStream): void
  onPeer?(id: string, state: PeerState): void
  onLeave?(id: string): void
  onData?(id: string, msg: DataMsg): void
  onFileChunk?(id: string, chunk: ArrayBuffer): void
  /** A peer told us who they are / their lobby + mic/cam state (over the data channel). */
  onPeerInfo?(id: string, info: PeerInfo): void
  /** Guest only: the host admitted us — media is now enabling; switch to the call. */
  onAdmitted?(): void
  /** Someone muted someone (by name → target id). If target is us, we're muted too. */
  onMuteNotice?(by: string, targetId: string, targetIsMe: boolean): void
  /** The meeting was closed (host ended it, or it was nuked after a disconnect). */
  onClosed?(): void
}

interface Peer {
  pc: RTCPeerConnection
  dc?: RTCDataChannel
  stream?: MediaStream
  pending: RTCIceCandidateInit[]
  polite: boolean
  makingOffer: boolean
  info?: PeerInfo
  mediaLinked: boolean // our local tracks have been added to this pc
}

const rid = () => (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2)).replace(/-/g, '').slice(0, 16)
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export class CallRoom {
  readonly room: string
  readonly me = rid()
  private h: CallHandlers
  private peers = new Map<string, Peer>()
  private since = -1
  private active = false
  private name = ''
  private role: Role = 'guest'
  private heartbeat: number | undefined
  private muted = true // privacy-first: start muted with the camera off
  private cam = false
  private screenOn = false
  private aspect = 1 // our whiteboard canvas w/h — shared so peers can fade the non-common area
  inCall = false // we've enabled our own media
  local: MediaStream | null = null
  private camTrack: MediaStreamTrack | null = null
  private screen: MediaStream | null = null

  constructor(room: string, handlers: CallHandlers) { this.room = room; this.h = handlers }

  /** Enter the room: start signalling and form data-only connections with anyone
   *  present. No camera/mic yet. Hosts wait for guests; guests knock over the
   *  data channel once connected. */
  enterLobby(name: string, asHost: boolean): void {
    this.name = name; this.role = asHost ? 'host' : 'guest'
    if (!this.active) { this.active = true; this.pollLoop() }
    this.send('join', 'all')
    // Heartbeat: re-announce presence over the data channels so peers can expire
    // anyone who goes quiet (closed tab) instead of leaving them stuck in the lobby.
    this.heartbeat = window.setInterval(() => this.broadcastInfo(), 5000)
  }

  /** Turn on our camera/mic and share them with everyone already in the call. */
  async enableMedia(): Promise<void> {
    if (this.inCall) return
    this.local = await navigator.mediaDevices.getUserMedia({ audio: true, video: { width: 1280, height: 720 } })
    this.camTrack = this.local.getVideoTracks()[0] || null
    // Privacy-first: join muted with the camera off — the user turns each on.
    this.local.getAudioTracks().forEach((t) => (t.enabled = false))
    this.local.getVideoTracks().forEach((t) => (t.enabled = false))
    this.inCall = true
    this.h.onLocal?.(this.local)
    for (const p of this.peers.values()) this.linkMedia(p)
    this.broadcastInfo()
  }

  /** Host: admit a specific waiting guest — go live ourselves, then tell them. */
  async admit(id: string): Promise<void> {
    if (!this.inCall) await this.enableMedia()
    const p = this.peers.get(id)
    if (p?.dc?.readyState === 'open') p.dc.send(JSON.stringify({ c: 'admit' } as Ctrl))
  }

  /** Nuke the meeting: mark the room closed on the relay (future joins → not found). */
  async close(): Promise<void> { try { await this.post('close', {}) } catch { /* */ } this.leave() }

  // ---- signaling relay (handshake + presence trigger only) -------------------
  private async post(action: 'send' | 'poll' | 'close', extra: Record<string, unknown>): Promise<{ msgs?: { from: string; type: string; payload: unknown; seq: number }[]; closed?: boolean }> {
    const r = await fetch(FN, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ room: this.room, from: this.me, action, ...extra }) })
    return r.ok ? r.json() : {}
  }
  private send(type: string, to: string, payload?: unknown) { this.post('send', { to, type, payload }).catch(() => {}) }

  private async pollLoop() {
    while (this.active) {
      try {
        const d = await this.post('poll', { since: this.since })
        if (d.closed) { this.h.onClosed?.(); this.leave(); break }
        for (const m of d.msgs || []) { await this.onSignal(m.from, m.type, m.payload); if (m.seq > this.since) this.since = m.seq }
      } catch { /* transient */ }
      const settling = [...this.peers.values()].some((p) => p.pc.connectionState !== 'connected')
      await sleep(settling || this.peers.size === 0 ? 900 : 3500)
    }
  }

  private async onSignal(from: string, type: string, payload: unknown) {
    if (from === this.me) return
    if (type === 'join') { this.send('hello', from); this.connect(from) }
    else if (type === 'hello') this.connect(from)
    else if (type === 'offer' || type === 'answer') await this.onDesc(from, payload as RTCSessionDescriptionInit, type)
    else if (type === 'ice') { const c = payload as RTCIceCandidateInit; const p = this.peers.get(from); if (p?.pc.remoteDescription) await p.pc.addIceCandidate(c).catch(() => {}); else p?.pending.push(c) }
    else if (type === 'leave') this.drop(from)
  }

  // Form a data-only connection. The larger id creates the channel (initiator).
  private connect(other: string) { if (!this.peers.has(other)) this.mkPeer(other, this.me > other) }

  private mkPeer(id: string, initiator: boolean): Peer {
    const pc = new RTCPeerConnection({ iceServers: ICE })
    const peer: Peer = { pc, pending: [], polite: this.me < id, makingOffer: false, mediaLinked: false }
    pc.onnegotiationneeded = async () => {
      try { peer.makingOffer = true; await pc.setLocalDescription(); this.send('offer', id, pc.localDescription) }
      catch { /* */ } finally { peer.makingOffer = false }
    }
    pc.onicecandidate = (e) => { if (e.candidate) this.send('ice', id, e.candidate.toJSON()) }
    pc.ontrack = (e) => { peer.stream = e.streams[0]; this.h.onPeerStream?.(id, e.streams[0]) }
    pc.onconnectionstatechange = () => {
      const s = pc.connectionState
      if (s === 'connected') this.h.onPeer?.(id, 'connected')
      else if (s === 'failed') this.h.onPeer?.(id, 'failed')
      if (s === 'failed' || s === 'closed') this.drop(id)
    }
    pc.ondatachannel = (e) => this.bindDc(id, peer, e.channel)
    if (initiator) this.bindDc(id, peer, pc.createDataChannel('bis', { ordered: true }))
    this.peers.set(id, peer)
    this.h.onPeer?.(id, 'connecting')
    return peer
  }

  // Perfect negotiation: tolerate simultaneous (re)negotiation from both sides.
  private async onDesc(id: string, desc: RTCSessionDescriptionInit, kind: 'offer' | 'answer') {
    const peer = this.peers.get(id) || this.mkPeer(id, false)
    const pc = peer.pc
    const collision = kind === 'offer' && (peer.makingOffer || pc.signalingState !== 'stable')
    if (collision && !peer.polite) return // impolite peer ignores a colliding offer
    await pc.setRemoteDescription(desc).catch(() => {})
    await this.flush(id)
    if (kind === 'offer') { await pc.setLocalDescription(); this.send('answer', id, pc.localDescription) }
  }
  private async flush(id: string) { const p = this.peers.get(id); if (!p) return; for (const c of p.pending) await p.pc.addIceCandidate(c).catch(() => {}); p.pending = [] }

  // Add our media to a peer once we're BOTH in the call (never before).
  private linkMedia(peer: Peer) {
    if (!this.inCall || !this.local || peer.mediaLinked || !peer.info?.inCall) return
    peer.mediaLinked = true
    this.local.getTracks().forEach((t) => peer.pc.addTrack(t, this.local!)) // → renegotiation
  }

  private bindDc(id: string, peer: Peer, dc: RTCDataChannel) {
    peer.dc = dc; dc.binaryType = 'arraybuffer'
    dc.onopen = () => this.sendInfo(peer)
    dc.onmessage = (e) => {
      if (typeof e.data !== 'string') { this.h.onFileChunk?.(id, e.data as ArrayBuffer); return }
      let m: Record<string, unknown>
      try { m = JSON.parse(e.data) } catch { return }
      if (m.c === 'info') { peer.info = { name: String(m.name || ''), role: (m.role as Role) || 'guest', inCall: !!m.inCall, muted: !!m.muted, cam: !!m.cam, sharing: !!m.sharing, aspect: Number(m.aspect) || 1 }; this.h.onPeerInfo?.(id, peer.info); this.linkMedia(peer) }
      else if (m.c === 'admit') { if (!this.inCall) { this.h.onAdmitted?.(); this.enableMedia() } }
      else if (m.c === 'fmute') { const target = String(m.target || ''); const me = target === this.me; if (me) this.toggleMic(false); this.h.onMuteNotice?.(String(m.by || ''), target, me) }
      else if (typeof m.t === 'string') this.h.onData?.(id, m as unknown as DataMsg)
    }
  }
  private sendInfo(peer: Peer) { if (peer.dc?.readyState === 'open') peer.dc.send(JSON.stringify({ c: 'info', name: this.name, role: this.role, inCall: this.inCall, muted: this.muted, cam: this.cam, sharing: this.screenOn, aspect: this.aspect } as Ctrl)) }
  private broadcastInfo() { for (const p of this.peers.values()) this.sendInfo(p) }

  // ---- app-facing send (only to peers actually in the call) ------------------
  broadcast(msg: DataMsg) { const s = JSON.stringify(msg); for (const p of this.peers.values()) if (p.dc?.readyState === 'open' && p.info?.inCall) p.dc.send(s) }
  async sendFile(file: File) {
    const id = rid(), CH = 16 * 1024
    this.broadcast({ t: 'file-start', id, name: file.name, size: file.size, mime: file.type })
    const buf = await file.arrayBuffer()
    for (let o = 0; o < buf.byteLength; o += CH) {
      const slice = buf.slice(o, o + CH)
      for (const p of this.peers.values()) if (p.dc?.readyState === 'open' && p.info?.inCall) { while (p.dc.bufferedAmount > 4 * 1024 * 1024) await sleep(40); p.dc.send(slice) }
    }
    this.broadcast({ t: 'file-end', id })
  }

  // ---- media controls --------------------------------------------------------
  toggleMic(on: boolean) { this.muted = !on; this.local?.getAudioTracks().forEach((t) => (t.enabled = on)); this.broadcastInfo() }
  toggleCam(on: boolean) { this.cam = on; this.local?.getVideoTracks().forEach((t) => (t.enabled = on)); this.broadcastInfo() }
  /** Ask another participant's client to mute itself; everyone is notified. */
  forceMute(target: string) { const msg = JSON.stringify({ c: 'fmute', target, by: this.name } as Ctrl); for (const p of this.peers.values()) if (p.dc?.readyState === 'open' && p.info?.inCall) p.dc.send(msg) }
  /** Tell peers our whiteboard's aspect ratio so they can fade what we can't see. */
  setAspect(a: number) { if (a > 0 && Math.abs(a - this.aspect) > 0.01) { this.aspect = a; this.broadcastInfo() } }
  private replaceVideo(track: MediaStreamTrack | null) {
    for (const p of this.peers.values()) { const sender = p.pc.getSenders().find((s) => s.track?.kind === 'video'); if (sender) sender.replaceTrack(track).catch(() => {}) }
  }
  async shareScreen(): Promise<MediaStream | null> {
    try {
      this.screen = await navigator.mediaDevices.getDisplayMedia({ video: true })
      const track = this.screen.getVideoTracks()[0]
      this.replaceVideo(track)
      this.screenOn = true; this.broadcastInfo()
      track.onended = () => this.stopScreen()
      return this.screen
    } catch { return null }
  }
  stopScreen() { this.screen?.getTracks().forEach((t) => t.stop()); this.screen = null; this.replaceVideo(this.camTrack); if (this.screenOn) { this.screenOn = false; this.broadcastInfo() } }

  private drop(id: string) { const p = this.peers.get(id); if (!p) return; try { p.pc.close() } catch { /* */ } this.peers.delete(id); this.h.onLeave?.(id) }
  leave() {
    if (this.active) this.send('leave', 'all')
    this.active = false; this.inCall = false
    window.clearInterval(this.heartbeat)
    this.stopScreen()
    this.peers.forEach((p) => { try { p.pc.close() } catch { /* */ } }); this.peers.clear()
    this.local?.getTracks().forEach((t) => t.stop())
  }
}
