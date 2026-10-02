// The two schedules the owner sent, as share links.
//
//   node scripts/make-sample-schedules.mjs
//
// They are typed out here rather than hand-entered in the browser so that the
// data is reviewable and the links can be regenerated if the encoding changes.
// Nothing imports this at runtime; it prints links and exits.
//
// Node has `CompressionStream`, `Blob`, `Response` and `btoa` as globals, so
// the tool's own `encodeSchedule` runs here unchanged — the link this prints
// is made by exactly the code the site runs, not a second implementation.

import { execFileSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'
import { readdirSync, readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const gen = path.join(root, 'evals', 'gen-as')

// Compile the real module, the way the eval harnesses do.
if (existsSync(gen)) rmSync(gen, { recursive: true, force: true })
execFileSync(process.execPath, [
  path.join(root, 'node_modules', 'typescript', 'bin', 'tsc'),
  'src/tools/activity-schedule/schedule.ts', 'src/lib/week.ts', 'src/lib/fuzzy.ts',
  '--outDir', 'evals/gen-as', '--rootDir', 'src',
  '--module', 'esnext', '--target', 'es2022', '--moduleResolution', 'bundler',
], { cwd: root, stdio: 'inherit' })

// `tsc` emits a specifier exactly as written, so `./fuzzy` is unresolvable
// under Node ESM. Rewritten in the GENERATED copy only, rather than putting
// `.js` into the product's own imports and making one file inconsistent with
// every other — the arrangement `relatedPick` already uses.
for (const dir of [path.join(gen, 'lib'), path.join(gen, 'tools', 'activity-schedule')]) {
  for (const f of readdirSync(dir)) {
    if (!f.endsWith('.js')) continue
    const p = path.join(dir, f)
    writeFileSync(p, readFileSync(p, 'utf8').replace(/(from\s+'\.\.?\/[^']*?)'/g, "$1.js'"))
  }
}

const { encodeSchedule } = await import(
  pathToFileURL(path.join(gen, 'tools', 'activity-schedule', 'schedule.js')).href
)

const DAYS = ['sun', 'mon', 'tue', 'wed', 'thu']
const t = (h, m) => h * 60 + m

/**
 * A day as `[name, startH, startM, endH, endM]`, read straight off the sheets.
 *
 * Both of them are internally consistent — unlike the first chart this tool
 * was modelled on, which had `9:30 – 9:30` and `10:00 – 19:30`. Nothing is
 * corrected here; what is typed is what the sheets say.
 */
const ICONS = {
  'طابور وأذكار الصباح': '🔔',
  'تبيان': '📘',
  'قرآن': '📖',
  'إنجليزي': '🔤',
  'رياضيات': '🔢',
  'وجبة': '🍎',
  'أركان': '🧱',
  'لعب حر': '🎲',
  'انصراف': '🏠',
  'مراجعة تبيان': '📚',
  'مراجعة قرآن': '📚',
  'مراجعة إنجليزي': '📚',
  'مراجعة رياضيات': '📚',
}

const build = (meta, perDay) => ({
  id: 'sample',
  title: 'الجدول الأسبوعي',
  note: 'أيام الدراسة: الأحد إلى الخميس',
  group: meta.group,
  days: DAYS,
  from: meta.from,
  to: meta.to,
  art: true,
  updated: Date.now(),
  items: Object.fromEntries(DAYS.map((d) => [d, perDay[d].map((row, i) => ({
    id: `${d}${i}`,
    name: row[0],
    icon: ICONS[row[0]] ?? '',
    start: t(row[1], row[2]),
    end: t(row[3], row[4]),
  }))])),
})

// --- تمهيدي -----------------------------------------------------------------
const morning = ['طابور وأذكار الصباح', 7, 0, 7, 30]
const meal = ['وجبة', 9, 0, 9, 30]
const corners = ['أركان', 10, 0, 10, 45]
const play = ['لعب حر', 10, 45, 11, 0]
// `انصراف` is written with a single time and no end on both sheets; on an axis
// it gets the quarter hour it plainly occupies rather than being dropped.
const out = ['انصراف', 11, 0, 11, 15]

const tamhidi = build({ group: 'تمهيدي', from: t(7, 0), to: t(11, 15) }, {
  sun: [morning, ['تبيان', 7, 30, 8, 0], ['قرآن', 8, 0, 8, 30], ['إنجليزي', 8, 30, 9, 0], meal, ['رياضيات', 9, 30, 10, 0], corners, play, out],
  mon: [morning, ['قرآن', 7, 30, 8, 0], ['رياضيات', 8, 0, 8, 30], ['تبيان', 8, 30, 9, 0], meal, ['إنجليزي', 9, 30, 10, 0], corners, play, out],
  tue: [morning, ['تبيان', 7, 30, 8, 0], ['قرآن', 8, 0, 8, 30], ['إنجليزي', 8, 30, 9, 0], meal, ['رياضيات', 9, 30, 10, 0], corners, play, out],
  wed: [morning, ['قرآن', 7, 30, 8, 0], ['رياضيات', 8, 0, 8, 30], ['تبيان', 8, 30, 9, 0], meal, ['إنجليزي', 9, 30, 10, 0], corners, play, out],
  thu: [morning, ['مراجعة تبيان', 7, 30, 8, 0], ['مراجعة إنجليزي', 8, 0, 8, 30], ['مراجعة قرآن', 8, 30, 9, 0], meal, ['مراجعة رياضيات', 9, 30, 10, 0], corners, play, out],
})

// --- KG2 - براعم 2 ----------------------------------------------------------
const meal2 = ['وجبة', 8, 30, 9, 0]
const corners2 = ['أركان', 9, 0, 9, 45]

const kg2 = build({ group: 'KG2 - براعم 2', from: t(7, 0), to: t(11, 15) }, {
  sun: [morning, ['قرآن', 7, 30, 8, 0], ['رياضيات', 8, 0, 8, 30], meal2, corners2, ['تبيان', 9, 45, 10, 15], ['إنجليزي', 10, 15, 10, 45], play, out],
  mon: [morning, ['إنجليزي', 7, 30, 8, 0], ['تبيان', 8, 0, 8, 30], meal2, corners2, ['قرآن', 9, 45, 10, 15], ['رياضيات', 10, 15, 10, 45], play, out],
  tue: [morning, ['قرآن', 7, 30, 8, 0], ['رياضيات', 8, 0, 8, 30], meal2, corners2, ['تبيان', 9, 45, 10, 15], ['إنجليزي', 10, 15, 10, 45], play, out],
  wed: [morning, ['إنجليزي', 7, 30, 8, 0], ['تبيان', 8, 0, 8, 30], meal2, corners2, ['قرآن', 9, 45, 10, 15], ['رياضيات', 10, 15, 10, 45], play, out],
  thu: [morning, ['مراجعة قرآن', 7, 30, 8, 0], ['مراجعة رياضيات', 8, 0, 8, 30], meal2, corners2, ['مراجعة تبيان', 9, 45, 10, 15], ['مراجعة إنجليزي', 10, 15, 10, 45], play, out],
})

const base = process.argv[2] ?? 'https://built-in-saudi.com'
for (const [label, s] of [['تمهيدي', tamhidi], ['KG2 - براعم 2', kg2]]) {
  const hash = await encodeSchedule(s)
  const url = `${base}/ar/apps/activity-schedule/#s=${hash}`
  console.log(`\n${label}  (${new TextEncoder().encode(url).length} bytes)\n${url}`)
}
console.log('')
