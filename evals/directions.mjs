// Does a converter win its OWN direction?
//
// This site names converters "X to Y" — there are 25 of them — and the scorer
// **discards word order on purpose**, so "markdown to html" and "html to
// markdown" are the same query to it. Which tool wins is then decided by
// something that has nothing to do with direction: whichever NAME happens to
// contain both nouns, at triple weight.
//
// That failure has now been found FOUR times, one query at a time, and only
// ever because somebody happened to probe it:
//
//   vcard-to-csv        lost "contacts to spreadsheet" to its inverse
//   markdown-html       took "html to markdown" from paste-to-markdown
//   zip-create          took "open a zip" from archive-inspector
//   print-size          took «تصغير حجم الصورة» from image-compressor
//
// A defect found four times by accident wants an instrument. This one needs no
// hand-written expectations — the pairs are DERIVED from the names, so it
// cannot go stale and it grows with the catalogue, the same arrangement as
// `ownname.mjs`.
//
// Run: node evals/directions.mjs
//   (needs: npx tsc src/lib/fuzzy.ts --outDir evals/gen --module esnext
//    --target es2022 --moduleResolution bundler)

import { tools } from './lib/tools.mjs'
import { scoreTool, aboveFloor } from './gen/fuzzy.js'

const rank = (q) =>
  aboveFloor(
    tools.map((t) => ({ t, score: scoreTool(q, t) }))
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score),
    (r) => r.score,
  )

/** "Image to Text (OCR)" -> { from: 'image', to: 'text' } */
function split(name) {
  const clean = name.replace(/\s*\([^)]*\)\s*/g, ' ').trim()
  const m = /^(.+?)\s+to\s+(.+)$/i.exec(clean)
  if (!m) return null
  const from = m[1].trim().toLowerCase()
  const to = m[2].trim().toLowerCase()
  // "Do I Need to Register for VAT?" is a question, not a conversion.
  if (!from || !to || /\?$/.test(clean) || from.split(/\s+/).length > 3) return null
  return { from, to }
}

const pairs = []
for (const t of tools) {
  const p = split(t.name || '')
  if (p) pairs.push({ id: t.id, name: t.name, ...p })
}

const byId = new Map(tools.map((t) => [t.id, t]))

/**
 * The tool that does the opposite conversion.
 *
 * The DECLARED inverse first, because the naming does not carry it —
 * `paste-to-markdown` is the inverse of `markdown-html` and neither name says
 * so, which is exactly the pair that was broken and invisible to a
 * name-derived pairing. Falls back to the naming for the pairs nobody has
 * declared yet.
 */
function inverseOf(p) {
  const declared = byId.get(p.id)?.inverse
  if (declared && byId.has(declared)) return { id: declared }
  return pairs.find((q) => q.id !== p.id && q.from === p.to && q.to === p.from)
}

let own = 0
let checked = 0
const ownMisses = []
const crossed = []
let crossChecked = 0

for (const p of pairs) {
  const q = `${p.from} to ${p.to}`
  const r = rank(q)
  checked++
  if (r[0]?.t.id === p.id) own++
  else ownMisses.push(`${q.padEnd(30)} want ${p.id.padEnd(20)} got ${r.slice(0, 3).map((x) => `${x.t.id}(${x.score.toFixed(0)})`).join(', ') || 'NOTHING'}`)

  // The cross check only means something where an inverse actually exists —
  // otherwise "losing the other direction" is a tool that does not exist.
  const inv = inverseOf(p)
  if (!inv) continue
  crossChecked++
  const invPair = pairs.find((q) => q.id === inv.id)
  const backQuery = invPair ? `${invPair.from} to ${invPair.to}` : `${p.to} to ${p.from}`
  const back = rank(backQuery)
  if (back[0]?.t.id !== inv.id) {
    crossed.push(`${backQuery.padEnd(30)} want ${inv.id.padEnd(20)} got ${back.slice(0, 3).map((x) => `${x.t.id}(${x.score.toFixed(0)})`).join(', ') || 'NOTHING'}`)
  }
}

console.log(`X-to-Y tools found: ${pairs.length}`)
console.log(`\nOWN DIRECTION — "<from> to <to>" must reach the tool that does it`)
console.log(`  ${own}/${checked} (${(own / checked * 100).toFixed(0)}%)`)
for (const m of ownMisses) console.log(`  ! ${m}`)

console.log(`\nOPPOSITE DIRECTION — where an inverse tool exists, it must win its own`)
console.log(`  ${crossChecked - crossed.length}/${crossChecked}`)
for (const m of crossed) console.log(`  ! ${m}`)

// Recorded rather than asserted: the scorer is order-blind BY DESIGN, so a pair
// with no inverse cannot be judged, and a genuine tie is not a defect.
const noInverse = pairs.filter((p) => !inverseOf(p)).length
console.log(`\n(${noInverse} of the ${pairs.length} have no inverse tool, so only their own direction is checkable.)`)
