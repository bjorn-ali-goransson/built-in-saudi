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

// --------------------------------------------------------------- following ---
//
// FOLLOWING A SUBJECT IS THE SAME MACHINERY POINTED THE OTHER WAY. The estimator
// above rejects the tiles that disagree with the median precisely BECAUSE they
// are something moving through the shot; here that thing is what we want, so it
// is matched on its own rather than voted out.
//
// Two separate jobs, and keeping them apart is what makes the result usable:
// the camera correction takes the shake out at full strength, and the follow
// term then decides how tightly the framing chases the subject inside the
// already-steady picture. Smoothing ONE control would have let the shake back
// in every time somebody wanted a looser follow.

/** A rectangle in the pixels of the plane it was measured in. */
export interface Box { x: number; y: number; w: number; h: number }

/** Where the subject was found in one frame, relative to the frame CENTRE. */
export interface TrackPoint {
  x: number
  y: number
  /**
   * How DISTINCTIVE the match is: 1 means the subject was found somewhere
   * nothing else nearby resembles, 0 that the best position is no better than
   * half a subject away — which is what being lost looks like from inside.
   *
   * Distinctiveness rather than absolute agreement, and that is a correction
   * measured on real footage. Scoring the SAD against the template's own
   * contrast reads 1.00 on synthetic frames and 0.49 on a compressed clip the
   * tracker was following perfectly, because compression puts a floor under the
   * SAD that the template's contrast knows nothing about. A confidence whose
   * good and bad values overlap cannot be thresholded at all.
   */
  score: number
}

/** How far down the pyramid the search starts, and how wide it looks there. */
const TRACK_COARSE = 8
/** A box with less texture than this cannot be followed, and saying so beats
 *  returning a position that is really the search window's centre. */
const TRACK_MIN_DETAIL = 3.0
/** Above this the template is worth learning from; below it, a bad frame would
 *  poison the thing being matched against for the rest of the clip. */
const TRACK_KEEP = 0.55
const TRACK_BLEND = 0.12
/**
 * Below this the tracker is guessing, and the UI says where it stopped being
 * sure. Measured on BOTH a synthetic path and a real encoded clip, which is
 * what the first attempt at this number lacked: a subject in plain view scores
 * around 0.9 either way, and one that has walked out of the picture scores 0
 * because there is nothing left to be distinctive against.
 */
export const TRACK_LOST = 0.35

export interface Tracker {
  /** The subject as it looked, one plane per pyramid level. */
  patch: Gray[]
  /** Top-left in the pixels of the FULL-resolution analysis plane. */
  x: number
  y: number
  /** Per-frame velocity, which is most of the prediction on a fast subject. */
  vx: number
  vy: number
  /** The template's own mean absolute deviation — the yardstick a SAD is
   *  scored against, so `score` means the same thing on any subject. */
  detail: number
}

function cropPlane(g: Gray, x0: number, y0: number, w: number, h: number): Gray {
  const out = new Uint8Array(w * h)
  for (let y = 0; y < h; y++) {
    const sy = Math.min(g.height - 1, Math.max(0, y0 + y))
    for (let x = 0; x < w; x++) {
      out[y * w + x] = g.data[sy * g.width + Math.min(g.width - 1, Math.max(0, x0 + x))]
    }
  }
  return { data: out, width: w, height: h }
}

/** SAD of a whole small plane against a window of a big one, per pixel.
 *  Infinity when the window falls outside, so an off-frame guess never wins. */
function patchSad(t: Gray, g: Gray, x0: number, y0: number): number {
  if (x0 < 0 || y0 < 0 || x0 + t.width > g.width || y0 + t.height > g.height) return Infinity
  let s = 0
  for (let y = 0; y < t.height; y++) {
    const to = y * t.width
    const go = (y0 + y) * g.width + x0
    for (let x = 0; x < t.width; x++) s += Math.abs(t.data[to + x] - g.data[go + x])
  }
  return s / (t.width * t.height)
}

/**
 * Start following whatever is inside `box`, or refuse.
 *
 * The refusal is the useful half: a box drawn on a wall, the sky or a blown-out
 * window has nothing in it to match, and a tracker that accepted it would
 * report a confident path that is really the search window sliding about.
 */
