// Where can a relevance floor go without cutting a real answer?
//
//   node evals/floorprobe.mjs
//
// A floor is only safe if the WORST legitimate hit outscores the BEST junk one.
// That is a measurable gap or it is not, and guessing a threshold is how you
// silently delete a correct answer for a query nobody in the bench happened to
// type. This prints both distributions so the gap is visible before anything
// changes.
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { scoreTool, aboveFloor } from './gen/fuzzy.js'
import { UNTUNED, NOMATCH } from './untuned.mjs'
import { BENCH_QUERIES } from './benchqueries.mjs'

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
const reg = readFileSync(`${ROOT}/src/tools/index.ts`, 'utf8')
const dirs = readdirSync(`${ROOT}/src/tools`).filter(
  (d) => existsSync(`${ROOT}/src/tools/${d}/meta.ts`) && reg.includes(`'./${d}/meta'`),
)
const AR_CATEGORY = {
  Generators: 'مولّدات', Images: 'صور', Design: 'تصميم', Converters: 'محوّلات',
  Developer: 'أدوات المطوّرين', Web: 'الويب', Text: 'نصوص', Calculators: 'حاسبات',
  PDF: 'PDF', Business: 'أعمال', Communication: 'تواصل', Files: 'ملفات',
  Utilities: 'أدوات', 'Saudi / Local': 'أدوات سعودية', Islamic: 'إسلاميات', Arabic: 'العربية',
}
const tools = []
for (const d of dirs) {
  const raw = readFileSync(`${ROOT}/src/tools/${d}/meta.ts`, 'utf8')
  const src = raw.split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n')
  if (/status: 'coming-soon'/.test(src)) continue
  const pick = (k) => (new RegExp(`${k}: '((?:[^'\\\\]|\\\\.)*)'`).exec(src)?.[1] ?? '')
  const kwBlock = /keywords: \[([\s\S]*?)\]/.exec(src)?.[1] ?? ''
  const arBlock = /ar:\s*\{([\s\S]*?)\n  \}/.exec(src)?.[1] ?? ''
  const arPick = (k) => (new RegExp(`${k}:\\s*'((?:[^'\\\\]|\\\\.)*)'`).exec(arBlock)?.[1] ?? '')
  const category = pick('category')
  tools.push({
    id: pick('id'),
    name: pick('name'),
    nameAr: arPick('name') || pick('nameAr'),
    tagline: `${arPick('tagline')} ${pick('tagline')}`.trim(),
    category: `${AR_CATEGORY[category] ?? category} ${category}`.trim(),
    keywords: [...kwBlock.matchAll(/'((?:[^'\\]|\\.)*)'/g)].map((m) => m[1]),
  })
}
const byId = new Map(tools.map((t) => [t.id, t]))

// --- what a CORRECT answer scores ---
const legit = []
for (const [q, want] of [...BENCH_QUERIES, ...UNTUNED]) {
  for (const id of Array.isArray(want) ? want : [want]) {
    const t = byId.get(id)
    if (!t) continue
    legit.push({ q, id, s: scoreTool(q, t) })
  }
}
legit.sort((a, b) => a.s - b.s)

// --- what the top JUNK hit scores ---
const junk = []
for (const q of NOMATCH) {
  const hits = tools.map((t) => ({ id: t.id, s: scoreTool(q, t) })).filter((x) => x.s > 0)
  hits.sort((a, b) => b.s - a.s)
  if (hits[0]) junk.push({ q, id: hits[0].id, s: hits[0].s })
}
junk.sort((a, b) => b.s - a.s)

console.log('LOWEST-SCORING CORRECT ANSWERS (the floor must stay below these)')
for (const x of legit.slice(0, 10)) console.log(`  ${x.s.toFixed(0).padStart(6)}  ${x.q}  ->  ${x.id}`)

console.log('\nHIGHEST-SCORING JUNK (top hit for a query we cannot serve)')
for (const x of junk.slice(0, 10)) console.log(`  ${x.s.toFixed(0).padStart(6)}  ${x.q}  ->  ${x.id}`)

const minLegit = legit[0]?.s ?? 0
const maxJunk = junk[0]?.s ?? 0
console.log(`\nlowest correct answer: ${minLegit.toFixed(1)}`)
console.log(`highest junk top-hit:  ${maxJunk.toFixed(1)}`)
console.log(
  maxJunk < minLegit
    ? `=> a clean gap. An absolute floor anywhere in (${maxJunk.toFixed(0)}, ${minLegit.toFixed(0)}) cuts junk and no real answer.`
    : '=> NO clean gap: the best junk outscores the worst real answer, so an absolute floor WILL delete a correct result. A relative floor (a share of the top hit) is the only safe instrument.',
)

