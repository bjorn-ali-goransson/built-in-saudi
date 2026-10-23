// Does the mesh's quality controller give up the right things, in the right
// order, and come back?
//
//   node evals/videoquality.mjs
//
// A browser test can watch a bitrate fall. It cannot sweep a link — it cannot
// hold one peer of four on a lossy path for thirty seconds, throttle a tab, or
// put the same trace through twice to see whether the controller oscillates.
// So the traces are SYNTHETIC and therefore known, and `src/lib/videoQuality.ts`
// is pure with no imports, so this compiles it with tsc and drives the REAL
// controller rather than a copy of it — the `relatedPick.ts` / `motion.ts`
// arrangement, and the fix for the drift `relatedcheck` once spent weeks
// inside. No API key, no fixture, no browser.
//
// THE CONTROLS ARE THE LOAD-BEARING HALF, and there are two of them. A sweep
// that only ever fed bad links would measure "degradation happens" and would
// pass just as well against a controller that degrades unconditionally — which
// is a controller with no adaptation at all. And a sweep that only fed GLOBAL
// trouble would pass against one that drags every peer down because a single
// person is on hotel wifi, which is the mistake the two-level design exists to
// avoid.

import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { compile } from './lib/tsc.mjs'

const ROOT = path.join(import.meta.dirname, '..')
const GEN = path.join(ROOT, 'evals/gen/vq')
mkdirSync(GEN, { recursive: true })
compile(ROOT, [path.join(ROOT, 'src/lib/videoQuality.ts')], GEN, ['--rootDir', path.join(ROOT, 'src')])
const Q = await import(path.join(GEN, 'lib/videoQuality.js'))

