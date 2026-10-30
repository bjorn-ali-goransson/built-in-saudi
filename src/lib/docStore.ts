// The editors' document library: documents live in THIS browser, in IndexedDB.
//
// Two ways a document can be "saved", and the UI must never blur them:
//
// - **In the browser.** Every edit is written here, so closing the tab loses
//   nothing. This is the editors' own native model (JSON), not a .docx: a
//   conversion on every keystroke would be slow and lossy.
// - **To a file on disk**, the way draw.io works: on browsers with the File
//   System Access API the user opens or saves a real file and we keep its
//   HANDLE, so Ctrl+S writes back to the same `.xlsx` in their Documents folder
//   with no download dialog. A handle is stored in IndexedDB (it is structured-
//   cloneable) and re-asks for permission after a reload — browsers grant
//   write access per session, never forever.
//
// Where the API is missing (Firefox, Safari, every phone) "save to file" is a
// download, and the copy in the browser stays the working copy. Saying which
// one you have is part of the honest version of "your files never leave your
// device".

export type DocKind = 'word' | 'excel' | 'powerpoint'

export interface StoredDoc {
  id: string
  kind: DocKind
  title: string
  createdAt: number
  updatedAt: number
  /** The editor's native model. */
  data: unknown
  /** The file on disk this document is linked to, when there is one. */
  handle?: FileSystemFileHandle
  /** Its file name, for display even when the handle needs re-permission. */
  fileName?: string
  /** A small data-URL preview for the library grid. */
  thumb?: string
  /** Approximate size of `data`, for the storage readout. */
  bytes?: number
  /** What an import could not bring across, shown once when the document is first opened. */
  importLoss?: string[]
}

const DB = 'bis-docs'
const VERSION = 1
const STORE = 'docs'

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('no-indexeddb'))
    const r = indexedDB.open(DB, VERSION)
    r.onupgradeneeded = () => {
      const db = r.result
      if (!db.objectStoreNames.contains(STORE)) {
        const os = db.createObjectStore(STORE, { keyPath: 'id' })
        os.createIndex('kind', 'kind')
      }
    }
    r.onsuccess = () => resolve(r.result)
    r.onerror = () => reject(r.error)
  })
}

