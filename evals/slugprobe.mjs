// What a WRONG URL could be told, if the 404 page asked the scorer.
//
// At 211 tools a mistyped or guessed `/apps/<id>` is a dead end: the page says
// "not found" and offers the home page. Meanwhile the site carries a search
// scorer that answers this class of question well — so the question is not
// whether to suggest something, it is whether the suggestion would be right
// often enough to be worth showing.
//
// The queries below are the URLs a person or a stale link would actually
// produce: a plausible synonym for a tool we have, a hyphenated guess, an old
// name, a typo. Written before the feature, so the number is a measurement
// rather than a demonstration.
import { tools } from './lib/tools.mjs'
import { scoreTool, aboveFloor } from './gen/fuzzy.js'

const CASES = [
  // A plausible name for a tool we have, under a different word.
  ['pdf-combine', 'pdf-merge'],
  ['combine-pdf', 'pdf-merge'],
  ['pdf-splitter', 'pdf-split'],
  ['compress-pdf', 'pdf-compress'],
  ['image-resize', 'image-compressor'],
  ['photo-compress', 'image-compressor'],
  ['background-remover', 'remove-background'],
  ['qr-generator', 'qr-code'],
  ['qrcode', 'qr-code'],
  ['barcode-generator', 'barcode'],
  ['password-gen', 'password-generator'],
  ['json-format', 'json-formatter'],
  ['json-pretty', 'json-formatter'],
  ['base-64', 'base64'],
  ['uuid', 'uuid-generator'],
  ['regex', 'regex-tester'],
  ['jwt', 'jwt-decoder'],
  ['cron', 'cron-builder'],
  ['unit-convert', 'unit-converter'],
  ['currency', 'currency-converter'],
  ['vat', 'vat-calculator'],
  ['zakat', 'zakat-calculator'],
  ['gosi', 'gosi-salary'],
  ['iqama', 'iqama-fees'],
  ['prayer', 'prayer-times'],
  ['hijri', 'hijri-calendar'],
  ['salary-calculator', 'gosi-salary'],
  ['end-of-service-calculator', 'end-of-service'],
  ['word-to-text', 'docx-to-text'],
  ['excel-to-csv', 'xlsx-convert'],
  ['csv-to-json', 'csv-json'],
  ['markdown-to-word', 'markdown-docx'],
  ['md-to-epub', 'markdown-epub'],
  ['due-date-calculator', 'due-date'],
  ['wordsearch', 'word-search'],
  // Typos.
  ['pdf-mrege', 'pdf-merge'],
  ['imagecompressor', 'image-compressor'],
  ['calcualtor', null],
  // Genuinely nothing: the suggestion must be withheld, not invented.
  ['buy-bitcoin', null],
  ['order-pizza', null],
  ['asdfgh', null],
  ['xyzzy-9000', null],
]

// A slug is not a sentence: `pdf-merge` has to become `pdf merge` before the
// scorer sees it, or the whole thing is one unmatchable token.
const humanise = (slug) => slug.replace(/[-_]+/g, ' ').replace(/(\d+)/g, ' $1 ').trim()

let hit = 0, hit3 = 0, wrong = 0, withheldRight = 0, withheldWrong = 0
const misses = []
for (const [slug, want] of CASES) {
  const scored = tools
    .map((t) => ({ id: t.id, score: scoreTool(humanise(slug), t) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
  const shown = aboveFloor(scored)
  const top = shown[0]?.id ?? null
  if (want === null) {
    if (top === null) withheldRight++
    else { withheldWrong++; misses.push(`${slug.padEnd(26)} should suggest NOTHING, got ${top} (${Math.round(shown[0].score)})`) }
  } else {
    const in3 = shown.slice(0, 3).some((x) => x.id === want)
    if (in3) hit3++
    if (top === want) hit++
    else { wrong++; misses.push(`${slug.padEnd(26)} want ${String(want).padEnd(20)} got ${top ?? 'NOTHING'}${in3 ? ' (in top 3)' : ''}`) }
  }
}

const answerable = CASES.filter(([, w]) => w !== null).length
const unanswerable = CASES.length - answerable
console.log(`tools indexed: ${tools.length}`)
console.log(`answerable slugs: ${answerable}  correct top hit: ${hit} (${Math.round((hit / answerable) * 100)}%)`)
console.log(`  within the top 3: ${hit3} (${Math.round((hit3 / answerable) * 100)}%)`)
console.log(`unanswerable slugs: ${unanswerable}  correctly silent: ${withheldRight}`)
console.log('')
if (misses.length) { console.log('MISSES'); for (const m of misses) console.log('  ' + m) }
else console.log('no misses')
