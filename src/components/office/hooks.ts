// The two halves every office editor needs and none of them should write twice:
// keeping the document saved (in the browser, and in a linked file on disk), and
// sharing it live with other browsers.
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  putDoc, ensureWritable, hasWriteAccess, pickSaveTarget, writeToHandle, download, ensureExt, canLinkFiles,
  estimateBytes, type DocKind, type StoredDoc,
} from '../../lib/docStore'
import { setWorkInProgress } from '../../lib/workInProgress'
import { Mesh, randomId, type MeshHandlers } from '../../lib/p2p/mesh'
import { CollabSession, type CollabAdapter, type Member, type Role, type SessionState } from '../../lib/collab/session'

export interface OfficeFormat { ext: string; label: string }

/** What an editor tells the shell about itself. */
export interface EditorKit<D> {
  kind: DocKind
  /** The tool id, for invite links. */
  tool: string
  /** Formats it can write; the first is what "Save to a file" writes. */
  formats: OfficeFormat[]
  /** Extensions the open dialog and drop zone accept. */
  accepts: string[]
  exportAs(data: D, ext: string, title: string): Promise<{ blob: Blob; loss: string[] }>
  importFile(file: File): Promise<{ data: D; loss: string[]; title?: string }>
  blank(): D
  thumb?(data: D): string | undefined
}

export type SaveStatus = 'saved' | 'unsaved' | 'saving' | 'error'

const extOf = (name: string) => (name.match(/\.[a-z0-9]+$/i)?.[0] || '').toLowerCase()

/**
 * Autosave to IndexedDB after every change, and — when the document is linked to
 * a file — back to that file too, which is the draw.io model: the file on disk IS
 * the document, and saving writes it in place rather than producing a download.
 *
 * Writing to the file needs permission the browser grants per session, and
 * granting it needs a click. So autosave writes to the file only while
 * permission is already held; Ctrl+S (a gesture) asks for it.
 */
