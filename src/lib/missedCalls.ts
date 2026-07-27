// Missed "call me" calls (#210), recorded on THIS device only. The relay never
// keeps a call log: the missed-call push carries the record, public/sw.js queues
// it in IndexedDB (so it survives with no tab open), and this drains that queue
// into localStorage — the list the Calls setup screen shows. An entry may carry
// `back` (they asked to be called back, #211) and `from` (their own link code,
// sent whenever they publish one) — the first drives a Call-back button, the
// second lets you save them as a contact.
import { useCallback, useEffect, useState } from 'react'
import { drainQueue } from './localQueue'

export interface MissedCall { id: string; name: string; at: number; back?: string; from?: string }

const KEY = 'bis-call-missed'
const MAX = 20

function read(): MissedCall[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || '[]')
    if (!Array.isArray(v)) return []
    return v.filter((m) => m && typeof m.id === 'string').map((m) => ({ id: m.id, name: String(m.name || ''), at: Number(m.at) || 0, back: m.back || undefined, from: m.from || undefined }))
  } catch { return [] }
}
// Every writer announces itself, so a second component showing the same data (the
// nav badge alongside the list) updates too. Without this, clearing the list left
// the badge showing a stale count until a reload (#223).
const CHANGED = 'bis-missed-changed'

function write(list: MissedCall[]): MissedCall[] {
  const next = [...list].sort((a, b) => b.at - a.at).slice(0, MAX)
  try { localStorage.setItem(KEY, JSON.stringify(next)) } catch { /* storage full */ }
  try { window.dispatchEvent(new Event(CHANGED)) } catch { /* */ }
  return next
}

export function listMissed(): MissedCall[] { return read().sort((a, b) => b.at - a.at) }
export function removeMissed(id: string): MissedCall[] { return write(read().filter((m) => m.id !== id)) }
export function clearMissed(): MissedCall[] { return write([]) }

/** Merge entries in by id — a later record for the same call (e.g. the caller
 *  upgrading a missed call into a call-back request) replaces the earlier one. */
export function addMissed(entries: MissedCall[]): MissedCall[] {
  if (!entries.length) return listMissed()
  const by = new Map(read().map((m) => [m.id, m]))
  for (const e of entries) by.set(e.id, { ...by.get(e.id), ...e })
  return write([...by.values()])
}

/** Take everything the service worker queued and fold it into localStorage.
 *  The IndexedDB contract (name/version/stores) lives in localQueue so the app and
 *  the service worker can't drift apart. */
export async function drainMissedQueue(): Promise<MissedCall[]> {
  return addMissed(await drainQueue<MissedCall>('missed'))
}

/** The device's missed-call list, drained on mount and whenever the service
 *  worker reports a new one (`bis-call-missed`, dispatched by useIncomingCall). */
export function useMissedCalls() {
  const [missed, setMissed] = useState<MissedCall[]>(() => listMissed())
  useEffect(() => {
    let alive = true
    // A new missed call arrived from the service worker → drain the queue.
    const drain = () => { drainMissedQueue().then((l) => { if (alive) setMissed(l) }) }
    // Someone changed the list locally (dismiss/clear, possibly in another
    // component) → just re-read. A plain read, so this can never loop with write().
    const reread = () => { if (alive) setMissed(listMissed()) }
    drain()
    window.addEventListener('bis-call-missed', drain)
    window.addEventListener(CHANGED, reread)
    window.addEventListener('storage', reread) // another tab
    return () => {
      alive = false
      window.removeEventListener('bis-call-missed', drain)
      window.removeEventListener(CHANGED, reread)
      window.removeEventListener('storage', reread)
    }
  }, [])
  const dismiss = useCallback((id: string) => setMissed(removeMissed(id)), [])
  const clear = useCallback(() => setMissed(clearMissed()), [])
  return { missed, dismiss, clear }
}
