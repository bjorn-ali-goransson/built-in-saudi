// P2P mesh call engine. Media (cam/mic/screen) AND lobby control (names, knock,
// admit) flow directly between browsers over WebRTC data channels. Our only
// server contact is the signaling relay, which shuttles the WebRTC handshake
// (offer/answer/ICE) — random peer ids and SDP only, never names or content.
// A data-only connection forms first (no camera/mic); media is added lazily via
// renegotiation once the host admits a guest, so un-admitted guests never see or
// send any media, and their names are exchanged peer-to-peer, not via the relay.
import type { LinkSample } from './videoGovernor'
import { fingerprintOf, safetyCode } from './safety'
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

/** One-off relay message into a room we're not connected to — used by a busy link
 *  owner to tell a waiting caller (in their own room) to switch rooms or that they
 *  were declined. Fire-and-forget; the caller's poll loop picks it up. */
export async function signalRoom(room: string, type: 'redirect' | 'decline', payload: Record<string, unknown>): Promise<void> {
  try {
    await fetch(FN, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ room, from: 'own' + Math.random().toString(36).slice(2, 8), to: 'all', action: 'send', type, payload }) })
  } catch { /* fire-and-forget */ }
}

// Camera capture ceiling (#214). 720p costs ~4x the pixels of this and the tiles
// never render anywhere near that big — a 2-column grid tops out around 300px wide.
// Capturing smaller cuts upstream bytes, encoder CPU and phone battery at once.
const CAM: MediaTrackConstraints = {
  width: { ideal: 960 }, height: { ideal: 540 }, frameRate: { ideal: 24, max: 30 },
}

// Roughly what a given encoded width is worth, in kbps. A 160px thumbnail is ~36x
// fewer pixels than 960px, so it has no business carrying a 700 kbps stream.
const bitrateFor = (w: number) => (w <= 160 ? 60 : w <= 240 ? 100 : w <= 320 ? 160 : w <= 480 ? 300 : w <= 640 ? 450 : 700)

// Public STUN only finds each side's public address. Two phones behind carrier
// NAT (the ordinary case for a mobile in Saudi) usually cannot reach each other
// that way at all, so the relay also hands out short-lived TURN credentials per
// room (`ice` in functions/call.js); with those, a pair that cannot connect
// directly is relayed instead of failing. Without them (the function down, an
// older deploy) this list is what we have, and the failure is reported loudly.
const ICE: RTCIceServer[] = [
  { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
  { urls: ['stun:stun.cloudflare.com:3478'] },
]

// How long a connection may take to come up before we call it failed. Browsers
// declare `failed` on their own after ~30s, and Safari can sit in `checking` far
// longer, so without our own deadline a guest just waits. Specs shorten it.
const connectTimeout = () => (typeof window !== 'undefined' && (window as unknown as { __CALL_CONNECT_TIMEOUT?: number }).__CALL_CONNECT_TIMEOUT) || 25_000

/** How the media to and from the other side travels: straight there, or through
 *  our TURN relay (either side's relay candidate counts — the bytes cross it). */
export type Path = 'unknown' | 'direct' | 'relay'

/** Everything we know about a connection that did not come up — shown on screen
 *  (Copy details) and logged by the relay, so a failure can be diagnosed after
 *  the fact. Candidate TYPES only, never addresses. */
export interface ConnectFailure {
  why: 'timeout' | 'failed'
  ms: number // since the attempt began
  role: Role
  inCall: boolean
  relayConfigured: boolean // we had TURN credentials
  heardFrom: boolean // the other side answered over signalling at all
  local: string[] // candidate types WE gathered: host, srflx, relay
  remote: string[] // candidate types THEY sent us
  turnErrors: string[] // icecandidateerror codes, e.g. "701" (relay unreachable)
  ice: string[] // ICE state changes, "checking@1200"
  gathering: string
  dc: string
}
/** The one-line cause a person can act on. */
export type FailReason = 'no-answer' | 'relay-unreachable' | 'no-relay' | 'blocked'
export function failReason(f: ConnectFailure): FailReason {
  if (!f.heardFrom) return 'no-answer' // the other device never replied: closed tab, asleep, offline
  if (!f.relayConfigured) return 'no-relay' // direct was blocked and we had no relay to fall back on
  if (!f.local.includes('relay')) return 'relay-unreachable' // this network blocks our relay server
  return 'blocked' // even the relay did not get through — likely the other side's network
}

// iPhone/Mac Lockdown Mode (and some locked-down browsers) remove WebRTC outright.
// Without this check the guest's engine throws inside the signal handler when the
// host answers, the error is swallowed, and the guest waits on "still trying" for
// ever while the host times out having heard nothing.
export function canCall(): boolean {
  return typeof window !== 'undefined' && typeof window.RTCPeerConnection === 'function'
}
/** Apple browsers: the likely reason is Lockdown Mode, which the person can lift per site. */
export function isApple(): boolean {
  return typeof navigator !== 'undefined' && (/iPhone|iPad|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && /Apple/.test(navigator.vendor || '')))
}
/** Logged like a connection failure, so a call that never could start is still explained. */
export function reportNoWebrtc(room: string) {
  void fetch(FN, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ room, from: 'no-webrtc', action: 'diag', payload: { kind: 'fail', why: 'no-webrtc', reason: 'no-webrtc' } }) }).catch(() => {})
}

