// What the output frame looks like — the crop geometry, the hidden regions and
// the caption placement, with no canvas, no codec and no React in sight.
//
// IT IS PURE BECAUSE IT IS USED TWICE, AND IN LIB BECAUSE IT IS USED BY TWO
// TOOLS. The preview on the page draws from a `<video>` element or an
// `ImageBitmap` and the exporter draws from a decoded `VideoFrame` or the same
// bitmap at full size; all of them are a `CanvasImageSource`, so `drawFrame`
// below is called by every one of them with the same numbers. A preview
// computed by one set of rules and an export computed by another is a preview
// that lies, which is the single worst thing an editor can do — you would only
// find out after the encode.
//
// It was `video-edit/compose.ts` until `image-edit` needed the same crop
// arithmetic, the same snapping, the same censor drawing and the same caption
// placement. What a still picture does NOT share with a clip stayed behind: a
// timeline, a join, an encoder, an audio track.

import { even } from './mp4Encode'

// Re-exported: it was defined here first and `outputSize` below is its main
// caller, so a tool importing it from this module is not wrong.
export { even }

/** A rectangle in FRACTIONS of the source frame, so it survives a change of clip. */
export interface Rect { x: number; y: number; w: number; h: number }

export interface Crop {
  /** Width ÷ height of the output. */
  aspect: number
  /** Where the middle of the kept rectangle sits, as a fraction of the frame. */
  cx: number
  cy: number
  /** 1 keeps as much as the aspect allows; 2 keeps half the width and height. */
  zoom: number
}

/**
 * A caption is a BOX, exactly like a censor, and that is the point.
 *
 * It used to be a point with the text centred on it and wrapped at 90% of the
 * frame, which means the writer places the middle of something whose extent
 * they cannot see and finds out where it broke afterwards. A rectangle is
 * drawn with the same gesture that draws a censor, the text is centred inside
 * it, and it wraps to the WIDTH THAT IS ON SCREEN — so the shape you drew is
 * the shape you get.
 */
export interface Caption {
  id: string
  text: string
  /** The box, in fractions of the OUTPUT frame. */
  x: number
  y: number
  w: number
  h: number
  /** Text size as a fraction of the output HEIGHT. */
  size: number
  colour: string
  /** A band behind the text. Unreadable captions are the commonest failure. */
  band: boolean
  /** Seconds on the OUTPUT timeline. */
  from: number
  to: number
}

/**
 * How a region is hidden — and WHICH of these to reach for is a measured
 * question, not a matter of taste.
 *
 * `node evals/pixelleak.mjs`: the mosaic grid stays fixed to the FRAME while
 * the subject moves through it, so every frame samples the same picture on a
 * differently-aligned grid and each one is a fresh set of constraints on the
 * same pixels. Textbook back-projection, no libraries, recovers **98.6% of a
 * pixelated number plate from 64 frames — 2.1 seconds at 30fps** — against
 * 68.3% from one frame, which is the score a blank guess gets. The control is
 * the load-bearing half: a STATIC subject stays at 68.3% however many frames
 * you have, so the leak comes from motion rather than from the reconstruction
 * being clever. `blur` is the same operation with the smoothing on, so it leaks
 * at least as much; `solid` is the only one of the three that removes anything.
 *
 * **`pixelate` is nevertheless the default**, and that reverses what the
 * measurement alone would say. A black rectangle was read, from a real phone,
 * as "pixelation is not implemented here, so you are getting the fallback" —
 * and somebody who believes that goes and finds a tool that does the visible
 * thing, which almost certainly uploads their video. A tool whose safest mode
 * looks like a missing feature has protected nobody. So the default is the one
 * people recognise, solid is one tap away behind the box's own cog, and the
 * measurement is written next to the choice rather than under every clip.
 */
export type CensorMode = 'pixelate' | 'solid' | 'blur'

