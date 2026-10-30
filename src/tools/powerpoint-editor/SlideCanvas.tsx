// The editing surface: the current slide, big, with everything you do to it by
// pointer — select, move with snapping guides, resize from any handle (also
// when rotated), rotate, drag a line's ends, rubber-band select, and draw new
// shapes. Dragging is previewed locally and committed on release; the editor
// decides what travels to collaborators while it happens.
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { SlideView, type RenderCtx } from './render'
import { HANDLES, resize, rotation, lineEnds, lineBox, snapMove, bounds, intersects, type Box, type Guide, type Handle } from './canvasGeom'
import { isLine, textRect } from './geom'
import { tableGrid } from './look'
import type { DeckData, El, Slide, TextBody, ShapeEl } from './model'

export type Tool = { kind: 'shape'; geom: string } | { kind: 'text' } | { kind: 'line'; arrow?: boolean }
export interface Transform { id: string; patch: Partial<El> }
export interface EditTarget { id: string; cell?: [number, number]; at?: { x: number; y: number } | null; /** A key typed over a selected box, which starts the edit. */ typed?: string }
export interface PeerSel { client: string; name: string; color: string; sel: string[] }

type Drag =
  | { k: 'move'; sx: number; sy: number; orig: Map<string, Box>; moved: boolean; dup: boolean; hit: string; at: { x: number; y: number } }
  | { k: 'resize'; h: Handle; orig: Box & { flipH?: boolean; flipV?: boolean }; id: string; aspect: boolean }
  | { k: 'rotate'; orig: Box; id: string }
  | { k: 'end'; which: 0 | 1; id: string; orig: Box & { flipH?: boolean; flipV?: boolean } }
  | { k: 'marquee'; sx: number; sy: number; x: number; y: number; add: string[] }
  | { k: 'draw'; sx: number; sy: number; x: number; y: number; tool: Tool }