let failed = 0
const check = (ok, what, detail = '') => {
  if (!ok) failed++
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${what}${detail ? ` — ${detail}` : ''}`)
}

const POLL = 2000 // ms between polls, as rtc.ts drives it

/** Link shapes, as a peer's stats would read them. `fps` is what the encoder
 *  ACHIEVED; the harness turns it into the cumulative counter the controller
 *  actually consumes, because reading that counter as a rate is the trap the
 *  module is written to survive. */
const CLEAN = { limit: 'none', loss: 0.001, rtt: 0.05, fps: 24 }
const CONGESTED = { limit: 'bandwidth', loss: 0.08, rtt: 0.45, fps: 12 }
const SEVERE = { limit: 'bandwidth', loss: 0.3, rtt: 0.8, fps: 3 }
const CPUBOUND = { limit: 'cpu', loss: 0.001, rtt: 0.05, fps: 9 }
const MIDDLING = { limit: 'other', loss: 0.03, rtt: 0.25, fps: 18 }

/** Drive `polls` cycles. `shape(i, id)` returns a link shape per peer per poll;
 *  `gap` lets a trace simulate a throttled tab. Returns the level history. */
function run(ids, shape, polls, { gap = POLL, wantFps = 24, ctl = new Q.QualityController() } = {}) {
  const frames = new Map(ids.map((id) => [id, 0]))
  let at = 1_000_000
  const history = []
  for (let i = 0; i < polls; i++) {
    at += gap
    const stats = new Map()
    for (const id of ids) {
      const s = shape(i, id)
      // The controller is asked for a frame rate per rung, so what we feed the
      // encoder follows the level it last chose — the same composition rtc.ts
      // does. The achieved rate is capped by it.
      const asked = Math.min(wantFps, Q.LADDER[Math.min(ctl.levelFor(id), Q.LADDER.length - 1)].fps)
      const achieved = ctl.levelFor(id) >= Q.OFF ? 0 : Math.min(s.fps, asked)
      frames.set(id, frames.get(id) + achieved * (gap / 1000))
      stats.set(id, {
        at, framesEncoded: frames.get(id), limit: s.limit, loss: s.loss, rtt: s.rtt,
        // Video off → nothing to judge a frame rate against, and loss/rtt come
        // from the audio stream instead. rtc.ts passes 0 for exactly this.
        wantFps: ctl.levelFor(id) >= Q.OFF ? 0 : asked,
      })
    }
    ctl.step(stats)
    history.push(ctl.summary().level)
  }
  return { ctl, history }
}

const always = (shape) => () => shape

// ── The control: a good link is left alone ───────────────────────────────────
//
// Without this the whole sweep would pass against a controller that degrades
// unconditionally.
console.log('a clean link is never touched')
{
  const { ctl, history } = run(['a'], always(CLEAN), 40)
  check(Math.max(...history) === 0, 'it stays on rung 0 for 40 polls', `max rung ${Math.max(...history)}`)
  check(!ctl.videoOff, 'and video is never turned off')
  const e = Q.encodeFor(ctl.levelFor('a'), 960, 960, false)
  check(e.fps === 24 && e.scale === 1, 'full frame rate, no downscale', `${e.fps}fps, ${e.kbps}kbps`)
}

// ── A congested uplink descends, and reaches off ─────────────────────────────
console.log('\na congested link gives up rungs and finally the camera')
{
  const { ctl, history } = run(['a'], always(CONGESTED), 30)
  const toOff = history.findIndex((l) => l >= Q.OFF)
  check(history[0] === 0, 'one bad poll costs nothing — a hiccup is not a verdict', `rung ${history[0]} after 1 poll`)
  check(history[1] > 0, 'two consecutive bad polls give up a rung', `rung ${history[1]}`)
  check(toOff > 0, 'and it eventually turns video off', `after ${toOff + 1} polls (${((toOff + 1) * POLL) / 1000}s)`)
  check(ctl.videoOff, 'the controller reports video off')
  check(Q.encodeFor(ctl.levelFor('a'), 960, 960, false) === null, 'and asks for nothing to be sent')
}

// ── Severity decides how fast ────────────────────────────────────────────────
//
// "Disable it if performance is very bad" is a claim about SPEED, so the two
// have to be measurably different. A single ladder with no severity would read
// the same number twice here.
console.log('\nvery bad is faster than merely bad')
{
  const bad = run(['a'], always(CONGESTED), 40).history.findIndex((l) => l >= Q.OFF) + 1
  const sev = run(['a'], always(SEVERE), 40).history.findIndex((l) => l >= Q.OFF) + 1
  check(sev > 0 && sev < bad, 'severe trouble reaches off sooner', `${(sev * POLL) / 1000}s vs ${(bad * POLL) / 1000}s`)
  check(sev * POLL <= 16000, 'and gets there inside ~15s', `${(sev * POLL) / 1000}s`)
}

// ── CPU is global, on any number of peers ────────────────────────────────────
console.log('\na CPU-bound encoder degrades however few peers complain')
{
  // Three peers, only ONE reporting cpu — there is one encoder budget however
  // many connections spend it, so this must still be read as shared.
  const { history } = run(['a', 'b', 'c'], (_i, id) => (id === 'a' ? CPUBOUND : CLEAN), 10)
  check(history[2] > 0, 'one cpu report moves the shared level', `rung ${history[2]}`)
  const sum = run(['a', 'b', 'c'], (_i, id) => (id === 'a' ? CPUBOUND : CLEAN), 10).ctl.summary()
  check(sum.reason === 'cpu', 'and names cpu as the reason', sum.reason)
}

// ── THE OTHER CONTROL: one bad path is not everybody's problem ───────────────
//
// Three peers, one of them on a lossy path. Degrading the shared level here
// would punish two people for the third's connection — and a sweep that only
// ever fed global trouble would never notice.
console.log('\none peer on a bad path does not drag the others down')
{
  const { ctl } = run(['a', 'b', 'c'], (_i, id) => (id === 'a' ? CONGESTED : CLEAN), 30)
  const sum = ctl.summary()
  check(sum.level === 0, 'the shared level is untouched', `rung ${sum.level}`)
  check(ctl.levelFor('a') > 0, 'the bad peer alone is degraded', `a is on rung ${ctl.levelFor('a')}`)
  check(ctl.levelFor('b') === 0 && ctl.levelFor('c') === 0, 'the good peers stay on rung 0',
    `b ${ctl.levelFor('b')}, c ${ctl.levelFor('c')}`)
  check(!ctl.videoOff && ctl.levelFor('a') < Q.OFF,
    'and a per-peer penalty never reaches off', `a is on rung ${ctl.levelFor('a')} of ${Q.OFF}`)
}

// ── A majority IS our uplink ─────────────────────────────────────────────────
console.log('\nmost peers in trouble is read as our own uplink')
{
  const { ctl } = run(['a', 'b', 'c'], (_i, id) => (id === 'c' ? CLEAN : CONGESTED), 10)
  check(ctl.summary().level > 0, 'the shared level moves', `rung ${ctl.summary().level}`)
  check(ctl.summary().reason === 'uplink', 'and names the uplink', ctl.summary().reason)
}

// ── Recovery, and that it is slower than the fall ────────────────────────────
console.log('\na link that frees up is taken back slowly')
{
  const ctl = new Q.QualityController()
  run(['a'], always(CONGESTED), 6, { ctl })
  const fell = ctl.summary().level
  check(fell > 0, 'it degraded first', `rung ${fell}`)
  const { history } = run(['a'], always(CLEAN), 40, { ctl })
  const firstUp = history.findIndex((l) => l < fell)
  check(firstUp >= Q.UP_SAMPLES - 1, 'the first rung back needs sustained clean polls', `after ${firstUp + 1} polls`)
  check(history[history.length - 1] === 0, 'and it climbs all the way back', `rung ${history[history.length - 1]}`)
  // Falling 1 rung costs DOWN_SAMPLES polls, rising 1 costs UP_SAMPLES.
  check(Q.UP_SAMPLES > Q.DOWN_SAMPLES * 2, 'recovery is more than twice as slow as descent',
    `${Q.UP_SAMPLES} up vs ${Q.DOWN_SAMPLES} down`)
}

console.log('\nvideo comes back on its own once the link does')
{
  const ctl = new Q.QualityController()
  run(['a'], always(SEVERE), 20, { ctl })
  check(ctl.videoOff, 'it turned video off')
  // The trap this is really testing: with video off there are no video frames
  // to count, so a controller that kept judging frame rate would read 0fps as a
  // catastrophic link and stay off for ever.
  const { history } = run(['a'], always(CLEAN), 60, { ctl })
  check(!ctl.videoOff, 'and comes back when the link does', `rung ${history[history.length - 1]}`)
}

// ── A throttled tab is not a bad link ────────────────────────────────────────
//
// A backgrounded tab's encoder all but stops, so the frame count becomes
// evidence about the TAB. Without the gap guard, minimising a window would turn
// your camera off.
console.log('\na throttled tab does not cost the camera')
{
  // Clean loss and round trip, but the frame counter has barely moved and the
  // poll gap is far longer than it should be.
  const stalled = { limit: 'none', loss: 0.001, rtt: 0.05, fps: 0.2 }
  const { ctl, history } = run(['a'], always(stalled), 30, { gap: 30_000 })
  check(!ctl.videoOff, 'video stays on', `rung ${history[history.length - 1]}`)
  check(Math.max(...history) === 0, 'and nothing is given up at all', `max rung ${Math.max(...history)}`)
}

console.log('\nbut a stalled encoder on a NORMAL poll gap is real trouble')
{
  // The same shape at the proper cadence must still be caught — otherwise the
  // guard above would have been "never judge frame rate", which is no test.
  const stalled = { limit: 'none', loss: 0.001, rtt: 0.05, fps: 0.2 }
  const { ctl } = run(['a'], always(stalled), 30)
  check(ctl.summary().level > 0, 'it degrades', `rung ${ctl.summary().level}`)
}

// ── A slow camera is not a slow link ─────────────────────────────────────────
console.log('\na camera that only delivers 15fps is not read as congestion')
{
  // rtc.ts judges the encoder against what it was FED, so a 15fps webcam in
  // poor light reports wantFps 15 and achieves 15. Judging against the rung's
  // 24 instead would read 0.63 and descend for ever.
  const slowCam = { limit: 'none', loss: 0.001, rtt: 0.05, fps: 15 }
  const { ctl, history } = run(['a'], always(slowCam), 30, { wantFps: 15 })
  check(Math.max(...history) === 0, 'it stays on rung 0', `max rung ${Math.max(...history)}`)
  check(!ctl.videoOff, 'and video stays on')
}

// ── A middling link holds rather than flapping ───────────────────────────────
console.log('\na link that is neither good nor bad holds its level')
{
  const { ctl, history } = run(['a'], always(MIDDLING), 30)
  check(Math.max(...history) === 0, 'no descent on ambiguous evidence', `max rung ${Math.max(...history)}`)
  check(!ctl.videoOff, 'and video stays on')
}

console.log('\na link alternating bad and ambiguous still descends')
{
  // 'ok' deliberately does NOT clear the bad run, or a persistently troubled
  // link could hold full quality for ever by being ambiguous every other poll.
  const { ctl } = run(['a'], (i) => (i % 2 ? CONGESTED : MIDDLING), 30)
  check(ctl.summary().level > 0, 'it gives up rungs', `rung ${ctl.summary().level}`)
}

// ── The person overrules us ──────────────────────────────────────────────────
console.log('\nasking for the camera back pins it on')
{
  const ctl = new Q.QualityController()
  run(['a'], always(SEVERE), 20, { ctl })
  check(ctl.videoOff, 'it was off')
  ctl.pin()
  check(!ctl.videoOff, 'pinning brings it back')
  check(ctl.levelFor('a') === Q.LADDER.length - 1, 'at the bottom rung, not full quality',
    `rung ${ctl.levelFor('a')}`)
  run(['a'], always(SEVERE), 40, { ctl })
  check(!ctl.videoOff, 'and it is never taken away again, however bad the link stays')
  check(ctl.levelFor('a') === Q.LADDER.length - 1, 'quality still sits at the floor', `rung ${ctl.levelFor('a')}`)
}

// ── A departed peer takes its penalty with it ────────────────────────────────
console.log('\na peer that leaves does not leave its penalty behind')
{
  const ctl = new Q.QualityController()
  run(['a', 'b', 'c'], (_i, id) => (id === 'a' ? CONGESTED : CLEAN), 20, { ctl })
  check(ctl.levelFor('a') > 0, 'a was penalised', `rung ${ctl.levelFor('a')}`)
  run(['b', 'c'], always(CLEAN), 2, { ctl })
  check(ctl.levelFor('a') === 0, 'and the penalty is gone once a is absent', `rung ${ctl.levelFor('a')}`)
}

// ── The ladder itself ────────────────────────────────────────────────────────
console.log('\nthe ladder gives up frame rate before picture')
{
  const r0 = Q.LADDER[0], r1 = Q.LADDER[1]
  check(r1.fps < r0.fps, 'rung 1 costs frame rate', `${r0.fps} → ${r1.fps}fps`)
  check(r1.width === r0.width, 'and leaves the picture alone', `${r1.width}px`)
  const fps = Q.LADDER.map((r) => r.fps)
  const width = Q.LADDER.map((r) => r.width)
  check(fps.every((f, i) => i === 0 || f < fps[i - 1]), 'frame rate falls on every rung', fps.join(' → '))
  check(width.every((w, i) => i === 0 || w <= width[i - 1]), 'and the picture never grows', width.join(' → '))
}

console.log('\nthe receiver\'s ask and the rung compose, lowest wins')
{
  // A dock thumbnail on a perfect link must not be sent a full frame, and a
  // full-screen tile on a bad one must not be sent one either.
  const thumb = Q.encodeFor(0, 960, 160, false)
  check(thumb.scale > 1 && thumb.kbps <= 100, 'a thumbnail on rung 0 is still a thumbnail',
    `${thumb.kbps}kbps, scale ${thumb.scale.toFixed(1)}`)
  const big = Q.encodeFor(4, 960, 960, false)
  check(big.scale > 1, 'a big tile on rung 4 is scaled down anyway', `scale ${big.scale.toFixed(1)}`)
  check(Q.encodeFor(0, 960, 960, false).kbps > Q.encodeFor(3, 960, 960, false).kbps,
    'and the same tile costs less on a worse rung',
    `${Q.encodeFor(0, 960, 960, false).kbps} → ${Q.encodeFor(3, 960, 960, false).kbps}kbps`)
}

console.log('\nno rung asks for a bitrate too low to carry a picture')
{
  const low = []
  for (let l = 0; l < Q.OFF; l++) for (const w of Q.SIZE_BUCKETS) {
    const e = Q.encodeFor(l, 960, w, false)
    if (e.kbps < Q.MIN_KBPS) low.push(`${l}@${w}=${e.kbps}`)
  }
  check(low.length === 0, `every rung x bucket stays at or above the ${Q.MIN_KBPS}kbps floor`, low.join(' '))
}

console.log('\nevery width a receiver can ask for is a width the bitrate table knows')
{
  // The two ladders are written out separately — a bucket with no step of its
  // own would silently round into a neighbour's bitrate.
  const steps = new Set(Q.SIZE_BUCKETS.map((w) => Q.bitrateFor(w)))
  check(steps.size === Q.SIZE_BUCKETS.length, 'each bucket has its own bitrate',
    `${steps.size} of ${Q.SIZE_BUCKETS.length}`)
  check(Q.bucketFor(0) === 0, 'and 0 stays 0 — "not on my screen" is not a size')
  check(Q.bucketFor(1) === 160 && Q.bucketFor(5000) === 960, 'anything else snaps onto the ladder',
    `${Q.bucketFor(1)} … ${Q.bucketFor(5000)}`)
}

// ── Screen share is not a face ───────────────────────────────────────────────
console.log('\na screen share keeps its resolution and is never switched off')
{
  for (let l = 0; l <= Q.OFF; l++) {
    const e = Q.encodeFor(l, 1920, 160, true)
    if (!e) { check(false, `rung ${l} would stop a screen share`); break }
    if (e.scale !== 1) { check(false, `rung ${l} downscales a screen share`, `scale ${e.scale}`); break }
    if (l === Q.OFF) check(true, 'every rung keeps it full size and still sending')
  }
  const worst = Q.encodeFor(Q.OFF, 1920, 160, true)
  const best = Q.encodeFor(0, 1920, 160, true)
  check(worst.kbps < best.kbps && worst.fps <= best.fps,
    'it pays in frame rate and bitrate instead', `${best.kbps}→${worst.kbps}kbps, ${best.fps}→${worst.fps}fps`)
}

console.log(`\n${failed ? `${failed} FAILED` : 'all checks passed'}`)
process.exit(failed ? 1 : 0)
