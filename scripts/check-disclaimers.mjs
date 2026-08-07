// The disclaimer guard was circular, so this closes half of the loop.
//
// `e2e/disclaimers.spec.ts` asserts that every tool ON ITS LIST renders a
// Disclaimer of the right kind, in both locales. That is a real guard against
// one thing (a disclaimer being deleted) and no guard at all against the thing
// it was written for: a tool that should have one and does not, because such a
// tool is simply absent from the list. The list and the source could drift
// apart indefinitely and everything stayed green.
//
// This compares the two directly:
//
//   - a tool that renders <Disclaimer kind="x"> but is missing from the spec
//     (or is listed with a different kind) — the drift that actually happened,
//     found by hand: prayer-times, invoice-generator, currency-converter and
//     vat-calculator all rendered nothing while their twins were guarded;
//   - a tool listed in the spec that no longer renders one.
//
// What NO script can decide is whether a tool that has neither *ought* to have
// one — that is the judgement the rule in CLAUDE.md describes, and it stays a
// human one. This makes the mechanical half mechanical.
//
//   node scripts/check-disclaimers.mjs

import { readdirSync, readFileSync, existsSync } from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const toolsDir = path.join(root, 'src', 'tools')

/** id -> kind, for every tool whose UI actually renders one. */
const rendered = new Map()
for (const dir of readdirSync(toolsDir)) {
  const metaPath = path.join(toolsDir, dir, 'meta.ts')
  if (!existsSync(metaPath)) continue
  const id = /id: '([^']+)'/.exec(readFileSync(metaPath, 'utf8'))?.[1]
  if (!id) continue
  for (const file of readdirSync(path.join(toolsDir, dir))) {
    if (!file.endsWith('.tsx')) continue
    const src = readFileSync(path.join(toolsDir, dir, file), 'utf8')
    const kind = /<Disclaimer\s+kind="([a-z]+)"/.exec(src)?.[1]
    if (kind) rendered.set(id, kind)
  }
}

/** id -> kind, as the e2e guard believes. */
const specSrc = readFileSync(path.join(root, 'e2e', 'disclaimers.spec.ts'), 'utf8')
const listed = new Map(
  [...specSrc.matchAll(/\{\s*id:\s*'([^']+)',\s*kind:\s*'([^']+)'\s*\}/g)].map((m) => [m[1], m[2]]),
)

const problems = []
for (const [id, kind] of rendered) {
  if (!listed.has(id)) problems.push(`${id} renders a ${kind} disclaimer but is NOT in e2e/disclaimers.spec.ts`)
  else if (listed.get(id) !== kind) problems.push(`${id} renders "${kind}" but the spec expects "${listed.get(id)}"`)
}
for (const id of listed.keys()) {
  if (!rendered.has(id)) problems.push(`${id} is in e2e/disclaimers.spec.ts but renders no Disclaimer`)
}

console.log(`tools rendering a disclaimer: ${rendered.size}`)
console.log(`tools listed in the guard:    ${listed.size}`)
if (problems.length) {
  console.error('\n' + problems.map((p) => `  ${p}`).join('\n'))
  process.exit(1)
}
console.log('in step.')
