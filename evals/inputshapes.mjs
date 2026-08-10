// Does the query survive the shape it arrives in?
//
// Every bench in this repo feeds the scorer a clean lower-case phrase. Nobody
// types like that. This takes the queries the benches ALREADY agree on and
// re-asks them in the shapes people actually produce — so it needs no
// hand-written expectations, cannot go stale, and grows with the benches.
//
// The shapes are not invented: each one was observed failing.
//
//   pdf-merge          a tool id, or the last part of a URL somebody saw
//   a pasted URL       the whole link, from a message
//   merge pdf?         a question mark, because it was a question
//   «ضغط الصور»        Arabic guillemets — the normal way Arabic quotes a term,
//                      used throughout this repo's own writing
//   قص الصورة.          a full stop, because it was a sentence
//
// Run: node evals/inputshapes.mjs

import { tools } from './lib/tools.mjs'
import { scoreTool, aboveFloor } from './gen/fuzzy.js'
import { normaliseQuery } from './gen/normaliseQuery.js'
import { BENCH_QUERIES } from './benchqueries.mjs'
import { UNTUNED } from './untuned.mjs'
import { UNTUNED_AR } from './untunedar.mjs'

// Through the same normaliser the UI uses — the shapes are the point, and
// measuring the raw scorer would measure a path no visitor takes.
const rank = (raw) =>
  aboveFloor(
    tools.map((t) => ({ t, score: scoreTool(normaliseQuery(raw), t) }))
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score),
    (r) => r.score,
  )

/** Only queries the scorer already gets right, so a miss is the SHAPE's fault. */
const base = [...BENCH_QUERIES, ...UNTUNED, ...UNTUNED_AR]
  .filter(([q, want]) => rank(q)[0]?.t.id === want)

const SHAPES = [
  ['unchanged', (q) => q],
  ['UPPER CASE', (q) => q.toUpperCase()],
  ['trailing ?', (q) => `${q}?`],
  ['trailing .', (q) => `${q}.`],
  ['double quoted', (q) => `"${q}"`],
  ['Arabic quotes', (q) => `«${q}»`],
  ['hyphenated', (q) => q.replace(/\s+/g, '-')],
  ['extra spaces', (q) => `  ${q.replace(/\s+/g, '   ')}  `],
  ['as a URL', (q) => `https://built-in-saudi.com/en/apps/${q.replace(/\s+/g, '-')}`],
]

console.log(`base queries the scorer already gets right: ${base.length}\n`)
console.log('shape'.padEnd(16), 'still first'.padStart(12), 'returns nothing'.padStart(17))

const detail = []
for (const [label, fn] of SHAPES) {
  let ok = 0
  let none = 0
  const lost = []
  for (const [q, want] of base) {
    const r = rank(fn(q))
    if (!r.length) none++
    if (r[0]?.t.id === want) ok++
    else if (lost.length < 3) lost.push(`${fn(q).slice(0, 34)} -> ${r[0]?.t.id ?? 'NOTHING'} (want ${want})`)
  }
  const pct = ((ok / base.length) * 100).toFixed(0)
  console.log(label.padEnd(16), `${ok}/${base.length} (${pct}%)`.padStart(12), String(none).padStart(17))
  if (ok < base.length) detail.push([label, lost])
}

for (const [label, lost] of detail) {
  console.log(`\n${label}:`)
  for (const l of lost) console.log(`  ${l}`)
}
