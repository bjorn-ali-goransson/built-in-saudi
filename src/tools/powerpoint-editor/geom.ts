// DrawingML preset shapes as SVG paths, in a w × h box.
//
// The names ARE the file format's (`prstGeom prst="rightArrow"`), so import and
// export need no mapping table, and an unknown preset from a file falls back to
// its bounding rectangle — drawn, editable, and counted in the loss ledger
// rather than vanishing. Adjust values are in the preset's own units (fractions
// of 100 000 of the shorter side, mostly), defaulting as PowerPoint does.

import type { CustPath } from './model'

export interface PresetDef { id: string; adj?: number[]; path: (w: number, h: number, a: number[]) => string; group: 'basic' | 'arrow' | 'flow' | 'star' | 'callout' | 'line' }

const f = (n: number) => +n.toFixed(2)
const poly = (pts: [number, number][]) => 'M' + pts.map(([x, y]) => `${f(x)} ${f(y)}`).join(' L') + ' Z'
const ellipse = (cx: number, cy: number, rx: number, ry: number) =>
  `M${f(cx - rx)} ${f(cy)} A${f(rx)} ${f(ry)} 0 1 0 ${f(cx + rx)} ${f(cy)} A${f(rx)} ${f(ry)} 0 1 0 ${f(cx - rx)} ${f(cy)} Z`
function star(n: number, w: number, h: number, inner: number): string {
  const pts: [number, number][] = []
  for (let i = 0; i < n * 2; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / n
    const r = i % 2 ? inner : 0.5
    pts.push([w / 2 + Math.cos(a) * r * w, h / 2 + Math.sin(a) * r * h])
  }
  return poly(pts)
}
function regular(n: number, w: number, h: number, start = -Math.PI / 2): string {
  const pts: [number, number][] = []
  for (let i = 0; i < n; i++) { const a = start + (i * 2 * Math.PI) / n; pts.push([w / 2 + (Math.cos(a) * w) / 2, h / 2 + (Math.sin(a) * h) / 2]) }
  return poly(pts)
}


/** A point on an ellipse at a DrawingML angle (60000ths of a degree, measured visually, clockwise from 3 o'clock). */
function onEllipse(cx: number, cy: number, rx: number, ry: number, ang: number): [number, number] {
  const t = (ang / 60000) * (Math.PI / 180)
  // The angle is where the point LOOKS, so on a non-circular ellipse it is converted to the parametric one.
  const u = Math.atan2(Math.sin(t) * rx, Math.cos(t) * ry)
  return [cx + rx * Math.cos(u), cy + ry * Math.sin(u)]
}
const sweep60k = (st: number, end: number) => { let s = (end - st) % 21600000; if (s <= 0) s += 21600000; return s }
function arcD(cx: number, cy: number, rx: number, ry: number, st: number, sw: number, move: boolean): string {
  const [x0, y0] = onEllipse(cx, cy, rx, ry, st)
  const [x1, y1] = onEllipse(cx, cy, rx, ry, st + sw)
  return `${move ? 'M' : 'L'}${f(x0)} ${f(y0)} A${f(rx)} ${f(ry)} 0 ${sw > 10800000 ? 1 : 0} 1 ${f(x1)} ${f(y1)}`
}

