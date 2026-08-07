import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocale } from '../../i18n'
import { Button, Stack, Panel, FileError, Spinner } from '../../components/ui'
import { DownloadIcon, UploadIcon, TrashIcon, UndoIcon, RefreshIcon } from '../../components/icons'
import { setWorkInProgress } from '../../lib/workInProgress'
import { PdfOps } from '../../lib/pdfOps'
import { renderPdf, type RenderedPage } from '../../lib/pdfRender'

const WIP = 'pdf-organise'

interface Slot { from: number; rotate: number }

const STR = {
  en: {
    pick: 'Choose a PDF',
    intro: 'Turn pages the right way up, put them in the right order, and drop the ones you do not want — then save. The file never leaves your device.',
    reading: 'Reading the pages…', saving: 'Saving…',
    page: 'Page', of: 'of',
    rotate: 'Turn right', rotateLeft: 'Turn left', del: 'Remove', restore: 'Put everything back',
    left: 'Move left', right: 'Move right',
    save: 'Save the PDF',
    kept: (n: number, all: number) => `${n} of ${all} pages`,
    removedNote: (n: number) => `${n} page${n === 1 ? '' : 's'} removed`,
    empty: 'Every page has been removed — there is nothing left to save.',
    rotateAll: 'Turn every page',
    hint: 'Drag a page to move it, or use the arrows. Changes apply when you save.',
    error: 'That PDF could not be opened. A password-protected file will not open here.',
    again: 'Choose another PDF',
    quality: 'Pages are copied, not re-drawn. Text stays text, a scan stays exactly the scan it was, and the file is the same size it should be — the only things that change are the order, the rotation, and which pages are there.',
  },
  ar: {
    pick: 'اختر ملف PDF',
    intro: 'اضبط اتجاه الصفحات، ورتّبها كما تريد، واحذف ما لا تريده — ثم احفظ. ولا يغادر الملف جهازك.',
    reading: 'جارٍ قراءة الصفحات…', saving: 'جارٍ الحفظ…',
    page: 'صفحة', of: 'من',
    rotate: 'أدر يمينًا', rotateLeft: 'أدر يسارًا', del: 'احذف', restore: 'أعد كل شيء',
    left: 'حرّك لليسار', right: 'حرّك لليمين',
    save: 'احفظ الملف',
    kept: (n: number, all: number) => `${n} من ${all} صفحة`,
    removedNote: (n: number) => `حُذفت ${n} صفحة`,
    empty: 'حُذفت كل الصفحات — لم يبق شيء ليُحفظ.',
    rotateAll: 'أدر كل الصفحات',
    hint: 'اسحب الصفحة لنقلها، أو استخدم الأسهم. وتُطبَّق التغييرات عند الحفظ.',
    error: 'تعذّر فتح ملف PDF هذا. والملف المحمي بكلمة مرور لن يُفتح هنا.',
    again: 'اختر ملفًا آخر',
    quality: 'تُنسخ الصفحات ولا يُعاد رسمها. فيبقى النص نصًا، وتبقى الصورة الممسوحة كما هي تمامًا، ويبقى حجم الملف كما ينبغي — ولا يتغير إلا الترتيب والاتجاه وأي الصفحات موجودة.',
  },
}

