// Call history (#231): every call this device took part in, saved as a conversation
// entry on the Calls start screen. Kept on THIS device only — exactly like contacts,
// missed calls and DMs, nothing reaches a server. An entry is who was on the call,
// when it started, and how long it lasted.
//
// Deliberately NOT stored: the in-call chat transcript. Chat is peer-to-peer and
// discarded when the call ends today; keeping it would change what the tool retains,
// so history records only who/when/duration and leaves the transcript ephemeral.
import { useCallback, useEffect, useState } from 'react'

export interface CallLog {
  id: string
  at: number // when the call started (ms epoch)
  end: number // when it ended (ms epoch)
  role: 'host' | 'guest'
  names: string[] // the other participants seen during the call
}

const KEY = 'bis-call-history'
const MAX = 50
// Every writer announces itself so a second view over the same store stays in sync
// (mirrors missedCalls.ts / contacts.ts) — a plain re-read, so it can't loop with write.
const CHANGED = 'bis-callhist-changed'

function read(): CallLog[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || '[]')
    if (!Array.isArray(v)) return []
    return v
      .filter((m) => m && typeof m.id === 'string')
      .map((m) => ({
        id: m.id, at: Number(m.at) || 0, end: Number(m.end) || 0,
        role: m.role === 'host' ? 'host' as const : 'guest' as const,
        names: Array.isArray(m.names) ? m.names.filter((n: unknown) => typeof n === 'string') : [],
      }))
  } catch { return [] }
}

function write(list: CallLog[]): CallLog[] {
  const next = [...list].sort((a, b) => b.at - a.at).slice(0, MAX)
  try { localStorage.setItem(KEY, JSON.stringify(next)) } catch { /* storage full */ }
  try { window.dispatchEvent(new Event(CHANGED)) } catch { /* */ }
  return next
}

export function listHistory(): CallLog[] { return read().sort((a, b) => b.at - a.at) }
export function removeCall(id: string): CallLog[] { return write(read().filter((m) => m.id !== id)) }
export function clearHistory(): CallLog[] { return write([]) }

/** Record a finished call. Merges by id so a re-record (e.g. an unmount after the
 *  end screen already saved it) can't create a duplicate. */
export function addCall(entry: CallLog): CallLog[] {
  const by = new Map(read().map((m) => [m.id, m]))
  by.set(entry.id, { ...by.get(entry.id), ...entry })
  return write([...by.values()])
}

/** Live view of the history, re-read on any local change (this or another tab). */
export function useCallHistory() {
  const [history, setHistory] = useState<CallLog[]>(() => listHistory())
  useEffect(() => {
    let alive = true
    const reread = () => { if (alive) setHistory(listHistory()) }
    window.addEventListener(CHANGED, reread)
    window.addEventListener('storage', reread)
    return () => { alive = false; window.removeEventListener(CHANGED, reread); window.removeEventListener('storage', reread) }
  }, [])
  const remove = useCallback((id: string) => setHistory(removeCall(id)), [])
  const clear = useCallback(() => setHistory(clearHistory()), [])
  return { history, remove, clear }
}
