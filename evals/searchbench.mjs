import { tools } from './lib/tools.mjs'
import { scoreTool, aboveFloor, stripArabicPrefixes, vocabulary } from './gen/fuzzy.js'
import { normaliseQuery } from './gen/normaliseQuery.js'
import { preferDirection } from './gen/searchDirection.js'
import { numericIntent } from './gen/numericIntent.js'
import { productAliasAny } from './gen/productAliases.js'
import { UNTUNED, NOMATCH } from './untuned.mjs'
import { UNTUNED2 } from './untuned2.mjs'
import { UNTUNED4 } from './untuned4.mjs'
import { UNTUNED5 } from './untuned5.mjs'
import { UNTUNED6 } from './untuned6.mjs'
import { UNTUNED7 } from './untuned7.mjs'
import { UNTUNED8, UNTUNED8_NOMATCH } from './untuned8.mjs'
import { UNTUNED_AR } from './untunedar.mjs'

import { BENCH_QUERIES as BENCH } from './benchqueries.mjs'


// A row's expectation may be an ARRAY when the query genuinely has no single
// right answer — "contacts vcf" names a thing and a format and no direction, so
// both the reader and the writer of a .vcf are correct readings. Flipping such a
// row to whichever tool currently wins would be scoring the bench against
// itself; saying it is ambiguous keeps the number honest and is counted below.
const VOCAB = vocabulary(tools)