export default function PdfOrganiseTool() {
  const { locale } = useLocale()
  const s = STR[locale]

  const [file, setFile] = useState<File | null>(null)
  const [pages, setPages] = useState<RenderedPage[]>([])
  const [slots, setSlots] = useState<Slot[]>([])
  const [busy, setBusy] = useState<'' | 'read' | 'save'>('')
  const [error, setError] = useState('')
  const [drag, setDrag] = useState<number | null>(null)
  const opsRef = useRef<PdfOps | null>(null)

  useEffect(() => {
    opsRef.current = new PdfOps()
    return () => { opsRef.current?.dispose() }
  }, [])
  useEffect(() => () => { setWorkInProgress(WIP, false) }, [])

  async function pick(f: File | undefined | null) {
    if (!f) return
    setError('')
    setBusy('read')
    try {
      const rendered = await renderPdf(await f.arrayBuffer(), 1)
      if (!rendered.length) { setError(s.error); return }
      setFile(f)
      setPages(rendered)
      setSlots(rendered.map((_, i) => ({ from: i, rotate: 0 })))
      setWorkInProgress(WIP, true)
    } catch {
      setError(s.error)
    } finally { setBusy('') }
  }

  const removed = pages.length - slots.length

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
    if (!file || !opsRef.current || !slots.length) return
    setBusy('save')
    try {
      const blob = await opsRef.current.organise(file, slots)
      if (!blob) { setError(s.error); return }
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = file.name.replace(/\.pdf$/i, '') + '-organised.pdf'
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 4000)
    } finally { setBusy('') }
  }

  const totalRotate = useMemo(() => slots.every((sl) => sl.rotate % 360 === slots[0]?.rotate % 360), [slots])

  return (
    <Stack data-testid="pdf-organise">
      {!file && (
        <Panel className="gap-3">
          <p className="text-[0.95rem] text-ink-soft rtl:font-ar">{s.intro}</p>
          <label className="inline-flex items-center gap-2 self-start px-[1.15rem] py-[0.7rem] rounded-md border border-green-700 bg-green-600 text-[color:var(--primary-ink)] font-semibold text-[0.95rem] cursor-pointer">
            <UploadIcon /> {s.pick}
            <input type="file" className="hidden" data-testid="po-file" onChange={(e) => { void pick(e.target.files?.[0]) }} />
          </label>
        </Panel>
      )}

      {busy === 'read' && <p className="flex items-center gap-2 text-ink-faint rtl:font-ar" data-testid="po-reading"><Spinner /> {s.reading}</p>}
      {error && <FileError message={error} />}

      {file && pages.length > 0 && (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="primary" onClick={save} disabled={busy !== '' || !slots.length} data-testid="po-save">
              <DownloadIcon /> {busy === 'save' ? s.saving : s.save}
            </Button>
            <Button className="px-3 py-1" data-testid="po-rotate-all"
              onClick={() => setSlots((p) => p.map((sl) => ({ ...sl, rotate: sl.rotate + 90 })))}>
              <RefreshIcon /> {s.rotateAll}
            </Button>
            <Button className="px-3 py-1" data-testid="po-restore"
              onClick={() => setSlots(pages.map((_, i) => ({ from: i, rotate: 0 })))}>
              <UndoIcon /> {s.restore}
            </Button>
            <span className="text-[0.85rem] text-ink-faint" data-testid="po-count">{s.kept(slots.length, pages.length)}</span>
            {removed > 0 && <span className="text-[0.85rem] text-gold-500" data-testid="po-removed">{s.removedNote(removed)}</span>}
            {totalRotate && slots.length > 0 && slots[0].rotate % 360 !== 0 && (
              <span className="text-[0.8rem] text-ink-faint font-mono" data-testid="po-all-turned">{((slots[0].rotate % 360) + 360) % 360}°</span>
            )}
          </div>

          {!slots.length && <p className="text-[0.95rem] text-gold-500 rtl:font-ar" data-testid="po-empty">{s.empty}</p>}

          <div className="grid gap-3 grid-cols-2 min-[560px]:grid-cols-3 min-[900px]:grid-cols-5" data-testid="po-grid">
            {slots.map((sl, i) => {
              const src = pages[sl.from]
              const deg = ((sl.rotate % 360) + 360) % 360
              return (
                <div key={`${sl.from}-${i}`} data-testid={`po-page-${i}`}
                  draggable
                  onDragStart={() => setDrag(i)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => { if (drag != null && drag !== i) move(drag, i); setDrag(null) }}
                  className={`flex flex-col gap-1 rounded-md border p-2 bg-[var(--surface)] ${drag === i ? 'border-green-600' : 'border-[color:var(--line)]'}`}>
                  <div className="relative grid place-items-center overflow-hidden rounded-sm bg-white" style={{ aspectRatio: '1 / 1.3' }}>
                    <img src={src.url} alt="" data-testid={`po-thumb-${i}`}
                      className="max-w-full max-h-full object-contain transition-transform duration-150"
                      style={{ transform: `rotate(${deg}deg)` }} />
                  </div>
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[0.7rem] text-ink-faint font-mono" data-testid={`po-label-${i}`}>
                      {s.page} {sl.from + 1}{deg ? ` · ${deg}°` : ''}
                    </span>
                    <div className="flex gap-0.5">
                      <button aria-label={s.left} data-testid={`po-left-${i}`} onClick={() => move(i, i - 1)}
                        className="border-0 bg-transparent cursor-pointer text-ink-faint px-1 hover:text-ink">‹</button>
                      <button aria-label={s.rotate} data-testid={`po-rotate-${i}`} onClick={() => turn(i, 90)}
                        className="border-0 bg-transparent cursor-pointer text-ink-faint px-1 hover:text-ink">⟳</button>
                      <button aria-label={s.del} data-testid={`po-delete-${i}`} onClick={() => drop(i)}
                        className="border-0 bg-transparent cursor-pointer text-ink-faint px-1 hover:text-gold-500"><TrashIcon /></button>
                      <button aria-label={s.right} data-testid={`po-right-${i}`} onClick={() => move(i, i + 1)}
                        className="border-0 bg-transparent cursor-pointer text-ink-faint px-1 hover:text-ink">›</button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          <p className="text-[0.82rem] text-ink-faint rtl:font-ar">{s.hint}</p>
          <Panel><p className="text-[0.85rem] text-ink-soft rtl:font-ar">{s.quality}</p></Panel>

          <label className="self-start text-[0.85rem] text-green-700 underline cursor-pointer">
            {s.again}
            <input type="file" className="hidden" data-testid="po-file-again" onChange={(e) => { void pick(e.target.files?.[0]) }} />
          </label>
        </>
      )}
    </Stack>
  )
}
