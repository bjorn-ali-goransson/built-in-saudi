// The Messages data model, and the one function that changes it.
//
// Everything that happens in a conversation — a message, an edit, a reaction, a
// vote, a read receipt, a group rename — travels as an EVENT, and every event is
// applied through `applyEvent`. That is what lets one event arrive by two roads
// (a Web Push while the app was closed, then again peer-to-peer when both sides
// came online) and land exactly once: application is idempotent by event id and
// by message id, and an edit that arrives before the message it edits is held
// until the message turns up rather than lost.
//
// There is no server ordering anybody's messages. Order within a conversation is
// the sender's timestamp, tie-broken by id, so two devices that saw the same
// events in different orders still render the same thread.

export type Code = string // a person's address: their call-link code

export interface Member { code: Code; name: string }

export type ConvKind = 'dm' | 'group' | 'self'

export interface Conversation {
  id: string
  kind: ConvKind
  title: string
  members: Member[]
  createdAt: number
  updatedAt: number
  /** Who created a group; only they may remove members. */
  owner?: Code
  emoji?: string
  pinned?: boolean
  muted?: boolean
  archived?: boolean
  unread: number
  draft?: string
  /** Messages vanish this long after they were sent (0 = off). */
  disappearMs?: number
  lastPreview?: string
  lastAt?: number
  /** Ids of messages pinned to the top of the thread. */
  pins?: string[]
  /** Whether this conversation has left (group) — kept for history, read-only. */
  left?: boolean
}

export type MsgKind = 'text' | 'file' | 'voice' | 'poll' | 'location' | 'system' | 'call' | 'doc' | 'contact'

export interface FileInfo { id: string; name: string; size: number; mime: string; /** this device holds the bytes */ have?: boolean; w?: number; h?: number; thumb?: string; dur?: number }
export interface PollInfo { q: string; options: { id: string; text: string }[]; multi: boolean; closed?: boolean }
export interface Reply { id: string; from: Code; name: string; snippet: string }

export interface Message {
  id: string
  conv: string
  from: Code
  name: string
  at: number
  kind: MsgKind
  text: string
  reply?: Reply
  file?: FileInfo
  poll?: PollInfo
  /** optionId -> codes */
  votes?: Record<string, Code[]>
  loc?: { lat: number; lng: number; acc?: number; label?: string }
  call?: { room: string; video: boolean }
  doc?: { kind: string; title: string; url: string }
  contact?: Member
  /** emoji -> codes */
  reactions?: Record<string, Code[]>
  edited?: number
  deleted?: boolean
  forwarded?: boolean
  mentions?: Code[]
  expiresAt?: number
  /** Local-only flags. */
  starred?: boolean
  /** Sender side: per-recipient delivery state. */
  delivery?: Record<Code, 'queued' | 'pushed' | 'delivered' | 'read'>
  /** Recipient side: when we read it. */
  readAt?: number
}

export type Event =
  | { type: 'msg'; msg: Message }
  | { type: 'edit'; msgId: string; text: string; at: number }
  | { type: 'del'; msgId: string }
  | { type: 'react'; msgId: string; emoji: string; on: boolean }
  | { type: 'vote'; msgId: string; options: string[] }
  | { type: 'poll-close'; msgId: string }
  | { type: 'read'; upTo: number }
  | { type: 'typing'; on: boolean }
  | { type: 'meta'; title?: string; emoji?: string; members?: Member[]; disappearMs?: number; owner?: Code }
  | { type: 'leave' }
  | { type: 'pin'; msgId: string; on: boolean }

/** What actually goes over the wire: an event, addressed and signed with who sent it. */
export type Envelope = Event & { v: 1; eid: string; conv: string; from: Code; name: string; at: number; kind?: ConvKind; title?: string; members?: Member[] }

export const EDIT_WINDOW_MS = 24 * 3600_000
export const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏']

export function dmId(a: Code, b: Code): string {
  return a === b ? `self:${a}` : `dm:${[a, b].sort().join(':')}`
}
export const isGroupId = (id: string) => id.startsWith('g:')

export function newId(prefix = ''): string {
  const a = new Uint8Array(10)
  crypto.getRandomValues(a)
  return prefix + Array.from(a, (b) => b.toString(36).padStart(2, '0')).join('').slice(0, 16)
}

export const byTime = (a: Message, b: Message) => a.at - b.at || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)

/** A one-line preview for the conversation list and notifications. */
export function preview(m: Message, you = 'You'): string {
  if (m.deleted) return '🚫'
  const who = m.name ? `${m.name}: ` : ''
  switch (m.kind) {
    case 'file': return `${who}📎 ${m.file?.name || ''}`
    case 'voice': return `${who}🎤 ${fmtDur(m.file?.dur || 0)}`
    case 'poll': return `${who}📊 ${m.poll?.q || ''}`
    case 'location': return `${who}📍 ${m.loc?.label || ''}`.trim()
    case 'call': return `${who}📞`
    case 'doc': return `${who}📄 ${m.doc?.title || ''}`
    case 'contact': return `${who}👤 ${m.contact?.name || ''}`
    case 'system': return m.text
    default: return who + m.text.replace(/\s+/g, ' ').slice(0, 140)
  }
  void you
}

