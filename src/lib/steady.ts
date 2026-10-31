// Steadying a clip inside the video editor.
//
// The editor already measures the camera's frame-to-frame motion when a clip is
// opened (`estimateSteps`, for censor boxes that follow a face). Steadying is
// that same measurement, smoothed: the difference between where the camera went
// and where it was heading is the shake, and moving each frame back by it takes
// the shake out. This was the separate Video Stabilizer app until November 2026;
// it lives here now so that cutting, cropping, captioning, muting and steadying
// are one session on one stage.
//
// THE STEADIED FRAME IS THE SOURCE. It is computed before the crop, the boxes and
// the captions, in the page's preview and in the export worker alike, so every
// coordinate downstream is unchanged and the two cannot disagree — the same
// arrangement the image editor uses for its tilt.
//
// Pure, with no runtime imports beyond `motion.ts` (itself pure), so it runs in
// the worker and on the page.

import { accumulate, corrections, requiredZoom, smooth, STILL, type Motion } from './motion'

export interface Steady {
  /** When each frame is shown, in the clip's own seconds (as measured). */
  times: number[]
  /** The correction for each of those frames, in source pixels and radians. */
  cs: Motion[]
  /** How far the picture is enlarged so no corrected frame shows its edge. */
  zoom: number
}

/**
 * The plan for one clip, or null when there is nothing to do.
 *
 * `smoothSec` is how much of the camera's movement counts as intent: the path is
 * averaged over that many seconds either side, so a slow pan survives and the
 * wobble on top of it does not. 0 means off.
 */
export function steadyPlan(
  steps: Motion[],
  times: number[],
  fps: number,
  smoothSec: number,
  size: { width: number; height: number },
): Steady | null {
  if (!(smoothSec > 0) || !steps.length || times.length < 2) return null
  const path = accumulate(steps)
  const radius = Math.max(1, Math.round(smoothSec * Math.max(1, fps)))
  const cs = corrections(path, smooth(path, radius))
  return { times: times.slice(0, cs.length), cs, zoom: requiredZoom(cs, size.width, size.height) }
}

/** The correction for the frame shown at `t` (the nearest measured frame). */
export function correctionAt(s: Steady, t: number): Motion {
  const ts = s.times
  if (!ts.length) return STILL
  let lo = 0
  let hi = ts.length - 1
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (ts[mid] < t) lo = mid + 1
    else hi = mid
  }
  const i = lo > 0 && Math.abs(ts[lo - 1] - t) < Math.abs(ts[lo] - t) ? lo - 1 : lo
  return s.cs[Math.min(i, s.cs.length - 1)] ?? STILL
}

/**
 * Where a point of the recorded frame lands in the steadied one, at time `t`.
 *
 * The inverse of nothing: it is exactly the transform `drawStabilised` applies
 * (about the centre: rotate, shift, then enlarge), so a box that follows a face
 * in the RECORDED picture can be drawn where that face is in the STEADIED one.
 */
export function steadyPoint(
  s: Steady,
  t: number,
  x: number,
  y: number,
  size: { width: number; height: number },
): { x: number; y: number } {
  const c = correctionAt(s, t)
  const cx = size.width / 2
  const cy = size.height / 2
  const co = Math.cos(c.rot)
  const si = Math.sin(c.rot)
  const px = x - cx
  const py = y - cy
  return {
    x: cx + s.zoom * (co * px - si * py + c.dx),
    y: cy + s.zoom * (si * px + co * py + c.dy),
  }
}

/** The share of the recorded picture that survives the enlargement. */
export const steadyKept = (zoom: number) => 1 / (zoom * zoom)