function tx<T>(mode: IDBTransactionMode, fn: (os: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  return open().then((db) => new Promise<T | undefined>((resolve, reject) => {
    const t = db.transaction(STORE, mode)
    const os = t.objectStore(STORE)
    const req = fn(os)
    let out: T | undefined
    if (req) req.onsuccess = () => { out = req.result }
    t.oncomplete = () => { db.close(); resolve(out) }
    t.onerror = () => { db.close(); reject(t.error) }
    t.onabort = () => { db.close(); reject(t.error) }
  }))
}

const CHANGED = 'bis-docs-changed'
const notify = () => { try { window.dispatchEvent(new Event(CHANGED)) } catch { /* worker */ } }
export const DOCS_CHANGED = CHANGED

export function newDocId(): string {
  const a = new Uint8Array(9)
  crypto.getRandomValues(a)
  return 'd' + Array.from(a, (b) => b.toString(36).padStart(2, '0')).join('').slice(0, 16)
}

export async function listDocs(kind?: DocKind): Promise<StoredDoc[]> {
  try {
    const all = (await tx<StoredDoc[]>('readonly', (os) => (kind ? os.index('kind').getAll(kind) : os.getAll()))) || []
    return all.sort((a, b) => b.updatedAt - a.updatedAt)
  } catch { return [] }
}
export async function getDoc(id: string): Promise<StoredDoc | null> {
  try { return (await tx<StoredDoc>('readonly', (os) => os.get(id))) || null } catch { return null }
}
export async function putDoc(doc: StoredDoc): Promise<void> {
  const bytes = estimateBytes(doc.data)
  await tx('readwrite', (os) => os.put({ ...doc, bytes }))
  notify()
}
/**
 * Change some fields of the record as it is NOW, in one transaction. For work done
 * beside an open editor (a library rendering a thumbnail): read-modify-write in two
 * transactions would put back a copy of the document from before the editor's save.
 */
export async function patchDoc(id: string, patch: Partial<StoredDoc>): Promise<void> {
  await open().then((db) => new Promise<void>((resolve, reject) => {
    const t = db.transaction(STORE, 'readwrite')
    const os = t.objectStore(STORE)
    const g = os.get(id)
    g.onsuccess = () => {
      if (!g.result) return
      const next = { ...g.result, ...patch }
      for (const [k, v] of Object.entries(patch)) if (v === undefined) delete (next as Record<string, unknown>)[k]
      os.put(next)
    }
    t.oncomplete = () => { db.close(); resolve() }
    t.onerror = () => { db.close(); reject(t.error) }
    t.onabort = () => { db.close(); reject(t.error) }
  }))
  notify()
}
export async function deleteDoc(id: string): Promise<void> {
  await tx('readwrite', (os) => os.delete(id))
  notify()
}
export async function renameDoc(id: string, title: string): Promise<void> {
  const d = await getDoc(id)
  if (!d) return
  await putDoc({ ...d, title, updatedAt: Date.now() })
}
export async function duplicateDoc(id: string, suffix: string): Promise<StoredDoc | null> {
  const d = await getDoc(id)
  if (!d) return null
  const copy: StoredDoc = { ...d, id: newDocId(), title: `${d.title} ${suffix}`.trim(), handle: undefined, fileName: undefined, createdAt: Date.now(), updatedAt: Date.now() }
  await putDoc(copy)
  return copy
}

export function estimateBytes(v: unknown): number {
  try { return JSON.stringify(v)?.length || 0 } catch { return 0 }
}

/** How much the site may store, and how much it uses — so a full disk is a sentence, not a silent failure. */
export async function storageEstimate(): Promise<{ usage: number; quota: number } | null> {
  try {
    const e = await navigator.storage?.estimate?.()
    return e ? { usage: e.usage || 0, quota: e.quota || 0 } : null
  } catch { return null }
}
/** Ask the browser not to evict our documents under storage pressure. */
export async function persistStorage(): Promise<boolean> {
  try { return (await navigator.storage?.persist?.()) || false } catch { return false }
}

// ---- File System Access -------------------------------------------------------

type PickerType = { description: string; accept: Record<string, string[]> }
interface FsWindow {
  showOpenFilePicker?: (o: { types?: PickerType[]; multiple?: boolean; excludeAcceptAllOption?: boolean }) => Promise<FileSystemFileHandle[]>
  showSaveFilePicker?: (o: { suggestedName?: string; types?: PickerType[] }) => Promise<FileSystemFileHandle>
}
const fsw = () => (typeof window !== 'undefined' ? (window as unknown as FsWindow) : {}) as FsWindow

/** True where a document can be linked to a real file and saved back in place. */
export const canLinkFiles = () => typeof fsw().showSaveFilePicker === 'function' && typeof fsw().showOpenFilePicker === 'function'

export const FILE_TYPES: Record<DocKind, PickerType[]> = {
  word: [{ description: 'Word document', accept: { 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'] } }],
  excel: [
    { description: 'Excel workbook', accept: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx', '.xlsm'] } },
    { description: 'CSV', accept: { 'text/csv': ['.csv', '.tsv'] } },
  ],
  powerpoint: [{ description: 'PowerPoint presentation', accept: { 'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'] } }],
}
export const EXT: Record<DocKind, string> = { word: '.docx', excel: '.xlsx', powerpoint: '.pptx' }

/** Open a file through the picker, keeping its handle. Null when cancelled or unsupported. */
export async function pickFiles(kind: DocKind): Promise<{ file: File; handle: FileSystemFileHandle }[] | null> {
  const p = fsw().showOpenFilePicker
  if (!p) return null
  try {
    const hs = await p({ types: FILE_TYPES[kind], multiple: true })
    return Promise.all(hs.map(async (handle) => ({ file: await handle.getFile(), handle })))
  } catch { return null }
}

/** Ask where to save; returns the new handle. Null when cancelled or unsupported. */
export async function pickSaveTarget(kind: DocKind, suggestedName: string): Promise<FileSystemFileHandle | null> {
  const p = fsw().showSaveFilePicker
  if (!p) return null
  try { return await p({ suggestedName: ensureExt(suggestedName, EXT[kind]), types: FILE_TYPES[kind].slice(0, 1) }) } catch { return null }
}

type PermHandle = FileSystemFileHandle & {
  queryPermission?: (o: { mode: 'read' | 'readwrite' }) => Promise<PermissionState>
  requestPermission?: (o: { mode: 'read' | 'readwrite' }) => Promise<PermissionState>
}
/** True when we may write to the file now, without asking (no user gesture needed). */
export async function hasWriteAccess(h: FileSystemFileHandle): Promise<boolean> {
  const ph = h as PermHandle
  try { return !ph.queryPermission || (await ph.queryPermission({ mode: 'readwrite' })) === 'granted' } catch { return false }
}
/** Browsers grant write access per session: re-ask, which needs a user gesture. */
export async function ensureWritable(h: FileSystemFileHandle): Promise<boolean> {
  const ph = h as PermHandle
  try {
    if (!ph.queryPermission) return true
    if ((await ph.queryPermission({ mode: 'readwrite' })) === 'granted') return true
    return (await ph.requestPermission?.({ mode: 'readwrite' })) === 'granted'
  } catch { return false }
}

/** Write a blob to a linked file, replacing its contents. */
export async function writeToHandle(h: FileSystemFileHandle, blob: Blob): Promise<boolean> {
  try {
    if (!(await ensureWritable(h))) return false
    const w = await (h as FileSystemFileHandle & { createWritable: () => Promise<FileSystemWritableFileStream> }).createWritable()
    await w.write(blob)
    await w.close()
    return true
  } catch { return false }
}

export function ensureExt(name: string, ext: string): string {
  const clean = (name || 'Untitled').replace(/[\\/:*?"<>|\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120) || 'Untitled'
  return clean.toLowerCase().endsWith(ext) ? clean : clean + ext
}
/**
 * A file's name as a document title. Every extension the editors open is listed:
 * an .ods opened with a shorter list became a sheet titled "budget.ods", which
 * downloads as "budget.ods.xlsx".
 */
export function stripExt(name: string): string { return name.replace(/\.(docx|docm|dotx|odt|xlsx|xlsm|ods|pptx|pptm|potx|ppsx|odp|csv|tsv|txt|md|markdown|html?|json)$/i, '') }

/** Plain download — the fallback where files cannot be linked. */
export function download(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

// ---- file handles a site was LAUNCHED with ---------------------------------------
// An installed PWA that declares file_handlers can be opened FROM the OS ("Open
// with…"). The launch queue hands us the handle; the editor treats it exactly like
// a picked file.
type LaunchParams = { files: FileSystemFileHandle[] }
export function onLaunchFiles(cb: (h: FileSystemFileHandle) => void): void {
  const lq = (window as unknown as { launchQueue?: { setConsumer: (f: (p: LaunchParams) => void) => void } }).launchQueue
  try { lq?.setConsumer((p) => { for (const f of p.files || []) cb(f) }) } catch { /* */ }
}