export function fmtDur(s: number): string {
  const t = Math.max(0, Math.round(s))
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`
}

/** Toggle `code`'s membership of a set-valued map key. */
function toggle(map: Record<string, Code[]> | undefined, key: string, code: Code, on: boolean): Record<string, Code[]> {
  const next = { ...(map || {}) }
  const cur = next[key] || []
  const has = cur.includes(code)
  const list = on ? (has ? cur : [...cur, code]) : cur.filter((c) => c !== code)
  if (list.length) next[key] = list
  else delete next[key]
  return next
}

export interface ApplyCtx {
  /** Our own code, for unread counting and mention detection. */
  me: Code
  now: number
  /** Is this conversation currently open on screen? Then a message is read on arrival. */
  viewing: boolean
}

export interface ConvState { conv: Conversation; msgs: Map<string, Message>; held: Envelope[] }

/** Apply one envelope to a conversation. Returns the changed message, if any. Mutates `st`. */
export function applyEvent(st: ConvState, ev: Envelope, ctx: ApplyCtx): { changed?: Message; typing?: boolean; read?: { from: Code; upTo: number } } {
  const c = st.conv
  switch (ev.type) {
    case 'msg': {
      const m = ev.msg
      if (!m || typeof m.id !== 'string') return {}
      if (st.msgs.has(m.id)) return {} // duplicate road
      // A member who is not in the group cannot post into it.
      if (c.kind === 'group' && !c.members.some((x) => x.code === ev.from) && ev.from !== ctx.me) return {}
      const msg: Message = { ...m, conv: c.id, from: ev.from, name: ev.name || m.name }
      // Local-only state on the SENDER's copy (they hold the file, their ticks,
      // their stars) means nothing on ours and must not ride along.
      if (ev.from !== ctx.me) {
        delete msg.delivery
        delete msg.starred
        delete msg.readAt
        if (msg.file) msg.file = { ...msg.file, have: false }
      }
      if (c.disappearMs && !msg.expiresAt) msg.expiresAt = msg.at + c.disappearMs
      if (msg.expiresAt && msg.expiresAt <= ctx.now) return {}
      st.msgs.set(msg.id, msg)
      if (ev.from !== ctx.me && msg.kind !== 'system') {
        if (ctx.viewing) msg.readAt = ctx.now
        else c.unread = (c.unread || 0) + 1
      }
      bump(c, msg)
      // Anything that was waiting for this message can apply now.
      const waiting = st.held.filter((h) => 'msgId' in h && h.msgId === msg.id)
      if (waiting.length) {
        st.held = st.held.filter((h) => !waiting.includes(h))
        for (const w of waiting) applyEvent(st, w, ctx)
      }
      return { changed: st.msgs.get(msg.id) }
    }
    case 'edit': case 'del': case 'react': case 'vote': case 'poll-close': case 'pin': {
      const m = st.msgs.get(ev.msgId)
      if (!m) {
        // Out of order: hold it (bounded) until the message arrives.
        if (st.held.length < 200 && !st.held.some((h) => h.eid === ev.eid)) st.held.push(ev)
        return {}
      }
      if (ev.type === 'edit') {
        if (m.from !== ev.from || m.deleted) return {}
        if (m.edited && m.edited >= ev.at) return {}
        m.text = String(ev.text).slice(0, 8000)
        m.edited = ev.at
      } else if (ev.type === 'del') {
        if (m.from !== ev.from) return {}
        m.deleted = true
        m.text = ''
        m.file = m.file ? { ...m.file, have: false, thumb: undefined } : undefined
        m.poll = undefined
        m.reactions = undefined
      } else if (ev.type === 'react') {
        if (m.deleted) return {}
        m.reactions = toggle(m.reactions, String(ev.emoji).slice(0, 16), ev.from, !!ev.on)
      } else if (ev.type === 'vote') {
        if (!m.poll || m.poll.closed) return {}
        const valid = new Set(m.poll.options.map((o) => o.id))
        let opts = (ev.options || []).filter((o) => valid.has(o))
        if (!m.poll.multi) opts = opts.slice(0, 1)
        let votes = m.votes || {}
        for (const o of m.poll.options) votes = toggle(votes, o.id, ev.from, opts.includes(o.id))
        m.votes = votes
      } else if (ev.type === 'poll-close') {
        if (!m.poll || m.from !== ev.from) return {}
        m.poll = { ...m.poll, closed: true }
      } else if (ev.type === 'pin') {
        const pins = new Set(c.pins || [])
        if (ev.on) pins.add(m.id)
        else pins.delete(m.id)
        c.pins = [...pins]
      }
      return { changed: m }
    }
    case 'read':
      return { read: { from: ev.from, upTo: Number(ev.upTo) || 0 } }
    case 'typing':
      return { typing: !!ev.on }
    case 'meta': {
      if (c.kind !== 'group') {
        if (ev.disappearMs !== undefined) c.disappearMs = clampDisappear(ev.disappearMs)
        return {}
      }
      // Only a member may change a group; only its owner may change its members.
      if (!c.members.some((x) => x.code === ev.from)) return {}
      if (ev.title !== undefined) c.title = String(ev.title).slice(0, 80)
      if (ev.emoji !== undefined) c.emoji = String(ev.emoji).slice(0, 8)
      if (ev.disappearMs !== undefined) c.disappearMs = clampDisappear(ev.disappearMs)
      if (ev.members && (!c.owner || ev.from === c.owner)) {
        c.members = dedupeMembers(ev.members)
        if (!c.members.some((x) => x.code === ctx.me)) c.left = true
      }
      c.updatedAt = Math.max(c.updatedAt, ev.at)
      return {}
    }
    case 'leave': {
      c.members = c.members.filter((x) => x.code !== ev.from)
      return {}
    }
  }
  return {}
}

export function clampDisappear(ms: number): number {
  const v = Number(ms) || 0
  return v <= 0 ? 0 : Math.min(Math.max(v, 60_000), 90 * 24 * 3600_000)
}
export function dedupeMembers(list: Member[]): Member[] {
  const seen = new Map<Code, Member>()
  for (const m of list || []) if (m && typeof m.code === 'string' && m.code) seen.set(m.code, { code: m.code, name: String(m.name || '').slice(0, 60) })
  return [...seen.values()]
}

function bump(c: Conversation, m: Message) {
  if (!c.lastAt || m.at >= c.lastAt) {
    c.lastAt = m.at
    c.lastPreview = preview(m)
  }
  c.updatedAt = Math.max(c.updatedAt || 0, m.at)
}

/** Apply a read receipt to OUR messages: everything we sent up to `upTo` is read by `from`. */
export function markReadBy(msgs: Iterable<Message>, me: Code, from: Code, upTo: number): Message[] {
  const out: Message[] = []
  for (const m of msgs) {
    if (m.from !== me || m.at > upTo) continue
    const d = m.delivery || {}
    if (d[from] !== 'read') { m.delivery = { ...d, [from]: 'read' }; out.push(m) }
  }
  return out
}

/** The worst delivery state across recipients — what a single tick shows. */
export function deliverySummary(m: Message): 'queued' | 'pushed' | 'delivered' | 'read' | undefined {
  const v = Object.values(m.delivery || {})
  if (!v.length) return undefined
  const rank = { queued: 0, pushed: 1, delivered: 2, read: 3 } as const
  return v.reduce((a, b) => (rank[b] < rank[a] ? b : a))
}

/** Drop expired disappearing messages. Returns the ids removed. */
export function sweepExpired(msgs: Map<string, Message>, now: number): string[] {
  const out: string[] = []
  for (const [id, m] of msgs) if (m.expiresAt && m.expiresAt <= now) { msgs.delete(id); out.push(id) }
  return out
}

/** Poll results: per option, count and share. */
export function tally(m: Message): { id: string; text: string; n: number; share: number }[] {
  if (!m.poll) return []
  const voters = new Set<Code>()
  for (const l of Object.values(m.votes || {})) for (const c of l) voters.add(c)
  const total = voters.size || 1
  return m.poll.options.map((o) => {
    const n = (m.votes?.[o.id] || []).length
    return { id: o.id, text: o.text, n, share: n / total }
  })
}

/** Day separators: 'today' | 'yesterday' | a date key. */
export function dayKey(at: number, now: number): string {
  const d = new Date(at)
  const t = new Date(now)
  const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
  if (sameDay(d, t)) return 'today'
  const y = new Date(now - 86400_000)
  if (sameDay(d, y)) return 'yesterday'
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Search across messages: every term must appear (case- and diacritic-insensitive). */
export function matchesSearch(m: Message, q: string): boolean {
  const terms = fold(q).split(/\s+/).filter(Boolean)
  if (!terms.length) return false
  const hay = fold([m.text, m.name, m.file?.name, m.poll?.q, ...(m.poll?.options.map((o) => o.text) || []), m.loc?.label, m.doc?.title].filter(Boolean).join(' '))
  return terms.every((t) => hay.includes(t))
}
export function fold(s: string): string {
  return s.toLowerCase().normalize('NFKD').replace(/[ً-ٰٟـ̀-ͯ]/g, '').replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه')
}
