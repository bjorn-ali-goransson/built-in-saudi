import { useEffect, useRef, useState } from 'react'
import { useLocale } from '../../i18n'
import { UploadIcon, DownloadIcon, TrashIcon, RedactIcon } from '../../components/icons'
import { Button, Select, Stack, Spinner, FileError, Panel, Check } from '../../components/ui'
import { setWorkInProgress } from '../../lib/workInProgress'
import type { Box, Rendered } from './redact'

const STR = {
  en: {
    pick: 'Choose a PDF', another: 'Choose another', reading: 'Rendering the pages…', building: 'Rebuilding…',
    hint: 'Drag over anything you need gone. Unlike drawing a black box in a PDF viewer, this removes the text itself — the page is rebuilt as an image, so there is nothing left underneath to select or copy.',
    failed: 'That file could not be read as a PDF.',
    quality: 'Output quality', stripMeta: 'Also clear the document metadata',
    boxes: (n: number) => `${n} area${n === 1 ? '' : 's'} marked`,
    clear: 'Clear marks', apply: 'Redact and download',
    page: 'Page',
    verified: 'Checked: the exported file contains no extractable text at all.',
    verifying: 'Verifying…',
    warnBlackBox: 'A black rectangle drawn in a PDF viewer hides nothing — the text stays in the file and can be selected, copied or extracted with a one-line command. That mistake has published witness names, salaries and medical records. This tool removes the text instead.',
    tradeoff: 'The trade: the result is a picture of each page, so it is no longer searchable or selectable, and the file is larger. For a redaction that is the right way round — a smaller document that still leaks is worthless.',
    metaNote: 'Metadata routinely names the author, their organisation and the software used. A redacted document that still carries it has not really been redacted.',
  },
  ar: {
    pick: 'اختر ملف PDF', another: 'اختر ملفًا آخر', reading: 'جارٍ عرض الصفحات…', building: 'جارٍ إعادة البناء…',
    hint: 'اسحب فوق كل ما تريد إزالته. وخلافًا لرسم مربع أسود في قارئ PDF، تحذف هذه الأداة النص نفسه — إذ يُعاد بناء الصفحة صورةً، فلا يبقى تحتها ما يمكن تحديده أو نسخه.',
    failed: 'تعذّرت قراءة هذا الملف كـPDF.',
    quality: 'جودة الناتج', stripMeta: 'امسح أيضًا بيانات المستند الوصفية',
    boxes: (n: number) => `${n.toLocaleString('ar')} منطقة محدّدة`,
    clear: 'امسح التحديد', apply: 'احجب ونزّل',
    page: 'صفحة',
    verified: 'تم التحقق: الملف المُصدَّر لا يحتوي على أي نص قابل للاستخراج إطلاقًا.',
    verifying: 'جارٍ التحقق…',
    warnBlackBox: 'المربع الأسود المرسوم في قارئ PDF لا يخفي شيئًا — فالنص يبقى في الملف ويمكن تحديده أو نسخه أو استخراجه بأمر واحد. وقد تسبّب هذا الخطأ في نشر أسماء شهود ورواتب وسجلات طبية. وهذه الأداة تحذف النص بدلًا من ذلك.',
    tradeoff: 'المقابل: يصبح الناتج صورةً لكل صفحة، فلا يعود قابلًا للبحث أو التحديد، ويكبر حجمه. وهذا هو الترتيب الصحيح في الحجب — فالمستند الأصغر الذي يسرّب لا قيمة له.',
    metaNote: 'كثيرًا ما تحمل البيانات الوصفية اسم المؤلف وجهته والبرنامج المستخدم. والمستند المحجوب الذي لا يزال يحملها لم يُحجب حقًا.',
  },
}

