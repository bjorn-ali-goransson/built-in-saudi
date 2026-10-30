// A collaboration session over the P2P mesh, with the document OWNER as truth.
//
// The owner opens a session on a document saved in THEIR browser and shares a
// link. Guests who open it receive a snapshot, then a stream of numbered commits;
// their own edits go to the owner, who accepts or refuses them and broadcasts the
// result. The document is never on our server and never in anyone's browser but
// the owner's unless a guest deliberately saves a copy.
//
// What this layer owns (the editors supply the document half as an adapter):
//
// - **Who is the owner.** A guest accepts a welcome from exactly one peer — the
//   first that claims ownership — and ignores commits from anyone else. Without
//   that, any peer in the room could rewrite everybody's view.
// - **Roles.** The owner decides whether a guest may edit. A viewer's
//   submission is refused AT THE OWNER; hiding the toolbar on the guest is a
//   courtesy, not the control.
// - **Gaps.** A commit that skips a version means a message was missed (a
//   reconnect, a dropped channel). The guest asks for a snapshot rather than
//   applying the next commit to the wrong state.
// - **The end.** When the owner leaves, the truth has left the room. Guests are
//   told, keep what they see, and can save a copy — but nothing they type now
//   is going anywhere, and the UI must say so.

export type Role = 'edit' | 'view'

export interface Transport {
  readonly me: string
  start(): void
  stop(): void
  send(id: string, msg: unknown): boolean
  broadcast(msg: unknown): number
}
export interface TransportHandlers {
  onPeer?(id: string, state: 'connecting' | 'open' | 'closed'): void
  onMessage?(id: string, msg: unknown): void
}

export interface CollabAdapter {
  /** Owner: everything a newcomer needs to render the document. */
  snapshot(): { snap: unknown; version: number }
  /** Guest: replace local state with the owner's. */
  load(snap: unknown, version: number): void
  /** Owner: a guest's submission. Return the commit to broadcast, or null to refuse. */
  accept(payload: unknown, client: string): unknown | null
  /** Guest: a commit from the owner. 'gap' asks the session for a resync. */
  commit(payload: unknown): 'ok' | 'gap'
  /** Guest: a resync happened — resend whatever is still pending. */
  resend?(): void
  /** Guest: the owner refused this submission; drop it rather than retrying forever. */
  refused?(payload: unknown): void
}

export interface Member { client: string; name: string; color: string; role: Role | 'owner'; online: boolean }

export type SessionState = 'connecting' | 'live' | 'owner-left' | 'ended' | 'kicked'

export interface SessionEvents {
  onState?(s: SessionState): void
  onRoster?(m: Member[]): void
  onPresence?(client: string, data: unknown): void
  onRole?(r: Role): void
  onChat?(m: { client: string; name: string; text: string; at: number }): void
  /** Owner: a guest was refused (a viewer tried to edit). */
  onRefused?(client: string): void
  /** Guest: the welcome carried a title and kind. */
  onMeta?(m: { title: string; kind: string }): void
}

type Msg =
  | { t: 'c-hello'; name: string; color: string }
  | { t: 'c-welcome'; role: Role; snap: unknown; version: number; title: string; kind: string; name: string; color: string }
  | { t: 'c-sub'; p: unknown }
  | { t: 'c-commit'; p: unknown }
  | { t: 'c-resync' }
  | { t: 'c-snap'; snap: unknown; version: number }
  | { t: 'c-presence'; d: unknown }
  | { t: 'c-roster'; m: Member[] }
  | { t: 'c-role'; role: Role }
  | { t: 'c-kick' }
  | { t: 'c-end' }
  | { t: 'c-chat'; text: string; at: number }
  | { t: 'c-refused'; p: unknown }

const PALETTE = ['#0b6e4f', '#b5543c', '#3b5bdb', '#9c36b5', '#e8590c', '#0c8599', '#c2255c', '#5f3dc4', '#2b8a3e', '#d9480f']
export const colorFor = (s: string) => {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return PALETTE[h % PALETTE.length]
}

export class CollabSession {
  readonly isOwner: boolean
  state: SessionState = 'connecting'
  role: Role | 'owner'
  ownerId = ''
  private members = new Map<string, Member>()
  private names = new Map<string, { name: string; color: string }>()
  defaultRole: Role = 'edit'
  title = ''
  kind = ''

  constructor(
    private tx: Transport,
    private adapter: CollabAdapter,
    private ev: SessionEvents,
    opts: { owner: boolean; name: string; title?: string; kind?: string; defaultRole?: Role },
  ) {
    this.isOwner = opts.owner
    this.role = opts.owner ? 'owner' : 'view'
    this.title = opts.title || ''
    this.kind = opts.kind || ''
    if (opts.defaultRole) this.defaultRole = opts.defaultRole
    this.names.set(tx.me, { name: opts.name, color: colorFor(tx.me) })
    if (opts.owner) {
      this.ownerId = tx.me
      this.members.set(tx.me, { client: tx.me, name: opts.name, color: colorFor(tx.me), role: 'owner', online: true })
    }
  }

