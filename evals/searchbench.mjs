// Measure the search before touching it.
//
// A bench of queries someone would actually type, each with the tool id they
// obviously mean. Reports where that tool ranks. "Feels better" is not a
// measurement; rank-of-the-right-answer is.
import { readFileSync, readdirSync, existsSync } from 'node:fs'

// Run from the repo root: npx tsc src/lib/fuzzy.ts --outDir evals/gen --module esnext \n//   --target es2022 --moduleResolution bundler && node evals/searchbench.mjs
const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')

// --- load the tools straight out of the metas (no TS build needed) ---
const reg = readFileSync(`${ROOT}/src/tools/index.ts`, 'utf8')
const dirs = readdirSync(`${ROOT}/src/tools`).filter(
  (d) => existsSync(`${ROOT}/src/tools/${d}/meta.ts`) && reg.includes(`'./${d}/meta'`),
)
// Mirrors CATEGORY_LABELS in src/i18n/index.tsx — the UI scores against the
// localized label as well as the English one.
const AR_CATEGORY = {
  Generators: 'مولّدات', Images: 'صور', Design: 'تصميم', Converters: 'محوّلات',
  Developer: 'أدوات المطوّرين', Web: 'الويب', Text: 'نصوص', Calculators: 'حاسبات',
  PDF: 'PDF', Business: 'أعمال', Communication: 'تواصل', Files: 'ملفات',
  Utilities: 'أدوات', 'Saudi / Local': 'أدوات سعودية', Islamic: 'إسلاميات', Arabic: 'العربية',
}

const tools = []
for (const d of dirs) {
  const raw = readFileSync(`${ROOT}/src/tools/${d}/meta.ts`, 'utf8')
  // Strip whole-line // comments BEFORE pulling quoted strings out. Without
  // this the harness reads a comment as data: a note saying why a keyword was
  // removed mentions the word in quotes, and the bench dutifully re-indexed it
  // — reporting the removal as having had no effect. A parser that reads the
  // explanation as the thing being explained is worse than no parser.
  const src = raw.split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n')
  if (/status: 'coming-soon'/.test(src)) continue
  const pick = (k) => (new RegExp(`${k}: '((?:[^'\\\\]|\\\\.)*)'`).exec(src)?.[1] ?? '')
  const kwBlock = /keywords: \[([\s\S]*?)\]/.exec(src)?.[1] ?? ''
  const keywords = [...kwBlock.matchAll(/'((?:[^'\\]|\\.)*)'/g)].map((m) => m[1])
  // The UI passes the localized AND English tagline/category joined together
  // (see AppLauncher). Passing only the English ones measured a scorer the site
  // does not run: "stopwatch" returned nothing here and one result in the
  // browser, because an Arabic tagline it never saw contained the subsequence.
  const arBlock = /ar:\s*\{([\s\S]*?)\n  \}/.exec(src)?.[1] ?? ''
  const arPick = (k) => (new RegExp(`${k}:\\s*'((?:[^'\\\\]|\\\\.)*)'`).exec(arBlock)?.[1] ?? '')
  const category = pick('category')
  tools.push({
    id: pick('id'),
    name: pick('name'),
    // The UI passes localizeTool(tool, locale).name -- the ar BLOCK'"'"'s name --
    // not the top-level nameAr field, which most metas do not even define. The
    // bench read the field, so for every such tool the Arabic name was simply
    // absent from the index: حاسبة النسبة ranked its own calculator SEVENTH.
    nameAr: arPick('name') || pick('nameAr'),
    tagline: `${arPick('tagline')} ${pick('tagline')}`.trim(),
    category: `${AR_CATEGORY[category] ?? category} ${category}`.trim(),
    keywords,
  })
}

// Registry order, because that is how the UI iterates and therefore how it
// breaks ties. Reading the directory gives alphabetical order instead, which
// silently resolved every tie the wrong way: "فاتورة" ties the invoice
// generator with the electricity bill at 432.00, and the bench called it a
// failure while the site ranks them the way the catalogue is curated.
const order = [...reg.matchAll(/^  ([a-zA-Z0-9]+Tool),$/gm)].map((m, i) => [m[1], i])
const orderRank = new Map(order)
const varOf = new Map()
for (const d of dirs) {
  const src = readFileSync(`${ROOT}/src/tools/${d}/meta.ts`, 'utf8')
  const v = /export const ([a-zA-Z0-9]+Tool)/.exec(src)?.[1]
  const id = /id: '([^']+)'/.exec(src)?.[1]
  if (v && id) varOf.set(id, v)
}
tools.sort((a, b) => (orderRank.get(varOf.get(a.id)) ?? 1e9) - (orderRank.get(varOf.get(b.id)) ?? 1e9))

// --- the REAL scorer, compiled from src/lib/fuzzy.ts by tsc ---
import { scoreTool, aboveFloor } from './gen/fuzzy.js'
import { UNTUNED, NOMATCH } from './untuned.mjs'
import { UNTUNED2 } from './untuned2.mjs'
import { UNTUNED_AR } from './untunedar.mjs'

import { BENCH_QUERIES as BENCH } from './benchqueries.mjs'


// A row's expectation may be an ARRAY when the query genuinely has no single
// right answer — "contacts vcf" names a thing and a format and no direction, so
// both the reader and the writer of a .vcf are correct readings. Flipping such a
// row to whichever tool currently wins would be scoring the bench against
// itself; saying it is ambiguous keeps the number honest and is counted below.
function rank(query, wanted) {
  const want = Array.isArray(wanted) ? wanted : [wanted]
  const scored = tools
    .map((t) => ({ id: t.id, score: scoreTool(query, t) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
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
