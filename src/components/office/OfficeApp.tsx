// The frame every office tool shares: a library of the documents kept in this
// browser, and the editor for whichever one is open. The URL says which (?doc=),
// so Back closes the editor and a reload reopens it; ?join= opens somebody
// else's live document.
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useLocale } from '../../i18n'
import {
  listDocs, getDoc, putDoc, deleteDoc, renameDoc, duplicateDoc, newDocId, storageEstimate, persistStorage,
  pickFiles, patchDoc, canLinkFiles, onLaunchFiles, stripExt, download, ensureExt, estimateBytes, DOCS_CHANGED,
  type StoredDoc,
} from '../../lib/docStore'
import { OfficeError, importErrorText } from '../../lib/office/officeClient'
import { Button, Input, Sheet, SheetTitle, SheetActions } from '../ui'
import { UploadIcon, KebabIcon, FileIcon, LinkIcon } from '../icons'
import { OFFICE_STR, fmtBytes, type OfficeStr } from './strings'
import { LossDialog } from './EditorShell'
import { THUMB_MIN_SIDE } from './print'
import type { EditorKit } from './hooks'
import { NameField } from './CollabPanel'
import { defaultName, rememberName } from './hooks'

export interface EditorProps<D> {
  locale: 'en' | 'ar'
  kit: EditorKit<D>
  /** The stored document — null for a guest in somebody else's session. */
  doc: StoredDoc | null
  joinRoom?: string
  onBack: () => void
  /** Keep a copy of what is on screen as a new document of one's own. */
  onSaveCopy: (data: D, title: string) => Promise<void>
  /** Loss from the import that created this document, to show once. */
  importLoss?: string[]
}

export interface Template<D> { id: string; label: string; make: () => D }

export const MAX_FILE = 200 * 1024 * 1024

/**
 * One file on its way into the library. It is on screen from the moment it is
 * picked, says which phase it is in, and leaves when its document card can stand
 * in for it — so a batch of twelve is twelve cards filling in, not a frozen page.
 */
export interface ImportJob {
  key: string
  name: string
  state: 'queued' | 'converting' | 'preview' | 'error'
  error?: string
  docId?: string
}
type Pending = { key: string; file: File; handle?: FileSystemFileHandle; open: boolean }