export type PeerState = 'connecting' | 'connected' | 'failed'
export type Role = 'host' | 'guest'
export interface PeerInfo { name: string; role: Role; inCall: boolean; muted: boolean; cam: boolean; sharing: boolean; aspect: number; link?: string }
export interface DiagPeer { id: string; name: string; theirInCall: boolean; conn: string; ice: string; dc: string; sendMic: string; sendCam: string; recvAudio: string; recvVideo: string; path: Path; local: string; remote: string }
export interface DiagSnapshot { me: string; role: Role; inCall: boolean; muted: boolean; mic: string; cam: string; relay: boolean; path: Path; peers: DiagPeer[] }

// A whiteboard object (a pen/eraser stroke or a text label). Coords are in the
// centred, aspect-preserving board space; width/size are fractions of the board.
export type WbObj =
  // `width` is the stroke's base; `wds` (optional) is a per-point width (board
  // fraction) so the brush can taper with pointer speed — slower = thicker.
  | { id: string; kind: 'stroke'; pts: number[]; color: string; width: number; erase?: boolean; wds?: number[] }
  | { id: string; kind: 'text'; u: number; v: number; text: string; color: string; size: number; rot?: number; w?: number }

// App data messages (JSON, `t`) sent over the channel between in-call peers.
export type DataMsg =
  | { t: 'chat'; id: string; name: string; text: string; doc?: { url: string; title: string } }
  // A live floating reaction on the meeting (Zoom/FB-style), and a toggle reaction
  // pinned to a specific chat message (by its id). Both carry the reactor's name.
  | { t: 'react'; emoji: string; name: string }
  | { t: 'msg-react'; id: string; emoji: string; name: string }
  // `b` is the board key (pure whiteboard / a file / a screen-share); absent = 'board'.
  | { t: 'wb'; op: 'start'; id: string; pt: number[]; color: string; width: number; erase: boolean; w?: number; b?: string }
  | { t: 'wb'; op: 'point'; id: string; pt: number[]; w?: number; b?: string }
  | { t: 'wb'; op: 'text'; obj: WbObj; b?: string }
  | { t: 'wb'; op: 'remove'; id: string; b?: string }
  | { t: 'wb'; op: 'clear'; b?: string }
  // Full whiteboard snapshot sent to a peer who joined after drawing began.
  | { t: 'wb-sync'; boards: [string, WbObj[]][] }
  // A picture behind a board, as a data URL sent in pieces: one data-channel
  // message is capped (256KB in Chromium) and a photo can be more than that.
  | { t: 'wb-bg'; b: string; id: string; i: number; n: number; part: string }
  | { t: 'file-start'; id: string; name: string; size: number; mime: string }
  | { t: 'file-end'; id: string }
  // Switch the shared main stage for everyone: a file id, or '' for the whiteboard.
  | { t: 'view'; file: string }
  // Contact-request handshake (#229): ask a peer with no call-me link to become
  // saveable. They approve (claim a link + enable push, hand the code back) or
  // decline. Directed at a single peer via sendTo, not broadcast.
  | { t: 'contact-req'; name: string }
  | { t: 'contact-approve'; link: string; name: string }
  | { t: 'contact-decline'; name: string }
  // Live location sharing (#235): a peer's current position (broadcast while sharing),
  // a stop signal, and shared map pins. Coordinates only — P2P, never the server.
  | { t: 'geo'; lat: number; lng: number; acc?: number }
  | { t: 'geo-stop' }
  | { t: 'pin'; id: string; lat: number; lng: number; label?: string }
  | { t: 'pin-remove'; id: string }
  // DM voice notes (#232): a chunked audio transfer over a data-only rendezvous
  // connection (no call). vn-start/vn-end bracket the binary chunks; vn-ack lets the
  // sender mark it delivered and drop it from its outbox.
  | { t: 'vn-start'; id: string; mime: string; dur: number; size: number }
  | { t: 'vn-end'; id: string }
  | { t: 'vn-ack'; id: string }
  // Somebody is recording the meeting (recorder.ts): sent when it starts and
  // every few seconds while it runs, so a late joiner is told too; `on: false`
  // when it stops. Everybody in the call shows it.
  | { t: 'rec'; on: boolean; name: string }
  // Somebody is typing in the chat: sent at most every few seconds while they
  // type, and forgotten by everybody a few seconds after the last one.
  | { t: 'typing'; name: string }

