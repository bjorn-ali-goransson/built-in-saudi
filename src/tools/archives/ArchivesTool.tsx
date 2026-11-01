import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useLocale } from '../../i18n'
import { Button, Input, Select, Stack, Panel, Seg, SegButton, FileError, Spinner } from '../../components/ui'
import { DownloadIcon, UploadIcon, TrashIcon } from '../../components/icons'
import { setWorkInProgress } from '../../lib/workInProgress'
import { baseName, type Kind } from './formats'
import type { ArchiveRequest, ArchiveResponse, Format, Listed, Why } from './archive.worker'

const WIP = 'archives'
type Mode = 'open' | 'create'

const KIND_LABEL: Record<Kind, string> = {
  zip: 'ZIP', rar: 'RAR', gzip: 'GZIP', tar: 'TAR', '7z': '7-Zip', bzip2: 'BZIP2', xz: 'XZ', zstd: 'Zstandard', unknown: '',
}

const STR = {
  en: {
    mode: 'What to do', open: 'Open an archive', create: 'Make an archive',
    pick: 'Choose an archive',
    openIntro: 'A .zip, .rar, .gz, .tar or .tar.gz — see what is inside and take out one file or all of them. It is opened on this device; nothing is uploaded.',
    reading: 'Opening…', working: 'Working…',
    kind: (k: string, n: number, inner?: string) => `${k}${inner ? ` · ${inner}` : ''} · ${n} file${n === 1 ? '' : 's'}`,
    all: 'Download everything as .zip',
    folder: 'folder',
    encrypted: 'password-protected — cannot be opened here',
    method: 'stored with a compression this browser cannot read',
    another: 'Open another archive',
    password: 'Password', unlock: 'Open',
    why: {
      password: 'This RAR is password-protected. Type the password to open it — it stays on this device.',
      'wrong-password': 'That password did not open it. Check it and try again.',
      unsupported: (k: string) => `${k} archives cannot be opened here — only ZIP, RAR, GZIP and TAR can.`,
      damaged: 'This archive is damaged or incomplete, so it could not be opened. A download that stopped early looks like this.',
      unknown: 'That is not an archive this tool recognises. ZIP, RAR, GZIP, TAR and .tar.gz files work.',
      entry: 'That file could not be taken out of the archive.',
    },
    add: 'Add files', addFolder: 'Add a folder',
    createIntro: 'Put files together into one .zip, .tar.gz or .tar — or squeeze a single file into .gz. Built on this device; nothing is uploaded.',
    format: 'Format', name: 'Name', make: 'Make the archive', remove: 'Remove',
    count: (n: number) => `${n} file${n === 1 ? '' : 's'}`,
    gzOne: 'A .gz holds exactly one file. Pick .zip or .tar.gz to put several together.',
    noRar: 'RAR can be opened here but not made: the RAR compressor is proprietary, and its licence forbids anyone else writing one. .zip opens on every computer and phone without installing anything.',
    made: (size: string) => `Made · ${size}`,
  },
  ar: {
    mode: 'ماذا تريد', open: 'افتح ملفًا مضغوطًا', create: 'اصنع ملفًا مضغوطًا',
    pick: 'اختر ملفًا مضغوطًا',
    openIntro: 'ملف ‎.zip‎ أو ‎.rar‎ أو ‎.gz‎ أو ‎.tar‎ أو ‎.tar.gz‎ — اطّلع على ما فيه واستخرج ملفًا واحدًا أو كل الملفات. يُفتح على جهازك ولا يُرفع شيء.',
    reading: 'جارٍ الفتح…', working: 'جارٍ العمل…',
    kind: (k: string, n: number, inner?: string) => `${k}${inner ? ` · ${inner}` : ''} · ${n} ملف`,
    all: 'نزّل الكل بصيغة ‎.zip‎',
    folder: 'مجلد',
    encrypted: 'محمي بكلمة مرور — لا يمكن فتحه هنا',
    method: 'مضغوط بطريقة لا يقرؤها هذا المتصفح',
    another: 'افتح ملفًا مضغوطًا آخر',
    password: 'كلمة المرور', unlock: 'افتح',
    why: {
      password: 'ملف RAR هذا محمي بكلمة مرور. اكتبها لفتحه — وتبقى على جهازك.',
      'wrong-password': 'لم تفتحه كلمة المرور هذه. تحقّق منها وأعد المحاولة.',
      unsupported: (k: string) => `لا يمكن فتح ملفات ${k} هنا — يُفتح فقط ZIP وRAR وGZIP وTAR.`,
      damaged: 'هذا الملف المضغوط تالف أو ناقص فتعذّر فتحه. هكذا يبدو التنزيل الذي توقف قبل اكتماله.',
      unknown: 'هذا ليس ملفًا مضغوطًا تعرفه الأداة. تعمل ملفات ZIP وRAR وGZIP وTAR و‎.tar.gz‎.',
      entry: 'تعذّر استخراج هذا الملف من الأرشيف.',
    },
    add: 'أضف ملفات', addFolder: 'أضف مجلدًا',
    createIntro: 'اجمع الملفات في ملف واحد ‎.zip‎ أو ‎.tar.gz‎ أو ‎.tar‎ — أو اضغط ملفًا واحدًا إلى ‎.gz‎. يُصنع على جهازك ولا يُرفع شيء.',
    format: 'الصيغة', name: 'الاسم', make: 'اصنع الملف المضغوط', remove: 'احذف',
    count: (n: number) => `${n} ملف`,
    gzOne: 'ملف ‎.gz‎ يحمل ملفًا واحدًا بالضبط. اختر ‎.zip‎ أو ‎.tar.gz‎ لجمع عدة ملفات.',
    noRar: 'يمكن فتح RAR هنا لا صنعه: فضاغط RAR مملوك لصاحبه، وترخيصه يمنع غيره من كتابة واحد. وملف ‎.zip‎ يُفتح على كل حاسوب وجوال دون تثبيت شيء.',
    made: (size: string) => `تم · ${size}`,
  },
}

