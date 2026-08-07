// Measure the search before touching it.
//
// A bench of queries someone would actually type, each with the tool id they
// obviously mean. Reports where that tool ranks. "Feels better" is not a
// measurement; rank-of-the-right-answer is.
import { readFileSync, readdirSync, existsSync } from 'node:fs'

// Run from the repo root: npx tsc src/lib/fuzzy.ts --outDir evals/gen --module esnext \n//   --target es2022 --moduleResolution bundler && node evals/searchbench.mjs
const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')

// --- load the tools straight out of the metas (no TS build needed) ---
const reg = readFileSync(`${ROOT}/src/tools/index.ts`, 'utf8')
const dirs = readdirSync(`${ROOT}/src/tools`).filter(
  (d) => existsSync(`${ROOT}/src/tools/${d}/meta.ts`) && reg.includes(`'./${d}/meta'`),
)
const tools = []
for (const d of dirs) {
  const src = readFileSync(`${ROOT}/src/tools/${d}/meta.ts`, 'utf8')
  if (/status: 'coming-soon'/.test(src)) continue
  const pick = (k) => (new RegExp(`${k}: '((?:[^'\\\\]|\\\\.)*)'`).exec(src)?.[1] ?? '')
  const kwBlock = /keywords: \[([\s\S]*?)\]/.exec(src)?.[1] ?? ''
  const keywords = [...kwBlock.matchAll(/'((?:[^'\\]|\\.)*)'/g)].map((m) => m[1])
  tools.push({
    id: pick('id'),
    name: pick('name'),
    nameAr: pick('nameAr'),
    tagline: pick('tagline'),
    category: pick('category'),
    keywords,
  })
}

// --- the REAL scorer, compiled from src/lib/fuzzy.ts by tsc ---
import { scoreTool } from './gen/fuzzy.js'

// --- the bench: what someone types -> what they obviously mean ---
const BENCH = [
  ['pdf merge', 'pdf-merge'],
  ['merge pdf', 'pdf-merge'],
  ['combine pdfs', 'pdf-merge'],
  ['compress image', 'image-compressor'],
  ['make picture smaller', 'image-compressor'],
  ['resize photo', 'image-cropper'],
  ['qr', 'qr-code'],
  ['scan qr', 'qr-reader'],
  ['password', 'password-generator'],
  ['strong password', 'password-generator'],
  ['is my password good', 'password-strength'],
  ['prayer', 'prayer-times'],
  ['prayer times print', 'prayer-timetable'],
  ['hijri', 'hijri-calendar'],
  ['zakat', 'zakat-calculator'],
  ['iban', 'iban-validator'],
  ['vat', 'vat-calculator'],
  ['end of service', 'end-of-service'],
  ['iqama expiry', 'id-expiry'],
  ['translate', 'translate'],
  ['summarize', 'summarize'],
  ['summarise', 'summarize'],
  ['excel to csv', 'xlsx-convert'],
  ['xlsx', 'xlsx-convert'],
  ['split csv', 'csv-split'],
  ['compare spreadsheets', 'sheet-diff'],
  ['contacts vcf', 'csv-vcard'],
  ['trim video', 'video-trim'],
  ['cut video', 'video-trim'],
  ['remove silence', 'remove-silence'],
  ['epub', 'epub-text'],
  ['certificate ssl', 'cert-decoder'],
  ['email headers', 'email-headers'],
  ['seating', 'seating-chart'],
  ['attendance', 'attendance-sheet'],
  ['worksheet', 'worksheets'],
  ['bingo', 'bingo-cards'],
  ['quiz', 'quiz-maker'],
  ['khatma', 'khatma'],
  ['handwriting', 'arabic-handwriting'],
  ['calendar invite', 'ics-builder'],
  ['ics', 'ics-builder'],
  ['plate', 'saudi-plate'],
  ['short address', 'short-address'],
  ['name in english', 'name-spelling'],
  ['metronome', 'metronome'],
  ['tuner', 'tuner'],
  ['invoice', 'invoice-generator'],
  ['cv', 'ats-cv-optimizer'],
  ['resume', 'ats-cv-optimizer'],
  ['book meeting', 'book-me'],
  ['video call', 'calls'],
  ['background remove', 'remove-background'],
  ['ocr', 'image-to-text'],
  ['text from image', 'image-to-text'],
  ['json format', 'json-formatter'],
  ['regex', 'regex-tester'],
  ['jwt', 'jwt-decoder'],
  ['cron', 'cron-builder'],
  ['unit convert', 'unit-converter'],
  ['currency', 'currency-converter'],
  ['weather', 'weather'],
  ['قبلة', 'qibla'],
  ['مواقيت', 'prayer-times'],
  ['زكاة', 'zakat-calculator'],
  ['ضغط صورة', 'image-compressor'],
  ['ترجمة', 'translate'],
  ['فاتورة', 'invoice-generator'],
]

function rank(query, wanted) {
  const scored = tools
    .map((t) => ({ id: t.id, score: scoreTool(query, t) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
  const at = scored.findIndex((x) => x.id === wanted)
  return { at: at < 0 ? Infinity : at + 1, top: scored.slice(0, 3).map((x) => x.id) }
}

let top1 = 0, top3 = 0, missing = 0
const bad = []
for (const [q, want] of BENCH) {
  const r = rank(q, want)
  if (r.at === 1) top1++
  if (r.at <= 3) top3++
  if (r.at === Infinity) missing++
  if (r.at > 3) bad.push(`${q.padEnd(24)} want ${want.padEnd(20)} rank ${r.at === Infinity ? 'NOT FOUND' : r.at}  got ${r.top.join(', ')}`)
}

console.log(`tools indexed: ${tools.length}`)
console.log(`queries: ${BENCH.length}`)
console.log(`top-1: ${top1}/${BENCH.length} (${Math.round((top1 / BENCH.length) * 100)}%)`)
console.log(`top-3: ${top3}/${BENCH.length} (${Math.round((top3 / BENCH.length) * 100)}%)`)
console.log(`not found at all: ${missing}`)
if (bad.length) {
  console.log('\n--- outside the top 3 ---')
  for (const line of bad) console.log(line)
}
