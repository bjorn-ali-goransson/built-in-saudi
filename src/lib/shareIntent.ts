// Handing something from one tool to Messages: a copy of a document, or the
// link to a live editing session.
//
// The editor opens Messages in a NEW TAB rather than navigating there, because
// leaving the page would end a live session the owner is hosting — and that
// tab has to be told what to send. A URL cannot carry a 20MB workbook and
// sessionStorage is not shared with a new tab, so the payload waits here, in
// IndexedDB, under a random id that rides the URL (`?share=<id>`).
//
// Its own database, not one of the existing ones, so adding it can never bump a
// version another part of the site (or the service worker) has opened. An
// intent is TAKEN — read and deleted — so a reload of the Messages tab does not
// offer to send it twice, and anything older than ten minutes is discarded.
const DB = 'bis-share'
const STORE = 'intents'
const MAX_AGE = 10 * 60_000

export type ShareIntent =
  | { kind: 'file'; name: string; blob: Blob }
  | { kind: 'doc'; doc: { kind: string; title: string; url: string } }
type Stored = ShareIntent & { id: string; at: number }

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(DB, 1)
    r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains(STORE)) r.result.createObjectStore(STORE, { keyPath: 'id' }) }
    r.onsuccess = () => resolve(r.result)
    r.onerror = () => reject(r.error)
  })
}

export async function putIntent(intent: ShareIntent): Promise<string> {
  const id = Array.from(crypto.getRandomValues(new Uint8Array(9)), (b) => b.toString(36).padStart(2, '0')).join('').slice(0, 16)
  const db = await open()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    const store = tx.objectStore(STORE)
    // Sweep what was never collected (the tab was closed before it loaded).
    const all = store.getAll()
    all.onsuccess = () => { for (const x of all.result as Stored[]) if (Date.now() - x.at > MAX_AGE) store.delete(x.id) }
    store.put({ ...intent, id, at: Date.now() } satisfies Stored)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
  return id
}

/** Read and delete. Null when it is unknown, already taken, or stale. */
export async function takeIntent(id: string): Promise<ShareIntent | null> {
  if (!/^[a-z0-9]{6,32}$/.test(id)) return null
  try {
    const db = await open()
    const got = await new Promise<Stored | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      const store = tx.objectStore(STORE)
      const g = store.get(id)
      g.onsuccess = () => { if (g.result) store.delete(id) }
      tx.oncomplete = () => resolve(g.result as Stored | undefined)
      tx.onerror = () => reject(tx.error)
    })
    db.close()
    if (!got || Date.now() - got.at > MAX_AGE) return null
    if (got.kind === 'file') return { kind: 'file', name: got.name, blob: got.blob }
    return { kind: 'doc', doc: got.doc }
  } catch { return null }
}

/**
 * Open Messages in a new tab with something to send. The tab is opened FIRST,
 * synchronously inside the click, because a popup blocker only allows
 * `window.open` there — and preparing a file is asynchronous. Returns false when
 * the tab could not be opened.
 */
export function sendToMessages(locale: 'en' | 'ar', make: () => Promise<ShareIntent>): boolean {
  const w = window.open('', '_blank')
  if (!w) return false
  void (async () => {
    try {
      const id = await putIntent(await make())
      w.location.href = `/${locale}/apps/messages/?share=${id}`
    } catch { w.close() }
  })()
  return true
}
