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
  /** The OTHER party's call-link code — the thread key, whoever sent it. */
  from: string
  name: string
  text: string
  at: number
  /** True when we sent it (kept locally; the recipient stores their own copy). */
  mine?: boolean
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
      .map((m) => ({ id: m.id, from: String(m.from || ''), name: String(m.name || ''), text: String(m.text || ''), at: Number(m.at) || 0, mine: !!m.mine }))
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

export const threadWith = (code: string) => listDms().filter((m) => m.from === code)
/** Unread-ish signal: how many messages arrived from each contact. */
export function countsByContact(): Record<string, number> {
  const out: Record<string, number> = {}
  for (const m of listDms()) if (!m.mine) out[m.from] = (out[m.from] || 0) + 1
  return out
}
export function clearThread(code: string): Dm[] { return write(listDms().filter((m) => m.from !== code)) }

export async function drainDmQueue(): Promise<Dm[]> {
  return addDms(await drainQueue<Dm>('dms'))
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