function fmtSize(n: number, ar: boolean): string {
  const u = ar ? ['بايت', 'ك.ب', 'م.ب', 'ج.ب'] : ['B', 'KB', 'MB', 'GB']
  let i = 0
  let v = n
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++ }
  return `${i ? v.toFixed(v < 10 ? 1 : 0) : v} ${u[i]}`
}

function save(bytes: Uint8Array, name: string, type = 'application/octet-stream') {
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}

// Distributive, so each request shape keeps its own fields (a plain Omit over
// a union keeps only the fields they share).
type Req = ArchiveRequest extends infer R ? R extends unknown ? Omit<R, 'id'> : never : never

/** One worker for the page's life; requests matched by id, answered once. */
function useArchiveWorker() {
  const ref = useRef<{ w: Worker; next: number; wait: Map<number, (r: ArchiveResponse) => void> } | null>(null)
  useEffect(() => () => { ref.current?.w.terminate(); ref.current = null }, [])
  return (req: Req): Promise<ArchiveResponse> => {
    if (!ref.current) {
      const w = new Worker(new URL('./archive.worker.ts', import.meta.url), { type: 'module' })
      const st = { w, next: 1, wait: new Map<number, (r: ArchiveResponse) => void>() }
      w.onmessage = (e: MessageEvent<ArchiveResponse>) => { st.wait.get(e.data.id)?.(e.data); st.wait.delete(e.data.id) }
      // A worker that dies posts nothing at all; answer everything in flight
      // rather than leaving the page on a spinner for ever.
      w.onerror = () => { for (const [id, f] of st.wait) f({ id, ok: false, why: 'damaged' }); st.wait.clear(); ref.current = null }
      ref.current = st
    }
    const st = ref.current
    const id = st.next++
    return new Promise((res) => { st.wait.set(id, res); st.w.postMessage({ ...req, id }) })
  }
}

export default function ArchivesTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const [params] = useSearchParams()
  const [mode, setMode] = useState<Mode>(params.get('mode') === 'create' ? 'create' : 'open')
  const call = useArchiveWorker()

  return (
    <Stack data-testid="archives">
      <Seg role="group" aria-label={s.mode} className="self-start">
        {(['open', 'create'] as const).map((m) => (
          <SegButton key={m} active={mode === m} aria-pressed={mode === m} data-testid={`ar-mode-${m}`} onClick={() => setMode(m)}>{s[m]}</SegButton>
        ))}
      </Seg>
      {mode === 'open' ? <Opener call={call} /> : <Maker call={call} />}
    </Stack>
  )
}

type Call = ReturnType<typeof useArchiveWorker>

