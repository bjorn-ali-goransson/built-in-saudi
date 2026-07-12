import { useEffect, useRef, useState } from 'react'
import { useLocale } from '../../i18n'
import { UploadIcon, DownloadIcon } from '../../components/icons'
import { Stack, Button, Spinner } from '../../components/ui'
import type { RenderedPage } from '../../lib/pdfRender'
import SignaturePad from './SignaturePad'

type Sig = { url: string; w: number; h: number }
type Placement = { id: string; page: number; x: number; y: number; w: number } // x,y,w normalised

const SAVE_KEY = 'bis-sign-sig'
const MIN_W = 0.07

const STR = {
  en: {
    signStep: '1 · Your signature', signHere: 'Sign here with your finger or mouse', clear: 'Clear',
    saved: 'Saved signature', useSaved: 'Use saved', redraw: 'Draw again', dlSig: 'Download PNG', sigNote: 'Kept only on this device.',
    docStep: '2 · Your document', drop: 'Drop a PDF, or tap to choose', reading: 'Reading…',
    add: 'Place signature', size: 'Size', del: 'Remove', page: 'Page', of: 'of', tapHint: 'Drag to move · pinch or drag the corner to resize',
    needSig: 'Draw your signature above first.', place: 'Tap “Place signature”, then drag it where it belongs.',
    export: 'Download signed PDF', working: 'Preparing…', another: 'Sign another', locked: 'This PDF is locked / encrypted.',
    privacy: 'Signed on your device — your PDF is never uploaded.',
  },
  ar: {
    signStep: '١ · توقيعك', signHere: 'وقّع هنا بإصبعك أو بالفأرة', clear: 'مسح',
    saved: 'توقيع محفوظ', useSaved: 'استخدم المحفوظ', redraw: 'ارسم من جديد', dlSig: 'تنزيل PNG', sigNote: 'يُحفظ على جهازك فقط.',
    docStep: '٢ · مستندك', drop: 'أفلت ملف PDF أو اضغط للاختيار', reading: 'جارٍ القراءة…',
    add: 'ضع التوقيع', size: 'الحجم', del: 'إزالة', page: 'صفحة', of: 'من', tapHint: 'اسحب للتحريك · اقرص أو اسحب الزاوية لتغيير الحجم',
    needSig: 'ارسم توقيعك بالأعلى أولًا.', place: 'اضغط «ضع التوقيع» ثم اسحبه إلى مكانه.',
    export: 'تنزيل PDF الموقّع', working: 'جارٍ التحضير…', another: 'وقّع آخر', locked: 'هذا الملف مقفل / مشفّر.',
    privacy: 'يُوقّع على جهازك — لا يُرفع ملفك أبدًا.',
  },
}

let uid = 0

