// The interactive drawing surface. Renders the shape document as live SVG and
// handles all pointer work: drawing new shapes, selecting, moving, resizing via
// 8 handles, plus pan (pan tool / middle-drag / space-drag) and wheel-zoom.
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { Editor, Doc } from './useEditor'
import { bbox, translate, scale, pathD, uid, DEFAULT_FILL, type Shape, type PathShape, type Box, type Pt } from './model'

type Handle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'
const HANDLES: Handle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']
const CURSOR: Record<Handle, string> = { nw: 'nwse-resize', se: 'nwse-resize', ne: 'nesw-resize', sw: 'nesw-resize', n: 'ns-resize', s: 'ns-resize', e: 'ew-resize', w: 'ew-resize' }

type Drag =
  | { mode: 'move'; start: Pt; before: Shape; beforeDoc: Doc; moved: boolean }
  | { mode: 'resize'; start: Pt; before: Shape; handle: Handle; box: Box; beforeDoc: Doc; moved: boolean }
  | { mode: 'node'; start: Pt; before: PathShape; index: number; beforeDoc: Doc; moved: boolean }
  | { mode: 'draw'; start: Pt; id: string }
  | { mode: 'pan'; startClient: Pt; startView: { x: number; y: number } }

/** Distance from p to segment a–b, plus the projection, for node insertion. */
function segDist(a: Pt, b: Pt, p: Pt): number {
  const dx = b.x - a.x, dy = b.y - a.y
  const len2 = dx * dx + dy * dy
  const t = len2 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2)) : 0
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy))
}

/** Index of the segment (start point) nearest to p, and its distance. */
function nearestSeg(s: PathShape, p: Pt): { index: number; dist: number } {
  let best = { index: -1, dist: Infinity }
  const n = s.pts.length
  const last = s.closed ? n : n - 1
  for (let i = 0; i < last; i++) {
    const d = segDist(s.pts[i], s.pts[(i + 1) % n], p)
    if (d < best.dist) best = { index: i, dist: d }
  }
  return best
}

function handlePos(b: Box, h: Handle): Pt {
  const mx = b.x + b.w / 2, my = b.y + b.h / 2
  const x = h.includes('w') ? b.x : h.includes('e') ? b.x + b.w : mx
  const y = h.includes('n') ? b.y : h.includes('s') ? b.y + b.h : my
  return { x, y }
}