export function usePersistence<D>(opts: {
  doc: StoredDoc | null
  kit: EditorKit<D>
  getData: () => D
  rev: number
  /** A guest's view of somebody else's document is not saved anywhere. */
  disabled?: boolean
  onLoss?: (loss: string[], dir: 'export') => void
}) {
  const { kit, getData, rev, disabled } = opts
  const docRef = useRef(opts.doc)
  docRef.current = opts.doc
  const [status, setStatus] = useState<SaveStatus>('saved')
  const [fileName, setFileName] = useState<string | undefined>(opts.doc?.fileName)
  const [needsPermission, setNeedsPermission] = useState(false)
  const handleRef = useRef<FileSystemFileHandle | undefined>(opts.doc?.handle)
  const firstRev = useRef(rev)
  const key = `office-${opts.doc?.id || 'none'}`
  const idbTimer = useRef<number>()
  const fileTimer = useRef<number>()
  const onLoss = useRef(opts.onLoss)
  onLoss.current = opts.onLoss

  useEffect(() => { handleRef.current = opts.doc?.handle; setFileName(opts.doc?.fileName) }, [opts.doc?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const writeIdb = useCallback(async () => {
    const d = docRef.current
    if (!d || disabled) return
    const data = getData()
    const next: StoredDoc = { ...d, data, updatedAt: Date.now(), bytes: estimateBytes(data), thumb: kit.thumb?.(data) ?? d.thumb, handle: handleRef.current, fileName: handleRef.current?.name }
    docRef.current = next
    await putDoc(next)
  }, [disabled, getData, kit])

  const writeFile = useCallback(async (h: FileSystemFileHandle, ask: boolean): Promise<boolean> => {
    if (!(ask ? await ensureWritable(h) : await hasWriteAccess(h))) { setNeedsPermission(true); return false }
    setNeedsPermission(false)
    const d = docRef.current
    const ext = extOf(h.name) || kit.formats[0].ext
    const fmt = kit.formats.find((f) => f.ext === ext) ? ext : kit.formats[0].ext
    const { blob, loss } = await kit.exportAs(getData(), fmt, d?.title || 'document')
    if (ask && loss.length) onLoss.current?.(loss, 'export')
    return writeToHandle(h, blob)
  }, [getData, kit])

  // Every change: mark dirty, then save shortly after the typing stops.
  useEffect(() => {
    if (rev === firstRev.current || disabled || !docRef.current) return
    setStatus('unsaved')
    setWorkInProgress(key, true)
    window.clearTimeout(idbTimer.current)
    idbTimer.current = window.setTimeout(async () => {
      setStatus('saving')
      try {
        await writeIdb()
        const h = handleRef.current
        if (h) {
          window.clearTimeout(fileTimer.current)
          fileTimer.current = window.setTimeout(() => { void writeFile(h, false) }, 1500)
        }
        setStatus('saved')
        setWorkInProgress(key, false)
      } catch { setStatus('error') }
    }, 600)
  }, [rev]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => { window.clearTimeout(idbTimer.current); setWorkInProgress(key, false) }, [key])

  // Leaving with a save pending: flush it.
  useEffect(() => {
    const flush = () => { if (idbTimer.current) { window.clearTimeout(idbTimer.current); void writeIdb() } }
    window.addEventListener('pagehide', flush)
    return () => { window.removeEventListener('pagehide', flush); flush() }
  }, [writeIdb])

  const link = useCallback(async (): Promise<boolean> => {
    const d = docRef.current
    const h = await pickSaveTarget(kit.kind, d?.title || 'document')
    if (!h) return false
    handleRef.current = h
    setFileName(h.name)
    setStatus('saving')
    const ok = await writeFile(h, true)
    await writeIdb()
    setStatus(ok ? 'saved' : 'error')
    return ok
  }, [kit, writeFile, writeIdb])

  /** Ctrl+S. To the linked file when there is one; otherwise link one (or download where linking is impossible). */
  const save = useCallback(async () => {
    window.clearTimeout(idbTimer.current)
    setStatus('saving')
    try {
      await writeIdb()
      const h = handleRef.current
      if (h) setStatus((await writeFile(h, true)) ? 'saved' : 'error')
      else if (canLinkFiles()) { if (!(await link())) setStatus('saved') }
      else setStatus('saved')
      setWorkInProgress(key, false)
    } catch { setStatus('error') }
  }, [key, link, writeFile, writeIdb])

  const unlink = useCallback(async () => {
    handleRef.current = undefined
    setFileName(undefined)
    await writeIdb()
  }, [writeIdb])

  const exportDownload = useCallback(async (ext: string): Promise<string[]> => {
    const d = docRef.current
    const title = d?.title || 'document'
    const { blob, loss } = await kit.exportAs(getData(), ext, title)
    download(blob, ensureExt(title, ext))
    return loss
  }, [getData, kit])

  return { status, fileName, needsPermission, save, link, unlink, exportDownload, flush: writeIdb }
}

// ---- collaboration -------------------------------------------------------------

const NAME_KEY = 'bis-office-name'
export function defaultName(): string {
  try {
    const n = localStorage.getItem(NAME_KEY)
    if (n) return n
  } catch { /* */ }
  return `Guest ${Math.floor(100 + Math.random() * 900)}`
}
export function rememberName(n: string) { try { localStorage.setItem(NAME_KEY, n) } catch { /* */ } }

export interface ChatLine { client: string; name: string; text: string; at: number }

type Bindable = CollabAdapter & { bind(s: CollabSession | null): void }

export function inviteUrl(tool: string, room: string): string {
  const base = location.pathname.replace(/\/?$/, '/').replace(/\/(join|edit)\/?$/, '/')
  void tool
  return `${location.origin}${base}?join=${encodeURIComponent(room)}`
}

/**
 * A live session over a WebRTC mesh. The OWNER's document is the truth: guests
 * send edits to it, it sequences them, and everybody — owner included — applies
 * the same commits in the same order.
 */
export function useCollab(opts: { adapter: Bindable | null; kind: DocKind; title: string; onMeta?: (m: { title: string; kind: string }) => void }) {
  const [session, setSession] = useState<CollabSession | null>(null)
  const [state, setState] = useState<SessionState | 'off'>('off')
  const [roster, setRoster] = useState<Member[]>([])
  const [chat, setChat] = useState<ChatLine[]>([])
  const [unread, setUnread] = useState(0)
  const [role, setRoleState] = useState<Role | 'owner' | null>(null)
  const [presence, setPresence] = useState<Record<string, { d: unknown; at: number }>>({})
  const [room, setRoom] = useState('')
  const [refusedBy, setRefusedBy] = useState('')
  const [name, setNameState] = useState(defaultName)
  const meshRef = useRef<Mesh | null>(null)
  const sessRef = useRef<CollabSession | null>(null)
  const metaRef = useRef(opts.onMeta)
  metaRef.current = opts.onMeta
  const adapterRef = useRef(opts.adapter)
  adapterRef.current = opts.adapter

  const begin = useCallback((r: string, owner: boolean, defaultRole: Role = 'edit') => {
    const a = adapterRef.current
    if (!a) return
    sessRef.current?.stop()
    meshRef.current?.stop()
    const h: MeshHandlers = {}
    const mesh = new Mesh(r, h)
    const s = new CollabSession(mesh, a, {
      onState: (st) => { setState(st); if (st !== 'live' && st !== 'connecting') setPresence({}) },
      onRoster: (m) => {
        setRoster(m)
        setPresence((p) => { const keep: typeof p = {}; for (const x of m) if (p[x.client]) keep[x.client] = p[x.client]; return keep })
      },
      onPresence: (client, d) => setPresence((p) => ({ ...p, [client]: { d, at: Date.now() } })),
      onRole: (ro) => setRoleState(ro),
      onChat: (m) => { setChat((c) => [...c.slice(-199), m]); if (m.client !== mesh.me) setUnread((u) => u + 1) },
      onRefused: (client) => { setRefusedBy(s.nameOf(client)?.name || client); window.setTimeout(() => setRefusedBy(''), 4000) },
      onMeta: (m) => metaRef.current?.(m),
    }, { owner, name: defaultName(), title: opts.title, kind: opts.kind, defaultRole })
    Object.assign(h, s.handlers())
    a.bind(s)
    meshRef.current = mesh
    sessRef.current = s
    setSession(s)
    setRoom(r)
    setRoleState(owner ? 'owner' : null)
    setState(owner ? 'live' : 'connecting')
    setRoster(s.roster())
    s.start()
  }, [opts.kind, opts.title])

  const host = useCallback((defaultRole: Role = 'edit') => { const r = 'od' + randomId(14); begin(r, true, defaultRole); return r }, [begin])
  const join = useCallback((r: string) => begin(r, false), [begin])
  const end = useCallback(() => {
    sessRef.current?.stop()
    adapterRef.current?.bind(null)
    sessRef.current = null
    meshRef.current = null
    setSession(null)
    setState('off')
    setRoster([])
    setPresence({})
    setRoom('')
  }, [])

  // A guest whose owner left is no longer bound to anyone: the doc becomes local.
  useEffect(() => {
    if (state === 'owner-left' || state === 'ended' || state === 'kicked') adapterRef.current?.bind(null)
  }, [state])

  useEffect(() => () => { sessRef.current?.stop(); adapterRef.current?.bind(null) }, [])

  const lastPresence = useRef(0)
  const pendingPresence = useRef<number>()
  const sendPresence = useCallback((d: unknown) => {
    const s = sessRef.current
    if (!s) return
    const now = Date.now()
    window.clearTimeout(pendingPresence.current)
    if (now - lastPresence.current > 120) { lastPresence.current = now; s.presence(d) }
    else pendingPresence.current = window.setTimeout(() => { lastPresence.current = Date.now(); s.presence(d) }, 120)
  }, [])

  const setName = useCallback((n: string) => { setNameState(n); rememberName(n) }, [])

  return {
    session, state, roster, chat, unread, clearUnread: () => setUnread(0), role, presence, room, refusedBy, name, setName,
    host, join, end,
    me: meshRef.current?.me || '',
    setRole: (c: string, r: Role) => sessRef.current?.setRole(c, r),
    kick: (c: string) => sessRef.current?.kick(c),
    sendChat: (t: string) => sessRef.current?.chat(t),
    sendPresence,
    resnapshot: () => sessRef.current?.resnapshot(),
    canEdit: !sessRef.current || sessRef.current.canEdit || state === 'owner-left' || state === 'ended' || state === 'kicked',
    isGuest: !!sessRef.current && !sessRef.current.isOwner,
  }
}
export type Collab = ReturnType<typeof useCollab>
