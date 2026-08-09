// Does every tool still win a search for its OWN NAME?
//
// Four times now a new tool has taken a query off an established one —
// `image-diff` off `text-diff`, `pdf-ocr` off `image-to-text`, `xlsx-convert`
// off `csv-to-xlsx`, and `timesheet` off `leave-overtime`. Every one was caught
// because that exact query happened to be in a bench. Nothing checked the
// general case, and the benches cannot: they hold 272 queries against 213
// tools, so most tools have no row of their own.
//
// This is the cheapest general version, and it is mechanical: **a tool that
// cannot win a search for its own name is not findable by the one thing
// everybody knows about it.** It needs no hand-written expectations, so it
// cannot go stale, and it grows with the catalogue automatically.
//
// What it does NOT cover, stated plainly: a contested phrase that is nobody's
// name. `overtime pay` is exactly that, and only the tuned bench caught it. A
// name is the strongest single query per tool, not every query about it.
//
// It is a MEASUREMENT, not a gate. A near-miss between a converter and its
// inverse can be legitimately ambiguous — "Markdown to Word" and "Word to
// Markdown" share every word — so the output is read, not asserted.
import { tools } from './lib/tools.mjs'
import { scoreTool } from './gen/fuzzy.js'

function rank(query, id) {
  const scored = tools
    .map((t) => ({ id: t.id, score: scoreTool(query, t) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
  const at = scored.findIndex((x) => x.id === id)
  return { at: at < 0 ? Infinity : at + 1, top: scored.slice(0, 3) }
}

export function ownNameReport() {
  let first = 0
  const losses = []
  for (const t of tools) {
    for (const [label, query] of [['en', t.name], ['ar', t.nameAr]]) {
      if (!query) continue
      const r = rank(query, t.id)
      if (r.at === 1) { first++; continue }
      losses.push({
        id: t.id,
        label,
        query,
        at: r.at,
        beaten: r.top.filter((x) => x.id !== t.id).slice(0, 2)
          .map((x) => `${x.id}(${x.score.toFixed(0)})`).join(', '),
      })
    }
  }

  const checked = first + losses.length
  console.log(`names checked: ${checked}   wins its own name: ${first} (${Math.round((first / checked) * 100)}%)`)
  if (!losses.length) {
    console.log('  no tool loses its own name')
    return losses
  }
  for (const l of losses.sort((a, b) => a.at - b.at)) {
    console.log(`  ${l.id.padEnd(22)} ${l.label}  "${l.query}"  rank ${l.at === Infinity ? 'NOT FOUND' : l.at}  beaten by ${l.beaten}`)
  }
  return losses
}

// Runnable on its own; also called at the end of `searchbench.mjs`, so it is
// seen exactly when somebody is touching search rather than being a second
// thing to remember.
if (process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('evals/ownname.mjs')) {
  ownNameReport()
}
