// How does search behave when somebody mistypes?
//
// The scorer has no notion of edit distance: it is substring, subsequence and
// prefix work. That is fine for a word somebody spells correctly and says
// nothing about the case a search box sees constantly — a transposed pair, a
// doubled letter, a dropped one.
//
// `slugprobe` already found one instance (`pdf-mrege` missing `pdf-merge`) and
// the roadmap recorded edit distance as "worth it only if this turns out to
// matter". This is the measurement that decides.
//
// The typos are the four classes people actually make, applied to queries the
// benches already agree on, so a miss here is a typo problem and not a
// vocabulary one:
//   transposition (merge -> mrege), omission (compress -> compres),
//   doubling (image -> immage), and a neighbouring key (json -> jspn).
import { tools } from './lib/tools.mjs'
import { scoreTool, aboveFloor, correctQuery, vocabulary } from './gen/fuzzy.js'

// The same fallback the UI runs: only when the normal path found nothing.
const VOCAB = vocabulary(tools)

const CASES = [
  // [typed, correct spelling, the tool it means]
  ['pdf mrege', 'pdf merge', 'pdf-merge'],
  ['merge pdf fiels', 'merge pdf files', 'pdf-merge'],
  ['compres image', 'compress image', 'image-compressor'],
  ['immage compressor', 'image compressor', 'image-compressor'],
  ['qr generater', 'qr generator', 'qr-code'],
  ['jspn formatter', 'json formatter', 'json-formatter'],
  ['json formater', 'json formatter', 'json-formatter'],
  ['passowrd generator', 'password generator', 'password-generator'],
  ['calender', 'calendar', 'hijri-calendar'],
  ['hijri calender', 'hijri calendar', 'hijri-calendar'],
  ['excel to csv converter', 'excel to csv converter', 'xlsx-convert'],
  ['barcod', 'barcode', 'barcode'],
  ['tiemsheet', 'timesheet', 'timesheet'],
  ['gpa calcualtor', 'gpa calculator', 'gpa-calculator'],
  ['zakat calculater', 'zakat calculator', 'zakat-calculator'],
  ['remove backgroud', 'remove background', 'remove-background'],
  ['screen recoder', 'screen recorder', 'screen-recorder'],
  ['unit converer', 'unit converter', 'unit-converter'],
  ['word serach', 'word search', 'word-search'],
  ['prayer tmies', 'prayer times', 'prayer-times'],
  // Arabic: a dropped letter and a common hamza slip.
  ['حاسبه الزكاة', 'حاسبة الزكاة', 'zakat-calculator'],
  ['ضغط صوره', 'ضغط صورة', 'image-compressor'],
  ['مواقيت الصلاه', 'مواقيت الصلاة', 'prayer-times'],
]

function once(query) {
  const scored = tools
    .map((t) => ({ id: t.id, score: scoreTool(query, t) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
  return aboveFloor(scored)
}

// Mirrors `rankToolsWithCorrection`: the correction wins when it is decisively
// better, not merely different.
const RATIO = 1.5

function rank(query, want) {
  let shown = once(query)
  const corrected = correctQuery(query, VOCAB)
  if (corrected) {
    const second = once(corrected)
    if (second.length && (!shown.length || second[0].score >= shown[0].score * RATIO)) shown = second
  }
  const at = shown.findIndex((x) => x.id === want)
  return { at: at < 0 ? Infinity : at + 1, shown: shown.slice(0, 3).map((x) => x.id), n: shown.length, corrected }
}

let typedOk = 0, spelledOk = 0, nothing = 0
const rows = []
for (const [typo, correct, want] of CASES) {
  const a = rank(typo, want)
  const b = rank(correct, want)
  if (a.at === 1) typedOk++
  if (b.at === 1) spelledOk++
  if (a.n === 0) nothing++
  if (a.at !== 1) {
    rows.push(`  ${typo.padEnd(24)} want ${want.padEnd(20)} rank ${a.at === Infinity ? 'NOT FOUND' : a.at}  got ${a.shown.join(', ') || 'NOTHING'}`)
  }
}

console.log(`typo queries: ${CASES.length}`)
console.log(`  spelled correctly, top hit: ${spelledOk}/${CASES.length} (the control — a miss here is not a typo problem)`)
console.log(`  mistyped, top hit:          ${typedOk}/${CASES.length} (${Math.round((typedOk / CASES.length) * 100)}%)`)
console.log(`  mistyped, NOTHING returned: ${nothing}`)
if (rows.length) { console.log('\nMISSES'); rows.forEach((r) => console.log(r)) }
