// P2P mesh call engine. Media (cam/mic/screen) AND lobby control (names, knock,
// admit) flow directly between browsers over WebRTC data channels. Our only
// server contact is the signaling relay, which shuttles the WebRTC handshake
// (offer/answer/ICE) — random peer ids and SDP only, never names or content.
// A data-only connection forms first (no camera/mic); media is added lazily via
// renegotiation once the host admits a guest, so un-admitted guests never see or
// send any media, and their names are exchanged peer-to-peer, not via the relay.
const FN = (typeof window !== 'undefined' && (window as unknown as { __CALL_SIGNAL?: string }).__CALL_SIGNAL) || 'https://us-central1-blitz-ksa.cloudfunctions.net/call-signal'

// One lightweight probe of the relay before showing a guest the join controls:
//  open    – the room exists and a host has posted (seq > 0)
//  closed  – the host ended it
//  missing – never created / expired (no messages ever)
// A network error returns 'open' so a hiccup never blocks a real meeting.
export async function roomStatus(room: string): Promise<'open' | 'closed' | 'missing'> {
  try {
    const r = await fetch(FN, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ room, from: 'probe' + Math.random().toString(36).slice(2, 8), action: 'poll', since: -1 }) })
    if (!r.ok) return 'open'
    const d = await r.json()
    if (d.closed) return 'closed'
    return d.seq && d.seq > 0 ? 'open' : 'missing'
  } catch { return 'open' }
}

const ICE: RTCIceServer[] = [
  { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
  { urls: ['stun:stun.cloudflare.com:3478'] },
]

export type PeerState = 'connecting' | 'connected' | 'failed'
export type Role = 'host' | 'guest'
export interface PeerInfo { name: string; role: Role; inCall: boolean; muted: boolean; cam: boolean; sharing: boolean; aspect: number }
export interface DiagPeer { id: string; name: string; theirInCall: boolean; conn: string; ice: string; dc: string; sendMic: string; sendCam: string; recvAudio: string; recvVideo: string }
export interface DiagSnapshot { me: string; role: Role; inCall: boolean; muted: boolean; mic: string; cam: string; peers: DiagPeer[] }

// A whiteboard object (a pen/eraser stroke or a text label). Coords are in the
// centred, aspect-preserving board space; width/size are fractions of the board.
export type WbObj =
  // `width` is the stroke's base; `wds` (optional) is a per-point width (board
  // fraction) so the brush can taper with pointer speed — slower = thicker.
  | { id: string; kind: 'stroke'; pts: number[]; color: string; width: number; erase?: boolean; wds?: number[] }
  | { id: string; kind: 'text'; u: number; v: number; text: string; color: string; size: number; rot?: number; w?: number }

// App data messages (JSON, `t`) sent over the channel between in-call peers.
export type DataMsg =
  | { t: 'chat'; name: string; text: string }
  // `b` is the board key (pure whiteboard / a file / a screen-share); absent = 'board'.
  | { t: 'wb'; op: 'start'; id: string; pt: number[]; color: string; width: number; erase: boolean; w?: number; b?: string }
  | { t: 'wb'; op: 'point'; id: string; pt: number[]; w?: number; b?: string }
  | { t: 'wb'; op: 'text'; obj: WbObj; b?: string }
  | { t: 'wb'; op: 'remove'; id: string; b?: string }
  | { t: 'wb'; op: 'clear'; b?: string }
  // Full whiteboard snapshot sent to a peer who joined after drawing began.
  | { t: 'wb-sync'; boards: [string, WbObj[]][] }
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
  /** Fired each poll cycle with the delay (ms) until the next relay poll — the UI
   *  uses it to show a "checking again" spinner partway through the wait. */
  onPollCycle?(delayMs: number): void
}

interface Peer {
  pc: RTCPeerConnection
  dc?: RTCDataChannel
  stream?: MediaStream
  pending: RTCIceCandidateInit[]
  polite: boolean
  makingOffer: boolean
  info?: PeerInfo
  mediaLinked: boolean // our media senders have been created on this pc
  aSender?: RTCRtpSender // persistent audio sender — replaceTrack(null) to release, without renegotiating
  vSender?: RTCRtpSender // persistent video sender (camera or screen)
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
  // Live device tracks — acquired only while on, and stop()ped when the user turns
  // them off so the browser drops its "camera/mic in use" indicator (a disabled
  // track keeps the hardware open; only stop() releases it).
  private audioTrack: MediaStreamTrack | null = null
  private videoTrack: MediaStreamTrack | null = null
  private screen: MediaStream | null = null
  // Preferred input device ids (chosen in the UI). Applied on the next acquire and,
  // when a device is already live, switched immediately via switchMic/switchCamera.
  private micId: string | undefined
  private camId: string | undefined