/**
 * Where a box IS at one moment, in fractions of the output frame.
 *
 * A censor used to be one fixed rectangle, and the limit that came with it was
 * stated rather than solved: the thing worth hiding is almost always the thing
 * that MOVES, so a fixed box has to be drawn generously enough to cover
 * everywhere the subject goes — which hides most of the picture to hide one
 * face, or does not hide it at the end.
 */
export interface Key { t: number; x: number; y: number; w: number; h: number }

export interface Censor {
  id: string
  mode: CensorMode
  /**
   * Where the box is, at the times it was put there. Sorted by `t` and never
   * empty; one key is a box that does not move, and two identical ones are the
   * same thing — which is what a freshly drawn box is.
   */
  keys: Key[]
  /** Seconds on the OUTPUT timeline. */
  from: number
  to: number
  /**
   * Set when the box was told to FOLLOW what is underneath it — the measured
   * path of the subject, which `keys` above is then DERIVED from.
   *
   * It is kept in the source picture's own space rather than in the output's,
   * and that is the decision worth keeping. A censor is placed in the output
   * frame, so re-cropping afterwards would leave a hand-drawn box exactly where
   * it was on screen and over something else entirely. A followed box is not a
   * position on a screen, it is a claim about where a face IS — so it is stored
   * against the picture, and the crop is applied on the way out. Change the
   * crop and the box stays on the face, which is the only behaviour that does
   * not quietly uncensor somebody.
   */
  path?: TrackPath
}

/**
 * Where a followed box goes, measured in the picture rather than on the screen.
 *
 * `keys` are in fractions of the SOURCE frame of clip `slot`, timed in that
 * CLIP's own seconds — not the joined timeline's. Both halves matter: a trim
 * moves the clip on the joined clock and must not move the path relative to
 * the picture, and a crop changes the mapping to the output without changing
 * where the subject was.
 */
export interface TrackPath {
  /** The clip the path was measured in. A join is a cut, and a face tracked in
   *  one clip says nothing about the next, so a path belongs to exactly one. */
  slot: number
  keys: Key[]
  /** Where the tracker stopped being sure, in the clip's own seconds, or 0 if
   *  it never did. Reported rather than hidden: a follow that has lost its
   *  subject looks perfectly fine on the frame you happen to be looking at. */
  lostAt: number
}

/**
 * A measured path, in the output fractions and joined seconds `keys` uses.
 *
 * ONE function, called by the page for the stage AND for the export plan, so
 * the two cannot disagree about where a box is — the property this whole module
 * exists to hold. Keys outside the clip's kept stretch are dropped: a cut takes
 * frames away, and a key pointing at one of them is a position in a picture
 * that will not be in the file.
 */
export function projectPath(
  path: TrackPath,
  clip: { width: number; height: number },
  crop: Crop,
  trim: { in: number; out: number },
  /** Where this clip starts on the joined timeline. */
  offset: number,
): Key[] {
  const r = cropRect(clip, crop)
  const out = path.keys
    .filter((k) => k.t >= trim.in - 1e-6 && k.t <= trim.out + 1e-6)
    .map((k) => ({
      t: offset + Math.max(0, k.t - trim.in),
      x: (k.x * clip.width - r.x) / r.w,
      y: (k.y * clip.height - r.y) / r.h,
      w: (k.w * clip.width) / r.w,
      h: (k.h * clip.height) / r.h,
    }))
  // A cut that lands between two keys leaves none inside it. Holding the
  // nearest one beats showing nothing, because showing nothing here means the
  // box is gone and whatever it was hiding is not.
  if (out.length) return out
  const near = path.keys.reduce(
    (best, k) => (Math.abs(k.t - trim.in) < Math.abs(best.t - trim.in) ? k : best),
    path.keys[0],
  )
  return near
    ? [{
      t: offset,
      x: (near.x * clip.width - r.x) / r.w,
      y: (near.y * clip.height - r.y) / r.h,
      w: (near.w * clip.width) / r.w,
      h: (near.h * clip.height) / r.h,
    }]
    : []
}

