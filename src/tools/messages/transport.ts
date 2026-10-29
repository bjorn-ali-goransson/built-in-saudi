// How a message gets from one browser to another.
//
// **Peer-to-peer first.** Every device with Messages open listens in its own
// INBOX room on the signaling relay (`in_<code>`). To reach somebody, a device
// visits THEIR inbox room; the two form a WebRTC data channel and everything —
// messages, receipts, typing, files of any size — goes straight between them.
// The relay sees two random peer ids and SDP, nothing else.
//
// **Push when they are away.** If nobody answers in the recipient's inbox, an
// event is sent once as a Web Push through our relay — sealed end to end when we
// have their key — and stays in the outbox until the two ARE online together,
// at which point it is offered again peer-to-peer and acknowledged. A push is a
// heads-up, not a delivery; only an ack is a delivery.
//
// **A link speaks only for its own end, and must prove it.** Anybody can poll a
// relay room whose name they know, and a call-me code is public by design. So a
// visitor reveals nothing until the room's owner has said hello, and BOTH ends
// then prove they hold the private key behind the public key they presented, by
// sealing the other's random challenge with the derived shared key. A peer that
// knows somebody's code but not their key gets a connection and nothing over it.
import { Mesh, randomId, type BlobMeta } from '../../lib/p2p/mesh'
import type { MessageStore, OutItem } from './store'
import type { Code, Envelope } from './model'
import { sendDm } from '../../lib/dms'
import { drainQueue } from '../../lib/localQueue'

const FN = () => (typeof window !== 'undefined' && (window as unknown as { __CALL_FN?: string }).__CALL_FN) || 'https://us-central1-blitz-ksa.cloudfunctions.net'

export const inboxRoom = (code: Code) => `in_${code}`

type Wire =
  | { t: 'hello'; code: Code; name: string; pub: string }
  | { t: 'chal'; n: string }
  | { t: 'proof'; s: string }
  | { t: 'env'; e: Envelope }
  | { t: 'ack'; eids: string[] }
  | { t: 'want'; ids: string[] }
  | { t: 'typing'; conv: string; on: boolean }
  | { t: 'none'; ids: string[] }

interface Link { mesh: Mesh; peer: string; code: Code; authed: boolean; theirs: boolean; mine?: string }

/** Events worth a push. Receipts and typing are only useful live. */
const PUSHABLE = new Set(['msg', 'edit', 'del', 'react', 'vote', 'poll-close', 'meta', 'leave', 'pin'])
const PUSH_AFTER_MS = 5000
const PUSH_MAX = 3000

/**
 * Two authenticated links to one person: does the NEW one replace the one we
 * already chose? Both ends must answer the same way whichever finished first, so
 * the answer depends only on the rooms: keep the link in the inbox of the smaller
 * address. Pure, so the agreement is tested over every ordering.
 */
export function keepNewLink(me: Code, them: Code, prevRoom: string, newRoom: string): boolean {
  const keep = inboxRoom(me < them ? me : them)
  return newRoom === keep && prevRoom !== keep
}

export class MessageTransport {
  private inbox: Mesh | null = null
  private visiting = new Map<Code, { mesh: Mesh; since: number; lastWanted: number }>()
  private links = new Map<Code, Link>()
  /** peerId -> link-in-progress (before hello/auth) */
  private pending = new Map<string, Link>()
  /** Authenticated links that lost the one-link-per-person choice. Still LISTENED to — see `proof`. */
  private spare = new Set<Link>()
  private timer: ReturnType<typeof setInterval> | null = null
  private wantVisit = new Map<Code, number>()
  private wantFiles = new Map<string, number>()
  private callMsgMissing = false
  running = false

  constructor(private store: MessageStore) {
    store.onOutbox = () => this.tick()
    store.onEphemeral = (to, msg) => { for (const c of to) this.sendTo(c, msg as Wire) }
    store.onWantFile = (id, from) => this.fetchFile(id, from)
  }

