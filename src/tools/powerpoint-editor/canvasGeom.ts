// The arithmetic behind dragging things on a slide, kept pure so it can be
// tested without a pointer: resizing a ROTATED box from any handle while the
// opposite corner stays put, moving with snapping, rotating with detents, and
// the two-point geometry of a line.
export interface Box { x: number; y: number; w: number; h: number; rot?: number }
export type Handle = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'
export const HANDLES: Handle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']

const rad = (d: number) => (d * Math.PI) / 180
function rotate(x: number, y: number, deg: number): [number, number] {
  const a = rad(deg)
  return [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)]
}

/**
 * Resize from a handle. Works in the box's OWN frame — the pointer is turned
 * back by the rotation — so dragging the east handle of a box at 30° widens it
 * along its own axis, and the corner (or edge) opposite the handle stays where
 * it was on the slide. Without that the box drifts across the slide as you
 * resize it, which is how naive implementations feel.
 */
export function resize(b: Box, h: Handle, px: number, py: number, opts: { keepAspect?: boolean; min?: number } = {}): Box {
  const min = opts.min ?? 4
  const rot = b.rot || 0
  const cx = b.x + b.w / 2
  const cy = b.y + b.h / 2
  const [lx, ly] = rotate(px - cx, py - cy, -rot)
  let x0 = -b.w / 2, y0 = -b.h / 2, x1 = b.w / 2, y1 = b.h / 2
  if (h.includes('w')) x0 = Math.min(lx, x1 - min)
  if (h.includes('e')) x1 = Math.max(lx, x0 + min)
  if (h.includes('n')) y0 = Math.min(ly, y1 - min)
  if (h.includes('s')) y1 = Math.max(ly, y0 + min)
  if (opts.keepAspect && b.w > 0 && b.h > 0) {
    const ratio = b.w / b.h
    let w = x1 - x0, hh = y1 - y0
    if (h.length === 2) { if (w / hh > ratio) hh = w / ratio; else w = hh * ratio }
    else if (h === 'e' || h === 'w') hh = w / ratio
    else w = hh * ratio
    // Grow from the anchored side.
    if (h.includes('w')) x0 = x1 - w; else if (h.includes('e')) x1 = x0 + w; else { const m = (x0 + x1) / 2; x0 = m - w / 2; x1 = m + w / 2 }
    if (h.includes('n')) y0 = y1 - hh; else if (h.includes('s')) y1 = y0 + hh; else { const m = (y0 + y1) / 2; y0 = m - hh / 2; y1 = m + hh / 2 }
  }
  const w = x1 - x0, hh = y1 - y0
  const [dx, dy] = rotate((x0 + x1) / 2, (y0 + y1) / 2, rot)
  const ncx = cx + dx, ncy = cy + dy
  return { x: ncx - w / 2, y: ncy - hh / 2, w, h: hh, rot: b.rot }
}

/** Rotation from the centre to the pointer, handle above the box; shift snaps to 15°, and 0/90/180/270 always pull. */
export function rotation(b: Box, px: number, py: number, step = false): number {
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2
  let deg = (Math.atan2(py - cy, px - cx) * 180) / Math.PI + 90
  deg = ((deg % 360) + 360) % 360
  if (step) deg = Math.round(deg / 15) * 15
  else for (const q of [0, 90, 180, 270, 360]) if (Math.abs(deg - q) < 3) deg = q
  deg = Math.round(deg * 10) / 10
  return deg >= 360 ? 0 : deg
}

/** A line's two ends from its box and flips, and back. */
export function lineEnds(b: Box & { flipH?: boolean; flipV?: boolean }): [[number, number], [number, number]] {
  const a: [number, number] = [b.flipH ? b.x + b.w : b.x, b.flipV ? b.y + b.h : b.y]
  const z: [number, number] = [b.flipH ? b.x : b.x + b.w, b.flipV ? b.y : b.y + b.h]
  return [a, z]
}
export function lineBox(a: [number, number], z: [number, number]): { x: number; y: number; w: number; h: number; flipH?: boolean; flipV?: boolean } {
  return { x: Math.min(a[0], z[0]), y: Math.min(a[1], z[1]), w: Math.abs(z[0] - a[0]), h: Math.abs(z[1] - a[1]), flipH: z[0] < a[0] || undefined, flipV: z[1] < a[1] || undefined }
}

export interface Guide { axis: 'x' | 'y'; at: number }
/**
 * Snap a moving box's left/centre/right (and top/middle/bottom) to the slide's
 * edges and centre and to other boxes'. Returns the corrected offset and the
 * guides to draw — the guide is what tells a person it snapped on purpose.
 */
export function snapMove(b: Box, dx: number, dy: number, others: Box[], slide: { w: number; h: number }, tol: number): { dx: number; dy: number; guides: Guide[] } {
  const xs = [0, slide.w / 2, slide.w]
  const ys = [0, slide.h / 2, slide.h]
  for (const o of others) { xs.push(o.x, o.x + o.w / 2, o.x + o.w); ys.push(o.y, o.y + o.h / 2, o.y + o.h) }
  const best = (vals: number[], targets: number[]) => {
    let d = Infinity, at = 0
    for (const v of vals) for (const t of targets) if (Math.abs(t - v) < Math.abs(d)) { d = t - v; at = t }
    return Math.abs(d) <= tol ? { d, at } : null
  }
  const nx = b.x + dx, ny = b.y + dy
  const sx = best([nx, nx + b.w / 2, nx + b.w], xs)
  const sy = best([ny, ny + b.h / 2, ny + b.h], ys)
  const guides: Guide[] = []
  if (sx) guides.push({ axis: 'x', at: sx.at })
  if (sy) guides.push({ axis: 'y', at: sy.at })
  return { dx: dx + (sx?.d || 0), dy: dy + (sy?.d || 0), guides }
}

/** The axis-aligned box a rotated box covers — for marquee selection and snapping others to it. */
export function bounds(b: Box): Box {
  if (!b.rot) return { x: b.x, y: b.y, w: b.w, h: b.h }
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2
  const pts = [[-b.w / 2, -b.h / 2], [b.w / 2, -b.h / 2], [b.w / 2, b.h / 2], [-b.w / 2, b.h / 2]].map(([x, y]) => rotate(x, y, b.rot!))
  const xs = pts.map((p) => p[0] + cx), ys = pts.map((p) => p[1] + cy)
  const x = Math.min(...xs), y = Math.min(...ys)
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y }
}
export const intersects = (a: Box, b: Box) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
