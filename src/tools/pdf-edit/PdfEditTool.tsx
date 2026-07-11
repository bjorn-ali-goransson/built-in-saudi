import { useRef, useState } from 'react'
import { useLocale } from '../../i18n'
import { UploadIcon, DownloadIcon, InfoIcon } from '../../components/icons'
import { Stack, Button, Spinner } from '../../components/ui'
import type { RenderedPage } from '../../lib/pdfRender'
import type { PageContent, EditObject } from './contentStream'

type TextBox = { id: string; page: number; x: number; y: number; w: number; h: number; text: string; size: number }
type Move = { dx: number; dy: number }
const HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'] as const
type Handle = typeof HANDLES[number]

const STR = {
  en: {
    drop: 'Drop a PDF, or tap to choose', reading: 'Reading…',
    disclaimer: 'Rudimentary editor: you can move/delete images and delete text runs, and add new text. Existing text can’t be re-typed, boxes are approximate, and unusual/scanned PDFs may not map cleanly. Edits apply on export.',
    addText: 'Add text', del: 'Delete', undo: 'Undo delete', size: 'Font', zoomIn: 'Zoom in', zoomOut: 'Zoom out',
    page: 'Page', of: 'of', image: 'image', text: 'text', moved: 'moved', typeHere: 'Type…',
    export: 'Download edited PDF', working: 'Preparing…', another: 'Edit another', locked: 'This PDF is locked / encrypted.',
    tapImg: 'Tap an image or text to select · drag an image to move · use handles to resize new text',
    privacy: 'Edited on your device — your PDF is never uploaded.',
  },
  ar: {
    drop: 'أفلت ملف PDF أو اضغط للاختيار', reading: 'جارٍ القراءة…',
    disclaimer: 'محرر مبدئي: يمكنك تحريك/حذف الصور وحذف مقاطع النص وإضافة نص جديد. لا يمكن إعادة كتابة النص الموجود، والمربعات تقريبية، وبعض ملفات PDF غير الاعتيادية/الممسوحة قد لا تُعالَج بدقة. تُطبَّق التعديلات عند التصدير.',
    addText: 'أضف نصًا', del: 'حذف', undo: 'تراجع', size: 'الخط', zoomIn: 'تكبير', zoomOut: 'تصغير',
    page: 'صفحة', of: 'من', image: 'صورة', text: 'نص', moved: 'مُحرّك', typeHere: 'اكتب…',
    export: 'تنزيل PDF المعدّل', working: 'جارٍ التحضير…', another: 'عدّل آخر', locked: 'هذا الملف مقفل / مشفّر.',
    tapImg: 'اضغط صورة أو نصًا للتحديد · اسحب الصورة لتحريكها · استخدم المقابض لتغيير حجم النص الجديد',
    privacy: 'يُعدّل على جهازك — لا يُرفع ملفك أبدًا.',
  },
}

let uid = 0