/**
 * Drop the keys a path does not need, so a minute of video is not a thousand
 * rectangles.
 *
 * The tracker reports one position per FRAME, which is the right thing for it
 * to do and the wrong thing to keep: `boxAt` tweens between the two keys either
 * side of a moment, so a key that sits on the line between its neighbours says
 * nothing the tween would not already have said. A key survives only if the box
 * has actually moved since the last one kept, or if enough time has passed that
 * a slow drift would otherwise be straightened out.
 *
 * `tol` is in fractions of the frame: 0.002 is a fifth of one per cent, which
 * is well under a pixel on any stage this is looked at.
 */
export function thinPath(keys: Key[], tol = 0.002, maxGap = 0.5): Key[] {
  if (keys.length <= 2) return [...keys]
  const out: Key[] = [keys[0]]
  for (let i = 1; i < keys.length - 1; i++) {
    const k = keys[i]
    const last = out[out.length - 1]
    const moved = Math.abs(k.x - last.x) + Math.abs(k.y - last.y)
      + Math.abs(k.w - last.w) + Math.abs(k.h - last.h)
    if (moved >= tol || k.t - last.t >= maxGap) out.push(k)
  }
  out.push(keys[keys.length - 1])
  return out
}

/** Move a whole measured path, so dragging a followed box re-aims the follow
 *  rather than silently ending it. */
export function shiftPath(path: TrackPath, dx: number, dy: number): TrackPath {
  return { ...path, keys: path.keys.map((k) => ({ ...k, x: k.x + dx, y: k.y + dy })) }
}

/**
 * Resize a whole measured path, so a box drawn too small can be grown without
 * losing what it learned.
 *
 * The TOP-LEFT of each key is held, not its centre, because that is the corner
 * the resize handle anchors on: growing the box on screen must grow it in the
 * same direction everywhere else on the path, or the rectangle under the finger
 * and the rectangle in the export are two different shapes.
 */
export function resizePath(path: TrackPath, w: number, h: number): TrackPath {
  return { ...path, keys: path.keys.map((k) => ({ ...k, w, h })) }
}

/**
 * The box at `t`, tweened between the keys either side of it.
 *
 * Outside the keyed range it HOLDS rather than extrapolating: a box that
 * carried on moving past its last key would drift off the subject and off the
 * frame, and what it stops hiding is the thing it was drawn for.
 */
export function boxAt(keys: Key[], t: number): Rect {
  if (!keys.length) return { x: 0, y: 0, w: 0, h: 0 }
  const first = keys[0]
  if (t <= first.t) return { x: first.x, y: first.y, w: first.w, h: first.h }
  const last = keys[keys.length - 1]
  if (t >= last.t) return { x: last.x, y: last.y, w: last.w, h: last.h }
  let i = 0
  while (i < keys.length - 2 && keys[i + 1].t <= t) i += 1
  const a = keys[i], b = keys[i + 1]
  const span = b.t - a.t
  const f = span > 1e-6 ? (t - a.t) / span : 0
  return {
    x: a.x + (b.x - a.x) * f,
    y: a.y + (b.y - a.y) * f,
    w: a.w + (b.w - a.w) * f,
    h: a.h + (b.h - a.h) * f,
  }
}

export interface ClipInfo {
  name: string
  durationSec: number
  width: number
  height: number
}

/** The biggest rectangle of `aspect` that fits inside a `w`×`h` frame. */
export function fitRect(w: number, h: number, aspect: number): { w: number; h: number } {
  return w / h > aspect ? { w: h * aspect, h } : { w, h: w / aspect }
}

/**
 * The crop, in the pixels of one particular clip.
 *
 * The crop is stored as an ASPECT and a CENTRE rather than as a rectangle,
 * which is what makes joining clips of different shapes work: a rectangle in
 * fractions of the frame means a different aspect ratio on a portrait clip than
 * on a landscape one, so the two would have to be squeezed to a common size and
 * the join would visibly distort. An aspect plus a centre gives every clip the
 * same output shape and nothing is stretched.
 */
