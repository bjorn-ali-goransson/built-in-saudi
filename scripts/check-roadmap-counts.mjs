// docs/ROADMAP.md must not lie about the size of the catalogue.
//
//   node scripts/check-roadmap-counts.mjs   (also runs in prebuild)
//
// The roadmap opens by saying it was reorganised BECAUSE it had gone stale —
// "it listed shipped tools as unbuilt ideas" — and then went stale again in the
// same way, quietly, because nothing read it. Its header said **186 tools are
// live** against a registry of 239, and its table still named `Calculators` at
// 18 and `Saudi / Local` at 27 after both had been split, so it listed
// categories that no longer exist and undercounted the ones that do.
//
// That is the `check-tool-docs.mjs` failure one file over, and it is catchable
// by the same kind of grep. The header total and the table's counts are
// STRUCTURED — a number in a sentence and a number in a column — so they can be
// checked. The "shape of it" prose beside them cannot be, and is not: a guard
// that pretended to check prose would be asserting a requirement nobody
// verified, which is just a wrong test.
//
// Deliberately NOT a measurement. `evals/catalogshape.mjs` reports the same
// numbers and cannot fail, because what counts as a category too big is an
// editorial judgement. Whether a printed number equals the registry's is not a
// judgement at all.

import { readFileSync } from 'node:fs'
import path from 'node:path'

const root = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
const file = path.join(root, 'docs/ROADMAP.md')
const src = readFileSync(file, 'utf8')

// THE SHARED LOADER. This repo has recorded five separate occasions where a
// second one reported a defect that did not exist — including once inside a
// `scripts/` guard, which is the case this file would otherwise be.
const { tools } = await import('../evals/lib/tools.mjs')

const problems = []

// --- the header sentence ---------------------------------------------------
const header = /\*\*(\d+) tools are live\.\*\*/.exec(src)
if (!header) {
  problems.push('the header no longer says "**N tools are live.**" — the guard cannot find the number it exists to check')
} else if (Number(header[1]) !== tools.length) {
  problems.push(`the header says ${header[1]} tools are live; the registry has ${tools.length}`)
}

// --- the "What is live" table ----------------------------------------------
const start = src.indexOf('## What is live')
const table = start === -1 ? '' : src.slice(start, src.indexOf('\n## ', start + 1))
const rows = [...table.matchAll(/^\| ([^|]+?) \| (\d+) \|/gm)].map((m) => [m[1].trim(), Number(m[2])])
if (!rows.length) {
  problems.push('the "What is live" table has no countable rows — it is the thing this guard checks')
}

const actual = new Map()
for (const t of tools) actual.set(t.filed, (actual.get(t.filed) ?? 0) + 1)

const listed = new Set()
for (const [cat, n] of rows) {
  listed.add(cat)
  if (!actual.has(cat)) {
    problems.push(`the table lists a category "${cat}" that no tool is filed under — it was renamed or split`)
  } else if (actual.get(cat) !== n) {
    problems.push(`the table says ${cat} has ${n}; the registry has ${actual.get(cat)}`)
  }
}
for (const cat of actual.keys()) {
  if (!listed.has(cat)) problems.push(`the table is missing the category "${cat}" (${actual.get(cat)} tools)`)
}

if (problems.length) {
  console.error('docs/ROADMAP.md disagrees with the registry:\n')
  for (const p of problems) console.error(`  - ${p}`)
  console.error('\nRun `node evals/catalogshape.mjs` for the real numbers, and update the header and table.')
  process.exit(1)
}
console.log(`check-roadmap-counts: ${tools.length} live tools across ${actual.size} categories, and the roadmap says so.`)