// Control messages (JSON, `c`) — lobby presence, admission, force-mute; all P2P.
type Ctrl =
  // `link` is our own published "call me" code, so people we're actually in a call
  // with can save us as a contact and ring us later (#221). Only ever set when the
  // user has published such a link — it's already a link they hand out.
  | { c: 'info'; name: string; role: Role; inCall: boolean; muted: boolean; cam: boolean; sharing: boolean; aspect: number; link?: string }
  | { c: 'admit' }
  | { c: 'fmute'; target: string; by: string }
  // "I am painting your video into a box this many DEVICE pixels wide." The sender
  // scales its encoder to match, so a 150px thumbnail never carries a 960px frame.
  | { c: 'want'; w: number }

export interface CallHandlers {
  onLocal?(stream: MediaStream): void
  onPeerStream?(id: string, stream: MediaStream): void
  onPeer?(id: string, state: PeerState): void
  /** A connection did not come up (or broke and could not recover). Fired once,
   *  before the peer is dropped, with what we know — `onPeer(…,'failed')` too. */
  onPeerFail?(id: string, f: ConnectFailure): void
  /** The media path changed. `relay` means the call goes through our TURN server,
   *  which carries voice only: video is withheld and the camera turned off. */
  onPath?(path: Path, from: Path): void
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
  /** A waiting caller was told (by the link owner, over the relay) to join another
   *  room instead — the owner is busy and chose to add them to their current call. */
  onRedirect?(room: string): void
  /** A waiting caller was declined by the link owner, with a short reason to show. */
  onDeclined?(message: string): void
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
  wantW?: number // device px this peer says it renders OUR video at (0 = not on screen)
  videoPaused?: boolean // they told us they aren't rendering us — we send them NO video
  sentWantW?: number // the last width WE asked this peer for (dedupes the control msg)
  reqPx?: number // the width we are actually painting them at, before any recording floor
  // Connection diagnostics (see ConnectFailure).
  born: number
  local: Set<string>
  remote: Set<string>
  turnErrors: Set<string>
  iceLog: string[]
  heardFrom: boolean
  timer?: number
  done?: boolean // connected once, or reported failed — the deadline no longer applies
  path: Path
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
  private myLink = '' // our published call-link code, shared with in-call peers (#221)
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

  /** Sees every app message we broadcast (`from` 'me') and every one we get,
   *  so a recording can keep the whiteboard and chat as events. */
  tap: ((from: string, msg: DataMsg) => void) | null = null
  // While recording, ask everyone for video at least this wide, whatever size
  // their tile is here (or none at all): the recording is drawn later, larger.
  private recFloor = 0

  private ice: RTCIceServer[] = ICE
  /** We hold TURN credentials, so a pair that cannot connect directly is relayed. */
  relayConfigured = false
  private iceReady: Promise<void> | null = null
  /** The worst media path across in-call peers (one relayed leg = a relayed call). */
  path: Path = 'unknown'

  constructor(room: string, handlers: CallHandlers) { this.room = room; this.h = handlers }

