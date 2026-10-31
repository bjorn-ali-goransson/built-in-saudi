import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocale } from '../../i18n'
import { Button, Stack, Panel, FileError, Spinner, Field, Seg, SegButton } from '../../components/ui'
import { DownloadIcon, UploadIcon, TrashIcon, UndoIcon, RefreshIcon } from '../../components/icons'
import { setWorkInProgress } from '../../lib/workInProgress'
import { PdfOps, type PageSource, type ImageFit } from '../../lib/pdfOps'
import { renderPdf } from '../../lib/pdfRender'
import { decodeImage } from '../../lib/decodeImage'
import { whyUnreadable } from '../../lib/imageInput'

// Merge PDFs, put pictures in as pages, and reorder, turn and drop pages — one
// screen, one save. This was three tools until November 2026 (Merge PDF, Images
// to PDF, Organise PDF Pages): each did one of those to a fresh file and none of
// them could do it to the others' result, so the commonest job — "put these
// scans and that PDF together, the right way up" — took three downloads.

const WIP = 'pdf-merge'

interface Source { name: string; kind: 'pdf' | 'image'; file: File; pages: string[] }
interface Slot { src: number; from: number; rotate: number }

const STR = {
  en: {
    pick: 'Choose PDFs or pictures', add: 'Add more files',
    intro: 'Put several PDFs together, add photos or scans as pages, turn pages the right way up, put them in order and drop the ones you do not want — then save one PDF. Nothing leaves your device.',
    reading: 'Reading the pages…', saving: 'Saving…',
    page: 'Page', picture: 'Picture',
    rotate: 'Turn right', del: 'Remove', restore: 'Put everything back',
    left: 'Move left', right: 'Move right',
    save: 'Save the PDF',
    kept: (n: number, all: number) => `${n} of ${all} pages`,
    removedNote: (n: number) => `${n} page${n === 1 ? '' : 's'} removed`,
    empty: 'Every page has been removed — there is nothing left to save.',
    rotateAll: 'Turn every page',
    hint: 'Drag a page to move it, or use the arrows. Changes apply when you save.',
    size: 'Pictures go on', fit: 'A page their own size', margin: 'Margin',
    error: (name: string) => `“${name}” could not be opened. It may be damaged, or not a PDF or a picture at all.`,
    locked: (name: string) => `“${name}” is password-protected. Its pages cannot be put into a new PDF here even with the password, because the library that writes the file cannot decrypt one — but its text can still be read.`,
    toText: 'Open it in PDF to Text',
    quality: 'PDF pages are copied, not re-drawn. Text stays text, a scan stays exactly the scan it was — the only things that change are the order, the rotation, and which pages are there.',
  },
  ar: {
    pick: 'اختر ملفات PDF أو صورًا', add: 'أضف ملفات أخرى',
    intro: 'اجمع عدة ملفات PDF، وأضف الصور أو المستندات الممسوحة صفحاتٍ، واضبط اتجاه الصفحات ورتّبها واحذف ما لا تريد — ثم احفظ ملف PDF واحدًا. ولا يغادر شيءٌ جهازك.',
    reading: 'جارٍ قراءة الصفحات…', saving: 'جارٍ الحفظ…',
    page: 'صفحة', picture: 'صورة',
    rotate: 'أدر يمينًا', del: 'احذف', restore: 'أعد كل شيء',
    left: 'حرّك لليسار', right: 'حرّك لليمين',
    save: 'احفظ الملف',
    kept: (n: number, all: number) => `${n} من ${all} صفحة`,
    removedNote: (n: number) => `حُذفت ${n} صفحة`,
    empty: 'حُذفت كل الصفحات — لم يبق شيء ليُحفظ.',
    rotateAll: 'أدر كل الصفحات',
    hint: 'اسحب الصفحة لنقلها، أو استخدم الأسهم. وتُطبَّق التغييرات عند الحفظ.',
    size: 'توضع الصور على', fit: 'صفحة بحجمها', margin: 'الهامش',
    error: (name: string) => `تعذّر فتح «${name}». قد يكون تالفًا، أو ليس ملف PDF ولا صورة أصلًا.`,
    locked: (name: string) => `«${name}» محمي بكلمة مرور. ولا يمكن وضع صفحاته في ملف جديد هنا حتى مع كلمة المرور، لأن المكتبة التي تكتب الملف لا تفك التشفير — لكن يمكن قراءة نصه.`,
    toText: 'افتحه في أداة PDF إلى نص',
    quality: 'تُنسخ صفحات PDF ولا يُعاد رسمها. فيبقى النص نصًا، وتبقى الصورة الممسوحة كما هي تمامًا — ولا يتغير إلا الترتيب والاتجاه وأي الصفحات موجودة.',
  },
}

