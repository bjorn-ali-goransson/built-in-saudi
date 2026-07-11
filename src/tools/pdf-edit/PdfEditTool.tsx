import { useRef, useState } from 'react'
import { useLocale } from '../../i18n'
import { UploadIcon, DownloadIcon, InfoIcon } from '../../components/icons'
import { Stack, Button, Spinner } from '../../components/ui'
import type { RenderedPage } from '../../lib/pdfRender'
import type { PageContent, EditObject, ImgXf } from './contentStream'

type TextBox = { id: string; page: number; x: number; y: number; w: number; h: number; text: string; size: number }
const HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'] as const
type Handle = typeof HANDLES[number]

const STR = {
  en: {
    drop: 'Drop a PDF, or tap to choose', reading: 'Reading…',
    disclaimer: 'Rudimentary editor: move or delete images, and add new text with resize handles. Existing text can’t be edited or removed yet, and unusual/scanned PDFs may not map cleanly. Edits apply on export.',
    addText: 'Add text', del: 'Delete', undo: 'Undo delete', size: 'Font',
    page: 'Page', of: 'of', image: 'image', text: 'text', moved: 'moved', typeHere: 'Type…',
    export: 'Download edited PDF', working: 'Preparing…', another: 'Edit another', locked: 'This PDF is locked / encrypted.',
    tapImg: 'Tap an image to select, then drag to move · corner/side dots resize · top dot rotates · pinch to zoom',
    privacy: 'Edited on your device — your PDF is never uploaded.',
  },
  ar: {
    drop: 'أفلت ملف PDF أو اضغط للاختيار', reading: 'جارٍ القراءة…',
    disclaimer: 'محرر مبدئي: حرّك أو احذف الصور، وأضِف نصًا جديدًا بمقابض لتغيير الحجم. لا يمكن تعديل أو حذف النص الموجود بعد، وبعض ملفات PDF غير الاعتيادية/الممسوحة قد لا تُعالَج بدقة. تُطبَّق التعديلات عند التصدير.',
    addText: 'أضف نصًا', del: 'حذف', undo: 'تراجع', size: 'الخط',
    page: 'صفحة', of: 'من', image: 'صورة', text: 'نص', moved: 'مُحرّك', typeHere: 'اكتب…',
    export: 'تنزيل PDF المعدّل', working: 'جارٍ التحضير…', another: 'عدّل آخر', locked: 'هذا الملف مقفل / مشفّر.',
    tapImg: 'اضغط صورة للتحديد ثم اسحبها للتحريك · النقاط الجانبية للتحجيم · النقطة العلوية للتدوير · اقرص للتكبير',
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
  const [deleted, setDeleted] = useState<Set<string>>(new Set())
  const [xf, setXf] = useState<Map<string, ImgXf>>(new Map())
  const [texts, setTexts] = useState<TextBox[]>([])
  const [sel, setSel] = useState<string | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [out, setOut] = useState<{ url: string; size: number } | null>(null)
  const lastSize = useRef(14)
  const pageBoxRef = useRef<HTMLDivElement>(null)
  const pageImgRef = useRef<HTMLImageElement>(null)
  const clips = useRef<Map<string, string>>(new Map())

  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
  const nrm = (e: React.PointerEvent) => {
    const r = pageBoxRef.current!.getBoundingClientRect()
    return { nx: (e.clientX - r.left) / r.width, ny: (e.clientY - r.top) / r.height }
  }

  async function onFile(f: File | null | undefined) {
    if (!f || !(f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'))) return
    setBusy(true); setErr(''); setOut(null); setDeleted(new Set()); setXf(new Map()); setTexts([]); setSel(null); setPi(0); clips.current = new Map()
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

  // ---- image select / delete / move / resize / rotate -------------------------
  // Images become a bounding box (real cropped bitmap) with 8 resize handles + a
  // rotate handle. The original spot is covered white once manipulated; the box
  // shows the cropped clip so you see the real image. Gesture maths run in
  // pixels (rotation-aware) then store a normalised centre/size/rotation.
  const g = useRef<{ mode: 'tb' | 'resize'; id: string; handle?: Handle; nx: number; ny: number; o: { x: number; y: number; w: number; h: number } } | null>(null)
  const gi = useRef<{ mode: 'move' | 'resize' | 'rotate'; id: string; handle?: Handle; sx: number; sy: number; rw: number; rh: number; cxpx: number; cypx: number; start: ImgXf } | null>(null)

  const xfOf = (o: EditObject): ImgXf => xf.get(o.id) || { cx: o.x + o.w / 2, cy: o.y + o.h / 2, w: o.w, h: o.h, rot: 0 }

  function cropImage(o: EditObject): string | null {
    const img = pageImgRef.current
    if (!img || !img.naturalWidth) return null
    const nw = img.naturalWidth, nh = img.naturalHeight
    const cw = Math.max(1, Math.round(o.w * nw)), ch = Math.max(1, Math.round(o.h * nh))
    const cv = document.createElement('canvas'); cv.width = cw; cv.height = ch
    const ctx = cv.getContext('2d'); if (!ctx) return null
    ctx.drawImage(img, o.x * nw, o.y * nh, o.w * nw, o.h * nh, 0, 0, cw, ch)
    try { return cv.toDataURL('image/png') } catch { return null }
  }
  function imgStart(e: React.PointerEvent, o: EditObject, mode: 'move' | 'resize' | 'rotate', handle?: Handle) {
    e.stopPropagation(); e.preventDefault()
    setSel(o.id)
    if (deleted.has(o.id)) return
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    if (!clips.current.has(o.id)) { const c = cropImage(o); if (c) clips.current.set(o.id, c) }
    const r = pageBoxRef.current!.getBoundingClientRect()
    const st = xfOf(o)
    gi.current = { mode, id: o.id, handle, sx: e.clientX, sy: e.clientY, rw: r.width, rh: r.height, cxpx: r.left + st.cx * r.width, cypx: r.top + st.cy * r.height, start: st }
  }
  function imgMove(e: React.PointerEvent) {
    const d = gi.current
    if (!d) return
    e.preventDefault()
    const st = d.start
    const dxPx = e.clientX - d.sx, dyPx = e.clientY - d.sy
    let next: ImgXf
    if (d.mode === 'move') {
      next = { ...st, cx: st.cx + dxPx / d.rw, cy: st.cy + dyPx / d.rh }
    } else if (d.mode === 'rotate') {
      const a0 = Math.atan2(d.sy - d.cypx, d.sx - d.cxpx)
      const a1 = Math.atan2(e.clientY - d.cypx, e.clientX - d.cxpx)
      next = { ...st, rot: st.rot + (a1 - a0) }
    } else {
      const c = Math.cos(st.rot), s = Math.sin(st.rot)
      const lx = dxPx * c + dyPx * s, ly = -dxPx * s + dyPx * c // into the box's local frame
      const W0 = st.w * d.rw, H0 = st.h * d.rh
      const sX = d.handle!.includes('e') ? 1 : d.handle!.includes('w') ? -1 : 0
      const sY = d.handle!.includes('s') ? 1 : d.handle!.includes('n') ? -1 : 0
      const nW = Math.max(14, W0 + sX * lx), nH = Math.max(14, H0 + sY * ly)
      const lsx = (sX * (nW - W0)) / 2, lsy = (sY * (nH - H0)) / 2 // centre shifts half the growth
      const csx = lsx * c - lsy * s, csy = lsx * s + lsy * c
      next = { cx: st.cx + csx / d.rw, cy: st.cy + csy / d.rh, w: nW / d.rw, h: nH / d.rh, rot: st.rot }
    }
    setXf((cur) => { const m = new Map(cur); m.set(d.id, next); return m }); setOut(null)
  }
  function toggleDelete(id: string) {
    setDeleted((cur) => { const s2 = new Set(cur); s2.has(id) ? s2.delete(id) : s2.add(id); return s2 }); setOut(null)
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
    g.current = { mode: 'tb', id: t.id, nx, ny, o: { x: t.x, y: t.y, w: t.w, h: t.h } }
  }
  function handleDown(e: React.PointerEvent, t: TextBox, h: Handle) {
    e.stopPropagation(); e.preventDefault()
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    setSel(t.id)
    const { nx, ny } = nrm(e)
    g.current = { mode: 'resize', id: t.id, handle: h, nx, ny, o: { x: t.x, y: t.y, w: t.w, h: t.h } }
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
  function up() { gi.current = null; g.current = null }
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
        const hasEdit = page.objects.some((o) => deleted.has(o.id) || xf.has(o.id))
        if (hasEdit) writePage(pdf, page.page, applyEdits(page, deleted, xf))
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
            <span className="flex-1" />
            {pages.length > 1 && (
              <span className="inline-flex items-center gap-1 text-[0.85rem] text-ink-soft">
                <Button className="px-2 min-w-[2rem] justify-center" disabled={pi === 0} onClick={() => { setPi((v) => v - 1); setSel(null) }}>‹</Button>
                {s.page} {pi + 1} {s.of} {pages.length}
                <Button className="px-2 min-w-[2rem] justify-center" disabled={pi === pages.length - 1} onClick={() => { setPi((v) => v + 1); setSel(null) }}>›</Button>
              </span>
            )}
          </div>

          {/* page area — normal flow so the browser's native pinch-zoom + scroll
              work; only the draggable boxes take touch-action away. */}
          <div className="bg-[#e9ebef] rounded-md p-2">
            <div ref={pageBoxRef} className="relative mx-auto bg-white shadow-[var(--shadow-sm)]"
              style={{ width: `min(100%, ${aspect * 78}vh)`, aspectRatio: `${aspect}` }}
              onPointerDown={() => setSel(null)} onPointerMove={(e) => { imgMove(e); tbMove(e) }} onPointerUp={up} onPointerCancel={up}>
              <img ref={pageImgRef} src={pages[pi].url} alt="" className="absolute inset-0 w-full h-full pointer-events-none select-none" draggable={false} crossOrigin="anonymous" />

              {/* images — bounding box with 8 resize handles + a rotate handle */}
              {pageObjects.filter((o) => o.kind === 'image').map((o) => {
                const t = xf.get(o.id)
                const isDel = deleted.has(o.id)
                const on = sel === o.id
                const clip = clips.current.get(o.id)
                const b = t || { cx: o.x + o.w / 2, cy: o.y + o.h / 2, w: o.w, h: o.h, rot: 0 }
                const orig = { left: `${o.x * 100}%`, top: `${o.y * 100}%`, width: `${o.w * 100}%`, height: `${o.h * 100}%` }
                const box = { left: `${(b.cx - b.w / 2) * 100}%`, top: `${(b.cy - b.h / 2) * 100}%`, width: `${b.w * 100}%`, height: `${b.h * 100}%`, transform: `rotate(${b.rot}rad)`, transformOrigin: 'center' }
                if (isDel) return (
                  <div key={o.id}>
                    <div className="absolute bg-white pointer-events-none" style={orig} />
                    <button type="button" onClick={() => toggleDelete(o.id)} data-testid="edit-undo" title={s.undo}
                      className="absolute outline outline-1 outline-[color:var(--danger)] bg-transparent cursor-pointer" style={orig} />
                  </div>
                )
                return (
                  <div key={o.id}>
                    {t && <div className="absolute bg-white pointer-events-none" style={orig} />}
                    <div data-testid="edit-obj-image"
                      className={`absolute cursor-move touch-none ${on ? 'outline outline-2 outline-green-600' : 'hover:outline hover:outline-1 hover:outline-green-500'}`}
                      style={box} onPointerDown={(e) => imgStart(e, o, 'move')}>
                      {t && clip && <img src={clip} alt="" draggable={false} className="absolute inset-0 w-full h-full pointer-events-none" style={{ objectFit: 'fill' }} />}
                      {on && (
                        <>
                          {HANDLES.map((h) => (
                            <span key={h} data-handle={h} onPointerDown={(e) => imgStart(e, o, 'resize', h)}
                              className="absolute w-3 h-3 bg-white border-2 border-green-600 rounded-full touch-none"
                              style={{ left: h.includes('w') ? '-6px' : h.includes('e') ? 'calc(100% - 6px)' : 'calc(50% - 6px)', top: h.includes('n') ? '-6px' : h.includes('s') ? 'calc(100% - 6px)' : 'calc(50% - 6px)', cursor: `${h}-resize` }} />
                          ))}
                          {/* rotate handle above the top edge */}
                          <span className="absolute left-1/2 -top-6 w-px h-6 bg-green-600 pointer-events-none" />
                          <span data-handle="rot" onPointerDown={(e) => imgStart(e, o, 'rotate')}
                            className="absolute left-1/2 -top-6 -translate-x-1/2 -translate-y-1/2 w-4 h-4 bg-green-600 border-2 border-white rounded-full touch-none cursor-grab" aria-label="rotate" />
                          <button type="button" onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); toggleDelete(o.id) }} aria-label={s.del}
                            className="absolute -right-2 -bottom-2 w-6 h-6 rounded-full bg-[var(--danger)] text-white text-[0.7rem] grid place-items-center border-2 border-white cursor-pointer">✕</button>
                        </>
                      )}
                    </div>
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