export default function PdfSignTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const fileRef = useRef<HTMLInputElement>(null)

  const [sig, setSig] = useState<Sig | null>(null)
  const [savedSig, setSavedSig] = useState<Sig | null>(null)
  const [redraw, setRedraw] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [pages, setPages] = useState<RenderedPage[] | null>(null)
  const [pi, setPi] = useState(0)
  const [placements, setPlacements] = useState<Placement[]>([])
  const [sel, setSel] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [out, setOut] = useState<{ url: string; size: number } | null>(null)

  const pageBoxRef = useRef<HTMLDivElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const loupeRef = useRef<HTMLCanvasElement>(null)
  const [loupe, setLoupe] = useState<{ x: number; y: number } | null>(null)

  // Restore a previously drawn signature.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(SAVE_KEY)
      if (raw) setSavedSig(JSON.parse(raw))
    } catch { /* ignore */ }
  }, [])

  function commitSig(next: Sig | null) {
    setSig(next)
    if (next) {
      try { localStorage.setItem(SAVE_KEY, JSON.stringify(next)); setSavedSig(next) } catch { /* ignore */ }
    }
  }

  // Height of a placement as a fraction of page height, from its width fraction
  // and the signature/page aspect ratios (keeps the signature undistorted).
  function hNorm(w: number) {
    const pg = pages?.[pi]
    if (!pg || !sig) return w
    return w * (pg.wPt / pg.hPt) * (sig.h / sig.w)
  }
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

  async function onFile(f: File | null | undefined) {
    if (!f || !(f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'))) return
    setBusy(true); setErr(''); setOut(null); setPlacements([]); setSel(null); setPi(0)
    try {
      const { renderPdf } = await import('../../lib/pdfRender')
      const rendered = await renderPdf(await f.arrayBuffer())
      setFile(f); setPages(rendered)
    } catch {
      setErr(s.locked); setFile(null); setPages(null)
    } finally { setBusy(false) }
  }

  function addSignature() {
    if (!sig || !pages) return
    const w = 0.34
    const id = `s${uid++}`
    setPlacements((cur) => [...cur, { id, page: pi, x: clamp(0.5 - w / 2, 0, 1 - w), y: clamp(0.5 - hNorm(w) / 2, 0, 1 - hNorm(w)), w }])
    setSel(id); setOut(null)
  }
  function update(id: string, patch: Partial<Placement>) {
    setPlacements((cur) => cur.map((p) => (p.id === id ? { ...p, ...patch } : p))); setOut(null)
  }
  function del(id: string) { setPlacements((cur) => cur.filter((p) => p.id !== id)); setSel(null); setOut(null) }

  // ---- Drag / pinch on a placement -------------------------------------------
  const g = useRef<{ pointers: Map<number, { x: number; y: number }>; base: null | { count: number; cx: number; cy: number; dist: number; x: number; y: number; w: number; hN: number } }>({ pointers: new Map(), base: null })

  function info() {
    const rect = pageBoxRef.current!.getBoundingClientRect()
    const ps = [...g.current.pointers.values()].map((p) => ({ x: (p.x - rect.left) / rect.width, y: (p.y - rect.top) / rect.height }))
    if (ps.length >= 2) {
      const a = ps[0], b = ps[1]
      return { count: 2, cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2, dist: Math.hypot(a.x - b.x, a.y - b.y) }
    }
    const p = ps[0] || { x: 0, y: 0 }
    return { count: 1, cx: p.x, cy: p.y, dist: 0 }
  }
  function baseline(pl: Placement) {
    const i = info()
    g.current.base = { count: i.count, cx: i.cx, cy: i.cy, dist: i.dist, x: pl.x, y: pl.y, w: pl.w, hN: hNorm(pl.w) }
  }
  function onPointerDown(e: React.PointerEvent, pl: Placement) {
    e.preventDefault(); e.stopPropagation()
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    setSel(pl.id)
    g.current.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
    baseline(pl)
  }
  function onPointerMove(e: React.PointerEvent, pl: Placement) {
    if (!g.current.pointers.has(e.pointerId)) return
    e.preventDefault()
    g.current.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const base = g.current.base
    if (!base) return
    const cur = info()
    if (cur.count !== base.count) { baseline(pl); return } // finger added/lifted → re-anchor, no jump
    if (cur.count === 1) {
      const w = base.w, hN = base.hN
      update(pl.id, { x: clamp(base.x + (cur.cx - base.cx), 0, 1 - w), y: clamp(base.y + (cur.cy - base.cy), 0, 1 - hN) })
      drawLoupe(e.clientX, e.clientY)
    } else {
      const ratio = base.dist > 0 ? cur.dist / base.dist : 1
      const w = clamp(base.w * ratio, MIN_W, 1)
      const hN = hNorm(w)
      const cx = base.cx + (cur.cx - base.cx) + (base.x + base.w / 2 - base.cx) // keep element under the pinch centre
      const cy = base.cy + (cur.cy - base.cy) + (base.y + base.hN / 2 - base.cy)
      update(pl.id, { w, x: clamp(cx - w / 2, 0, 1 - w), y: clamp(cy - hN / 2, 0, 1 - hN) })
    }
  }
  function onPointerUp(e: React.PointerEvent, pl: Placement) {
    g.current.pointers.delete(e.pointerId)
    setLoupe(null)
    if (g.current.pointers.size) baseline(pl); else g.current.base = null
  }

  // ---- Corner resize handle ---------------------------------------------------
  const rs = useRef<{ nx: number; w: number } | null>(null)
  function resizeDown(e: React.PointerEvent, pl: Placement) {
    e.preventDefault(); e.stopPropagation()
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    const rect = pageBoxRef.current!.getBoundingClientRect()
    rs.current = { nx: (e.clientX - rect.left) / rect.width, w: pl.w }
    setSel(pl.id)
  }
  function resizeMove(e: React.PointerEvent, pl: Placement) {
    if (!rs.current) return
    e.preventDefault()
    const rect = pageBoxRef.current!.getBoundingClientRect()
    const nx = (e.clientX - rect.left) / rect.width
    const w = clamp(rs.current.w + (nx - rs.current.nx), MIN_W, 1 - pl.x)
    update(pl.id, { w })
    drawLoupe(e.clientX, e.clientY)
  }
  function resizeUp() { rs.current = null; setLoupe(null) }

  // ---- Magnifier --------------------------------------------------------------
  function drawLoupe(clientX: number, clientY: number) {
    const img = imgRef.current, cv = loupeRef.current, box = pageBoxRef.current
    if (!img || !cv || !box) return
    const rect = box.getBoundingClientRect()
    const nx = (clientX - rect.left) / rect.width, ny = (clientY - rect.top) / rect.height
    const size = 132, zoom = 2.6, sw = size / zoom
    const ctx = cv.getContext('2d')!
    ctx.clearRect(0, 0, size, size)
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, size, size)
    ctx.drawImage(img, nx * img.naturalWidth - sw / 2, ny * img.naturalHeight - sw / 2, sw, sw, 0, 0, size, size)
    ctx.strokeStyle = 'rgba(26,83,208,.75)'; ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(size / 2, 0); ctx.lineTo(size / 2, size); ctx.moveTo(0, size / 2); ctx.lineTo(size, size / 2); ctx.stroke()
    setLoupe({ x: clientX, y: clientY })
  }

  async function download() {
    if (!file || !sig || !placements.length) return
    setBusy(true); setErr('')
    try {
      const { PDFDocument } = await import('pdf-lib')
      const pdf = await PDFDocument.load(await file.arrayBuffer())
      const png = await pdf.embedPng(sig.url)
      const pgs = pdf.getPages()
      for (const pl of placements) {
        const page = pgs[pl.page]; if (!page) continue
        const W = page.getWidth(), H = page.getHeight()
        const w = pl.w * W, h = w * (sig.h / sig.w)
        page.drawImage(png, { x: pl.x * W, y: H - pl.y * H - h, width: w, height: h })
      }
      const bytes = await pdf.save()
      const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' })
      setOut((prev) => { if (prev) URL.revokeObjectURL(prev.url); return { url: URL.createObjectURL(blob), size: blob.size } })
    } catch {
      setErr(s.locked)
    } finally { setBusy(false) }
  }

  const pagePlacements = placements.filter((p) => p.page === pi)

  return (
    <Stack data-testid="pdf-sign">
      {/* Step 1 — signature */}
      <section className="flex flex-col gap-2">
        <h2 className="text-[0.95rem] font-semibold text-ink">{s.signStep}</h2>
        {sig && !redraw ? (
          <div className="flex items-center gap-3 flex-wrap">
            <div className="h-16 min-w-[8rem] max-w-[16rem] rounded-md border border-[color:var(--line)] bg-white grid place-items-center px-3">
              <img src={sig.url} alt="" className="max-h-12 max-w-full" />
            </div>
            <Button href={sig.url} download="signature.png" data-testid="sign-download-png"><DownloadIcon /> {s.dlSig}</Button>
            <Button onClick={() => { setRedraw(true); setSig(null) }}>{s.redraw}</Button>
            <span className="text-[0.8rem] text-ink-faint">{s.sigNote}</span>
          </div>
        ) : (
          <>
            <SignaturePad onChange={commitSig} label={s.signHere} clearLabel={s.clear} />
            {savedSig && (
              <button type="button" onClick={() => { commitSig(savedSig); setRedraw(false) }} data-testid="sign-use-saved"
                className="self-start inline-flex items-center gap-2 text-[0.85rem] text-green-700 hover:text-green-600 bg-transparent border-0 cursor-pointer">
                <img src={savedSig.url} alt="" className="h-6 max-w-[6rem] rounded-sm border border-[color:var(--line-soft)] bg-white" /> {s.useSaved}
              </button>
            )}
          </>
        )}
      </section>

      {/* Step 2 — document */}
      <section className="flex flex-col gap-2">
        <h2 className="text-[0.95rem] font-semibold text-ink">{s.docStep}</h2>
        {!pages && (
          <button className="flex flex-col items-center gap-[0.4rem] py-8 px-4 border-2 border-dashed border-[color:var(--line)] rounded-[var(--r-md)] bg-[var(--surface)] text-center cursor-pointer hover:border-[color:color-mix(in_srgb,var(--green-500)_45%,transparent)] hover:bg-[color-mix(in_srgb,var(--green-400)_6%,transparent)]"
            data-testid="sign-drop" onClick={() => fileRef.current?.click()}
            onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); onFile(e.dataTransfer.files?.[0]) }}>
            {busy ? <Spinner className="size-7" label={s.reading} /> : <><UploadIcon /><span>{s.drop}</span></>}
            <input ref={fileRef} type="file" accept="application/pdf" className="absolute w-px h-px opacity-0" onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = '' }} />
          </button>
        )}
        {err && <p className="text-[color:var(--danger)] text-[0.9rem]" data-testid="sign-err">{err}</p>}

        {pages && (
          <div className="flex flex-col gap-3">
            {/* toolbar */}
            <div className="flex items-center gap-2 flex-wrap">
              <Button data-testid="sign-add" variant="primary" disabled={!sig} onClick={addSignature}>{s.add}</Button>
              {pages.length > 1 && (
                <span className="inline-flex items-center gap-1 text-[0.85rem] text-ink-soft">
                  <Button className="px-2 min-w-[2rem] justify-center" disabled={pi === 0} onClick={() => setPi((v) => v - 1)}>‹</Button>
                  {s.page} {pi + 1} {s.of} {pages.length}
                  <Button className="px-2 min-w-[2rem] justify-center" disabled={pi === pages.length - 1} onClick={() => setPi((v) => v + 1)}>›</Button>
                </span>
              )}
              {sel && pagePlacements.some((p) => p.id === sel) && (
                <label className="inline-flex items-center gap-2 text-[0.85rem] text-ink-soft">
                  {s.size}
                  <input type="range" min={7} max={100} value={Math.round((pagePlacements.find((p) => p.id === sel)!.w) * 100)}
                    onChange={(e) => update(sel, { w: clamp(Number(e.target.value) / 100, MIN_W, 1 - pagePlacements.find((p) => p.id === sel)!.x) })} className="accent-green-600" />
                  <Button className="px-2 min-w-[2rem] justify-center" data-testid="sign-del" onClick={() => del(sel)} aria-label={s.del}>✕</Button>
                </label>
              )}
            </div>
            {!sig && <p className="text-[0.85rem] text-gold-500">{s.needSig}</p>}
            {sig && !pagePlacements.length && <p className="text-[0.85rem] text-ink-faint">{s.place}</p>}

            {/* page canvas */}
            <div ref={pageBoxRef} className="relative mx-auto max-w-full bg-white shadow-[var(--shadow-sm)] select-none touch-none"
              style={{ width: '100%', maxWidth: pages[pi] ? `${(pages[pi].wPt / pages[pi].hPt) * 70}vh` : undefined }}
              onPointerDown={() => setSel(null)}>
              <img ref={imgRef} src={pages[pi].url} alt="" className="block w-full h-auto pointer-events-none" draggable={false} />
              {sig && pagePlacements.map((pl) => {
                const hN = hNorm(pl.w)
                const on = sel === pl.id
                return (
                  <div key={pl.id} data-testid="sign-placement"
                    className={`absolute touch-none ${on ? 'outline outline-2 outline-green-600' : ''}`}
                    style={{ left: `${pl.x * 100}%`, top: `${pl.y * 100}%`, width: `${pl.w * 100}%`, height: `${hN * 100}%` }}
                    onPointerDown={(e) => onPointerDown(e, pl)} onPointerMove={(e) => onPointerMove(e, pl)}
                    onPointerUp={(e) => onPointerUp(e, pl)} onPointerCancel={(e) => onPointerUp(e, pl)}>
                    <img src={sig.url} alt="" className="block w-full h-full pointer-events-none" draggable={false} />
                    {on && (
                      <span onPointerDown={(e) => resizeDown(e, pl)} onPointerMove={(e) => resizeMove(e, pl)} onPointerUp={resizeUp} onPointerCancel={resizeUp}
                        className="absolute -right-2 -bottom-2 w-5 h-5 rounded-full bg-green-600 border-2 border-white cursor-se-resize touch-none" aria-hidden="true" />
                    )}
                  </div>
                )
              })}
            </div>
            <p className="text-[0.8rem] text-ink-faint text-center">{s.tapHint}</p>

            {/* export */}
            <div className="flex items-center gap-2">
              {!out ? (
                <Button variant="primary" data-testid="sign-export" disabled={busy || !placements.length} onClick={download}>
                  {busy ? s.working : s.export}
                </Button>
              ) : (
                <Button variant="primary" href={out.url} download="signed.pdf" data-testid="sign-download"><DownloadIcon /> {s.export} · {(out.size / 1024).toFixed(0)} KB</Button>
              )}
              {out && <Button onClick={() => { setFile(null); setPages(null); setPlacements([]); setOut(null) }}>{s.another}</Button>}
            </div>
          </div>
        )}
      </section>

      {loupe && (
        <div className="fixed z-[70] pointer-events-none rounded-full overflow-hidden border-2 border-green-600 shadow-[var(--shadow-md)]"
          style={{ left: loupe.x - 66, top: loupe.y - 150, width: 132, height: 132 }}>
          <canvas ref={loupeRef} width={132} height={132} className="block" />
        </div>
      )}

      <p className="text-[0.8rem] text-ink-faint flex items-center gap-[0.4rem]"><span aria-hidden="true">🔒</span> {s.privacy}</p>
    </Stack>
  )
}
