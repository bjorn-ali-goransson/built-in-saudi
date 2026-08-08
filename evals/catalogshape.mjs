// How big is each section of the catalogue, and is any of them a wall?
//
//   node evals/catalogshape.mjs
//
// Search decides whether you can find a tool you can NAME. The catalogue decides
// whether you can find one you cannot — and at 200-odd tools that is most of
// them. Its shape has been changed twice on the strength of a one-off count
// typed into a shell and then thrown away, so nobody could tell afterwards
// whether the change held or whether the section had quietly grown back.
//
// The rule this measures, from CLAUDE.md:
//   Converters   = turn a document or data FILE into another format
//   Calculators  = converting a VALUE (units, currency) is arithmetic
//   a stronger family wins — pdf-to-text stays in PDF
//
// It reports sizes, the outliers, and how far the largest is from the median.
// It has no pass/fail: what counts as too big is an editorial judgement, and a
// script that pretended otherwise would just be a threshold nobody agreed to.
import { readFileSync, readdirSync, existsSync } from 'node:fs'

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
const reg = readFileSync(`${ROOT}/src/tools/index.ts`, 'utf8')
const dirs = readdirSync(`${ROOT}/src/tools`).filter(
  (d) => existsSync(`${ROOT}/src/tools/${d}/meta.ts`) && reg.includes(`'./${d}/meta'`),
)

// Consumed by their own hand-picked sections, so they do not appear under a
// category — mirroring buildToolSections.
const RECOMMENDED = ['ats-cv-optimizer', 'book-me', 'calls', 'qr-code', 'prayer-times', 'islamic-calendar', 'qibla']
const DUA = ['istikhara', 'adhkar', 'hisn-al-muslim']
const consumed = new Set([...RECOMMENDED, ...DUA])

const byCat = new Map()
const ids = []
for (const d of dirs) {
  const src = readFileSync(`${ROOT}/src/tools/${d}/meta.ts`, 'utf8')
    .split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n')
  if (/status: 'coming-soon'/.test(src)) continue
  const id = /id: '([^']+)'/.exec(src)?.[1]
  const cat = /category: '([^']+)'/.exec(src)?.[1]
  if (!id || !cat) continue
  ids.push(id)
  if (consumed.has(id)) continue
  if (!byCat.has(cat)) byCat.set(cat, [])
  byCat.get(cat).push(id)
}

const rows = [...byCat.entries()].map(([cat, list]) => ({ cat, n: list.length, list }))
rows.sort((a, b) => b.n - a.n)
const sizes = rows.map((r) => r.n).sort((a, b) => a - b)
const median = sizes[Math.floor(sizes.length / 2)]

console.log(`live tools: ${ids.length}   sections: ${rows.length}   median section: ${median}`)
console.log(`(${consumed.size} are consumed by Recommended / Duʿāʾ and appear in no category)\n`)
for (const r of rows) {
  const bar = '#'.repeat(Math.round(r.n / 2))
  const flag = r.n >= median * 2 ? '  <- more than twice the median' : ''
  console.log(`  ${r.cat.padEnd(14)} ${String(r.n).padStart(3)}  ${bar}${flag}`)
}

const biggest = rows[0]
console.log(`\nlargest: ${biggest.cat} at ${biggest.n}, ${(biggest.n / median).toFixed(1)}x the median`)
if (process.argv.includes('--list')) {
  for (const r of rows) console.log(`\n${r.cat}:\n  ${r.list.join(', ')}`)
}
