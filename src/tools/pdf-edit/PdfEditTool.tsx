import { useEffect, useRef, useState } from 'react'
import { useLocale } from '../../i18n'
import { UploadIcon, DownloadIcon, InfoIcon, TrashIcon } from '../../components/icons'
import { Stack, Button, Spinner } from '../../components/ui'
import type { RenderedPage } from '../../lib/pdfRender'
import type { PageContent, EditObject, ImgXf } from './contentStream'
import type { EditResponse } from './edit.worker'

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
    tapImg: 'Select an image, then drag or arrow-keys to move · dots resize · top dot (or [ ]) rotates · Delete removes · pinch to zoom',
    privacy: 'Edited on your device — your PDF is never uploaded.',
  },
  ar: {
    drop: 'أفلت ملف PDF أو اضغط للاختيار', reading: 'جارٍ القراءة…',
    disclaimer: 'محرر مبدئي: حرّك أو احذف الصور، وأضِف نصًا جديدًا بمقابض لتغيير الحجم. لا يمكن تعديل أو حذف النص الموجود بعد، وبعض ملفات PDF غير الاعتيادية/الممسوحة قد لا تُعالَج بدقة. تُطبَّق التعديلات عند التصدير.',
    addText: 'أضف نصًا', del: 'حذف', undo: 'تراجع', size: 'الخط',
    page: 'صفحة', of: 'من', image: 'صورة', text: 'نص', moved: 'مُحرّك', typeHere: 'اكتب…',
    export: 'تنزيل PDF المعدّل', working: 'جارٍ التحضير…', another: 'عدّل آخر', locked: 'هذا الملف مقفل / مشفّر.',
    tapImg: 'حدّد صورة ثم اسحبها أو استخدم الأسهم للتحريك · النقاط للتحجيم · النقطة العلوية (أو [ ]) للتدوير · Delete للحذف · اقرص للتكبير',
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
  const workerRef = useRef<Worker | null>(null)
  const reqRef = useRef(0)
  const [boxH, setBoxH] = useState(0)
  const pageImgRef = useRef<HTMLImageElement>(null)
  const clips = useRef<Map<string, string>>(new Map())
  const covers = useRef<Map<string, string>>(new Map())

  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
  const nrm = (e: React.PointerEvent) => {
    const r = pageBoxRef.current!.getBoundingClientRect()
    return { nx: (e.clientX - r.left) / r.width, ny: (e.clientY - r.top) / r.height }
  }

  // Content-stream parsing + the final rebuild run in edit.worker.ts (#154).
  function editWorker(): Worker {
    workerRef.current ??= new Worker(new URL('./edit.worker.ts', import.meta.url), { type: 'module' })
    return workerRef.current
  }
  function workerCall(req:
    | { op: 'load'; buf: ArrayBuffer }
    | { op: 'save'; file: File; pc: PageContent[]; deleted: Set<string>; xf: Map<string, ImgXf>; texts: TextBox[] },
  ): Promise<EditResponse> {
    const worker = editWorker()
    const id = ++reqRef.current
    return new Promise((resolve) => {
      const onMessage = (e: MessageEvent<EditResponse>) => {
        if (e.data.id !== id) return
        worker.removeEventListener('message', onMessage)
        resolve(e.data)
      }
      worker.addEventListener('message', onMessage)
      worker.postMessage({ ...req, id })
    })
  }

  useEffect(() => () => { workerRef.current?.terminate() }, [])

  async function onFile(f: File | null | undefined) {
    if (!f || !(f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'))) return
    setBusy(true); setErr(''); setOut(null); setDeleted(new Set()); setXf(new Map()); setTexts([]); setSel(null); setPi(0); clips.current = new Map()
    try {
      const { renderPdf } = await import('../../lib/pdfRender')
      const [rendered, loaded] = await Promise.all([
        renderPdf(await f.arrayBuffer(), 2, true),
        workerCall({ op: 'load', buf: await f.arrayBuffer() }),
      ])
      const pcPages = loaded.op === 'load' ? loaded.pages : null
      if (!pcPages) throw new Error('unreadable')
      setFile(f); setPages(rendered); setPc(pcPages); covers.current = new Map()
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
  const gi = useRef<{ mode: 'move' | 'resize' | 'rotate'; id: string; handle?: Handle; sx: number; sy: number; rw: number; rh: number; cxpx: number; cypx: number; aspect: number; start: ImgXf } | null>(null)

  const xfOf = (o: EditObject): ImgXf => xf.get(o.id) || { cx: o.x + o.w / 2, cy: o.y + o.h / 2, w: o.w, h: o.h, rot: 0 }

  // The clean, real extracted image (transparent) matched to this object by rect;
  // falls back to a crop of the page raster if extraction missed it.
  function extractedFor(o: EditObject): string | null {
    const imgs = pages?.[o.page]?.images
    if (!imgs?.length) return null
    const ocx = o.x + o.w / 2, ocy = o.y + o.h / 2
    let best: (typeof imgs)[number] | null = null, bd = Infinity
    for (const im of imgs) {
      const d = Math.hypot(im.x + im.w / 2 - ocx, im.y + im.h / 2 - ocy) + Math.abs(im.w - o.w) + Math.abs(im.h - o.h)
      if (d < bd) { bd = d; best = im }
    }
    return best && bd < 0.12 ? best.url : null
  }
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
  // Sample the page just outside the image so the "vacated" cover blends with the
  // background (white looked wrong on coloured pages).
  function sampleBg(o: EditObject): string {
    const img = pageImgRef.current
    if (!img?.naturalWidth) return '#ffffff'
    try {
      const c = document.createElement('canvas'); c.width = 1; c.height = 1
      const x = c.getContext('2d'); if (!x) return '#ffffff'
      const px = Math.round((o.x + o.w / 2) * img.naturalWidth)
      const py = Math.round(Math.max(0, (o.y - 0.006) * img.naturalHeight))
      x.drawImage(img, px, py, 1, 1, 0, 0, 1, 1)
      const d = x.getImageData(0, 0, 1, 1).data
      return `rgb(${d[0]},${d[1]},${d[2]})`
    } catch { return '#ffffff' }
  }
  function ensureClip(o: EditObject) {
    if (clips.current.has(o.id)) return
    const c = extractedFor(o) || cropImage(o)
    if (c) clips.current.set(o.id, c)
    covers.current.set(o.id, sampleBg(o))
  }
  function imgStart(e: React.PointerEvent, o: EditObject, mode: 'move' | 'resize' | 'rotate', handle?: Handle) {
    e.stopPropagation(); e.preventDefault()
    setSel(o.id)
    if (deleted.has(o.id)) return
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    ensureClip(o)
    const r = pageBoxRef.current!.getBoundingClientRect()
    const st = xfOf(o)
    const aspect = (o.w * r.width) / (o.h * r.height) // image's true w:h in screen px
    gi.current = { mode, id: o.id, handle, sx: e.clientX, sy: e.clientY, rw: r.width, rh: r.height, cxpx: r.left + st.cx * r.width, cypx: r.top + st.cy * r.height, aspect, start: st }
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
      let nW = Math.max(14, W0 + sX * lx), nH = Math.max(14, H0 + sY * ly)
      // Corner handles snap to the image's true proportions when close (within
      // ~16px); drag further and it breaks away to a free (distorted) resize.
      if (sX !== 0 && sY !== 0 && d.aspect > 0) {
        const propH = nW / d.aspect
        if (Math.abs(nH - propH) < 16) nH = propH
      }
      const lsx = (sX * (nW - W0)) / 2, lsy = (sY * (nH - H0)) / 2 // centre shifts half the growth
      const csx = lsx * c - lsy * s, csy = lsx * s + lsy * c
      next = { cx: st.cx + csx / d.rw, cy: st.cy + csy / d.rh, w: nW / d.rw, h: nH / d.rh, rot: st.rot }
    }
    setXf((cur) => { const m = new Map(cur); m.set(d.id, next); return m }); setOut(null)
  }
  function toggleDelete(id: string) {
    setDeleted((cur) => { const s2 = new Set(cur); s2.has(id) ? s2.delete(id) : s2.add(id); return s2 }); setOut(null)
  }
  function bumpImg(o: EditObject, patch: Partial<ImgXf>) {
    ensureClip(o)
    setXf((cur) => { const m = new Map(cur); m.set(o.id, { ...xfOf(o), ...patch }); return m }); setOut(null)
  }

  // Keyboard nudge/rotate/resize/delete for the selected object — also makes the
  // tool keyboard-accessible and gives tests a deterministic way to drive it.
  useEffect(() => {
    if (!sel) return
    function onKey(e: KeyboardEvent) {
      const ae = document.activeElement
      if (editing || (ae && (ae.tagName === 'TEXTAREA' || ae.tagName === 'INPUT'))) return
      const img = pc?.[pi]?.objects.find((o) => o.id === sel && o.kind === 'image')
      const tb = texts.find((t) => t.id === sel)
      if (!img && !tb) return
      const step = e.shiftKey ? 0.02 : 0.004
      const k = e.key
      if (k === 'Delete' || k === 'Backspace') { img ? toggleDelete(img.id) : delText(tb!.id); e.preventDefault(); return }
      let dx = 0, dy = 0
      if (k === 'ArrowLeft') dx = -step; else if (k === 'ArrowRight') dx = step
      else if (k === 'ArrowUp') dy = -step; else if (k === 'ArrowDown') dy = step
      if (dx || dy) {
        if (img) { const b = xfOf(img); bumpImg(img, { cx: clamp(b.cx + dx, 0, 1), cy: clamp(b.cy + dy, 0, 1) }) }
        else if (tb) setTexts((c) => c.map((t) => (t.id === tb.id ? { ...t, x: clamp(t.x + dx, 0, 1 - t.w), y: clamp(t.y + dy, 0, 1 - t.h) } : t)))
        setOut(null); e.preventDefault(); return
      }
      if (img) {
        const b = xfOf(img)
        if (k === '[') { bumpImg(img, { rot: b.rot - 0.0349 }); e.preventDefault() }        // −2°
        else if (k === ']') { bumpImg(img, { rot: b.rot + 0.0349 }); e.preventDefault() }    // +2°
        else if (k === '-' || k === '_') { bumpImg(img, { w: b.w * 0.95, h: b.h * 0.95 }); e.preventDefault() }
        else if (k === '=' || k === '+') { bumpImg(img, { w: b.w * 1.0526, h: b.h * 1.0526 }); e.preventDefault() }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [sel, editing, pc, pi, texts, xf]) // eslint-disable-line react-hooks/exhaustive-deps

  // Track the rendered page height so text-box font sizes map points → real px.
  useEffect(() => {
    const el = pageBoxRef.current; if (!el) return
    const ro = new ResizeObserver(() => setBoxH(el.clientHeight))
    ro.observe(el); setBoxH(el.clientHeight)
    return () => ro.disconnect()
  }, [pages, pi])

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

  function saveBlob(url: string) {
    const a = document.createElement('a'); a.href = url; a.download = (file?.name.replace(/\.pdf$/i, '') || 'edited') + '-edited.pdf'
    document.body.appendChild(a); a.click(); a.remove()
  }
  async function download() {
    if (!file || !pc) return
    if (out) { saveBlob(out.url); return } // already built — just download again
    setBusy(true); setErr('')
    try {
      const res = await workerCall({ op: 'save', file, pc, deleted, xf, texts })
      const blob = res.op === 'save' ? res.blob : null
      if (!blob) { setErr(s.locked); return }
      const url = URL.createObjectURL(blob)
      setOut((p) => { if (p) URL.revokeObjectURL(p.url); return { url, size: blob.size } })
      saveBlob(url) // download in the same click
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
                const cover = covers.current.get(o.id) || '#ffffff'
                const orig = { left: `${o.x * 100}%`, top: `${o.y * 100}%`, width: `${o.w * 100}%`, height: `${o.h * 100}%` }
                const origCover = { ...orig, background: cover }
                const box = { left: `${(b.cx - b.w / 2) * 100}%`, top: `${(b.cy - b.h / 2) * 100}%`, width: `${b.w * 100}%`, height: `${b.h * 100}%`, transform: `rotate(${b.rot}rad)`, transformOrigin: 'center' }
                if (isDel) return (
                  <div key={o.id}>
                    <div className="absolute pointer-events-none" style={origCover} />
                    <button type="button" onClick={() => toggleDelete(o.id)} data-testid="edit-undo" title={s.undo}
                      className="absolute outline outline-1 outline-[color:var(--danger)] bg-transparent cursor-pointer" style={orig} />
                  </div>
                )
                return (
                  <div key={o.id}>
                    {t && <div className="absolute pointer-events-none" style={origCover} />}
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
                          {/* delete below the bottom edge (mirrors the rotate handle above), so it clears the corner handles */}
                          <span className="absolute left-1/2 top-full h-6 w-px bg-[var(--danger)]/60 -translate-x-1/2 pointer-events-none" />
                          <button type="button" onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); toggleDelete(o.id) }} aria-label={s.del}
                            className="absolute left-1/2 top-full mt-6 -translate-x-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-[var(--danger)] text-white grid place-items-center border-2 border-white cursor-pointer shadow-[var(--shadow-sm)] [&_svg]:w-4 [&_svg]:h-4"><TrashIcon /></button>
                        </>
                      )}
                    </div>
                  </div>
                )
              })}

              {/* inserted text boxes */}
              {curTexts.map((t) => {
                const on = sel === t.id
                // Real px (points → screen), and Helvetica to match the exported
                // font — textareas otherwise default to monospace.
                const fs = { fontSize: `${boxH > 0 ? (t.size * boxH) / pc[pi].hPt : t.size}px`, fontFamily: 'Helvetica, Arial, sans-serif', lineHeight: 1.2 }
                return (
                  <div key={t.id} data-testid="edit-textbox"
                    className={`absolute touch-none ${on ? 'outline outline-2 outline-green-600' : 'outline-dashed outline-1 outline-green-500/60'}`}
                    style={{ left: `${t.x * 100}%`, top: `${t.y * 100}%`, width: `${t.w * 100}%`, height: `${t.h * 100}%` }}
                    onPointerDown={(e) => tbDown(e, t)}
                    onDoubleClick={() => setEditing(t.id)}>
                    {editing === t.id ? (
                      <textarea autoFocus value={t.text} onChange={(e) => { setTexts((c) => c.map((x) => x.id === t.id ? { ...x, text: e.target.value } : x)); setOut(null) }}
                        onBlur={() => setEditing(null)} onPointerDown={(e) => e.stopPropagation()}
                        className="w-full h-full resize-none bg-[color-mix(in_srgb,var(--green-400)_8%,white)] border-0 outline-none p-0 text-ink overflow-hidden"
                        style={fs} data-testid="edit-textarea" />
                    ) : (
                      <div className="w-full h-full whitespace-pre-wrap break-words text-ink overflow-hidden" style={fs} onClick={() => setEditing(t.id)}>
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
                          <button type="button" onPointerDown={(e) => e.stopPropagation()} onClick={() => delText(t.id)} aria-label={s.del} className="w-6 h-6 rounded-sm bg-[var(--danger)] text-white border-0 cursor-pointer grid place-items-center [&_svg]:w-4 [&_svg]:h-4"><TrashIcon /></button>
                        </span>
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* export — one click builds AND downloads */}
          <div className="flex items-center gap-2">
            <Button variant="primary" data-testid="edit-export" disabled={busy} onClick={download}>
              <DownloadIcon /> {busy ? s.working : s.export}{out ? ` · ${(out.size / 1024).toFixed(0)} KB` : ''}
            </Button>
            <Button onClick={() => { setFile(null); setPages(null); setPc(null); setOut(null) }}>{s.another}</Button>
          </div>
        </div>
      )}

      <p className="text-[0.8rem] text-ink-faint flex items-center gap-[0.4rem]"><span aria-hidden="true">🔒</span> {s.privacy}</p>
    </Stack>
  )
}
