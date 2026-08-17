// No live tool may be reachable from nowhere.
//
// `evals/inbound.mjs` measured this and found **31 of 231 tools (13%) pointed
// at by nothing** — no related row, no collection, no curated list, no
// hand-written link — including the entire on-device AI trio. A tool with no
// inbound edge is reachable only by searching for its name, which is the one
// thing somebody who does not know it exists cannot do.
//
// It is a GATE rather than a measurement because it has already regressed
// twice in one session. Driving it to 0 was not enough: shipping `pdf-diff`
// changed enough lexical picks to push `json-to-types` out of every row it had
// been in. **Orphanhood is a property of the whole graph, so ANY new tool can
// take it away from a tool nobody touched** — which is exactly the kind of
// silent breakage this repo turns into a build failure rather than a rule
// somebody is supposed to remember.
//
// It compiles `relatedPick.ts` itself, the way `evals/patchcheck.mjs` does:
// `evals/gen` is gitignored and a gate has to run on a clean clone.

import { mkdtempSync, readFileSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { compile } from '../evals/lib/tsc.mjs'

const root = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')

// --- the registry -----------------------------------------------------------
// The SHARED loader, not a second one. The first version of this file swept the
// metas with its own regexes and reported 13 orphans where `evals/inbound.mjs`
// reported 0 — because a slightly different reading of the keywords gives
// `pickRelated` different scores and therefore a different graph. That is the
// mistake this repo has recorded twice already (`relatedcheck`'s copy of the
// selection logic, `twinprobe`'s copy of the loader): **use the shared loader;
// do not write a second one.**
const { tools: live } = await import('../evals/lib/tools.mjs')
if (live.length < 100) {
  console.error(`check-orphans: loaded only ${live.length} tools — the loader is wrong, not the catalogue.`)
  process.exit(1)
}

// --- the real selection function --------------------------------------------
const out = mkdtempSync(path.join(tmpdir(), 'bis-orphans-'))
// `compile` also rewrites the extensionless relative specifiers tsc emits
// verbatim (`./fuzzy`), which Node ESM will not resolve. Shared rather than
// inlined here: the same trap was patched three different ways, and the two
// hardcoded `./fuzzy` rewrites would have missed the next import to appear.
compile(root, [`${root}/src/lib/relatedPick.ts`, `${root}/src/lib/fuzzy.ts`], out)
const compiled = `${out}/relatedPick.js`
const { pickRelated } = await import(`file://${compiled}`)

// --- every edge in the graph -------------------------------------------------
const inbound = new Map(live.map((t) => [t.id, 0]))
const bump = (id) => { if (inbound.has(id)) inbound.set(id, inbound.get(id) + 1) }

for (const t of live) for (const r of pickRelated(t, live)) bump(r.id)

for (const f of ['src/lib/collections.ts', 'src/lib/toolSections.ts']) {
  for (const m of readFileSync(`${root}/${f}`, 'utf8').matchAll(/'([a-z0-9-]+)'/g)) bump(m[1])
}

const srcParts = []
const walk = (dir) => {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const full = `${dir}/${e.name}`
    if (e.isDirectory()) { walk(full); continue }
    if (/\.tsx?$/.test(e.name)) srcParts.push(readFileSync(full, 'utf8'))
  }
}
walk(`${root}/src/tools`)
walk(`${root}/src/components`)
for (const m of srcParts.join('\n').matchAll(/\/apps\/([a-z0-9-]+)/g)) bump(m[1])

const orphans = [...inbound.entries()].filter(([, n]) => n === 0).map(([id]) => id)
if (orphans.length) {
  console.error(`check-orphans: ${orphans.length} live tool(s) are pointed at by NOTHING:\n`)
  for (const id of orphans) console.error(`  ${id}`)
  console.error(`
Each is reachable only by searching for its name. Add it to a CLUSTER in
src/lib/relatedPick.ts alongside the family it belongs to — and note that a
cluster is SYMMETRIC, so check you have not displaced a neighbour's best
suggestion. \`node evals/inbound.mjs\` prints the whole distribution.`)
  process.exit(1)
}

console.log(`check-orphans: all ${live.length} live tools are pointed at by something.`)
