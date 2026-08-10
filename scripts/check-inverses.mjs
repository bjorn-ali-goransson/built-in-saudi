// A declared inverse must be reciprocal.
//
// `Tool.inverse` exists so `evals/directions.mjs` can check that each half of a
// converter pair wins its OWN direction — the scorer discards word order by
// design, so whichever NAME contains both nouns wins at triple weight, which
// has nothing to do with which tool is right. That failure was found four times
// one query at a time before it became measurable.
//
// A one-sided declaration is worse than none: the instrument would check one
// direction, report a clean number, and never look at the other. So if A says
// its inverse is B, B must say A.
//
// Run automatically from `prebuild`. Verified to fail by deleting one side.

import { readFileSync, readdirSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const byId = new Map()
for (const dir of readdirSync(path.join(ROOT, 'src/tools'))) {
  const meta = path.join(ROOT, 'src/tools', dir, 'meta.ts')
  if (!existsSync(meta)) continue
  const raw = readFileSync(meta, 'utf8')
  // Comment-stripped, so the doc comment in types.ts — or a note in a meta —
  // cannot be read as a declaration.
  const src = raw.split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n')
  const id = /\bid: '([^']+)'/.exec(src)?.[1]
  if (!id) continue
  byId.set(id, {
    dir,
    inverse: /\binverse: '([a-z0-9-]+)'/.exec(src)?.[1],
    comingSoon: /status: 'coming-soon'/.test(src),
  })
}

if (!byId.size) {
  console.error('check-inverses: found no tools at all — the sweep is broken')
  process.exit(1)
}

const problems = []
let declared = 0
for (const [id, t] of byId) {
  if (!t.inverse) continue
  declared++
  if (t.inverse === id) { problems.push(`${id}: declares itself as its own inverse`); continue }
  const other = byId.get(t.inverse)
  if (!other) { problems.push(`${id}: inverse '${t.inverse}' is not a tool`); continue }
  if (other.comingSoon) { problems.push(`${id}: inverse '${t.inverse}' has not shipped`); continue }
  if (other.inverse !== id) {
    problems.push(
      `${id}: says its inverse is '${t.inverse}', but '${t.inverse}' says `
      + `'${other.inverse ?? 'nothing'}'. A one-sided pair is checked in one `
      + 'direction and silently unchecked in the other.',
    )
  }
}

if (problems.length) {
  console.error('check-inverses: problems found:')
  for (const p of problems) console.error(`  ${p}`)
  process.exit(1)
}
console.log(`check-inverses: ${declared} declarations, every one reciprocal.`)