export function cropRect(clip: { width: number; height: number }, crop: Crop): Rect {
  const fit = fitRect(clip.width, clip.height, crop.aspect)
  const w = Math.min(clip.width, fit.w / Math.max(1, crop.zoom))
  const h = Math.min(clip.height, fit.h / Math.max(1, crop.zoom))
  // Clamped rather than allowed off the edge: dragging to the corner should
  // stop at the corner, not start filling the frame with nothing.
  const x = Math.min(Math.max(crop.cx * clip.width - w / 2, 0), clip.width - w)
  const y = Math.min(Math.max(crop.cy * clip.height - h / 2, 0), clip.height - h)
  return { x, y, w, h }
}

/**
 * The share of the picture a crop keeps.
 *
 * This is the number the tool exists to put in front of people. Going from a
 * 16:9 recording to a 9:16 post keeps 9/16 ÷ 16/9 of the width — **31.6% of the
 * frame, so more than two thirds of the picture is thrown away** — and the
 * subject is almost never in the middle of what remains. That is why every
 * automatic re-framer decapitates somebody, and why this one asks.
 */
export function keptShare(clip: { width: number; height: number }, crop: Crop): number {
  const r = cropRect(clip, crop)
  return (r.w * r.h) / (clip.width * clip.height)
}

/**
 * The output size: the crop, at the resolution of the SMALLEST clip that has to
 * fill it, capped by `maxHeight`.
 *
 * Never larger than the source. Upscaling adds pixels and no detail, and a
 * 1080-wide file made out of a 540-wide crop is a bigger upload that looks
 * exactly the same — the same honesty `print-size` applies to paper.
 */
export function outputSize(clips: ClipInfo[], crop: Crop, maxHeight: number): { width: number; height: number } {
  const heights = clips.map((c) => cropRect(c, crop).h)
  const h = Math.min(maxHeight, ...(heights.length ? heights : [maxHeight]))
  return { width: even(h * crop.aspect), height: even(h) }
}

/** Where each clip starts and ends on the joined timeline. */
export function timeline(clips: ClipInfo[]): { start: number; end: number }[] {
  let at = 0
  return clips.map((c) => {
    const start = at
    at += c.durationSec
    return { start, end: at }
  })
}

export function totalDuration(clips: ClipInfo[]): number {
  return clips.reduce((n, c) => n + c.durationSec, 0)
}

/**
 * The items showing at `t` seconds on the output timeline.
 *
 * Structural rather than typed to `Caption`, because the page holds captions
 * with text and colours and the worker holds captions that have already become
 * bitmaps. Both are "a thing with a start and an end", and one function that
 * takes that shape beats two that can disagree about what "showing" means.
 */
export function activeAt<T extends { from: number; to: number }>(items: T[], t: number): T[] {
  return items.filter((c) => t >= c.from - 1e-6 && t < c.to)
}

/**
 * Draw one source frame, cropped, filling the output canvas.
 *
 * `source` is a `<video>` in the preview and a decoded `VideoFrame` in the
 * export. Both satisfy `CanvasImageSource`, which is the whole reason there is
 * one function here rather than two that drift.
 */
export function drawFrame(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  source: CanvasImageSource,
  clip: { width: number; height: number },
  crop: Crop,
  out: { width: number; height: number },
): void {
  const r = cropRect(clip, crop)
  ctx.clearRect(0, 0, out.width, out.height)
  // Rounded, because a fractional source rectangle makes the browser resample
  // half a pixel and every frame shimmers against the next one.
  ctx.drawImage(
    source,
    Math.round(r.x), Math.round(r.y), Math.round(r.w), Math.round(r.h),
    0, 0, out.width, out.height,
  )
}

/**
 * A scratch canvas for the resolution-discarding modes.
 *
 * Module level, so it is allocated once rather than per frame — and this module
 * is imported separately by the page and by the worker, so each gets its own
 * and neither can be drawn on by the other mid-frame.
 */
let scratch: OffscreenCanvas | null = null