  constructor(room: string, handlers: CallHandlers) { this.room = room; this.h = handlers }

  /** Enter the room: start signalling and form data-only connections with anyone
   *  present. No camera/mic yet. Hosts wait for guests; guests knock over the
   *  data channel once connected. */
  enterLobby(name: string, asHost: boolean): void {
    this.name = name; this.role = asHost ? 'host' : 'guest'
    if (!this.active) { this.active = true; this.pollLoop() }
    // A guest only KNOCKS (only the host answers) — so a waiting guest is connected
    // to the host alone and never sees the other participants until admitted. The
    // host announces itself with JOIN, and admitted peers JOIN to mesh (enableMedia).
    this.send(asHost ? 'join' : 'knock', 'all')
    this.heartbeat = window.setInterval(() => this.broadcastInfo(), 2000)
  }

  /** Join the call. Privacy-first: we open NO device here — we start muted with the
   *  camera off, so nothing is acquired until the user actually turns mic/cam on. */
  async enableMedia(): Promise<void> {
    if (this.inCall) return
    this.local = new MediaStream()
    this.inCall = true
    this.send('join', 'all') // now admitted → invite the other in-call peers to mesh
    this.emitPreview()
    for (const p of this.peers.values()) this.linkMedia(p)
    this.broadcastInfo()
  }