export function OfficeApp<D>({ kit, Editor, templates = [], blurb }: {
  kit: EditorKit<D>
  Editor: (p: EditorProps<D>) => ReactNode
  templates?: Template<D>[]
  blurb?: ReactNode
}) {
  const { locale } = useLocale()
  const loc = locale === 'ar' ? 'ar' : 'en'
  const s = OFFICE_STR[loc]
  const [params, setParams] = useSearchParams()
  const docId = params.get('doc')
  const join = params.get('join')
  const [doc, setDoc] = useState<StoredDoc | null>(null)
  const [jobs, setJobs] = useState<ImportJob[]>([])
  const [batch, setBatch] = useState({ done: 0, all: 0 })
  const queue = useRef<Pending[]>([])
  const running = useRef(false)
  const docIdRef = useRef(docId)
  docIdRef.current = docId
  const [loss, setLoss] = useState<{ id: string; loss: string[] } | null>(null)
  const [joinConfirmed, setJoinConfirmed] = useState(false)

  const open = useCallback((id: string) => setParams((p) => { const n = new URLSearchParams(p); n.set('doc', id); n.delete('join'); return n }), [setParams])
  const close = useCallback(() => setParams((p) => { const n = new URLSearchParams(p); n.delete('doc'); n.delete('join'); return n }), [setParams])

  useEffect(() => {
    let live = true
    if (!docId) { setDoc(null); return }
    void getDoc(docId).then((d) => {
      if (!live) return
      if (!d || d.kind !== kit.kind) { close(); return }
      // What the import could not bring across is told once, on the first open.
      if (d.importLoss?.length) { setLoss({ id: d.id, loss: d.importLoss }); void patchDoc(d.id, { importLoss: undefined }); d = { ...d, importLoss: undefined } }
      setDoc(d)
    })
    return () => { live = false }
  }, [docId]) // eslint-disable-line react-hooks/exhaustive-deps

  const create = useCallback(async (data: D, title: string, extra?: Partial<StoredDoc>): Promise<StoredDoc> => {
    const d: StoredDoc = { id: newDocId(), kind: kit.kind, title, createdAt: Date.now(), updatedAt: Date.now(), data, bytes: estimateBytes(data), thumb: kit.thumb?.(data), ...extra }
    await putDoc(d)
    return d
  }, [kit])

  const setJob = (key: string, patch: Partial<ImportJob> | null) =>
    setJobs((js) => (patch ? js.map((j) => (j.key === key ? { ...j, ...patch } : j)) : js.filter((j) => j.key !== key)))

  // One file at a time through the worker: a batch of large files converted at once would
  // hold every one of them in memory together, and finish no sooner.
  const run = useCallback(async () => {
    if (running.current) return
    running.current = true
    try {
      for (let it = queue.current.shift(); it; it = queue.current.shift()) {
        const { key, file, handle } = it
        if (file.size > MAX_FILE) { setJob(key, { state: 'error', error: s.fileTooBig }); setBatch((b) => ({ ...b, done: b.done + 1 })); continue }
        setJob(key, { state: 'converting' })
        try {
          const r = await kit.importFile(file)
          const d = await create(r.data, r.title || stripExt(file.name), { ...(handle ? { handle, fileName: handle.name } : {}), ...(r.loss.length ? { importLoss: r.loss } : {}) })
          setBatch((b) => ({ ...b, done: b.done + 1 }))
          // A single file opens, as it always did; one of many does not — the reader asked for
          // a library full of documents, not to be taken into whichever finished first.
          if (it.open && !docIdRef.current) { setJob(key, null); open(d.id); continue }
          setJob(key, { state: 'preview', docId: d.id })
          try {
            const t = await kit.renderThumb?.(r.data)
            if (t) await patchDoc(d.id, { thumb: t })
          } catch { /* the sketch stays; a preview is never worth an error */ }
          setJob(key, null)
        } catch (e) {
          setJob(key, { state: 'error', error: e instanceof OfficeError ? importErrorText(e.code, loc) : importErrorText('', loc) })
          setBatch((b) => ({ ...b, done: b.done + 1 }))
        }
      }
    } finally { running.current = false }
  }, [create, kit, loc, open, s])

  const importFiles = useCallback((items: { file: File; handle?: FileSystemFileHandle }[]) => {
    if (!items.length) return
    const first = !queue.current.length && !running.current
    const added = items.map((x, i) => ({ ...x, key: `${Date.now()}-${Math.random().toString(36).slice(2)}-${i}`, open: first && items.length === 1 }))
    setJobs((js) => [...js.filter((j) => j.state !== 'error'), ...added.map((x) => ({ key: x.key, name: x.file.name, state: 'queued' as const }))])
    setBatch((b) => (first ? { done: 0, all: added.length } : { ...b, all: b.all + added.length }))
    queue.current.push(...added)
    void run()
  }, [run])
  const importFile = useCallback((file: File, handle?: FileSystemFileHandle) => importFiles([{ file, handle }]), [importFiles])

  // Opened from the OS ("Open with…") once installed as an app.
  useEffect(() => { onLaunchFiles(async (h) => importFile(await h.getFile(), h)) }, [importFile])

  // Drop a file anywhere on the library.
  const [drag, setDrag] = useState(false)
  useEffect(() => {
    if (docId || join) return
    const over = (e: DragEvent) => { if (e.dataTransfer?.types.includes('Files')) { e.preventDefault(); setDrag(true) } }
    const leave = (e: DragEvent) => { if (!e.relatedTarget) setDrag(false) }
    const drop = (e: DragEvent) => { e.preventDefault(); setDrag(false); importFiles([...(e.dataTransfer?.files || [])].map((file) => ({ file }))) }
    window.addEventListener('dragover', over)
    window.addEventListener('dragleave', leave)
    window.addEventListener('drop', drop)
    return () => { window.removeEventListener('dragover', over); window.removeEventListener('dragleave', leave); window.removeEventListener('drop', drop) }
  }, [docId, join, importFiles])

  const saveCopy = useCallback(async (data: D, title: string) => {
    const d = await create(data, title)
    open(d.id)
  }, [create, open])

  if (join && joinConfirmed) {
    return <Editor key={'join-' + join} locale={loc} kit={kit} doc={null} joinRoom={join} onBack={close} onSaveCopy={saveCopy} />
  }
  if (join) return <JoinGate s={s} onJoin={() => setJoinConfirmed(true)} onCancel={close} />
  if (docId && doc) {
    return (
      <Editor
        key={doc.id}
        locale={loc}
        kit={kit}
        doc={doc}
        onBack={close}
        onSaveCopy={saveCopy}
        importLoss={loss && loss.id === doc.id ? loss.loss : undefined}
      />
    )
  }
  return (
    <>
      <Library
        kit={kit}
        s={s}
        locale={loc}
        templates={templates}
        blurb={blurb}
        onOpen={open}
        onNew={async (t) => { const d = await create(t ? t.make() : kit.blank(), t && t.id !== 'blank' ? t.label : s.untitled); open(d.id) }}
        onImport={importFiles}
        jobs={jobs}
        batch={batch}
        onDismiss={(k) => setJob(k, null)}
      />
      {drag && <div className="fixed inset-0 z-[60] grid place-items-center pointer-events-none bg-[color-mix(in_srgb,var(--color-green-600)_14%,transparent)] border-4 border-dashed border-green-600" data-testid="office-drop"><div className="px-5 py-3 rounded-md bg-[var(--surface)] font-semibold">{s.dropHere}</div></div>}
      {loss && !docId && <LossDialog locale={loc} loss={loss.loss} dir="import" onClose={() => setLoss(null)} />}
    </>
  )
}

