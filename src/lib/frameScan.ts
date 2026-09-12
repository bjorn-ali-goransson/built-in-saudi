// Decode every frame of a clip once, hand each one over as a grey pyramid, and
// forget it — plus the two measuring passes built on that loop.
//
// EXTRACTED AT THE SECOND CALLER, which is the only reason it exists. It was
// `scanFrames`/`analyse`/`track` inside `video-stabilize/stabilize.worker.ts`,
// and `video-edit` now needs exactly the same three things so a censor box can
// follow the face it was drawn over. Copying them would have given the two
// tools slightly different decode, backpressure, luma conversion and failure
// handling — which is the drift this repo has recorded six separate times
// (`relatedcheck`'s copy of the selection logic, `twinprobe`'s copy of the
// loader, `check-orphans`' first version, the two `looksScanned`s). The frames
// this produces decide where somebody's face is hidden; two opinions about
// that is not a thing to have.
//
// The pass is cheap because it does not need the PICTURE. Each frame is drawn
// once into a ~320px grey buffer and thrown away, and only what the callback
// keeps survives — three numbers a frame for the camera path, two for a tracked
// subject. That is what makes either pass safe on a phone, where retaining
// decoded frames is not.

import { displaySize, type DemuxTrack } from './mp4Demux'
import { uprightFrame } from './mp4Encode'
import {
  estimateMotion, pyramid, scaleMotion, startTrack, trackNext,
  type Box, type Estimate, type Gray, type TrackPoint, type Tracker,
} from './motion'

/**
 * How wide the frames are looked at.
 *
 * A pixel here is (source width / 320) source pixels, so the sub-pixel refit is
 * what keeps the estimate usable on 1080p — a whole analysis pixel there is six
 * real ones, and a path quantised that coarsely is a wobble of its own. Bigger
 * would be more accurate and the cost is quadratic; `evals/shakeprobe.mjs`
 * measures what this actually recovers rather than leaving it to taste.
 */
export const ANALYSIS_WIDTH = 320

export interface ScanOptions {
  /** How far the pass has got, for a progress readout. */
  onProgress?: (done: number, total: number) => void
  /** Polled between samples. Returning true aborts the pass with `cancelled`. */
  cancelled?: () => boolean
}

export interface ScanResult {
  /** The analysis plane's size, in its own pixels. */
  width: number
  height: number
  /** Multiply an analysis-pixel length by this to get SOURCE (display) pixels. */
  back: number
  /** How many frames were actually decoded. */
  count: number
  /**
   * When each frame is shown, in the clip's own seconds, measured from the
   * sample table rather than assumed from a frame rate.
   *
   * A clip recorded on a phone is routinely variable-rate, so `index / fps`
   * drifts — and what this is used for is mapping a tracked position onto the
   * timeline a censor's keys live on. An error there does not look like an
   * error; it looks like a box lagging behind a face.
   */
  times: number[]
}

/** The picture's size, which for a phone recording is NOT the stored size. */
function shownSize(v: DemuxTrack): { width: number; height: number } {
  return displaySize({ width: v.width ?? 0, height: v.height ?? 0 }, v.rotation)
}

/**
 * Decode `v` end to end, giving the callback each frame as a grey pyramid.
 *
 * The frames are NOT retained. `prev` is the previous pyramid, which is all a
 * frame-to-frame estimate needs and is what stops the loop growing with the
 * clip.
 */
