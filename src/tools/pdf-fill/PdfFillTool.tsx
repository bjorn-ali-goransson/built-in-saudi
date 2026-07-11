import { useEffect, useRef, useState } from 'react'
import { useLocale } from '../../i18n'
import { UploadIcon, DownloadIcon } from '../../components/icons'
import { Stack, Button, Spinner, Input, Textarea, Select, Check, Seg, SegButton } from '../../components/ui'
import type { RenderedPage } from '../../lib/pdfRender'
import { fieldLabel, type FormField, type FormScan } from './fields'

type Val = string | boolean
type TextBox = { id: string; page: number; x: number; y: number; text: string; size: number }

const STR = {
  en: {
    drop: 'Drop a PDF form, or tap to choose', reading: 'Reading form…',
    viewForm: 'As a form', viewPage: 'On the page', page: 'Page', of: 'of', flatten: 'Lock fields (flatten)',
    noFields: 'No fillable fields found — tap anywhere on the page to add a text box.', addNote: 'Tap the page to add text · drag to move',
    fieldsFound: (n: number) => `${n} field${n === 1 ? '' : 's'} found`, required: 'required',
    del: 'Remove', size: 'Size', done: 'Download filled PDF', working: 'Preparing…', another: 'Fill another',
    locked: 'This PDF is locked / encrypted.', typeHere: 'Type here', choose: 'Choose…',
    privacy: 'Filled on your device — your PDF is never uploaded.',
  },
  ar: {
    drop: 'أفلت نموذج PDF أو اضغط للاختيار', reading: 'جارٍ قراءة النموذج…',
    viewForm: 'كنموذج', viewPage: 'على الصفحة', page: 'صفحة', of: 'من', flatten: 'تثبيت الحقول (تسطيح)',
    noFields: 'لم يُعثر على حقول قابلة للتعبئة — اضغط في أي مكان على الصفحة لإضافة مربع نص.', addNote: 'اضغط الصفحة لإضافة نص · اسحب للتحريك',
    fieldsFound: (n: number) => `عُثر على ${n} حقل`, required: 'مطلوب',
    del: 'إزالة', size: 'الحجم', done: 'تنزيل PDF المعبّأ', working: 'جارٍ التحضير…', another: 'عبّئ آخر',
    locked: 'هذا الملف مقفل / مشفّر.', typeHere: 'اكتب هنا', choose: 'اختر…',
    privacy: 'يُعبّأ على جهازك — لا يُرفع ملفك أبدًا.',
  },
}

let uid = 0