export default function PdfRedactTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const [pages, setPages] = useState<Rendered[]>([])
  const [boxes, setBoxes] = useState<Box[]>([])
  const [dpi, setDpi] = useState(150)
  const [stripMeta, setStripMeta] = useState(true)
  const [busy, setBusy] = useState<'' | 'reading' | 'building'>('')
  const [error, setError] = useState('')
  const [name, setName] = useState('document')
  const [verified, setVerified] = useState<boolean | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const drag = useRef<{ page: number; x: number; y: number } | null>(null)

  useEffect(() => () => setWorkInProgress('pdf-redact', false), [])

  async function pick(f: File | undefined) {
    if (!f) return
    setBusy('reading'); setError(''); setBoxes([]); setPages([]); setVerified(null)
    setName(f.name.replace(/\.pdf$/i, '') || 'document')
    try {
      const { renderPages } = await import('./redact')
      setPages(await renderPages(f, dpi))
      setWorkInProgress('pdf-redact', true)
    } catch {
      setError(s.failed)
    } finally { setBusy('') }
  }

  async function apply() {
    if (!pages.length) return
    setBusy('building'); setVerified(null)
    try {
      const { paintRedactions, buildPdf, extractedTextLength } = await import('./redact')
      // Repaint from a clone so re-running does not stack darker boxes.
      paintRedactions(pages, boxes)
      const blob = await buildPdf(pages, { dpi, stripMetadata: stripMeta })
      // Prove the claim rather than asserting it: re-extract from the OUTPUT.
      setVerified((await extractedTextLength(blob)) === 0)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = `${name}-redacted.pdf`; a.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch {
      setError(s.failed)
    } finally { setBusy('') }
  }

  return (
    <Stack data-testid="pdf-redact">
      <Panel className="flex items-start gap-2">
        <RedactIcon className="text-gold-500 flex-none mt-0.5" />
        <p className="text-[0.88rem] text-ink-soft rtl:font-ar">{s.warnBlackBox}</p>
      </Panel>

      <div className="flex flex-wrap items-center gap-2">
        {/* No accept filter — Android's picker hides files it has not indexed. */}
        <input ref={fileRef} type="file" className="hidden" data-testid="pr-file" onChange={(e) => pick(e.target.files?.[0])} />
        <Button onClick={() => fileRef.current?.click()} data-testid="pr-pick">
          <UploadIcon /> {pages.length ? s.another : s.pick}
        </Button>
        <label className="flex items-center gap-2 text-[0.8rem] text-ink-faint">
          {s.quality}
          <Select className="w-28" data-testid="pr-dpi" value={dpi} onChange={(e) => setDpi(+e.target.value)}>
            {[110, 150, 200, 300].map((d) => <option key={d} value={d}>{d} DPI</option>)}
          </Select>
        </label>
        {busy && <Spinner className="size-5" />}
        {busy && <span className="text-[0.9rem] text-ink-faint rtl:font-ar">{busy === 'reading' ? s.reading : s.building}</span>}
      </div>

      {error && <FileError message={error} />}
      {!pages.length && !busy && !error && <p className="text-ink-faint text-[0.95rem] rtl:font-ar">{s.hint}</p>}

      {pages.length > 0 && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[0.9rem] font-semibold text-ink" data-testid="pr-count">{s.boxes(boxes.length)}</span>
            <Button className="px-3 py-1" onClick={() => setBoxes([])} disabled={!boxes.length} data-testid="pr-clear">
              <TrashIcon /> {s.clear}
            </Button>
            <Check>
              <input type="checkbox" checked={stripMeta} data-testid="pr-meta" onChange={(e) => setStripMeta(e.target.checked)} /> {s.stripMeta}
            </Check>
            <Button variant="primary" onClick={apply} disabled={busy !== ''} data-testid="pr-apply">
              <DownloadIcon /> {s.apply}
            </Button>
          </div>

          {verified === true && <p className="text-[0.9rem] text-green-700 rtl:font-ar" data-testid="pr-verified">{s.verified}</p>}

          <div className="flex flex-col gap-4" data-testid="pr-pages">
            {pages.map((p) => (
              <div key={p.page} className="flex flex-col gap-1">
                <span className="font-mono text-[0.75rem] text-ink-faint">{s.page} {p.page}</span>
                <div className="relative self-start max-w-full">
                  <img src={p.canvas.toDataURL('image/jpeg', 0.7)} alt="" data-testid={`pr-page-${p.page}`}
                    className="max-w-full h-auto border border-[color:var(--line)] rounded-sm select-none touch-none"
                    draggable={false}
                    onPointerDown={(e) => {
                      const r = e.currentTarget.getBoundingClientRect()
                      drag.current = { page: p.page, x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height }
                      e.currentTarget.setPointerCapture(e.pointerId)
                    }}
                    onPointerUp={(e) => {
                      const d = drag.current
                      drag.current = null
                      if (!d) return
                      const r = e.currentTarget.getBoundingClientRect()
                      const x2 = (e.clientX - r.left) / r.width
                      const y2 = (e.clientY - r.top) / r.height
                      const box = {
                        page: d.page,
                        x: Math.min(d.x, x2), y: Math.min(d.y, y2),
                        w: Math.abs(x2 - d.x), h: Math.abs(y2 - d.y),
                      }
                      // A tap is not a redaction; ignore anything with no area.
                      if (box.w > 0.005 && box.h > 0.005) setBoxes((b) => [...b, box])
                    }} />
                  {boxes.filter((b) => b.page === p.page).map((b, i) => (
                    <span key={i} className="absolute bg-black pointer-events-none"
                      style={{ left: `${b.x * 100}%`, top: `${b.y * 100}%`, width: `${b.w * 100}%`, height: `${b.h * 100}%` }} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <Panel><p className="text-[0.85rem] text-ink-soft rtl:font-ar">{s.tradeoff}</p></Panel>
      <p className="text-[0.85rem] text-ink-faint rtl:font-ar">{s.metaNote}</p>
    </Stack>
  )
}