export function startTrack(pyr: Gray[], box: Box): Tracker | null {
  const base = pyr[0]
  // THE BOX IS TRIMMED TO ITS MIDDLE, and that is a measured decision rather
  // than tidiness. Nobody drags a rectangle tight around a moving subject, so
  // the corners are background — and background inside the template does not
  // move with the subject, so the slow blend below smears it into a haze. On a
  // real clip that showed up twice over: the match quality fell to a floor
  // after twenty-odd frames, and the match stopped being distinctive from its
  // own neighbourhood, both while the subject was still being followed
  // perfectly. Taking the middle 72% keeps what somebody was pointing at and
  // drops most of what they were not.
  const inset = 0.14
  const bx = box.x + box.w * inset
  const by = box.y + box.h * inset
  const bw = box.w * (1 - 2 * inset)
  const bh = box.h * (1 - 2 * inset)
  const x = Math.round(Math.min(Math.max(0, bx), base.width - 8))
  const y = Math.round(Math.min(Math.max(0, by), base.height - 8))
  const w = Math.round(Math.min(bw, base.width - x))
  const h = Math.round(Math.min(bh, base.height - y))
  if (w < 8 || h < 8) return null
  const d = detail(base, x, y, w, h)
  if (d < TRACK_MIN_DETAIL) return null
  const patch: Gray[] = []
  for (let level = 0; level < pyr.length; level++) {
    const s = 1 << level
    const lw = Math.max(4, Math.round(w / s))
    const lh = Math.max(4, Math.round(h / s))
    if (lw < 4 || lh < 4) break
    patch.push(cropPlane(pyr[level], Math.round(x / s), Math.round(y / s), lw, lh))
  }
  return { patch, x, y, vx: 0, vy: 0, detail: d }
}

/**
 * Find the subject in the next frame, and say how sure it is.
 *
 * `hint` is the CAMERA step already measured for this pair, which is most of
 * the answer for free: a subject that did not move at all still moves across
 * the sensor by exactly the camera's motion, so predicting with it means the
 * search window only has to cover what the subject itself did.
 */
export function trackNext(t: Tracker, pyr: Gray[], hint: Motion, centre: { x: number; y: number }): TrackPoint {
  const cx = t.x + t.patch[0].width / 2
  const cy = t.y + t.patch[0].height / 2
  const moved = applyMotion(hint, cx - centre.x, cy - centre.y)
  // Where the camera alone would have put it — the baseline the subject's own
  // velocity is measured AGAINST. Adding the camera step into the velocity and
  // then applying both is a double count, and it walks the box off the subject
  // a few pixels at a time: measured at 2.33px rms with the bug and 0.45 after.
  const camX = moved.x + centre.x - t.patch[0].width / 2
  const camY = moved.y + centre.y - t.patch[0].height / 2
  const px = camX + t.vx
  const py = camY + t.vy

  const top = Math.min(t.patch.length, pyr.length) - 1
  let bx = Math.round(px), by = Math.round(py), best = Infinity
  for (let level = top; level >= 0; level--) {
    const s = 1 << level
    const reach = level === top ? TRACK_COARSE : 2
    const g = pyr[level]
    const patch = t.patch[level]
    let lx = Math.round(bx / s), ly = Math.round(by / s)
    let lb = Infinity, nx = lx, ny = ly
    for (let oy = -reach; oy <= reach; oy++) {
      for (let ox = -reach; ox <= reach; ox++) {
        const v = patchSad(patch, g, lx + ox, ly + oy)
        if (v < lb) { lb = v; nx = lx + ox; ny = ly + oy }
      }
    }
    if (!Number.isFinite(lb)) continue
    best = lb
    if (level === 0) {
      // Sub-pixel only at the bottom, exactly as the tile matcher does it: the
      // subject rarely moves a whole pixel a frame, and rounding every frame is
      // a bias rather than noise — it accumulates.
      const l = patchSad(patch, g, nx - 1, ny)
      const r = patchSad(patch, g, nx + 1, ny)
      const u = patchSad(patch, g, nx, ny - 1)
      const d2 = patchSad(patch, g, nx, ny + 1)
      bx = nx + vertex(l, lb, r)
      by = ny + vertex(u, lb, d2)
    } else {
      bx = nx * s
      by = ny * s
    }
  }
  if (!Number.isFinite(best)) {
    // Nothing matched anywhere — hold the prediction and say it is a guess, so
    // the caller can report where the subject was lost rather than pretending.
    t.x = px; t.y = py
    return { x: t.x + t.patch[0].width / 2 - centre.x, y: t.y + t.patch[0].height / 2 - centre.y, score: 0 }
  }

  // How much better this position is than being half a subject away. Four
  // probes rather than a full sidelobe sweep: the cost is four SADs a frame,
  // and what is being asked is only whether the match is a peak or a plateau.
  const p0 = t.patch[0]
  const ix = Math.round(bx), iy = Math.round(by)
  // A WHOLE patch away, not half. Half still overlaps most of the subject —
  // measured, that made a perfectly tracked clip read 0.04 for a stretch,
  // because the template matched itself at the probe almost as well as at the
  // truth. "Somewhere else" has to mean somewhere else.
  const ox = Math.max(6, p0.width), oy = Math.max(6, p0.height)
  const elsewhere = Math.min(
    patchSad(p0, pyr[0], ix - ox, iy),
    patchSad(p0, pyr[0], ix + ox, iy),
    patchSad(p0, pyr[0], ix, iy - oy),
    patchSad(p0, pyr[0], ix, iy + oy),
  )
  const score = Number.isFinite(elsewhere) && elsewhere > 0
    ? Math.max(0, Math.min(1, 1 - best / elsewhere))
    // Every probe fell outside the frame, which means the subject is at the
    // edge and about to leave it. There is nothing to compare against, so this
    // says "no longer sure" rather than inventing a number.
    : 0

  t.vx = bx - camX
  t.vy = by - camY
  t.x = bx
  t.y = by
  if (score >= TRACK_KEEP) {
    // Learn slowly, and only from a frame worth learning from. A subject turns,
    // is lit differently and passes behind things; a template frozen at frame
    // one loses it, and one updated unconditionally walks off onto whatever
    // happened to be under the box when the match went bad.
    for (let level = 0; level < t.patch.length && level < pyr.length; level++) {
      const s = 1 << level
      const fresh = cropPlane(pyr[level], Math.round(bx / s), Math.round(by / s),
        t.patch[level].width, t.patch[level].height)
      const p = t.patch[level].data
      for (let i = 0; i < p.length; i++) p[i] = Math.round(p[i] * (1 - TRACK_BLEND) + fresh.data[i] * TRACK_BLEND)
    }
  }
  return { x: bx + t.patch[0].width / 2 - centre.x, y: by + t.patch[0].height / 2 - centre.y, score }
}

