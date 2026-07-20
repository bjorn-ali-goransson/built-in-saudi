// Best-effort import: parse an SVG string into the editor's shape model. Known
// primitives (rect/circle/ellipse/line/polyline/polygon/text) become native,
// fully-editable shapes; anything else (notably <path> with curves, <g>, images)
// is kept as a `raw` shape so it still renders and can be moved/scaled.
import { uid, DEFAULT_FILL, type Shape, type Pt } from './model'

export type ParsedDoc = { shapes: Shape[]; width: number; height: number; ok: boolean }

const num = (v: string | null, d = 0): number => {
  const n = parseFloat(v ?? '')
  return Number.isFinite(n) ? n : d
}

function style(el: Element) {
  const sw = el.getAttribute('stroke-width')
  return {
    fill: el.getAttribute('fill') || DEFAULT_FILL.fill,
    stroke: el.getAttribute('stroke') || 'none',
    strokeWidth: sw != null ? num(sw, 0) : (el.getAttribute('stroke') ? 1 : 0),
    opacity: el.getAttribute('opacity') != null ? num(el.getAttribute('opacity'), 1) : 1,
  }
}

function points(raw: string | null): Pt[] {
  if (!raw) return []
  const nums = raw.trim().split(/[\s,]+/).map(Number).filter((n) => Number.isFinite(n))
  const pts: Pt[] = []
  for (let i = 0; i + 1 < nums.length; i += 2) pts.push({ x: nums[i], y: nums[i + 1] })
  return pts
}

function one(el: Element): Shape | null {
  const base = { id: uid(), ...style(el) }
  switch (el.tagName.toLowerCase()) {
    case 'rect': return { ...base, type: 'rect', x: num(el.getAttribute('x')), y: num(el.getAttribute('y')), w: num(el.getAttribute('width')), h: num(el.getAttribute('height')) }
    case 'circle': { const rr = num(el.getAttribute('r')); return { ...base, type: 'ellipse', cx: num(el.getAttribute('cx')), cy: num(el.getAttribute('cy')), rx: rr, ry: rr } }
    case 'ellipse': return { ...base, type: 'ellipse', cx: num(el.getAttribute('cx')), cy: num(el.getAttribute('cy')), rx: num(el.getAttribute('rx')), ry: num(el.getAttribute('ry')) }
    case 'line': return { ...base, type: 'line', x1: num(el.getAttribute('x1')), y1: num(el.getAttribute('y1')), x2: num(el.getAttribute('x2')), y2: num(el.getAttribute('y2')), fill: 'none', strokeWidth: base.strokeWidth || 1, stroke: base.stroke === 'none' ? '#000' : base.stroke }
    case 'polyline': return { ...base, type: 'path', pts: points(el.getAttribute('points')), closed: false }
    case 'polygon': return { ...base, type: 'path', pts: points(el.getAttribute('points')), closed: true }
    case 'text': return { ...base, type: 'text', x: num(el.getAttribute('x')), y: num(el.getAttribute('y')), fontSize: num(el.getAttribute('font-size'), 16), text: el.textContent || '' }
    default: return { ...base, type: 'raw', markup: el.outerHTML, tx: 0, ty: 0, sx: 1, sy: 1 }
  }
}

export function parseSvg(src: string): ParsedDoc {
  const empty: ParsedDoc = { shapes: [], width: 480, height: 360, ok: false }
  if (!src.trim()) return { ...empty, ok: true }
  const doc = new DOMParser().parseFromString(src, 'image/svg+xml')
  const svg = doc.querySelector('svg')
  if (!svg || doc.querySelector('parsererror')) return empty

  let width = num(svg.getAttribute('width'))
  let height = num(svg.getAttribute('height'))
  const vb = (svg.getAttribute('viewBox') || '').trim().split(/[\s,]+/).map(Number)
  if ((!width || !height) && vb.length === 4) { width = width || vb[2]; height = height || vb[3] }
  width = width || 480; height = height || 360

  const shapes: Shape[] = []
  for (const el of Array.from(svg.children)) {
    if (['defs', 'style', 'metadata', 'title', 'desc'].includes(el.tagName.toLowerCase())) continue
    const s = one(el)
    if (s) shapes.push(s)
  }
  return { shapes, width, height, ok: true }
}
