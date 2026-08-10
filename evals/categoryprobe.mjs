// Does the category offer fire where it should, and stay silent where it must?
//
// The card sits ABOVE the real results, so a false positive costs more than a
// miss: a query that meant one specific tool must never be answered with a
// grouping. Two populations, and both numbers matter:
//
//   · the wide-tie generic queries `tieprobe` found — it SHOULD fire
//   · every benched query, all of which name a specific tool — it must NOT
//
// Run: node evals/categoryprobe.mjs
//   (needs: npx tsc src/lib/categoryMatch.ts src/lib/normaliseQuery.ts --outDir evals/gen --module esnext
//    --target es2022 --moduleResolution bundler)

import { matchGroup } from './gen/categoryMatch.js'
import { normaliseQuery } from './gen/normaliseQuery.js'

// FAITHFUL: `CategoryOffer` normalises before matching, so a probe calling
// `matchGroup` bare measures a function the UI no longer calls directly. That
// is the drift that made `relatedcheck` report a fixed defect for weeks and
// made `twinprobe` index the wrong Arabic labels. Compile BOTH and compose them
// the way the component does.
const matchCategory = (q) => matchGroup(normaliseQuery(q))
import { tools } from './lib/tools.mjs'
import { BENCH_QUERIES } from './benchqueries.mjs'
import { UNTUNED, NOMATCH } from './untuned.mjs'
import { UNTUNED2 } from './untuned2.mjs'
import { UNTUNED_AR } from './untunedar.mjs'

// The queries this was built for: the widest ties, plus the natural phrasings
// the category pages were written to answer ("free pdf tools").
const SHOULD_FIRE = [
  // The curated collections, each backed by a measured wide tie.
  'ramadan', 'رمضان', 'صيام', 'teacher', 'teaching', 'معلم', 'مدرسة',
  'compare', 'diff', 'مقارنة', 'قارن',
  'حاسبة', 'حاسبات', 'الحاسبة', 'calculator', 'calculators', 'free calculators',
  'image', 'images', 'photo tools', 'صور', 'صورة',
  'pdf', 'free pdf tools', 'arabic', 'عربي', 'islamic', 'إسلاميات',
  'saudi', 'السعودية', 'developer', 'مطور', 'design', 'تصميم',
  'converter', 'محول', 'generator', 'مولد', 'text', 'نصوص',
  'web', 'ويب', 'files', 'ملفات', 'business', 'أعمال',
]

let fired = 0
const missed = []
for (const q of SHOULD_FIRE) {
  const c = matchCategory(q)
  if (c) fired++
  else missed.push(q)
}
console.log(`SHOULD FIRE: ${fired}/${SHOULD_FIRE.length}`)
if (missed.length) console.log('  missed:', missed.join(', '))

const benched = [...BENCH_QUERIES, ...UNTUNED, ...UNTUNED2, ...UNTUNED_AR]
const falsePositives = []
for (const [q, want] of benched) {
  const c = matchCategory(q)
  if (c) falsePositives.push(`${q}  ->  ${c}   (meant ${want})`)
}
console.log(`\nBENCHED QUERIES (${benched.length}, each naming ONE tool): ${falsePositives.length} fired`)
for (const f of falsePositives) console.log('  !', f)

// A tool's own name must never be answered with a category — that is the
// `ownname` discipline applied to this layer.
const nameHits = []
for (const t of tools) {
  for (const n of [t.name, t.nameAr].filter(Boolean)) {
    const c = matchCategory(n)
    if (c) nameHits.push(`${t.id}  "${n}"  ->  ${c}`)
  }
}
console.log(`\nTOOL NAMES (${tools.length} tools): ${nameHits.length} fired`)
for (const h of nameHits) console.log('  !', h)

const nomatch = NOMATCH.filter((q) => matchCategory(q))
console.log(`\nUNANSWERABLE QUERIES: ${nomatch.length} fired${nomatch.length ? ' — ' + nomatch.join(', ') : ''}`)