export async function scanGrayFrames(
  v: DemuxTrack,
  opts: ScanOptions,
  /** `at` is when this frame is SHOWN, in the clip's own seconds — which a pass
   *  that starts somewhere other than the beginning needs, and which cannot be
   *  derived from `index` on a variable-rate recording. */
  onFrame: (pyr: Gray[], index: number, prev: Gray[] | null, at: number) => void,
): Promise<ScanResult> {
  // Display orientation throughout, so every measurement this pass produces is
  // in the space the viewer and the exporter both work in.
  const shown = shownSize(v)
  if (!shown.width || !shown.height) throw new Error('no-video')

  const aw = Math.max(64, Math.min(shown.width, ANALYSIS_WIDTH))
  const ah = Math.max(36, Math.round((aw * shown.height) / shown.width))
  const canvas = new OffscreenCanvas(aw, ah)
  const ctx = canvas.getContext('2d', { alpha: false, willReadFrequently: true })
  if (!ctx) throw new Error('no-canvas')

  // Everything is measured in analysis pixels and reported in SOURCE pixels, so
  // nothing downstream has to remember which space it is in.
  const back = shown.width / aw

  let prev: Gray[] | null = null
  let failure: Error | null = null
  let done = 0
  const times: number[] = []
  const stopped = () => !!opts.cancelled?.()
  const base = v.samples.reduce((m, s) => Math.min(m, s.cts), Infinity) / v.timescale

  const decoder = new VideoDecoder({
    output: (frame) => {
      try {
        if (stopped()) return
        uprightFrame(frame, v.rotation, canvas)
        const rgba = ctx.getImageData(0, 0, aw, ah).data
        const g = new Uint8Array(aw * ah)
        for (let i = 0, p = 0; i < g.length; i++, p += 4) {
          // Integer luma. Every pass compares a plane against another plane made
          // the same way, so the exact weights matter far less than being cheap.
          g[i] = (rgba[p] * 77 + rgba[p + 1] * 150 + rgba[p + 2] * 29) >> 8
        }
        const at = frame.timestamp / 1e6 - base
        times.push(at)
        const next = pyramid({ data: g, width: aw, height: ah }, 3)
        onFrame(next, done, prev, at)
        prev = next
        done++
      } catch (e) {
        // A throw here would otherwise be silent AND fatal: the decoder stops
        // draining, so the feed loop below waits for ever and the page sits on
        // "measuring" with nothing to report and nothing to retry.
        failure = e instanceof Error ? e : new Error(String(e))
      } finally { frame.close() }
    },
    error: (e) => { failure = e instanceof Error ? e : new Error(String(e)) },
  })

  decoder.configure({
    codec: v.codec,
    description: v.config.subarray(8),
    codedWidth: v.width,
    codedHeight: v.height,
  })

  const idle = () => new Promise((r) => setTimeout(r, 4))
  const total = v.samples.length
  for (const smp of v.samples) {
    if (stopped() || failure) break
    decoder.decode(new EncodedVideoChunk({
      type: smp.sync ? 'key' : 'delta',
      timestamp: Math.round((smp.cts / v.timescale) * 1e6),
      duration: Math.round((smp.duration / v.timescale) * 1e6),
      data: smp.data,
    }))
    while (!stopped() && !failure && decoder.decodeQueueSize > 8) await idle()
    if (done % 15 === 0) opts.onProgress?.(done, total)
  }
  await decoder.flush().catch(() => {})
  try { decoder.close() } catch { /* already closed by its own error */ }
  if (stopped()) throw new Error('cancelled')
  if (failure) throw failure
  return { width: aw, height: ah, back, count: done, times }
}

export interface Analysis {
  /** What moved between each pair of frames, in SOURCE pixels. One shorter than
   *  `times`, because a step needs two frames. */
  steps: Estimate[]
  /** When each frame is shown, in the clip's own seconds. */
  times: number[]
}

/** What moved between each pair of frames. */
export async function estimateSteps(v: DemuxTrack, opts: ScanOptions = {}): Promise<Analysis> {
  const raw: Estimate[] = []
  const info = await scanGrayFrames(v, opts, (next, _i, prev) => {
    if (prev) raw.push(estimateMotion(prev, next))
  })
  if (!raw.length) throw new Error('no-frames')
  // Scaled to source pixels ONCE, here, where the factor is known — but the
  // tile COUNT is not a length and must survive it, because it is what says a
  // frame was measured at all rather than assumed still.
  return {
    steps: raw.map((e) => ({ ...scaleMotion(e, info.back), tiles: e.tiles })),
    times: info.times,
  }
}