function Opener({ call }: { call: Call }) {
  const { locale } = useLocale()
  const s = STR[locale]
  const ar = locale === 'ar'
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [why, setWhy] = useState<{ why: Why; kind?: Kind } | null>(null)
  const [listing, setListing] = useState<{ kind: Kind; inner?: string; entries: Listed[] } | null>(null)
  const [password, setPassword] = useState('')
  const [entryError, setEntryError] = useState(false)

  useEffect(() => () => setWorkInProgress(WIP, false), [])

  async function open(f: File, pw?: string) {
    setFile(f)
    setBusy(true)
    setWhy(null)
    setEntryError(false)
    setListing(null)
    const r = await call({ op: 'open', file: f, password: pw })
    setBusy(false)
    if (!r.ok) { setWhy({ why: r.why, kind: r.kind }); return }
    if ('entries' in r) {
      setListing({ kind: r.kind, inner: r.inner ? 'TAR' : undefined, entries: r.entries })
      setWorkInProgress(WIP, true)
    }
  }

  async function take(i: number) {
    const r = await call({ op: 'entry', index: i })
    if (!r.ok || !('bytes' in r)) { setEntryError(true); return }
    save(r.bytes, baseName(listing!.entries[i].name))
  }

  async function takeAll() {
    setBusy(true)
    const r = await call({ op: 'all' })
    setBusy(false)
    if (!r.ok || !('bytes' in r)) { setEntryError(true); return }
    const stem = (file?.name ?? 'archive').replace(/\.(tar\.gz|tgz|zip|rar|gz|tar)$/i, '')
    save(r.bytes, `${stem}.zip`, 'application/zip')
  }

  const picker = (label: string, testid: string) => (
    <label className="inline-flex items-center gap-2 self-start px-[1.15rem] py-[0.7rem] rounded-md border border-green-700 bg-green-600 text-[color:var(--primary-ink)] font-semibold text-[0.95rem] cursor-pointer">
      <UploadIcon /> {label}
      <input type="file" className="hidden" data-testid={testid}
        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) { setPassword(''); void open(f) } }} />
    </label>
  )

  const files = listing?.entries.filter((e) => !e.dir).length ?? 0
  const message = why
    ? why.why === 'unsupported' ? s.why.unsupported(KIND_LABEL[why.kind ?? 'unknown']) : s.why[why.why]
    : entryError ? s.why.entry : ''
  const needsPassword = why?.why === 'password' || why?.why === 'wrong-password'

  return (
    <>
      {!listing && (
        <Panel className="gap-3">
          <p className="text-[0.95rem] text-ink-soft rtl:font-ar">{s.openIntro}</p>
          {picker(s.pick, 'ar-file')}
        </Panel>
      )}
      {busy && <p className="flex items-center gap-2 text-ink-faint rtl:font-ar" data-testid="ar-busy"><Spinner /> {listing ? s.working : s.reading}</p>}
      <div data-testid="ar-why" data-why={why?.why ?? ''}><FileError message={message} /></div>

      {needsPassword && file && (
        <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); void open(file, password) }}>
          <label className="flex flex-col gap-1 text-[0.85rem]">
            {s.password}
            <Input type="password" value={password} autoComplete="off" data-testid="ar-password" onChange={(e) => setPassword(e.target.value)} />
          </label>
          <Button type="submit" variant="primary" disabled={!password} data-testid="ar-unlock">{s.unlock}</Button>
        </form>
      )}

      {listing && (
        <>
          <Panel className="gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-col">
                <span className="font-semibold break-all" dir="auto">{file?.name}</span>
                <span className="text-[0.85rem] text-ink-faint" data-testid="ar-kind" data-kind={listing.kind}>
                  {s.kind(KIND_LABEL[listing.kind], files, listing.inner)}
                </span>
              </div>
              <Button variant="primary" onClick={() => { void takeAll() }} disabled={!files || busy} data-testid="ar-all"><DownloadIcon /> {s.all}</Button>
            </div>
            <ul className="flex flex-col divide-y divide-[color:var(--line)] border-y border-[color:var(--line)]" data-testid="ar-list">
              {listing.entries.map((e, i) => (
                <li key={i} className="flex items-center gap-3 py-2" data-testid={`ar-entry-${i}`} data-name={e.name}>
                  <span className={`flex-1 min-w-0 break-all text-[0.9rem] ${e.dir ? 'text-ink-faint' : ''}`} dir="auto">{e.name}</span>
                  {e.dir ? (
                    <span className="text-[0.78rem] text-ink-faint">{s.folder}</span>
                  ) : e.problem ? (
                    <span className="text-[0.78rem] text-gold-500 rtl:font-ar" data-testid={`ar-problem-${i}`}>{s[e.problem]}</span>
                  ) : (
                    <>
                      <span className="text-[0.78rem] text-ink-faint tabular-nums whitespace-nowrap">{fmtSize(e.size, ar)}</span>
                      <Button onClick={() => { void take(i) }} aria-label={baseName(e.name)} data-testid={`ar-take-${i}`}><DownloadIcon /></Button>
                    </>
                  )}
                </li>
              ))}
            </ul>
          </Panel>
          {picker(s.another, 'ar-file-again')}
        </>
      )}
    </>
  )
}

interface Picked { name: string; file: File }

