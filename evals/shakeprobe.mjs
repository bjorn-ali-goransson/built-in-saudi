// Does the stabiliser actually MEASURE the shake, or does it just produce a
// number?
//
//   node evals/shakeprobe.mjs
//
// `video-stabilize` corrects a recording by an amount it estimated itself, so
// every claim the tool makes — how much shake there was, how much picture the
// correction costs — is downstream of one function being right. Nothing about a
// wobbly output says which way it was wrong, and a browser test cannot tell a
// good estimate from a plausible one.
//
// So the camera path is SYNTHESISED and therefore known. Frames are sampled out
// of a fixed scene at a known position and angle, `estimateMotion` is asked
// what moved, and the answer is compared with the arithmetic that produced it.
// No API key, no fixture file, deterministic.
//
// THE FIXTURE HAS TO CONTAIN THE HARD CASE, which this repo has now learned
// four separate times — the lam-alef sentence, the real HEIC, the grainy scan,
// the asymmetric caption. For motion estimation the hard cases are a FLAT
// region with nothing to match, and a SUBJECT moving independently of the
// camera. Both are in the scene, and both have a control of their own below: an
// estimator that scored well on smooth texture alone would be measuring the
// easy case and reporting the word "stabilised".

import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { compile } from './lib/tsc.mjs'

const ROOT = path.join(import.meta.dirname, '..')
const GEN = path.join(ROOT, 'evals/gen/stab')
mkdirSync(GEN, { recursive: true })
compile(ROOT, [path.join(ROOT, 'src/tools/video-stabilize/motion.ts')], GEN, [
  '--rootDir', path.join(ROOT, 'src/tools/video-stabilize'),
])
const M = await import(path.join(GEN, 'motion.js'))

