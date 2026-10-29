// The Messages store: conversations and messages in IndexedDB, mirrored in memory
// for rendering, with an OUTBOX that the transport drains.
//
// Every change goes through `emit` (ours) or `receive` (theirs), both of which
// end in `applyEvent` — so a message we send is rendered by exactly the code
// that renders one we receive, and there is no second opinion about what a
// thread contains.
//
// The outbox holds one entry per (event, recipient) until THAT recipient acks it
// over a peer-to-peer link. A push delivery is not an ack: the push may have
// been dropped by a browser vendor, a device may be off, the subscription may
// have lapsed. So an event pushed while the recipient was away is offered again
// the next time the two are online together, and the recipient dedupes it. That
// is what makes the ticks honest: one tick queued, two pushed, filled delivered,
// green read.
import * as idb from './idb'
import { applyEvent, dmId, newId, byTime, preview, markReadBy, sweepExpired, isGroupId, dedupeMembers, type Code, type Conversation, type ConvState, type Envelope, type Event, type Message, type Member, type FileInfo, type PollInfo, type Reply } from './model'
import { generateIdentity, exportPublic, sharedKey, seal, open, safetyNumber } from './crypto'
import { getMyCallLink, newCallCode } from '../../lib/callLink'
import { listContacts, addContact, removeContact, type Contact } from '../../lib/contacts'
import { listDms } from '../../lib/dms'
import { plain, mentionedCodes } from './format'

export interface OutItem { key: string; to: Code; env: Envelope; at: number; pushed?: boolean; tries?: number; /** don't send before */ sendAt?: number }

export interface Settings {
  readReceipts: boolean
  typing: boolean
  enterSends: boolean
  autoDownloadMb: number
  notifications: boolean
}
const DEFAULT_SETTINGS: Settings = { readReceipts: true, typing: true, enterSends: true, autoDownloadMb: 25, notifications: true }

export type KeyTrust = 'new' | 'same' | 'changed'

type Listener = () => void

export const MAX_FILE = 1024 * 1024 * 1024 // 1GB

export class MessageStore {
  me: Code = ''
  name = ''
  pub = ''
  settings: Settings = { ...DEFAULT_SETTINGS }
  convs = new Map<string, Conversation>()
  private states = new Map<string, ConvState>()
  private keys: CryptoKeyPair | null = null
  private peerPub = new Map<Code, string>()
  private shared = new Map<Code, Promise<CryptoKey>>()
  private outbox = new Map<string, OutItem>()
  private listeners = new Set<Listener>()
  private dirtyConvs = new Set<string>()
  private dirtyMsgs = new Map<string, Message>()
  private deadMsgs = new Set<string>()
  private flushTimer: ReturnType<typeof setTimeout> | null = null
  blocked = new Set<Code>()
  /** convId -> code -> typing-until */
  typing = new Map<string, Map<Code, number>>()
  online = new Set<Code>()
  verified = new Set<Code>()
  lastSeen = new Map<Code, number>()
  viewing = ''
  /** fileId -> 0..1 while transferring */
  progress = new Map<string, number>()
  version = 0
  ready: Promise<void>
  /** Hooks the transport and UI set. */
  onOutbox: () => void = () => {}
  onIncoming: (conv: Conversation, msg: Message, mentioned: boolean) => void = () => {}
  onEphemeral: (to: Code[], msg: unknown) => void = () => {}
  onWantFile: (fileId: string, from: Code[]) => void = () => {}

  constructor() { this.ready = this.init() }

  private async init() {
    const [convs, outbox, me, name, settings, keys, pubs, blocked, verified] = await Promise.all([
      idb.getAll<Conversation>('convs'),
      idb.getAll<OutItem>('outbox'),
      idb.kvGet<string>('me'),
      idb.kvGet<string>('name'),
      idb.kvGet<Settings>('settings'),
      idb.kvGet<CryptoKeyPair>('identity'),
      idb.kvGet<Record<string, string>>('peerPub'),
      idb.kvGet<string[]>('blocked'),
      idb.kvGet<string[]>('verified'),
    ])
    for (const c of convs) this.convs.set(c.id, c)
    for (const o of outbox) this.outbox.set(o.key, o)
    // Our address is the Calls "call me" code when there is one: the same code
    // rings us AND messages us, so a contact saved in either app works in both.
    const link = getMyCallLink()?.code
    this.me = link || me || newCallCode()
    if (this.me !== me) await idb.kvSet('me', this.me)
    this.name = name || localStorage.getItem('bis-call-name') || ''
    this.settings = { ...DEFAULT_SETTINGS, ...(settings || {}) }
    this.keys = keys || (await generateIdentity())
    if (!keys) await idb.kvSet('identity', this.keys)
    this.pub = await exportPublic(this.keys.publicKey)
    await idb.kvSet('myPub', this.pub)
    for (const [k, v] of Object.entries(pubs || {})) this.peerPub.set(k, v)
    for (const b of blocked || []) this.blocked.add(b)
    for (const v of verified || []) this.verified.add(v)
    await this.importLegacyDms()
    this.sweep()
    this.changed()
  }