/**
 * Hide the regions showing at `t`, drawing over the frame already on `ctx`.
 *
 * The two resolution-discarding modes scale the region down and straight back
 * up rather than reaching for `ctx.filter`: that is not on every engine this
 * tool otherwise runs on, and a blur that silently does nothing is far worse
 * than a crude one, because what it silently fails to do is hide somebody's
 * face. This runs identically everywhere, which is also what keeps the preview
 * and the export the same pixels.
 */
export function applyCensors(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  censors: Censor[],
  t: number,
  out: { width: number; height: number },
): void {
  for (const c of activeAt(censors, t)) {
    // Interpolated HERE, so the preview and the export follow the same path by
    // construction — the whole reason this module is pure. A tween computed in
    // the page and a tween computed in the worker is two opinions about where
    // somebody's face was.
    const b = boxAt(c.keys, t)
    const x = Math.round(b.x * out.width)
    const y = Math.round(b.y * out.height)
    const w = Math.round(b.w * out.width)
    const h = Math.round(b.h * out.height)
    if (w < 2 || h < 2) continue

    if (c.mode === 'solid') {
      ctx.fillStyle = '#000'
      ctx.fillRect(x, y, w, h)
      continue
    }

    // A FRACTION of the frame, never a pixel count. The stage draws at preview
    // size and the exporter at output size, so a fixed block was a different
    // mosaic in each — the preview showing a coarseness the export would not
    // produce. Big, because a fine mosaic still reads as a face at a glance.
    const block = Math.max(4, Math.round(out.height / 16))
    const tw = Math.max(1, Math.round(w / block))
    const th = Math.max(1, Math.round(h / block))
    if (!scratch) scratch = new OffscreenCanvas(tw, th)
    scratch.width = tw
    scratch.height = th
    const sctx = scratch.getContext('2d')
    if (!sctx) continue
    // Hard squares both ways for a mosaic; smoothing both ways for a blur.
    // Softening only one end gives a mosaic with fuzzy edges, which reads as
    // "slightly out of focus" rather than as hidden.
    const smooth = c.mode === 'blur'
    sctx.imageSmoothingEnabled = smooth
    sctx.drawImage(ctx.canvas, x, y, w, h, 0, 0, tw, th)
    ctx.imageSmoothingEnabled = smooth
    ctx.drawImage(scratch, 0, 0, tw, th, x, y, w, h)
    ctx.imageSmoothingEnabled = true
  }
}

/**
 * The caption's box in output PIXELS.
 *
 * The bitmap is rendered at exactly this size, so it is drawn at the corner
 * rather than centred on a point — which is what makes the drawn rectangle and
 * the encoded result the same thing.
 */
export function captionRect(
  caption: { x: number; y: number; w: number; h: number },
  out: { width: number; height: number },
): { x: number; y: number; w: number; h: number } {
  return {
    x: Math.round(caption.x * out.width),
    y: Math.round(caption.y * out.height),
    w: Math.max(1, Math.round(caption.w * out.width)),
    h: Math.max(1, Math.round(caption.h * out.height)),
  }
}

/**
 * The aspect ratios worth offering.
 *
 * Named by the RATIO alone. They used to carry what each is for — "9:16 Reels ·
 * TikTok · Shorts" — which is the more helpful label in a list and the wrong
 * one in a row of chips over a video on a phone: five of them were wider than
 * the viewport, so the shapes at the end could not be reached at all. A ratio
 * is what people already say, and the ones that need explaining are exactly
 * the ones nobody picks.
 */
export const ASPECTS: { id: string; aspect: number; label: string; labelAr: string }[] = [
  { id: 'source', aspect: 0, label: 'Original', labelAr: 'كما هو' },
  { id: '9:16', aspect: 9 / 16, label: '9:16', labelAr: '٩:١٦' },
  { id: '1:1', aspect: 1, label: '1:1', labelAr: '١:١' },
  { id: '4:5', aspect: 4 / 5, label: '4:5', labelAr: '٤:٥' },
  { id: '16:9', aspect: 16 / 9, label: '16:9', labelAr: '١٦:٩' },
]

