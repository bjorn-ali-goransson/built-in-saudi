// What the output frame looks like — the crop geometry and the caption
// placement, with no canvas, no codec and no React in sight.
//
// IT IS PURE BECAUSE IT IS USED TWICE. The preview on the page draws from a
// `<video>` element and the exporter draws from a decoded `VideoFrame`, and
// both are a `CanvasImageSource`, so `drawFrame` below is called by both with
// the same numbers. A preview computed by one set of rules and an export
// computed by another is a preview that lies, which is the single worst thing
// an editor can do — you would only find out after the encode.

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
 * How a region is hidden.
 *
 * `block` is the default and the only one that actually removes the
 * information. The other two discard RESOLUTION — which is the same operation
 * with the smoothing turned on or off — and resolution is recoverable from a
 * video in a way it is not from a still.
 *
 * Measured, `node evals/pixelleak.mjs`: the mosaic grid is fixed to the FRAME
 * while the subject moves through it, so every frame samples the same picture
 * on a differently-aligned grid and each one is a fresh set of constraints on
 * the same pixels. Textbook back-projection, no libraries, recovers **98.6% of
 * a pixelated number plate from 64 frames — 2.1 seconds at 30fps** — against
 * 68.3% from one frame, which is the score a blank guess gets. The control is
 * the load-bearing half: a STATIC subject stays at 68.3% however many frames
 * you have, so the leak comes from motion and not from the reconstruction being
 * clever. The subject worth hiding is the one that moves.
 */
export type CensorMode = 'block' | 'pixelate' | 'blur'

export interface Censor {
  id: string
  /** The box, in fractions of the OUTPUT frame. */
  x: number
  y: number
  w: number
  h: number
  mode: CensorMode
  /** Seconds on the OUTPUT timeline. */
  from: number
  to: number
}

export interface ClipInfo {
  name: string
  durationSec: number
  width: number
  height: number
}

/**
 * H.264 stores colour at half resolution in each direction, so a frame with an
 * odd width or height has no whole chroma sample to put in the last row or
 * column. Encoders answer that by refusing the configuration outright — which
 * surfaces as "export failed" for the entirely fixable reason that a crop came
 * out 607 pixels wide.
 */
export function even(n: number): number {
  // Rounded BEFORE snapping. An aspect derived by division lands on 319.9999
  // for a frame that is plainly 320 wide, and flooring that gives 318 — a
  // two-pixel squeeze applied to a crop the reader asked not to be cropped.
  const r = Math.round(n)
  return Math.max(2, r - (r % 2))
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
 * PIXELATE AND BLUR ARE THE SAME OPERATION — scale the region down and back up,
 * with the smoothing off for hard blocks and on for a soft one. Doing it this
 * way rather than through `ctx.filter` is deliberate: `filter` is not on every
 * engine this tool otherwise runs on, and a blur that silently does nothing is
 * far worse than a blur that looks slightly cruder, because what it silently
 * fails to do is hide somebody's face. This runs identically everywhere, which
 * is also what keeps the preview and the export the same pixels.
 */
export function applyCensors(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  censors: Censor[],
  t: number,
  out: { width: number; height: number },
): void {
  for (const c of activeAt(censors, t)) {
    const x = Math.round(c.x * out.width)
    const y = Math.round(c.y * out.height)
    const w = Math.round(c.w * out.width)
    const h = Math.round(c.h * out.height)
    if (w < 2 || h < 2) continue

    if (c.mode === 'block') {
      ctx.fillStyle = '#000'
      ctx.fillRect(x, y, w, h)
      continue
    }

    // How much resolution to throw away. Blur goes coarser because the
    // smoothing hides the blockiness, and a soft patch that still reads as a
    // face is the failure people do not notice.
    // Coarse on purpose. A fine mosaic still reads as a face at a glance — and
    // at preview size it barely reads as censored at all, which is the state a
    // reader is deciding from. Bigger blocks also throw more away, though the
    // measurement above is why that is not a substitute for a solid box.
    const block = c.mode === 'pixelate' ? 22 : 30
    const tw = Math.max(1, Math.round(w / block))
    const th = Math.max(1, Math.round(h / block))
    if (!scratch) scratch = new OffscreenCanvas(tw, th)
    scratch.width = tw
    scratch.height = th
    const sctx = scratch.getContext('2d')
    if (!sctx) continue
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
