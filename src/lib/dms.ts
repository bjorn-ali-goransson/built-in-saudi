// Direct messages between call-link contacts.
//
// Deliberately the same shape as everything else in Calls: the server relays and
// forgets. A message travels in a Web Push payload to the recipient's device and is
// stored ONLY there (sw.js queues it, this drains it into localStorage). There is no
// mailbox, no history sync between your own devices, and nothing to delete
// server-side — which also means `my-data` has nothing to report.
//
// The trade that buys: a message can only reach someone whose device accepts the
// push. If they never granted notifications, or their subscription has lapsed, the
// send reports zero deliveries and the message simply didn't arrive.
import { useCallback, useEffect, useState } from 'react'
import { drainQueue } from './localQueue'
import { getMyCallLink } from './callLink'

export interface Dm {
  id: string
  /** emoji -> who reacted. Same toggle semantics as the in-call chat. */
  reactions?: Record<string, string[]>
  /** The OTHER party's call-link code — the thread key, whoever sent it. */
  from: string
  name: string
  text: string
  at: number
  /** True when we sent it (kept locally; the recipient stores their own copy). */
  mine?: boolean
  /** Set only on the wire: this push is a reaction to `react.id`, not a message. */
  react?: { id: string; emoji: string } | null
  /** A voice note (#232). The audio itself lives in IndexedDB keyed by this message's
   *  `id` (never in localStorage, never on the server); this only carries the metadata.
   *  `pending` means the audio hasn't transferred P2P yet — for the sender it's
   *  awaiting delivery, for the recipient it's awaiting the other side coming online. */
  voice?: { dur: number; mime: string; pending?: boolean }
}

const KEY = 'bis-call-dms'
const MAX = 300
const CHANGED = 'bis-dms-changed'
const FN = (typeof window !== 'undefined' && (window as unknown as { __CALL_FN?: string }).__CALL_FN)
  || 'https://us-central1-blitz-ksa.cloudfunctions.net'

export function listDms(): Dm[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || '[]')
    if (!Array.isArray(v)) return []
    return v
      .filter((m) => m && typeof m.id === 'string')
      .map((m) => ({
        id: m.id, from: String(m.from || ''), name: String(m.name || ''),
        text: String(m.text || ''), at: Number(m.at) || 0, mine: !!m.mine,
        reactions: (m.reactions && typeof m.reactions === 'object') ? m.reactions : undefined,
        voice: (m.voice && typeof m.voice === 'object') ? { dur: Number(m.voice.dur) || 0, mime: String(m.voice.mime || 'audio/webm'), pending: !!m.voice.pending } : undefined,
      }))
      .sort((a, b) => a.at - b.at)
  } catch { return [] }
}

function write(list: Dm[]): Dm[] {
  // Keep the newest MAX, but hand back in conversation order.
  const next = [...list].sort((a, b) => b.at - a.at).slice(0, MAX).sort((a, b) => a.at - b.at)
  try { localStorage.setItem(KEY, JSON.stringify(next)) } catch { /* storage full */ }
  try { window.dispatchEvent(new Event(CHANGED)) } catch { /* */ }
  return next
}

export function addDms(entries: Dm[]): Dm[] {
  if (!entries.length) return listDms()
  const by = new Map(listDms().map((m) => [m.id, m]))
  for (const e of entries) by.set(e.id, { ...by.get(e.id), ...e })
  return write([...by.values()])
}

/** Flip a voice note's pending flag once its audio has transferred P2P (#232). */
export function setVoicePending(id: string, pending: boolean): Dm[] {
  return write(listDms().map((m) => (m.id === id && m.voice ? { ...m, voice: { ...m.voice, pending } } : m)))
}

/** Notify a contact that a voice note is waiting — metadata only, the audio goes P2P. */
export async function sendVoiceNotice(code: string, myName: string, meta: { id: string; dur: number; mime: string }): Promise<SendResult> {
  if (!code) return { ok: false, delivered: 0 }
  let from = ''
  try { from = getMyCallLink()?.code || '' } catch { /* */ }
  try {
    const res = await fetch(`${FN}/call-dm`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, from, name: myName || 'Someone', id: meta.id, voice: { dur: meta.dur, mime: meta.mime } }),
    })
    if (!res.ok) return { ok: false, delivered: 0 }
    const d = await res.json().catch(() => ({}))
    return { ok: true, delivered: Number(d.delivered) || 0 }
  } catch { return { ok: false, delivered: 0 } }
}

