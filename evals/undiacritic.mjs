// Does a tool win its own Arabic name when typed WITHOUT the diacritics?
//
// `ownname.mjs` asks whether each tool wins a search for its own name, and gets
// 100% — but it asks with the name exactly as written, and 78 of 229 Arabic
// names carry a shadda or a haraka: «محوّل العملات», «مولّد كلمة المرور»,
// «محرّر ملفات الترجمة». Nobody types those marks, so the bench was asking a
// question no visitor asks.
//
// WHAT IT MEASURES, stated carefully, because the first version of this file
// claimed more than it could show. Removing the fold and re-running leaves the
// pass rate at 78/79 either way — those tools still WIN, because the tagline,
// the keywords and the category carry them. What changes is the SCORE: with the
// fold, the undiacriticised name matches the name field and scores ~450; without
// it, the name field contributes nothing and the tool limps in on weaker
// evidence (qr-code: 450 -> 237). That lost ground is invisible on an easy query
// and decides a hard one — held-out set #6 moved 70% -> 77% top-1 with its last
// not-found going to zero.
//
// So the number to watch is the SECOND one below: how many win on their name
// rather than in spite of it.
//
// This is the same arrangement as `ownname` — derived from the registry, so it
// cannot go stale and grows with the catalogue.
//
// Run: node evals/undiacritic.mjs

import { scoreTool, stripArabicPrefixes, vocabulary } from './gen/fuzzy.js'
import { tools } from './lib/tools.mjs'

const MARKS = /[ً-ْٰـ]/g
const VOCAB = vocabulary(tools)

let checked = 0
let won = 0
let onName = 0
const lost = []

for (const t of tools) {
  const name = t.nameAr
  if (!name || !MARKS.test(name)) continue
  checked++
  const typed = name.replace(MARKS, '')
  const q = stripArabicPrefixes(typed, VOCAB)
  const scored = tools
    .map((x) => ({ id: x.id, score: scoreTool(q, x) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
  if (scored[0]?.id === t.id) {
    won++
    if (scored[0].score >= 400) onName++
  }
  else {
    lost.push(`${t.id.padEnd(22)} "${typed}"  ->  ${scored.slice(0, 2).map((x) => `${x.id}(${x.score.toFixed(0)})`).join(', ') || 'NOTHING'}`)
  }
}

console.log(`Arabic names carrying a diacritic: ${checked} of ${tools.length}`)
console.log(`win their own name typed plainly: ${won} (${Math.round((won / checked) * 100)}%)`)
console.log(`win ON the name (score >= 400) rather than in spite of it: ${onName} (${Math.round((onName / checked) * 100)}%)`)
if (lost.length) {
  console.log('\n--- not first ---')
  for (const l of lost) console.log('  ' + l)
}
