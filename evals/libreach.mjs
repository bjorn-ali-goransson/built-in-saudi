#!/usr/bin/env node
/**
 * How far does each shared capability actually REACH?
 *
 * `src/lib/` is where this site keeps the things more than one tool needs. A
 * module in there with exactly ONE caller is not necessarily wrong — but it is
 * the shape of a capability nobody noticed was general, and it has now found
 * two real ones by hand:
 *
 * - **`lib/ics.ts`** wrote a calendar file for the calendar builder and for
 *   nothing else, while at least six tools computed a date somebody needs
 *   reminding of. It has eight callers now.
 * - **`lib/wordDiff.ts`** was written for `pdf-diff` and documented there as
 *   the whole point, while the site's PRIMARY text comparison tool carried a
 *   byte-identical copy of the same LCS and highlighted whole LINES. Measured
 *   afterwards: the line answer over-reported by 4.4x.
 *
 * Found twice by accident is this repo's threshold for building the instrument
 * rather than relying on somebody noticing a third time.
 *
 * It is a MEASUREMENT, not a gate. One caller is a question, not a defect: a
 * module can be extracted for testability alone (`relatedPick.ts`, `cvPatch.ts`
 * are imported by production once and by a harness that could not otherwise
 * reach them), and that is a good reason to be there.
 *
 *   node evals/libreach.mjs
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve, relative } from 'node:path'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/** Every source file under a directory, recursively. */
function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = `${dir}/${name}`
    if (statSync(full).isDirectory()) walk(full, out)
    else if (/[.](ts|tsx)$/.test(name)) out.push(full)
  }
  return out
}

const files = [
  ...walk(`${ROOT}/src`),
  // The prerender plugin lives OUTSIDE src/ and imports from it. A sweep that
  // cannot see a caller invents a defect — `deadexports` learned this by
  // reporting `staticPageSeo` dead while vite.config.ts imported it.
  `${ROOT}/vite.config.ts`,
].filter((f) => {
  try { return statSync(f).isFile() } catch { return false }
})

const libDir = `${ROOT}/src/lib`
const modules = readdirSync(libDir)
  .filter((n) => /[.](ts|tsx)$/.test(n))
  .map((n) => n.replace(/[.](ts|tsx)$/, ''))

// Who imports what. Resolve by the specifier's BASENAME rather than by path
// arithmetic: every lib module has a unique file name, so `../../lib/zip` and
// `./zip` land on the same entry without a resolver to get wrong.
const callers = new Map(modules.map((m) => [m, new Set()]))

for (const file of files) {
  const src = readFileSync(file, 'utf8')
  const here = relative(ROOT, file).replace(/\\/g, '/')
  // A module never counts as its own caller.
  const self = here.startsWith('src/lib/') ? here.slice(8).replace(/[.](ts|tsx)$/, '') : null
  for (const m of src.matchAll(/from\s+['"]([^'"]+)['"]/g)) {
    const spec = m[1]
    if (!spec.includes('lib/') && !here.startsWith('src/lib/')) continue
    const base = spec.split('/').pop()
    if (!base || base === self) continue
    const hit = callers.get(base)
    // Only count a specifier that really points into lib/: a relative import
    // from inside lib/ does, and anything naming the directory does.
    if (!hit) continue
    if (!spec.includes('lib/') && !here.startsWith('src/lib/')) continue
    hit.add(here)
  }
}

const rows = [...callers.entries()]
  .map(([m, set]) => ({ module: m, n: set.size, who: [...set] }))
  .sort((a, b) => a.n - b.n || a.module.localeCompare(b.module))

const worker = (m) => /[.]worker$/.test(m)
const lonely = rows.filter((r) => r.n <= 1 && !worker(r.module))

console.log(`lib modules: ${rows.length}   reached by exactly one file: ${lonely.length}`)
console.log('')
console.log('one caller — a capability nobody noticed was general, or an extraction for testability')
console.log('')
for (const r of lonely) {
  console.log(`  ${r.module.padEnd(22)} ${r.n === 0 ? '(no caller at all)' : r.who[0]}`)
}

const spread = rows.filter((r) => r.n >= 2)
const median = spread.length ? spread[Math.floor(spread.length / 2)].n : 0
console.log('')
console.log(`for scale: ${spread.length} modules have two or more callers, median ${median}`)
console.log('')
console.log('most-reached:')
for (const r of [...rows].sort((a, b) => b.n - a.n).slice(0, 6)) {
  console.log(`  ${r.module.padEnd(22)} ${r.n}`)
}
