// Which testids does the product expose that NO spec ever drives?
//
// `coverageshape.mjs` asks how much is asserted about a tool relative to how
// big it is. This asks the inverse and sharper question: a `data-testid` is put
// there to be driven, so one that nothing references is a control, a state or a
// panel that has never been exercised. That is where a half-wired feature hides
// — the `buildEmail` case, where the QR tool's email fields were written,
// translated, and never connected to anything, sat exactly like this.
//
// It is a MEASUREMENT, not a gate. A testid can legitimately exist for a state
// that is hard to reach, and some are used as CSS hooks. The number is a place
// to look.
//
// Run: node evals/untested-ui.mjs

import { readdirSync, readFileSync, existsSync } from 'node:fs'

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')

const specText = readdirSync(`${ROOT}/e2e`)
  .filter((f) => f.endsWith('.ts'))
  .map((f) => readFileSync(`${ROOT}/e2e/${f}`, 'utf8'))
  .join('\n')

// A testid may be written as a literal or built from a template, e.g.
// `prow-${it.key}`. A templated one is counted as covered when the spec
// references its literal prefix, since that is how the specs drive them.
const LITERAL = /data-testid=["'`]([a-z0-9-]+)["'`]/g
const TEMPLATE = /data-testid=\{`([a-z0-9-]+)-\$\{/g

const rows = []
for (const dir of readdirSync(`${ROOT}/src/tools`)) {
  const metaPath = `${ROOT}/src/tools/${dir}/meta.ts`
  if (!existsSync(metaPath)) continue
  const meta = readFileSync(metaPath, 'utf8')
  const id = /\bid: '([^']+)'/.exec(meta)?.[1]
  if (!id || /status: 'coming-soon'/.test(meta)) continue

  const ids = new Set()
  const prefixes = new Set()
  const walk = (p) => {
    for (const e of readdirSync(p, { withFileTypes: true })) {
      const full = `${p}/${e.name}`
      if (e.isDirectory()) { walk(full); continue }
      if (!/\.tsx?$/.test(e.name)) continue
      const src = readFileSync(full, 'utf8')
      for (const m of src.matchAll(LITERAL)) ids.add(m[1])
      for (const m of src.matchAll(TEMPLATE)) prefixes.add(m[1])
    }
  }
  walk(`${ROOT}/src/tools/${dir}`)

  const untested = [...ids].filter((t) => !specText.includes(t))
  const untestedPrefixes = [...prefixes].filter((t) => !specText.includes(t))
  const total = ids.size + prefixes.size
  if (!total) continue
  rows.push({
    id,
    total,
    untested: untested.length + untestedPrefixes.length,
    names: [...untested, ...untestedPrefixes.map((p) => p + '-*')],
  })
}

rows.sort((a, b) => b.untested - a.untested || b.total - a.total)

const totalIds = rows.reduce((a, r) => a + r.total, 0)
const totalUntested = rows.reduce((a, r) => a + r.untested, 0)
console.log(`live tools with testids: ${rows.length}`)
console.log(`testids exposed: ${totalIds}   never referenced by a spec: ${totalUntested}` +
  ` (${Math.round((totalUntested / totalIds) * 100)}%)\n`)

console.log('most undriven surface first\n')
console.log('tool'.padEnd(24), 'ids'.padStart(4), 'undriven'.padStart(9))
for (const r of rows.slice(0, 18)) {
  if (!r.untested) break
  console.log(r.id.padEnd(24), String(r.total).padStart(4), String(r.untested).padStart(9),
    '  ' + r.names.slice(0, 6).join(', '))
}