// --- would a RELATIVE floor (a share of the top hit) help, and cost what? ---
function results(q) {
  return tools.map((t) => ({ id: t.id, s: scoreTool(q, t) })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s)
}
console.log('\nRESULT-LIST LENGTH, real queries vs unanswerable ones')
for (const share of [0, 0.15, 0.25, 0.35, 0.5]) {
  const cut = (q) => { const r = results(q); const top = r[0]?.s ?? 0; return r.filter((x) => x.s >= top * share) }
  const realQs = BENCH_QUERIES.map(([q]) => q)
  const realLens = realQs.map((q) => cut(q).length)
  const junkLens = NOMATCH.map((q) => cut(q).length)
  const mean = (a) => (a.reduce((x, y) => x + y, 0) / (a.length || 1)).toFixed(1)
  // Does the wanted tool survive in the top 3?
  let broken = 0
  for (const [q, want] of BENCH_QUERIES) {
    const ids = new Set(Array.isArray(want) ? want : [want])
    if (!cut(q).slice(0, 3).some((x) => ids.has(x.id))) broken++
  }
  console.log(`  floor ${(share * 100).toString().padStart(3)}% of top   real mean ${mean(realLens).padStart(6)}   junk mean ${mean(junkLens).padStart(6)}   bench top-3 lost: ${broken}`)
}

// A BROAD query legitimately has many good answers. If the floor guts those it
// is the wrong instrument, however tidy the averages look.
console.log('\nAS SHIPPED (relative 25% + absolute 50) — what the user sees')
for (const q of ['pdf merge', 'pdf', 'image', 'csv', 'compress image', 'قبلة']) {
  const r = results(q).map((x) => ({ ...x, score: x.s }))
  const shown = aboveFloor(r)
  console.log(`  ${q.padEnd(16)} ${String(r.length).padStart(3)} -> ${String(shown.length).padStart(3)}   ${shown.slice(0, 5).map((x) => `${x.id}(${x.score.toFixed(0)})`).join(', ')}`)
}

console.log('\nBROAD QUERIES (many correct answers) — results kept')
for (const q of ['pdf', 'image', 'csv', 'arabic', 'prayer', 'صورة', 'color']) {
  const r = results(q)
  const top = r[0]?.s ?? 0
  const row = [0, 0.15, 0.25, 0.35].map((sh) => String(r.filter((x) => x.s >= top * sh).length).padStart(4))
  console.log(`  ${q.padEnd(10)} all${row[0]}   15%${row[1]}   25%${row[2]}   35%${row[3]}`)
}

// The relative floor cannot help when EVERYTHING scores badly: "buy bitcoin"
// tops out at 9 and keeps all 10 rows, because 25% of 9 is 2. Those are exactly
// the queries whose best hit sits far below the worst real answer, so a LOW
// absolute floor catches them without touching anything legitimate.
console.log('\nCOMBINED: relative 25% AND a low absolute floor')
for (const abs of [0, 50, 80, 100, 120]) {
  const cut = (q) => {
    const r = results(q)
    const top = r[0]?.s ?? 0
    return r.filter((x) => x.s >= Math.max(top * 0.25, abs))
  }
  let lostTop3 = 0
  for (const [q, want] of BENCH_QUERIES) {
    const ids = new Set(Array.isArray(want) ? want : [want])
    if (!cut(q).slice(0, 3).some((x) => ids.has(x.id))) lostTop3++
  }
  let lostHeldOut = 0
  for (const [q, want] of UNTUNED) {
    const ids = new Set(Array.isArray(want) ? want : [want])
    if (!cut(q).slice(0, 3).some((x) => ids.has(x.id))) lostHeldOut++
  }
  const emptied = NOMATCH.filter((q) => cut(q).length === 0).length
  const junkRows = NOMATCH.reduce((n, q) => n + cut(q).length, 0)
  const realRows = BENCH_QUERIES.reduce((n, [q]) => n + cut(q).length, 0)
  console.log(`  abs ${String(abs).padStart(3)}   unanswerable now EMPTY ${emptied}/${NOMATCH.length}   junk rows ${String(junkRows).padStart(3)}   real rows ${realRows}   bench lost ${lostTop3}   held-out lost ${lostHeldOut}`)
}