/**
 * How near a dragged proportion has to be to an offered format before it snaps
 * onto it, as a RATIO: 0.06 is ±6%.
 *
 * A ratio rather than a difference, because the formats are spread
 * multiplicatively — 9:16 is 0.5625 and 16:9 is 1.778 — so a fixed ±0.05 would
 * be a 9% band at the portrait end and a 3% one at the landscape end, and the
 * same gesture would feel like a different control depending on which way up
 * the clip is.
 *
 * 6% because the closest pair of OFFERED formats is 4:5 against 1:1, which are
 * 22% apart: no two bands can meet, so a snap is never a coin toss between two
 * chips. The source proportion is the exception — it is whatever was recorded
 * and can genuinely sit inside another format's band — and there the nearest
 * one wins outright rather than both claiming it.
 */
export const SNAP_TOL = 0.06

/**
 * Which offered format a freely dragged proportion means, or null for none.
 *
 * `candidates` carries the source proportion already RESOLVED, because
 * 'Original' is a format like any other to the person dragging and its number
 * is a property of the clip rather than of the list above.
 */
export function snapFormat(
  a: number,
  candidates: { id: string; aspect: number }[],
  tol: number = SNAP_TOL,
): { id: string; aspect: number } | null {
  let best: { id: string; aspect: number } | null = null
  let off = Infinity
  for (const c of candidates) {
    if (!(c.aspect > 0) || !(a > 0)) continue
    const d = Math.abs(Math.log(a / c.aspect))
    if (d < off) { off = d; best = c }
  }
  return best && off <= tol ? best : null
}

/**
 * Re-shape a dragged rectangle to an EXACT proportion, anchored on the part of
 * it the drag is not holding.
 *
 * This is what makes a snap a resize rather than a jump. The rectangle arrives
 * in fractions of the frame and `aspect` is in PIXELS, so the two disagree by
 * the frame's own proportion — `fa` is the same shape expressed in fraction
 * space, and forgetting that conversion is how a 1:1 crop of a 4:3 clip comes
 * out oblong.
 *
 * Which dimension survives is decided by which segment is under the finger,
 * and that is the whole of the "uniform" part:
 *
 * - an EDGE drag sets one dimension and the other follows from the proportion,
 *   so pulling the right edge out grows the box evenly rather than stretching
 *   it and then being corrected;
 * - a CORNER drag sets both, so neither can be taken as the intent — it keeps
 *   the AREA the drag asked for, which is continuous in both directions and
 *   means a diagonal drag scales the rectangle and holds its shape.
 *
 * `id` must never be `move`: moving a rectangle does not change its shape, and
 * `'move'.includes('e')` is true, so the anchoring below would read it as an
 * east drag.
 */
export function snapRect(
  rect: { x0: number; y0: number; x1: number; y1: number },
  id: string,
  aspect: number,
  frame: { width: number; height: number },
): { x0: number; y0: number; x1: number; y1: number } {
  const fa = (aspect * frame.height) / frame.width
  let w = rect.x1 - rect.x0
  let h = rect.y1 - rect.y0
  if (id === 'n' || id === 's') w = h * fa
  else if (id === 'e' || id === 'w') h = w / fa
  else {
    const s = Math.sqrt(Math.max(0, w * h))
    w = s * Math.sqrt(fa)
    h = s / Math.sqrt(fa)
  }
  // The edges the drag is holding move; the ones it is not stay put, and an
  // axis it never touched stays centred on where it already was.
  const cx = (rect.x0 + rect.x1) / 2
  const cy = (rect.y0 + rect.y1) / 2
  let x0 = cx - w / 2
  let y0 = cy - h / 2
  if (id.includes('w')) x0 = rect.x1 - w
  if (id.includes('e')) x0 = rect.x0
  if (id.includes('n')) y0 = rect.y1 - h
  if (id.includes('s')) y0 = rect.y0
  return { x0, y0, x1: x0 + w, y1: y0 + h }
}

