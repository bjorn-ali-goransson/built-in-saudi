// Does "which of your words matched nothing" separate a real query from a bad one?
//
//   node evals/coverprobe.mjs
//
// `order pizza` returns the screen recorder and `translate my dog` returns the
// translator. Both are the site failing to admit it cannot help, and the
// relevance floor cannot fix either — measured, and recorded in fuzzy.ts: the
// best hit for a query we cannot serve outscores the worst genuinely correct
// answer, so no threshold separates them.
//
// But the scorer already computes something it then throws away: how many of
// the typed TERMS matched anything at all. `pizza` matches nothing; `dog`
// matches nothing. If real queries overwhelmingly have every term matched and
// unanswerable ones do not, that is a usable signal — not to hide results, but
// to say which word was ignored, the way every search engine worth using does.
//
// This measures whether the separation is real BEFORE any UI is built on it.
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { scoreTool } from './gen/fuzzy.js'
import { BENCH_QUERIES } from './benchqueries.mjs'
import { UNTUNED, NOMATCH } from './untuned.mjs'
import { UNTUNED2 } from './untuned2.mjs'

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
  const src = readFileSync(`${ROOT}/src/tools/${d}/meta.ts`, 'utf8')
    .split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n')
  if (/status: 'coming-soon'/.test(src)) continue
  const pick = (k) => (new RegExp(`${k}: '((?:[^'\\\\]|\\\\.)*)'`).exec(src)?.[1] ?? '')
  const kwBlock = /keywords: \[([\s\S]*?)\]/.exec(src)?.[1] ?? ''
  const arBlock = /ar:\s*\{([\s\S]*?)\n  \}/.exec(src)?.[1] ?? ''
  const arPick = (k) => (new RegExp(`${k}:\\s*'((?:[^'\\\\]|\\\\.)*)'`).exec(arBlock)?.[1] ?? '')
  const category = pick('category')
  tools.push({
    id: pick('id'), name: pick('name'), nameAr: arPick('name') || pick('nameAr'),
    tagline: `${arPick('tagline')} ${pick('tagline')}`.trim(),
    category: `${AR_CATEGORY[category] ?? category} ${category}`.trim(),
    keywords: [...kwBlock.matchAll(/'((?:[^'\\]|\\.)*)'/g)].map((m) => m[1]),
  })
}

// Mirrors `terms()` in fuzzy.ts. Kept in step by hand, which is a cost — but
// exporting the internals to measure them would widen the module's surface for
// a probe, and this file prints its own term split so a drift is visible.
const STOP = new Set([
  'a', 'an', 'the', 'my', 'me', 'is', 'are', 'to', 'for', 'of', 'in', 'on', 'from',
  'with', 'and', 'or', 'do', 'i', 'can', 'get', 'make', 'it', 'this', 'that',
  'how', 'what', 'when', 'where', 'why', 'which', 'who',
  'am', 'was', 'were', 'be', 'been', 'does', 'did',
  'في', 'من', 'الى', 'إلى', 'على', 'عن', 'كيف', 'هل', 'ال',
  'ما', 'هو', 'هي', 'متى', 'اين', 'أين', 'كم',
])
const stripAl = (t) => (/^ال.{2,}/.test(t) ? t.slice(2) : t)
function terms(q) {
  const all = q.toLowerCase().trim().split(/\s+/).filter(Boolean).map(stripAl)
  const kept = all.filter((t) => !STOP.has(t))
  return kept.length ? kept : all
}

/** Which of the query's terms matched NO tool at all? */
function deadTerms(q) {
  const list = terms(q)
  if (list.length < 2) return []
  return list.filter((t) => !tools.some((tool) => scoreTool(t, tool) > 0))
}

const real = [...BENCH_QUERIES, ...UNTUNED, ...UNTUNED2].map(([q]) => q)
const realDead = real.filter((q) => deadTerms(q).length)
const junkDead = NOMATCH.filter((q) => deadTerms(q).length)

console.log(`REAL queries (${real.length}): ${realDead.length} have a term that matched nothing`)
for (const q of realDead) console.log(`  ${q.padEnd(30)} dead: ${deadTerms(q).join(', ')}`)

console.log(`\nUNANSWERABLE (${NOMATCH.length}): ${junkDead.length} have a term that matched nothing`)
for (const q of NOMATCH) {
  const d = deadTerms(q)
  console.log(`  ${q.padEnd(20)} ${d.length ? `dead: ${d.join(', ')}` : '(every term matched something)'}`)
}

const precision = junkDead.length / (junkDead.length + realDead.length || 1)
console.log(`\n=> Of the queries this would caveat, ${(precision * 100).toFixed(0)}% are ones we cannot serve.`)
console.log(`=> It would caveat ${realDead.length} of ${real.length} real queries — the cost side.`)

// --- the one real finding the probe turned up on its way past ---
//
// `anonymise` matched NO tool at all: the anonymiser indexes only the American
// spelling. That is a whole class of miss, and it is checkable — this site
// writes British English in its own copy while a keyword list, being written by
// a developer, tends to the American form. Both are typed by real people.
const SPELLING = [
  ['normalise', 'arabic-normalize'],
  ['optimise my cv', 'ats-cv-optimizer'],
  ['anonymise', 'data-anonymize'],
  ['sanitise', 'data-anonymize'],
  ['analyse email headers', 'email-headers'],
  ['optimise an image', 'image-compressor'],
  ['romanization', 'name-spelling'],
  ['optimise a pdf', 'pdf-compress'],
  ['rasterise', 'pdf-to-images'],
  ['analyse a prompt', 'prompt-analyzer'],
  ['optimizer for svg', 'svg-optimise'],
  ['diacritiser', 'diacritize'],
]
console.log('\nSPELLING VARIANTS (-ise / -ize, both of which people type)')
let missed = 0
for (const [q, want] of SPELLING) {
  const r = tools.map((t) => ({ id: t.id, s: scoreTool(q, t) })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s)
  const at = r.findIndex((x) => x.id === want)
  if (at !== 0) missed++
  console.log(`  ${q.padEnd(24)} want ${want.padEnd(20)} rank ${String(at < 0 ? 'NOT FOUND' : at + 1).padEnd(10)} got ${r.slice(0, 2).map((x) => x.id).join(', ')}`)
}
console.log(`\n=> ${missed}/${SPELLING.length} spelling variants do not reach their tool first.`)
