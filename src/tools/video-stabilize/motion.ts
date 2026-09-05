// Measuring how much the camera moved, and deciding what to give up to undo it.
//
// PURE, WITH NO RUNTIME IMPORTS, and that is deliberate rather than tidy: the
// worker calls this, the page calls this to price the trade before anything is
// encoded, and `evals/shakeprobe.mjs` compiles it standalone with tsc and feeds
// it a synthetic wobble whose answer is known. That is the same arrangement as
// `relatedPick.ts` and `cvPatch.ts`, and it exists for the reason this repo has
// now recorded five times: a harness that keeps its own COPY of the thing it
// measures reports on a version nobody runs.
//
// THE CLAIM THE WHOLE TOOL RESTS ON is that stabilising costs picture. Undoing
// a shake means sliding each frame back under the output rectangle, so the far
// edge slides out of it and there is nothing to show there. Every stabiliser
// pays that; almost none of them SAY it, and the ones that do make you pick the
// crop yourself before you know how much you needed. `requiredZoom` below
// derives it from the shake that was actually measured, so the number on the
// screen is a property of the recording rather than a default.

/** One channel, tightly packed, row-major. */
export interface Gray {
  data: Uint8Array
  width: number
  height: number
}

/**
 * A rigid transform of the picture: rotate about the frame centre, then move.
 *
 * Rigid — rotation and translation — and NOT a full affine or homography. That
 * is a limit and it is stated in the UI rather than implied away: a rolling
 * shutter skews the frame and a stabiliser that only rotates and slides cannot
 * take the skew out. Fitting more parameters to a noisy tile field mostly buys
 * a wobblier estimate, and a scale term in particular reads every zoom or
 * forward step as shake and fights it.
 */
export interface Motion {
  /** Radians, about the centre of the frame. */
  rot: number
  /** Pixels, in the coordinate space the estimate was made in. */
  dx: number
  dy: number
}

export const STILL: Motion = { rot: 0, dx: 0, dy: 0 }

/** Apply `a` to the result of `b` — b first, then a. */
export function compose(a: Motion, b: Motion): Motion {
  const c = Math.cos(a.rot)
  const s = Math.sin(a.rot)
  return {
    rot: a.rot + b.rot,
    dx: c * b.dx - s * b.dy + a.dx,
    dy: s * b.dx + c * b.dy + a.dy,
  }
}

export function invert(m: Motion): Motion {
  const c = Math.cos(-m.rot)
  const s = Math.sin(-m.rot)
  return { rot: -m.rot, dx: -(c * m.dx - s * m.dy), dy: -(s * m.dx + c * m.dy) }
}

export function scaleMotion(m: Motion, k: number): Motion {
  return { rot: m.rot, dx: m.dx * k, dy: m.dy * k }
}

/** Halve a plane with a 2x2 box, which is the cheapest honest downsample. */
export function downsample(g: Gray): Gray {
  const w = Math.max(1, g.width >> 1)
  const h = Math.max(1, g.height >> 1)
  const out = new Uint8Array(w * h)
  for (let y = 0; y < h; y++) {
    const r0 = Math.min(y * 2, g.height - 1) * g.width
    const r1 = Math.min(y * 2 + 1, g.height - 1) * g.width
    for (let x = 0; x < w; x++) {
      const c0 = Math.min(x * 2, g.width - 1)
      const c1 = Math.min(x * 2 + 1, g.width - 1)
      out[y * w + x] = (g.data[r0 + c0] + g.data[r0 + c1] + g.data[r1 + c0] + g.data[r1 + c1] + 2) >> 2
    }
  }
  return { data: out, width: w, height: h }
}

/** Coarsest last. Three levels means the coarse search reaches four times further. */
export function pyramid(g: Gray, levels = 3): Gray[] {
  const out = [g]
  for (let i = 1; i < levels; i++) out.push(downsample(out[i - 1]))
  return out
}

/** How many tiles across and down. 16 vectors is enough to fit two parameters
 *  and few enough that a median can throw a third of them away. */
const GRID = 4
/** How far the coarsest level searches, in ITS pixels — so four times that at
 *  the analysis size, and (source width / analysis width) times that again. */
const COARSE = 6
/** Below this, a tile is flat — sky, a wall, a blown-out window — and the
 *  best match in it means nothing. Rejecting it is the difference between an
 *  estimate and a number. */
