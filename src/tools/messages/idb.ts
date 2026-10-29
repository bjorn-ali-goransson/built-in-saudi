// IndexedDB for Messages — a separate database from the service worker's push
// queue (`bis-calls`, see lib/localQueue.ts), so adding a store here can never
// bump a version the worker does not know about.
//
// The service worker DOES read two things from here, read-only: the device's
// identity key and contacts' public keys, so it can decrypt an end-to-end
// sealed push and show the message in the notification. It never writes.

export const DB_NAME = 'bis-messages'
export const DB_VERSION = 1
export const STORES = ['convs', 'msgs', 'blobs', 'outbox', 'kv'] as const
export type StoreName = (typeof STORES)[number]

let dbp: Promise<IDBDatabase> | null = null

export function db(): Promise<IDBDatabase> {
  if (dbp) return dbp
  dbp = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('no-indexeddb'))
    const r = indexedDB.open(DB_NAME, DB_VERSION)
    r.onupgradeneeded = () => {
      const d = r.result
      if (!d.objectStoreNames.contains('convs')) d.createObjectStore('convs', { keyPath: 'id' })
      if (!d.objectStoreNames.contains('msgs')) d.createObjectStore('msgs', { keyPath: 'id' }).createIndex('conv', 'conv')
      if (!d.objectStoreNames.contains('blobs')) d.createObjectStore('blobs', { keyPath: 'id' })
      if (!d.objectStoreNames.contains('outbox')) d.createObjectStore('outbox', { keyPath: 'key' })
      if (!d.objectStoreNames.contains('kv')) d.createObjectStore('kv', { keyPath: 'k' })
    }
    r.onsuccess = () => {
      const d = r.result
      d.onversionchange = () => { d.close(); dbp = null }
      resolve(d)
    }
    r.onerror = () => { dbp = null; reject(r.error) }
  })
  return dbp
}

function req<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error) })
}

export async function getAll<T>(store: StoreName): Promise<T[]> {
  const d = await db()
  return req(d.transaction(store).objectStore(store).getAll()) as Promise<T[]>
}
export async function getByIndex<T>(store: StoreName, index: string, key: IDBValidKey): Promise<T[]> {
  const d = await db()
  return req(d.transaction(store).objectStore(store).index(index).getAll(key)) as Promise<T[]>
}
export async function get<T>(store: StoreName, key: IDBValidKey): Promise<T | undefined> {
  const d = await db()
  return req(d.transaction(store).objectStore(store).get(key)) as Promise<T | undefined>
}
export async function put(store: StoreName, value: unknown): Promise<void> {
  const d = await db()
  const t = d.transaction(store, 'readwrite')
  t.objectStore(store).put(value)
  await new Promise<void>((res, rej) => { t.oncomplete = () => res(); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error) })
}
export async function putMany(store: StoreName, values: unknown[]): Promise<void> {
  if (!values.length) return
  const d = await db()
  const t = d.transaction(store, 'readwrite')
  const os = t.objectStore(store)
  for (const v of values) os.put(v)
  await new Promise<void>((res, rej) => { t.oncomplete = () => res(); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error) })
}
export async function del(store: StoreName, key: IDBValidKey): Promise<void> {
  const d = await db()
  const t = d.transaction(store, 'readwrite')
  t.objectStore(store).delete(key)
  await new Promise<void>((res, rej) => { t.oncomplete = () => res(); t.onerror = () => rej(t.error) })
}
export async function delMany(store: StoreName, keys: IDBValidKey[]): Promise<void> {
  if (!keys.length) return
  const d = await db()
  const t = d.transaction(store, 'readwrite')
  const os = t.objectStore(store)
  for (const k of keys) os.delete(k)
  await new Promise<void>((res, rej) => { t.oncomplete = () => res(); t.onerror = () => rej(t.error) })
}
export async function clearStore(store: StoreName): Promise<void> {
  const d = await db()
  const t = d.transaction(store, 'readwrite')
  t.objectStore(store).clear()
  await new Promise<void>((res, rej) => { t.oncomplete = () => res(); t.onerror = () => rej(t.error) })
}
export async function kvGet<T>(k: string): Promise<T | undefined> {
  const v = await get<{ k: string; v: T }>('kv', k)
  return v?.v
}
export async function kvSet(k: string, v: unknown): Promise<void> { await put('kv', { k, v }) }
