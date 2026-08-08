// How many numbers are actually in the CVs people upload?
//
//   node evals/quantified.mjs
//
// `impact` is the dimension blocking 9 of 10 CVs, and it grades how many
// bullets carry a concrete figure. The standing claim in CLAUDE.md is that the
// remaining points are "the candidate's facts, not our wording" — which is a
// claim about the INPUT, and therefore measurable without asking a model
// anything. It has only ever been inferred from judged runs.
//
// This counts, over the real corpus, what share of experience-like lines carry
// a figure at all. It cannot tell you what `impact` would score; it can tell you
// how much raw material exists to score, which is the thing the improve loop is
// trying to extract more of.
//
// Deliberately conservative about what counts as a figure: a bare year is not
// an achievement, and neither is a phone number.

import { readdir, readFile } from 'node:fs/promises'
import { pdfToText } from './lib/extract.mjs'
// Shared with roles.mjs and roleimpact.mjs — see evals/lib/cvfacts.mjs.
import { isClaim, hasFigure } from './lib/cvfacts.mjs'

const dir = new URL('./cvs/', import.meta.url)
const files = (await readdir(dir)).filter((f) => /\.pdf$/i.test(f))
if (!files.length) {
  console.log('No CVs in evals/cvs — nothing to measure.')
  process.exit(0)
}

const rows = []
for (const name of files) {
  let text
  try {
    text = await pdfToText(new Uint8Array(await readFile(new URL(name, dir))))
  } catch { continue }
  const lines = text.split('\n').filter(isClaim)
  const withFigure = lines.filter(hasFigure)
  if (lines.length) rows.push({ lines: lines.length, figures: withFigure.length })
}

const pct = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : 0)
const totalLines = rows.reduce((n, r) => n + r.lines, 0)
const totalFigures = rows.reduce((n, r) => n + r.figures, 0)
const shares = rows.map((r) => pct(r.figures, r.lines)).sort((a, b) => a - b)
const median = shares[Math.floor(shares.length / 2)] ?? 0

console.log(`CVs read: ${rows.length} of ${files.length}`)
console.log(`claim-like lines: ${totalLines}`)
console.log(`lines carrying a figure: ${totalFigures}  (${pct(totalFigures, totalLines)}% of all lines)`)
console.log(`per-CV share — min ${shares[0] ?? 0}%  median ${median}%  max ${shares[shares.length - 1] ?? 0}%`)
console.log(`CVs where fewer than 1 line in 5 carries a figure: ${shares.filter((s) => s < 20).length}/${rows.length}`)
console.log(`CVs where fewer than 1 line in 10 does: ${shares.filter((s) => s < 10).length}/${rows.length}`)
