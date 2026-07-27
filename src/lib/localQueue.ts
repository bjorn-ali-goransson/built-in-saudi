// The hand-off between the service worker and the app.
//
// Push payloads (missed calls, direct messages) are never stored on our server —
// the service worker queues them in IndexedDB so they survive with no tab open, and
// the app drains the queue into localStorage when it next runs.
//
// Both sides MUST agree on the database version and the set of stores. They live
// here rather than in each feature so a new store can't bump the version in one
// place and leave the other throwing VersionError. `public/sw.js` opens the same
// name/version and creates the same stores.
const DB = 'bis-calls'
const VERSION = 2
const STORES = ['missed', 'dms'] as const

export type QueueStore = (typeof STORES)[number]

/** Take everything queued in `store` and empty it. Never rejects — a lost record
 *  must not break the caller. */
export function drainQueue<T>(store: QueueStore): Promise<T[]> {
  return new Promise<T[]>((resolve) => {
    let settled = false
    const done = (v: T[]) => { if (!settled) { settled = true; resolve(v) } }
    try {
      if (typeof indexedDB === 'undefined') return done([])
      const open = indexedDB.open(DB, VERSION)
      open.onupgradeneeded = () => {
        const db = open.result
        for (const s of STORES) if (!db.objectStoreNames.contains(s)) db.createObjectStore(s, { keyPath: 'id' })
      }
      open.onerror = () => done([])
      open.onsuccess = () => {
        try {
          const db = open.result
          if (!db.objectStoreNames.contains(store)) return done([])
          const tx = db.transaction(store, 'readwrite')
          const os = tx.objectStore(store)
          const all = os.getAll()
          all.onsuccess = () => { os.clear(); done((all.result || []) as T[]) }
          all.onerror = () => done([])
        } catch { done([]) }
      }
    } catch { done([]) }
  })
}
