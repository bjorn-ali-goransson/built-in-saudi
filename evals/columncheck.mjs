// Has the column-splitting mirror drifted from production?
//
//   npx tsc src/tools/cv-generator/columns.ts --outDir evals/gen --module esnext \
//     --target es2022 --moduleResolution bundler
//   node evals/columncheck.mjs
//
// `evals/lib/extract.mjs` carries a hand-copy of `columns.ts` under a comment
// saying "keep the two in step", which is a comment and not a guarantee. The
// eval then measures the copy while the site runs the original — the exact
// failure found twice in the search bench this week, where the harness scored
// tools with fields and a tie-break the UI does not use, and reported numbers
// nobody could act on.
//
// This runs both implementations over layouts chosen to sit either side of
// every threshold in them, and fails on any disagreement.

import { execFileSync } from 'node:child_process'
import { findGutter as mirrorGutter, columnGroups as mirrorGroups } from './lib/extract.mjs'

// Compile the production module here rather than relying on a previous build:
// a stale `evals/gen` would compare the mirror against last week's original and
// report agreement, which is worse than not checking at all.
execFileSync('npx', ['tsc', 'src/tools/cv-generator/columns.ts', '--outDir', 'evals/gen',
  '--module', 'esnext', '--target', 'es2022', '--moduleResolution', 'bundler'],
{ cwd: new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'), shell: true, stdio: 'inherit' })

const { findGutter: prodGutter, columnGroups: prodGroups } = await import('./gen/columns.js?fresh=' + Date.now())

/** A pdf.js-shaped text item at a position. */
const item = (str, x, y, width) => ({ str, transform: [1, 0, 0, 1, x, y], width })

/** A block of `n` lines in a column starting at `x`. */
const column = (x, width, n, tag) =>
  Array.from({ length: n }, (_, i) => item(`${tag}${i}`, x, 700 - i * 20, width))

const PAGE = 595

const CASES = [
  ['single column', [...column(50, 400, 12, 'a')]],
  ['two columns, wide gutter', [...column(50, 120, 10, 'l'), ...column(300, 200, 10, 'r')]],
  // 30px on a 595pt page is 5.0% — above the 4.5% floor and below anything
  // much larger. Without a case in that band, changing the threshold changes
  // no outcome and the check passes while the mirror has drifted. It did
  // exactly that on the first run.
  ['two columns, gutter just over the floor', [...column(50, 130, 10, 'l'), ...column(210, 200, 10, 'r')]],
  ['two columns, gutter just under the floor', [...column(50, 148, 10, 'l'), ...column(210, 200, 10, 'r')]],
  ['two columns, gutter too narrow', [...column(50, 190, 10, 'l'), ...column(250, 200, 10, 'r')]],
  ['two columns, too few items on the right', [...column(50, 120, 12, 'l'), ...column(300, 200, 2, 'r')]],
  ['a full-width line straddling the gap', [...column(50, 120, 10, 'l'), ...column(300, 200, 10, 'r'), item('banner', 40, 760, 500)]],
  ['gutter out at the margin', [...column(20, 60, 10, 'l'), ...column(110, 460, 10, 'r')]],
  ['empty', []],
  ['whitespace only', [item('   ', 50, 700, 40), item('   ', 300, 700, 40)]],
]

let bad = 0
for (const [name, items] of CASES) {
  const a = prodGutter(items, PAGE)
  const b = mirrorGutter(items, PAGE)
  const ga = prodGroups(items, PAGE).map((g) => g.length).join('/')
  const gb = mirrorGroups(items, PAGE).map((g) => g.length).join('/')
  const same = (a === b || (a != null && b != null && Math.abs(a - b) < 1e-9)) && ga === gb
  if (!same) bad++
  console.log(`${same ? 'ok  ' : 'DIFF'}  ${name.padEnd(38)} gutter prod=${a == null ? 'none' : Math.round(a)} mirror=${b == null ? 'none' : Math.round(b)}  groups ${ga} vs ${gb}`)
}

console.log(`\n${bad ? `${bad} case(s) DIFFER — the mirror has drifted from src/tools/cv-generator/columns.ts` : 'the mirror matches production.'}`)
process.exit(bad ? 1 : 0)
