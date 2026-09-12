// Does the crop rectangle SNAP to the formats — and let go again?
//
//   node evals/cropsnap.mjs
//
// `video-edit` stores a crop as an aspect, a centre and a zoom, and a drag has
// to arrive at all three from a rectangle somebody pulled about with a finger.
// Every claim on that bar is downstream of one function: whether the shape is
// one of the offered formats, what the rectangle becomes once it is, and
// whether carrying on lets go of it again. A browser test can watch a chip
// light up; it cannot say the shape it lit up for was the shape on screen, and
// it cannot sweep the gesture.
//
// So the drag is SYNTHESISED and therefore known. `cropFromDrag` is the real
// production function — `compose.ts` has no runtime imports beyond a type, so
// it compiles standalone with tsc and this calls it rather than a copy, the
// `relatedPick.ts` / `motion.ts` arrangement and the fix for the drift
// `relatedcheck` once spent weeks inside. No API key, no fixture, no browser.
//
// The load-bearing half is the CONTROL: a sweep that only ever checked shapes
// near a format would be measuring "snapping happens" and would pass just as
// well against a tool that snapped everything to the nearest chip, which is a
// tool with no free crop at all.

import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { compile } from './lib/tsc.mjs'

const ROOT = path.join(import.meta.dirname, '..')
const GEN = path.join(ROOT, 'evals/gen/crop')
mkdirSync(GEN, { recursive: true })
compile(ROOT, [path.join(ROOT, 'src/lib/frameCompose.ts')], GEN, [
  '--rootDir', path.join(ROOT, 'src'),
])
const C = await import(path.join(GEN, 'lib/frameCompose.js'))