function Maker({ call }: { call: Call }) {
  const { locale } = useLocale()
  const s = STR[locale]
  const ar = locale === 'ar'
  const [files, setFiles] = useState<Picked[]>([])
  const [format, setFormat] = useState<Format>('zip')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [made, setMade] = useState<number | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => { setWorkInProgress(WIP, files.length > 0); return () => setWorkInProgress(WIP, false) }, [files.length])
  // A different set of files is a different archive; the size shown was of the last one.
  useEffect(() => { setMade(null) }, [files, format])

  function add(list: FileList | null) {
    if (!list) return
    // A folder pick carries each file's path inside it, and that path is what
    // keeps the folder's structure in the archive instead of a flat heap.
    const picked = [...list].map((f) => ({ name: (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name, file: f }))
    setFiles((cur) => {
      const seen = new Set(cur.map((c) => c.name))
      return [...cur, ...picked.filter((p) => !seen.has(p.name))]
    })
    if (!name && picked.length) setName(picked.length === 1 && !picked[0].name.includes('/') ? picked[0].name.replace(/\.[^.]+$/, '') : picked[0].name.split('/')[0].replace(/\.[^.]+$/, ''))
  }

  const ext: Record<Format, string> = { zip: '.zip', 'tar.gz': '.tar.gz', tar: '.tar', gz: '.gz' }
  const gzTooMany = format === 'gz' && files.length > 1

  async function make() {
    setBusy(true)
    setFailed(false)
    const r = await call({ op: 'create', files, format })
    setBusy(false)
    if (!r.ok || !('bytes' in r)) { setFailed(true); return }
    setMade(r.bytes.length)
    const stem = format === 'gz' ? files[0].name.split('/').pop()! : (name.trim() || 'archive')
    save(r.bytes, `${stem}${ext[format]}`, format === 'zip' ? 'application/zip' : 'application/gzip')
  }

  const addButton = (label: string, testid: string, folder = false) => (
    <label className="inline-flex items-center gap-2 px-[1.15rem] py-[0.7rem] rounded-md border border-[color:var(--line)] bg-[var(--surface)] text-ink font-semibold text-[0.95rem] cursor-pointer">
      <UploadIcon /> {label}
      <input type="file" multiple className="hidden" data-testid={testid}
        {...(folder ? { webkitdirectory: '', directory: '' } as Record<string, string> : {})}
        onChange={(e) => { add(e.target.files); e.target.value = '' }} />
    </label>
  )

  return (
    <>
      <Panel className="gap-3">
        <p className="text-[0.95rem] text-ink-soft rtl:font-ar">{s.createIntro}</p>
        <div className="flex flex-wrap gap-2">
          {addButton(s.add, 'ar-add')}
          {addButton(s.addFolder, 'ar-add-folder', true)}
        </div>
      </Panel>

      {files.length > 0 && (
        <Panel className="gap-3">
          <span className="text-[0.85rem] text-ink-faint" data-testid="ar-count">{s.count(files.length)}</span>
          <ul className="flex flex-col divide-y divide-[color:var(--line)] border-y border-[color:var(--line)]" data-testid="ar-picked">
            {files.map((f, i) => (
              <li key={f.name} className="flex items-center gap-3 py-2">
                <span className="flex-1 min-w-0 break-all text-[0.9rem]" dir="auto">{f.name}</span>
                <span className="text-[0.78rem] text-ink-faint tabular-nums whitespace-nowrap">{fmtSize(f.file.size, ar)}</span>
                <Button onClick={() => setFiles((cur) => cur.filter((_, k) => k !== i))} aria-label={s.remove} data-testid={`ar-remove-${i}`}><TrashIcon /></Button>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-[0.85rem]">
              {s.format}
              <Select value={format} data-testid="ar-format" onChange={(e) => setFormat(e.target.value as Format)}>
                <option value="zip">.zip</option>
                <option value="tar.gz">.tar.gz</option>
                <option value="tar">.tar</option>
                <option value="gz">.gz</option>
              </Select>
            </label>
            {format !== 'gz' && (
              <label className="flex flex-col gap-1 text-[0.85rem]">
                {s.name}
                <Input value={name} dir="auto" data-testid="ar-name" onChange={(e) => setName(e.target.value)} />
              </label>
            )}
            <Button variant="primary" onClick={() => { void make() }} disabled={busy || gzTooMany} data-testid="ar-make">
              {busy ? <Spinner /> : <DownloadIcon />} {s.make}
            </Button>
            {made !== null && <span className="text-[0.85rem] text-ink-faint" data-testid="ar-made">{s.made(fmtSize(made, ar))}</span>}
          </div>
          {gzTooMany && <p className="text-[0.88rem] text-gold-500 rtl:font-ar" data-testid="ar-gz-one">{s.gzOne}</p>}
          {failed && <FileError message={s.why.damaged} />}
        </Panel>
      )}
      <p className="text-[0.82rem] text-ink-faint rtl:font-ar" data-testid="ar-no-rar">{s.noRar}</p>
    </>
  )
}