function JoinGate({ s, onJoin, onCancel }: { s: OfficeStr; onJoin: () => void; onCancel: () => void }) {
  const [name, setName] = useState(defaultName)
  const fake = { name, setName: (n: string) => { setName(n); rememberName(n) } } as unknown as Parameters<typeof NameField>[0]['collab']
  return (
    <div className="max-w-[460px] mx-auto py-8 space-y-4" data-testid="office-join">
      <h2 className="font-display rtl:font-ar text-[1.4rem] font-semibold">{s.joinTitle}</h2>
      <p className="text-ink-soft text-[0.95rem]">{s.joinIntro}</p>
      <NameField s={s} collab={fake} />
      <div className="flex gap-2">
        <Button variant="primary" onClick={() => { rememberName(name); onJoin() }} data-testid="office-join-go">{s.joinBtn}</Button>
        <Button onClick={onCancel}>{s.back}</Button>
      </div>
    </div>
  )
}

function Library<D>({ kit, s, locale, templates, blurb, onOpen, onNew, onImport, jobs, batch, onDismiss }: {
  kit: EditorKit<D>; s: OfficeStr; locale: 'en' | 'ar'; templates: Template<D>[]; blurb?: ReactNode
  onOpen: (id: string) => void; onNew: (t?: Template<D>) => void; onImport: (items: { file: File; handle?: FileSystemFileHandle }[]) => void
  jobs: ImportJob[]; batch: { done: number; all: number }; onDismiss: (key: string) => void
}) {
  const [docs, setDocs] = useState<StoredDoc[] | null>(null)
  const [est, setEst] = useState<{ usage: number; quota: number } | null>(null)
  const [persisted, setPersisted] = useState(false)
  const [renaming, setRenaming] = useState<StoredDoc | null>(null)
  const [menu, setMenu] = useState<string | null>(null)
  const [confirmDel, setConfirmDel] = useState<StoredDoc | null>(null)
  const input = useRef<HTMLInputElement>(null)

  const refresh = useCallback(() => {
    void listDocs(kit.kind).then(setDocs)
    void storageEstimate().then(setEst)
  }, [kit.kind])
  useEffect(() => {
    refresh()
    void navigator.storage?.persisted?.().then(setPersisted).catch(() => {})
    window.addEventListener(DOCS_CHANGED, refresh)
    return () => window.removeEventListener(DOCS_CHANGED, refresh)
  }, [refresh])

  // Cards drawn before thumbnails carried phone resolution, or never drawn at all (only the
  // sketch), are redrawn once, one at a time, in the background.
  const redrawn = useRef(new Set<string>())
  useEffect(() => {
    const render = kit.renderThumb
    if (!docs || !render) return
    let live = true
    void (async () => {
      for (const d of docs) {
        if (!live) return
        if (redrawn.current.has(d.id) || jobs.some((j) => j.docId === d.id)) continue
        redrawn.current.add(d.id)
        if (d.thumb?.startsWith('data:image/jpeg') && (await shortSide(d.thumb)) >= THUMB_MIN_SIDE * 0.9) continue
        await new Promise((r) => setTimeout(r, 50))
        const fresh = await getDoc(d.id)
        if (!live || !fresh) continue
        try { const t = await render(fresh.data as D); if (t) await patchDoc(d.id, { thumb: t }) } catch { /* the card keeps what it had */ }
      }
    })()
    return () => { live = false }
  }, [docs, kit]) // eslint-disable-line react-hooks/exhaustive-deps

  const openPicker = async () => {
    if (canLinkFiles()) {
      const r = await pickFiles(kit.kind)
      if (r) onImport(r)
      return
    }
    input.current?.click()
  }

  const fmtDate = (t: number) => new Intl.DateTimeFormat(locale === 'ar' ? 'ar-SA' : 'en', { dateStyle: 'medium', timeStyle: 'short' }).format(t)

  return (
    <div className="space-y-6" data-testid="office-library">
      {blurb}
      <section>
        <h3 className="text-[0.8rem] font-semibold uppercase tracking-wide rtl:tracking-normal text-ink-soft mb-2">{s.templates}</h3>
        <div className="flex flex-wrap gap-3">
          <TileButton testid="office-new" onClick={() => onNew()} label={s.blank} big><span className="text-[2rem] leading-none text-green-600">+</span></TileButton>
          {templates.map((t) => (
            <TileButton key={t.id} testid={`office-template-${t.id}`} onClick={() => onNew(t)} label={t.label}><FileIcon /></TileButton>
          ))}
          <TileButton testid="office-open" onClick={openPicker} label={s.openFiles}><UploadIcon /></TileButton>
          <input
            ref={input}
            type="file"
            hidden
            data-testid="office-file-input"
            multiple
            accept={kit.accepts.join(',')}
            onChange={(e) => { const fs = [...(e.target.files || [])]; e.target.value = ''; onImport(fs.map((file) => ({ file }))) }}
          />
        </div>
        <p className="mt-2 text-[0.8rem] text-ink-faint">{s.dropHereMany}</p>
      </section>
      <section>
        <h3 className="text-[0.8rem] font-semibold uppercase tracking-wide rtl:tracking-normal text-ink-soft mb-2">{s.yourDocs}</h3>
        {batch.all > 1 && jobs.some((j) => j.state !== 'error') && <p className="mb-2 text-[0.86rem] text-ink-soft" role="status" data-testid="office-batch">{s.jobBatch(batch.done, batch.all)}</p>}
        {docs && docs.length === 0 && !jobs.length && <p className="text-ink-soft text-[0.92rem]" data-testid="office-empty">{s.noDocs}</p>}
        <ul className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(180px,1fr))]" data-testid="office-docs">
          {jobs.filter((j) => !j.docId || !docs?.some((d) => d.id === j.docId)).map((j) => <JobCard key={j.key} job={j} s={s} onDismiss={() => onDismiss(j.key)} />)}
          {docs?.map((d) => (
            <li key={d.id} className="relative group rounded-md border border-[color:var(--line)] bg-[var(--surface)] overflow-hidden" data-testid="office-doc" data-id={d.id}>
              <button type="button" onClick={() => onOpen(d.id)} className="block w-full text-start border-0 bg-transparent p-0 cursor-pointer" data-testid="office-doc-open">
                <div className="relative aspect-[4/3] bg-[color-mix(in_srgb,var(--ink)_4%,transparent)] grid place-items-center overflow-hidden">
                  {d.thumb ? <img src={d.thumb} alt="" className="w-full h-full object-cover object-top" /> : <span className="text-ink-faint [&_svg]:size-8"><FileIcon /></span>}
                  {jobs.some((j) => j.docId === d.id) && <span className="absolute inset-x-0 bottom-0 flex items-center gap-2 px-2 py-1 text-[0.74rem] bg-[color-mix(in_srgb,var(--surface)_88%,transparent)]" data-testid="office-doc-preview"><Spinner />{s.jobPreview}</span>}
                </div>
                <div className="px-2.5 py-2">
                  <div className="font-semibold text-[0.9rem] truncate" dir="auto" data-testid="office-doc-title">{d.title || s.untitled}</div>
                  <div className="text-[0.74rem] text-ink-faint flex items-center gap-1">{d.fileName && <span title={s.linked} className="[&_svg]:size-3"><LinkIcon /></span>}{s.updated} {fmtDate(d.updatedAt)}</div>
                </div>
              </button>
              <button type="button" aria-label="More" data-testid="office-doc-menu" onClick={() => setMenu(menu === d.id ? null : d.id)} className="absolute top-1 end-1 grid place-items-center size-8 rounded-md border-0 bg-[color-mix(in_srgb,var(--surface)_85%,transparent)] cursor-pointer [&_svg]:size-4"><KebabIcon /></button>
              {menu === d.id && (
                <div className="absolute top-10 end-1 z-10 w-[170px] rounded-md border border-[color:var(--line)] bg-[var(--surface)] shadow-[var(--shadow-md)] py-1" data-testid="office-doc-actions">
                  <MenuItem testid="office-doc-rename" onClick={() => { setMenu(null); setRenaming(d) }}>{s.rename}</MenuItem>
                  <MenuItem testid="office-doc-duplicate" onClick={async () => { setMenu(null); await duplicateDoc(d.id, s.copySuffix) }}>{s.duplicate}</MenuItem>
                  {kit.formats.slice(0, 1).map((f) => (
                    <MenuItem key={f.ext} testid="office-doc-download" onClick={async () => {
                      setMenu(null)
                      const r = await kit.exportAs(d.data as D, f.ext, d.title)
                      download(r.blob, ensureExt(d.title || 'document', f.ext))
                    }}>{s.download} {f.ext}</MenuItem>
                  ))}
                  <MenuItem testid="office-doc-delete" danger onClick={() => { setMenu(null); setConfirmDel(d) }}>{s.delete}</MenuItem>
                </div>
              )}
            </li>
          ))}
        </ul>
        <div className="mt-4 text-[0.8rem] text-ink-faint space-y-1">
          <p>{s.storedHere}{est && est.quota > 0 ? ` ${s.storage(fmtBytes(est.usage, locale), fmtBytes(est.quota, locale))}` : ''}</p>
          {persisted ? <p data-testid="office-persisted">{s.persisted}</p> : (
            <button type="button" data-testid="office-persist" onClick={async () => setPersisted(await persistStorage())} className="underline border-0 bg-transparent text-ink-soft cursor-pointer p-0">{s.persist}</button>
          )}
        </div>
      </section>
      {renaming && <RenameSheet s={s} doc={renaming} onClose={() => setRenaming(null)} />}
      {confirmDel && (
        <Sheet onClose={() => setConfirmDel(null)} data-testid="office-confirm-delete">
          <SheetTitle>{s.delete}</SheetTitle>
          <p dir="auto">{s.deleteQ(confirmDel.title || s.untitled)}</p>
          <SheetActions>
            <Button onClick={() => setConfirmDel(null)}>{s.close}</Button>
            <Button variant="primary" data-testid="office-confirm-delete-go" onClick={async () => { await deleteDoc(confirmDel.id); setConfirmDel(null) }}>{s.delete}</Button>
          </SheetActions>
        </Sheet>
      )}
    </div>
  )
}

