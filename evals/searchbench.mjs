import { tools } from './lib/tools.mjs'
import { scoreTool, aboveFloor } from './gen/fuzzy.js'
import { normaliseQuery } from './gen/normaliseQuery.js'
import { preferDirection } from './gen/searchDirection.js'
import { UNTUNED, NOMATCH } from './untuned.mjs'
import { UNTUNED2 } from './untuned2.mjs'
import { UNTUNED4 } from './untuned4.mjs'
import { UNTUNED5 } from './untuned5.mjs'
import { UNTUNED_AR } from './untunedar.mjs'

import { BENCH_QUERIES as BENCH } from './benchqueries.mjs'


// A row's expectation may be an ARRAY when the query genuinely has no single
// right answer — "contacts vcf" names a thing and a format and no direction, so
// both the reader and the writer of a .vcf are correct readings. Flipping such a
// row to whichever tool currently wins would be scoring the bench against
// itself; saying it is ambiguous keeps the number honest and is counted below.
function rank(rawQuery, wanted) {
  // FAITHFUL: every search surface runs the query through `normaliseQuery`
  // before scoring, so a bench that skips it measures a scorer the site does
  // not run. Verified on adoption that it moved no existing number — the
  // benches are clean phrases, which is exactly why they could not see the
  // shapes `inputshapes` and held-out #5 were written to expose.
  const query = normaliseQuery(rawQuery)
  const want = Array.isArray(wanted) ? wanted : [wanted]
  const raw = tools
    .map((t) => ({ id: t.id, score: scoreTool(query, t), names: [t.name, t.nameAr].filter(Boolean), inverse: t.inverse }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
  // The direction tie-break runs in every search surface, so the bench applies
  // it too — a bench that skips a layer is not evidence about that layer.
  const scored = preferDirection(query, raw)
  const at = scored.findIndex((x) => want.includes(x.id))
  return { at: at < 0 ? Infinity : at + 1, top: scored.slice(0, 3).map((x) => x.id) }
}

let top1 = 0, top3 = 0, missing = 0
const bad = []
let ambiguous = 0
// Everything that is not rank 1, not only what falls outside the top 3. A
// rank-2 result is a real miss — nobody scans a list for the tool they named.
const near = []
for (const [q, want] of BENCH) {
  if (Array.isArray(want)) ambiguous += 1
  const r = rank(q, want)
  if (r.at === 1) top1++
  if (r.at <= 3) top3++
  if (r.at === Infinity) missing++
  if (r.at > 3) bad.push(`${q.padEnd(24)} want ${want.padEnd(20)} rank ${r.at === Infinity ? 'NOT FOUND' : r.at}  got ${r.top.join(', ')}`)
  else if (r.at > 1) near.push(`${q.padEnd(24)} want ${want.padEnd(20)} rank ${r.at}  beaten by ${r.top.slice(0, r.at - 1).join(', ')}`)
}

console.log(`tools indexed: ${tools.length}`)
console.log(`queries: ${BENCH.length}`)
console.log(`top-1: ${top1}/${BENCH.length} (${Math.round((top1 / BENCH.length) * 100)}%)`)
console.log(`top-3: ${top3}/${BENCH.length} (${Math.round((top3 / BENCH.length) * 100)}%)`)
console.log(`not found at all: ${missing}`)
console.log(`rows with more than one acceptable answer: ${ambiguous}`)
if (near.length) {
  console.log('\n--- rank 2-3 (found, but not first) ---')
  for (const line of near) console.log(line)
}
if (bad.length) {
  console.log('\n--- outside the top 3 ---')
  for (const line of bad) console.log(line)
}

// --- the held-out set, reported every run so overfitting cannot hide ---
let u1 = 0, u3 = 0, uMiss = 0
const uBad = []
for (const [q, want] of UNTUNED) {
  const r = rank(q, want)
  if (r.at === 1) u1++
  if (r.at <= 3) u3++
  if (r.at === Infinity) uMiss++
  if (r.at > 1) uBad.push(`${q.padEnd(24)} want ${(Array.isArray(want) ? want.join('|') : want).padEnd(24)} rank ${r.at === Infinity ? 'NOT FOUND' : r.at}  got ${r.top.join(', ')}`)
}
console.log(`
HELD OUT (never tuned against): ${UNTUNED.length} queries`)
console.log(`  top-1: ${u1}/${UNTUNED.length} (${Math.round((u1 / UNTUNED.length) * 100)}%)`)
console.log(`  top-3: ${u3}/${UNTUNED.length} (${Math.round((u3 / UNTUNED.length) * 100)}%)`)
console.log(`  not found at all: ${uMiss}`)
if (uBad.length) { console.log('  --- not first ---'); for (const l of uBad) console.log('  ' + l) }

// --- the SECOND held-out set, written after the first was burned ---
let v1 = 0, v3 = 0, vMiss = 0
const vBad = []
for (const [q, want] of UNTUNED2) {
  const r = rank(q, want)
  if (r.at === 1) v1++
  if (r.at <= 3) v3++
  if (r.at === Infinity) vMiss++
  if (r.at > 1) vBad.push(`${q.padEnd(30)} want ${String(want).padEnd(22)} rank ${r.at === Infinity ? 'NOT FOUND' : r.at}  got ${r.top.join(', ')}`)
}
console.log(`
HELD OUT #2 (fresh, never tuned against): ${UNTUNED2.length} queries`)
console.log(`  top-1: ${v1}/${UNTUNED2.length} (${Math.round((v1 / UNTUNED2.length) * 100)}%)`)
console.log(`  top-3: ${v3}/${UNTUNED2.length} (${Math.round((v3 / UNTUNED2.length) * 100)}%)`)
console.log(`  not found at all: ${vMiss}`)
if (vBad.length) { console.log('  --- not first ---'); for (const l of vBad) console.log('  ' + l) }

// --- the FOURTH held-out set: the PROBLEM, not the tool ---
let w1 = 0, w3 = 0, wMiss = 0
const wBad = []
for (const [q, want] of UNTUNED4) {
  const r = rank(q, want)
  if (r.at === 1) w1++
  if (r.at <= 3) w3++
  if (r.at === Infinity) wMiss++
  if (r.at > 1) wBad.push(`${q.padEnd(46)} want ${String(want).padEnd(22)} rank ${r.at === Infinity ? 'NOT FOUND' : r.at}  got ${r.top.join(', ')}`)
}
console.log(`
HELD OUT #4 (symptom-shaped, never tuned against): ${UNTUNED4.length} queries`)
console.log(`  top-1: ${w1}/${UNTUNED4.length} (${Math.round((w1 / UNTUNED4.length) * 100)}%)`)
console.log(`  top-3: ${w3}/${UNTUNED4.length} (${Math.round((w3 / UNTUNED4.length) * 100)}%)`)
console.log(`  not found at all: ${wMiss}`)
if (wBad.length) { console.log('  --- not first ---'); for (const l of wBad) console.log('  ' + l) }

// --- the FIFTH held-out set: the FORMAT, by its extension ---
let x1 = 0, x3 = 0, xMiss = 0
const xBad = []
for (const [q, want] of UNTUNED5) {
  const r = rank(q, want)
  if (r.at === 1) x1++
  if (r.at <= 3) x3++
  if (r.at === Infinity) xMiss++
  if (r.at > 1) xBad.push(`${q.padEnd(24)} want ${(Array.isArray(want) ? want.join('|') : want).padEnd(38)} rank ${r.at === Infinity ? 'NOT FOUND' : r.at}  got ${r.top.join(', ')}`)
}
console.log(`
HELD OUT #5 (file extensions, never tuned against): ${UNTUNED5.length} queries`)
console.log(`  top-1: ${x1}/${UNTUNED5.length} (${Math.round((x1 / UNTUNED5.length) * 100)}%)`)
console.log(`  top-3: ${x3}/${UNTUNED5.length} (${Math.round((x3 / UNTUNED5.length) * 100)}%)`)
console.log(`  not found at all: ${xMiss}`)
if (xBad.length) { console.log('  --- not first ---'); for (const l of xBad) console.log('  ' + l) }

// --- the ARABIC held-out set ---
let a1 = 0, a3 = 0, aMiss = 0
const aBad = []
for (const [q, want] of UNTUNED_AR) {
  const r = rank(q, want)
  if (r.at === 1) a1++
  if (r.at <= 3) a3++
  if (r.at === Infinity) aMiss++
  if (r.at > 1) aBad.push(`${q.padEnd(32)} want ${String(want).padEnd(22)} rank ${r.at === Infinity ? 'NOT FOUND' : r.at}  got ${r.top.join(', ')}`)
}
console.log(`
HELD OUT, ARABIC (fresh, never tuned against): ${UNTUNED_AR.length} queries`)
console.log(`  top-1: ${a1}/${UNTUNED_AR.length} (${Math.round((a1 / UNTUNED_AR.length) * 100)}%)`)
console.log(`  top-3: ${a3}/${UNTUNED_AR.length} (${Math.round((a3 / UNTUNED_AR.length) * 100)}%)`)
console.log(`  not found at all: ${aMiss}`)
if (aBad.length) { console.log('  --- not first ---'); for (const l of aBad) console.log('  ' + l) }

// --- and the opposite question: do we admit to having nothing? ---
let noisy = 0
let noiseRows = 0
let shownRows = 0
for (const q of NOMATCH) {
  const hits = tools.map((t) => ({ id: t.id, score: scoreTool(q, t) })).filter((x) => x.score > 0).sort((a, b) => b.score - a.score)
  // What the USER sees: the relevance floor the UI applies, not the raw list.
  const shown = aboveFloor(hits)
  if (shown.length) noisy++
  noiseRows += hits.length
  shownRows += shown.length
  console.log(`  ${q.padEnd(18)} ${String(hits.length).padStart(3)} raw -> ${String(shown.length).padStart(2)} shown   ${shown.slice(0, 3).map((h) => `${h.id}(${h.score.toFixed(0)})`).join(', ')}`)
}
console.log(`\nUNANSWERABLE (${NOMATCH.length} queries the site cannot serve)`)
console.log(`  return something anyway: ${noisy}/${NOMATCH.length}  <- the floor does NOT fix this, and cannot`)
console.log(`  junk rows: ${noiseRows} raw -> ${shownRows} shown`)

// Every tool still wins a search for its own name — the general form of the
// defect the benches keep catching one query at a time. Printed here because
// anyone touching search runs this file, and a check nobody runs is not a check.
import { ownNameReport } from './ownname.mjs'
console.log('\nOWN NAMES')
ownNameReport()