  // TURN credentials for this room, once. Bounded: a slow or missing answer must
  // never hold the call up, so after a few seconds we go on with STUN alone.
  private loadIce(): Promise<void> {
    if (!this.iceReady) this.iceReady = (async () => {
      const ctl = new AbortController(); const t = window.setTimeout(() => ctl.abort(), 5000)
      try {
        const r = await fetch(FN, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ room: this.room, from: this.me, action: 'ice' }), signal: ctl.signal })
        const d = r.ok ? await r.json() as { turn?: RTCIceServer[] } : {}
        const turn = (Array.isArray(d.turn) ? d.turn : []).filter((s) => s && s.urls && typeof s.username === 'string' && typeof s.credential === 'string')
        if (turn.length) { this.ice = [...ICE, ...turn]; this.relayConfigured = true }
      } catch { /* STUN only — reported as `no-relay` if a connection then fails */ }
      finally { window.clearTimeout(t) }
    })()
    return this.iceReady
  }

  /** Enter the room: start signalling and form data-only connections with anyone
   *  present. No camera/mic yet. Hosts wait for guests; guests knock over the
   *  data channel once connected. */
  enterLobby(name: string, asHost: boolean): void {
    this.name = name; this.role = asHost ? 'host' : 'guest'
    // Nothing connects before the ICE servers are known: a peer built with STUN
    // alone would never be relayed, however long it tried.
    if (!this.active) { this.active = true; void this.loadIce().then(() => this.pollLoop()) }
    // A guest only KNOCKS (only the host answers) — so a waiting guest is connected
    // to the host alone and never sees the other participants until admitted. The
    // host announces itself with JOIN, and admitted peers JOIN to mesh (enableMedia).
    void this.loadIce().then(() => { if (this.active) this.send(asHost ? 'join' : 'knock', 'all') })
    this.heartbeat = window.setInterval(() => { this.broadcastInfo(); void this.watchPath() }, 2000)
  }

  /** Guest: knock again after a connection to the host failed. The failed peer is
   *  already dropped, so the host's answer builds a fresh connection. */
  retryKnock(): void { if (this.active && !this.inCall) this.send('knock', 'all') }

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
    else if (type === 'ice') {
      const c = payload as RTCIceCandidateInit; const p = this.peers.get(from)
      const typ = / typ (\w+)/.exec(c?.candidate || '')?.[1]; if (p && typ) p.remote.add(typ)
      if (p?.pc.remoteDescription) await p.pc.addIceCandidate(c).catch(() => {}); else p?.pending.push(c)
    }
    else if (type === 'leave') this.drop(from)
    // Owner→waiting-caller control (sent from another room via signalRoom).
    else if (type === 'redirect') { const r = String((payload as { room?: string })?.room || ''); if (r) this.h.onRedirect?.(r) }
    else if (type === 'decline') this.h.onDeclined?.(String((payload as { msg?: string })?.msg || ''))
  }

  // Form a data-only connection. The larger id creates the channel (initiator).
  private connect(other: string) { if (!this.peers.has(other)) this.mkPeer(other, this.me > other) }

  private mkPeer(id: string, initiator: boolean): Peer {
    if (!canCall()) throw new Error('NoWebRTC') // the screen already says why (CallsTool)
    const pc = new RTCPeerConnection({ iceServers: this.ice })
    const born = Date.now()
    const peer: Peer = { pc, pending: [], polite: this.me < id, makingOffer: false, mediaLinked: false, born, local: new Set(), remote: new Set(), turnErrors: new Set(), iceLog: [], heardFrom: false, path: 'unknown' }
    pc.onnegotiationneeded = async () => {
      try { peer.makingOffer = true; await pc.setLocalDescription(); this.send('offer', id, pc.localDescription) }
      catch { /* */ } finally { peer.makingOffer = false }
    }
    pc.onicecandidate = (e) => {
      if (!e.candidate) return
      const typ = e.candidate.type || / typ (\w+)/.exec(e.candidate.candidate)?.[1]; if (typ) peer.local.add(typ)
      this.send('ice', id, e.candidate.toJSON())
    }
    // A relay we could not reach or that refused us says so here, and nowhere else.
    pc.onicecandidateerror = (e) => { const ev = e as RTCPeerConnectionIceErrorEvent; if (ev.url && /^turns?:/.test(ev.url)) peer.turnErrors.add(`${ev.errorCode}${ev.url.startsWith('turns:') ? ' tls' : ''}`) }
    pc.oniceconnectionstatechange = () => { if (peer.iceLog.length < 20) peer.iceLog.push(`${pc.iceConnectionState}@${Date.now() - born}`) }
    pc.ontrack = (e) => { peer.stream = e.streams[0]; this.h.onPeerStream?.(id, e.streams[0]) }
    pc.onconnectionstatechange = () => {
      const s = pc.connectionState
      if (s === 'connected') {
        if (!peer.done) { peer.done = true; window.clearTimeout(peer.timer); void this.reportConnected(peer) }
        this.h.onPeer?.(id, 'connected')
      } else if (s === 'failed') { this.fail(id, 'failed'); return }
      if (s === 'closed') this.drop(id)
    }
    // Our own deadline for the FIRST connection; a call that was up and then broke
    // is `failed` above. Without it a guest waits on a spinner indefinitely.
    peer.timer = window.setTimeout(() => { if (!peer.done && this.peers.get(id) === peer) this.fail(id, 'timeout') }, connectTimeout())
    pc.ondatachannel = (e) => this.bindDc(id, peer, e.channel)
    if (initiator) this.bindDc(id, peer, pc.createDataChannel('bis', { ordered: true }))
    this.peers.set(id, peer)
    this.h.onPeer?.(id, 'connecting')
    return peer
  }

  private failure(peer: Peer, why: ConnectFailure['why']): ConnectFailure {
    return {
      why, ms: Date.now() - peer.born, role: this.role, inCall: this.inCall, relayConfigured: this.relayConfigured,
      heardFrom: peer.heardFrom, local: [...peer.local], remote: [...peer.remote], turnErrors: [...peer.turnErrors],
      ice: peer.iceLog, gathering: peer.pc.iceGatheringState, dc: peer.dc?.readyState || 'none',
    }
  }
  // Report, then drop. Exactly once per peer: the deadline and the browser's own
  // `failed` can both fire for the same attempt.
  private fail(id: string, why: ConnectFailure['why']) {
    const peer = this.peers.get(id)
    if (!peer) return // already reported and dropped
    if (why === 'timeout' && peer.done) return // it came up after all
    const f = this.failure(peer, why)
    peer.done = true; window.clearTimeout(peer.timer)
    this.h.onPeerFail?.(id, f)
    this.h.onPeer?.(id, 'failed')
    void this.diagPost('fail', { ...f, reason: failReason(f) })
    this.drop(id)
  }
  // The relay logs these (functions/call.js `diag`): candidate types and states,
  // never an address, a name or anything said. It is how a call that "just didn't
  // connect" can be explained afterwards.
  private async diagPost(kind: 'fail' | 'connected', data: Record<string, unknown>) {
    try { await fetch(FN, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ room: this.room, from: this.me, action: 'diag', payload: { kind, ...data } }) }) } catch { /* best effort */ }
  }
  private async reportConnected(peer: Peer) {
    await sleep(1500) // let the selected pair settle so the path is real
    await this.readPath(peer)
    void this.diagPost('connected', { ms: Date.now() - peer.born, role: this.role, relayConfigured: this.relayConfigured, path: peer.path, local: [...peer.local], remote: [...peer.remote], turnErrors: [...peer.turnErrors] })
  }

  // Which way the bytes actually go: the SELECTED pair, never "a relay candidate
  // exists" — nearly every peer behind NAT gathers one and almost none use it.
  private async readPath(peer: Peer) {
    if (peer.pc.connectionState !== 'connected') return
    try {
      const stats = await peer.pc.getStats()
      let sel = ''
      const pairs = new Map<string, Record<string, unknown>>(), cands = new Map<string, Record<string, unknown>>()
      stats.forEach((r: Record<string, unknown>) => {
        if (r.type === 'transport' && typeof r.selectedCandidatePairId === 'string') sel = r.selectedCandidatePairId
        else if (r.type === 'candidate-pair') pairs.set(String(r.id), r)
        else if (r.type === 'local-candidate' || r.type === 'remote-candidate') cands.set(String(r.id), r)
      })
      // Safari reports no transport selection: the nominated, succeeded pair is it.
      if (!sel) for (const [k, p] of pairs) if (p.state === 'succeeded' && (p.nominated || p.selected)) { sel = k; break }
      const pair = pairs.get(sel)
      if (!pair) return
      const lt = cands.get(String(pair.localCandidateId))?.candidateType, rt = cands.get(String(pair.remoteCandidateId))?.candidateType
      if (lt || rt) peer.path = lt === 'relay' || rt === 'relay' ? 'relay' : 'direct'
    } catch { /* a closing pc */ }
  }
  // Watched, not sampled once: ICE can move to the relay mid-call (wifi → mobile).
  private async watchPath() {
    let worst: Path = 'unknown'
    for (const p of this.peers.values()) {
      if (!p.info?.inCall) continue
      await this.readPath(p)
      if (p.path === 'relay') worst = 'relay'
      else if (p.path === 'direct' && worst !== 'relay') worst = 'direct'
    }
    if (!this.inCall || worst === this.path) return
    const from = this.path
    this.path = worst
    // The relay carries voice only (it is capped well below what video needs),
    // so video stops going out — and the camera is released rather than left lit
    // sending nothing. Coming back to direct does NOT turn it on again: that is
    // the person's choice to make.
    if (worst === 'relay') { if (this.cam) await this.toggleCam(false); if (this.screenOn) this.stopScreen() }
    this.applyVideoAll()
    this.h.onPath?.(worst, from)
  }

  // Perfect negotiation: tolerate simultaneous (re)negotiation from both sides.
  private async onDesc(id: string, desc: RTCSessionDescriptionInit, kind: 'offer' | 'answer') {
    const peer = this.peers.get(id) || this.mkPeer(id, false)
    peer.heardFrom = true
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
    this.applyVideo(peer)
  }

  /** The video track we'd be sending right now, if anyone wanted it. */
  private wantedVideoTrack(): MediaStreamTrack | null {
    // The one place that decides what video reaches the wire, so the relay rule
    // cannot be forgotten by a fifth caller.
    if (this.path === 'relay') return null
    if (this.screenOn) return this.screen?.getVideoTracks()[0] || null
    return this.cam ? this.videoTrack : null
  }

  /** Route (or withhold) video for ONE peer. A peer that has told us it isn't
   *  rendering us gets `null` — replaceTrack(null) stops the bytes entirely, which
   *  is the whole point: a host who closed the participants dock should not be
   *  paying to receive video nobody is looking at. Restoring is just another
   *  replaceTrack, so the sender persists and nothing renegotiates. */
  private applyVideo(peer: Peer) {
    if (!peer.info?.inCall) return
    const track = peer.videoPaused ? null : this.wantedVideoTrack()
    if (peer.vSender) { peer.vSender.replaceTrack(track).catch(() => {}); if (track) this.tuneVideo(); return }
    if (!track || !this.local) return
    peer.vSender = peer.pc.addTrack(track, this.local)
    this.tuneVideo()
  }
  private applyVideoAll() { for (const p of this.peers.values()) this.applyVideo(p) }
  // Put a track on a peer's sender of that kind, creating the sender the first time
  // (that first add renegotiates; every later swap — including →null — does not).
  private addOrReplace(peer: Peer, track: MediaStreamTrack) {
    const audio = track.kind === 'audio'
    const cur = audio ? peer.aSender : peer.vSender
    if (cur) { cur.replaceTrack(track).catch(() => {}); if (!audio) this.tuneVideo(); return }
    if (!this.local) return
    const s = peer.pc.addTrack(track, this.local)
    if (audio) peer.aSender = s; else { peer.vSender = s; this.tuneVideo() }
  }

  /** Cap what the video encoder is allowed to spend (#214).
   *
   *  WebRTC never sends raw frames — it always encodes (VP8/H.264) — but with no
   *  `maxBitrate` the encoder just targets whatever the link allows, ~2 Mbps at
   *  720p. This is a MESH: every peer uploads its own copy to every other peer, so
   *  one person's upstream is (peers − 1) × bitrate. That multiplication is the real
   *  waste, so the cap tightens as the call grows. Screen-share keeps a much higher
   *  ceiling (text has to stay legible) but a low frame rate, and asks the encoder
   *  to drop frames rather than resolution. */
  private tuneVideo() {
    const n = [...this.peers.values()].filter((p) => p.info?.inCall).length
    // Width we're actually capturing, so the scale factor is honest even when the
    // camera ignored our ideal constraint.
    const capW = this.videoTrack?.getSettings().width || 960
    for (const p of this.peers.values()) {
      const s = p.vSender
      if (!s) continue
      // Receiver-driven: encode for the box THIS peer is painting us into. A tile in
      // a 6-way grid can be 150px — sending 960px there is ~40x the pixels it can
      // show. Falls back to a mesh-size guess until they've told us (or if they're
      // on an old build that never will).
      const want = p.wantW && p.wantW > 0 ? p.wantW : n <= 1 ? 640 : n === 2 ? 480 : 320
      const target = this.screenOn ? capW : Math.min(capW, Math.max(160, want))
      const kbps = this.screenOn ? 1200 : bitrateFor(target)
      try {
        const params = s.getParameters()
        if (!params.encodings || params.encodings.length === 0) params.encodings = [{}]
        params.encodings[0].maxBitrate = kbps * 1000
        params.encodings[0].maxFramerate = this.screenOn ? 15 : 24
        // Screen-share must stay sharp (text); a camera tile can shrink to fit.
        params.encodings[0].scaleResolutionDownBy = this.screenOn ? 1 : Math.min(16, Math.max(1, capW / target))
        params.degradationPreference = this.screenOn ? 'maintain-resolution' : 'balanced'
        s.setParameters(params).catch(() => {})
      } catch { /* older browsers: no encoding params — the capture cap still applies */ }
    }
  }

  /** Receiver side: tell `id` how wide we're painting their video, so they can stop
   *  encoding pixels we'll only throw away. Quantised into buckets so a few pixels
   *  of layout drift doesn't spam the data channel or churn the encoder. */
  requestSize(id: string, cssPx: number) {
    const peer = this.peers.get(id)
    if (!peer || peer.dc?.readyState !== 'open') return
    const dpr = typeof devicePixelRatio === 'number' ? Math.min(devicePixelRatio, 2) : 1
    peer.reqPx = Math.round(cssPx * dpr)
    this.sendWant(peer)
  }
  /** Video at least `px` wide from everyone while recording; 0 lifts it. */
  setRecordFloor(px: number) {
    this.recFloor = Math.max(0, px)
    for (const p of this.peers.values()) if (p.dc?.readyState === 'open') this.sendWant(p)
  }
  private sendWant(peer: Peer) {
    if (peer.dc?.readyState !== 'open') return
    const px = Math.max(peer.reqPx ?? 0, this.recFloor)
    // 0 means "you're not on my screen at all" — the sender stops sending video
    // entirely. Otherwise snap onto the ladder the sender scales down to.
    const bucket = px <= 0 ? 0 : px <= 160 ? 160 : px <= 240 ? 240 : px <= 320 ? 320 : px <= 480 ? 480 : px <= 640 ? 640 : 960
    if (peer.sentWantW === bucket) return
    peer.sentWantW = bucket
    peer.dc.send(JSON.stringify({ c: 'want', w: bucket } as Ctrl))
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
      if (m.c === 'info') { peer.info = { name: String(m.name || ''), role: (m.role as Role) || 'guest', inCall: !!m.inCall, muted: !!m.muted, cam: !!m.cam, sharing: !!m.sharing, aspect: Number(m.aspect) || 1, link: m.link ? String(m.link).slice(0, 40) : undefined }; this.h.onPeerInfo?.(id, peer.info); this.linkMedia(peer) }
      else if (m.c === 'admit') { if (!this.inCall) { this.h.onAdmitted?.(); this.enableMedia() } }
      else if (m.c === 'want') {
        peer.wantW = Math.max(0, Number(m.w) || 0)
        const paused = peer.wantW === 0
        if (paused !== !!peer.videoPaused) { peer.videoPaused = paused; this.applyVideo(peer) }
        else this.tuneVideo()
      }
      else if (m.c === 'fmute') { const target = String(m.target || ''); const me = target === this.me; if (me) this.toggleMic(false); this.h.onMuteNotice?.(String(m.by || ''), target, me) }
      else if (typeof m.t === 'string') { this.tap?.(id, m as unknown as DataMsg); this.h.onData?.(id, m as unknown as DataMsg) }
    }
  }
  /** Publish our own call-link code to in-call peers so they can save us (#221). */
  /** A rename mid-call: everyone connected hears it now, not at the next heartbeat. */
  setName(name: string) { if (name && name !== this.name) { this.name = name; if (this.active) this.broadcastInfo() } }
  setMyLink(code: string) { if (code !== this.myLink) { this.myLink = code || ''; this.broadcastInfo() } }
  private sendInfo(peer: Peer) { if (peer.dc?.readyState === 'open') peer.dc.send(JSON.stringify({ c: 'info', name: this.name, role: this.role, inCall: this.inCall, muted: this.muted, cam: this.cam, sharing: this.screenOn, aspect: this.aspect, link: this.myLink || undefined } as Ctrl)) }
  private broadcastInfo() { for (const p of this.peers.values()) this.sendInfo(p) }

  // ---- app-facing send (only to peers actually in the call) ------------------
  broadcast(msg: DataMsg) { this.tap?.('me', msg); const s = JSON.stringify(msg); for (const p of this.peers.values()) if (p.dc?.readyState === 'open' && p.info?.inCall) p.dc.send(s) }
  /** Our own live tracks, as the others receive them: the screen while sharing,
   *  else the camera (the call sends both down the one video track). */
  myTracks(): { audio: MediaStreamTrack | null; video: MediaStreamTrack | null } {
    const screen = this.screenOn ? this.screen?.getVideoTracks()[0] ?? null : null
    return { audio: this.audioTrack, video: screen || this.videoTrack }
  }
  /** Send an app data message to ONE peer — the contact-request handshake (#229). */
  sendTo(id: string, msg: DataMsg) { const p = this.peers.get(id); if (p?.dc?.readyState === 'open' && p.info?.inCall) p.dc.send(JSON.stringify(msg)) }

  // ---- DM voice-note rendezvous (#232) --------------------------------------
  // These bypass the in-call gate on purpose: the rendezvous peers connect
  // data-only and never join a call, so `info.inCall` is always false.
  /** Any peer we have a live data channel to (regardless of in-call state). */
  hasOpenData(): boolean { return [...this.peers.values()].some((p) => p.dc?.readyState === 'open') }
  /** Send a control/app message to every open data channel, ignoring in-call state. */
  sendData(msg: DataMsg) { const s = JSON.stringify(msg); for (const p of this.peers.values()) if (p.dc?.readyState === 'open') p.dc.send(s) }
  /** Chunk a voice-note blob to every open data channel. Returns false if nobody is
   *  connected yet, so the caller keeps it queued. */
  async sendVoiceNote(id: string, blob: Blob, mime: string, dur: number): Promise<boolean> {
    const CH = 16 * 1024
    const open = () => [...this.peers.values()].filter((p) => p.dc?.readyState === 'open')
    if (open().length === 0) return false
    this.sendData({ t: 'vn-start', id, mime, dur, size: blob.size })
    const buf = await blob.arrayBuffer()
    for (let o = 0; o < buf.byteLength; o += CH) {
      const slice = buf.slice(o, o + CH)
      for (const p of open()) { while (p.dc!.bufferedAmount > 4 * 1024 * 1024) await sleep(40); p.dc!.send(slice) }
    }
    this.sendData({ t: 'vn-end', id })
    return true
  }
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
    // Refused rather than opened and not sent: a lit camera indicator with nothing
    // going out is the one thing a private call must not do.
    if (on && this.path === 'relay') return false
    if (on) {
      if (!this.videoTrack) {
        try { const s = await navigator.mediaDevices.getUserMedia({ video: { deviceId: this.camId ? { exact: this.camId } : undefined, ...CAM } }); this.videoTrack = s.getVideoTracks()[0] }
        catch { this.cam = false; this.broadcastInfo(); return false }
        this.local?.addTrack(this.videoTrack)
      }
      this.cam = true
      this.emitPreview()
      if (!this.screenOn) this.applyVideoAll()
    } else {
      this.cam = false
      if (!this.screenOn) this.releaseKind('video')
      if (this.videoTrack) { this.local?.removeTrack(this.videoTrack); this.videoTrack.stop(); this.videoTrack = null }
      this.emitPreview()
    }
    this.broadcastInfo(); return true
  }
  /** The code both ends of the link to this peer can read aloud (safety.ts);
   *  null until the connection has settled on both descriptions. */
  async safetyCode(id: string): Promise<string | null> {
    const pc = this.peers.get(id)?.pc
    const mine = fingerprintOf(pc?.currentLocalDescription?.sdp), theirs = fingerprintOf(pc?.currentRemoteDescription?.sdp)
    return mine && theirs ? safetyCode(mine, theirs) : null
  }
  /** Others in the call proper (not waiting in the lobby). */
  inCallPeers(): number {
    let n = 0
    for (const p of this.peers.values()) if (p.info?.inCall) n++
    return n
  }
  /** How the link to each in-call peer is doing, for the video governor.
   *  Loss and delay come from the peer's receiver reports (remote-inbound-rtp),
   *  which is what tells us how what WE send is arriving; the limitation reason
   *  and frame rate from our own video encoder. */
  async linkSamples(): Promise<LinkSample[]> {
    const out: LinkSample[] = []
    for (const p of this.peers.values()) {
      if (!p.info?.inCall) continue
      try {
        const stats = await p.pc.getStats()
        let loss = 0, rttMs: number | null = null, limited = false, fps: number | null = null
        stats.forEach((r: Record<string, unknown>) => {
          if (r.type === 'remote-inbound-rtp') {
            if (typeof r.fractionLost === 'number') loss = Math.max(loss, r.fractionLost)
            if (typeof r.roundTripTime === 'number') rttMs = Math.max(rttMs ?? 0, r.roundTripTime * 1000)
          } else if (r.type === 'outbound-rtp' && r.kind === 'video') {
            if (r.qualityLimitationReason === 'bandwidth' || r.qualityLimitationReason === 'cpu') limited = true
            if (typeof r.framesPerSecond === 'number') fps = r.framesPerSecond
          } else if (r.type === 'candidate-pair' && r.nominated && typeof r.currentRoundTripTime === 'number' && rttMs == null) {
            rttMs = r.currentRoundTripTime * 1000
          }
        })
        out.push({ loss, rttMs, limited, fps })
      } catch { /* a closing pc: skip it */ }
    }
    return out
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
    try { track = (await navigator.mediaDevices.getUserMedia({ video: { deviceId: { exact: id }, ...CAM } })).getVideoTracks()[0] } catch { return }
    this.local?.removeTrack(this.videoTrack); this.videoTrack.stop()
    this.videoTrack = track; this.local?.addTrack(track); this.emitPreview()
    if (!this.screenOn) this.setVideoWire()
  }
  /** Ask another participant's client to mute itself; everyone is notified. */
  forceMute(target: string) { const msg = JSON.stringify({ c: 'fmute', target, by: this.name } as Ctrl); for (const p of this.peers.values()) if (p.dc?.readyState === 'open' && p.info?.inCall) p.dc.send(msg) }
  /** Tell peers our whiteboard's aspect ratio so they can fade what we can't see. */
  setAspect(a: number) { if (a > 0 && Math.abs(a - this.aspect) > 0.01) { this.aspect = a; this.broadcastInfo() } }
  private setVideoWire() { this.applyVideoAll() }
  // Throws on failure (the caller surfaces the reason) instead of swallowing it —
  // a silent null made mobile screen-share failures impossible to diagnose.
  async shareScreen(): Promise<MediaStream> {
    if (this.path === 'relay') throw new DOMException('The call goes through the relay, which carries voice only', 'RelayVoiceOnly')
    this.screen = await navigator.mediaDevices.getDisplayMedia({ video: true })
    const track = this.screen.getVideoTracks()[0]
    this.screenOn = true // set BEFORE wiring, so tuneVideo picks the screen ceiling
    this.setVideoWire()
    this.broadcastInfo()
    track.onended = () => this.stopScreen()
    return this.screen
  }
  stopScreen() { this.screen?.getTracks().forEach((t) => t.stop()); this.screen = null; const was = this.screenOn; this.screenOn = false; this.setVideoWire(); this.tuneVideo(); if (was) this.broadcastInfo() }

  /** A snapshot of live connection + media state, for the on-screen debug panel. */
  diag(): DiagSnapshot {
    const t = (tr?: MediaStreamTrack | null) => (tr ? `${tr.readyState}${tr.enabled ? '' : ' off'}${tr.muted ? ' muted' : ''}` : '—')
    return {
      me: this.me.slice(0, 5), role: this.role, inCall: this.inCall, muted: this.muted,
      mic: t(this.audioTrack), cam: t(this.videoTrack), relay: this.relayConfigured, path: this.path,
      peers: [...this.peers.entries()].map(([id, p]) => ({
        path: p.path, local: [...p.local].join(',') || '—', remote: [...p.remote].join(',') || '—',
        id: id.slice(0, 5), name: p.info?.name || '?', theirInCall: !!p.info?.inCall,
        conn: p.pc.connectionState, ice: p.pc.iceConnectionState, dc: p.dc?.readyState || '—',
        sendMic: t(p.aSender?.track), sendCam: t(p.vSender?.track),
        recvAudio: (p.stream?.getAudioTracks() || []).map(t).join(',') || '—',
        recvVideo: (p.stream?.getVideoTracks() || []).map(t).join(',') || '—',
      })),
    }
  }

  private drop(id: string) { const p = this.peers.get(id); if (!p) return; window.clearTimeout(p.timer); try { p.pc.close() } catch { /* */ } this.peers.delete(id); this.tuneVideo(); this.h.onLeave?.(id) }
  leave() {
    if (this.active) this.send('leave', 'all')
    this.active = false; this.inCall = false
    window.clearInterval(this.heartbeat)
    this.stopScreen()
    this.peers.forEach((p) => { window.clearTimeout(p.timer); try { p.pc.close() } catch { /* */ } }); this.peers.clear()
    this.local?.getTracks().forEach((t) => t.stop())
    this.audioTrack?.stop(); this.videoTrack?.stop(); this.audioTrack = null; this.videoTrack = null
  }
}