function shortSide(src: string): Promise<number> {
  return new Promise((res) => { const i = new Image(); i.onload = () => res(Math.min(i.naturalWidth, i.naturalHeight)); i.onerror = () => res(0); i.src = src })
}

function Spinner() {
  return <span aria-hidden className="inline-block size-3.5 rounded-full border-2 border-[color:var(--line)] border-t-green-600 animate-spin motion-reduce:animate-none" />
}

function JobCard({ job, s, onDismiss }: { job: ImportJob; s: OfficeStr; onDismiss: () => void }) {
  const label = job.state === 'queued' ? s.jobQueued : job.state === 'converting' ? s.jobConverting : job.state === 'preview' ? s.jobPreview : s.jobFailed
  return (
    <li className={`relative rounded-md border ${job.state === 'error' ? 'border-[color:var(--danger)]' : 'border-dashed border-[color:var(--line)]'} bg-[var(--surface)] overflow-hidden`} data-testid="office-job" data-state={job.state}>
      <div className="aspect-[4/3] grid place-items-center bg-[color-mix(in_srgb,var(--ink)_3%,transparent)] text-ink-faint [&_svg]:size-8">
        {job.state === 'error' ? <FileIcon /> : <span className="[&>span]:size-7"><Spinner /></span>}
      </div>
      <div className="px-2.5 py-2">
        <div className="font-semibold text-[0.9rem] truncate" dir="auto" data-testid="office-job-name">{job.name}</div>
        <div className={`text-[0.76rem] ${job.state === 'error' ? 'text-[color:var(--danger)]' : 'text-ink-soft'}`} role={job.state === 'error' ? 'alert' : 'status'} data-testid="office-job-state">{label}</div>
        {job.error && <div className="text-[0.76rem] text-[color:var(--danger)]" data-testid="office-import-error">{job.error}</div>}
      </div>
      {job.state === 'error' && <button type="button" onClick={onDismiss} data-testid="office-job-dismiss" aria-label={s.jobDismiss} className="absolute top-1 end-1 grid place-items-center size-8 rounded-md border-0 bg-transparent cursor-pointer text-ink-soft">×</button>}
    </li>
  )
}