function rank(rawQuery, wanted) {
  // FAITHFUL: every search surface runs the query through `normaliseQuery`
  // before scoring, so a bench that skips it measures a scorer the site does
  // not run. Verified on adoption that it moved no existing number — the
  // benches are clean phrases, which is exactly why they could not see the
  // shapes `inputshapes` and held-out #5 were written to expose.
  // The search surfaces strip Arabic particles before scoring, so the bench
  // must too — a bench that skips a layer is not evidence about that layer.
  const query = stripArabicPrefixes(normaliseQuery(rawQuery), VOCAB)
  const want = Array.isArray(wanted) ? wanted : [wanted]
  const score = (q) => tools
    .map((t) => ({ id: t.id, score: scoreTool(q, t), names: [t.name, t.nameAr].filter(Boolean), inverse: t.inverse }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
  // FAITHFUL: `scoreList` applies the relevance FLOOR before anything else
  // looks at the list, so a bench that ranks the raw list measures rows the
  // user never sees — and, worse, decides "something matched" on them. That is
  // what the fallbacks below key off. Adding the floor here moved held-out #8
  // by 8 rows and every other bench by nothing.
  let raw = aboveFloor(score(query))
  // The surfaces fall back to a numeric-shape reading when nothing matched.
  if (!raw.length) {
    const shaped = numericIntent(query)
    if (shaped) raw = aboveFloor(score(shaped))
  }
  // The surfaces also fall back to the JOB behind a product name. A bench that
  // skips a layer is not evidence about that layer.
  if (!raw.length) {
    const asJob = productAliasAny(query)
    if (asJob) raw = aboveFloor(score(asJob))
  }
  // The direction tie-break runs in every search surface, so the bench applies
  // it too — a bench that skips a layer is not evidence about that layer.
  const scored = preferDirection(query, raw)
  const at = scored.findIndex((x) => want.includes(x.id))
  return { at: at < 0 ? Infinity : at + 1, top: scored.slice(0, 3).map((x) => x.id) }
}

// What the user actually SEES for a query: the same normalisation `rank` uses,
// then the relevance floor the UI applies. The original NOMATCH block called
// `scoreTool` on the RAW string, so the two halves of this file disagreed about
// what the query was — the drift `relatedcheck` and held-out #5 both record.
function shownFor(rawQuery) {
  const query = stripArabicPrefixes(normaliseQuery(rawQuery), VOCAB)
  const score = (q) => tools.map((t) => ({ id: t.id, score: scoreTool(q, t) }))
    .filter((x) => x.score > 0).sort((a, b) => b.score - a.score)
  let hits = score(query)
  if (!hits.length) {
    const shaped = numericIntent(query)
    if (shaped) hits = score(shaped)
  }
  if (!hits.length) {
    const asJob = productAliasAny(query)
    if (asJob) hits = score(asJob)
  }
  return { hits, shown: aboveFloor(hits) }
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

// --- the SIXTH held-out set: Arabic morphology ---
let m1 = 0, m3 = 0, mMiss = 0
const mBad = []
for (const [q, want] of UNTUNED6) {
  const r = rank(q, want)
  if (r.at === 1) m1++
  if (r.at <= 3) m3++
  if (r.at === Infinity) mMiss++
  if (r.at > 1) mBad.push(`${q.padEnd(26)} want ${(Array.isArray(want) ? want.join('|') : want).padEnd(24)} rank ${r.at === Infinity ? 'NOT FOUND' : r.at}  got ${r.top.join(', ')}`)
}
console.log(`
HELD OUT #6 (Arabic morphology, never tuned against): ${UNTUNED6.length} queries`)
console.log(`  top-1: ${m1}/${UNTUNED6.length} (${Math.round((m1 / UNTUNED6.length) * 100)}%)`)
console.log(`  top-3: ${m3}/${UNTUNED6.length} (${Math.round((m3 / UNTUNED6.length) * 100)}%)`)
console.log(`  not found at all: ${mMiss}`)
if (mBad.length) { console.log('  --- not first ---'); for (const l of mBad) console.log('  ' + l) }

// --- the SEVENTH held-out set: queries carrying a number ---
let n1 = 0, n3 = 0, nMiss = 0
const nBad = []
for (const [q, want] of UNTUNED7) {
  const r = rank(q, want)
  if (r.at === 1) n1++
  if (r.at <= 3) n3++
  if (r.at === Infinity) nMiss++
  if (r.at > 1) nBad.push(`${q.padEnd(28)} want ${(Array.isArray(want) ? want.join('|') : want).padEnd(30)} rank ${r.at === Infinity ? 'NOT FOUND' : r.at}  got ${r.top.join(', ')}`)
}
console.log(`
HELD OUT #7 (numeric queries, never tuned against): ${UNTUNED7.length} queries`)
console.log(`  top-1: ${n1}/${UNTUNED7.length} (${Math.round((n1 / UNTUNED7.length) * 100)}%)`)
console.log(`  top-3: ${n3}/${UNTUNED7.length} (${Math.round((n3 / UNTUNED7.length) * 100)}%)`)
console.log(`  not found at all: ${nMiss}`)
if (nBad.length) { console.log('  --- not first ---'); for (const l of nBad) console.log('  ' + l) }

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

// --- the EIGHTH held-out set: the product name used as the verb ---
let p1 = 0, p3 = 0, pMiss = 0
const pBad = []
for (const [q, want] of UNTUNED8) {
  const r = rank(q, want)
  if (r.at === 1) p1++
  if (r.at <= 3) p3++
  if (r.at === Infinity) pMiss++
  if (r.at > 1) pBad.push(`${q.padEnd(44)} want ${(Array.isArray(want) ? want.join('|') : want).padEnd(40)} rank ${r.at === Infinity ? 'NOT FOUND' : r.at}  got ${r.top.join(', ')}`)
}
console.log(`
HELD OUT #8 (product-as-verb + compound tasks, never tuned against): ${UNTUNED8.length} queries`)
console.log(`  top-1: ${p1}/${UNTUNED8.length} (${Math.round((p1 / UNTUNED8.length) * 100)}%)`)
console.log(`  top-3: ${p3}/${UNTUNED8.length} (${Math.round((p3 / UNTUNED8.length) * 100)}%)`)
console.log(`  not found at all: ${pMiss}`)
if (pBad.length) { console.log('  --- not first ---'); for (const l of pBad) console.log('  ' + l) }

// The other half of set #8, and the half no earlier set had: products whose
// function this site deliberately does NOT provide. Answering these with the
// nearest thing is the adware move.
let pNoisy = 0
const pNoise = []
for (const q of UNTUNED8_NOMATCH) {
  const { shown } = shownFor(q)
  if (shown.length) { pNoisy++; pNoise.push(`  ${q.padEnd(14)} -> ${shown.slice(0, 3).map((h) => `${h.id}(${h.score.toFixed(0)})`).join(', ')}`) }
}
console.log(`  products we deliberately do NOT imitate: ${UNTUNED8_NOMATCH.length - pNoisy}/${UNTUNED8_NOMATCH.length} correctly return nothing`)
for (const l of pNoise) console.log(l)

// --- and the opposite question: do we admit to having nothing? ---
let noisy = 0
let noiseRows = 0
let shownRows = 0
for (const q of NOMATCH) {
  const { hits, shown } = shownFor(q)
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