export const PRESETS: PresetDef[] = [
  { id: 'rect', group: 'basic', path: (w, h) => `M0 0 H${f(w)} V${f(h)} H0 Z` },
  {
    id: 'roundRect', group: 'basic', adj: [16667], path: (w, h, [a]) => {
      const r = (Math.min(w, h) * Math.min(50000, Math.max(0, a))) / 100000
      return `M${f(r)} 0 H${f(w - r)} A${f(r)} ${f(r)} 0 0 1 ${f(w)} ${f(r)} V${f(h - r)} A${f(r)} ${f(r)} 0 0 1 ${f(w - r)} ${f(h)} H${f(r)} A${f(r)} ${f(r)} 0 0 1 0 ${f(h - r)} V${f(r)} A${f(r)} ${f(r)} 0 0 1 ${f(r)} 0 Z`
    },
  },
  { id: 'ellipse', group: 'basic', path: (w, h) => ellipse(w / 2, h / 2, w / 2, h / 2) },
  { id: 'triangle', group: 'basic', adj: [50000], path: (w, h, [a]) => poly([[(w * a) / 100000, 0], [w, h], [0, h]]) },
  { id: 'rtTriangle', group: 'basic', path: (w, h) => poly([[0, 0], [w, h], [0, h]]) },
  { id: 'diamond', group: 'basic', path: (w, h) => poly([[w / 2, 0], [w, h / 2], [w / 2, h], [0, h / 2]]) },
  { id: 'parallelogram', group: 'basic', adj: [25000], path: (w, h, [a]) => { const d = (Math.min(w, h) * a) / 100000; return poly([[d, 0], [w, 0], [w - d, h], [0, h]]) } },
  { id: 'trapezoid', group: 'basic', adj: [25000], path: (w, h, [a]) => { const d = (Math.min(w, h) * a) / 100000; return poly([[d, 0], [w - d, 0], [w, h], [0, h]]) } },
  { id: 'pentagon', group: 'basic', path: (w, h) => regular(5, w, h) },
  { id: 'hexagon', group: 'basic', adj: [25000], path: (w, h, [a]) => { const d = (Math.min(w, h) * a) / 100000; return poly([[d, 0], [w - d, 0], [w, h / 2], [w - d, h], [d, h], [0, h / 2]]) } },
  { id: 'octagon', group: 'basic', adj: [29289], path: (w, h, [a]) => { const d = (Math.min(w, h) * a) / 100000; return poly([[d, 0], [w - d, 0], [w, d], [w, h - d], [w - d, h], [d, h], [0, h - d], [0, d]]) } },
  { id: 'plus', group: 'basic', adj: [25000], path: (w, h, [a]) => { const d = (Math.min(w, h) * a) / 100000; return poly([[d, 0], [w - d, 0], [w - d, d], [w, d], [w, h - d], [w - d, h - d], [w - d, h], [d, h], [d, h - d], [0, h - d], [0, d], [d, d]]) } },
  {
    id: 'donut', group: 'basic', adj: [25000], path: (w, h, [a]) => {
      const d = (Math.min(w, h) * a) / 100000
      return ellipse(w / 2, h / 2, w / 2, h / 2) + ' ' + ellipse(w / 2, h / 2, Math.max(1, w / 2 - d), Math.max(1, h / 2 - d))
    },
  },
  { id: 'heart', group: 'basic', path: (w, h) => `M${f(w / 2)} ${f(h * 0.25)} C${f(w * 0.5)} ${f(-h * 0.1)} ${f(-w * 0.15)} ${f(h * 0.1)} ${f(w / 2)} ${f(h)} C${f(w * 1.15)} ${f(h * 0.1)} ${f(w * 0.5)} ${f(-h * 0.1)} ${f(w / 2)} ${f(h * 0.25)} Z` },
  {
    id: 'cloud', group: 'basic', path: (w, h) => {
      const c = (x: number, y: number, r: number) => ellipse(x * w, y * h, r * w, r * h * 1.1)
      return [c(0.3, 0.55, 0.2), c(0.5, 0.35, 0.24), c(0.72, 0.5, 0.22), c(0.55, 0.7, 0.2), c(0.33, 0.72, 0.15)].join(' ')
    },
  },
  { id: 'can', group: 'basic', adj: [25000], path: (w, h, [a]) => { const ry = (Math.min(w, h) * a) / 200000; return `M0 ${f(ry)} A${f(w / 2)} ${f(ry)} 0 0 1 ${f(w)} ${f(ry)} V${f(h - ry)} A${f(w / 2)} ${f(ry)} 0 0 1 0 ${f(h - ry)} Z M0 ${f(ry)} A${f(w / 2)} ${f(ry)} 0 0 0 ${f(w)} ${f(ry)}` } },
  { id: 'pie', group: 'basic', adj: [0, 16200000], path: (w, h, [a1, a2]) => `M${f(w / 2)} ${f(h / 2)} ${arcD(w / 2, h / 2, w / 2, h / 2, a1, sweep60k(a1, a2), false)} Z` },
  {
    id: 'blockArc', group: 'basic', adj: [10800000, 0, 25000], path: (w, h, [a1, a2, a3]) => {
      const d = (Math.min(w, h) * a3) / 100000
      const sw = sweep60k(a1, a2)
      const [ix, iy] = onEllipse(w / 2, h / 2, Math.max(0, w / 2 - d), Math.max(0, h / 2 - d), a1 + sw)
      return `${arcD(w / 2, h / 2, w / 2, h / 2, a1, sw, true)} L${f(ix)} ${f(iy)} A${f(Math.max(0, w / 2 - d))} ${f(Math.max(0, h / 2 - d))} 0 ${sw > 10800000 ? 1 : 0} 0 ${f(onEllipse(w / 2, h / 2, w / 2 - d, h / 2 - d, a1)[0])} ${f(onEllipse(w / 2, h / 2, w / 2 - d, h / 2 - d, a1)[1])} Z`
    },
  },
  { id: 'arc', group: 'basic', adj: [16200000, 0], path: (w, h, [a1, a2]) => arcD(w / 2, h / 2, w / 2, h / 2, a1, sweep60k(a1, a2), true) },
  { id: 'rightBracket', group: 'basic', adj: [8333], path: (w, h, [a]) => { const r = Math.min(h / 2, (Math.min(w, h) * a) / 100000); return `M0 0 A${f(w)} ${f(r)} 0 0 1 ${f(w)} ${f(r)} V${f(h - r)} A${f(w)} ${f(r)} 0 0 1 0 ${f(h)}` } },
  { id: 'leftBracket', group: 'basic', adj: [8333], path: (w, h, [a]) => { const r = Math.min(h / 2, (Math.min(w, h) * a) / 100000); return `M${f(w)} 0 A${f(w)} ${f(r)} 0 0 0 0 ${f(r)} V${f(h - r)} A${f(w)} ${f(r)} 0 0 0 ${f(w)} ${f(h)}` } },
  { id: 'rightArrow', group: 'arrow', adj: [50000, 50000], path: (w, h, [a1, a2]) => { const th = (h * a1) / 100000; const hd = Math.min(w, (Math.min(w, h) * a2) / 100000); const y0 = (h - th) / 2; return poly([[0, y0], [w - hd, y0], [w - hd, 0], [w, h / 2], [w - hd, h], [w - hd, y0 + th], [0, y0 + th]]) } },
  { id: 'leftArrow', group: 'arrow', adj: [50000, 50000], path: (w, h, [a1, a2]) => { const th = (h * a1) / 100000; const hd = Math.min(w, (Math.min(w, h) * a2) / 100000); const y0 = (h - th) / 2; return poly([[w, y0], [hd, y0], [hd, 0], [0, h / 2], [hd, h], [hd, y0 + th], [w, y0 + th]]) } },
  { id: 'upArrow', group: 'arrow', adj: [50000, 50000], path: (w, h, [a1, a2]) => { const th = (w * a1) / 100000; const hd = Math.min(h, (Math.min(w, h) * a2) / 100000); const x0 = (w - th) / 2; return poly([[x0, h], [x0, hd], [0, hd], [w / 2, 0], [w, hd], [x0 + th, hd], [x0 + th, h]]) } },
  { id: 'downArrow', group: 'arrow', adj: [50000, 50000], path: (w, h, [a1, a2]) => { const th = (w * a1) / 100000; const hd = Math.min(h, (Math.min(w, h) * a2) / 100000); const x0 = (w - th) / 2; return poly([[x0, 0], [x0, h - hd], [0, h - hd], [w / 2, h], [w, h - hd], [x0 + th, h - hd], [x0 + th, 0]]) } },
  { id: 'leftRightArrow', group: 'arrow', adj: [50000, 50000], path: (w, h, [a1, a2]) => { const th = (h * a1) / 100000; const hd = Math.min(w / 2, (Math.min(w, h) * a2) / 100000); const y0 = (h - th) / 2; return poly([[0, h / 2], [hd, 0], [hd, y0], [w - hd, y0], [w - hd, 0], [w, h / 2], [w - hd, h], [w - hd, y0 + th], [hd, y0 + th], [hd, h]]) } },
  {
    id: 'stripedRightArrow', group: 'arrow', adj: [50000, 50000], path: (w, h, [a1, a2]) => {
      const ss = Math.min(w, h); const th = (h * a1) / 100000; const hd = Math.min(w, (ss * a2) / 100000); const y0 = (h - th) / 2; const b = ss * 5 / 32
      const bar = (x0: number, x1: number) => poly([[x0, y0], [x1, y0], [x1, y0 + th], [x0, y0 + th]])
      return `${bar(0, ss / 32)} ${bar(ss / 16, ss / 8)} ${poly([[b, y0], [w - hd, y0], [w - hd, 0], [w, h / 2], [w - hd, h], [w - hd, y0 + th], [b, y0 + th]])}`
    },
  },
  { id: 'chevron', group: 'arrow', adj: [50000], path: (w, h, [a]) => { const d = Math.min(w, (Math.min(w, h) * a) / 100000); return poly([[0, 0], [w - d, 0], [w, h / 2], [w - d, h], [0, h], [d, h / 2]]) } },
  { id: 'homePlate', group: 'arrow', adj: [50000], path: (w, h, [a]) => { const d = Math.min(w, (Math.min(w, h) * a) / 100000); return poly([[0, 0], [w - d, 0], [w, h / 2], [w - d, h], [0, h]]) } },
  { id: 'flowChartProcess', group: 'flow', path: (w, h) => `M0 0 H${f(w)} V${f(h)} H0 Z` },
  { id: 'flowChartDecision', group: 'flow', path: (w, h) => poly([[w / 2, 0], [w, h / 2], [w / 2, h], [0, h / 2]]) },
  { id: 'flowChartTerminator', group: 'flow', path: (w, h) => { const r = Math.min(h / 2, w / 2); return `M${f(r)} 0 H${f(w - r)} A${f(r)} ${f(h / 2)} 0 0 1 ${f(w - r)} ${f(h)} H${f(r)} A${f(r)} ${f(h / 2)} 0 0 1 ${f(r)} 0 Z` } },
  { id: 'flowChartDocument', group: 'flow', path: (w, h) => `M0 0 H${f(w)} V${f(h * 0.83)} C${f(w * 0.75)} ${f(h * 0.7)} ${f(w * 0.5)} ${f(h * 1.05)} 0 ${f(h * 0.9)} Z` },
  { id: 'flowChartConnector', group: 'flow', path: (w, h) => ellipse(w / 2, h / 2, w / 2, h / 2) },
  { id: 'flowChartInputOutput', group: 'flow', path: (w, h) => poly([[w * 0.2, 0], [w, 0], [w * 0.8, h], [0, h]]) },
  { id: 'star5', group: 'star', path: (w, h) => star(5, w, h, 0.19) },
  { id: 'star6', group: 'star', path: (w, h) => star(6, w, h, 0.29) },
  { id: 'star8', group: 'star', path: (w, h) => star(8, w, h, 0.38) },
  { id: 'star12', group: 'star', path: (w, h) => star(12, w, h, 0.38) },
  { id: 'wedgeRectCallout', group: 'callout', path: (w, h) => `M0 0 H${f(w)} V${f(h * 0.78)} H${f(w * 0.42)} L${f(w * 0.2)} ${f(h)} L${f(w * 0.26)} ${f(h * 0.78)} H0 Z` },
  { id: 'wedgeRoundRectCallout', group: 'callout', path: (w, h) => { const r = Math.min(w, h) * 0.12; const b = h * 0.78; return `M${f(r)} 0 H${f(w - r)} A${f(r)} ${f(r)} 0 0 1 ${f(w)} ${f(r)} V${f(b - r)} A${f(r)} ${f(r)} 0 0 1 ${f(w - r)} ${f(b)} H${f(w * 0.42)} L${f(w * 0.2)} ${f(h)} L${f(w * 0.26)} ${f(b)} H${f(r)} A${f(r)} ${f(r)} 0 0 1 0 ${f(b - r)} V${f(r)} A${f(r)} ${f(r)} 0 0 1 ${f(r)} 0 Z` } },
  { id: 'wedgeEllipseCallout', group: 'callout', path: (w, h) => `${ellipse(w / 2, h * 0.42, w / 2, h * 0.42)} M${f(w * 0.3)} ${f(h * 0.75)} L${f(w * 0.18)} ${f(h)} L${f(w * 0.45)} ${f(h * 0.82)} Z` },
  { id: 'line', group: 'line', path: (w, h) => `M0 0 L${f(w)} ${f(h)}` },
  { id: 'bentConnector2', group: 'line', path: (w, h) => `M0 0 H${f(w)} V${f(h)}` },
  { id: 'bentConnector3', group: 'line', adj: [50000], path: (w, h, [a]) => { const x1 = (w * a) / 100000; return `M0 0 H${f(x1)} V${f(h)} H${f(w)}` } },
  { id: 'bentConnector4', group: 'line', adj: [50000, 50000], path: (w, h, [a1, a2]) => { const x1 = (w * a1) / 100000; const y2 = (h * a2) / 100000; return `M0 0 H${f(x1)} V${f(y2)} H${f(w)} V${f(h)}` } },
  { id: 'curvedConnector3', group: 'line', adj: [50000], path: (w, h, [a]) => { const x1 = (w * a) / 100000; return `M0 0 C${f(x1 / 2)} 0 ${f(x1)} ${f(h / 4)} ${f(x1)} ${f(h / 2)} S${f((w + x1) / 2)} ${f(h)} ${f(w)} ${f(h)}` } },
  { id: 'straightConnector1', group: 'line', path: (w, h) => `M0 0 L${f(w)} ${f(h)}` },
]