  get me(): string { return this.tx.me }
  get canEdit(): boolean { return this.state === 'live' && (this.role === 'owner' || this.role === 'edit') }
  roster(): Member[] { return [...this.members.values()] }

  /** Wire into the transport's handlers. */
  handlers(): TransportHandlers {
    return {
      onPeer: (id, s) => this.onPeer(id, s),
      onMessage: (id, m) => this.onMessage(id, m as Msg),
    }
  }

  start(): void {
    this.tx.start()
    if (this.isOwner) this.setState('live')
  }
  /** Owner: end the session for everybody. Guest: leave. */
  stop(): void {
    if (this.isOwner) this.tx.broadcast({ t: 'c-end' } satisfies Msg)
    this.tx.stop()
    this.setState('ended')
  }

  // ---- edits -------------------------------------------------------------------

  /** Guest: send a submission to the owner. Owner: accept it locally and broadcast. */
  submit(p: unknown): boolean {
    if (this.isOwner) {
      const c = this.adapter.accept(p, this.me)
      if (c === null) return false
      this.tx.broadcast({ t: 'c-commit', p: c } satisfies Msg)
      return true
    }
    if (!this.canEdit || !this.ownerId) return false
    return this.tx.send(this.ownerId, { t: 'c-sub', p } satisfies Msg)
  }
  /** Owner: broadcast a commit produced by its own editor (already applied). */
  commitLocal(c: unknown): void {
    if (this.isOwner) this.tx.broadcast({ t: 'c-commit', p: c } satisfies Msg)
  }

  /** Guest: ask the owner for a fresh snapshot (after something we could not reconcile). */
  requestResync(): void {
    if (!this.isOwner && this.ownerId) this.tx.send(this.ownerId, { t: 'c-resync' } satisfies Msg)
  }

  presence(d: unknown): void { this.tx.broadcast({ t: 'c-presence', d } satisfies Msg) }
  chat(text: string): void {
    const at = Date.now()
    this.tx.broadcast({ t: 'c-chat', text, at } satisfies Msg)
    const me = this.names.get(this.me)
    this.ev.onChat?.({ client: this.me, name: me?.name || '', text, at })
  }

  // ---- owner controls ----------------------------------------------------------

  setRole(client: string, role: Role): void {
    if (!this.isOwner) return
    const m = this.members.get(client)
    if (!m || m.role === 'owner') return
    m.role = role
    this.tx.send(client, { t: 'c-role', role } satisfies Msg)
    this.pushRoster()
  }
  kick(client: string): void {
    if (!this.isOwner || client === this.me) return
    this.tx.send(client, { t: 'c-kick' } satisfies Msg)
    this.members.delete(client)
    this.pushRoster()
  }
  /** Owner: the document changed wholesale (an import) — resend it to everyone. */
  resnapshot(): void {
    if (!this.isOwner) return
    const s = this.adapter.snapshot()
    this.tx.broadcast({ t: 'c-snap', snap: s.snap, version: s.version } satisfies Msg)
  }

  // ---- transport events ----------------------------------------------------------

  private onPeer(id: string, s: 'connecting' | 'open' | 'closed') {
    if (s === 'open') {
      if (!this.isOwner) {
        const me = this.names.get(this.me)!
        this.tx.send(id, { t: 'c-hello', name: me.name, color: me.color } satisfies Msg)
      }
    } else if (s === 'closed') {
      if (this.isOwner) {
        const m = this.members.get(id)
        if (m) { m.online = false; this.members.delete(id); this.pushRoster() }
      } else if (id === this.ownerId && this.state === 'live') {
        this.setState('owner-left')
      }
    }
  }

