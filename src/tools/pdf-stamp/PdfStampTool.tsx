import { useEffect, useRef, useState } from 'react'
import { useLocale } from '../../i18n'
import { pdfFailure, type PdfFailure } from '../../lib/pdfFailure'
import { UploadIcon, DownloadIcon } from '../../components/icons'
import { Button, Input, Select, Stack, Spinner, Check, Panel, PdfFailureNote } from '../../components/ui'
import { setWorkInProgress } from '../../lib/workInProgress'
import { DEFAULTS, formatNumber, type Corner, type NumberFormat, type StampOptions } from './stamp'

const CORNERS: Corner[] = ['bottom-center', 'bottom-right', 'bottom-left', 'top-center', 'top-right', 'top-left']

const STR = {
  en: {
    pick: 'Choose a PDF', another: 'Choose another', working: 'Stamping…',
    hint: 'Add page numbers, a header or footer, or a watermark — without flattening the document, so the text underneath stays searchable and selectable.',
    numbers: 'Add page numbers', format: 'Format', position: 'Position',
    startAt: 'Start numbering on page', firstNumber: 'and call that page',
    startHint: 'A title page usually is not page 1 — set both so the printed number matches the contents.',
    header: 'Header text', footer: 'Footer text',
    watermark: 'Watermark', opacity: 'Watermark strength',
    size: 'Text size', margin: 'Margin',
    apply: 'Stamp and download',
    preview: 'On page 1 this reads',
    corners: {
      'bottom-center': 'Bottom centre', 'bottom-right': 'Bottom right', 'bottom-left': 'Bottom left',
      'top-center': 'Top centre', 'top-right': 'Top right', 'top-left': 'Top left',
    } as Record<Corner, string>,
    formats: {
      n: '1', 'n-of-total': '1 of 10', 'page-n': 'Page 1', 'page-n-of-total': 'Page 1 of 10',
      'arabic-indic': '١ (Arabic-Indic)',
    } as Record<NumberFormat, string>,
    note: 'Text is drawn on top of the page, not baked into it — the original stays selectable. A watermark added this way is decoration, not protection: anyone can remove it, and it does not stop copying.',
  },
  ar: {
    pick: 'اختر ملف PDF', another: 'اختر ملفًا آخر', working: 'جارٍ الختم…',
    hint: 'أضف أرقام صفحات أو ترويسة أو تذييلًا أو علامة مائية — دون تسطيح المستند، فيبقى النص تحتها قابلًا للبحث والتحديد.',
    numbers: 'أضف أرقام الصفحات', format: 'الصيغة', position: 'الموضع',
    startAt: 'ابدأ الترقيم من الصفحة', firstNumber: 'واعتبرها الصفحة',
    startHint: 'صفحة الغلاف ليست عادةً الصفحة ١ — اضبط الاثنين ليطابق الرقم المطبوع المحتوى.',
    header: 'نص الترويسة', footer: 'نص التذييل',
    watermark: 'العلامة المائية', opacity: 'قوة العلامة',
    size: 'حجم النص', margin: 'الهامش',
    apply: 'اختم ونزّل',
    preview: 'في الصفحة الأولى سيظهر',
    corners: {
      'bottom-center': 'أسفل الوسط', 'bottom-right': 'أسفل اليمين', 'bottom-left': 'أسفل اليسار',
      'top-center': 'أعلى الوسط', 'top-right': 'أعلى اليمين', 'top-left': 'أعلى اليسار',
    } as Record<Corner, string>,
    formats: {
      n: '١', 'n-of-total': '١ من ١٠', 'page-n': 'صفحة ١', 'page-n-of-total': 'صفحة ١ من ١٠',
      'arabic-indic': '١ (أرقام هندية)',
    } as Record<NumberFormat, string>,
    note: 'يُرسم النص فوق الصفحة لا بداخلها — فيبقى الأصل قابلًا للتحديد. والعلامة المائية المضافة هكذا زينة لا حماية: يمكن لأي أحد إزالتها، وهي لا تمنع النسخ.',
  },
}

