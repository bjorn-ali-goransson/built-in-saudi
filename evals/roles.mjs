// Does the improve loop ask about every role, or only some of them?
//
//   node evals/roles.mjs
//
// The loop was changed to ask for "a headline number per role", and that lifted
// the question count from 2.6 to 4.1 — which reads like a fix. But 4.1 is only
// the right number if a CV has about four roles. If the corpus has more, the
// loop is leaving numbers on the table in exactly the dimension that blocks
// nine CVs in ten, and the fix was partial.
//
// That is checkable without a model: count the dated positions in each CV.
// A date range is the most reliable marker of a role entry across every
// template — far more so than trying to recognise job titles.

import { readdir, readFile } from 'node:fs/promises'
import { pdfToText } from './lib/extract.mjs'
// Shared with quantified.mjs and roleimpact.mjs — see evals/lib/cvfacts.mjs.
import { RANGE, STUDY } from './lib/cvfacts.mjs'

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
    text = await pdfToText(new Uint8Array(await readFile(new URL(name, dir)))) } catch { continue }
  const lines = text.split('\n')
  let dated = 0
  let study = 0
  for (const line of lines) {
    RANGE.lastIndex = 0
    if (!RANGE.test(line)) continue
    if (STUDY.test(line)) study++
    else dated++
  }
  rows.push({ dated, study })
}

const counts = rows.map((r) => r.dated).sort((a, b) => a - b)
const total = counts.reduce((a, b) => a + b, 0)
const median = counts[Math.floor(counts.length / 2)] ?? 0
const mean = Math.round((total / (counts.length || 1)) * 10) / 10

console.log(`CVs read: ${rows.length}`)
console.log(`dated positions (excluding study): mean ${mean}, median ${median}, min ${counts[0] ?? 0}, max ${counts[counts.length - 1] ?? 0}`)
console.log(`CVs with more than 4 positions: ${counts.filter((c) => c > 4).length}/${counts.length}`)
console.log(`CVs with more than 6: ${counts.filter((c) => c > 6).length}/${counts.length}`)
console.log(`study entries excluded in total: ${rows.reduce((n, r) => n + r.study, 0)}`)
console.log(`\nThe loop asks 4.1 questions on average. Positions per CV: ${mean}.`)
console.log(counts.filter((c) => c > 4).length > counts.length / 2
  ? '=> more than half the corpus has more roles than the loop asks questions.'
  : '=> the question count is in line with how many roles a CV actually has.')
