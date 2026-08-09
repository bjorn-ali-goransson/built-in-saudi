// Does the spelling correction ever change an answer it should not?
//
// The correction is a UI-layer fallback, so `searchbench.mjs` — which measures
// the SCORER — cannot see it. This applies the exact rule the UI applies to
// every benched query and every query the site is known not to serve, and
// reports each one whose top result changes.
//
// The dangerous case is not a typo: it is a correctly-spelled word the
// catalogue happens not to contain, which the corrector could bend into a word
// it does. That is how "coffee" became "strength" at a four-character
// threshold, and it is why this runs over the NOMATCH set as well.
import { tools } from './lib/tools.mjs'
import { scoreTool, aboveFloor, correctQuery, vocabulary } from './gen/fuzzy.js'
import { BENCH_QUERIES } from './benchqueries.mjs'
import { UNTUNED, NOMATCH } from './untuned.mjs'
import { UNTUNED2 } from './untuned2.mjs'
import { UNTUNED_AR } from './untunedar.mjs'

const VOCAB = vocabulary(tools)
const RATIO = 1.5

const once = (q) => aboveFloor(
  tools.map((t) => ({ id: t.id, score: scoreTool(q, t) }))
    .filter((x) => x.score > 0).sort((a, b) => b.score - a.score),
)

const ALL = [
  ...BENCH_QUERIES.map(([q]) => [q, 'tuned']),
  ...UNTUNED.map(([q]) => [q, 'held-out 1']),
  ...UNTUNED2.map(([q]) => [q, 'held-out 2']),
  ...UNTUNED_AR.map(([q]) => [q, 'arabic']),
  ...NOMATCH.map((q) => [q, 'UNANSWERABLE']),
]

let corrected = 0, changed = 0, nowAnswers = 0
const rows = []
for (const [q, set] of ALL) {
  const c = correctQuery(q, VOCAB)
  if (!c) continue
  corrected++
  const a = once(q)
  const b = once(c)
  const wins = b.length && (!a.length || b[0].score >= a[0].score * RATIO)
  if (!wins) continue
  changed++
  if (!a.length) nowAnswers++
  rows.push(`  [${set}] "${q}" -> "${c}"   ${a[0]?.id ?? 'NOTHING'} => ${b[0].id}`)
}

console.log(`queries checked: ${ALL.length}`)
console.log(`  a correction was available for: ${corrected}`)
console.log(`  the correction actually won:    ${changed}`)
console.log(`  of which previously returned NOTHING: ${nowAnswers}`)
if (rows.length) { console.log('\nCHANGED'); rows.forEach((r) => console.log(r)) }
else console.log('\nno benched query changes')