export function clearThread(code: string): Dm[] { return write(listDms().filter((m) => m.from !== code)) }

export async function drainDmQueue(): Promise<Dm[]> {
  const queued = await drainQueue<Dm>('dms')
  // A reaction push carries `react` and is NOT a message — attach it to the message
  // it refers to, or it would show up as an empty bubble in the thread.
  const messages = queued.filter((m) => !m.react)
  const reactions = queued.filter((m) => m.react)
  let out = addDms(messages)
  for (const r of reactions) {
    if (!r.react?.id || !r.react.emoji) continue
    out = applyDmReaction(r.react.id, r.react.emoji, r.name || 'Someone')
  }
  return out
}

/** Toggle `who`'s reaction on a message, locally. Mirrors the in-call chat: a second
 *  tap removes it, and an emoji with nobody left disappears. */
export function applyDmReaction(id: string, emoji: string, who: string): Dm[] {
  return write(listDms().map((m) => {
    if (m.id !== id) return m
    const r = { ...(m.reactions || {}) }
    const list = r[emoji] || []
    r[emoji] = list.includes(who) ? list.filter((n) => n !== who) : [...list, who]
    if (!r[emoji].length) delete r[emoji]
    return { ...m, reactions: r }
  }))
}

/** React to a message and tell the other side. The reaction is tiny, so it rides the
 *  same push as a message — the audio-sized problems of #232 don't apply here. */
export async function sendDmReaction(code: string, id: string, emoji: string, myName: string): Promise<void> {
  applyDmReaction(id, emoji, myName || 'Someone')
  let from = ''
  try { from = getMyCallLink()?.code || '' } catch { /* */ }
  try {
    await fetch(`${FN}/call-dm`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, from, name: myName || 'Someone', react: { id, emoji }, id: `r${id}${emoji}` }),
    })
  } catch { /* best-effort, exactly like a message */ }
}

export interface SendResult { ok: boolean; delivered: number }

/** Send a message to a contact's call link, and keep our own copy of it. */
export async function sendDm(code: string, name: string, text: string, myName: string): Promise<SendResult> {
  const body = text.trim().slice(0, 500)
  if (!code || !body) return { ok: false, delivered: 0 }
  const id = `s${Date.now()}${Math.random().toString(36).slice(2, 7)}`
  // Our own link code travels with it — that's what lets them reply.
  let from = ''
  try { from = getMyCallLink()?.code || '' } catch { /* */ }
  // Record locally first, so the thread reflects what we sent even if the push fails.
  addDms([{ id, from: code, name, text: body, at: Date.now(), mine: true }])
  try {
    const res = await fetch(`${FN}/call-dm`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, from, name: myName || 'Someone', text: body, id }),
    })
    if (!res.ok) return { ok: false, delivered: 0 }
    const d = await res.json().catch(() => ({}))
    return { ok: true, delivered: Number(d.delivered) || 0 }
  } catch { return { ok: false, delivered: 0 } }
}

/** Live view of the message store, drained on mount and on a new push. */
export function useDms() {
  const [dms, setDms] = useState<Dm[]>(() => listDms())
  useEffect(() => {
    let alive = true
    const drain = () => { drainDmQueue().then((l) => { if (alive) setDms(l) }) }
    const reread = () => { if (alive) setDms(listDms()) } // plain read — can't loop with write()
    drain()
    window.addEventListener('bis-dm', drain)
    window.addEventListener(CHANGED, reread)
    window.addEventListener('storage', reread)
    return () => {
      alive = false
      window.removeEventListener('bis-dm', drain)
      window.removeEventListener(CHANGED, reread)
      window.removeEventListener('storage', reread)
    }
  }, [])
  const clear = useCallback((code: string) => setDms(clearThread(code)), [])
  return { dms, clear }
}