const MIN_DETAIL = 3.5

interface Vec { x: number; y: number; dx: number; dy: number }

function sad(
  a: Gray, b: Gray,
  x0: number, y0: number, tw: number, th: number,
  dx: number, dy: number,
): number {
  // The offset tile is bounds-checked ONCE rather than per pixel: an inner loop
  // with a comparison in it is most of the cost of the whole estimate.
  if (x0 + dx < 0 || y0 + dy < 0 || x0 + dx + tw > b.width || y0 + dy + th > b.height) return Infinity
  let s = 0
  for (let y = 0; y < th; y++) {
    let ao = (y0 + y) * a.width + x0
    let bo = (y0 + y + dy) * b.width + x0 + dx
    for (let x = 0; x < tw; x++) s += Math.abs(a.data[ao + x] - b.data[bo + x])
  }
  return s
}

/** Mean absolute deviation inside a tile — the cheap stand-in for "is there
 *  anything here to match". */
function detail(g: Gray, x0: number, y0: number, tw: number, th: number): number {
  let sum = 0
  for (let y = 0; y < th; y++) {
    const o = (y0 + y) * g.width + x0
    for (let x = 0; x < tw; x++) sum += g.data[o + x]
  }
  const mean = sum / (tw * th)
  let dev = 0
  for (let y = 0; y < th; y++) {
    const o = (y0 + y) * g.width + x0
    for (let x = 0; x < tw; x++) dev += Math.abs(g.data[o + x] - mean)
  }
  return dev / (tw * th)
}

/** Fit the vertex of a parabola through three samples, for the sub-pixel part.
 *  Clamped to half a pixel: three SAD readings do not entitle anyone to more. */
function vertex(left: number, mid: number, right: number): number {
  const denom = left - 2 * mid + right
  if (!Number.isFinite(denom) || denom <= 0) return 0
  const d = (left - right) / (2 * denom)
  return Math.max(-0.5, Math.min(0.5, d))
}

/**
 * The rigid transform that best takes the tile centres to where they were
 * found, in the least-squares sense. Kabsch in two dimensions, closed form.
 */
function fitRigid(vecs: Vec[]): Motion {
  const n = vecs.length
  if (!n) return STILL
  let px = 0, py = 0, qx = 0, qy = 0
  for (const v of vecs) { px += v.x; py += v.y; qx += v.x + v.dx; qy += v.y + v.dy }
  px /= n; py /= n; qx /= n; qy /= n
  let num = 0, den = 0
  for (const v of vecs) {
    const ax = v.x - px, ay = v.y - py
    const bx = v.x + v.dx - qx, by = v.y + v.dy - qy
    num += ax * by - ay * bx
    den += ax * bx + ay * by
  }
  const rot = (num === 0 && den === 0) ? 0 : Math.atan2(num, den)
  const c = Math.cos(rot), s = Math.sin(rot)
  return { rot, dx: qx - (c * px - s * py), dy: qy - (s * px + c * py) }
}

function median(xs: number[]): number {
  const a = [...xs].sort((p, q) => p - q)
  const h = a.length >> 1
  return a.length % 2 ? a[h] : (a[h - 1] + a[h]) / 2
}

export interface Estimate extends Motion {
  /** How many of the 16 tiles survived. Zero means nothing was measured and the
   *  frame is treated as still, which is the honest answer for a cut or a
   *  blackout — pretending otherwise puts a jolt in the output. */
  tiles: number
}

/**
 * Where the picture in `next` sits relative to the picture in `prev`.
 *
 * Coarse-to-fine on the pyramid, so a big shake is reachable without searching
 * a big window at full detail: the coarsest level looks +/-COARSE of ITS OWN
 * pixels, and each finer level only has to refine by one.
 */