export interface Track {
  /** Where the subject was, relative to the frame CENTRE, in SOURCE pixels. */
  points: TrackPoint[]
  times: number[]
}

/**
 * Follow one subject from `startSec` to the end of the clip.
 *
 * A SECOND decode rather than a second thing retained from the first, and that
 * is deliberate: the box cannot be drawn until somebody has SEEN the clip, so
 * the alternative is holding every frame's pyramid through the whole analysis
 * on the chance that a box arrives — which on a phone recording is the memory
 * this pass is arranged to avoid.
 *
 * `box` is in FRACTIONS of the frame, because the stage it was drawn on is a
 * different size from the plane it is matched in.
 *
 * `startSec` IS THE WHOLE CORRECTNESS OF THIS FUNCTION, and it was missing.
 * The template is cut from the frame the box was aimed at, and this used to cut
 * it from frame 0 whatever moment the box was drawn at — so a box put over a
 * face five seconds in had its template taken from frame 0 AT THOSE
 * COORDINATES, which is background, and then followed the background. That
 * reads as "the blur did not follow", and it is the natural way to work: scrub
 * to the face, draw a box on it, ask it to follow.
 *
 * Frames before `startSec` are still DECODED — they have to be, since the ones
 * after them are differences from them — and reported at the drawn position, so
 * the box holds where it was put until the moment it was aimed.
 */
export async function followBox(
  v: DemuxTrack,
  box: Box,
  steps: Estimate[],
  opts: ScanOptions = {},
  startSec = 0,
): Promise<Track> {
  const points: TrackPoint[] = []
  let tracker: Tracker | null = null
  let refused = false
  let centre = { x: 0, y: 0 }
  /** The box as drawn, relative to the frame centre — what every frame before
   *  the start reports, and what the first tracked frame starts from. */
  const drawn = (w: number, h: number) => ({
    x: (box.x + box.w / 2 - 0.5) * w,
    y: (box.y + box.h / 2 - 0.5) * h,
    score: 1,
  })
  // The DISPLAY width, not the coded one. `steps` are in source pixels and the
  // tracker matches in the analysis plane, so the factor between them is
  // analysis ÷ picture — and for a phone recording held upright the stored
  // width is the picture's HEIGHT, which would scale every hint by the frame's
  // aspect ratio and walk the box off the subject.
  const shownWidth = shownSize(v).width

  const info = await scanGrayFrames(v, opts, (pyr, i, _prev, at) => {
    centre = { x: pyr[0].width / 2, y: pyr[0].height / 2 }
    // Not yet at the moment the box was aimed: hold the drawn position. One
    // point per frame either way, so the indices stay aligned with `times` and
    // the caller can map a position onto the clip's own clock.
    if (!tracker && at < startSec - 1e-6) { points.push(drawn(pyr[0].width, pyr[0].height)); return }
    if (!tracker) {
      if (refused) { points.push(drawn(pyr[0].width, pyr[0].height)); return }
      tracker = startTrack(pyr, {
        x: box.x * pyr[0].width,
        y: box.y * pyr[0].height,
        w: box.w * pyr[0].width,
        h: box.h * pyr[0].height,
      })
      if (!tracker) { refused = true; return }
      points.push(drawn(pyr[0].width, pyr[0].height))
      return
    }
    // The camera step for this pair, back in ANALYSIS pixels.
    const hint = steps[i - 1]
      ? scaleMotion(steps[i - 1], pyr[0].width / (shownWidth || pyr[0].width))
      : { rot: 0, dx: 0, dy: 0 }
    points.push(trackNext(tracker, pyr, hint, centre))
  })

  if (refused) throw new Error('no-subject')
  if (!points.length) throw new Error('no-frames')
  // Reported in source pixels, like everything else that leaves this file.
  return {
    points: points.map((p) => ({ x: p.x * info.back, y: p.y * info.back, score: p.score })),
    times: info.times,
  }
}
