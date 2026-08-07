// Which apps this person actually uses, kept on THIS device.
//
// At 192 tools the catalogue is a place you visit once. The three or four you
// came back for are the whole point of the launcher, and until now there was no
// way to reach them except scrolling thirteen sections or typing the name again
// — which is the "personalisation over preferences" principle going unapplied
// in the one place it would pay most.
//
// Nothing is uploaded, and nothing is asked: this is a list of ids we already
// know because the page was open.

import { useCallback, useEffect, useState } from 'react'

const KEY = 'bis-recent-tools'
const EVENT = 'bis-recent-changed'
/** Enough to be useful, short enough to stay a shortcut rather than a list. */
export const MAX_RECENT = 8

export function listRecent(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || '[]')
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && !!x).slice(0, MAX_RECENT) : []
  } catch { return [] }
}

/**
 * Note that a tool was opened. Most recent first, no duplicates.
 *
 * Writes notify (#223): the launcher and the home catalogue are separate
 * components over the same store, so without the event one of them shows a
 * stale list until it happens to remount. The listener re-READS rather than
 * writing, so it cannot loop with this.
 */
export function recordRecent(id: string): void {
  if (!id) return
  const next = [id, ...listRecent().filter((x) => x !== id)].slice(0, MAX_RECENT)
  try { localStorage.setItem(KEY, JSON.stringify(next)) } catch { /* storage full */ }
  try { window.dispatchEvent(new CustomEvent(EVENT)) } catch { /* SSR/prerender */ }
}

export function clearRecent(): void {
  try { localStorage.removeItem(KEY) } catch { /* ignore */ }
  try { window.dispatchEvent(new CustomEvent(EVENT)) } catch { /* ignore */ }
}

export function useRecentTools(): string[] {
  const [ids, setIds] = useState<string[]>([])
  const read = useCallback(() => setIds(listRecent()), [])
  useEffect(() => {
    read()
    window.addEventListener(EVENT, read)
    // Another tab counts too — the same person, the same device.
    window.addEventListener('storage', read)
    return () => {
      window.removeEventListener(EVENT, read)
      window.removeEventListener('storage', read)
    }
  }, [read])
  return ids
}
