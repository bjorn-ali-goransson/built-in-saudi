// Missed "call me" calls (#210), recorded on THIS device only. The relay never
// keeps a call log: the missed-call push carries the record, public/sw.js queues
// it in IndexedDB (so it survives with no tab open), and this drains that queue
// into localStorage — the list the Calls setup screen shows. An entry may carry
// `back` (they asked to be called back, #211) and `from` (their own link code,
// sent whenever they publish one) — the first drives a Call-back button, the
// second lets you save them as a contact.
import { useCallback, useEffect, useState } from 'react'

export interface MissedCall { id: string; name: string; at: number; back?: string; from?: string }

const KEY = 'bis-call-missed'
const MAX = 20
const DB = 'bis-calls'
const STORE = 'missed'

function read(): MissedCall[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || '[]')
    if (!Array.isArray(v)) return []
    return v.filter((m) => m && typeof m.id === 'string').map((m) => ({ id: m.id, name: String(m.name || ''), at: Number(m.at) || 0, back: m.back || undefined, from: m.from || undefined }))
  } catch { return [] }
}
function write(list: MissedCall[]): MissedCall[] {
  const next = [...list].sort((a, b) => b.at - a.at).slice(0, MAX)
  try { localStorage.setItem(KEY, JSON.stringify(next)) } catch { /* storage full */ }
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

/** Take everything the service worker queued and fold it into localStorage. */
export async function drainMissedQueue(): Promise<MissedCall[]> {
  const queued = await new Promise<MissedCall[]>((resolve) => {
    let settled = false
    const done = (v: MissedCall[]) => { if (!settled) { settled = true; resolve(v) } }
    try {
      if (typeof indexedDB === 'undefined') return done([])
      const open = indexedDB.open(DB, 1)
      open.onupgradeneeded = () => {
        const db = open.result
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' })
      }
      open.onerror = () => done([])
      open.onsuccess = () => {
        try {
          const tx = open.result.transaction(STORE, 'readwrite')
          const store = tx.objectStore(STORE)
          const all = store.getAll()
          all.onsuccess = () => { store.clear(); done((all.result || []) as MissedCall[]) }
          all.onerror = () => done([])
        } catch { done([]) }
      }
    } catch { done([]) }
  })
  return addMissed(queued)
}

/** The device's missed-call list, drained on mount and whenever the service
 *  worker reports a new one (`bis-call-missed`, dispatched by useIncomingCall). */
export function useMissedCalls() {
  const [missed, setMissed] = useState<MissedCall[]>(() => listMissed())
  useEffect(() => {
    let alive = true
    const refresh = () => { drainMissedQueue().then((l) => { if (alive) setMissed(l) }) }
    refresh()
    window.addEventListener('bis-call-missed', refresh)
    return () => { alive = false; window.removeEventListener('bis-call-missed', refresh) }
  }, [])
  const dismiss = useCallback((id: string) => setMissed(removeMissed(id)), [])
  const clear = useCallback(() => setMissed(clearMissed()), [])
  return { missed, dismiss, clear }
}
