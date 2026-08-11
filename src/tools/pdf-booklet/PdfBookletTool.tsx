import { useEffect, useRef, useState } from 'react'
import { useLocale } from '../../i18n'
import { pdfFailure, type PdfFailure } from '../../lib/pdfFailure'
import { UploadIcon, DownloadIcon } from '../../components/icons'
import { Button, Select, Stack, Spinner, Panel, Check, PdfFailureNote } from '../../components/ui'
import { setWorkInProgress } from '../../lib/workInProgress'
import { bookletOrder, type Mode } from './impose'
import type { ImposeReq, ImposeRes } from './impose.worker'

const STR = {
  en: {
    pick: 'Choose a PDF', another: 'Choose another', reading: 'Reading…', working: 'Imposing…',
    hint: 'Rearrange the pages so a printed stack folds into a readable booklet — or fit two or four pages on a sheet to save paper.',
    mode: 'Layout', booklet: 'Booklet (fold and staple)', nup2: '2 pages per sheet', nup4: '4 pages per sheet',
    rtl: 'Right-to-left binding (Arabic)',
    marks: 'Show the fold or cut line',
    gutter: 'Gap between pages',
    pages: (n: number) => `${n} pages`,
    sheets: (n: number) => `${n} printed sides`,
    padded: (n: number) => `${n} blank page${n === 1 ? '' : 's'} added — a booklet has to be a multiple of four.`,
    apply: 'Impose and download',
    order: 'Print order',
    orderNote: 'Print double-sided, flipping on the SHORT edge, then fold the stack in half. Flipping on the long edge turns every other page upside down.',
    why: 'A booklet is not pages 1,2,3,4 on sheets. The outermost sheet carries the last page beside the first and the sequence walks inwards from both ends — which is why printing a document 2-up and folding it gives you a scrambled mess.',
  },
  ar: {
    pick: 'اختر ملف PDF', another: 'اختر ملفًا آخر', reading: 'جارٍ القراءة…', working: 'جارٍ الترتيب…',
    hint: 'أعد ترتيب الصفحات لتُطوى المطبوعات إلى كتيّب مقروء — أو ضع صفحتين أو أربعًا في الورقة لتوفير الورق.',
    mode: 'التخطيط', booklet: 'كتيّب (طيّ وتدبيس)', nup2: 'صفحتان في الورقة', nup4: 'أربع صفحات في الورقة',
    rtl: 'تجليد من اليمين (عربي)',
    marks: 'أظهر خط الطي أو القص',
    gutter: 'الفاصل بين الصفحات',
    pages: (n: number) => `${n.toLocaleString('ar')} صفحة`,
    sheets: (n: number) => `${n.toLocaleString('ar')} وجهًا مطبوعًا`,
    padded: (n: number) => `أُضيفت ${n.toLocaleString('ar')} صفحة فارغة — فالكتيّب لا بد أن يكون من مضاعفات الأربعة.`,
    apply: 'رتّب ونزّل',
    order: 'ترتيب الطباعة',
    orderNote: 'اطبع على الوجهين مع القلب على الحافة القصيرة، ثم اطوِ الرزمة من المنتصف. أما القلب على الحافة الطويلة فيجعل كل صفحة ثانية مقلوبة.',
    why: 'الكتيّب ليس صفحات ١ و٢ و٣ و٤ على الأوراق. فالورقة الخارجية تحمل الصفحة الأخيرة بجوار الأولى ثم يسير التسلسل نحو الداخل من الطرفين — ولهذا تعطيك طباعة مستند صفحتين في ورقة ثم طيّه فوضى مبعثرة.',
  },
}