function TileButton({ children, label, onClick, testid, big }: { children: ReactNode; label: string; onClick: () => void; testid: string; big?: boolean }) {
  return (
    <button type="button" onClick={onClick} data-testid={testid} className="flex flex-col items-center justify-center gap-2 w-[128px] h-[112px] rounded-md border border-[color:var(--line)] bg-[var(--surface)] cursor-pointer hover:border-green-600 hover:-translate-y-px transition-transform text-ink [&_svg]:size-7">
      {children}
      <span className={`text-[0.82rem] ${big ? 'font-semibold' : ''} text-center px-1 leading-tight`}>{label}</span>
    </button>
  )
}

function MenuItem({ children, onClick, testid, danger }: { children: ReactNode; onClick: () => void; testid: string; danger?: boolean }) {
  return <button type="button" data-testid={testid} onClick={onClick} className={`block w-full text-start px-3 py-1.5 text-[0.86rem] border-0 bg-transparent cursor-pointer hover:bg-[color-mix(in_srgb,var(--ink)_6%,transparent)] ${danger ? 'text-[color:var(--danger)]' : 'text-ink'}`}>{children}</button>
}

function RenameSheet({ s, doc, onClose }: { s: OfficeStr; doc: StoredDoc; onClose: () => void }) {
  const [v, setV] = useState(doc.title)
  return (
    <Sheet onClose={onClose} data-testid="office-rename">
      <SheetTitle>{s.rename}</SheetTitle>
      <form id="office-rename-form" onSubmit={async (e) => { e.preventDefault(); await renameDoc(doc.id, v.trim() || s.untitled); onClose() }}>
        <Input autoFocus value={v} onChange={(e) => setV(e.target.value)} data-testid="office-rename-input" dir="auto" className="w-full" />
      </form>
      <SheetActions>
        <Button onClick={onClose}>{s.close}</Button>
        <Button variant="primary" type="submit" form="office-rename-form" data-testid="office-rename-go">{s.rename}</Button>
      </SheetActions>
    </Sheet>
  )
}