const isPdf = async (f: File) => {
  if (/\.pdf$/i.test(f.name) || f.type === 'application/pdf') return true
  const head = new Uint8Array(await f.slice(0, 5).arrayBuffer())
  return String.fromCharCode(...head) === '%PDF-'
}

/** A picture's thumbnail, decoded the same way it will be saved (so HEIC works). */
async function pictureThumb(f: File): Promise<string | null> {
  const bmp = await decodeImage(f)
  if (!bmp) return null
  const k = Math.min(1, 360 / Math.max(bmp.width, bmp.height))
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.round(bmp.width * k)); c.height = Math.max(1, Math.round(bmp.height * k))
  c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height)
  bmp.close()
  const blob = await new Promise<Blob | null>((r) => c.toBlob(r, 'image/png'))
  return blob ? URL.createObjectURL(blob) : null
}

/**
 * A picture as bytes pdf-lib can embed. JPEG and PNG go through untouched;
 * anything else (HEIC, WebP, GIF) is drawn and re-encoded as PNG — through
 * `decodeImage`, because a HEIC that was accepted and thumbnailed must not then
 * fail at save (#226: the old Images to PDF did exactly that).
 */
async function pictureBytes(f: File): Promise<PageSource> {
  const buf = await f.arrayBuffer()
  const b = new Uint8Array(buf, 0, Math.min(8, buf.byteLength))
  if (b[0] === 0xff && b[1] === 0xd8) return { kind: 'image', bytes: buf, jpeg: true }
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return { kind: 'image', bytes: buf, jpeg: false }
  const bmp = await decodeImage(f)
  if (!bmp) throw new Error('undecodable')
  const c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height
  c.getContext('2d')!.drawImage(bmp, 0, 0)
  bmp.close()
  const blob = await new Promise<Blob | null>((r) => c.toBlob(r, 'image/png'))
  return { kind: 'image', bytes: await blob!.arrayBuffer(), jpeg: false }
}

