// Why does a tool lose to its twin?
//
// A diagnostic dump, not a gate: give it a query and two tool ids and it prints
// what each one actually indexes, so the cause is visible rather than guessed
// at. `evals/directions.mjs` is the systematic version for converter pairs;
// this is for the hand-picked cases that are not X-to-Y.
//
// **It used to carry its own copy of the whole tool loader**, including a
// hand-written Arabic category map — the exact drift removed from
// `evals/lib/tools.mjs` two passes ago, and by then already stale for Health
// and Time & Date. This file is the reason CLAUDE.md says to use the shared
// loader rather than write a second one; it was quietly disobeying its own
// lesson.
//
// Run: node evals/twinprobe.mjs ["query" toolA toolB]

import { tools } from './lib/tools.mjs'
import { scoreTool } from './gen/fuzzy.js'

const byId = new Map(tools.map((t) => [t.id, t]))

/** Default cases: the pairs this repo has actually had to reason about. */
const PAIRS = [
  ['html to markdown', 'paste-to-markdown', 'markdown-html'],
  ['تشكيل النص', 'diacritize', 'arabic-normalize'],
  ['طمس وجه في صورة', 'image-redact', 'steganography'],
  ['open a zip', 'archive-inspector', 'zip-create'],
  ['ضغط ملفات', 'zip-create', 'svg-optimise'],
]

const cases = process.argv.length >= 5
  ? [[process.argv[2], process.argv[3], process.argv[4]]]
  : PAIRS

for (const [q, want, beat] of cases) {
  const a = byId.get(want)
  const b = byId.get(beat)
  if (!a || !b) { console.log(`? unknown tool in [${want}, ${beat}]`); continue }
  const sa = scoreTool(q, a)
  const sb = scoreTool(q, b)
  const ok = sa > sb
  console.log(`\n${ok ? 'OK  ' : 'LOSS'}  "${q}"  ${want} ${sa.toFixed(1)}  vs  ${beat} ${sb.toFixed(1)}`)
  if (ok) continue
  for (const t of [a, b]) {
    console.log(`   ${t.id}`)
    console.log(`     name    ${t.name}`)
    console.log(`     nameAr  ${t.nameAr}`)
    console.log(`     cat     ${t.category}`)
    console.log(`     kw      ${(t.keywords || []).join(', ').slice(0, 160)}`)
  }
}