export default function PdfFillTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const fileRef = useRef<HTMLInputElement>(null)

  const [file, setFile] = useState<File | null>(null)
  const [pages, setPages] = useState<RenderedPage[] | null>(null)
  const [scan, setScan] = useState<FormScan | null>(null)
  const [values, setValues] = useState<Record<string, Val>>({})
  const [texts, setTexts] = useState<TextBox[]>([])
  const [pi, setPi] = useState(0)
  const [view, setView] = useState<'form' | 'page'>('page')
  const [focus, setFocus] = useState<string | null>(null)
  const [flatten, setFlatten] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [out, setOut] = useState<{ url: string; size: number } | null>(null)

  const pageBoxRef = useRef<HTMLDivElement>(null)
  const [boxH, setBoxH] = useState(0)
  useEffect(() => {
    const el = pageBoxRef.current; if (!el) return
    const ro = new ResizeObserver(() => setBoxH(el.clientHeight))
    ro.observe(el); setBoxH(el.clientHeight)
    return () => ro.disconnect()
  }, [pages, pi, view])

  const setVal = (name: string, v: Val) => { setValues((c) => ({ ...c, [name]: v })); setOut(null) }
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

  async function onFile(f: File | null | undefined) {
    if (!f || !(f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'))) return
    setBusy(true); setErr(''); setOut(null); setTexts([]); setPi(0); setFocus(null)
    try {
      const [{ renderPdf }, { scanFields }] = await Promise.all([import('../../lib/pdfRender'), import('./fields')])
      const [rendered, sc] = await Promise.all([renderPdf(await f.arrayBuffer()), scanFields(await f.arrayBuffer())])
      // seed initial values
      const init: Record<string, Val> = {}
      for (const fl of sc.fields) {
        if (fl.type === 'checkbox') init[fl.name] = !!fl.checked
        else init[fl.name] = fl.initial ?? ''
      }
      setFile(f); setPages(rendered); setScan(sc); setValues(init)
      setView(sc.htmlMode ? 'form' : 'page')
    } catch {
      setErr(s.locked); setFile(null); setPages(null); setScan(null)
    } finally { setBusy(false) }
  }

  const hasFields = !!scan && scan.fields.length > 0
  const pageFields = (scan?.fields || []).filter((f) => f.rects.some((r) => r.page === pi))

  // Jump to a field's page + highlight it when focused from the form list.
  function focusOn(f: FormField) {
    setFocus(f.name)
    const p = f.rects[0]?.page ?? f.page
    if (p !== pi) setPi(p)
  }

  // ---- no-fields text boxes ---------------------------------------------------
  function addText(e: React.PointerEvent) {
    if (hasFields || (e.target as HTMLElement).dataset.tb) return
    const rect = pageBoxRef.current!.getBoundingClientRect()
    const x = clamp((e.clientX - rect.left) / rect.width, 0, 0.95)
    const y = clamp((e.clientY - rect.top) / rect.height, 0, 0.97)
    const id = `t${uid++}`
    setTexts((c) => [...c, { id, page: pi, x, y, text: '', size: 14 }]); setFocus(id); setOut(null)
  }
  const drag = useRef<{ id: string; dx: number; dy: number } | null>(null)
  function tbDown(e: React.PointerEvent, t: TextBox) {
    if ((e.target as HTMLElement).tagName === 'INPUT') return
    e.preventDefault(); (e.target as HTMLElement).setPointerCapture(e.pointerId)
    const rect = pageBoxRef.current!.getBoundingClientRect()
    drag.current = { id: t.id, dx: (e.clientX - rect.left) / rect.width - t.x, dy: (e.clientY - rect.top) / rect.height - t.y }
    setFocus(t.id)
  }
  function tbMove(e: React.PointerEvent) {
    if (!drag.current) return
    const rect = pageBoxRef.current!.getBoundingClientRect()
    const x = clamp((e.clientX - rect.left) / rect.width - drag.current.dx, 0, 0.98)
    const y = clamp((e.clientY - rect.top) / rect.height - drag.current.dy, 0, 0.98)
    setTexts((c) => c.map((t) => (t.id === drag.current!.id ? { ...t, x, y } : t)))
  }
  function tbUp() { drag.current = null }

  async function download() {
    if (!file) return
    setBusy(true); setErr('')
    try {
      const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib')
      const pdf = await PDFDocument.load(await file.arrayBuffer())
      if (hasFields && scan) {
        const form = pdf.getForm()
        for (const f of scan.fields) {
          const v = values[f.name]
          try {
            if (f.type === 'text') form.getTextField(f.name).setText(String(v ?? ''))
            else if (f.type === 'checkbox') { const c = form.getCheckBox(f.name); v ? c.check() : c.uncheck() }
            else if (f.type === 'radio') { if (v) form.getRadioGroup(f.name).select(String(v)) }
            else if (f.type === 'dropdown') { if (v) form.getDropdown(f.name).select(String(v)) }
            else if (f.type === 'listbox') { if (v) form.getOptionList(f.name).select(String(v)) }
          } catch { /* value/font unsupported — skip this field */ }
        }
        if (flatten) { try { form.flatten() } catch { /* ignore */ } }
      } else if (texts.length) {
        const font = await pdf.embedFont(StandardFonts.Helvetica)
        const pgs = pdf.getPages()
        for (const t of texts) {
          const page = pgs[t.page]; if (!page || !t.text.trim()) continue
          const W = page.getWidth(), H = page.getHeight()
          // eslint-disable-next-line no-control-regex
          const safe = t.text.replace(/[^\x00-\xFF]/g, '') // Helvetica is Latin-1 only
          page.drawText(safe, { x: t.x * W, y: H - t.y * H - t.size, size: t.size, font, color: rgb(0.05, 0.05, 0.05) })
        }
      }
      const bytes = await pdf.save()
      const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' })
      setOut((prev) => { if (prev) URL.revokeObjectURL(prev.url); return { url: URL.createObjectURL(blob), size: blob.size } })
    } catch {
      setErr(s.locked)
    } finally { setBusy(false) }
  }

  function reset() { setFile(null); setPages(null); setScan(null); setValues({}); setTexts([]); setOut(null) }

  // A single field control (shared by the form list and page overlays).
  function control(f: FormField, overlay: boolean, rect?: { h: number }) {
    const v = values[f.name]
    const common = overlay ? 'w-full h-full !min-h-0 !py-0 !px-1 bg-[color-mix(in_srgb,var(--green-400)_12%,white)] border border-[color:color-mix(in_srgb,var(--green-500)_45%,transparent)]' : ''
    const fs = overlay && rect ? { fontSize: `${Math.max(9, boxH * rect.h * 0.58)}px` } : undefined
    if (f.type === 'text') {
      return f.multiline && !overlay
        ? <Textarea value={String(v ?? '')} onChange={(e) => setVal(f.name, e.target.value)} placeholder={s.typeHere} maxLength={f.maxLen} />
        : <Input value={String(v ?? '')} onChange={(e) => setVal(f.name, e.target.value)} placeholder={overlay ? '' : s.typeHere} maxLength={f.maxLen} className={common} style={fs}
            onFocus={() => setFocus(f.name)} data-testid={overlay ? 'fill-overlay' : undefined} />
    }
    if (f.type === 'dropdown' || f.type === 'listbox') {
      return (
        <Select value={String(v ?? '')} onChange={(e) => setVal(f.name, e.target.value)} className={common} style={fs} onFocus={() => setFocus(f.name)}>
          <option value="">{s.choose}</option>
          {(f.options || []).map((o) => <option key={o} value={o}>{o}</option>)}
        </Select>
      )
    }
    if (f.type === 'checkbox') {
      return overlay
        ? <button type="button" data-tb="1" onClick={() => setVal(f.name, !v)} className="w-full h-full grid place-items-center bg-[color-mix(in_srgb,var(--green-400)_12%,white)] border border-[color:color-mix(in_srgb,var(--green-500)_45%,transparent)] text-green-700 font-bold cursor-pointer">{v ? '✓' : ''}</button>
        : <Check><input type="checkbox" checked={!!v} onChange={(e) => setVal(f.name, e.target.checked)} /> {fieldLabel(f)}</Check>
    }
    // radio (form mode only renders here; overlay handled per-rect below)
    return (
      <div className="flex flex-wrap gap-3">
        {(f.options || []).map((o) => (
          <label key={o} className="inline-flex items-center gap-1.5 text-[0.9rem] cursor-pointer">
            <input type="radio" name={f.name} checked={v === o} onChange={() => setVal(f.name, o)} className="accent-green-600" onFocus={() => setFocus(f.name)} /> {o}
          </label>
        ))}
      </div>
    )
  }

  return (
    <Stack data-testid="pdf-fill">
      {!pages && (
        <button className="flex flex-col items-center gap-[0.4rem] py-10 px-4 border-2 border-dashed border-[color:var(--line)] rounded-[var(--r-md)] bg-[var(--surface)] text-center cursor-pointer hover:border-[color:color-mix(in_srgb,var(--green-500)_45%,transparent)] hover:bg-[color-mix(in_srgb,var(--green-400)_6%,transparent)]"
          data-testid="fill-drop" onClick={() => fileRef.current?.click()}
          onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); onFile(e.dataTransfer.files?.[0]) }}>
          {busy ? <Spinner className="size-7" label={s.reading} /> : <><UploadIcon /><span>{s.drop}</span></>}
          <input ref={fileRef} type="file" accept="application/pdf" className="absolute w-px h-px opacity-0" onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = '' }} />
        </button>
      )}
      {err && <p className="text-[color:var(--danger)] text-[0.9rem]" data-testid="fill-err">{err}</p>}

      {pages && (
        <div className="flex flex-col gap-3">
          {/* toolbar */}
          <div className="flex items-center gap-2 flex-wrap">
            {hasFields ? (
              <>
                <Seg>
                  <SegButton active={view === 'form'} onClick={() => setView('form')}>{s.viewForm}</SegButton>
                  <SegButton active={view === 'page'} onClick={() => setView('page')}>{s.viewPage}</SegButton>
                </Seg>
                <span className="text-[0.85rem] text-ink-faint">{s.fieldsFound(scan!.fields.length)}</span>
              </>
            ) : (
              <span className="text-[0.85rem] text-gold-500">{s.noFields}</span>
            )}
            <span className="flex-1" />
            <Check><input type="checkbox" checked={flatten} onChange={(e) => setFlatten(e.target.checked)} /> {s.flatten}</Check>
          </div>

          {/* FORM MODE — HTML form above the page */}
          {hasFields && view === 'form' && (
            <div className="flex flex-col gap-3 border border-[color:var(--line-soft)] rounded-md bg-[var(--surface)] p-3 max-h-[55vh] overflow-y-auto" data-testid="fill-form">
              {scan!.fields.map((f) => (
                <div key={f.name} className={`flex flex-col gap-1 ${focus === f.name ? 'ring-1 ring-green-500 rounded-md p-1 -m-1' : ''}`}>
                  {f.type !== 'checkbox' && (
                    <label className="text-[0.85rem] font-medium text-ink-soft" onClick={() => focusOn(f)}>{fieldLabel(f)}</label>
                  )}
                  {control(f, false)}
                </div>
              ))}
            </div>
          )}

          {/* page nav */}
          {pages.length > 1 && (
            <div className="flex items-center justify-center gap-2 text-[0.85rem] text-ink-soft">
              <Button className="px-2 min-w-[2rem] justify-center" disabled={pi === 0} onClick={() => setPi((v) => v - 1)}>‹</Button>
              {s.page} {pi + 1} {s.of} {pages.length}
              <Button className="px-2 min-w-[2rem] justify-center" disabled={pi === pages.length - 1} onClick={() => setPi((v) => v + 1)}>›</Button>
            </div>
          )}
          {!hasFields && <p className="text-[0.8rem] text-ink-faint text-center">{s.addNote}</p>}

          {/* page canvas with overlays */}
          <div ref={pageBoxRef} className="relative mx-auto max-w-full bg-white shadow-[var(--shadow-sm)]"
            style={{ width: '100%', maxWidth: `${(pages[pi].wPt / pages[pi].hPt) * 72}vh` }}
            onPointerDown={hasFields ? undefined : addText} onPointerMove={hasFields ? undefined : tbMove} onPointerUp={hasFields ? undefined : tbUp}>
            <img src={pages[pi].url} alt="" className="block w-full h-auto pointer-events-none" draggable={false} />

            {/* field overlays (page view) */}
            {hasFields && view === 'page' && pageFields.map((f) => {
              if (f.type === 'radio') {
                return f.rects.filter((r) => r.page === pi).map((r, idx) => (
                  <button key={f.name + idx} type="button" data-tb="1" onClick={() => setVal(f.name, r.value || '')}
                    className={`absolute rounded-full grid place-items-center cursor-pointer border ${values[f.name] === r.value ? 'bg-green-600 border-green-700' : 'bg-[color-mix(in_srgb,var(--green-400)_12%,white)] border-[color:color-mix(in_srgb,var(--green-500)_45%,transparent)]'}`}
                    style={{ left: `${r.x * 100}%`, top: `${r.y * 100}%`, width: `${r.w * 100}%`, height: `${r.h * 100}%` }} aria-label={`${fieldLabel(f)} ${r.value}`}>
                    {values[f.name] === r.value && <span className="w-1/2 h-1/2 rounded-full bg-white" />}
                  </button>
                ))
              }
              const r = f.rects.find((rr) => rr.page === pi)!
              return (
                <div key={f.name} className={`absolute ${focus === f.name ? 'ring-2 ring-green-500' : ''}`}
                  style={{ left: `${r.x * 100}%`, top: `${r.y * 100}%`, width: `${r.w * 100}%`, height: `${r.h * 100}%` }}>
                  {control(f, true, r)}
                </div>
              )
            })}

            {/* highlight the focused field's rects in form view */}
            {hasFields && view === 'form' && focus && (scan!.fields.find((f) => f.name === focus)?.rects || []).filter((r) => r.page === pi).map((r, i) => (
              <div key={i} className="absolute ring-2 ring-green-500 bg-[color-mix(in_srgb,var(--green-400)_18%,transparent)] pointer-events-none rounded-[2px]"
                style={{ left: `${r.x * 100}%`, top: `${r.y * 100}%`, width: `${r.w * 100}%`, height: `${r.h * 100}%` }} />
            ))}

            {/* no-fields text boxes */}
            {!hasFields && texts.filter((t) => t.page === pi).map((t) => (
              <div key={t.id} data-tb="1" className={`absolute touch-none ${focus === t.id ? 'ring-1 ring-green-500' : ''}`}
                style={{ left: `${t.x * 100}%`, top: `${t.y * 100}%`, minWidth: '3rem' }}
                onPointerDown={(e) => tbDown(e, t)}>
                <input value={t.text} autoFocus onChange={(e) => { setTexts((c) => c.map((x) => x.id === t.id ? { ...x, text: e.target.value } : x)); setOut(null) }}
                  onFocus={() => setFocus(t.id)} placeholder={s.typeHere}
                  className="bg-[color-mix(in_srgb,var(--green-400)_10%,white)] border border-[color:color-mix(in_srgb,var(--green-500)_40%,transparent)] rounded-sm px-1 outline-none text-ink"
                  style={{ fontSize: `${t.size}px` }} data-testid="fill-textbox" />
                {focus === t.id && (
                  <button type="button" data-tb="1" onClick={() => { setTexts((c) => c.filter((x) => x.id !== t.id)); setFocus(null) }} aria-label={s.del}
                    className="absolute -right-3 -top-3 w-5 h-5 rounded-full bg-[var(--danger)] text-white text-[0.7rem] grid place-items-center border-2 border-white cursor-pointer">✕</button>
                )}
              </div>
            ))}
          </div>

          {/* export */}
          <div className="flex items-center gap-2">
            {!out ? (
              <Button variant="primary" data-testid="fill-export" disabled={busy} onClick={download}>{busy ? s.working : s.done}</Button>
            ) : (
              <Button variant="primary" href={out.url} download="filled.pdf" data-testid="fill-download"><DownloadIcon /> {s.done} · {(out.size / 1024).toFixed(0)} KB</Button>
            )}
            <Button onClick={reset}>{s.another}</Button>
          </div>
        </div>
      )}

      <p className="text-[0.8rem] text-ink-faint flex items-center gap-[0.4rem]"><span aria-hidden="true">🔒</span> {s.privacy}</p>
    </Stack>
  )
}