export default function PdfMergeTool() {
  const { locale } = useLocale()
  const s = STR[locale]

  const [sources, setSources] = useState<Source[]>([])
  const [slots, setSlots] = useState<Slot[]>([])
  const [busy, setBusy] = useState<'' | 'read' | 'save'>('')
  const [error, setError] = useState('')
  const [locked, setLocked] = useState(false)
  const [drag, setDrag] = useState<number | null>(null)
  const [fit, setFit] = useState<ImageFit>({ size: 'fit', margin: 24 })
  const opsRef = useRef<PdfOps | null>(null)
  const count = useRef(0)

  useEffect(() => {
    opsRef.current = new PdfOps()
    return () => { opsRef.current?.dispose() }
  }, [])
  useEffect(() => { setWorkInProgress(WIP, sources.length > 0) }, [sources.length])
  useEffect(() => () => { setWorkInProgress(WIP, false) }, [])

  // Every file in the order picked, every page in its own order — which is
  // what "merge these" means, and what "put everything back" returns to.
  const original = useMemo(() => sources.flatMap((src, si) => src.pages.map((_, from) => ({ src: si, from, rotate: 0 }))), [sources])

  async function add(list: FileList | File[] | null | undefined) {
    const files = [...(list ?? [])]
    if (!files.length) return
    setError(''); setLocked(false)
    setBusy('read')
    const fresh: Source[] = []
    try {
      for (const f of files) {
        if (await isPdf(f)) {
          try {
            const rendered = await renderPdf(await f.arrayBuffer(), 0.6)
            if (!rendered.length) { setError(s.error(f.name)); continue }
            fresh.push({ name: f.name, kind: 'pdf', file: f, pages: rendered.map((p) => p.url) })
          } catch (e) {
            // pdf.js names a locked file; anything else is damage, and calling
            // a damaged file password-protected sends somebody hunting for a
            // password it does not have.
            if ((e as { name?: string } | null)?.name === 'PasswordException') { setLocked(true); setError(s.locked(f.name)) }
            else setError(s.error(f.name))
          }
        } else {
          const thumb = await pictureThumb(f)
          if (thumb) fresh.push({ name: f.name, kind: 'image', file: f, pages: [thumb] })
          else setError(await whyUnreadable(f, locale))
        }
      }
      if (fresh.length) {
        // Indices are taken from a ref, not inside a state updater: an updater
        // that sets other state runs twice under StrictMode and adds every page twice.
        const base = count.current
        count.current += fresh.length
        setSources((cur) => [...cur, ...fresh])
        setSlots((sl) => [...sl, ...fresh.flatMap((src, k) => src.pages.map((_, from) => ({ src: base + k, from, rotate: 0 })))])
      }
    } finally { setBusy('') }
  }

  const total = original.length
  const removed = total - slots.length
  const hasPicture = slots.some((sl) => sources[sl.src]?.kind === 'image')

  const turn = (i: number, by: number) =>
    setSlots((p) => p.map((sl, k) => (k === i ? { ...sl, rotate: sl.rotate + by } : sl)))
  const drop = (i: number) => setSlots((p) => p.filter((_, k) => k !== i))
  const move = (i: number, to: number) => setSlots((p) => {
    if (to < 0 || to >= p.length) return p
    const next = [...p]
    const [taken] = next.splice(i, 1)
    next.splice(to, 0, taken)
    return next
  })

  async function save() {
    if (!opsRef.current || !slots.length) return
    setBusy('save'); setError('')
    try {
      const used = new Set(slots.map((sl) => sl.src))
      const payload: PageSource[] = []
      for (const [i, src] of sources.entries()) {
        // A source nobody kept a page of is not read at all.
        if (!used.has(i)) payload.push({ kind: 'image', bytes: new ArrayBuffer(0), jpeg: false })
        else payload.push(src.kind === 'pdf' ? { kind: 'pdf', file: src.file } : await pictureBytes(src.file))
      }
      const blob = await opsRef.current.organise(payload, slots, fit)
      if (!blob) { setError(s.error(sources[slots[0].src].name)); return }
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = sources.length === 1 && sources[0].kind === 'pdf'
        ? sources[0].name.replace(/\.pdf$/i, '') + '-organised.pdf'
        : 'merged.pdf'
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 4000)
    } finally { setBusy('') }
  }

  const allSame = useMemo(() => slots.every((sl) => sl.rotate % 360 === slots[0]?.rotate % 360), [slots])

  const picker = (label: string, primary: boolean, testid: string) => (
    <label data-testid={testid}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => { e.preventDefault(); void add(e.dataTransfer.files) }}
      className={primary
        ? 'inline-flex items-center gap-2 self-start px-[1.15rem] py-[0.7rem] rounded-md border border-green-700 bg-green-600 text-[color:var(--primary-ink)] font-semibold text-[0.95rem] cursor-pointer'
        : 'inline-flex items-center gap-2 self-start px-3 py-1.5 rounded-md border border-[color:var(--line)] bg-[var(--surface)] text-ink text-[0.9rem] cursor-pointer'}>
      <UploadIcon /> {label}
      {/* No `accept`: on Android an image accept opens the gallery, which cannot see Downloads (#225). */}
      <input type="file" multiple className="hidden" data-testid={primary ? 'pm-file' : 'pm-file-more'}
        onChange={(e) => { void add(e.target.files); e.target.value = '' }} />
    </label>
  )

  return (
    <Stack data-testid="pdf-merge">
      {!sources.length && (
        <Panel className="gap-3">
          <p className="text-[0.95rem] text-ink-soft rtl:font-ar">{s.intro}</p>
          {picker(s.pick, true, 'pm-drop')}
        </Panel>
      )}

      {busy === 'read' && <p className="flex items-center gap-2 text-ink-faint rtl:font-ar" data-testid="pm-reading"><Spinner /> {s.reading}</p>}
      {error && <FileError message={error} />}
      {locked && (
        <Button className="self-start" to={`/${locale}/apps/pdf-ocr`} data-testid="pm-to-text">{s.toText}</Button>
      )}

      {sources.length > 0 && (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="primary" onClick={save} disabled={busy !== '' || !slots.length} data-testid="pm-save">
              <DownloadIcon /> {busy === 'save' ? s.saving : s.save}
            </Button>
            {picker(s.add, false, 'pm-add')}
            <Button className="px-3 py-1" data-testid="pm-rotate-all"
              onClick={() => setSlots((p) => p.map((sl) => ({ ...sl, rotate: sl.rotate + 90 })))}>
              <RefreshIcon /> {s.rotateAll}
            </Button>
            <Button className="px-3 py-1" data-testid="pm-restore" onClick={() => setSlots(original)}>
              <UndoIcon /> {s.restore}
            </Button>
            <span className="text-[0.85rem] text-ink-faint" data-testid="pm-count">{s.kept(slots.length, total)}</span>
            {removed > 0 && <span className="text-[0.85rem] text-gold-500" data-testid="pm-removed">{s.removedNote(removed)}</span>}
            {allSame && slots.length > 0 && slots[0].rotate % 360 !== 0 && (
              <span className="text-[0.8rem] text-ink-faint font-mono" data-testid="pm-all-turned">{((slots[0].rotate % 360) + 360) % 360}°</span>
            )}
          </div>

          {hasPicture && (
            <div className="flex flex-wrap gap-3 items-end">
              <Field label={s.size}>
                <Seg role="group">
                  {([['fit', s.fit], ['a4', 'A4'], ['letter', 'Letter']] as [ImageFit['size'], string][]).map(([v, l]) => (
                    <SegButton key={v} active={fit.size === v} data-testid={`pm-size-${v}`} onClick={() => setFit((f) => ({ ...f, size: v }))}>{l}</SegButton>
                  ))}
                </Seg>
              </Field>
              {fit.size !== 'fit' && (
                <Field label={`${s.margin} · ${fit.margin}pt`}>
                  <input type="range" min={0} max={72} step={4} value={fit.margin} data-testid="pm-margin"
                    onChange={(e) => setFit((f) => ({ ...f, margin: +e.target.value }))} />
                </Field>
              )}
            </div>
          )}

          {!slots.length && <p className="text-[0.95rem] text-gold-500 rtl:font-ar" data-testid="pm-empty">{s.empty}</p>}

          <div className="grid gap-3 grid-cols-2 min-[560px]:grid-cols-3 min-[900px]:grid-cols-5" data-testid="pm-grid">
            {slots.map((sl, i) => {
              const src = sources[sl.src]
              const deg = ((sl.rotate % 360) + 360) % 360
              const label = src.kind === 'image' ? s.picture : `${s.page} ${sl.from + 1}`
              return (
                <div key={`${sl.src}-${sl.from}-${i}`} data-testid={`pm-page-${i}`}
                  draggable
                  onDragStart={() => setDrag(i)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => { e.stopPropagation(); if (drag != null && drag !== i) move(drag, i); setDrag(null) }}
                  className={`flex flex-col gap-1 rounded-md border p-2 bg-[var(--surface)] ${drag === i ? 'border-green-600' : 'border-[color:var(--line)]'}`}>
                  <div className="relative grid place-items-center overflow-hidden rounded-sm bg-white" style={{ aspectRatio: '1 / 1.3' }}>
                    <img src={src.pages[sl.from]} alt="" data-testid={`pm-thumb-${i}`}
                      className="max-w-full max-h-full object-contain transition-transform duration-150"
                      style={{ transform: `rotate(${deg}deg)` }} />
                  </div>
                  <span className="truncate text-[0.7rem] text-ink-faint" dir="auto" title={src.name}>{src.name}</span>
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[0.7rem] text-ink-faint font-mono" data-testid={`pm-label-${i}`}>
                      {label}{deg ? ` · ${deg}°` : ''}
                    </span>
                    <div className="flex gap-0.5">
                      <button aria-label={s.left} data-testid={`pm-left-${i}`} onClick={() => move(i, i - 1)}
                        className="border-0 bg-transparent cursor-pointer text-ink-faint px-1 hover:text-ink">‹</button>
                      <button aria-label={s.rotate} data-testid={`pm-rotate-${i}`} onClick={() => turn(i, 90)}
                        className="border-0 bg-transparent cursor-pointer text-ink-faint px-1 hover:text-ink">⟳</button>
                      <button aria-label={s.del} data-testid={`pm-delete-${i}`} onClick={() => drop(i)}
                        className="border-0 bg-transparent cursor-pointer text-ink-faint px-1 hover:text-gold-500"><TrashIcon /></button>
                      <button aria-label={s.right} data-testid={`pm-right-${i}`} onClick={() => move(i, i + 1)}
                        className="border-0 bg-transparent cursor-pointer text-ink-faint px-1 hover:text-ink">›</button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          <p className="text-[0.82rem] text-ink-faint rtl:font-ar">{s.hint}</p>
          <Panel><p className="text-[0.85rem] text-ink-soft rtl:font-ar">{s.quality}</p></Panel>
        </>
      )}
    </Stack>
  )
}