export default function PdfBookletTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const [file, setFile] = useState<File | null>(null)
  const [count, setCount] = useState(0)
  const [mode, setMode] = useState<Mode>('booklet')
  const [rtl, setRtl] = useState(locale === 'ar')
  const [marks, setMarks] = useState(true)
  const [gutter, setGutter] = useState(0)
  const [busy, setBusy] = useState<'' | 'reading' | 'working'>('')
  const [error, setError] = useState<PdfFailure | ''>('')
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => () => setWorkInProgress('pdf-booklet', false), [])

  // #154: pdf-lib on the main thread froze the page for 249ms on a hundred
  // pages here and three to six times that on a phone. The worker is created
  // once and terminated on unmount; requests are matched by id so a stale
  // answer to a file the reader has already replaced is dropped.
  const workerRef = useRef<Worker | null>(null)
  const reqRef = useRef(0)
  useEffect(() => {
    const w = new Worker(new URL('./impose.worker.ts', import.meta.url), { type: 'module' })
    workerRef.current = w
    return () => { w.terminate() }
  }, [])

  function ask(req: Omit<ImposeReq, 'id'>): Promise<ImposeRes> {
    return new Promise((resolve, reject) => {
      const w = workerRef.current
      if (!w) { reject(new Error('no worker')); return }
      const id = ++reqRef.current
      const done = () => {
        w.removeEventListener('message', onMsg)
        w.removeEventListener('error', onErr)
      }
      const onMsg = (ev: MessageEvent<ImposeRes>) => {
        if (ev.data.id !== id) return
        done()
        if (ev.data.error) reject(new Error(ev.data.error))
        else resolve(ev.data)
      }
      // A worker that dies never posts anything, so without this the promise
      // never settles and the tool sits on "working" for ever — a hung UI is
      // worse than an error, because there is nothing to report or retry.
      const onErr = (ev: ErrorEvent) => {
        done()
        reject(new Error(ev.message || 'worker failed'))
      }
      w.addEventListener('message', onMsg)
      w.addEventListener('error', onErr)
      w.postMessage({ id, ...req } as ImposeReq)
    })
  }

  async function pick(f: File | undefined) {
    if (!f) return
    setBusy('reading'); setError('')
    try {
      const { count: n } = await ask({ file: f })
      setCount(n ?? 0)
      setFile(f)
      setWorkInProgress('pdf-booklet', true)
    } catch (e) {
      setError(pdfFailure(e)); setFile(null); setCount(0)
    } finally { setBusy('') }
  }

  async function apply() {
    if (!file) return
    setBusy('working')
    try {
      const { blob } = await ask({ file, options: { mode, rtl, gutter, marks } })
      const url = URL.createObjectURL(blob!)
      const a = document.createElement('a')
      a.href = url; a.download = `${file.name.replace(/\.pdf$/i, '')}-${mode}.pdf`; a.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (e) {
      setError(pdfFailure(e))
    } finally { setBusy('') }
  }

  const padded = mode === 'booklet' && count ? (Math.ceil(count / 4) * 4) - count : 0
  const sheets = count
    ? (mode === 'booklet' ? bookletOrder(count).length : Math.ceil(count / (mode === 'nup2' ? 2 : 4)))
    : 0
  const preview = mode === 'booklet' && count ? bookletOrder(count).slice(0, 4) : []

  return (
    <Stack data-testid="pdf-booklet">
      <div className="flex flex-wrap items-center gap-2">
        {/* No accept filter — Android's picker hides files it has not indexed. */}
        <input ref={fileRef} type="file" className="hidden" data-testid="pb-file" onChange={(e) => pick(e.target.files?.[0])} />
        <Button onClick={() => fileRef.current?.click()} data-testid="pb-pick">
          <UploadIcon /> {file ? s.another : s.pick}
        </Button>
        {busy && <Spinner className="size-5" />}
        {busy && <span className="text-[0.9rem] text-ink-faint rtl:font-ar">{busy === 'reading' ? s.reading : s.working}</span>}
      </div>

      {error && <div><PdfFailureNote why={error} locale={locale} /></div>}
      {!file && !busy && !error && <p className="text-ink-faint text-[0.95rem] rtl:font-ar">{s.hint}</p>}

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-[0.8rem] text-ink-faint">
          {s.mode}
          <Select className="min-w-[14rem]" data-testid="pb-mode" value={mode} onChange={(e) => setMode(e.target.value as Mode)}>
            <option value="booklet">{s.booklet}</option>
            <option value="nup2">{s.nup2}</option>
            <option value="nup4">{s.nup4}</option>
          </Select>
        </label>
        <label className="flex flex-col gap-1 text-[0.8rem] text-ink-faint">
          {s.gutter}
          <Select className="w-24" data-testid="pb-gutter" value={gutter} onChange={(e) => setGutter(+e.target.value)}>
            {[0, 8, 16, 28].map((g) => <option key={g} value={g}>{g} pt</option>)}
          </Select>
        </label>
        <Check>
          <input type="checkbox" checked={rtl} data-testid="pb-rtl" onChange={(e) => setRtl(e.target.checked)} /> {s.rtl}
        </Check>
        <Check>
          <input type="checkbox" checked={marks} data-testid="pb-marks" onChange={(e) => setMarks(e.target.checked)} /> {s.marks}
        </Check>
      </div>

      {count > 0 && (
        <>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.9rem]">
            <span className="font-semibold text-ink" data-testid="pb-pages">{s.pages(count)}</span>
            <span className="text-ink-faint" data-testid="pb-sheets">{s.sheets(sheets)}</span>
            {padded > 0 && <span className="text-gold-500 rtl:font-ar" data-testid="pb-padded">{s.padded(padded)}</span>}
          </div>

          {preview.length > 0 && (
            <div className="flex flex-col gap-1">
              <span className="font-body text-[0.68rem] uppercase tracking-[0.06em] text-ink-faint">{s.order}</span>
              <div className="flex flex-wrap gap-2" data-testid="pb-order">
                {preview.map((sheet, i) => (
                  <span key={i} className="font-mono text-[0.8rem] border border-[color:var(--line)] rounded-sm px-2 py-1 bg-[var(--surface)]">
                    {sheet.slots.map((p) => (p === null ? '–' : p + 1)).join(' · ')}
                  </span>
                ))}
                {sheets > preview.length && <span className="text-[0.8rem] text-ink-faint self-center">…</span>}
              </div>
            </div>
          )}

          <Button variant="primary" className="self-start" onClick={apply} disabled={busy !== ''} data-testid="pb-apply">
            <DownloadIcon /> {s.apply}
          </Button>
          {mode === 'booklet' && (
            <Panel><p className="text-[0.88rem] text-ink-soft rtl:font-ar">{s.orderNote}</p></Panel>
          )}
        </>
      )}

      <p className="text-[0.85rem] text-ink-faint rtl:font-ar">{s.why}</p>
    </Stack>
  )
}