const BY_ID = new Map(PRESETS.map((p) => [p.id, p]))
export const isKnownPreset = (id: string) => BY_ID.has(id)
export const isLine = (id: string) => id === 'line' || id === 'straightConnector1' || /Connector\d/.test(id)

/** The SVG path of a preset in a w × h box. Unknown presets draw as their rectangle. */
export function presetPath(id: string, w: number, h: number, adj?: number[]): string {
  const p = BY_ID.get(id)
  if (!p) return isLine(id) ? `M0 0 L${f(w)} ${f(h)}` : `M0 0 H${f(w)} V${f(h)} H0 Z`
  const a = (p.adj || []).map((d, i) => (adj && Number.isFinite(adj[i]) ? adj[i] : d))
  return p.path(Math.max(0, w), Math.max(0, h), a)
}

/**
 * The text area of a preset, inset from its box — text in a triangle or an
 * ellipse should not run to the corners the shape does not have.
 */
export function textRect(id: string, w: number, h: number): { x: number; y: number; w: number; h: number } {
  const k: Record<string, [number, number, number, number]> = {
    ellipse: [0.146, 0.146, 0.146, 0.146], triangle: [0.25, 0.5, 0.25, 0], diamond: [0.25, 0.25, 0.25, 0.25], flowChartDecision: [0.25, 0.25, 0.25, 0.25],
    star5: [0.3, 0.38, 0.3, 0.2], star6: [0.2, 0.25, 0.2, 0.25], pentagon: [0.18, 0.25, 0.18, 0.1], hexagon: [0.12, 0, 0.12, 0], octagon: [0.1, 0.1, 0.1, 0.1],
    rightArrow: [0, 0.25, 0.25, 0.25], leftArrow: [0.25, 0.25, 0, 0.25], chevron: [0.25, 0, 0.25, 0], homePlate: [0, 0, 0.2, 0], heart: [0.2, 0.2, 0.2, 0.3],
    cloud: [0.15, 0.25, 0.15, 0.2], wedgeRectCallout: [0, 0, 0, 0.22], wedgeRoundRectCallout: [0, 0, 0, 0.22], wedgeEllipseCallout: [0.15, 0.12, 0.15, 0.3], donut: [0.2, 0.2, 0.2, 0.2],
  }
  const [l, t, r, b] = k[id] || [0, 0, 0, 0]
  return { x: w * l, y: h * t, w: w * (1 - l - r), h: h * (1 - t - b) }
}

/** A freeform's own paths, each in its own coordinate box, scaled into the shape's w × h. */
export function custPathD(paths: CustPath[], w: number, h: number): string[] {
  return paths.map((p) => {
    const sx = p.w ? w / p.w : 1
    const sy = p.h ? h / p.h : 1
    const t = p.d.trim().split(/\s+/)
    const out: string[] = []
    let cmd = ''
    let i = 0
    const n = () => +t[i++]
    while (i < t.length) {
      const tok = t[i]
      if (/^[MLCQAZ]$/.test(tok)) { cmd = tok; i++; out.push(cmd); if (cmd === 'Z') continue }
      if (cmd === 'A') { out.push(`${f(n() * sx)} ${f(n() * sy)} ${n()} ${n()} ${n()} ${f(n() * sx)} ${f(n() * sy)}`); continue }
      if (cmd === 'Z') { i++; continue }
      out.push(`${f(n() * sx)} ${f(n() * sy)}`)
    }
    return out.join(' ')
  })
}