export default function PdfStampTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const [file, setFile] = useState<File | null>(null)
  const [o, setO] = useState<StampOptions>(DEFAULTS)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<PdfFailure | ''>('')
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => () => setWorkInProgress('pdf-stamp', false), [])
  const set = (patch: Partial<StampOptions>) => setO((p) => ({ ...p, ...patch }))

  function pick(f: File | undefined) {
    if (!f) return
    setError(''); setFile(f)
    setWorkInProgress('pdf-stamp', true)
  }

  async function apply() {
    if (!file) return
    setBusy(true)
    try {
      const { stamp } = await import('./stamp')
      const blob = await stamp(file, o, locale)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = `${file.name.replace(/\.pdf$/i, '')}-stamped.pdf`; a.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (e) {
      setError(pdfFailure(e))
    } finally { setBusy(false) }
  }

  return (
    <Stack data-testid="pdf-stamp">
      <div className="flex flex-wrap items-center gap-2">
        {/* No accept filter — Android's picker hides files it has not indexed. */}
        <input ref={fileRef} type="file" className="hidden" data-testid="ps-file" onChange={(e) => pick(e.target.files?.[0])} />
        <Button onClick={() => fileRef.current?.click()} data-testid="ps-pick">
          <UploadIcon /> {file ? s.another : s.pick}
        </Button>
        {file && <span className="text-[0.85rem] text-ink-faint break-all">{file.name}</span>}
        {busy && <Spinner className="size-5" />}
      </div>

      {error && <div><PdfFailureNote why={error} locale={locale} /></div>}
      {!file && !error && <p className="text-ink-faint text-[0.95rem] rtl:font-ar">{s.hint}</p>}

      <Check>
        <input type="checkbox" checked={o.numbers} data-testid="ps-numbers" onChange={(e) => set({ numbers: e.target.checked })} /> {s.numbers}
      </Check>

      {o.numbers && (
        <>
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-[0.8rem] text-ink-faint">
              {s.format}
              <Select className="min-w-[12rem]" data-testid="ps-format" value={o.numberFormat}
                onChange={(e) => set({ numberFormat: e.target.value as NumberFormat })}>
                {(Object.keys(s.formats) as NumberFormat[]).map((f) => (
                  <option key={f} value={f}>{s.formats[f]}</option>
                ))}
              </Select>
            </label>
            <label className="flex flex-col gap-1 text-[0.8rem] text-ink-faint">
              {s.position}
              <Select className="min-w-[10rem]" data-testid="ps-position" value={o.position}
                onChange={(e) => set({ position: e.target.value as Corner })}>
                {CORNERS.map((c) => <option key={c} value={c}>{s.corners[c]}</option>)}
              </Select>
            </label>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-[0.8rem] text-ink-faint">
              {s.startAt}
              <Input type="number" min={1} dir="ltr" className="w-20 font-mono" data-testid="ps-startat"
                value={o.startAt} onChange={(e) => set({ startAt: Math.max(1, +e.target.value || 1) })} />
            </label>
            <label className="flex flex-col gap-1 text-[0.8rem] text-ink-faint">
              {s.firstNumber}
              <Input type="number" min={0} dir="ltr" className="w-20 font-mono" data-testid="ps-firstnumber"
                value={o.firstNumber} onChange={(e) => set({ firstNumber: Math.max(0, +e.target.value || 0) })} />
            </label>
            <span className="text-[0.82rem] text-ink-faint rtl:font-ar flex-1 min-w-[14rem]">{s.startHint}</span>
          </div>
          <p className="text-[0.9rem] text-ink-soft" data-testid="ps-preview">
            <span className="text-ink-faint rtl:font-ar">{s.preview}: </span>
            <b className="font-mono">{formatNumber(o.firstNumber, 10, o.numberFormat, locale)}</b>
          </p>
        </>
      )}

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-[0.8rem] text-ink-faint">
          {s.header}
          <Input dir="auto" className="w-52" data-testid="ps-header" value={o.headerText} onChange={(e) => set({ headerText: e.target.value })} />
        </label>
        <label className="flex flex-col gap-1 text-[0.8rem] text-ink-faint">
          {s.footer}
          <Input dir="auto" className="w-52" data-testid="ps-footer" value={o.footerText} onChange={(e) => set({ footerText: e.target.value })} />
        </label>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-[0.8rem] text-ink-faint">
          {s.watermark}
          <Input dir="auto" className="w-52" data-testid="ps-watermark" value={o.watermarkText} onChange={(e) => set({ watermarkText: e.target.value })} />
        </label>
        {o.watermarkText.trim() && (
          <label className="flex items-center gap-2 text-[0.8rem] text-ink-faint">
            {s.opacity}
            <Input type="range" min={0.04} max={0.4} step={0.02} className="w-32 p-0" data-testid="ps-opacity"
              value={o.watermarkOpacity} onChange={(e) => set({ watermarkOpacity: +e.target.value })} />
          </label>
        )}
        <label className="flex items-center gap-2 text-[0.8rem] text-ink-faint">
          {s.size}
          <Input type="range" min={7} max={18} step={1} className="w-24 p-0" data-testid="ps-size"
            value={o.fontSize} onChange={(e) => set({ fontSize: +e.target.value })} />
        </label>
        <label className="flex items-center gap-2 text-[0.8rem] text-ink-faint">
          {s.margin}
          <Input type="range" min={10} max={60} step={2} className="w-24 p-0" data-testid="ps-margin"
            value={o.margin} onChange={(e) => set({ margin: +e.target.value })} />
        </label>
      </div>

      <Button variant="primary" className="self-start" onClick={apply} disabled={!file || busy} data-testid="ps-apply">
        <DownloadIcon /> {busy ? s.working : s.apply}
      </Button>

      <Panel><p className="text-[0.85rem] text-ink-soft rtl:font-ar">{s.note}</p></Panel>
    </Stack>
  )
}
