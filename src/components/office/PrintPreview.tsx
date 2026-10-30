// Print preview: the paged document from print.ts, shown as it will print, with
// the Print button on it. Full screen, because it is a different mode of looking
// at the document rather than a panel beside it.
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { OFFICE_STR } from './strings'
import { MM, printDocument, type Printable } from './print'

export function PrintPreview({ locale, build, onClose }: { locale: 'en' | 'ar'; build: () => Promise<Printable>; onClose: () => void }) {
  const s = OFFICE_STR[locale]
  const [doc, setDoc] = useState<Printable | null>(null)
  const [failed, setFailed] = useState(false)
  const [zoom, setZoom] = useState<number | null>(null)
  const [fit, setFit] = useState(1)
  const frameRef = useRef<HTMLIFrameElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let live = true
    build().then((d) => { if (live) setDoc(d) }, () => { if (live) setFailed(true) })
    return () => { live = false }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [onClose])

  // Fit the page's width to the screen: on a phone the page is shown whole, at its
  // real proportions, rather than re-flowed into a column.
  useEffect(() => {
    if (!doc) return
    const measure = () => { const w = wrapRef.current?.clientWidth || window.innerWidth; setFit(Math.min(1, (w - 24) / (doc.page.width * MM))) }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [doc])
  const z = zoom ?? fit
  const applyZoom = () => { const b = frameRef.current?.contentDocument?.body; if (b) (b.style as CSSStyleDeclaration & { zoom: string }).zoom = String(z) }
  useEffect(applyZoom, [z, doc]) // eslint-disable-line react-hooks/exhaustive-deps

  const step = (d: number) => setZoom(Math.max(0.25, Math.min(3, Math.round((z + d) * 20) / 20)))
  const btn = 'h-9 min-w-9 px-2.5 rounded-sm border border-[color:var(--line)] bg-[var(--surface)] text-ink text-[0.85rem] cursor-pointer disabled:opacity-40'
  return createPortal(
    <div className="fixed inset-0 z-[120] flex flex-col bg-[var(--bg)]" role="dialog" aria-modal="true" aria-label={s.printPreview} data-testid="office-preview">
      <div className="flex-none flex items-center gap-2 px-3 py-2 border-b border-[color:var(--line-soft)] bg-[var(--surface)] flex-wrap">
        <button type="button" className={btn} onClick={onClose} data-testid="office-preview-close" aria-label={s.close}>✕</button>
        <span className="font-semibold">{s.printPreview}</span>
        <span className="text-ink-soft text-[0.85rem]" data-testid="office-preview-pages" data-pages={doc?.pages ?? 0}>{doc ? s.pagesN(doc.pages) : failed ? s.previewFailed : s.preparing}</span>
        <span className="flex-1" />
        <button type="button" className={btn} onClick={() => step(-0.1)} aria-label={s.zoomOut} data-testid="office-preview-zoom-out" disabled={!doc}>−</button>
        <span className="w-12 text-center text-[0.85rem] tabular-nums" data-testid="office-preview-zoom">{Math.round(z * 100)}%</span>
        <button type="button" className={btn} onClick={() => step(0.1)} aria-label={s.zoomIn} data-testid="office-preview-zoom-in" disabled={!doc}>+</button>
        <button type="button" className={btn} onClick={() => setZoom(null)} aria-pressed={zoom === null} data-testid="office-preview-fit" disabled={!doc}>{s.fitWidth}</button>
        <button type="button" className={btn} onClick={() => setZoom(1)} aria-pressed={zoom === 1} data-testid="office-preview-actual" disabled={!doc}>100%</button>
        <button type="button" data-testid="office-preview-print" disabled={!doc} onClick={() => doc && printDocument(doc)}
          className="h-9 px-4 rounded-sm border-0 bg-green-600 text-white font-semibold cursor-pointer disabled:opacity-40">{s.print}</button>
      </div>
      <div ref={wrapRef} className="flex-1 min-h-0">
        {doc && <iframe ref={frameRef} title={s.printPreview} srcDoc={doc.html} onLoad={applyZoom} data-testid="office-preview-frame" className="w-full h-full border-0 block" />}
      </div>
    </div>,
    document.body,
  )
}
