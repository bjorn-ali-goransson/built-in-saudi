// Which ROLES already have a number, and which do not?
//
//   node evals/roleimpact.mjs
//
// No API key needed. This is the join the other two harnesses do not make.
//
// `quantified.mjs` says 10.4% of claim-like lines carry a figure, CV-wide.
// `roles.mjs` says a CV has 4.4 dated positions and 13/32 have more than four.
// From those two the recorded next experiment was "scale the improve loop's
// question budget with the role count". That assumes the budget is the binding
// constraint. It may not be: if a good share of roles ALREADY carry a figure,
// then a loop that asks for "a headline number per role" is spending questions
// re-asking about roles that do not need one, and the fix is to TARGET the
// budget rather than to enlarge it — a cheaper change with no extra burden on
// the candidate, who is the one who has to answer.
//
// Both readings are consistent with everything measured so far, they imply
// different work, and the difference is a property of the input. So it is
// decidable here, before spending a single judged run on it.
import { readdir, readFile } from 'node:fs/promises'
import { pdfToText } from './lib/extract.mjs'
import { isRoleLine, isClaim, hasFigure } from './lib/cvfacts.mjs'

const BUDGET = 4 // what the improve loop asks today (measured at 4.1)

const dir = new URL('./cvs/', import.meta.url)
let files = []
try {
  files = (await readdir(dir)).filter((f) => /\.pdf$/i.test(f))
} catch { /* no corpus */ }
if (!files.length) {
  console.log('No CVs in evals/cvs — this measurement needs the real corpus.')
  process.exit(0)
}

const rows = []
for (const name of files) {
  let text
  try {
    text = await pdfToText(new Uint8Array(await readFile(new URL(name, dir))))
  } catch { continue }

  // Segment into role blocks: a dated non-study line opens a block, and the
  // block runs to the next one. Everything before the first is the header and
  // summary, which belongs to no role.
  const lines = text.split('\n')
  const roles = []
  let cur = null
  for (const line of lines) {
    if (isRoleLine(line)) {
      cur = { head: line.trim(), claims: 0, figures: 0 }
      roles.push(cur)
      // The heading line itself can carry the figure ("Sales Manager, 12
      // reports"), so it is examined rather than skipped.
    }
    if (!cur) continue
    if (!isClaim(line)) continue
    cur.claims += 1
    if (hasFigure(line)) cur.figures += 1
  }
  rows.push({ name, roles })
}

const all = rows.flatMap((r) => r.roles)
const withFig = all.filter((r) => r.figures > 0)
const without = all.filter((r) => r.figures === 0)
// A role with no claim-like lines under it at all is a bare listing, not a role
// whose bullets lack numbers — worth separating, since asking about it is a
// different (and probably worse) proposition.
const bare = without.filter((r) => r.claims === 0)

const pct = (n, d) => (d ? Math.round((n / d) * 1000) / 10 : 0)

console.log(`CVs read: ${rows.length}`)
console.log(`roles found: ${all.length}  (mean ${Math.round((all.length / rows.length) * 10) / 10} per CV)`)
console.log(`  already carry a figure: ${withFig.length}  (${pct(withFig.length, all.length)}%)`)
console.log(`  carry none:             ${without.length}  (${pct(without.length, all.length)}%)`)
console.log(`     of which have no claim-like lines at all: ${bare.length}`)

// The decision. Under today's fixed budget, how many of the roles that NEED a
// number actually get asked about?
let naiveCovered = 0
let targetedCovered = 0
let needTotal = 0
let cvsFullyCoveredNaive = 0
let cvsFullyCoveredTargeted = 0
for (const r of rows) {
  const need = r.roles.filter((x) => x.figures === 0)
  needTotal += need.length
  // Naive: ask about the first BUDGET roles in order, whatever they contain.
  const naive = r.roles.slice(0, BUDGET).filter((x) => x.figures === 0).length
  // Targeted: spend the same budget only on roles that lack a figure.
  const targeted = Math.min(need.length, BUDGET)
  naiveCovered += naive
  targetedCovered += targeted
  if (naive >= need.length) cvsFullyCoveredNaive += 1
  if (targeted >= need.length) cvsFullyCoveredTargeted += 1
}

console.log(`\nUnder the current ${BUDGET}-question budget:`)
console.log(`  roles needing a number: ${needTotal}`)
console.log(`  asked about, in CV order (today):  ${naiveCovered}  (${pct(naiveCovered, needTotal)}%)`)
console.log(`  asked about, if targeted at them:  ${targetedCovered}  (${pct(targetedCovered, needTotal)}%)`)
console.log(`  CVs whose every unquantified role is covered — today ${cvsFullyCoveredNaive}/${rows.length}, targeted ${cvsFullyCoveredTargeted}/${rows.length}`)

const gainTargeted = targetedCovered - naiveCovered
console.log(`\n=> Targeting the SAME budget reaches ${gainTargeted} more roles (${pct(gainTargeted, needTotal)}pp).`)
console.log(`=> Raising the budget could reach at most ${needTotal - targetedCovered} beyond that,`)
console.log(`   and only by asking candidates more questions than they answer today.`)