export function estimateMotion(prev: Gray[], next: Gray[]): Estimate {
  const top = prev.length - 1
  const base = prev[0]
  const tw = Math.floor(base.width / (GRID + 1))
  const th = Math.floor(base.height / (GRID + 1))
  // A tile has to survive being halved twice and still have something in it.
  if (tw < (1 << top) * 4 || th < (1 << top) * 4) return { ...STILL, tiles: 0 }

  const vecs: Vec[] = []
  for (let ty = 0; ty < GRID; ty++) {
    for (let tx = 0; tx < GRID; tx++) {
      // Inset by half a tile all round, so the grid samples the middle of the
      // frame rather than its edges, which are the first thing a shake pushes
      // out of view and therefore the least reliable place to look.
      const x0 = Math.round((tx + 0.5) * tw)
      const y0 = Math.round((ty + 0.5) * th)
      if (detail(base, x0, y0, tw, th) < MIN_DETAIL) continue

      let dx = 0, dy = 0
      for (let level = top; level >= 0; level--) {
        const a = prev[level], b = next[level]
        const shift = 1 << level
        const lx = Math.round(x0 / shift), ly = Math.round(y0 / shift)
        const lw = Math.max(4, Math.round(tw / shift)), lh = Math.max(4, Math.round(th / shift))
        const reach = level === top ? COARSE : 1
        let best = Infinity, bx = dx, by = dy
        for (let oy = dy - reach; oy <= dy + reach; oy++) {
          for (let ox = dx - reach; ox <= dx + reach; ox++) {
            const s = sad(a, b, lx, ly, lw, lh, ox, oy)
            if (s < best) { best = s; bx = ox; by = oy }
          }
        }
        if (!Number.isFinite(best)) { dx = dx * 2; dy = dy * 2; continue }
        if (level === 0) {
          // Sub-pixel only at the bottom, where a pixel is a pixel.
          const l = sad(a, b, lx, ly, lw, lh, bx - 1, by)
          const r = sad(a, b, lx, ly, lw, lh, bx + 1, by)
          const u = sad(a, b, lx, ly, lw, lh, bx, by - 1)
          const d = sad(a, b, lx, ly, lw, lh, bx, by + 1)
          vecs.push({
            x: x0 + tw / 2 - base.width / 2,
            y: y0 + th / 2 - base.height / 2,
            dx: bx + vertex(l, best, r),
            dy: by + vertex(u, best, d),
          })
        } else {
          dx = bx * 2
          dy = by * 2
        }
      }
    }
  }
  if (vecs.length < 3) return { ...STILL, tiles: vecs.length }

  // A moving subject fills its tiles with its own motion, not the camera's, and
  // averaging those in tilts the whole estimate towards it. The median is what
  // the frame as a whole did; anything far from it is something IN the frame.
  const mx = median(vecs.map((v) => v.dx))
  const my = median(vecs.map((v) => v.dy))
  const spread = Math.max(1.5, median(vecs.map((v) => Math.abs(v.dx - mx) + Math.abs(v.dy - my))) * 2.5)
  const kept = vecs.filter((v) => Math.abs(v.dx - mx) + Math.abs(v.dy - my) <= spread)
  const use = kept.length >= 3 ? kept : vecs
  return { ...fitRigid(use), tiles: use.length }
}

/**
 * Where the picture has drifted to by each frame, relative to the first.
 *
 * Composed rather than summed. Summing `dx` and `rot` separately is what nearly
 * every stabiliser tutorial does and it is only right while the total rotation
 * stays near zero; a clip that ends up ten degrees round has been accumulating
 * its translations in the wrong frame of reference the whole way.
 */
export function accumulate(steps: Motion[]): Motion[] {
  const out: Motion[] = [STILL]
  let at: Motion = STILL
  for (const step of steps) { at = compose(step, at); out.push(at) }
  return out
}

/**
 * A gaussian along the path, clamped at the ends.
 *
 * SMOOTHED, NOT FLATTENED. Holding the picture still would fight a deliberate
 * pan as hard as it fights a wobble, and the result is a shot that lurches back
 * every time you stop moving — which is worse than the shake. What is removed
 * is the difference between where the camera went and where it was heading.
 */
export function smooth(path: Motion[], radius: number): Motion[] {
  const r = Math.max(0, Math.round(radius))
  if (r === 0) return [...path]
  const sigma = Math.max(0.5, r / 2)
  const w: number[] = []
  for (let i = -r; i <= r; i++) w.push(Math.exp(-(i * i) / (2 * sigma * sigma)))
  return path.map((_, i) => {
    let rot = 0, dx = 0, dy = 0, sum = 0
    for (let k = -r; k <= r; k++) {
      const j = Math.min(path.length - 1, Math.max(0, i + k))
      const weight = w[k + r]
      rot += path[j].rot * weight
      dx += path[j].dx * weight
      dy += path[j].dy * weight
      sum += weight
    }
    return { rot: rot / sum, dx: dx / sum, dy: dy / sum }
  })
}