  // ---- subscription ------------------------------------------------------------
  subscribe(fn: Listener): () => void { this.listeners.add(fn); return () => this.listeners.delete(fn) }
  changed() { this.version++; for (const f of this.listeners) f() }

  // ---- persistence -------------------------------------------------------------
  private touch(convId: string, msg?: Message) {
    this.dirtyConvs.add(convId)
    if (msg) this.dirtyMsgs.set(msg.id, msg)
    if (!this.flushTimer) this.flushTimer = setTimeout(() => void this.flush(), 0)
  }
  async flush(): Promise<void> {
    this.flushTimer = null
    const convs = [...this.dirtyConvs].map((id) => this.convs.get(id)).filter(Boolean)
    const msgs = [...this.dirtyMsgs.values()]
    const dead = [...this.deadMsgs]
    this.dirtyConvs.clear(); this.dirtyMsgs.clear(); this.deadMsgs.clear()
    await Promise.all([idb.putMany('convs', convs), idb.putMany('msgs', msgs), idb.delMany('msgs', dead)]).catch(() => {})
  }

  // ---- identity, keys ----------------------------------------------------------
  async setName(name: string) {
    this.name = name.trim().slice(0, 40)
    await idb.kvSet('name', this.name)
    try { localStorage.setItem('bis-call-name', this.name) } catch { /* */ }
    this.changed()
  }
  /** Adopt the Calls link code as our address (after enabling offline delivery). */
  async adoptCode(code: string) {
    if (!code || code === this.me) return
    this.me = code
    await idb.kvSet('me', code)
    this.changed()
  }
  async setSettings(p: Partial<Settings>) {
    this.settings = { ...this.settings, ...p }
    await idb.kvSet('settings', this.settings)
    this.changed()
  }
  knownPub(code: Code): string | undefined { return this.peerPub.get(code) }
  /** Trust-on-first-use. A changed key is accepted but reported, and unverifies the contact. */
  async learnPub(code: Code, pub: string): Promise<KeyTrust> {
    if (!code || !pub || code === this.me) return 'same'
    const prev = this.peerPub.get(code)
    if (prev === pub) return 'same'
    this.peerPub.set(code, pub)
    this.shared.delete(code)
    if (prev) { this.verified.delete(code); await idb.kvSet('verified', [...this.verified]) }
    await idb.kvSet('peerPub', Object.fromEntries(this.peerPub))
    if (prev) this.systemNote(dmId(this.me, code), 'keyChanged')
    this.changed()
    return prev ? 'changed' : 'new'
  }
  private keyFor(code: Code): Promise<CryptoKey> | null {
    const pub = this.peerPub.get(code)
    if (!pub || !this.keys) return null
    let k = this.shared.get(code)
    if (!k) { k = sharedKey(this.keys.privateKey, pub, this.me, code); this.shared.set(code, k) }
    return k
  }
  async sealFor(code: Code, text: string): Promise<string | null> {
    const k = this.keyFor(code)
    if (!k) return null
    try { return await seal(await k, text, this.me) } catch { return null }
  }
  async openFrom(code: Code, sealed: string): Promise<string | null> {
    const k = this.keyFor(code)
    if (!k) return null
    try { return await open(await k, sealed, code) } catch { return null }
  }
  async safety(code: Code): Promise<string | null> {
    const pub = this.peerPub.get(code)
    return pub ? safetyNumber(this.pub, pub) : null
  }
  async setVerified(code: Code, on: boolean) {
    if (on) this.verified.add(code)
    else this.verified.delete(code)
    await idb.kvSet('verified', [...this.verified])
    this.changed()
  }

  // ---- contacts ----------------------------------------------------------------
  contacts(): Contact[] { return listContacts() }
  contactName(code: Code): string {
    if (code === this.me) return this.name
    return listContacts().find((c) => c.code === code)?.name || this.memberName(code) || ''
  }
  private memberName(code: Code): string {
    for (const c of this.convs.values()) { const m = c.members.find((x) => x.code === code); if (m?.name) return m.name }
    return ''
  }
  isContact(code: Code): boolean { return listContacts().some((c) => c.code === code) }
  addContact(code: Code, name: string) { addContact(code, name); this.changed() }
  removeContact(code: Code) { removeContact(code); this.changed() }
  async block(code: Code, on: boolean) {
    if (on) this.blocked.add(code)
    else this.blocked.delete(code)
    await idb.kvSet('blocked', [...this.blocked])
    this.changed()
  }