export default function PdfEditTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const fileRef = useRef<HTMLInputElement>(null)

  const [file, setFile] = useState<File | null>(null)
  const [pages, setPages] = useState<RenderedPage[] | null>(null)
  const [pc, setPc] = useState<PageContent[] | null>(null)
  const [pi, setPi] = useState(0)
  const [zoom, setZoom] = useState(1)
  const [deleted, setDeleted] = useState<Set<string>>(new Set())
  const [moves, setMoves] = useState<Map<string, Move>>(new Map())
  const [texts, setTexts] = useState<TextBox[]>([])
  const [sel, setSel] = useState<string | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [out, setOut] = useState<{ url: string; size: number } | null>(null)
  const lastSize = useRef(14)
  const pageBoxRef = useRef<HTMLDivElement>(null)

  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
  const nrm = (e: React.PointerEvent) => {
    const r = pageBoxRef.current!.getBoundingClientRect()
    return { nx: (e.clientX - r.left) / r.width, ny: (e.clientY - r.top) / r.height }
  }

  async function onFile(f: File | null | undefined) {
    if (!f || !(f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'))) return
    setBusy(true); setErr(''); setOut(null); setDeleted(new Set()); setMoves(new Map()); setTexts([]); setSel(null); setPi(0)
    try {
      const [{ renderPdf }, { loadEditable }] = await Promise.all([import('../../lib/pdfRender'), import('./contentStream')])
      const [rendered, editable] = await Promise.all([renderPdf(await f.arrayBuffer()), loadEditable(await f.arrayBuffer())])
      setFile(f); setPages(rendered); setPc(editable.pages)
    } catch {
      setErr(s.locked); setFile(null); setPages(null); setPc(null)
    } finally { setBusy(false) }
  }

  const pageObjects = (pc?.[pi]?.objects || [])
  const curTexts = texts.filter((t) => t.page === pi)

  // ---- existing-object interactions (select, delete, image move) --------------
  const g = useRef<{ mode: 'img' | 'tb' | 'resize' | null; id: string; handle?: Handle; nx: number; ny: number; o: { x: number; y: number; w: number; h: number; dx: number; dy: number } } | null>(null)

  function objDown(e: React.PointerEvent, o: EditObject) {
    e.stopPropagation(); e.preventDefault()
    setSel(o.id)
    if (o.kind !== 'image' || deleted.has(o.id)) return
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    const m = moves.get(o.id) || { dx: 0, dy: 0 }
    const { nx, ny } = nrm(e)
    g.current = { mode: 'img', id: o.id, nx, ny, o: { x: o.x, y: o.y, w: o.w, h: o.h, dx: m.dx, dy: m.dy } }
  }
  function objMove(e: React.PointerEvent) {
    if (g.current?.mode !== 'img') return
    e.preventDefault()
    const { nx, ny } = nrm(e)
    const gc = g.current
    setMoves((cur) => { const m = new Map(cur); m.set(gc.id, { dx: gc.o.dx + (nx - gc.nx), dy: gc.o.dy + (ny - gc.ny) }); return m }); setOut(null)
  }
  function toggleDelete(id: string) {
    setDeleted((cur) => { const d = new Set(cur); d.has(id) ? d.delete(id) : d.add(id); return d }); setOut(null)
  }

  // ---- inserted text boxes ----------------------------------------------------
  function addText() {
    const id = `x${uid++}`
    const size = lastSize.current
    const hN = (size * 1.5) / (pc?.[pi]?.hPt || 800)
    setTexts((c) => [...c, { id, page: pi, x: 0.3, y: 0.4, w: 0.4, h: Math.max(0.04, hN), text: '', size }])
    setSel(id); setEditing(id); setOut(null)
  }
  function tbDown(e: React.PointerEvent, t: TextBox) {
    if ((e.target as HTMLElement).dataset.handle || (e.target as HTMLElement).tagName === 'TEXTAREA') return
    e.stopPropagation(); e.preventDefault()
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    setSel(t.id)
    const { nx, ny } = nrm(e)
    g.current = { mode: 'tb', id: t.id, nx, ny, o: { x: t.x, y: t.y, w: t.w, h: t.h, dx: 0, dy: 0 } }
  }
  function handleDown(e: React.PointerEvent, t: TextBox, h: Handle) {
    e.stopPropagation(); e.preventDefault()
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    setSel(t.id)
    const { nx, ny } = nrm(e)
    g.current = { mode: 'resize', id: t.id, handle: h, nx, ny, o: { x: t.x, y: t.y, w: t.w, h: t.h, dx: 0, dy: 0 } }
  }
  function tbMove(e: React.PointerEvent) {
    const gc = g.current
    if (!gc || (gc.mode !== 'tb' && gc.mode !== 'resize')) return
    e.preventDefault()
    const { nx, ny } = nrm(e)
    const dx = nx - gc.nx, dy = ny - gc.ny
    setTexts((cur) => cur.map((t) => {
      if (t.id !== gc.id) return t
      if (gc.mode === 'tb') return { ...t, x: clamp(gc.o.x + dx, 0, 1 - t.w), y: clamp(gc.o.y + dy, 0, 1 - t.h) }
      let { x, y, w, h } = gc.o
      const hd = gc.handle!
      if (hd.includes('w')) { x = gc.o.x + dx; w = gc.o.w - dx }
      if (hd.includes('e')) { w = gc.o.w + dx }
      if (hd.includes('n')) { y = gc.o.y + dy; h = gc.o.h - dy }
      if (hd.includes('s')) { h = gc.o.h + dy }
      w = Math.max(0.04, w); h = Math.max(0.02, h)
      x = clamp(x, 0, 1 - w); y = clamp(y, 0, 1 - h)
      return { ...t, x, y, w, h }
    })); setOut(null)
  }
  function up() { g.current = null }
  function setFont(id: string, d: number) {
    setTexts((c) => c.map((t) => { if (t.id !== id) return t; const size = clamp(t.size + d, 6, 96); lastSize.current = size; return { ...t, size } })); setOut(null)
  }
  function delText(id: string) { setTexts((c) => c.filter((t) => t.id !== id)); setSel(null); setEditing(null); setOut(null) }

  async function download() {
    if (!file || !pc) return
    setBusy(true); setErr('')
    try {
      const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib')
      const { applyEdits, writePage } = await import('./contentStream')
      const pdf = await PDFDocument.load(await file.arrayBuffer())
      for (const page of pc) {
        const hasEdit = page.objects.some((o) => deleted.has(o.id) || moves.has(o.id))
        if (hasEdit) writePage(pdf, page.page, applyEdits(page, deleted, moves))
      }
      if (texts.some((t) => t.text.trim())) {
        const font = await pdf.embedFont(StandardFonts.Helvetica)
        const pgs = pdf.getPages()
        for (const t of texts) {
          const page = pgs[t.page]; if (!page || !t.text.trim()) continue
          const W = page.getWidth(), H = page.getHeight()
          // eslint-disable-next-line no-control-regex
          const safe = t.text.replace(/[^\x00-\xFF]/g, '')
          page.drawText(safe, { x: t.x * W, y: H - t.y * H - t.size, size: t.size, font, color: rgb(0.05, 0.05, 0.05), maxWidth: t.w * W, lineHeight: t.size * 1.2 })
        }
      }
      const bytes = await pdf.save()
      const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' })
      setOut((p) => { if (p) URL.revokeObjectURL(p.url); return { url: URL.createObjectURL(blob), size: blob.size } })
    } catch {
      setErr(s.locked)
    } finally { setBusy(false) }
  }

  const aspect = pc?.[pi] ? (pc[pi].wPt / pc[pi].hPt) : (pages?.[pi] ? pages[pi].wPt / pages[pi].hPt : 0.7)

  return (
    <Stack data-testid="pdf-edit">
      {!pages && (
        <button className="flex flex-col items-center gap-[0.4rem] py-10 px-4 border-2 border-dashed border-[color:var(--line)] rounded-[var(--r-md)] bg-[var(--surface)] text-center cursor-pointer hover:border-[color:color-mix(in_srgb,var(--green-500)_45%,transparent)] hover:bg-[color-mix(in_srgb,var(--green-400)_6%,transparent)]"
          data-testid="edit-drop" onClick={() => fileRef.current?.click()}
          onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); onFile(e.dataTransfer.files?.[0]) }}>
          {busy ? <Spinner className="size-7" label={s.reading} /> : <><UploadIcon /><span>{s.drop}</span></>}
          <input ref={fileRef} type="file" accept="application/pdf" className="absolute w-px h-px opacity-0" onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = '' }} />
        </button>
      )}
      {err && <p className="text-[color:var(--danger)] text-[0.9rem]" data-testid="edit-err">{err}</p>}

      {pages && pc && (
        <div className="flex flex-col gap-3">
          <div className="flex items-start gap-2 border-s-[3px] border-gold-500 bg-[color-mix(in_srgb,var(--color-gold-400)_12%,transparent)] ps-3 pe-3 py-2 rounded-e-md">
            <InfoIcon className="size-4 mt-0.5 flex-none text-gold-500" />
            <span className="text-[0.8rem] text-ink leading-snug">{s.disclaimer}</span>
          </div>

          {/* toolbar */}
          <div className="flex items-center gap-2 flex-wrap">
            <Button data-testid="edit-add-text" onClick={addText}>＋ {s.addText}</Button>
            <span className="inline-flex items-center gap-1">
              <Button className="px-2 min-w-[2rem] justify-center" aria-label={s.zoomOut} disabled={zoom <= 1} onClick={() => setZoom((z) => Math.max(1, z - 0.5))}>−</Button>
              <span className="text-[0.8rem] text-ink-faint w-10 text-center">{Math.round(zoom * 100)}%</span>
              <Button className="px-2 min-w-[2rem] justify-center" aria-label={s.zoomIn} disabled={zoom >= 3} onClick={() => setZoom((z) => Math.min(3, z + 0.5))}>＋</Button>
            </span>
            <span className="flex-1" />
            {pages.length > 1 && (
              <span className="inline-flex items-center gap-1 text-[0.85rem] text-ink-soft">
                <Button className="px-2 min-w-[2rem] justify-center" disabled={pi === 0} onClick={() => { setPi((v) => v - 1); setSel(null) }}>‹</Button>
                {s.page} {pi + 1} {s.of} {pages.length}
                <Button className="px-2 min-w-[2rem] justify-center" disabled={pi === pages.length - 1} onClick={() => { setPi((v) => v + 1); setSel(null) }}>›</Button>
              </span>
            )}
          </div>

          {/* page area */}
          <div className="overflow-auto max-h-[70vh] bg-[#e9ebef] rounded-md p-2">
            <div ref={pageBoxRef} className="relative mx-auto bg-white shadow-[var(--shadow-sm)]"
              style={{ width: zoom === 1 ? `min(100%, ${aspect * 72}vh)` : `${zoom * 100}%`, aspectRatio: `${aspect}` }}
              onPointerDown={() => setSel(null)} onPointerMove={(e) => { objMove(e); tbMove(e) }} onPointerUp={up} onPointerCancel={up}>
              <img src={pages[pi].url} alt="" className="absolute inset-0 w-full h-full pointer-events-none select-none" draggable={false} />

              {/* existing objects */}
              {pageObjects.map((o) => {
                const m = moves.get(o.id)
                const rx = o.x + (m?.dx || 0), ry = o.y + (m?.dy || 0)
                const isDel = deleted.has(o.id)
                const on = sel === o.id
                return (
                  <div key={o.id}>
                    {/* white cover to preview delete, or the vacated spot of a moved image */}
                    {(isDel || (m && o.kind === 'image')) && (
                      <div className="absolute bg-white pointer-events-none" style={{ left: `${o.x * 100}%`, top: `${o.y * 100}%`, width: `${o.w * 100}%`, height: `${o.h * 100}%` }} />
                    )}
                    {!isDel && (
                      <div data-testid={`edit-obj-${o.kind}`}
                        className={`absolute cursor-pointer ${o.kind === 'image' ? 'cursor-move' : ''} ${on ? 'outline outline-2 outline-green-600 bg-[color-mix(in_srgb,var(--green-400)_10%,transparent)]' : 'outline-dashed outline-1 outline-[color:color-mix(in_srgb,var(--ink)_28%,transparent)] hover:outline-green-500'}`}
                        style={{ left: `${rx * 100}%`, top: `${ry * 100}%`, width: `${o.w * 100}%`, height: `${o.h * 100}%` }}
                        onPointerDown={(e) => objDown(e, o)}>
                        {on && (
                          <span className="absolute left-0 -top-6 flex items-center gap-1 whitespace-nowrap">
                            <span className="text-[0.65rem] bg-ink text-sand-100 rounded-sm px-1 py-0.5">{o.kind === 'image' ? s.image : s.text}{m ? ` · ${s.moved}` : ''}</span>
                            <button type="button" onClick={(e) => { e.stopPropagation(); toggleDelete(o.id) }} className="text-[0.65rem] bg-[var(--danger)] text-white rounded-sm px-1 py-0.5 border-0 cursor-pointer">{s.del}</button>
                          </span>
                        )}
                      </div>
                    )}
                    {isDel && (
                      <button type="button" onClick={() => toggleDelete(o.id)} data-testid="edit-undo"
                        className="absolute outline outline-1 outline-[color:var(--danger)] bg-transparent cursor-pointer text-[0.6rem] text-[color:var(--danger)]"
                        style={{ left: `${o.x * 100}%`, top: `${o.y * 100}%`, width: `${o.w * 100}%`, height: `${o.h * 100}%` }} title={s.undo} />
                    )}
                  </div>
                )
              })}

              {/* inserted text boxes */}
              {curTexts.map((t) => {
                const on = sel === t.id
                const fontPx = `calc(${t.size} / ${pc[pi].hPt} * 100%)`
                return (
                  <div key={t.id} data-testid="edit-textbox"
                    className={`absolute touch-none ${on ? 'outline outline-2 outline-green-600' : 'outline-dashed outline-1 outline-green-500/60'}`}
                    style={{ left: `${t.x * 100}%`, top: `${t.y * 100}%`, width: `${t.w * 100}%`, height: `${t.h * 100}%` }}
                    onPointerDown={(e) => tbDown(e, t)}
                    onDoubleClick={() => setEditing(t.id)}>
                    {editing === t.id ? (
                      <textarea autoFocus value={t.text} onChange={(e) => { setTexts((c) => c.map((x) => x.id === t.id ? { ...x, text: e.target.value } : x)); setOut(null) }}
                        onBlur={() => setEditing(null)} onPointerDown={(e) => e.stopPropagation()}
                        className="w-full h-full resize-none bg-[color-mix(in_srgb,var(--green-400)_8%,white)] border-0 outline-none p-0 leading-tight text-ink overflow-hidden"
                        style={{ fontSize: fontPx }} data-testid="edit-textarea" />
                    ) : (
                      <div className="w-full h-full whitespace-pre-wrap break-words leading-tight text-ink overflow-hidden" style={{ fontSize: fontPx }} onClick={() => setEditing(t.id)}>
                        {t.text || <span className="text-ink-faint">{s.typeHere}</span>}
                      </div>
                    )}
                    {on && (
                      <>
                        {HANDLES.map((h) => (
                          <span key={h} data-handle={h} onPointerDown={(e) => handleDown(e, t, h)}
                            className="absolute w-3 h-3 bg-white border-2 border-green-600 rounded-full touch-none"
                            style={{
                              left: h.includes('w') ? '-6px' : h.includes('e') ? 'calc(100% - 6px)' : 'calc(50% - 6px)',
                              top: h.includes('n') ? '-6px' : h.includes('s') ? 'calc(100% - 6px)' : 'calc(50% - 6px)',
                              cursor: `${h}-resize`,
                            }} />
                        ))}
                        <span className="absolute left-0 -top-8 flex items-center gap-1">
                          <button type="button" onPointerDown={(e) => e.stopPropagation()} onClick={() => setFont(t.id, -1)} className="w-6 h-6 rounded-sm bg-ink text-sand-100 border-0 cursor-pointer">−</button>
                          <span className="text-[0.7rem] bg-ink text-sand-100 rounded-sm px-1.5 h-6 inline-flex items-center">{t.size}</span>
                          <button type="button" onPointerDown={(e) => e.stopPropagation()} onClick={() => setFont(t.id, 1)} className="w-6 h-6 rounded-sm bg-ink text-sand-100 border-0 cursor-pointer">＋</button>
                          <button type="button" onPointerDown={(e) => e.stopPropagation()} onClick={() => delText(t.id)} className="w-6 h-6 rounded-sm bg-[var(--danger)] text-white border-0 cursor-pointer">✕</button>
                        </span>
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
          <p className="text-[0.8rem] text-ink-faint text-center">{s.tapImg}</p>

          {/* export */}
          <div className="flex items-center gap-2">
            {!out ? (
              <Button variant="primary" data-testid="edit-export" disabled={busy} onClick={download}>{busy ? s.working : s.export}</Button>
            ) : (
              <Button variant="primary" href={out.url} download="edited.pdf" data-testid="edit-download"><DownloadIcon /> {s.export} · {(out.size / 1024).toFixed(0)} KB</Button>
            )}
            <Button onClick={() => { setFile(null); setPages(null); setPc(null); setOut(null) }}>{s.another}</Button>
          </div>
        </div>
      )}

      <p className="text-[0.8rem] text-ink-faint flex items-center gap-[0.4rem]"><span aria-hidden="true">🔒</span> {s.privacy}</p>
    </Stack>
  )
}