export function SlideCanvas(p: {
  deck: DeckData; slide: Slide; number: number
  selection: string[]; onSelect: (ids: string[]) => void
  tool: Tool | null; onTool: (t: Tool | null) => void
  onCreate: (box: { x: number; y: number; w: number; h: number; flipH?: boolean; flipV?: boolean }, tool: Tool) => void
  onTransform: (ts: Transform[], phase: 'start' | 'move' | 'end', opts?: { duplicate?: boolean }) => void
  editing: EditTarget | null
  onEdit: (t: EditTarget | null) => void
  editor?: (rect: { x: number; y: number; w: number; h: number }) => ReactNode
  peers: PeerSel[]
  zoom: number | null
  readOnly: boolean
  ctx: Omit<RenderCtx, 'deck' | 'number'>
  onContext?: (e: React.MouseEvent, id: string | null) => void
  onScale?: (k: number) => void
}) {
  const { deck, slide } = p
  const S = deck.size
  const wrap = useRef<HTMLDivElement>(null)
  const layer = useRef<HTMLDivElement>(null)
  const [fit, setFit] = useState(0.5)
  const [drag, setDrag] = useState<Drag | null>(null)
  const dragRef = useRef<Drag | null>(null)
  dragRef.current = drag
  const [preview, setPreview] = useState<Map<string, Partial<El>>>(new Map())
  const [guides, setGuides] = useState<Guide[]>([])

  useLayoutEffect(() => {
    const el = wrap.current
    if (!el) return
    const measure = () => setFit(Math.max(0.05, Math.min((el.clientWidth - 48) / S.w, (el.clientHeight - 48) / S.h)))
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [S.w, S.h])
  const k = p.zoom ? fit * p.zoom : fit
  useEffect(() => { p.onScale?.(k) }, [k]) // eslint-disable-line react-hooks/exhaustive-deps

  const shown: Slide = useMemo(() => (preview.size ? { ...slide, elements: slide.elements.map((e) => (preview.has(e.id) ? ({ ...e, ...preview.get(e.id) } as El) : e)) } : slide), [slide, preview])
  const els = shown.elements
  const byId = (id: string) => els.find((e) => e.id === id)

  /** Client point → slide units. */
  const pt = (cx: number, cy: number) => {
    const r = layer.current!.getBoundingClientRect()
    return { x: (cx - r.left) / k, y: (cy - r.top) / k }
  }
  const tol = 6 / k

  const begin = (e: React.PointerEvent, d: Drag) => {
    e.preventDefault()
    e.stopPropagation()
    ;(e.currentTarget as Element).setPointerCapture?.(e.pointerId)
    setDrag(d)
    if (d.k === 'resize' || d.k === 'rotate' || d.k === 'end') p.onTransform([{ id: d.id, patch: {} }], 'start')
  }

  const onDownCanvas = (e: React.PointerEvent) => {
    if (e.button !== 0) return
    const at = pt(e.clientX, e.clientY)
    if (p.tool && !p.readOnly) { begin(e, { k: 'draw', sx: at.x, sy: at.y, x: at.x, y: at.y, tool: p.tool }); return }
    const t = (e.target as HTMLElement).closest('[data-el]') as HTMLElement | null
    const id = t?.dataset.el || null
    if (p.editing && id === p.editing.id) return
    if (!id) {
      if (p.editing) p.onEdit(null)
      begin(e, { k: 'marquee', sx: at.x, sy: at.y, x: at.x, y: at.y, add: e.shiftKey ? p.selection : [] })
      if (!e.shiftKey) p.onSelect([])
      return
    }
    let sel = p.selection
    if (e.shiftKey || e.metaKey || e.ctrlKey) sel = sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id]
    else if (!sel.includes(id)) sel = [id]
    p.onSelect(sel)
    if (p.readOnly || !sel.includes(id)) return
    const orig = new Map<string, Box>()
    for (const sid of sel) { const el = byId(sid); if (el) orig.set(sid, { x: el.x, y: el.y, w: el.w, h: el.h, rot: el.rot }) }
    begin(e, { k: 'move', sx: at.x, sy: at.y, orig, moved: false, dup: e.altKey, hit: id, at: { x: e.clientX, y: e.clientY } })
  }

  const onMove = (e: React.PointerEvent) => {
    const d = dragRef.current
    if (!d) return
    const at = pt(e.clientX, e.clientY)
    if (d.k === 'marquee' || d.k === 'draw') { setDrag({ ...d, x: at.x, y: at.y }); return }
    const next = new Map<string, Partial<El>>()
    if (d.k === 'move') {
      let dx = at.x - d.sx, dy = at.y - d.sy
      if (!d.moved && Math.hypot(dx, dy) * k < 3) return
      if (!d.moved) { setDrag({ ...d, moved: true }); p.onTransform([...d.orig.keys()].map((id) => ({ id, patch: {} })), 'start', { duplicate: d.dup }) }
      if (e.shiftKey) { if (Math.abs(dx) > Math.abs(dy)) dy = 0; else dx = 0 }
      const boxes = [...d.orig.values()].map(bounds)
      const u = { x: Math.min(...boxes.map((b) => b.x)), y: Math.min(...boxes.map((b) => b.y)), w: 0, h: 0 }
      u.w = Math.max(...boxes.map((b) => b.x + b.w)) - u.x
      u.h = Math.max(...boxes.map((b) => b.y + b.h)) - u.y
      const others = slide.elements.filter((x) => !d.orig.has(x.id)).map((x) => bounds(x))
      const sn = e.altKey ? { dx, dy, guides: [] } : snapMove(u, dx, dy, others, S, tol)
      setGuides(sn.guides)
      for (const [id, o] of d.orig) next.set(id, { x: round(o.x + sn.dx), y: round(o.y + sn.dy) })
    } else if (d.k === 'resize') {
      const el = byId(d.id)
      const r = resize(d.orig, d.h, at.x, at.y, { keepAspect: d.aspect !== e.shiftKey })
      next.set(d.id, { x: round(r.x), y: round(r.y), w: round(r.w), h: round(r.h) })
      void el
    } else if (d.k === 'rotate') {
      next.set(d.id, { rot: rotation(d.orig, at.x, at.y, e.shiftKey) || undefined })
    } else if (d.k === 'end') {
      const ends = lineEnds(d.orig)
      let pnt: [number, number] = [at.x, at.y]
      if (e.shiftKey) {
        // Horizontal, vertical or 45°: the three angles a line is usually meant to be at.
        const o = ends[d.which ? 0 : 1]
        const ang = Math.round(Math.atan2(pnt[1] - o[1], pnt[0] - o[0]) / (Math.PI / 4)) * (Math.PI / 4)
        const len = Math.hypot(pnt[0] - o[0], pnt[1] - o[1])
        pnt = [o[0] + Math.cos(ang) * len, o[1] + Math.sin(ang) * len]
      }
      const nb = d.which === 0 ? lineBox(pnt, ends[1]) : lineBox(ends[0], pnt)
      next.set(d.id, { x: round(nb.x), y: round(nb.y), w: round(nb.w), h: round(nb.h), flipH: nb.flipH, flipV: nb.flipV })
    }
    setPreview(next)
    p.onTransform([...next].map(([id, patch]) => ({ id, patch })), 'move')
  }

  const onUp = () => {
    const d = dragRef.current
    if (!d) return
    setDrag(null)
    setGuides([])
    if (d.k === 'marquee') {
      const m = norm(d.sx, d.sy, d.x, d.y)
      if (m.w * k > 3 || m.h * k > 3) p.onSelect([...new Set([...d.add, ...slide.elements.filter((x) => intersects(bounds(x), m)).map((x) => x.id)])])
      return
    }
    if (d.k === 'draw') {
      const m = norm(d.sx, d.sy, d.x, d.y)
      const click = m.w * k < 4 && m.h * k < 4
      if (d.tool.kind === 'line') {
        const nb = click ? { x: d.sx, y: d.sy, w: 200, h: 0 } : lineBox([d.sx, d.sy], [d.x, d.y])
        p.onCreate(nb, d.tool)
      } else if (click) {
        const w = d.tool.kind === 'text' ? 320 : 160, h = d.tool.kind === 'text' ? 48 : 100
        p.onCreate({ x: round(d.sx - (d.tool.kind === 'text' ? 0 : w / 2)), y: round(d.sy - (d.tool.kind === 'text' ? 0 : h / 2)), w, h }, d.tool)
      } else p.onCreate({ x: round(m.x), y: round(m.y), w: round(m.w), h: round(m.h) }, d.tool)
      p.onTool(null)
      return
    }
    if (d.k === 'move' && !d.moved) {
      setPreview(new Map())
      // An empty placeholder is a prompt to type — "Click to add title" means
      // exactly that, so a plain click puts the caret in it.
      const el = byId(d.hit)
      if (el?.kind === 'shape' && el.ph && d.orig.size === 1 && !el.text?.paras.some((pa) => pa.runs.some((r) => r.t.trim()))) p.onEdit({ id: el.id, at: d.at })
      return
    }
    const out = [...preview].map(([id, patch]) => ({ id, patch }))
    setPreview(new Map())
    p.onTransform(out, 'end')
  }

  const onDouble = (e: React.MouseEvent) => {
    if (p.readOnly) return
    // The press before this took pointer capture for a possible drag, so the
    // event is retargeted at the canvas: ask what is UNDER the pointer instead.
    const under = document.elementsFromPoint(e.clientX, e.clientY)
    const pick = (q: string) => (under.find((n) => n.closest(q))?.closest(q) as HTMLElement | null) || null
    const t = pick('[data-el]')
    const el = t ? byId(t.dataset.el!) : null
    if (!el) return
    if (el.kind === 'table') {
      const cell = pick('[data-cell]')
      if (cell) { const [r, c] = cell.dataset.cell!.split(':').map(Number); p.onEdit({ id: el.id, cell: [r, c], at: { x: e.clientX, y: e.clientY } }) }
      return
    }
    if (el.kind === 'shape' && !isLine(el.geom)) p.onEdit({ id: el.id, at: { x: e.clientX, y: e.clientY } })
  }

  const single = p.selection.length === 1 ? byId(p.selection[0]) : undefined
  const hs = 9 / k // handle size, constant on screen
  const editEl = p.editing ? byId(p.editing.id) : undefined
  const editRect = (() => {
    if (!editEl) return null
    if (editEl.kind === 'table' && p.editing!.cell) {
      const { xs, ys } = tableGrid(editEl)
      const [r, c] = p.editing!.cell
      const [rs, cs] = editEl.rows[r]?.cells[c]?.span || [1, 1]
      return { x: xs[c], y: ys[r], w: xs[Math.min(xs.length - 1, c + cs)] - xs[c], h: ys[Math.min(ys.length - 1, r + rs)] - ys[r] }
    }
    if (editEl.kind === 'shape') return textRect(editEl.geom, editEl.w, editEl.h)
    return null
  })()

  return (
    <div ref={wrap} className="relative flex-1 min-w-0 min-h-0 overflow-auto grid place-items-center bg-[color-mix(in_srgb,var(--ink)_7%,var(--bg))]" data-testid="sl-canvas-wrap"
      onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
      <div style={{ padding: 24 }}>
        <div
          ref={layer}
          data-testid="sl-canvas"
          data-scale={k}
          data-tool={p.tool ? p.tool.kind : undefined}
          onPointerDown={onDownCanvas}
          onDoubleClick={onDouble}
          onContextMenu={(e) => { const t = (e.target as HTMLElement).closest('[data-el]') as HTMLElement | null; if (p.onContext) { e.preventDefault(); p.onContext(e, t?.dataset.el || null) } }}
          style={{ width: S.w * k, height: S.h * k, cursor: p.tool ? 'crosshair' : drag?.k === 'move' ? 'move' : 'default', boxShadow: '0 1px 3px rgba(0,0,0,0.15), 0 8px 30px rgba(0,0,0,0.08)', position: 'relative', touchAction: 'none' }}
        >
          <SlideView slide={shown} width={S.w * k} ctx={{ ...p.ctx, deck, number: p.number, editing: p.editing?.cell ? undefined : p.editing?.id }} testid="sl-slide">
            {/* Everything below is in slide units, inside the same scaled layer. */}
            {editEl && editRect && p.editor && (
              <div style={{ position: 'absolute', left: editEl.x, top: editEl.y, width: editEl.w, height: editEl.h, transform: editEl.rot ? `rotate(${editEl.rot}deg)` : undefined }}>
                {p.editing?.cell && <div style={{ position: 'absolute', left: editRect.x, top: editRect.y, width: editRect.w, height: editRect.h, background: '#fff' }} />}
                {p.editor(editRect)}
              </div>
            )}
            {p.peers.flatMap((peer) => peer.sel.map((id) => { const el = byId(id); return el ? <div key={peer.client + id} data-testid="sl-peer" style={{ position: 'absolute', left: el.x - 3 / k, top: el.y - 3 / k, width: el.w + 6 / k, height: el.h + 6 / k, outline: `${2 / k}px solid ${peer.color}`, transform: el.rot ? `rotate(${el.rot}deg)` : undefined, pointerEvents: 'none' }}><span style={{ position: 'absolute', top: -16 / k, insetInlineStart: 0, fontSize: 10 / k, lineHeight: 1.4, padding: `0 ${4 / k}px`, background: peer.color, color: '#fff', borderRadius: 3 / k, whiteSpace: 'nowrap' }} dir="auto">{peer.name}</span></div> : null }))}
            {p.selection.map((id) => {
              const el = byId(id)
              if (!el) return null
              if (el.kind === 'shape' && isLine(el.geom)) {
                const [a, z] = lineEnds(el)
                return (
                  <svg key={id} data-testid="sl-selected" data-id={id} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible', maxWidth: 'none', pointerEvents: 'none' }} width={1} height={1}>
                    <line x1={a[0]} y1={a[1]} x2={z[0]} y2={z[1]} stroke="#0b6e4f" strokeWidth={1 / k} strokeDasharray={`${4 / k} ${3 / k}`} />
                    {single?.id === id && !p.readOnly && [a, z].map((q, i) => <circle key={i} data-testid={`sl-end-${i}`} cx={q[0]} cy={q[1]} r={hs / 1.6} fill="#fff" stroke="#0b6e4f" strokeWidth={1.5 / k} style={{ pointerEvents: 'all', cursor: 'crosshair' }} onPointerDown={(e) => begin(e, { k: 'end', which: i as 0 | 1, id, orig: { x: el.x, y: el.y, w: el.w, h: el.h, flipH: el.flipH, flipV: el.flipV } })} />)}
                  </svg>
                )
              }
              return (
                <div key={id} data-testid="sl-selected" data-id={id} style={{ position: 'absolute', left: el.x, top: el.y, width: el.w, height: el.h, transform: el.rot ? `rotate(${el.rot}deg)` : undefined, outline: `${1.5 / k}px solid #0b6e4f`, pointerEvents: 'none' }}>
                  {single?.id === id && !p.readOnly && !p.editing && (
                    <>
                      {HANDLES.map((h) => (
                        <span key={h} data-testid={`sl-handle-${h}`} onPointerDown={(e) => begin(e, { k: 'resize', h, id, orig: { x: el.x, y: el.y, w: el.w, h: el.h, rot: el.rot }, aspect: el.kind === 'image' && h.length === 2 })}
                          style={{ position: 'absolute', width: hs, height: hs, background: '#fff', border: `${1.5 / k}px solid #0b6e4f`, borderRadius: 2 / k, pointerEvents: 'all', cursor: cursorFor(h, el.rot || 0),
                            left: (h.includes('w') ? 0 : h.includes('e') ? el.w : el.w / 2) - hs / 2, top: (h.includes('n') ? 0 : h.includes('s') ? el.h : el.h / 2) - hs / 2 }} />
                      ))}
                      <span data-testid="sl-rotate" onPointerDown={(e) => begin(e, { k: 'rotate', id, orig: { x: el.x, y: el.y, w: el.w, h: el.h, rot: el.rot } })}
                        style={{ position: 'absolute', left: el.w / 2 - hs / 1.6, top: -26 / k - hs / 1.6, width: hs * 1.25, height: hs * 1.25, borderRadius: '50%', background: '#fff', border: `${1.5 / k}px solid #0b6e4f`, pointerEvents: 'all', cursor: 'grab' }} />
                    </>
                  )}
                </div>
              )
            })}
            {guides.map((g, i) => <div key={i} data-testid="sl-guide" data-axis={g.axis} style={g.axis === 'x' ? { position: 'absolute', left: g.at, top: 0, width: 0, height: S.h, borderLeft: `${1 / k}px dashed #e5484d`, pointerEvents: 'none' } : { position: 'absolute', top: g.at, left: 0, height: 0, width: S.w, borderTop: `${1 / k}px dashed #e5484d`, pointerEvents: 'none' }} />)}
            {(drag?.k === 'marquee' || drag?.k === 'draw') && (() => { const m = norm(drag.sx, drag.sy, drag.x, drag.y); return <div data-testid="sl-marquee" style={{ position: 'absolute', left: m.x, top: m.y, width: m.w, height: m.h, border: `${1 / k}px ${drag.k === 'draw' ? 'solid' : 'dashed'} #0b6e4f`, background: 'rgba(11,110,79,0.06)', pointerEvents: 'none' }} /> })()}
          </SlideView>
        </div>
      </div>
    </div>
  )
}

const round = (n: number) => Math.round(n * 100) / 100
const norm = (ax: number, ay: number, bx: number, by: number) => ({ x: Math.min(ax, bx), y: Math.min(ay, by), w: Math.abs(bx - ax), h: Math.abs(by - ay) })
function cursorFor(h: Handle, rot: number): string {
  const order: Handle[] = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw']
  const i = (order.indexOf(h) + Math.round(rot / 45) + 8) % 8
  return ['ns-resize', 'nesw-resize', 'ew-resize', 'nwse-resize', 'ns-resize', 'nesw-resize', 'ew-resize', 'nwse-resize'][i]
}

/** Text a new box starts with, so it can be typed into straight away. */
export function emptyBody(rtl: boolean, size = 18): TextBody { return { paras: [{ runs: [], rtl: rtl || undefined, size }], autofit: 'resize', wrap: true } }
export type { ShapeEl }
