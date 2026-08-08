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
// Mirrors CATEGORY_LABELS in src/i18n/index.tsx — the UI scores against the
// localized label as well as the English one.
const AR_CATEGORY = {
  Generators: 'مولّدات', Images: 'صور', Design: 'تصميم', Converters: 'محوّلات',
  Developer: 'أدوات المطوّرين', Web: 'الويب', Text: 'نصوص', Calculators: 'حاسبات',
  PDF: 'PDF', Business: 'أعمال', Communication: 'تواصل', Files: 'ملفات',
  Utilities: 'أدوات', 'Saudi / Local': 'أدوات سعودية',
}

const tools = []
for (const d of dirs) {
  const raw = readFileSync(`${ROOT}/src/tools/${d}/meta.ts`, 'utf8')
  // Strip whole-line // comments BEFORE pulling quoted strings out. Without
  // this the harness reads a comment as data: a note saying why a keyword was
  // removed mentions the word in quotes, and the bench dutifully re-indexed it
  // — reporting the removal as having had no effect. A parser that reads the
  // explanation as the thing being explained is worse than no parser.
  const src = raw.split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n')
  if (/status: 'coming-soon'/.test(src)) continue
  const pick = (k) => (new RegExp(`${k}: '((?:[^'\\\\]|\\\\.)*)'`).exec(src)?.[1] ?? '')
  const kwBlock = /keywords: \[([\s\S]*?)\]/.exec(src)?.[1] ?? ''
  const keywords = [...kwBlock.matchAll(/'((?:[^'\\]|\\.)*)'/g)].map((m) => m[1])
  // The UI passes the localized AND English tagline/category joined together
  // (see AppLauncher). Passing only the English ones measured a scorer the site
  // does not run: "stopwatch" returned nothing here and one result in the
  // browser, because an Arabic tagline it never saw contained the subsequence.
  const arBlock = /ar:\s*\{([\s\S]*?)\n  \}/.exec(src)?.[1] ?? ''
  const arPick = (k) => (new RegExp(`${k}:\\s*'((?:[^'\\\\]|\\\\.)*)'`).exec(arBlock)?.[1] ?? '')
  const category = pick('category')
  tools.push({
    id: pick('id'),
    name: pick('name'),
    // The UI passes localizeTool(tool, locale).name -- the ar BLOCK'"'"'s name --
    // not the top-level nameAr field, which most metas do not even define. The
    // bench read the field, so for every such tool the Arabic name was simply
    // absent from the index: حاسبة النسبة ranked its own calculator SEVENTH.
    nameAr: arPick('name') || pick('nameAr'),
    tagline: `${arPick('tagline')} ${pick('tagline')}`.trim(),
    category: `${AR_CATEGORY[category] ?? category} ${category}`.trim(),
    keywords,
  })
}

// Registry order, because that is how the UI iterates and therefore how it
// breaks ties. Reading the directory gives alphabetical order instead, which
// silently resolved every tie the wrong way: "فاتورة" ties the invoice
// generator with the electricity bill at 432.00, and the bench called it a
// failure while the site ranks them the way the catalogue is curated.
const order = [...reg.matchAll(/^  ([a-zA-Z0-9]+Tool),$/gm)].map((m, i) => [m[1], i])
const orderRank = new Map(order)
const varOf = new Map()
for (const d of dirs) {
  const src = readFileSync(`${ROOT}/src/tools/${d}/meta.ts`, 'utf8')
  const v = /export const ([a-zA-Z0-9]+Tool)/.exec(src)?.[1]
  const id = /id: '([^']+)'/.exec(src)?.[1]
  if (v && id) varOf.set(id, v)
}
tools.sort((a, b) => (orderRank.get(varOf.get(a.id)) ?? 1e9) - (orderRank.get(varOf.get(b.id)) ?? 1e9))

// --- the REAL scorer, compiled from src/lib/fuzzy.ts by tsc ---
import { scoreTool } from './gen/fuzzy.js'
import { UNTUNED } from './untuned.mjs'