  async start() {
    if (this.running) return
    await this.store.ready
    this.running = true
    this.listen()
    this.timer = setInterval(() => this.tick(), 2500)
    this.tick()
    void this.drainPushes()
  }
  stop() {
    this.running = false
    if (this.timer) clearInterval(this.timer)
    this.timer = null
    this.inbox?.stop()
    this.inbox = null
    for (const v of this.visiting.values()) v.mesh.stop()
    this.visiting.clear()
    this.links.clear()
    this.pending.clear()
    this.spare.clear()
    this.store.online.clear()
  }
  /** After our address changes (offline delivery enabled), move to the new inbox. */
  relisten() { if (!this.running) return; this.inbox?.stop(); this.listen() }

  private listen() {
    const me = this.store.me
    const mesh: Mesh = new Mesh(inboxRoom(me), {
      onPeer: (id, s) => this.onPeer(mesh, id, s, true),
      onMessage: (id, m) => this.onWire(mesh, id, m as Wire),
      onBlob: (id, meta, blob) => this.onBlob(mesh, id, meta, blob),
      onBlobProgress: (_id, meta, f) => { this.store.progress.set(meta.id, f); this.store.changed() },
    })
    this.inbox = mesh
    mesh.start()
  }

  isOnline(code: Code): boolean { return !!this.links.get(code)?.authed }

  /** Keep a contact's inbox visited for a while — an open conversation, a file to fetch. */
  wantPeer(code: Code, ms = 90_000) {
    if (!code || code === this.store.me) return
    this.wantVisit.set(code, Date.now() + ms)
    this.tick()
  }

  fetchFile(id: string, from: Code[]) {
    this.wantFiles.set(id, Date.now() + 10 * 60_000)
    let asked = false
    for (const c of from) {
      if (this.isOnline(c)) { this.sendTo(c, { t: 'want', ids: [id] }); asked = true; break }
    }
    if (!asked) for (const c of from) this.wantPeer(c, 5 * 60_000)
  }

  private tick() {
    if (!this.running) return
    const now = Date.now()
    const wanted = new Set<Code>(this.store.recipients(now))
    for (const [c, until] of this.wantVisit) { if (until > now) wanted.add(c); else this.wantVisit.delete(c) }
    for (const [id, until] of this.wantFiles) if (until < now) this.wantFiles.delete(id)
    for (const code of wanted) {
      if (this.store.blocked.has(code)) continue
      if (this.links.get(code)?.authed) { this.flush(code); continue }
      const v = this.visiting.get(code)
      if (v) { v.lastWanted = now; continue }
      const mesh: Mesh = new Mesh(inboxRoom(code), {
        onPeer: (id, s) => this.onPeer(mesh, id, s, false),
        onMessage: (id, m) => this.onWire(mesh, id, m as Wire),
        onBlob: (id, meta, blob) => this.onBlob(mesh, id, meta, blob),
        onBlobProgress: (_id, meta, f) => { this.store.progress.set(meta.id, f); this.store.changed() },
      })
      this.visiting.set(code, { mesh, since: now, lastWanted: now })
      mesh.start()
    }
    // Stop visiting rooms nobody needs; a link we no longer need can drop too.
    for (const [code, v] of this.visiting) {
      if (!wanted.has(code) && now - v.lastWanted > 60_000) {
        v.mesh.stop()
        this.visiting.delete(code)
        for (const x of this.spare) if (x.mesh === v.mesh) this.spare.delete(x)
        const l = this.links.get(code)
        if (l && l.mesh === v.mesh) {
          const spare = [...this.spare].find((x) => x.code === code)
          if (spare) { this.spare.delete(spare); this.links.set(code, spare) } else this.closeLink(code)
        }
      }
    }
    // Push what could not go peer-to-peer.
    for (const code of wanted) {
      if (this.links.get(code)?.authed) continue
      const v = this.visiting.get(code)
      if (!v || now - v.since < PUSH_AFTER_MS) continue
      for (const item of this.store.pendingFor(code, now)) {
        if (item.pushed) continue
        if (!PUSHABLE.has(item.env.type)) continue
        void this.push(item)
      }
    }
  }

