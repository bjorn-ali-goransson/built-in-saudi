// How many tool pages are dead ends?
//
//   node evals/relatedcheck.mjs [--list]
//
// Every tool page carries a "related tools" row, deliberately short: the
// crawlable block below it already links to all 200-odd, which is right for a
// search engine and useless for a person. The row is curated clusters first,
// then the scorer above a measured threshold — and it shows NOTHING rather than
// padding with something arbitrary.
//
// "Nothing" is the right answer to a bad suggestion and the wrong answer to a
// page. A tool with no row is a place the catalogue leads you to and cannot
// lead you out of, except back to the search box. That number was never
// measured after the threshold was set, and roughly twenty tools have been
// added since.
//
// This mirrors `relatedTools` rather than importing it, because the real one
// pulls in `../tools` and therefore every React component on the site.
import { readFileSync, readdirSync, existsSync, writeFileSync } from 'node:fs'
import { scoreTool } from './gen/fuzzy.js'

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
const reg = readFileSync(`${ROOT}/src/tools/index.ts`, 'utf8')
const dirs = readdirSync(`${ROOT}/src/tools`).filter(
  (d) => existsSync(`${ROOT}/src/tools/${d}/meta.ts`) && reg.includes(`'./${d}/meta'`),
)

const AR_CATEGORY = {
  Generators: 'مولّدات', Images: 'صور', Design: 'تصميم', Converters: 'محوّلات',
  Developer: 'أدوات المطوّرين', Web: 'الويب', Text: 'نصوص', Calculators: 'حاسبات',
  PDF: 'PDF', Business: 'أعمال', Communication: 'تواصل', Files: 'ملفات',
  Utilities: 'أدوات', 'Saudi / Local': 'أدوات سعودية', Islamic: 'إسلاميات', Arabic: 'العربية',
}

const tools = []
for (const d of dirs) {
  const src = readFileSync(`${ROOT}/src/tools/${d}/meta.ts`, 'utf8')
    .split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n')
  if (/status: 'coming-soon'/.test(src)) continue
  const pick = (k) => (new RegExp(`${k}: '((?:[^'\\\\]|\\\\.)*)'`).exec(src)?.[1] ?? '')
  const kwBlock = /keywords: \[([\s\S]*?)\]/.exec(src)?.[1] ?? ''
  const arBlock = /ar:\s*\{([\s\S]*?)\n  \}/.exec(src)?.[1] ?? ''
  const arPick = (k) => (new RegExp(`${k}:\\s*'((?:[^'\\\\]|\\\\.)*)'`).exec(arBlock)?.[1] ?? '')
  const category = pick('category')
  tools.push({
    id: pick('id'),
    name: pick('name'),
    nameAr: arPick('name') || pick('nameAr'),
    tagline: `${arPick('tagline')} ${pick('tagline')}`.trim(),
    category: `${AR_CATEGORY[category] ?? category} ${category}`.trim(),
    keywords: [...kwBlock.matchAll(/'((?:[^'\\]|\\.)*)'/g)].map((m) => m[1]),
  })
}

// The REAL selection, compiled from src/lib/relatedPick.ts — not a copy.
//
// It used to be a copy, and the copy drifted the moment the category fill was
// added to production and not to it: this file went on reporting 77 dead ends,
// 37% of pages, long after the fix took that to 0. Anyone reading it would have
// been sent to fix what was already fixed. `relatedPick.ts` takes the tool list
// as an argument precisely so this can call it.
import { execFileSync } from 'node:child_process'
const hereDir = new URL('.', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
if (!existsSync(`${hereDir}gen/relatedPick.js`)) {
  execFileSync(process.execPath, [
    `${ROOT}/node_modules/typescript/bin/tsc`, `${ROOT}/src/lib/relatedPick.ts`,
    '--outDir', `${hereDir}gen`, '--module', 'esnext', '--target', 'es2022',
    '--moduleResolution', 'bundler',
  ], { stdio: 'inherit' })
}
// tsc emits the import specifier exactly as written — `./fuzzy` — and Node ESM
// will not resolve an extensionless path. Rewriting it here rather than putting
// `.js` extensions into the product's own imports, which would be correct ESM
// and inconsistent with every other file in src/.
{
  const out = `${hereDir}gen/relatedPick.js`
  const js = readFileSync(out, 'utf8')
  if (js.includes("from './fuzzy'")) writeFileSync(out, js.replace("from './fuzzy'", "from './fuzzy.js'"))
}
const { pickRelated, MIN_SCORE, CLUSTERS } = await import('./gen/relatedPick.js')
const threshold = MIN_SCORE
const related = (t, limit = 4) => pickRelated(t, tools, limit).map((x) => x.id)

const rows = tools.map((t) => ({ id: t.id, n: related(t).length, list: related(t) }))
const dead = rows.filter((r) => r.n === 0)
const thin = rows.filter((r) => r.n > 0 && r.n < 2)

console.log(`live tools: ${tools.length}   threshold: ${threshold}   clusters: ${CLUSTERS.length}`)
console.log(`  no related row at all: ${dead.length}  (${Math.round((dead.length / tools.length) * 100)}%)`)
console.log(`  only one suggestion:   ${thin.length}`)
console.log(`  a full row of four:    ${rows.filter((r) => r.n >= 4).length}`)

if (dead.length) {
  console.log('\nDEAD ENDS — a page the catalogue leads to and cannot lead out of:')
  for (const r of dead) console.log(`  ${r.id}`)
}
if (process.argv.includes('--list')) {
  console.log('\nthin rows:')
  for (const r of thin) console.log(`  ${r.id.padEnd(24)} ${r.list.join(', ')}`)
}
