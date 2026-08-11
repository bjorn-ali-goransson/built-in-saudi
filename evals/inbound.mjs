// Which tools does nothing POINT AT?
//
// `relatedcheck.mjs` asked the outgoing question — how many tools show no
// related row — and drove it from 81 to 0. The incoming question was never
// asked, and it is the one that matters for discovery: a tool with no inbound
// edge is reachable only by searching for it or by scrolling to its category.
// Everything else on this site is a graph, and an orphan in it is a page you
// can only find if you already know it exists.
//
// Uses the REAL selection function (`src/lib/relatedPick.ts`, compiled), for
// the reason `relatedcheck` records: a copy of the logic drifted and went on
// reporting a fixed defect for weeks.
//
// Run: npx tsc src/lib/relatedPick.ts src/lib/fuzzy.ts --outDir evals/gen \
//        --module esnext --target es2022 --moduleResolution bundler
//      node evals/inbound.mjs

import { readFileSync, readdirSync } from 'node:fs'
import { pickRelated } from './gen/relatedPick.js'
import { tools } from './lib/tools.mjs'

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')

const inbound = new Map(tools.map((t) => [t.id, 0]))
const bump = (id) => { if (inbound.has(id)) inbound.set(id, inbound.get(id) + 1) }

// 1. The related row rendered at the foot of every tool page.
for (const t of tools) for (const r of pickRelated(t, tools)) bump(r.id)

// 2. Curated collections, and 3. the Recommended / Duʿāʾ lists.
for (const f of ['src/lib/collections.ts', 'src/lib/toolSections.ts']) {
  const src = readFileSync(`${ROOT}/${f}`, 'utf8')
  for (const m of src.matchAll(/'([a-z0-9-]+)'/g)) bump(m[1])
}

// 4. A hand-written link from one tool's own UI to another — the "going the
//    other way" and "instead of this" rows. Read from source, because the
//    loader exposes the meta and not the component.
const srcParts = []
const walk = (dir) => {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const full = `${dir}/${e.name}`
    if (e.isDirectory()) { walk(full); continue }
    if (/\.tsx?$/.test(e.name)) srcParts.push(readFileSync(full, 'utf8'))
  }
}
walk(`${ROOT}/src/tools`)
walk(`${ROOT}/src/components`)
const srcAll = srcParts.join('\n')
for (const m of srcAll.matchAll(/\/apps\/([a-z0-9-]+)/g)) bump(m[1])

// Two tools in one category showing the SAME four suggestions is the visible
// form of the pile-up: under straight catalogue order every tool filled from
// the top of its category, so 79 pairs were identical and the tail of each
// category was pointed at by nothing.
const rowOf = new Map(tools.map((t) => [t.id, pickRelated(t, tools).map((x) => x.id).join(',')]))
const byCat = new Map()
for (const t of tools) {
  if (!byCat.has(t.category)) byCat.set(t.category, [])
  byCat.get(t.category).push(t)
}
let identical = 0
for (const [, list] of byCat) {
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      if (rowOf.get(list[i].id) === rowOf.get(list[j].id)) identical++
    }
  }
}

const rows = [...inbound.entries()].sort((a, b) => a[1] - b[1])
const orphans = rows.filter(([, n]) => n === 0)

console.log(`tools tools: ${tools.length}`)
console.log(`pointed at by NO related row, collection, curated list or tool link: ${orphans.length}\n`)
for (const [id] of orphans) console.log('  ' + id)

const counts = rows.map(([, n]) => n).sort((a, b) => a - b)
console.log(`\nmedian inbound links: ${counts[Math.floor(counts.length / 2)]}`)
console.log(`pairs in one category showing an IDENTICAL row: ${identical}`)
console.log(`most linked-to: ${rows.slice(-5).reverse().map(([id, n]) => `${id}(${n})`).join(', ')}`)