export function Canvas({ ed, showGrid }: { ed: Editor; showGrid: boolean }) {
  const svgRef = useRef<SVGSVGElement>(null)
  const drag = useRef<Drag | null>(null)
  const [rawBoxes, setRawBoxes] = useState<Record<string, Box>>({})
  const [upp, setUpp] = useState(1) // user units per CSS pixel (for constant-size handles)
  const { doc, view, tool, selected, selectedShape } = ed

  // Track the on-screen scale so handles/nodes stay a constant pixel size. With
  // preserveAspectRatio="meet" the uniform scale is the SMALLER axis ratio, so
  // derive user-units-per-pixel from that (not width alone) to stay correct when
  // the canvas is letterboxed.
  useLayoutEffect(() => {
    const el = svgRef.current
    if (!el) return
    const measure = () => {
      const r = el.getBoundingClientRect()
      if (!r.width || !r.height) return
      const scale = Math.min(r.width / view.w, r.height / view.h)
      if (scale > 0) setUpp(1 / scale)
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [view.w, view.h])

  // Measure imported `raw` shapes' intrinsic bounds (for their selection box).
  useLayoutEffect(() => {
    const el = svgRef.current
    if (!el) return
    let changed = false
    const next: Record<string, Box> = { ...rawBoxes }
    for (const s of doc.shapes) {
      if (s.type !== 'raw') continue
      const g = el.querySelector(`[data-raw="${s.id}"]`) as SVGGraphicsElement | null
      if (!g) continue
      try {
        const b = g.getBBox()
        const prev = rawBoxes[s.id]
        if (!prev || prev.x !== b.x || prev.y !== b.y || prev.w !== b.width || prev.h !== b.height) {
          next[s.id] = { x: b.x, y: b.y, w: b.width, h: b.height }; changed = true
        }
      } catch { /* not yet rendered */ }
    }
    if (changed) setRawBoxes(next)
  }, [doc.shapes]) // eslint-disable-line react-hooks/exhaustive-deps

  const boxOf = (s: Shape): Box => bbox(s, s.type === 'raw' ? rawBoxes[s.id] : undefined)

  function toUser(e: { clientX: number; clientY: number }): Pt {
    const svg = svgRef.current
    if (!svg) return { x: 0, y: 0 }
    const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY
    const m = svg.getScreenCTM()
    if (!m) return { x: e.clientX, y: e.clientY }
    const p = pt.matrixTransform(m.inverse())
    return { x: p.x, y: p.y }
  }

  function startDraw(p: Pt) {
    const id = uid()
    const base = { id, ...DEFAULT_FILL }
    let s: Shape
    if (tool === 'rect') s = { ...base, type: 'rect', x: p.x, y: p.y, w: 0, h: 0 }
    else if (tool === 'ellipse') s = { ...base, type: 'ellipse', cx: p.x, cy: p.y, rx: 0, ry: 0 }
    else if (tool === 'line') s = { ...base, type: 'line', x1: p.x, y1: p.y, x2: p.x, y2: p.y, fill: 'none', stroke: DEFAULT_FILL.stroke, strokeWidth: 3 }
    else s = { ...base, type: 'path', pts: [p], closed: false, fill: 'none', stroke: DEFAULT_FILL.stroke, strokeWidth: 3 }
    ed.record(doc)
    ed.set((d) => ({ ...d, shapes: [...d.shapes, s] }))
    ed.setSelected(id)
    drag.current = { mode: 'draw', start: p, id }
  }

  function moveDraw(p: Pt, id: string, start: Pt) {
    ed.set((d) => ({
      ...d,
      shapes: d.shapes.map((s) => {
        if (s.id !== id) return s
        if (s.type === 'rect') return { ...s, x: Math.min(start.x, p.x), y: Math.min(start.y, p.y), w: Math.abs(p.x - start.x), h: Math.abs(p.y - start.y) }
        if (s.type === 'ellipse') return { ...s, cx: (start.x + p.x) / 2, cy: (start.y + p.y) / 2, rx: Math.abs(p.x - start.x) / 2, ry: Math.abs(p.y - start.y) / 2 }
        if (s.type === 'line') return { ...s, x2: p.x, y2: p.y }
        if (s.type === 'path') return { ...s, pts: [...s.pts, p] }
        return s
      }),
    }))
  }

  function onPointerDown(e: React.PointerEvent) {
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
    const p = toUser(e)
    const panning = tool === 'pan' || e.button === 1 || (e as React.PointerEvent & { getModifierState?: (k: string) => boolean }).getModifierState?.(' ')
    if (panning) { drag.current = { mode: 'pan', startClient: { x: e.clientX, y: e.clientY }, startView: { x: view.x, y: view.y } }; return }
    if (tool === 'text') {
      ed.add({ id: uid(), ...DEFAULT_FILL, stroke: 'none', strokeWidth: 0, type: 'text', x: p.x, y: p.y, text: 'Text', fontSize: 24 })
      return
    }
    // Node tool: click just (re)selects a shape; node handles start their own drag.
    if (tool === 'node') { const hit = hitTest(p); ed.setSelected(hit ? hit.id : null); return }
    if (tool !== 'select') { startDraw(p); return }
    // Select tool: a resize handle was hit? (handled by handle's own onPointerDown)
    const hit = hitTest(p)
    if (hit) {
      ed.setSelected(hit.id)
      drag.current = { mode: 'move', start: p, before: hit, beforeDoc: doc, moved: false }
    } else {
      ed.setSelected(null)
    }
  }

  function onNodeDown(e: React.PointerEvent, index: number) {
    e.stopPropagation()
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
    if (!selectedShape || selectedShape.type !== 'path') return
    drag.current = { mode: 'node', start: toUser(e), before: selectedShape, index, beforeDoc: doc, moved: false }
  }

  // Double-click with the node tool: on a node → delete it; on a segment → insert one.
  function onDoubleClick(e: React.MouseEvent) {
    if (tool !== 'node' || !selectedShape || selectedShape.type !== 'path') return
    const s = selectedShape
    const p = toUser(e)
    const hitR = 8 * upp
    const ni = s.pts.findIndex((pt) => Math.hypot(pt.x - p.x, pt.y - p.y) <= hitR)
    if (ni >= 0) {
      if (s.pts.length <= 2) return
      ed.update(s.id, { pts: s.pts.filter((_, i) => i !== ni) } as Partial<Shape>)
      return
    }
    const seg = nearestSeg(s, p)
    if (seg.index >= 0 && seg.dist <= 12 * upp) {
      const pts = s.pts.slice()
      pts.splice(seg.index + 1, 0, { x: p.x, y: p.y })
      ed.update(s.id, { pts } as Partial<Shape>)
    }
  }

  function hitTest(p: Pt): Shape | null {
    // topmost first
    for (let i = doc.shapes.length - 1; i >= 0; i--) {
      const s = doc.shapes[i]
      const b = boxOf(s)
      const pad = s.type === 'line' || (s.type === 'path' && !s.closed) ? Math.max(6 * upp, s.strokeWidth) : 0
      if (p.x >= b.x - pad && p.x <= b.x + b.w + pad && p.y >= b.y - pad && p.y <= b.y + b.h + pad) return s
    }
    return null
  }

  function onHandleDown(e: React.PointerEvent, h: Handle) {
    e.stopPropagation()
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
    if (!selectedShape) return
    drag.current = { mode: 'resize', start: toUser(e), before: selectedShape, handle: h, box: boxOf(selectedShape), beforeDoc: doc, moved: false }
  }

  function onPointerMove(e: React.PointerEvent) {
    const d = drag.current
    if (!d) return
    const p = toUser(e)
    if (d.mode === 'pan') {
      const dx = (e.clientX - d.startClient.x) * upp, dy = (e.clientY - d.startClient.y) * upp
      ed.setView((v) => ({ ...v, x: d.startView.x - dx, y: d.startView.y - dy }))
      return
    }
    if (d.mode === 'draw') { moveDraw(p, d.id, d.start); return }
    if (d.mode === 'move') {
      d.moved = true
      const dx = p.x - d.start.x, dy = p.y - d.start.y
      ed.set((doc2) => ({ ...doc2, shapes: doc2.shapes.map((s) => (s.id === d.before.id ? translate(d.before, dx, dy) : s)) }))
      return
    }
    if (d.mode === 'node') {
      d.moved = true
      const pts = d.before.pts.map((pt, i) => (i === d.index ? { x: p.x, y: p.y } : pt))
      ed.set((doc2) => ({ ...doc2, shapes: doc2.shapes.map((s) => (s.id === d.before.id ? { ...d.before, pts } : s)) }))
      return
    }
    if (d.mode === 'resize') {
      d.moved = true
      const b = d.box, bw = b.w || 1, bh = b.h || 1
      let x1 = b.x, y1 = b.y, x2 = b.x + b.w, y2 = b.y + b.h
      if (d.handle.includes('w')) x1 = p.x
      if (d.handle.includes('e')) x2 = p.x
      if (d.handle.includes('n')) y1 = p.y
      if (d.handle.includes('s')) y2 = p.y
      const fx = (x2 - x1) / bw, fy = (y2 - y1) / bh
      let s = scale(d.before, b.x, b.y, fx, fy)
      s = translate(s, x1 - b.x, y1 - b.y)
      ed.set((doc2) => ({ ...doc2, shapes: doc2.shapes.map((sh) => (sh.id === d.before.id ? s : sh)) }))
    }
  }

  function onPointerUp() {
    const d = drag.current
    drag.current = null
    if (!d) return
    // A completed move/resize/node drag is one undo step (recorded on release so
    // the whole gesture collapses to a single entry).
    if ((d.mode === 'move' || d.mode === 'resize' || d.mode === 'node') && d.moved) { ed.record(d.beforeDoc); return }
    // Drop zero-size drawings; they were an accidental click.
    if (d.mode === 'draw') {
      ed.set((doc2) => {
        const s = doc2.shapes.find((x) => x.id === d.id)
        if (s) { const b = bbox(s); if (b.w < 2 && b.h < 2 && !(s.type === 'path' && s.pts.length > 2)) return { ...doc2, shapes: doc2.shapes.filter((x) => x.id !== d.id) } }
        return doc2
      })
      if (tool !== 'path') ed.setTool('select')
    }
  }

  function onWheel(e: React.WheelEvent) {
    const p = toUser(e)
    const f = e.deltaY > 0 ? 1.12 : 1 / 1.12
    ed.setView((v) => {
      const w = Math.min(20000, Math.max(10, v.w * f)), h = Math.min(20000, Math.max(10, v.h * f))
      // keep the point under the cursor stationary
      return { x: p.x - (p.x - v.x) * (w / v.w), y: p.y - (p.y - v.y) * (h / v.h), w, h }
    })
  }

  useEffect(() => {
    function key(e: KeyboardEvent) {
      const t = e.target as HTMLElement
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
      if ((e.key === 'Delete' || e.key === 'Backspace') && selected) { e.preventDefault(); ed.remove(selected) }
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? ed.redo() : ed.undo() }
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); ed.redo() }
      else if (e.key === 'Escape') ed.setSelected(null)
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [selected, ed])

  const nodeEditing = tool === 'node' && selectedShape?.type === 'path'
  const selBox = selectedShape ? boxOf(selectedShape) : null
  const hs = 4 * upp // handle half-size
  const nr = 5 * upp // node handle radius

  return (
    <svg ref={svgRef} data-testid="svg-canvas" viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
      className="w-full h-full touch-none select-none"
      style={{ cursor: tool === 'pan' ? 'grab' : tool === 'select' || tool === 'node' ? 'default' : 'crosshair', backgroundImage: 'conic-gradient(#eee9dd 25%, #fbfaf6 0 50%, #eee9dd 0 75%, #fbfaf6 0)', backgroundSize: '20px 20px' }}
      onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerLeave={onPointerUp} onWheel={onWheel} onDoubleClick={onDoubleClick}>
      {/* the artboard */}
      <rect x={0} y={0} width={doc.width} height={doc.height} fill="#ffffff" stroke="#00000018" strokeWidth={upp} data-testid="svg-artboard" />
      {showGrid && <GridLines w={doc.width} h={doc.height} step={20} upp={upp} />}
      {doc.shapes.map((s) => <ShapeNode key={s.id} s={s} />)}
      {selBox && !nodeEditing && (
        <g data-testid="svg-selection" pointerEvents="all">
          <rect x={selBox.x} y={selBox.y} width={selBox.w} height={selBox.h} fill="none" stroke="#1f7a3f" strokeWidth={1.5 * upp} strokeDasharray={`${4 * upp} ${3 * upp}`} pointerEvents="none" />
          {HANDLES.map((h) => {
            const pos = handlePos(selBox, h)
            return <rect key={h} data-handle={h} x={pos.x - hs} y={pos.y - hs} width={hs * 2} height={hs * 2} fill="#fff" stroke="#1f7a3f" strokeWidth={1.2 * upp} style={{ cursor: CURSOR[h] }} onPointerDown={(e) => onHandleDown(e, h)} />
          })}
        </g>
      )}
      {nodeEditing && selectedShape.type === 'path' && (
        <g data-testid="svg-nodes">
          {/* thin overlay of the path so segments are easy to double-click on */}
          <path d={pathD(selectedShape)} fill="none" stroke="#1f7a3f" strokeWidth={1 * upp} pointerEvents="none" opacity={0.6} />
          {selectedShape.pts.map((pt, i) => (
            <circle key={i} data-node={i} cx={pt.x} cy={pt.y} r={nr} fill="#fff" stroke="#1f7a3f" strokeWidth={1.4 * upp} style={{ cursor: 'move' }} onPointerDown={(e) => onNodeDown(e, i)} />
          ))}
        </g>
      )}
    </svg>
  )
}

function GridLines({ w, h, step, upp }: { w: number; h: number; step: number; upp: number }) {
  const lines = []
  for (let x = step; x < w; x += step) lines.push(<line key={`v${x}`} x1={x} y1={0} x2={x} y2={h} stroke="#00000010" strokeWidth={upp} />)
  for (let y = step; y < h; y += step) lines.push(<line key={`h${y}`} x1={0} y1={y} x2={w} y2={y} stroke="#00000010" strokeWidth={upp} />)
  return <g pointerEvents="none">{lines}</g>
}

function ShapeNode({ s }: { s: Shape }) {
  const common = { fill: s.type === 'line' ? 'none' : s.fill, stroke: s.strokeWidth > 0 ? s.stroke : 'none', strokeWidth: s.strokeWidth, opacity: s.opacity }
  switch (s.type) {
    case 'rect': return <rect x={s.x} y={s.y} width={s.w} height={s.h} {...common} />
    case 'ellipse': return <ellipse cx={s.cx} cy={s.cy} rx={s.rx} ry={s.ry} {...common} />
    case 'line': return <line x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} {...common} />
    case 'text': return <text x={s.x} y={s.y} fontSize={s.fontSize} fontFamily="sans-serif" fill={s.fill} opacity={s.opacity}>{s.text}</text>
    case 'path': return <path d={pathD(s)} fill={s.closed ? s.fill : 'none'} stroke={s.strokeWidth > 0 ? s.stroke : 'none'} strokeWidth={s.strokeWidth} strokeLinejoin="round" strokeLinecap="round" opacity={s.opacity} />
    case 'raw': return <g transform={`translate(${s.tx} ${s.ty}) scale(${s.sx} ${s.sy})`} opacity={s.opacity}><g data-raw={s.id} dangerouslySetInnerHTML={{ __html: s.markup }} /></g>
  }
}