/**
 * The crop rectangle as NINE SEGMENTS, in reading order.
 *
 * The whole rectangle is the control: the middle cell moves it, an edge cell
 * moves that edge, a corner cell moves both of its edges. There are no handle
 * squares to hit — on a phone a 14px square is smaller than a fingertip, and a
 * third of the rectangle is not.
 *
 * `id` names the edges each cell drags. PHYSICAL, not the logical start/end
 * this repo prefers elsewhere: these sit on a picture, and a picture does not
 * mirror under RTL — a cell that swapped sides in Arabic would drag the
 * opposite edge of the frame from the one under the finger.
 */
export const SEGMENTS = [
  { id: 'nw', cursor: 'cursor-nwse-resize' },
  { id: 'n', cursor: 'cursor-ns-resize' },
  { id: 'ne', cursor: 'cursor-nesw-resize' },
  { id: 'w', cursor: 'cursor-ew-resize' },
  { id: 'move', cursor: 'cursor-move' },
  { id: 'e', cursor: 'cursor-ew-resize' },
  { id: 'sw', cursor: 'cursor-nesw-resize' },
  { id: 's', cursor: 'cursor-ns-resize' },
  { id: 'se', cursor: 'cursor-nwse-resize' },
] as const

/** The smallest crop a drag may leave, in fractions of the frame. */
const MIN_SIDE = 0.04

export interface DragCrop {
  /** The format it settled on, or null for a proportion between them. */
  format: { id: string; aspect: number } | null
  aspect: number
  zoom: number
  cx: number
  cy: number
}

/**
 * A RESIZE drag becomes a crop — the whole of it, so a probe can ask what a
 * gesture produces without a browser, an encoder or a React tree.
 *
 * The rectangle handed in is the RAW one: where the segment started plus how
 * far the finger has gone, never the snapped rectangle currently on screen.
 * That is what lets a drag pass THROUGH a format rather than sticking to the
 * first one it touches — the decision is a pure function of where the pointer
 * is, so it needs no hysteresis and has no state to get wedged in. Inside a
 * band the shape is held exactly and the box merely resizes; carry on and the
 * raw proportion leaves the band and eventually enters the next one.
 *
 * MOVING is not a resize and does not come through here: it changes no
 * proportion, so it must not be able to change which format is selected.
 */
export function cropFromDrag(
  rect: { x0: number; y0: number; x1: number; y1: number },
  id: string,
  formats: { id: string; aspect: number }[],
  frame: { width: number; height: number },
  tol: number = SNAP_TOL,
): DragCrop {
  const x0 = Math.min(rect.x0, rect.x1)
  const y0 = Math.min(rect.y0, rect.y1)
  let box = {
    x0,
    y0,
    x1: Math.max(Math.max(rect.x0, rect.x1), x0 + MIN_SIDE),
    y1: Math.max(Math.max(rect.y0, rect.y1), y0 + MIN_SIDE),
  }
  let aspect = ((box.x1 - box.x0) * frame.width) / ((box.y1 - box.y0) * frame.height)
  const format = snapFormat(aspect, formats, tol)
  if (format) {
    box = snapRect(box, id, format.aspect, frame)
    aspect = format.aspect
  }
  // The zoom that reproduces this width, since a crop is stored as an aspect
  // and a centre rather than as a rectangle. Never below 1: `cropRect` treats
  // that as "as much as the aspect allows" and a drag past the edge should
  // stop at the biggest fit rather than invent picture that is not there.
  const fit = fitRect(frame.width, frame.height, aspect)
  const zoom = Math.max(1, fit.w / ((box.x1 - box.x0) * frame.width))
  return {
    format,
    aspect,
    zoom,
    cx: Math.min(1, Math.max(0, (box.x0 + box.x1) / 2)),
    cy: Math.min(1, Math.max(0, (box.y0 + box.y1) / 2)),
  }
}