/** Where a point relative to the frame CENTRE lands after a correction. The
 *  inverse of nothing — it is exactly what `drawStabilised` does to a pixel. */
export function applyMotion(m: Motion, x: number, y: number): { x: number; y: number } {
  const c = Math.cos(m.rot), s = Math.sin(m.rot)
  return { x: c * x - s * y + m.dx, y: s * x + c * y + m.dy }
}

/**
 * The corrections that hold a tracked subject near the middle.
 *
 * COMPOSED WITH THE CAMERA CORRECTION rather than replacing it, which is the
 * decision that makes the control mean one thing. The subject's position is
 * read in the ALREADY-STEADY frame, so the shake is out at full strength
 * whatever the slider says, and smoothing only decides how loosely the framing
 * chases the subject — a camera operator following somebody, rather than a
 * rectangle nailed to them.
 *
 * `radius` of 0 is that nail: the subject sits dead centre in every frame, and
 * every step it takes is paid for in crop.
 */
export function followCorrections(points: TrackPoint[], cam: Motion[], radius: number): Motion[] {
  if (!points.length) return cam
  const want: Motion[] = cam.map((c, i) => {
    const p = points[Math.min(i, points.length - 1)]
    const seen = applyMotion(c, p.x, p.y)
    return { rot: 0, dx: -seen.x, dy: -seen.y }
  })
  const eased = smooth(want, radius)
  return cam.map((c, i) => compose(eased[i], c))
}

/** How far the subject strays from the middle, RMS, in the pixels the points
 *  were measured in. The number the follow mode exists to make small. */
export function subjectSpread(points: TrackPoint[], cs: Motion[]): number {
  if (!points.length) return 0
  let sum = 0
  for (let i = 0; i < cs.length; i++) {
    const p = points[Math.min(i, points.length - 1)]
    const s = applyMotion(cs[i], p.x, p.y)
    sum += s.x * s.x + s.y * s.y
  }
  return Math.sqrt(sum / Math.max(1, cs.length))
}
