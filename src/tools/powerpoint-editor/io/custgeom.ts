// A freeform shape's geometry (DrawingML <a:custGeom>), read into the model's
// CustPath form and written back out.
//
// A path's points may be literal numbers or the NAMES of guides — formulas over
// the shape's size and over each other (`*/ w 1 2`, `+- r 0 x1`). PowerPoint's
// own freeforms are almost always literal, but a shape copied from a preset and
// edited keeps the preset's formulas, so the guide list is evaluated rather than
// the shape being given up. Anything the evaluator cannot resolve makes the
// whole shape unreadable (null), and the reader falls back to its outline box
// and the loss ledger — a half-resolved path draws garbage.
//
// arcTo is relative to the pen (a radius pair and two angles), so it is turned
// into an absolute SVG arc here, while the pen position is known: the stored
// form must scale by multiplying x and y alone.
import { kids, attr, isEl, x, type XEl, type Xml } from '../../../lib/xml'
import type { CustPath } from '../model'

const A = 'http://schemas.openxmlformats.org/drawingml/2006/main'

type Env = Map<string, number>

function builtins(w: number, h: number): Env {
  const ss = Math.min(w, h)
  const ls = Math.max(w, h)
  const e: Record<string, number> = {
    w, h, l: 0, t: 0, r: w, b: h, hc: w / 2, vc: h / 2, ss, ls,
    wd2: w / 2, wd3: w / 3, wd4: w / 4, wd5: w / 5, wd6: w / 6, wd8: w / 8, wd10: w / 10, wd12: w / 12, wd32: w / 32,
    hd2: h / 2, hd3: h / 3, hd4: h / 4, hd5: h / 5, hd6: h / 6, hd8: h / 8, hd10: h / 10, hd12: h / 12,
    ssd2: ss / 2, ssd4: ss / 4, ssd6: ss / 6, ssd8: ss / 8, ssd16: ss / 16, ssd32: ss / 32,
    cd2: 10800000, cd4: 5400000, cd8: 2700000, '3cd4': 16200000, '3cd8': 8100000, '5cd8': 13500000, '7cd8': 18900000,
  }
  return new Map(Object.entries(e))
}

const RAD = Math.PI / 10800000
function evalFmla(fmla: string, env: Env): number {
  const [op, ...args] = fmla.trim().split(/\s+/)
  const v = args.map((a) => (env.has(a) ? env.get(a)! : +a))
  const [x, y, z] = v
  switch (op) {
    case 'val': return x
    case '*/': return (x * y) / z
    case '+-': return x + y - z
    case '+/': return (x + y) / z
    case '?:': return x > 0 ? y : z
    case 'abs': return Math.abs(x)
    case 'at2': return Math.atan2(y, x) / RAD
    case 'cat2': return x * Math.cos(Math.atan2(z, y))
    case 'sat2': return x * Math.sin(Math.atan2(z, y))
    case 'cos': return x * Math.cos(y * RAD)
    case 'sin': return x * Math.sin(y * RAD)
    case 'tan': return x * Math.tan(y * RAD)
    case 'max': return Math.max(x, y)
    case 'min': return Math.min(x, y)
    case 'mod': return Math.sqrt(x * x + y * y + z * z)
    case 'pin': return y < x ? x : y > z ? z : y
    case 'sqrt': return Math.sqrt(x)
    default: return NaN
  }
}

const g = (n: number) => +n.toFixed(2)

/** The paths of a custGeom, or null when they cannot be resolved. `w`/`h` are the shape's size in EMU. */
export function readCustGeom(cust: XEl, w: number, h: number): CustPath[] | null {
  const env = builtins(w, h)
  const gds = (tag: string) => kids(kids(cust, A, tag)[0], A, 'gd')
  for (const gd of [...gds('avLst'), ...gds('gdLst')]) {
    const name = attr(gd, 'name')
    const v = evalFmla(attr(gd, 'fmla') || '', env)
    if (name && Number.isFinite(v)) env.set(name, v)
  }
  const num = (s: string | undefined) => (s === undefined ? NaN : env.has(s) ? env.get(s)! : +s)
  const out: CustPath[] = []
  for (const path of kids(kids(cust, A, 'pathLst')[0], A, 'path')) {
    const pw = num(attr(path, 'w')) || w
    const ph = num(attr(path, 'h')) || h
    const d: string[] = []
    let px = 0
    let py = 0
    const pt = (el: XEl): [number, number] => { const p = kids(el, A, 'pt')[0]; return [num(attr(p, 'x')), num(attr(p, 'y'))] }
    const pts = (el: XEl) => kids(el, A, 'pt').map((p) => [num(attr(p, 'x')), num(attr(p, 'y'))] as [number, number])
    for (const c of path.children) {
      if (!isEl(c)) continue
      const tag = c.local
      if (tag === 'moveTo' || tag === 'lnTo') { [px, py] = pt(c); d.push(`${tag === 'moveTo' ? 'M' : 'L'} ${g(px)} ${g(py)}`) }
      else if (tag === 'cubicBezTo') { const p = pts(c); if (p.length < 3) return null; d.push(`C ${p.map(([a, b]) => `${g(a)} ${g(b)}`).join(' ')}`); [px, py] = p[2] }
      else if (tag === 'quadBezTo') { const p = pts(c); if (p.length < 2) return null; d.push(`Q ${p.map(([a, b]) => `${g(a)} ${g(b)}`).join(' ')}`); [px, py] = p[1] }
      else if (tag === 'arcTo') {
        const rx = num(attr(c, 'wR'))
        const ry = num(attr(c, 'hR'))
        const st = num(attr(c, 'stAng')) * RAD
        const sw = num(attr(c, 'swAng')) * RAD
        if (![rx, ry, st, sw].every(Number.isFinite)) return null
        // Visual angles to parametric ones, as for any ellipse in DrawingML.
        const par = (t: number) => Math.atan2(Math.sin(t) * rx, Math.cos(t) * ry)
        const u0 = par(st)
        const u1 = par(st + sw)
        const cx = px - rx * Math.cos(u0)
        const cy = py - ry * Math.sin(u0)
        const ex = cx + rx * Math.cos(u1)
        const ey = cy + ry * Math.sin(u1)
        if (Math.abs(sw) >= 2 * Math.PI - 1e-6) {
          // A full turn ends where it starts, which an SVG arc draws as nothing: two halves.
          const mx = cx - (px - cx)
          const my = cy - (py - cy)
          d.push(`A ${g(rx)} ${g(ry)} 0 0 ${sw > 0 ? 1 : 0} ${g(mx)} ${g(my)} A ${g(rx)} ${g(ry)} 0 0 ${sw > 0 ? 1 : 0} ${g(px)} ${g(py)}`)
        } else d.push(`A ${g(rx)} ${g(ry)} 0 ${Math.abs(sw) > Math.PI ? 1 : 0} ${sw > 0 ? 1 : 0} ${g(ex)} ${g(ey)}`)
        px = ex
        py = ey
      } else if (tag === 'close') d.push('Z')
    }
    const s = d.join(' ')
    if (!s || /NaN|Infinity/.test(s)) return null
    const p: CustPath = { w: g(pw), h: g(ph), d: s }
    if (attr(path, 'fill') === 'none') p.fill = false
    if (attr(path, 'stroke') === 'false' || attr(path, 'stroke') === '0') p.stroke = false
    out.push(p)
  }
  return out.length ? out : null
}

