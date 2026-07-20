// The editor's document model: a flat, ordered list of shapes we can fully
// manipulate (move / resize / restyle) plus a `raw` fallback for imported
// elements we don't natively edit. Everything renders to plain SVG on export.

export type Fill = { fill: string; stroke: string; strokeWidth: number; opacity: number }

export type Pt = { x: number; y: number }

type Base = { id: string } & Fill
export type Rect = Base & { type: 'rect'; x: number; y: number; w: number; h: number }
export type Ellipse = Base & { type: 'ellipse'; cx: number; cy: number; rx: number; ry: number }
export type Line = Base & { type: 'line'; x1: number; y1: number; x2: number; y2: number }
export type PathShape = Base & { type: 'path'; pts: Pt[]; closed: boolean }
export type TextShape = Base & { type: 'text'; x: number; y: number; text: string; fontSize: number }
// Imported markup we render verbatim under a transform we can nudge/scale.
export type Raw = Base & { type: 'raw'; markup: string; tx: number; ty: number; sx: number; sy: number }

export type Shape = Rect | Ellipse | Line | PathShape | TextShape | Raw
export type ShapeType = Shape['type']
export type Box = { x: number; y: number; w: number; h: number }

export const DEFAULT_FILL: Fill = { fill: '#1f7a3f', stroke: '#0f3d20', strokeWidth: 2, opacity: 1 }

let counter = 0
export function uid(): string {
  counter += 1
  return `s${counter.toString(36)}${(performance.now() | 0).toString(36)}`
}

const r = (n: number, d = 2) => {
  const f = 10 ** d
  return Math.round(n * f) / f
}

/** Axis-aligned bounds in user units. For `raw`, pass a measured base box. */
export function bbox(s: Shape, rawBase?: Box): Box {
  switch (s.type) {
    case 'rect': return norm(s.x, s.y, s.w, s.h)
    case 'ellipse': return { x: s.cx - s.rx, y: s.cy - s.ry, w: s.rx * 2, h: s.ry * 2 }
    case 'line': return norm(s.x1, s.y1, s.x2 - s.x1, s.y2 - s.y1)
    case 'text': return { x: s.x, y: s.y - s.fontSize, w: Math.max(s.fontSize, s.text.length * s.fontSize * 0.55), h: s.fontSize * 1.25 }
    case 'path': {
      if (!s.pts.length) return { x: 0, y: 0, w: 0, h: 0 }
      const xs = s.pts.map((p) => p.x), ys = s.pts.map((p) => p.y)
      const x = Math.min(...xs), y = Math.min(...ys)
      return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y }
    }
    case 'raw': {
      const b = rawBase || { x: 0, y: 0, w: 0, h: 0 }
      return { x: b.x * s.sx + s.tx, y: b.y * s.sy + s.ty, w: b.w * s.sx, h: b.h * s.sy }
    }
  }
}

function norm(x: number, y: number, w: number, h: number): Box {
  return { x: w < 0 ? x + w : x, y: h < 0 ? y + h : y, w: Math.abs(w), h: Math.abs(h) }
}

export function translate(s: Shape, dx: number, dy: number): Shape {
  switch (s.type) {
    case 'rect': return { ...s, x: s.x + dx, y: s.y + dy }
    case 'ellipse': return { ...s, cx: s.cx + dx, cy: s.cy + dy }
    case 'line': return { ...s, x1: s.x1 + dx, y1: s.y1 + dy, x2: s.x2 + dx, y2: s.y2 + dy }
    case 'text': return { ...s, x: s.x + dx, y: s.y + dy }
    case 'path': return { ...s, pts: s.pts.map((p) => ({ x: p.x + dx, y: p.y + dy })) }
    case 'raw': return { ...s, tx: s.tx + dx, ty: s.ty + dy }
  }
}

/** Scale a shape about origin (ox,oy) by (fx,fy). */
export function scale(s: Shape, ox: number, oy: number, fx: number, fy: number): Shape {
  const sx = (x: number) => ox + (x - ox) * fx
  const sy = (y: number) => oy + (y - oy) * fy
  switch (s.type) {
    case 'rect': { const x = sx(s.x), y = sy(s.y); return { ...s, x, y, w: s.w * fx, h: s.h * fy } }
    case 'ellipse': return { ...s, cx: sx(s.cx), cy: sy(s.cy), rx: s.rx * Math.abs(fx), ry: s.ry * Math.abs(fy) }
    case 'line': return { ...s, x1: sx(s.x1), y1: sy(s.y1), x2: sx(s.x2), y2: sy(s.y2) }
    case 'text': return { ...s, x: sx(s.x), y: sy(s.y), fontSize: s.fontSize * Math.abs(fy) }
    case 'path': return { ...s, pts: s.pts.map((p) => ({ x: sx(p.x), y: sy(p.y) })) }
    case 'raw': return { ...s, tx: sx(s.tx), ty: sy(s.ty), sx: s.sx * fx, sy: s.sy * fy }
  }
}

function fillAttrs(s: Shape): string {
  const a: string[] = []
  if (s.type !== 'line') a.push(`fill="${s.fill}"`)
  if (s.strokeWidth > 0) a.push(`stroke="${s.stroke}" stroke-width="${r(s.strokeWidth)}"`)
  if (s.opacity < 1) a.push(`opacity="${r(s.opacity, 3)}"`)
  return a.join(' ')
}

export function pathD(s: PathShape): string {
  if (!s.pts.length) return ''
  const d = s.pts.map((p, i) => `${i ? 'L' : 'M'}${r(p.x)} ${r(p.y)}`).join(' ')
  return s.closed ? `${d} Z` : d
}

/** One shape → an SVG element string. */
export function toMarkup(s: Shape): string {
  const f = fillAttrs(s)
  switch (s.type) {
    case 'rect': return `<rect x="${r(s.x)}" y="${r(s.y)}" width="${r(s.w)}" height="${r(s.h)}" ${f}/>`
    case 'ellipse': return `<ellipse cx="${r(s.cx)}" cy="${r(s.cy)}" rx="${r(s.rx)}" ry="${r(s.ry)}" ${f}/>`
    case 'line': return `<line x1="${r(s.x1)}" y1="${r(s.y1)}" x2="${r(s.x2)}" y2="${r(s.y2)}" ${f}/>`
    case 'path': return `<path d="${pathD(s)}" ${s.closed ? f : f.replace(`fill="${s.fill}"`, 'fill="none"')}/>`
    case 'text': return `<text x="${r(s.x)}" y="${r(s.y)}" font-size="${r(s.fontSize)}" font-family="sans-serif" ${f}>${escapeXml(s.text)}</text>`
    case 'raw': return `<g transform="translate(${r(s.tx)} ${r(s.ty)}) scale(${r(s.sx, 4)} ${r(s.sy, 4)})">${s.markup}</g>`
  }
}

function escapeXml(t: string): string {
  return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** The whole document → a standalone SVG string. */
export function docToSvg(shapes: Shape[], w: number, h: number): string {
  const body = shapes.map((s) => '  ' + toMarkup(s)).join('\n')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">\n${body}\n</svg>`
}