let failed = 0
const check = (ok, what, detail = '') => {
  if (!ok) failed++
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${what}${detail ? ` — ${detail}` : ''}`)
}

/** A fixed generator, so a failure is reproducible and a pass is not luck. */
function rng(seed) {
  let s = seed >>> 0
  return () => {
    s ^= s << 13; s >>>= 0
    s ^= s >>> 17
    s ^= s << 5; s >>>= 0
    return s / 4294967296
  }
}

const SCENE = 1100

/**
 * The scene the camera looks at: a smooth gradient over the whole of it — the
 * part with nothing to match — with texture and hard edges over the middle.
 */
function scene() {
  const r = rng(20260905)
  const g = new Float32Array(SCENE * SCENE)
  for (let y = 0; y < SCENE; y++) {
    for (let x = 0; x < SCENE; x++) g[y * SCENE + x] = 40 + (x + y) * 0.05
  }
  // Blobs: something with structure at a scale a 4x downsample still sees.
  for (let i = 0; i < 260; i++) {
    const cx = r() * SCENE, cy = r() * SCENE, rad = 8 + r() * 46, v = r() * 200 - 100
    const x0 = Math.max(0, (cx - rad) | 0), x1 = Math.min(SCENE - 1, (cx + rad) | 0)
    const y0 = Math.max(0, (cy - rad) | 0), y1 = Math.min(SCENE - 1, (cy + rad) | 0)
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const d = Math.hypot(x - cx, y - cy)
        if (d < rad) g[y * SCENE + x] += v * (1 - d / rad)
      }
    }
  }
  // Fine grain, which is what sub-pixel refinement has to bite on.
  for (let i = 0; i < g.length; i++) g[i] += (r() - 0.5) * 18
  const out = new Uint8Array(g.length)
  for (let i = 0; i < g.length; i++) out[i] = Math.max(0, Math.min(255, g[i])) | 0
  return out
}

const WORLD = scene()
const W = 480
const H = 270

/** Sample a WxH frame out of the scene at a centre and an angle, bilinear. */
function frameAt(cx, cy, rot, paint) {
  const data = new Uint8Array(W * H)
  const c = Math.cos(rot), s = Math.sin(rot)
  for (let y = 0; y < H; y++) {
    const fy = y - H / 2
    for (let x = 0; x < W; x++) {
      const fx = x - W / 2
      const sx = cx + c * fx - s * fy
      const sy = cy + s * fx + c * fy
      const ix = Math.floor(sx), iy = Math.floor(sy)
      let v = 0
      if (ix >= 0 && iy >= 0 && ix < SCENE - 1 && iy < SCENE - 1) {
        const tx = sx - ix, ty = sy - iy
        const o = iy * SCENE + ix
        v = WORLD[o] * (1 - tx) * (1 - ty) + WORLD[o + 1] * tx * (1 - ty)
          + WORLD[o + SCENE] * (1 - tx) * ty + WORLD[o + SCENE + 1] * tx * ty
      }
      data[y * W + x] = v | 0
    }
  }
  if (paint) paint(data)
  return { data, width: W, height: H }
}

const pyr = (g) => M.pyramid(g, 3)

/** The motion the arithmetic says is there, from frame i-1 to frame i. */
function trueStep(a, b) {
  const c = Math.cos(-b.rot), s = Math.sin(-b.rot)
  const ddx = a.cx - b.cx, ddy = a.cy - b.cy
  return { rot: a.rot - b.rot, dx: c * ddx - s * ddy, dy: s * ddx + c * ddy }
}

function runPath(poses, paint) {
  const frames = poses.map((p, i) => pyr(frameAt(p.cx, p.cy, p.rot, paint ? (d) => paint(d, i) : null)))
  const est = []
  for (let i = 1; i < frames.length; i++) est.push(M.estimateMotion(frames[i - 1], frames[i]))
  const truth = []
  for (let i = 1; i < poses.length; i++) truth.push(trueStep(poses[i - 1], poses[i]))
  return { est, truth }
}

function rms(xs) { return Math.sqrt(xs.reduce((a, b) => a + b * b, 0) / Math.max(1, xs.length)) }

// ---------------------------------------------------------------- a real shake
const N = 48
const shakePoses = []
{
  const r = rng(7)
  for (let i = 0; i < N; i++) {
    // A slow deliberate pan with a fast wobble on top of it — which is the
    // whole point: the tool must take out the second and leave the first.
    shakePoses.push({
      cx: SCENE / 2 + i * 1.6 + Math.sin(i * 1.7) * 7 + (r() - 0.5) * 3,
      cy: SCENE / 2 + Math.cos(i * 2.1) * 6 + (r() - 0.5) * 3,
      rot: Math.sin(i * 1.3) * 0.012 + (r() - 0.5) * 0.004,
    })
  }
}
{
  const { est, truth } = runPath(shakePoses)
  const ex = est.map((e, i) => e.dx - truth[i].dx)
  const ey = est.map((e, i) => e.dy - truth[i].dy)
  const er = est.map((e, i) => ((e.rot - truth[i].rot) * 180) / Math.PI)
  const blind = est.filter((e) => e.tiles === 0).length
  console.log(`\nshake: per-step error  x ${rms(ex).toFixed(3)}px  y ${rms(ey).toFixed(3)}px  rot ${rms(er).toFixed(4)}deg  blind ${blind}/${est.length}`)
  check(rms(ex) < 0.5 && rms(ey) < 0.5, 'per-step translation is recovered to under half a pixel', `${rms(ex).toFixed(3)} / ${rms(ey).toFixed(3)}`)
  check(rms(er) < 0.06, 'per-step rotation is recovered to under 0.06 degrees', `${rms(er).toFixed(4)}`)
  check(blind === 0, 'every step of a textured clip is measurable', `${blind} blind`)

  // Drift is the number that decides the output, because the correction is
  // computed from the ACCUMULATED path and a per-step bias compounds.
  const gotPath = M.accumulate(est)
  const wantPath = M.accumulate(truth)
  const drift = gotPath.map((g, i) => Math.hypot(g.dx - wantPath[i].dx, g.dy - wantPath[i].dy))
  const worst = Math.max(...drift)
  console.log(`shake: accumulated drift over ${N} frames  worst ${worst.toFixed(2)}px`)
  check(worst < 4, 'the accumulated path does not drift more than 4px over 48 frames', `${worst.toFixed(2)}px`)
}

// --------------------------------------------------------- control: a still camera
{
  const still = Array.from({ length: 12 }, () => ({ cx: SCENE / 2, cy: SCENE / 2, rot: 0 }))
  const { est } = runPath(still)
  const worst = Math.max(...est.map((e) => Math.hypot(e.dx, e.dy)))
  console.log(`\nstill camera: worst reported motion ${worst.toFixed(4)}px`)
  check(worst < 0.05, 'a camera that did not move is reported as not having moved', `${worst.toFixed(4)}px`)
}

// ------------------------------------------- control: a subject moving on its own
// THE LOAD-BEARING ONE. A person walking across a locked-off shot fills its
// tiles with its own motion; an estimator that averages the field follows the
// subject and the output pans after them, which is worse than the shake. The
// median has to see that those tiles are the minority.
//
// The sweep is here rather than one size, because the interesting thing is
// WHERE IT BREAKS and that is a property of the median rather than a bug: past
// half the tiles the subject IS the majority and no amount of rejection can
// know which half is the room. Measured, so the limit is a number the tool can
// state instead of a hope.
{
  const still = Array.from({ length: 12 }, () => ({ cx: SCENE / 2, cy: SCENE / 2, rot: 0 }))
  const sizes = [[96, 100], [160, 140], [220, 180], [300, 220]]
  let held = 0
  console.log('')
  for (const [sw, sh] of sizes) {
    const paint = (d, i) => {
      const x0 = 20 + i * 14
      const y0 = (H - sh) >> 1
      for (let y = y0; y < y0 + sh; y++) {
        for (let x = x0; x < x0 + sw && x < W; x++) d[y * W + x] = ((x * 7 + y * 13) & 63) + 160
      }
    }
    const { est } = runPath(still, paint)
    const worst = Math.max(...est.map((e) => Math.hypot(e.dx, e.dy)))
    const share = ((sw * sh) / (W * H)) * 100
    if (worst < 1) held = share
    console.log(`subject ${sw}x${sh} = ${share.toFixed(0)}% of the frame -> camera reported as moving ${worst.toFixed(3)}px`)
  }
  check(held >= 17, 'a subject filling a sixth of the frame does not drag the camera estimate after it', `held to ${held.toFixed(0)}%`)
}

// -------------------------------------------- control: nothing to match at all
{
  const flat = { data: new Uint8Array(W * H).fill(128), width: W, height: H }
  const e = M.estimateMotion(pyr(flat), pyr(flat))
  console.log(`flat frame: tiles used ${e.tiles}`)
  check(e.tiles === 0, 'a frame with no detail reports that it measured nothing', `${e.tiles} tiles`)
}

// ------------------------------------------------- the price, in one number
{
  const { est } = runPath(shakePoses)
  const path = M.accumulate(est)
  for (const [label, radius] of [['gentle', 4], ['medium', 10], ['strong', 20]]) {
    const cs = M.corrections(path, M.smooth(path, radius))
    const z = M.requiredZoom(cs, W, H)
    const shake = M.shakeOf(cs, est)
    console.log(`\n${label} (radius ${radius}): zoom ${z.toFixed(3)}x  keeps ${(M.keptFraction(z) * 100).toFixed(1)}%  removed ${shake.pixels.toFixed(1)}px / ${shake.degrees.toFixed(2)}deg`)
  }
  const gentle = M.requiredZoom(M.corrections(path, M.smooth(path, 4)), W, H)
  const strong = M.requiredZoom(M.corrections(path, M.smooth(path, 20)), W, H)
  check(strong > gentle, 'smoothing harder costs more picture, which is the trade the tool shows', `${gentle.toFixed(3)}x -> ${strong.toFixed(3)}x`)
  check(M.requiredZoom([M.STILL], W, H) === 1, 'a clip with no shake in it costs nothing')
}

// ------------------------------------------------------ following a SUBJECT
//
// The same scene turned round: the tiles the estimator throws away as "not the
// camera" are exactly what this half has to lock onto. So the subject is
// painted at a known WORLD position on a moving path, the camera shakes
// underneath it, and where it lands on the sensor is arithmetic — which makes
// the tracked path checkable rather than merely plausible.

/** Where a world point falls on the sensor for a pose, relative to the centre. */
function worldToFrame(pose, wx, wy) {
  const c = Math.cos(pose.rot), s = Math.sin(pose.rot)
  const dx = wx - pose.cx, dy = wy - pose.cy
  return { x: c * dx + s * dy, y: -s * dx + c * dy }
}

/**
 * A textured block, in two flavours, and WHICH one is used is the finding.
 *
 * `noise` is what a real subject's fine detail looks like — a face, a shirt, a
 * number plate — and it is what the accuracy checks below use. `stripes` is a
 * REPEATING pattern, which is genuinely ambiguous to any template matcher:
 * every alias of the period matches about as well as the truth. It is kept as a
 * measured LIMIT rather than a gate, because "a striped shirt is hard" is a
 * property of template matching and not a defect this code can fix.
 */
const SUBJECT_TEX = (() => {
  const r = rng(4242)
  const t = new Uint8Array(256 * 256)
  for (let i = 0; i < t.length; i++) t[i] = 60 + (r() * 190) | 0
  return t
})()

function paintBlock(d, cxf, cyf, sw, sh, kind) {
  const x0 = Math.round(cxf + W / 2 - sw / 2)
  const y0 = Math.round(cyf + H / 2 - sh / 2)
  for (let y = Math.max(0, y0); y < Math.min(H, y0 + sh); y++) {
    for (let x = Math.max(0, x0); x < Math.min(W, x0 + sw); x++) {
      const u = x - x0, v = y - y0
      d[y * W + x] = kind === 'stripes'
        ? ((u * 11 + v * 29) & 127) + 100
        : SUBJECT_TEX[(v & 255) * 256 + (u & 255)]
    }
  }
}

const SUB = 44

/** Track one painted subject across the shaking path, and report the error. */
function followRun(kind) {
  const world = shakePoses.map((_, i) => ({
    x: SCENE / 2 - 90 + i * 3.4,
    y: SCENE / 2 + Math.sin(i * 0.4) * 26,
  }))
  const truth = shakePoses.map((p, i) => worldToFrame(p, world[i].x, world[i].y))
  const frames = shakePoses.map((p, i) => pyr(frameAt(p.cx, p.cy, p.rot,
    (d) => paintBlock(d, truth[i].x, truth[i].y, SUB, SUB, kind))))
  const est = []
  for (let i = 1; i < frames.length; i++) est.push(M.estimateMotion(frames[i - 1], frames[i]))
  const centre = { x: W / 2, y: H / 2 }
  // A LOOSE box, because that is what a person drags. Nobody gets a rectangle
  // tight around a moving subject on a phone, and `startTrack` trims to the
  // middle for exactly that reason — so a fixture with a perfectly tight box
  // measures a case the tool does not see and penalises the trim for doing its
  // job. Measured both ways: tight 1.10px rms, loose 0.36px.
  const margin = SUB * 0.35
  const box = {
    x: truth[0].x + W / 2 - SUB / 2 - margin,
    y: truth[0].y + H / 2 - SUB / 2 - margin,
    w: SUB + margin * 2,
    h: SUB + margin * 2,
  }
  const t = M.startTrack(frames[0], box)
  if (!t) return { t: null }
  const points = [{ x: truth[0].x, y: truth[0].y, score: 1 }]
  for (let i = 1; i < frames.length; i++) points.push(M.trackNext(t, frames[i], est[i - 1], centre))
  const err = points.map((p, i) => Math.hypot(p.x - truth[i].x, p.y - truth[i].y))
  // The BIAS is a constant offset between the box somebody drew and the patch
  // that was cut from it, and it does not matter: the follow centres whatever
  // it is tracking, so a fixed half-pixel puts the subject a fixed half-pixel
  // off centre and nothing else. What matters is the WOBBLE — how much the
  // reported position moves relative to the subject from frame to frame — so
  // that is what the gates below are on.
  const bx = points.reduce((a, p, i) => a + (p.x - truth[i].x), 0) / points.length
  const by = points.reduce((a, p, i) => a + (p.y - truth[i].y), 0) / points.length
  const wobble = points.map((p, i) => Math.hypot(p.x - truth[i].x - bx, p.y - truth[i].y - by))
  return { t, est, points, err, truth, wobble, bias: Math.hypot(bx, by) }
}

{
  // The subject walks across the world while the camera shakes and pans.
  const { t, est, points, err, wobble, bias } = followRun('noise')
  check(!!t, 'a textured subject can be followed at all')
  if (process.env.TRACKDBG) console.log('err/frame', err.map((e) => e.toFixed(1)).join(' '))
  const worst = Math.max(...err)
  const lowest = Math.min(...points.map((p) => p.score))
  console.log(`\nsubject: tracked over ${points.length} frames  rms ${rms(err).toFixed(2)}px  worst ${worst.toFixed(2)}px  wobble ${rms(wobble).toFixed(2)}px  bias ${bias.toFixed(2)}px  lowest score ${lowest.toFixed(2)}`)
  check(rms(wobble) < 0.6, 'the subject is followed to within 0.6px rms of wobble', `${rms(wobble).toFixed(2)}px`)
  check(Math.max(...wobble) < 1.5, 'and never wobbles more than 1.5px on any frame', `${Math.max(...wobble).toFixed(2)}px`)
  check(lowest > M.TRACK_LOST, 'a subject in plain view is never reported as lost', `lowest ${lowest.toFixed(2)}`)

  // THE PRODUCT CLAIM: the subject ends up near the middle, and that costs crop.
  const path = M.accumulate(est)
  const cam = M.corrections(path, M.smooth(path, 10))
  const before = M.subjectSpread(points, cam)
  console.log(`subject: strays ${before.toFixed(1)}px from the middle with the camera merely steadied`)
  for (const radius of [0, 6, 20]) {
    const cs = M.followCorrections(points, cam, radius)
    const after = M.subjectSpread(points, cs)
    const z = M.requiredZoom(cs, W, H)
    console.log(`  follow radius ${String(radius).padStart(2)}: strays ${after.toFixed(1)}px  zoom ${z.toFixed(2)}x  keeps ${(M.keptFraction(z) * 100).toFixed(0)}%`)
  }
  const locked = M.followCorrections(points, cam, 0)
  const loose = M.followCorrections(points, cam, 20)
  check(M.subjectSpread(points, locked) < 0.01,
    'at radius 0 the subject is nailed to the middle', `${M.subjectSpread(points, locked).toFixed(3)}px`)
  check(M.subjectSpread(points, loose) < before,
    'a loose follow still brings it closer to the middle than steadying alone',
    `${before.toFixed(1)} -> ${M.subjectSpread(points, loose).toFixed(1)}px`)
  // The trade, and the reason the tool prices it: holding a subject that moves
  // costs far more picture than holding a camera that wobbles.
  const camZoom = M.requiredZoom(cam, W, H)
  const followZoom = M.requiredZoom(locked, W, H)
  console.log(`subject: steadying costs ${camZoom.toFixed(2)}x, following costs ${followZoom.toFixed(2)}x`)
  check(followZoom > camZoom, 'following a moving subject costs more picture than steadying',
    `${camZoom.toFixed(2)}x -> ${followZoom.toFixed(2)}x`)
}

// ------------------------- the measured LIMIT: a subject with repeating texture
//
// Not a gate. A striped shirt, brickwork or a railing matches its own aliases
// about as well as the truth, and no template matcher settles that from
// appearance alone — so this reports the number rather than asserting one, and
// the UI's honest answer is the confidence it already carries.
{
  const { err } = followRun('stripes')
  console.log(`\nsubject with REPEATING texture: rms ${rms(err).toFixed(2)}px  worst ${Math.max(...err).toFixed(2)}px`)
  console.log('  (a limit of template matching, not of this code — the aliases of a period match equally well)')
}

// --------------------------------- control: a subject that leaves the picture
//
// Saying "it was lost at 1.4s" is the whole difference between a tool and a
// crop that quietly wanders. Without this the confidence could be decoration.
{
  const poses = Array.from({ length: 20 }, () => ({ cx: SCENE / 2, cy: SCENE / 2, rot: 0 }))
  // Walks steadily out of the right-hand edge and is gone by the end.
  const at = (i) => ({ x: -60 + i * 22, y: 0 })
  const frames = poses.map((p, i) => pyr(frameAt(p.cx, p.cy, p.rot,
    (d) => paintBlock(d, at(i).x, at(i).y, SUB, SUB, 'noise'))))
  const centre = { x: W / 2, y: H / 2 }
  const t = M.startTrack(frames[0], { x: at(0).x + W / 2 - SUB / 2, y: at(0).y + H / 2 - SUB / 2, w: SUB, h: SUB })
  const scores = []
  for (let i = 1; i < frames.length; i++) scores.push(M.trackNext(t, frames[i], M.STILL, centre).score)
  const lostAt = scores.findIndex((v) => v < M.TRACK_LOST)
  console.log(`\nsubject leaving frame: scores ${scores.map((v) => v.toFixed(2)).join(' ')}`)
  check(lostAt > 0, 'a subject that walks out of the picture is reported as lost, not followed', `first lost at frame ${lostAt + 1}`)
  check(scores[0] > M.TRACK_LOST, 'and is not called lost while it is still in view', `${scores[0].toFixed(2)}`)
}

// ------------------------------- control: a box with nothing in it to follow
//
// The load-bearing half again. A box on a wall, the sky or a blown-out window
// has no texture, and every position in the search window matches it equally
// well — so a tracker that accepted it would report a confident path that is
// really the window sliding about. Refusing is the only honest answer, and it
// is what lets the UI say WHY rather than producing a drifting crop.
{
  const flat = { data: new Uint8Array(W * H).fill(128), width: W, height: H }
  check(M.startTrack(pyr(flat), { x: 100, y: 60, w: SUB, h: SUB }) === null,
    'a box with no texture in it is refused rather than followed')
  // And a box too small to hold anything is refused for its own reason.
  check(M.startTrack(pyr(frameAt(SCENE / 2, SCENE / 2, 0)), { x: 10, y: 10, w: 4, h: 4 }) === null,
    'a box smaller than the matcher can use is refused')
}

console.log(failed ? `\n${failed} FAILED` : '\nall good')
process.exit(failed ? 1 : 0)