  private onMessage(id: string, m: Msg) {
    if (!m || typeof m !== 'object' || typeof (m as { t?: unknown }).t !== 'string') return
    // ---- owner receives
    if (this.isOwner) {
      if (m.t === 'c-hello') {
        const name = String(m.name || 'Guest').slice(0, 40)
        const color = colorFor(id)
        this.names.set(id, { name, color })
        const role = this.defaultRole
        this.members.set(id, { client: id, name, color, role, online: true })
        const s = this.adapter.snapshot()
        const me = this.names.get(this.me)!
        this.tx.send(id, { t: 'c-welcome', role, snap: s.snap, version: s.version, title: this.title, kind: this.kind, name: me.name, color: me.color } satisfies Msg)
        this.pushRoster()
      } else if (m.t === 'c-sub') {
        const mem = this.members.get(id)
        if (!mem || mem.role !== 'edit') { this.tx.send(id, { t: 'c-refused', p: m.p } satisfies Msg); this.ev.onRefused?.(id); return }
        const c = this.adapter.accept(m.p, id)
        if (c === null) { this.tx.send(id, { t: 'c-refused', p: m.p } satisfies Msg); return }
        this.tx.broadcast({ t: 'c-commit', p: c } satisfies Msg)
      } else if (m.t === 'c-resync') {
        const s = this.adapter.snapshot()
        this.tx.send(id, { t: 'c-snap', snap: s.snap, version: s.version } satisfies Msg)
      } else if (m.t === 'c-presence') {
        if (this.members.has(id)) this.ev.onPresence?.(id, m.d)
      } else if (m.t === 'c-chat') {
        const mem = this.members.get(id)
        if (mem) this.ev.onChat?.({ client: id, name: mem.name, text: String(m.text).slice(0, 2000), at: Number(m.at) || Date.now() })
      }
      return
    }
    // ---- guest receives
    if (m.t === 'c-welcome') {
      if (this.ownerId && this.ownerId !== id) return // someone else already welcomed us
      // The SAME owner welcoming us again: a hello re-sent on a reopened channel.
      // Reloading from it would replace the document under the guest's caret —
      // moving it to the start — and drop whatever they typed that is not yet
      // confirmed. Its document is ignored: a guest that really did miss commits
      // while the channel was down finds out from the next one, whose version
      // gap triggers the resync below — which re-sends what is pending.
      if (this.ownerId === id && this.state === 'live') {
        this.role = m.role === 'edit' ? 'edit' : 'view'
        this.ev.onRole?.(this.role)
        return
      }
      this.ownerId = id
      this.title = String(m.title || '')
      this.kind = String(m.kind || '')
      this.names.set(id, { name: String(m.name || 'Owner'), color: String(m.color || colorFor(id)) })
      this.adapter.load(m.snap, m.version)
      this.role = m.role === 'edit' ? 'edit' : 'view'
      this.setState('live')
      this.ev.onRole?.(this.role)
      this.ev.onMeta?.({ title: this.title, kind: this.kind })
      return
    }
    if (id !== this.ownerId) {
      // Only presence and chat are accepted peer-to-peer; everything that changes
      // the document or the roster must come from the owner.
      if (m.t === 'c-presence') this.ev.onPresence?.(id, m.d)
      return
    }
    switch (m.t) {
      case 'c-commit':
        if (this.adapter.commit(m.p) === 'gap') this.tx.send(this.ownerId, { t: 'c-resync' } satisfies Msg)
        break
      case 'c-snap':
        this.adapter.load(m.snap, m.version)
        this.adapter.resend?.()
        break
      case 'c-refused':
        this.adapter.refused?.(m.p)
        break
      case 'c-roster':
        this.members = new Map(m.m.map((x) => [x.client, x]))
        for (const x of m.m) this.names.set(x.client, { name: x.name, color: x.color })
        this.ev.onRoster?.(m.m)
        break
      case 'c-role':
        this.role = m.role === 'edit' ? 'edit' : 'view'
        this.ev.onRole?.(this.role)
        break
      case 'c-kick':
        this.tx.stop()
        this.setState('kicked')
        break
      case 'c-end':
        this.tx.stop()
        this.setState('owner-left')
        break
      case 'c-presence':
        this.ev.onPresence?.(id, m.d)
        break
      case 'c-chat':
        this.ev.onChat?.({ client: id, name: this.names.get(id)?.name || 'Owner', text: String(m.text).slice(0, 2000), at: Number(m.at) || Date.now() })
        break
    }
  }

  nameOf(client: string): { name: string; color: string } | undefined { return this.names.get(client) }

  private pushRoster() {
    const m = this.roster()
    this.tx.broadcast({ t: 'c-roster', m } satisfies Msg)
    this.ev.onRoster?.(m)
  }
  private setState(s: SessionState) {
    if (this.state === s) return
    this.state = s
    this.ev.onState?.(s)
  }
}

/** An in-memory transport hub, for tests and for a same-page demo. */
export class LocalHub {
  private nodes = new Map<string, { h: TransportHandlers; up: boolean }>()
  /** Messages are delivered on a microtask, like a real channel. */
  deliver = (fn: () => void) => queueMicrotask(fn)
  transport(me: string): { tx: Transport; bind(h: TransportHandlers): void } {
    let h: TransportHandlers = {}
    const hub = this
    const tx: Transport = {
      me,
      start() {
        hub.nodes.set(me, { h, up: true })
        for (const [id, n] of hub.nodes) if (id !== me && n.up) { hub.deliver(() => { n.h.onPeer?.(me, 'open'); h.onPeer?.(id, 'open') }) }
      },
      stop() {
        const n = hub.nodes.get(me)
        if (n) n.up = false
        for (const [id, o] of hub.nodes) if (id !== me && o.up) hub.deliver(() => o.h.onPeer?.(me, 'closed'))
      },
      send(id, msg) {
        const n = hub.nodes.get(id)
        if (!n?.up || !hub.nodes.get(me)?.up) return false
        const copy = JSON.parse(JSON.stringify(msg))
        hub.deliver(() => n.h.onMessage?.(me, copy))
        return true
      },
      broadcast(msg) {
        let k = 0
        for (const id of hub.nodes.keys()) if (id !== me && this.send(id, msg)) k++
        return k
      },
    }
    return { tx, bind(x) { h = x; const n = hub.nodes.get(me); if (n) n.h = x } }
  }
}