  // ---- links -------------------------------------------------------------------
  private onPeer(mesh: Mesh, id: string, s: 'connecting' | 'open' | 'closed', ownInbox: boolean) {
    if (s === 'open') {
      const link: Link = { mesh, peer: id, code: '', authed: false, theirs: ownInbox }
      this.pending.set(id, link)
      // In our own inbox we speak first; visiting someone else's we wait for the
      // room's owner to say who they are before revealing anything about us.
      if (ownInbox) this.hello(mesh, id)
    } else if (s === 'closed') {
      this.pending.delete(id)
      for (const l of this.spare) if (l.peer === id && l.mesh === mesh) this.spare.delete(l)
      for (const [code, l] of this.links) {
        if (l.peer !== id || l.mesh !== mesh) continue
        // The chosen link went; a spare to the same person takes over rather than going offline.
        const spare = [...this.spare].find((x) => x.code === code)
        if (spare) { this.spare.delete(spare); this.links.set(code, spare); this.flush(code) } else this.closeLink(code)
      }
    }
  }
  private hello(mesh: Mesh, id: string) {
    mesh.send(id, { t: 'hello', code: this.store.me, name: this.store.name, pub: this.store.pub } satisfies Wire)
  }
  private closeLink(code: Code) {
    this.links.delete(code)
    this.store.online.delete(code)
    this.store.lastSeen.set(code, Date.now())
    this.store.changed()
  }

  private async onWire(mesh: Mesh, id: string, m: Wire) {
    if (!m || typeof m !== 'object') return
    const link = this.linkOn(mesh, id)
    if (!link) return
    if (m.t === 'hello') {
      if (typeof m.code !== 'string' || !m.code || typeof m.pub !== 'string') return
      const ownInbox = mesh === this.inbox
      // Visiting X's inbox, the only peer we talk to is X.
      if (!ownInbox && mesh.room !== inboxRoom(m.code)) return
      if (m.code === this.store.me || this.store.blocked.has(m.code)) return
      if (link.code) return // one hello per link
      link.code = m.code
      if (!ownInbox) this.hello(mesh, id)
      await this.store.learnPub(m.code, m.pub)
      if (m.name) this.store.rememberContactName(m.code, m.name)
      link.mine = randomId(24)
      mesh.send(id, { t: 'chal', n: link.mine } satisfies Wire)
      return
    }
    if (!link.code) return
    if (m.t === 'chal') {
      const s = await this.store.sealFor(link.code, `chal:${m.n}`)
      if (s) mesh.send(id, { t: 'proof', s } satisfies Wire)
      return
    }
    if (m.t === 'proof') {
      const got = await this.store.openFrom(link.code, m.s)
      if (got !== `chal:${link.mine}`) return // wrong key: stays unauthenticated, nothing is sent
      link.authed = true
      this.pending.delete(id)
      const prev = this.links.get(link.code)
      if (prev && prev !== link && prev.authed) {
        // Two links to the same person — we visit theirs while they visit ours. Both
        // ends must keep the SAME one, so the choice cannot depend on which finished
        // first here: keep the one in the inbox of the smaller address, which both
        // can work out. Deciding on "whichever came first" let each side keep a
        // different connection, send on it, and drop what arrived on the other —
        // unacknowledged, re-sent on the same dead end for ever.
        if (keepNewLink(this.store.me, link.code, prev.mesh.room, link.mesh.room)) { this.spare.add(prev); this.links.set(link.code, link) } else this.spare.add(link)
      } else this.links.set(link.code, link)
      this.store.online.add(link.code)
      this.store.changed()
      this.flush(link.code)
      const missing = [...await this.store.missingFrom(link.code), ...[...this.wantFiles.keys()]]
      if (missing.length) mesh.send(id, { t: 'want', ids: [...new Set(missing)] } satisfies Wire)
      return
    }
    if (!link.authed) return
    switch (m.t) {
      case 'env': {
        const ok = await this.store.receive(m.e, 'p2p', link.code)
        // Ack even what we refused as a duplicate — it was delivered.
        if (ok || (m.e && typeof m.e.eid === 'string')) mesh.send(id, { t: 'ack', eids: [m.e.eid] } satisfies Wire)
        break
      }
      case 'ack':
        if (Array.isArray(m.eids)) await this.store.ack(link.code, m.eids.map(String))
        break
      case 'want':
        for (const fid of (m.ids || []).slice(0, 200)) {
          const b = await this.store.getBlob(String(fid))
          if (!b) continue
          const meta: BlobMeta = { id: String(fid), name: (b as File).name || 'file', size: b.size, mime: b.type || 'application/octet-stream' }
          void mesh.sendBlob(id, meta, b, (f) => { this.store.progress.set(meta.id, f); this.store.changed() })
        }
        break
      case 'typing':
        this.store.ephemeral(link.code, m)
        break
    }
  }