  // ---- conversations -------------------------------------------------------------
  list(): Conversation[] {
    return [...this.convs.values()].sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || (b.lastAt || b.updatedAt) - (a.lastAt || a.updatedAt))
  }
  unreadTotal(): number { let n = 0; for (const c of this.convs.values()) if (!c.muted && !c.archived) n += c.unread || 0; return n }

  ensureDm(code: Code, name = ''): Conversation {
    const id = dmId(this.me, code)
    let c = this.convs.get(id)
    if (!c) {
      const now = Date.now()
      const self = code === this.me
      c = { id, kind: self ? 'self' : 'dm', title: self ? '' : name || this.contactName(code), members: self ? [{ code, name: this.name }] : [{ code: this.me, name: this.name }, { code, name: name || this.contactName(code) }], createdAt: now, updatedAt: now, unread: 0 }
      this.convs.set(id, c)
      this.touch(id)
      this.changed()
    } else if (name && c.kind === 'dm' && !c.title) {
      c.title = name
      this.touch(id)
    }
    return c
  }
  /** The other person in a DM. */
  peerOf(c: Conversation): Code { return c.members.find((m) => m.code !== this.me)?.code || this.me }
  titleOf(c: Conversation): string {
    if (c.kind === 'self') return ''
    if (c.kind === 'dm') { const p = this.peerOf(c); return this.contactName(p) || c.title || p }
    return c.title
  }

  createGroup(title: string, members: Member[], emoji = ''): Conversation {
    const id = 'g:' + newId()
    const now = Date.now()
    const all = dedupeMembers([{ code: this.me, name: this.name }, ...members])
    const c: Conversation = { id, kind: 'group', title: title.trim().slice(0, 80) || 'Group', members: all, owner: this.me, createdAt: now, updatedAt: now, unread: 0, emoji }
    this.convs.set(id, c)
    this.states.set(id, { conv: c, msgs: new Map(), held: [] })
    this.emit(id, { type: 'meta', title: c.title, emoji, members: all, owner: this.me })
    this.systemNote(id, 'groupCreated')
    return c
  }

  async loadConv(id: string): Promise<ConvState | null> {
    const c = this.convs.get(id)
    if (!c) return null
    let st = this.states.get(id)
    if (!st) {
      const msgs = await idb.getByIndex<Message>('msgs', 'conv', id).catch(() => [] as Message[])
      st = this.states.get(id) || { conv: c, msgs: new Map(msgs.map((m) => [m.id, m])), held: [] }
      st.conv = c
      this.states.set(id, st)
    }
    return st
  }
  messages(id: string): Message[] {
    const st = this.states.get(id)
    return st ? [...st.msgs.values()].sort(byTime) : []
  }
  message(convId: string, id: string): Message | undefined { return this.states.get(convId)?.msgs.get(id) }

  async view(id: string) {
    this.viewing = id
    const st = await this.loadConv(id)
    if (!st) return
    this.markRead(id)
    this.changed()
  }
  unview() { this.viewing = ''; this.changed() }

  markRead(id: string) {
    const st = this.states.get(id)
    if (!st) return
    const now = Date.now()
    let last = 0
    for (const m of st.msgs.values()) {
      if (m.from !== this.me && !m.readAt) { m.readAt = now; this.touch(id, m) }
      if (m.from !== this.me) last = Math.max(last, m.at)
    }
    if (st.conv.unread) { st.conv.unread = 0; this.touch(id) }
    if (last && this.settings.readReceipts && st.conv.kind !== 'self') this.emit(id, { type: 'read', upTo: last }, { persistLocal: false })
  }

  setConvFlag(id: string, p: Partial<Pick<Conversation, 'pinned' | 'muted' | 'archived' | 'draft'>>) {
    const c = this.convs.get(id)
    if (!c) return
    Object.assign(c, p)
    this.touch(id)
    if (!('draft' in p)) this.changed()
  }
  async deleteConv(id: string) {
    const st = await this.loadConv(id)
    this.convs.delete(id)
    this.states.delete(id)
    await idb.del('convs', id).catch(() => {})
    if (st) {
      await idb.delMany('msgs', [...st.msgs.keys()]).catch(() => {})
      await idb.delMany('blobs', [...st.msgs.values()].map((m) => m.file?.id).filter(Boolean) as string[]).catch(() => {})
    }
    for (const [k, o] of this.outbox) if (o.env.conv === id) { this.outbox.delete(k); void idb.del('outbox', k) }
    if (this.viewing === id) this.viewing = ''
    this.changed()
  }
  async clearConv(id: string) {
    const st = await this.loadConv(id)
    if (!st) return
    await idb.delMany('msgs', [...st.msgs.keys()]).catch(() => {})
    st.msgs.clear()
    st.conv.lastPreview = ''
    st.conv.pins = []
    st.conv.unread = 0
    this.touch(id)
    this.changed()
  }

  // ---- sending -----------------------------------------------------------------
  private envelope(conv: Conversation, ev: Event): Envelope {
    const env = { ...ev, v: 1, eid: newId('e'), conv: conv.id, from: this.me, name: this.name, at: Date.now() } as Envelope
    if (conv.kind === 'group') { env.kind = 'group'; env.title = conv.title; env.members = conv.members }
    return env
  }

  /** Apply an event of ours and queue it for every other member. */
  emit(convId: string, ev: Event, o: { persistLocal?: boolean; sendAt?: number } = {}): Envelope | null {
    const c = this.convs.get(convId)
    if (!c) return null
    const env = this.envelope(c, ev)
    if (o.sendAt) env.at = o.sendAt
    const st = this.states.get(convId) || { conv: c, msgs: new Map(), held: [] }
    this.states.set(convId, st)
    if (o.persistLocal !== false) {
      const r = applyEvent(st, env, { me: this.me, now: Date.now(), viewing: true })
      if (r.changed) this.touch(convId, r.changed)
      this.touch(convId)
    }
    const to = c.members.map((m) => m.code).filter((x) => x !== this.me)
    if (ev.type === 'meta' && ev.members) for (const m of ev.members) if (!to.includes(m.code) && m.code !== this.me) to.push(m.code)
    // A newer read receipt makes an older unsent one pointless.
    if (ev.type === 'read') for (const [k, o] of this.outbox) if (o.env.type === 'read' && o.env.conv === convId) { this.outbox.delete(k); void idb.del('outbox', k).catch(() => {}) }
    for (const code of to) {
      const item: OutItem = { key: `${env.eid}:${code}`, to: code, env, at: Date.now(), sendAt: o.sendAt }
      this.outbox.set(item.key, item)
      void idb.put('outbox', item).catch(() => {})
    }
    if (ev.type === 'msg') {
      const m = st.msgs.get(ev.msg.id)
      if (m) { m.delivery = Object.fromEntries(to.map((c2) => [c2, 'queued' as const])); this.touch(convId, m) }
    }
    this.changed()
    if (to.length) this.onOutbox()
    return env
  }

  private baseMsg(convId: string, kind: Message['kind'], text = '', reply?: Reply): Message {
    return { id: newId('m'), conv: convId, from: this.me, name: this.name, at: Date.now(), kind, text, reply }
  }

  sendText(convId: string, text: string, opts: { reply?: Reply; sendAt?: number } = {}): Message | null {
    const t = text.replace(/\s+$/, '').slice(0, 8000)
    if (!t.trim()) return null
    const m = this.baseMsg(convId, 'text', t, opts.reply)
    const c = this.convs.get(convId)
    if (c?.kind === 'group') {
      const names = new Map(c.members.filter((x) => x.code !== this.me && x.name).map((x) => [x.name.toLowerCase(), x.code]))
      const mentions = mentionedCodes(t, names)
      if (mentions.length) m.mentions = mentions
    }
    if (opts.sendAt) m.at = opts.sendAt
    this.emit(convId, { type: 'msg', msg: m }, { sendAt: opts.sendAt })
    return m
  }

  async sendFile(convId: string, file: Blob & { name?: string }, opts: { reply?: Reply; voice?: number; caption?: string } = {}): Promise<Message | null> {
    if (file.size > MAX_FILE) return null
    const fid = newId('f')
    await idb.put('blobs', { id: fid, blob: file })
    const info: FileInfo = { id: fid, name: (file.name || (opts.voice !== undefined ? 'voice.webm' : 'file')).slice(0, 200), size: file.size, mime: file.type || 'application/octet-stream', have: true }
    if (opts.voice !== undefined) info.dur = opts.voice
    if (info.mime.startsWith('image/')) {
      const t = await thumbnail(file).catch(() => null)
      if (t) { info.thumb = t.url; info.w = t.w; info.h = t.h }
    }
    const m = this.baseMsg(convId, opts.voice !== undefined ? 'voice' : 'file', opts.caption || '', opts.reply)
    m.file = info
    this.emit(convId, { type: 'msg', msg: m })
    return m
  }

  sendPoll(convId: string, poll: PollInfo): Message {
    const m = this.baseMsg(convId, 'poll')
    m.poll = { q: poll.q.slice(0, 300), multi: !!poll.multi, options: poll.options.filter((o) => o.text.trim()).slice(0, 12).map((o) => ({ id: o.id, text: o.text.slice(0, 120) })) }
    this.emit(convId, { type: 'msg', msg: m })
    return m
  }
  sendLocation(convId: string, loc: { lat: number; lng: number; acc?: number; label?: string }): Message {
    const m = this.baseMsg(convId, 'location')
    m.loc = { lat: Math.round(loc.lat * 1e6) / 1e6, lng: Math.round(loc.lng * 1e6) / 1e6, acc: loc.acc ? Math.round(loc.acc) : undefined, label: loc.label?.slice(0, 120) }
    this.emit(convId, { type: 'msg', msg: m })
    return m
  }
  sendCall(convId: string, room: string, video: boolean): Message {
    const m = this.baseMsg(convId, 'call')
    m.call = { room, video }
    this.emit(convId, { type: 'msg', msg: m })
    return m
  }
  sendDoc(convId: string, doc: { kind: string; title: string; url: string }): Message {
    const m = this.baseMsg(convId, 'doc')
    m.doc = { kind: doc.kind.slice(0, 20), title: doc.title.slice(0, 120), url: doc.url.slice(0, 600) }
    this.emit(convId, { type: 'msg', msg: m })
    return m
  }
  sendContactCard(convId: string, contact: Member): Message {
    const m = this.baseMsg(convId, 'contact')
    m.contact = { code: contact.code, name: contact.name }
    this.emit(convId, { type: 'msg', msg: m })
    return m
  }

  edit(convId: string, msgId: string, text: string) {
    const m = this.message(convId, msgId)
    if (!m || m.from !== this.me || m.deleted || !text.trim()) return
    this.emit(convId, { type: 'edit', msgId, text: text.slice(0, 8000), at: Date.now() })
  }
  deleteForEveryone(convId: string, msgId: string) {
    const m = this.message(convId, msgId)
    if (!m || m.from !== this.me) return
    if (m.file?.id) void idb.del('blobs', m.file.id)
    this.emit(convId, { type: 'del', msgId })
  }
  async deleteForMe(convId: string, msgId: string) {
    const st = this.states.get(convId)
    const m = st?.msgs.get(msgId)
    if (!st || !m) return
    st.msgs.delete(msgId)
    this.deadMsgs.add(msgId)
    if (m.file?.id) void idb.del('blobs', m.file.id)
    this.touch(convId)
    this.changed()
  }
  react(convId: string, msgId: string, emoji: string) {
    const m = this.message(convId, msgId)
    if (!m) return
    const on = !(m.reactions?.[emoji] || []).includes(this.me)
    this.emit(convId, { type: 'react', msgId, emoji, on })
  }
  vote(convId: string, msgId: string, optionId: string) {
    const m = this.message(convId, msgId)
    if (!m?.poll || m.poll.closed) return
    const mine = m.poll.options.filter((o) => (m.votes?.[o.id] || []).includes(this.me)).map((o) => o.id)
    let next: string[]
    if (m.poll.multi) next = mine.includes(optionId) ? mine.filter((x) => x !== optionId) : [...mine, optionId]
    else next = mine.includes(optionId) ? [] : [optionId]
    this.emit(convId, { type: 'vote', msgId, options: next })
  }
  closePoll(convId: string, msgId: string) { this.emit(convId, { type: 'poll-close', msgId }) }
  pin(convId: string, msgId: string) {
    const on = !(this.convs.get(convId)?.pins || []).includes(msgId)
    this.emit(convId, { type: 'pin', msgId, on })
  }
  star(convId: string, msgId: string) {
    const m = this.message(convId, msgId)
    if (!m) return
    m.starred = !m.starred
    this.touch(convId, m)
    this.changed()
  }
  starred(): Message[] {
    const out: Message[] = []
    for (const st of this.states.values()) for (const m of st.msgs.values()) if (m.starred) out.push(m)
    return out.sort(byTime)
  }
  async forward(fromConv: string, msgIds: string[], toConv: string) {
    for (const id of msgIds) {
      const src = this.message(fromConv, id)
      if (!src || src.deleted) continue
      const m: Message = { ...this.baseMsg(toConv, src.kind, src.text), file: src.file ? { ...src.file, have: src.file.have } : undefined, poll: src.poll ? { ...src.poll, closed: false } : undefined, loc: src.loc, doc: src.doc, contact: src.contact, call: src.call, forwarded: true }
      if (src.file?.have) {
        const b = await this.getBlob(src.file.id)
        if (b) { const fid = newId('f'); await idb.put('blobs', { id: fid, blob: b }); m.file = { ...src.file, id: fid, have: true } }
      }
      this.emit(toConv, { type: 'msg', msg: m })
    }
  }
  setDisappear(convId: string, ms: number) {
    this.emit(convId, { type: 'meta', disappearMs: ms })
    const c = this.convs.get(convId)
    if (c?.kind !== 'group' && c) { c.disappearMs = ms; this.touch(convId) }
    this.systemNote(convId, ms ? 'disappearOn' : 'disappearOff')
  }
  renameGroup(convId: string, title: string, emoji?: string) { this.emit(convId, { type: 'meta', title, emoji }) }
  setMembers(convId: string, members: Member[]) {
    const c = this.convs.get(convId)
    if (!c || c.kind !== 'group' || (c.owner && c.owner !== this.me)) return
    const before = new Set(c.members.map((m) => m.code))
    this.emit(convId, { type: 'meta', members: dedupeMembers([{ code: this.me, name: this.name }, ...members]) })
    // Removed members are not in `members` any more, so tell them explicitly.
    for (const code of before) if (!members.some((m) => m.code === code) && code !== this.me) {
      const env = this.envelope(c, { type: 'meta', members: c.members })
      const item: OutItem = { key: `${env.eid}:${code}`, to: code, env, at: Date.now() }
      this.outbox.set(item.key, item)
      void idb.put('outbox', item)
    }
    this.onOutbox()
  }
  leaveGroup(convId: string) {
    const c = this.convs.get(convId)
    if (!c || c.kind !== 'group') return
    this.emit(convId, { type: 'leave' })
    c.left = true
    this.touch(convId)
    this.changed()
  }
  typingPing(convId: string, on: boolean) {
    const c = this.convs.get(convId)
    if (!c || !this.settings.typing || c.kind === 'self') return
    const to = c.members.map((m) => m.code).filter((x) => x !== this.me)
    this.onEphemeral(to, { t: 'typing', conv: c.kind === 'group' ? c.id : '', on })
  }

  private systemNote(convId: string, text: string) {
    const c = this.convs.get(convId)
    if (!c) return
    const st = this.states.get(convId) || { conv: c, msgs: new Map(), held: [] }
    this.states.set(convId, st)
    const m: Message = { id: newId('s'), conv: convId, from: this.me, name: '', at: Date.now(), kind: 'system', text }
    st.msgs.set(m.id, m)
    this.touch(convId, m)
    this.changed()
  }

  // ---- receiving -----------------------------------------------------------------
  /** Apply an envelope that came from `via`. Returns false when it was refused. */
  async receive(raw: unknown, via: 'p2p' | 'push', peer?: Code): Promise<boolean> {
    await this.ready
    const env = raw as Envelope
    if (!env || env.v !== 1 || typeof env.eid !== 'string' || typeof env.from !== 'string' || typeof env.type !== 'string') return false
    if (peer && env.from !== peer) return false // a link speaks only for its own end
    if (this.blocked.has(env.from) || env.from === this.me) return false
    let convId = ''
    if (isGroupId(env.conv)) {
      convId = env.conv
      if (!this.convs.has(convId)) {
        // A group we have not heard of: only join if WE are among its members.
        const members = dedupeMembers(env.members || [])
        if (!members.some((m) => m.code === this.me)) return false
        const now = Date.now()
        this.convs.set(convId, { id: convId, kind: 'group', title: String(env.title || 'Group').slice(0, 80), members, owner: env.type === 'meta' && env.owner ? env.owner : env.from, createdAt: now, updatedAt: now, unread: 0 })
        this.touch(convId)
      }
    } else {
      convId = this.ensureDm(env.from, env.name).id
    }
    const st = (await this.loadConv(convId))!
    if (env.name) this.rememberName(env.from, env.name)
    const viewing = this.viewing === convId && typeof document !== 'undefined' && document.visibilityState === 'visible'
    const r = applyEvent(st, env, { me: this.me, now: Date.now(), viewing })
    if (r.typing !== undefined) this.setTyping(convId, env.from, r.typing)
    if (r.read) {
      for (const m of markReadBy(st.msgs.values(), this.me, r.read.from, r.read.upTo)) this.touch(convId, m)
    }
    if (r.changed) {
      this.touch(convId, r.changed)
      this.setTyping(convId, env.from, false)
      if (env.type === 'msg' && r.changed.from !== this.me) {
        const mentioned = (r.changed.mentions || []).includes(this.me)
        this.onIncoming(st.conv, r.changed, mentioned)
        if (viewing && this.settings.readReceipts) this.emit(convId, { type: 'read', upTo: r.changed.at }, { persistLocal: false })
        // Voice notes and small pictures fetch themselves; anything else waits for a tap.
        const f = r.changed.file
        if (f && !f.have && (r.changed.kind === 'voice' || (f.mime.startsWith('image/') && f.size <= this.settings.autoDownloadMb * 1048576))) this.onWantFile(f.id, [env.from])
      }
    }
    this.touch(convId)
    void via
    this.changed()
    return true
  }

  /** A hello carried a name: keep a saved contact's name, but fill in an unnamed DM. */
  rememberContactName(code: Code, name: string) { this.rememberName(code, name) }
  /** Is this a file some message of ours refers to and we do not have yet? */
  async expectsFile(fileId: string): Promise<boolean> {
    for (const st of this.states.values()) for (const m of st.msgs.values()) if (m.file?.id === fileId) return !m.file.have
    const all = await idb.getAll<Message>('msgs').catch(() => [] as Message[])
    return all.some((m) => m.file?.id === fileId && !m.file.have)
  }

  private rememberName(code: Code, name: string) {
    const c = this.convs.get(dmId(this.me, code))
    if (c && c.kind === 'dm') {
      const m = c.members.find((x) => x.code === code)
      if (m && m.name !== name) { m.name = name.slice(0, 60); this.touch(c.id) }
    }
  }

  private setTyping(convId: string, code: Code, on: boolean) {
    let m = this.typing.get(convId)
    if (!m) { m = new Map(); this.typing.set(convId, m) }
    if (on) m.set(code, Date.now() + 6000)
    else m.delete(code)
  }
  typingIn(convId: string): Code[] {
    const m = this.typing.get(convId)
    if (!m) return []
    const now = Date.now()
    return [...m.entries()].filter(([, until]) => until > now).map(([c]) => c)
  }
  /** An ephemeral message from a live link. */
  ephemeral(from: Code, msg: { t: string; conv?: string; on?: boolean }) {
    if (msg.t === 'typing') {
      const convId = msg.conv && isGroupId(msg.conv) ? msg.conv : dmId(this.me, from)
      if (!this.convs.has(convId)) return
      this.setTyping(convId, from, !!msg.on)
      this.changed()
    }
  }

  // ---- outbox (the transport's half) ---------------------------------------------
  pendingFor(code: Code, now = Date.now()): OutItem[] {
    return [...this.outbox.values()].filter((o) => o.to === code && (!o.sendAt || o.sendAt <= now)).sort((a, b) => a.at - b.at)
  }
  recipients(now = Date.now()): Code[] {
    return [...new Set([...this.outbox.values()].filter((o) => !o.sendAt || o.sendAt <= now).map((o) => o.to))]
  }
  scheduled(): OutItem[] { return [...this.outbox.values()].filter((o) => o.sendAt && o.sendAt > Date.now()) }
  async ack(code: Code, eids: string[]) {
    const keys: string[] = []
    for (const eid of eids) {
      const key = `${eid}:${code}`
      const o = this.outbox.get(key)
      if (!o) continue
      this.outbox.delete(key)
      keys.push(key)
      if (o.env.type === 'msg') this.setDelivery(o.env.conv, o.env.msg.id, code, 'delivered')
    }
    await idb.delMany('outbox', keys).catch(() => {})
    if (keys.length) this.changed()
  }
  async markPushed(item: OutItem) {
    const o = this.outbox.get(item.key)
    if (!o) return
    o.pushed = true
    o.tries = (o.tries || 0) + 1
    await idb.put('outbox', o).catch(() => {})
    if (o.env.type === 'msg') this.setDelivery(o.env.conv, o.env.msg.id, o.to, 'pushed')
    this.changed()
  }
  /** Ephemeral read receipts and the like need no delivery guarantee: drop instead of pushing. */
  async dropItem(item: OutItem) {
    this.outbox.delete(item.key)
    await idb.del('outbox', item.key).catch(() => {})
  }
  private setDelivery(convId: string, msgId: string, code: Code, state: 'pushed' | 'delivered') {
    const st = this.states.get(convId)
    const m = st?.msgs.get(msgId)
    if (!m) { void this.loadConv(convId).then(() => { const mm = this.message(convId, msgId); if (mm) this.setDelivery(convId, msgId, code, state) }); return }
    const cur = m.delivery?.[code]
    const rank = { queued: 0, pushed: 1, delivered: 2, read: 3 } as const
    if (cur && rank[cur] >= rank[state]) return
    m.delivery = { ...(m.delivery || {}), [code]: state }
    this.touch(convId, m)
  }
  cancelScheduled(key: string) {
    const o = this.outbox.get(key)
    if (!o) return
    for (const [k, x] of this.outbox) if (x.env.eid === o.env.eid) { this.outbox.delete(k); void idb.del('outbox', k) }
    if (o.env.type === 'msg') void this.deleteForMe(o.env.conv, o.env.msg.id)
    this.changed()
  }

  // ---- files -----------------------------------------------------------------------
  async getBlob(id: string): Promise<Blob | null> {
    const v = await idb.get<{ id: string; blob: Blob }>('blobs', id).catch(() => undefined)
    return v?.blob || null
  }
  async storeBlob(fileId: string, blob: Blob) {
    await idb.put('blobs', { id: fileId, blob })
    for (const st of this.states.values()) for (const m of st.msgs.values()) if (m.file?.id === fileId && !m.file.have) { m.file = { ...m.file, have: true }; this.touch(st.conv.id, m) }
    // Not loaded yet? Find it on disk.
    const all = await idb.getAll<Message>('msgs').catch(() => [] as Message[])
    for (const m of all) if (m.file?.id === fileId && !m.file.have) { m.file = { ...m.file, have: true }; await idb.put('msgs', m) }
    this.progress.delete(fileId)
    this.changed()
  }
  /** Members who could serve a file: its sender first, then everyone else in the conversation. */
  sourcesFor(convId: string, msgId: string): Code[] {
    const m = this.message(convId, msgId)
    const c = this.convs.get(convId)
    if (!m || !c) return []
    return [m.from, ...c.members.map((x) => x.code).filter((x) => x !== m.from && x !== this.me)]
  }
  /** Files we lack that the given peer might have (for a freshly opened link). */
  async missingFrom(code: Code): Promise<string[]> {
    const out: string[] = []
    for (const st of this.states.values()) {
      if (!st.conv.members.some((m) => m.code === code)) continue
      for (const m of st.msgs.values()) if (m.file && !m.file.have && !m.deleted && (m.kind === 'voice' || (m.file.mime.startsWith('image/') && m.file.size <= this.settings.autoDownloadMb * 1048576))) out.push(m.file.id)
    }
    return out
  }

  // ---- housekeeping ----------------------------------------------------------------
  sweep() {
    const now = Date.now()
    for (const st of this.states.values()) {
      const gone = sweepExpired(st.msgs, now)
      for (const id of gone) this.deadMsgs.add(id)
      if (gone.length) this.touch(st.conv.id)
    }
  }
  /** Migrate the Calls direct messages (lib/dms.ts) into Messages, once and idempotently. */
  private async importLegacyDms() {
    const dms = listDms()
    if (!dms.length) return
    const done = new Set((await idb.kvGet<string[]>('legacyImported')) || [])
    const fresh = dms.filter((d) => !done.has(d.id) && d.from)
    for (const d of fresh) {
      const c = this.ensureDm(d.from, d.mine ? '' : d.name)
      const st = (await this.loadConv(c.id))!
      const id = 'legacy-' + d.id
      if (st.msgs.has(id)) continue
      const m: Message = { id, conv: c.id, from: d.mine ? this.me : d.from, name: d.mine ? this.name : d.name, at: d.at, kind: d.voice ? 'voice' : 'text', text: d.text, readAt: d.at }
      if (d.reactions) m.reactions = d.reactions
      st.msgs.set(id, m)
      c.lastAt = Math.max(c.lastAt || 0, d.at)
      if (!c.lastAt || d.at >= c.lastAt) c.lastPreview = preview(m)
      this.touch(c.id, m)
      done.add(d.id)
    }
    await idb.kvSet('legacyImported', [...done])
  }

  async exportAll(): Promise<Blob> {
    await this.flush()
    const [convs, msgs] = await Promise.all([idb.getAll<Conversation>('convs'), idb.getAll<Message>('msgs')])
    return new Blob([JSON.stringify({ app: 'bis-messages', v: 1, at: Date.now(), me: this.me, name: this.name, contacts: listContacts(), convs, msgs }, null, 1)], { type: 'application/json' })
  }
  async importAll(text: string): Promise<{ convs: number; msgs: number } | null> {
    let d: { app?: string; convs?: Conversation[]; msgs?: Message[]; contacts?: Contact[] }
    try { d = JSON.parse(text) } catch { return null }
    if (d.app !== 'bis-messages' || !Array.isArray(d.convs) || !Array.isArray(d.msgs)) return null
    let nc = 0
    let nm = 0
    for (const c of d.convs) if (c && typeof c.id === 'string' && !this.convs.has(c.id)) { this.convs.set(c.id, { ...c, unread: 0 }); this.touch(c.id); nc++ }
    const existing = new Set((await idb.getAll<Message>('msgs')).map((m) => m.id))
    const add = d.msgs.filter((m) => m && typeof m.id === 'string' && !existing.has(m.id) && this.convs.has(m.conv)).map((m) => ({ ...m, file: m.file ? { ...m.file, have: false } : undefined }))
    await idb.putMany('msgs', add)
    nm = add.length
    for (const c of d.contacts || []) if (c?.code && !this.isContact(c.code)) addContact(c.code, c.name)
    this.states.clear()
    this.changed()
    return { convs: nc, msgs: nm }
  }

  /** Text export of one conversation — what "email me this chat" means elsewhere. */
  async exportText(convId: string): Promise<string> {
    await this.loadConv(convId)
    const c = this.convs.get(convId)
    const lines = [`# ${c ? this.titleOf(c) || 'Note to self' : ''}`, '']
    for (const m of this.messages(convId)) {
      if (m.kind === 'system') continue
      const when = new Date(m.at).toISOString().replace('T', ' ').slice(0, 16)
      lines.push(`[${when}] ${m.from === this.me ? this.name || 'Me' : m.name || m.from}: ${m.deleted ? '(deleted)' : m.kind === 'text' ? plain(m.text) : preview({ ...m, name: '' })}`)
    }
    return lines.join('\n')
  }
}

/** A small JPEG preview, so a picture shows (blurred) before its bytes arrive. */
async function thumbnail(file: Blob): Promise<{ url: string; w: number; h: number }> {
  const bmp = await createImageBitmap(file)
  const max = 48
  const s = Math.min(1, max / Math.max(bmp.width, bmp.height))
  const w = Math.max(1, Math.round(bmp.width * s))
  const h = Math.max(1, Math.round(bmp.height * s))
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  c.getContext('2d')!.drawImage(bmp, 0, 0, w, h)
  const out = { url: c.toDataURL('image/jpeg', 0.6), w: bmp.width, h: bmp.height }
  bmp.close()
  return out
}

let singleton: MessageStore | null = null
export function getStore(): MessageStore {
  if (!singleton) singleton = new MessageStore()
  return singleton
}
