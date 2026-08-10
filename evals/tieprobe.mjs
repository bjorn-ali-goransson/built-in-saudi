// How often is the top search result decided by a COIN TOSS?
//
// Ties falling through to catalogue order is deliberate and documented — it is
// an editorial judgement about which tool is primary, and a
// coverage/shorter-name tie-break was measured and rejected once already. But
// nobody ever measured how OFTEN it decides, or whether the tools sharing a tie
// are even related. «متى رمضان» tying the Hijri calendar with the water-intake
// calculator, the medicine scheduler and the timesheet is not an editorial
// judgement about which is primary; it is four tools that happen to contain one
// word, and the catalogue order between them means nothing.
//
// Run: node evals/tieprobe.mjs

import { tools } from './lib/tools.mjs'
import { matchCategory } from './gen/categoryMatch.js'
import { scoreTool, aboveFloor } from './gen/fuzzy.js'
import { BENCH_QUERIES } from './benchqueries.mjs'
import { UNTUNED, NOMATCH } from './untuned.mjs'
import { UNTUNED2 } from './untuned2.mjs'
import { UNTUNED_AR } from './untunedar.mjs'

const rank = (q) =>
  aboveFloor(
    tools.map((t) => ({ t, score: scoreTool(q, t) }))
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score),
    (r) => r.score,
  )

function report(label, queries, wanted) {
  let tied = 0, total = 0, wide = 0, wrongWinner = 0
  const rows = []
  for (const [i, q] of queries.entries()) {
    const ranked = rank(q)
    if (!ranked.length) continue
    total++
    const top = ranked[0].score
    const same = ranked.filter((r) => r.score === top)
    if (same.length > 1) {
      tied++
      if (same.length >= 3) wide++
      const want = wanted?.[i]
      // A tie is only harmful when the RIGHT tool is in it and did not win.
      const harmful = want && same.some((r) => r.t.id === want) && ranked[0].t.id !== want
      if (harmful) wrongWinner++
      rows.push({ q, n: same.length, harmful, ids: same.map((r) => r.t.id) })
    }
  }
  const pct = total ? (tied / total * 100).toFixed(1) : '0'
  console.log(`\n${label}`)
  console.log(`  ${tied}/${total} queries have a TIED top score (${pct}%); ${wide} are three-way or wider`)
  if (wanted) console.log(`  ties where the RIGHT tool was in the tie and lost it: ${wrongWinner}`)
  rows.sort((a, b) => b.n - a.n)
  for (const r of rows.slice(0, 10)) {
    console.log(`   ${String(r.n).padStart(2)}-way ${r.harmful ? '!' : ' '} ${r.q.padEnd(26)} ${r.ids.slice(0, 5).join(', ')}`)
  }
}

const all = [...BENCH_QUERIES, ...UNTUNED, ...UNTUNED2, ...UNTUNED_AR]
report('BENCHED QUERIES (the right answer is known)', all.map((r) => r[0]), all.map((r) => r[1]))
report('UNANSWERABLE QUERIES', NOMATCH)

// A bare keyword is what somebody types when they do not know the tool's name,
// and it is exactly where an exact-keyword match scores the same for everyone.
const words = new Set()
for (const t of tools) for (const k of t.keywords || []) if (!/\s/.test(k)) words.add(k)
report(`SINGLE-WORD KEYWORDS (${words.size} of them)`, [...words])