let failed = 0
const check = (ok, what, detail = '') => {
  if (!ok) failed++
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${what}${detail ? ` — ${detail}` : ''}`)
}
const near = (a, b, tol) => Math.abs(a - b) <= tol

/** The fixture clip the e2e drives: 320×240, so 4:3. */
const FRAME = { width: 320, height: 240 }
const SOURCE = FRAME.width / FRAME.height

/** What the tool offers, with 'Original' resolved the way the tool resolves it. */
const FORMATS = C.ASPECTS.map((a) => ({ id: a.id, aspect: a.aspect || SOURCE }))

/**
 * The rectangle a crop comes back as, in fractions of the frame.
 *
 * Through `cropRect`, so this is the rectangle the preview draws and the
 * exporter reads rather than the one `cropFromDrag` happened to return — the
 * clamping and the zoom are part of the answer.
 */
function shown(out) {
  const r = C.cropRect(FRAME, { aspect: out.aspect, cx: out.cx, cy: out.cy, zoom: out.zoom })
  return { x: r.x / FRAME.width, y: r.y / FRAME.height, w: r.w / FRAME.width, h: r.h / FRAME.height, px: r }
}

/** A raw dragged rectangle of a given PIXEL proportion, anchored at the origin. */
function raw(aspect, height = 1) {
  return { x0: 0, y0: 0, x1: (aspect * height * FRAME.height) / FRAME.width, y1: height }
}

console.log(`formats: ${FORMATS.map((f) => `${f.id}=${f.aspect.toFixed(3)}`).join(' ')}`)
console.log(`band: ±${(C.SNAP_TOL * 100).toFixed(0)}%\n`)

// ── The snap fires, and the SHAPE follows the label ──────────────────────────
//
// A chip lighting up while the rectangle stays 4% oblong would be worse than no
// snap at all: it would be the bar lying about the file. So each of these
// checks the proportion of the rectangle that comes back, not the id.
console.log('a drag NEAR a format lands ON it')
for (const f of FORMATS) {
  for (const off of [-0.05, -0.02, 0.02, 0.05]) {
    const want = f.aspect * Math.exp(off)
    const out = C.cropFromDrag(raw(want), 'se', FORMATS, FRAME)
    const r = shown(out)
    const got = r.px.w / r.px.h
    check(
      out.format?.id === f.id && near(got, f.aspect, 0.002),
      `${f.id} from ${(off * 100).toFixed(0).padStart(3)}%`,
      `chip ${out.format?.id ?? 'free'}, shape ${got.toFixed(4)}`,
    )
  }
}

// ── THE CONTROL: a shape between two formats is left alone ───────────────────
//
// Without this the sweep above would pass against a tool that snapped every
// drag to its nearest chip — which is a tool that cannot express a free crop,
// and the free crop is the entire reason the corner segments were built.
console.log('\na drag BETWEEN two formats stays free')
const sorted = [...new Set(FORMATS.map((f) => f.aspect))].sort((a, b) => a - b)
for (let i = 0; i < sorted.length - 1; i++) {
  const mid = Math.sqrt(sorted[i] * sorted[i + 1])
  const out = C.cropFromDrag(raw(mid), 'se', FORMATS, FRAME)
  const gap = Math.log(sorted[i + 1] / sorted[i]) / 2
  check(
    out.format === null && near(out.aspect, mid, 0.002),
    `${sorted[i].toFixed(3)}–${sorted[i + 1].toFixed(3)} midpoint ${mid.toFixed(3)}`,
    `${(gap * 100).toFixed(0)}% from each, free=${out.format === null}`,
  )
}

// ── Where the band ENDS, which is what makes "pass through" possible ─────────
//
// Just inside snaps and just outside does not. If the band were the whole gap
// there would be no free crop; if it were nothing there would be no snap.
console.log('\nthe band has an edge')
{
  const inside = C.cropFromDrag(raw(Math.exp(C.SNAP_TOL * 0.95)), 'se', FORMATS, FRAME)
  const outside = C.cropFromDrag(raw(Math.exp(C.SNAP_TOL * 1.05)), 'se', FORMATS, FRAME)
  check(inside.format?.id === '1:1', 'just inside 1:1 snaps', `${inside.format?.id ?? 'free'}`)
  check(outside.format === null, 'just outside 1:1 does not', `${outside.format?.id ?? 'free'}`)
}

// ── UNIFORM: inside the band, the drag resizes and does not distort ──────────
//
// This is the half the request turned on. Pull a corner in through a snapped
// format and the rectangle must get smaller while staying exactly that shape —
// including when the drag is a few per cent off, which every real drag is.
console.log('\ninside a band the drag RESIZES rather than distorts')
{
  let last = Infinity
  let held = true
  let shrank = true
  for (let step = 0; step <= 8; step++) {
    const h = 1 - step * 0.07
    // A drag nobody could make by hand: 3% oblong at every step, so a pass
    // cannot come from the input already being square.
    const out = C.cropFromDrag(raw(1.03, h), 'se', FORMATS, FRAME)
    const r = shown(out)
    const got = r.px.w / r.px.h
    if (out.format?.id !== '1:1' || !near(got, 1, 0.002)) held = false
    if (!(r.px.w < last)) shrank = false
    last = r.px.w
  }
  check(held, 'the shape is held at 1:1 through the whole pull')
  check(shrank, 'and the rectangle gets smaller at every step', `down to ${last.toFixed(1)}px wide`)
}

// ── PASSING THROUGH: one continuous drag crosses several formats ─────────────
//
// The decision is a pure function of the RAW rectangle, so a drag that keeps
// going leaves one band and enters the next with nothing to get wedged in.
// A snap that stuck would report the first format for the whole sweep.
console.log('\none continuous drag passes THROUGH the formats')
{
  const seen = []
  for (let step = 0; step <= 120; step++) {
    // The corner sweeping from a wide rectangle to a narrow one, which is what
    // dragging the east edge of a full-frame crop leftwards actually does.
    const width = 1 - step * (0.72 / 120)
    const out = C.cropFromDrag({ x0: 0, y0: 0, x1: width, y1: 1 }, 'e', FORMATS, FRAME)
    const id = out.format?.id ?? null
    if (id && seen[seen.length - 1] !== id) seen.push(id)
  }
  // Widest first: the sweep starts at the source 4:3 and narrows past 1:1, 4:5
  // and on down to 9:16. 16:9 is wider than this clip and unreachable by
  // narrowing it, which is why it is not in the expected order.
  const want = ['source', '1:1', '4:5', '9:16']
  check(
    JSON.stringify(seen) === JSON.stringify(want),
    'it visits every reachable format, in order',
    seen.join(' → '),
  )
}

// ── The ANCHOR: the edge under the finger moves, the opposite one does not ───
//
// A snap that re-centred the rectangle would jump it out from under the drag,
// which reads as the tool fighting you.
console.log('\nthe snap anchors on the edge the drag is not holding')
{
  const start = { x0: 0.2, y0: 0.1, x1: 0.8, y1: 0.9 }
  const se = C.cropFromDrag({ ...start, x1: 0.78, y1: 0.88 }, 'se', FORMATS, FRAME)
  const nw = C.cropFromDrag({ ...start, x0: 0.22, y0: 0.12 }, 'nw', FORMATS, FRAME)
  // The kept rectangle straight out of the drag, before `cropRect` clamps it —
  // clamping is the frame's business and would hide the anchor.
  const box = (o) => {
    const w = (C.fitRect(FRAME.width, FRAME.height, o.aspect).w / o.zoom) / FRAME.width
    const h = w * FRAME.width / o.aspect / FRAME.height
    return { x0: o.cx - w / 2, y0: o.cy - h / 2, x1: o.cx + w / 2, y1: o.cy + h / 2 }
  }
  const b1 = box(se), b2 = box(nw)
  check(near(b1.x0, start.x0, 0.002) && near(b1.y0, start.y0, 0.002),
    'a south-east drag leaves the north-west corner put', `${b1.x0.toFixed(3)},${b1.y0.toFixed(3)}`)
  check(near(b2.x1, start.x1, 0.002) && near(b2.y1, start.y1, 0.002),
    'a north-west drag leaves the south-east corner put', `${b2.x1.toFixed(3)},${b2.y1.toFixed(3)}`)
}

// ── An EDGE drag sets one dimension and derives the other ───────────────────
//
// That is what makes a snapped edge drag read as a uniform resize rather than
// as a stretch that gets corrected: pulling the east edge out grows the height
// to match, about the row the rectangle was already centred on.
console.log('\nan edge drag grows the other axis to suit')
{
  // 0.459 × 0.600 of a 4:3 frame is 146.9 × 144 pixels — 1.02, so 2% oblong.
  const out = C.cropFromDrag({ x0: 0.1, y0: 0.2, x1: 0.559, y1: 0.8 }, 'e', FORMATS, FRAME)
  const r = shown(out)
  check(out.format?.id === '1:1', 'a 1.02 pull on the east edge snaps square', `${out.format?.id ?? 'free'}`)
  check(near(r.px.w / r.px.h, 1, 0.002), 'and the output is square', (r.px.w / r.px.h).toFixed(4))
  check(near(out.cy, 0.5, 0.002), 'centred on the row it was already on', out.cy.toFixed(3))
}

// ── Never past the frame ─────────────────────────────────────────────────────
//
// A snap can ask for more picture than there is — the shape is exact and the
// area is whatever the drag wanted. `cropRect` caps it, and the result must
// still be the snapped shape rather than a squeezed one.
console.log('\na snap that asks for more picture than there is stops at the frame')
{
  const out = C.cropFromDrag({ x0: -0.4, y0: -0.4, x1: 1.4, y1: 1.4 }, 'se', FORMATS, FRAME)
  const r = shown(out)
  check(r.px.w <= FRAME.width + 1e-6 && r.px.h <= FRAME.height + 1e-6,
    'it stays inside the frame', `${r.px.w.toFixed(1)}×${r.px.h.toFixed(1)}`)
  check(near(r.px.w / r.px.h, out.aspect, 0.002), 'and keeps the snapped shape', (r.px.w / r.px.h).toFixed(4))
}

console.log(`\n${failed ? `${failed} FAILED` : 'all checks passed'}`)
process.exit(failed ? 1 : 0)