  // Hand the UI a FRESH MediaStream of the current local tracks for the self-view.
  // The new reference forces the <video> to re-attach and re-read the track — a
  // stopped→restarted camera otherwise keeps the old track's intrinsic size and
  // renders stretched (a portrait phone showing a landscape-shaped frame). We keep
  // `this.local` (the senders' stream group) stable so audio/video stay one remote
  // stream; only the preview reference changes.
  private emitPreview() {
    const tracks: MediaStreamTrack[] = []
    if (this.audioTrack) tracks.push(this.audioTrack)
    if (this.videoTrack) tracks.push(this.videoTrack)
    this.h.onLocal?.(new MediaStream(tracks))
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
      let got = 0
      try {
        const d = await this.post('poll', { since: this.since })
        if (d.closed) { this.h.onClosed?.(); this.leave(); break }
        const msgs = d.msgs || []; got = msgs.length
        for (const m of msgs) { await this.onSignal(m.from, m.type, m.payload); if (m.seq > this.since) this.since = m.seq }
      } catch { /* transient */ }
      // Drain a handshake burst immediately; poll fast while (re)connecting or waiting
      // for someone (so knocks/joins land in well under a second); back off once
      // everyone's connected. The relay only ever carries the handshake.
      const settling = [...this.peers.values()].some((p) => p.pc.connectionState !== 'connected')
      const delay = got > 0 ? 120 : settling || this.peers.size === 0 ? 300 : 1200
      this.h.onPollCycle?.(delay)
      await sleep(delay)
    }
  }

  private async onSignal(from: string, type: string, payload: unknown) {
    if (from === this.me) return
    // Only the host answers a knock; only the host / already-admitted peers answer a
    // join. A waiting guest (not host, not in-call) ignores both → it connects to the
    // host alone and can't discover or reach the other participants.
    if (type === 'knock') { if (this.role === 'host') { this.send('hello', from); this.connect(from) } }
    else if (type === 'join') { if (this.role === 'host' || this.inCall) { this.send('hello', from); this.connect(from) } }
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
    // Polite peer in a glare: roll our own offer back first, then accept theirs
    // (otherwise the 2nd/3rd peer's media renegotiation can silently stall).
    if (collision && peer.polite && pc.signalingState === 'have-local-offer') await pc.setLocalDescription({ type: 'rollback' }).catch(() => {})
    await pc.setRemoteDescription(desc).catch(() => {})
    await this.flush(id)
    if (kind === 'offer') { await pc.setLocalDescription(); this.send('answer', id, pc.localDescription) }
  }
  private async flush(id: string) { const p = this.peers.get(id); if (!p) return; for (const c of p.pending) await p.pc.addIceCandidate(c).catch(() => {}); p.pending = [] }

  // Once we're BOTH in the call, push whatever we're currently sending (if a device
  // is on). Senders persist so later toggles are replaceTrack, not renegotiation.
  private linkMedia(peer: Peer) {
    if (!this.inCall || peer.mediaLinked || !peer.info?.inCall) return
    peer.mediaLinked = true
    if (this.audioTrack) this.addOrReplace(peer, this.audioTrack)
    const v = this.screenOn ? this.screen?.getVideoTracks()[0] || null : this.videoTrack
    if (v) this.addOrReplace(peer, v)
  }
  // Put a track on a peer's sender of that kind, creating the sender the first time
  // (that first add renegotiates; every later swap — including →null — does not).
  private addOrReplace(peer: Peer, track: MediaStreamTrack) {
    const audio = track.kind === 'audio'
    const cur = audio ? peer.aSender : peer.vSender
    if (cur) { cur.replaceTrack(track).catch(() => {}); return }
    if (!this.local) return
    const s = peer.pc.addTrack(track, this.local)
    if (audio) peer.aSender = s; else peer.vSender = s
  }
  private releaseKind(kind: 'audio' | 'video') {
    for (const p of this.peers.values()) { const s = kind === 'audio' ? p.aSender : p.vSender; s?.replaceTrack(null).catch(() => {}) }
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
  // `id` is shared with the sender's local file entry so both sides key that file's
  // whiteboard by the same board id (`f:<id>`) and its annotations sync.
  async sendFile(file: File, id: string) {
    const CH = 16 * 1024
    this.broadcast({ t: 'file-start', id, name: file.name, size: file.size, mime: file.type })
    const buf = await file.arrayBuffer()
    for (let o = 0; o < buf.byteLength; o += CH) {
      const slice = buf.slice(o, o + CH)
      for (const p of this.peers.values()) if (p.dc?.readyState === 'open' && p.info?.inCall) { while (p.dc.bufferedAmount > 4 * 1024 * 1024) await sleep(40); p.dc.send(slice) }
    }
    this.broadcast({ t: 'file-end', id })
  }

  // ---- media controls --------------------------------------------------------
  /** Unmute → acquire the mic and route it; mute → stop the mic (releases hardware).
   *  Returns false if the user denied the mic so the UI can revert. */
  async toggleMic(on: boolean): Promise<boolean> {
    if (on) {
      if (!this.audioTrack) {
        try { const s = await navigator.mediaDevices.getUserMedia({ audio: this.micId ? { deviceId: { exact: this.micId } } : true }); this.audioTrack = s.getAudioTracks()[0] }
        catch { this.muted = true; this.broadcastInfo(); return false }
        this.local?.addTrack(this.audioTrack)
      }
      this.muted = false
      for (const p of this.peers.values()) if (p.info?.inCall) this.addOrReplace(p, this.audioTrack)
    } else {
      this.muted = true; this.releaseKind('audio')
      if (this.audioTrack) { this.local?.removeTrack(this.audioTrack); this.audioTrack.stop(); this.audioTrack = null }
    }
    this.broadcastInfo(); return true
  }
  /** Camera on → acquire and route it; off → stop it (releases the camera). */
  async toggleCam(on: boolean): Promise<boolean> {
    if (on) {
      if (!this.videoTrack) {
        try { const s = await navigator.mediaDevices.getUserMedia({ video: { deviceId: this.camId ? { exact: this.camId } : undefined, width: 1280, height: 720 } }); this.videoTrack = s.getVideoTracks()[0] }
        catch { this.cam = false; this.broadcastInfo(); return false }
        this.local?.addTrack(this.videoTrack)
      }
      this.cam = true
      this.emitPreview()
      if (!this.screenOn) for (const p of this.peers.values()) if (p.info?.inCall) this.addOrReplace(p, this.videoTrack)
    } else {
      this.cam = false
      if (!this.screenOn) this.releaseKind('video')
      if (this.videoTrack) { this.local?.removeTrack(this.videoTrack); this.videoTrack.stop(); this.videoTrack = null }
      this.emitPreview()
    }
    this.broadcastInfo(); return true
  }
  /** Switch the active microphone. Remembered for the next unmute; applied live via
   *  replaceTrack (no renegotiation) when the mic is currently on. */
  async switchMic(id: string): Promise<void> {
    this.micId = id
    if (this.muted || !this.audioTrack) return
    let track: MediaStreamTrack
    try { track = (await navigator.mediaDevices.getUserMedia({ audio: { deviceId: { exact: id } } })).getAudioTracks()[0] } catch { return }
    this.local?.removeTrack(this.audioTrack); this.audioTrack.stop()
    this.audioTrack = track; this.local?.addTrack(track)
    for (const p of this.peers.values()) if (p.info?.inCall) this.addOrReplace(p, track)
  }
  /** Switch the active camera. Remembered for next cam-on; applied live otherwise
   *  (unless a screen share is on, which owns the video wire). */
  async switchCamera(id: string): Promise<void> {
    this.camId = id
    if (!this.cam || !this.videoTrack) return
    let track: MediaStreamTrack
    try { track = (await navigator.mediaDevices.getUserMedia({ video: { deviceId: { exact: id }, width: 1280, height: 720 } })).getVideoTracks()[0] } catch { return }
    this.local?.removeTrack(this.videoTrack); this.videoTrack.stop()
    this.videoTrack = track; this.local?.addTrack(track); this.emitPreview()
    if (!this.screenOn) this.setVideoWire(track)
  }
  /** Ask another participant's client to mute itself; everyone is notified. */
  forceMute(target: string) { const msg = JSON.stringify({ c: 'fmute', target, by: this.name } as Ctrl); for (const p of this.peers.values()) if (p.dc?.readyState === 'open' && p.info?.inCall) p.dc.send(msg) }
  /** Tell peers our whiteboard's aspect ratio so they can fade what we can't see. */
  setAspect(a: number) { if (a > 0 && Math.abs(a - this.aspect) > 0.01) { this.aspect = a; this.broadcastInfo() } }
  private setVideoWire(track: MediaStreamTrack | null) {
    for (const p of this.peers.values()) { if (!p.info?.inCall) continue; if (track) this.addOrReplace(p, track); else p.vSender?.replaceTrack(null).catch(() => {}) }
  }
  // Throws on failure (the caller surfaces the reason) instead of swallowing it —
  // a silent null made mobile screen-share failures impossible to diagnose.
  async shareScreen(): Promise<MediaStream> {
    this.screen = await navigator.mediaDevices.getDisplayMedia({ video: true })
    const track = this.screen.getVideoTracks()[0]
    this.setVideoWire(track)
    this.screenOn = true; this.broadcastInfo()
    track.onended = () => this.stopScreen()
    return this.screen
  }
  stopScreen() { this.screen?.getTracks().forEach((t) => t.stop()); this.screen = null; this.setVideoWire(this.cam ? this.videoTrack : null); if (this.screenOn) { this.screenOn = false; this.broadcastInfo() } }

  /** A snapshot of live connection + media state, for the on-screen debug panel. */
  diag(): DiagSnapshot {
    const t = (tr?: MediaStreamTrack | null) => (tr ? `${tr.readyState}${tr.enabled ? '' : ' off'}${tr.muted ? ' muted' : ''}` : '—')
    return {
      me: this.me.slice(0, 5), role: this.role, inCall: this.inCall, muted: this.muted,
      mic: t(this.audioTrack), cam: t(this.videoTrack),
      peers: [...this.peers.entries()].map(([id, p]) => ({
        id: id.slice(0, 5), name: p.info?.name || '?', theirInCall: !!p.info?.inCall,
        conn: p.pc.connectionState, ice: p.pc.iceConnectionState, dc: p.dc?.readyState || '—',
        sendMic: t(p.aSender?.track), sendCam: t(p.vSender?.track),
        recvAudio: (p.stream?.getAudioTracks() || []).map(t).join(',') || '—',
        recvVideo: (p.stream?.getVideoTracks() || []).map(t).join(',') || '—',
      })),
    }
  }

  private drop(id: string) { const p = this.peers.get(id); if (!p) return; try { p.pc.close() } catch { /* */ } this.peers.delete(id); this.h.onLeave?.(id) }
  leave() {
    if (this.active) this.send('leave', 'all')
    this.active = false; this.inCall = false
    window.clearInterval(this.heartbeat)
    this.stopScreen()
    this.peers.forEach((p) => { try { p.pc.close() } catch { /* */ } }); this.peers.clear()
    this.local?.getTracks().forEach((t) => t.stop())
    this.audioTrack?.stop(); this.videoTrack?.stop(); this.audioTrack = null; this.videoTrack = null
  }
}