/** What to do to frame `i` so its content lands where the smoothed path says. */
export function corrections(path: Motion[], smoothed: Motion[]): Motion[] {
  return path.map((p, i) => compose(smoothed[i], invert(p)))
}

/**
 * The smallest zoom at which no frame shows a blank edge — THE PRICE, in one
 * number, derived from the shake that was measured rather than picked.
 *
 * Closed form rather than a search. A corrected frame is the source rotated by
 * `rot` and moved by `(dx, dy)`; the output is the centred rectangle
 * `w/z` by `h/z`. Mapping that rectangle's corners back through the correction
 * and requiring them inside the source gives, for the worst corner:
 *
 *   (|cos|.w + |sin|.h) / z <= w - 2|ex|   and   (|sin|.w + |cos|.h) / z <= h - 2|ey|
 *
 * where `(ex, ey)` is the translation expressed in the source's own axes. A
 * frame whose correction is larger than the frame has no solution at all, which
 * is what the cap is for: past that the answer is not a zoom, it is that the
 * shake is too big to take out of this recording.
 */
export function requiredZoom(cs: Motion[], w: number, h: number, cap = 2): number {
  let z = 1
  for (const c of cs) {
    const co = Math.abs(Math.cos(c.rot)), si = Math.abs(Math.sin(c.rot))
    const cc = Math.cos(-c.rot), ss = Math.sin(-c.rot)
    const ex = Math.abs(cc * c.dx - ss * c.dy)
    const ey = Math.abs(ss * c.dx + cc * c.dy)
    const availW = w - 2 * ex
    const availH = h - 2 * ey
    if (availW <= 0 || availH <= 0) return cap
    z = Math.max(z, (co * w + si * h) / availW, (si * w + co * h) / availH)
    if (z >= cap) return cap
  }
  return z
}

/**
 * How much of the picture survives, as a fraction of its area.
 *
 * Area, not width: a 1.1x zoom sounds like a tenth and costs 17% of the
 * picture, and the number people are deciding with is how much is left.
 */
export function keptFraction(zoom: number): number {
  return 1 / (zoom * zoom)
}

export interface Shake {
  /** Root-mean-square of the residual the smoothing removes, in source pixels. */
  pixels: number
  /** The same for rotation, in degrees. */
  degrees: number
  /** Frames whose motion could not be measured at all. */
  blind: number
}

/** What was actually taken out — the honest headline, and the one figure that
 *  says whether the clip needed this tool at all. */
export function shakeOf(cs: Motion[], estimates: Estimate[]): Shake {
  let sum = 0, rot = 0
  for (const c of cs) { sum += c.dx * c.dx + c.dy * c.dy; rot += c.rot * c.rot }
  const n = Math.max(1, cs.length)
  return {
    pixels: Math.sqrt(sum / n),
    degrees: (Math.sqrt(rot / n) * 180) / Math.PI,
    blind: estimates.filter((e) => e.tiles === 0).length,
  }
}

/**
 * Draw one frame where the smoothed path says it should be.
 *
 * The transform is built from the outside in, and every step of it is the
 * inverse of a step in the derivation in `motion.ts`: the visible part of the
 * corrected frame is the centred rectangle `w/zoom` by `h/zoom`, and that is
 * what fills the output. Getting the order wrong here rotates about a corner
 * instead of the middle, which looks like a much worse shake.
 */
export function drawStabilised(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  source: CanvasImageSource,
  src: { width: number; height: number },
  c: Motion,
  zoom: number,
  out: { width: number; height: number },
  /** Paint the black ground first. Off for the second layer of the ghost
   *  comparison, which has to sit ON the first rather than replace it. */
  clear = true,
): void {
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  // Black underneath, because a rounding error of a pixel at the edge is a
  // transparent seam otherwise — and on a video that reads as a flicker.
  if (clear) {
    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, out.width, out.height)
  }
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.translate(out.width / 2, out.height / 2)
  ctx.scale((zoom * out.width) / src.width, (zoom * out.height) / src.height)
  ctx.translate(c.dx, c.dy)
  ctx.rotate(c.rot)
  ctx.translate(-src.width / 2, -src.height / 2)
  ctx.drawImage(source, 0, 0, src.width, src.height)
  ctx.setTransform(1, 0, 0, 1, 0, 0)
}