/** The custGeom element for stored paths. */
export function custGeomXml(paths: CustPath[]): Xml {
  const round = (n: string) => String(Math.round(+n))
  const pathXml = (p: CustPath) => {
    const t = p.d.trim().split(/\s+/)
    const els: Xml[] = []
    let i = 0
    let cmd = ''
    let px = 0
    let py = 0
    const ptX = (a: string, b: string) => x('a:pt', { x: round(a), y: round(b) })
    while (i < t.length) {
      if (/^[MLCQAZ]$/.test(t[i])) cmd = t[i++]
      if (cmd === 'Z') { els.push(x('a:close', null)); continue }
      if (cmd === 'M' || cmd === 'L') { const [a, b] = [t[i++], t[i++]]; els.push(x(cmd === 'M' ? 'a:moveTo' : 'a:lnTo', null, ptX(a, b))); px = +a; py = +b }
      else if (cmd === 'C') { const v = t.slice(i, i + 6); i += 6; els.push(x('a:cubicBezTo', null, ptX(v[0], v[1]), ptX(v[2], v[3]), ptX(v[4], v[5]))); px = +v[4]; py = +v[5] }
      else if (cmd === 'Q') { const v = t.slice(i, i + 4); i += 4; els.push(x('a:quadBezTo', null, ptX(v[0], v[1]), ptX(v[2], v[3]))); px = +v[2]; py = +v[3] }
      else if (cmd === 'A') {
        // Back from an absolute endpoint to DrawingML's pen-relative arc: find the centre from the
        // two points, the radii and the flags (the SVG implementation-notes conversion), then the angles.
        const [rx, ry, , large, sweep, ex, ey] = t.slice(i, i + 7).map(Number); i += 7
        const c = svgArcCentre(px, py, rx, ry, large === 1, sweep === 1, ex, ey)
        if (c) {
          const ang = (X: number, Y: number) => { const u = Math.atan2((Y - c.cy) / c.ry, (X - c.cx) / c.rx); return Math.atan2(Math.sin(u) * c.ry, Math.cos(u) * c.rx) }
          const a0 = ang(px, py)
          let sw = ang(ex, ey) - a0
          if (sweep === 1 && sw < 0) sw += 2 * Math.PI
          if (sweep === 0 && sw > 0) sw -= 2 * Math.PI
          els.push(x('a:arcTo', { wR: Math.round(c.rx), hR: Math.round(c.ry), stAng: Math.round(a0 / RAD), swAng: Math.round(sw / RAD) }))
        } else els.push(x('a:lnTo', null, ptX(String(ex), String(ey))))
        px = ex
        py = ey
      } else i++
    }
    return x('a:path', { w: Math.round(p.w), h: Math.round(p.h), fill: p.fill === false ? 'none' : undefined, stroke: p.stroke === false ? 'false' : undefined }, ...els)
  }
  return x('a:custGeom', null, x('a:avLst', null), x('a:gdLst', null), x('a:ahLst', null), x('a:cxnLst', null), x('a:rect', { l: 'l', t: 't', r: 'r', b: 'b' }), x('a:pathLst', null, ...paths.map(pathXml)))
}

function svgArcCentre(x1: number, y1: number, rx: number, ry: number, large: boolean, sweep: boolean, x2: number, y2: number) {
  if (!rx || !ry) return null
  const dx = (x1 - x2) / 2
  const dy = (y1 - y2) / 2
  const lam = (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry)
  if (lam > 1) { rx *= Math.sqrt(lam); ry *= Math.sqrt(lam) }
  const num = rx * rx * ry * ry - rx * rx * dy * dy - ry * ry * dx * dx
  const den = rx * rx * dy * dy + ry * ry * dx * dx
  const k = (large === sweep ? -1 : 1) * Math.sqrt(Math.max(0, num / den))
  return { cx: k * ((rx * dy) / ry) + (x1 + x2) / 2, cy: k * (-(ry * dx) / rx) + (y1 + y2) / 2, rx, ry }
}