// --- the bench: what someone types -> what they obviously mean ---
const BENCH = [
  ['pdf merge', 'pdf-merge'],
  ['merge pdf', 'pdf-merge'],
  ['combine pdfs', 'pdf-merge'],
  ['compress image', 'image-compressor'],
  ['make picture smaller', 'image-compressor'],
  // The expectation here was WRONG, and the bench was scoring the right answer
  // as a failure. The cropper never changes an image's dimensions — it returns
  // the pixels inside the box — while the compressor takes a max width. So the
  // compressor is what "resize photo" means, and the cropper's `resize` keyword
  // (which described dragging the crop box) has been removed.
  ['resize photo', 'image-compressor'],
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
  // Directionless: whichever way you read it, one of the pair is right.
  ['contacts vcf', ['csv-vcard', 'vcard-to-csv']],
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
  // The file tools added in the code-sweep batch. A tool nobody can find is a
  // tool that does not exist, so each one is benched on the words a person
  // would actually type — not the words the code uses.
  ['scanned pdf', 'pdf-ocr'],
  ['pdf ocr', 'pdf-ocr'],
  ['read a scanned document', 'pdf-ocr'],
  ['word to text', 'docx-to-text'],
  ['docx', 'docx-to-text'],
  ['open a word file', 'docx-to-text'],
  ['csv to excel', 'csv-to-xlsx'],
  ['leading zeros', 'csv-to-xlsx'],
  ['vcf to csv', 'vcard-to-csv'],
  ['contacts to spreadsheet', 'vcard-to-csv'],
  ['export phone contacts', 'vcard-to-csv'],
  ['مسح ضوئي', 'pdf-ocr'],
  ['جهات الاتصال', 'vcard-to-csv'],
  ['powerpoint to text', 'pptx-to-text'],
  ['pptx', 'pptx-to-text'],
  ['slides to text', 'pptx-to-text'],
  ['speaker notes', 'pptx-to-text'],
  ['بوربوينت', 'pptx-to-text'],
  // The Saudi tools from the August sweeps. These are the ones where being
  // unfindable costs most: someone looking for "what is deducted from my
  // salary" will not browse a catalogue for it.
  ['gosi', 'gosi-salary'],
  ['net salary', 'gosi-salary'],
  ['what is deducted from my salary', 'gosi-salary'],
  ['التأمينات', 'gosi-salary'],
  ['صافي الراتب', 'gosi-salary'],
  ['vat registration', 'vat-registration'],
  ['do i need to register for vat', 'vat-registration'],
  ['fahes', 'vehicle-renewal'],
  ['periodic inspection', 'vehicle-renewal'],
  ['istimara', 'vehicle-renewal'],
  ['الفحص الدوري', 'vehicle-renewal'],
  ['rent increase', 'rent-rules'],
  ['rent freeze', 'rent-rules'],
  ['lease renewal notice', 'rent-rules'],
  ['زيادة الإيجار', 'rent-rules'],
  ['early settlement', 'early-settlement'],
  ['pay off my loan early', 'early-settlement'],
  ['السداد المبكر', 'early-settlement'],
  ['annual leave', 'leave-overtime'],
  ['overtime pay', 'leave-overtime'],
  ['notice period', 'leave-overtime'],
  ['الإجازة السنوية', 'leave-overtime'],
  ['exit reentry', 'exit-reentry'],
  ['visa fee', 'exit-reentry'],
  ['خروج وعودة', 'exit-reentry'],
  ['electricity bill', 'electricity-bill'],
  ['فاتورة الكهرباء', 'electricity-bill'],
  ['weighted percentage', 'admission-score'],
  ['النسبة الموزونة', 'admission-score'],
  ['stopwatch', 'stopwatch'],
]

// A row's expectation may be an ARRAY when the query genuinely has no single
// right answer — "contacts vcf" names a thing and a format and no direction, so
// both the reader and the writer of a .vcf are correct readings. Flipping such a
// row to whichever tool currently wins would be scoring the bench against
// itself; saying it is ambiguous keeps the number honest and is counted below.
function rank(query, wanted) {
  const want = Array.isArray(wanted) ? wanted : [wanted]
  const scored = tools
    .map((t) => ({ id: t.id, score: scoreTool(query, t) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
  const at = scored.findIndex((x) => want.includes(x.id))
  return { at: at < 0 ? Infinity : at + 1, top: scored.slice(0, 3).map((x) => x.id) }
}

let top1 = 0, top3 = 0, missing = 0
const bad = []
let ambiguous = 0
// Everything that is not rank 1, not only what falls outside the top 3. A
// rank-2 result is a real miss — nobody scans a list for the tool they named.
const near = []
for (const [q, want] of BENCH) {
  if (Array.isArray(want)) ambiguous += 1
  const r = rank(q, want)
  if (r.at === 1) top1++
  if (r.at <= 3) top3++
  if (r.at === Infinity) missing++
  if (r.at > 3) bad.push(`${q.padEnd(24)} want ${want.padEnd(20)} rank ${r.at === Infinity ? 'NOT FOUND' : r.at}  got ${r.top.join(', ')}`)
  else if (r.at > 1) near.push(`${q.padEnd(24)} want ${want.padEnd(20)} rank ${r.at}  beaten by ${r.top.slice(0, r.at - 1).join(', ')}`)
}

console.log(`tools indexed: ${tools.length}`)
console.log(`queries: ${BENCH.length}`)
console.log(`top-1: ${top1}/${BENCH.length} (${Math.round((top1 / BENCH.length) * 100)}%)`)
console.log(`top-3: ${top3}/${BENCH.length} (${Math.round((top3 / BENCH.length) * 100)}%)`)
console.log(`not found at all: ${missing}`)
console.log(`rows with more than one acceptable answer: ${ambiguous}`)
if (near.length) {
  console.log('\n--- rank 2-3 (found, but not first) ---')
  for (const line of near) console.log(line)
}
if (bad.length) {
  console.log('\n--- outside the top 3 ---')
  for (const line of bad) console.log(line)
}

// --- the held-out set, reported every run so overfitting cannot hide ---
let u1 = 0, u3 = 0, uMiss = 0
const uBad = []
for (const [q, want] of UNTUNED) {
  const r = rank(q, want)
  if (r.at === 1) u1++
  if (r.at <= 3) u3++
  if (r.at === Infinity) uMiss++
  if (r.at > 1) uBad.push(`${q.padEnd(24)} want ${(Array.isArray(want) ? want.join('|') : want).padEnd(24)} rank ${r.at === Infinity ? 'NOT FOUND' : r.at}  got ${r.top.join(', ')}`)
}
console.log(`
HELD OUT (never tuned against): ${UNTUNED.length} queries`)
console.log(`  top-1: ${u1}/${UNTUNED.length} (${Math.round((u1 / UNTUNED.length) * 100)}%)`)
console.log(`  top-3: ${u3}/${UNTUNED.length} (${Math.round((u3 / UNTUNED.length) * 100)}%)`)
console.log(`  not found at all: ${uMiss}`)
if (uBad.length) { console.log('  --- not first ---'); for (const l of uBad) console.log('  ' + l) }