  private async onBlob(mesh: Mesh, id: string, meta: BlobMeta, blob: Blob) {
    const link = this.linkOn(mesh, id)
    if (!link?.authed) return
    // Only accept a file we actually asked for — otherwise any contact could fill our disk.
    if (!(await this.store.expectsFile(meta.id))) return
    await this.store.storeBlob(meta.id, blob)
    this.wantFiles.delete(meta.id)
  }

  /** The link a message arrived on — pending, chosen, or spare. A spare one is still
   *  listened to: delivery is idempotent, so hearing a message twice costs nothing and
   *  missing one is the bug the one-link choice once caused. */
  private linkOn(mesh: Mesh, id: string): Link | undefined {
    const same = (l: Link) => l.peer === id && l.mesh === mesh
    return this.pending.get(id) || [...this.links.values()].find(same) || [...this.spare].find(same)
  }

  private sendTo(code: Code, m: Wire): boolean {
    const l = this.links.get(code)
    if (!l?.authed) return false
    return l.mesh.send(l.peer, m)
  }

  private flush(code: Code) {
    const l = this.links.get(code)
    if (!l?.authed) return
    for (const item of this.store.pendingFor(code)) {
      if (!l.mesh.send(l.peer, { t: 'env', e: item.env } satisfies Wire)) break
    }
  }

  // ---- push ------------------------------------------------------------------------
  private pushing = new Set<string>()
  private async push(item: OutItem) {
    if (this.pushing.has(item.key)) return
    this.pushing.add(item.key)
    try {
      const env = slimForPush(item.env)
      const json = JSON.stringify(env)
      const sealed = await this.store.sealFor(item.to, json)
      const body = sealed || json
      if (body.length > PUSH_MAX) { await this.store.markPushed({ ...item }); return } // too big: wait for P2P, but stop retrying
      if (!this.callMsgMissing) {
        const r = await fetch(`${FN()}/call-msg`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: item.to, from: this.store.me, name: this.store.name || 'Someone', env: body, sealed: !!sealed, id: item.env.eid }),
        }).catch(() => null)
        // A JSON 404 is the relay saying "that address has no device for offline
        // delivery" — a real answer. A 404 with no JSON is the endpoint itself
        // missing (an older deploy), and only then do we fall back.
        if (r && r.status === 404) {
          const j = await r.json().catch(() => null)
          if (j) { await this.store.markPushed(item); return }
          this.callMsgMissing = true
        } else if (r && r.ok) { await this.store.markPushed(item); return }
        else return // transient: try again next tick
      }
      // The relay without call-msg (an older deploy) still carries plain text DMs.
      if (item.env.type === 'msg' && item.env.msg.kind === 'text' && !item.env.conv.startsWith('g:')) {
        await sendDm(item.to, this.store.contactName(item.to), item.env.msg.text, this.store.name)
      }
      await this.store.markPushed(item)
    } finally { this.pushing.delete(item.key) }
  }

  /** Apply envelopes the service worker queued from pushes while we were closed. */
  async drainPushes() {
    const items = await drainQueue<{ id: string; from: string; name: string; env: string; sealed?: boolean }>('msgs')
    for (const it of items) {
      try {
        const text = it.sealed ? await this.store.openFrom(it.from, it.env) : it.env
        if (!text) continue
        await this.store.receive(JSON.parse(text), 'push', it.from)
      } catch { /* malformed */ }
    }
  }
}

/** Push payloads are small: drop the inline thumbnail and long fields. */
export function slimForPush(env: Envelope): Envelope {
  if (env.type !== 'msg') return env
  const msg = { ...env.msg }
  if (msg.file) msg.file = { ...msg.file, thumb: undefined, have: false }
  delete msg.delivery
  delete msg.readAt
  delete msg.starred
  return { ...env, msg }
}
