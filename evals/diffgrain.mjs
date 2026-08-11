// How much does a LINE-level diff over-report?
//
// `text-diff` is the site's primary text comparison tool and it highlights
// whole changed LINES. `lib/wordDiff.ts` — written for `pdf-diff`, and
// documented there as the thing people are actually looking for ("«thirty»
// became «sixty»") — has exactly one caller.
//
// Whether that matters is a question about the EDITS people make, so it is
// measured rather than asserted. For each realistic before/after pair, compare
// what a line-level answer marks as changed against what actually changed at
// the word level.
//
// Run: npx tsc src/lib/wordDiff.ts --outDir evals/gen --module esnext \
//        --target es2022 --moduleResolution bundler
//      node evals/diffgrain.mjs

import { diffDocuments } from './gen/lib/wordDiff.js'
import { diffRows, changedWords } from './gen/tools/text-diff/rows.js'

/** The line-level answer `text-diff` gives today, lifted verbatim from it. */
function diffLines(aLines, bLines) {
  const n = aLines.length, m = bLines.length
  const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0))
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      dp[i][j] = aLines[i] === bLines[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1])
  const rows = []
  let i = 0, j = 0
  while (i < n && j < m) {
    if (aLines[i] === bLines[j]) { rows.push({ t: 'eq', text: aLines[i] }); i++; j++ }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { rows.push({ t: 'del', text: aLines[i] }); i++ }
    else { rows.push({ t: 'add', text: bLines[j] }); j++ }
  }
  while (i < n) rows.push({ t: 'del', text: aLines[i++] })
  while (j < m) rows.push({ t: 'add', text: bLines[j++] })
  return rows
}

const wc = (s) => s.split(/\s+/).filter(Boolean).length
const lines = (t) => t.split('\n')
const asSource = (t) => lines(t).map((text) => ({ text, page: 1 }))

// Realistic edits: the shapes people paste two versions of. Deliberately NOT
// "one word in a one-line file" only — that would measure the easy case, the
// mistake `rtlpdf` and `doc-scan` both record making.
const CASES = [
  {
    name: 'one number in a clause',
    a: 'The tenant shall pay an annual rent of thirty thousand riyals.',
    b: 'The tenant shall pay an annual rent of sixty thousand riyals.',
  },
  {
    name: 'a name corrected mid-paragraph',
    a: 'Prepared by Mohammed Al-Otaibi on behalf of the contractor.\nAll notices go to the address below.',
    b: 'Prepared by Mohammed Al-Otaibi on behalf of the subcontractor.\nAll notices go to the address below.',
  },
  {
    name: 'a date and a figure in a long paragraph',
    a: 'The parties agree that delivery shall be completed no later than 15 March 2026, and that a penalty of 2% of the contract value shall apply for each week of delay, capped at 10% of the total.',
    b: 'The parties agree that delivery shall be completed no later than 30 April 2026, and that a penalty of 2% of the contract value shall apply for each week of delay, capped at 15% of the total.',
  },
  {
    name: 'a whole sentence inserted',
    a: 'Section one.\nSection two.\nSection three.',
    b: 'Section one.\nA new obligation applies here.\nSection two.\nSection three.',
  },
  {
    name: 'a whole paragraph rewritten',
    a: 'The supplier warrants the goods for one year.',
    b: 'Nothing in this agreement limits the statutory rights of the buyer.',
  },
  {
    name: 'Arabic: one figure changed',
    a: 'يلتزم المستأجر بسداد أجرة سنوية قدرها ثلاثون ألف ريال.',
    b: 'يلتزم المستأجر بسداد أجرة سنوية قدرها ستون ألف ريال.',
  },
  {
    name: 'code: one argument changed',
    a: 'const server = createServer({ port: 8080, host: "localhost" })\nserver.listen()',
    b: 'const server = createServer({ port: 3000, host: "localhost" })\nserver.listen()',
  },
  {
    name: 'a list where one item moved',
    a: 'apples\nbananas\ncherries\ndates',
    b: 'apples\ncherries\nbananas\ndates',
  },
]

let totLine = 0, totWord = 0
console.log('case                              line-level   word-level   over-report')
for (const c of CASES) {
  const rows = diffLines(lines(c.a), lines(c.b))
  const lineChanged = rows.filter((r) => r.t !== 'eq').reduce((n, r) => n + wc(r.text), 0)

  // The real production answer.
  const wordChanged = changedWords(diffRows(c.a, c.b, false))

  totLine += lineChanged
  totWord += wordChanged
  const ratio = wordChanged ? (lineChanged / wordChanged).toFixed(1) + '×' : '—'
  console.log(
    c.name.padEnd(34) + String(lineChanged).padStart(10) + String(wordChanged).padStart(13) + ratio.padStart(13),
  )
}

console.log('\ntotal words marked changed')
console.log(`  line level: ${totLine}`)
console.log(`  word level: ${totWord}`)
console.log(`  the line answer highlights ${(totLine / totWord).toFixed(1)}x what actually changed`)
console.log(`  ${(100 - (totWord / totLine) * 100).toFixed(0)}% of what it paints as changed did not change`)

// --- Where to STOP word-diffing.
//
// Word-diffing two unrelated sentences produces confetti: stray matches on
// "the" and "of" render as islands of unchanged text inside a rewrite that
// shares nothing. So a pair of lines is only worth word-diffing when they are
// actually versions of each other — and the threshold is measured here rather
// than picked, by printing the shared-word share for pairs that plainly SHOULD
// be word-diffed and pairs that plainly should not.
const PAIRS = [
  ['edit',    'The tenant shall pay an annual rent of thirty thousand riyals.', 'The tenant shall pay an annual rent of sixty thousand riyals.'],
  ['edit',    'Prepared by Mohammed Al-Otaibi on behalf of the contractor.', 'Prepared by Mohammed Al-Otaibi on behalf of the subcontractor.'],
  ['edit',    'const server = createServer({ port: 8080, host: "localhost" })', 'const server = createServer({ port: 3000, host: "localhost" })'],
  ['edit',    'يلتزم المستأجر بسداد أجرة سنوية قدرها ثلاثون ألف ريال.', 'يلتزم المستأجر بسداد أجرة سنوية قدرها ستون ألف ريال.'],
  ['edit',    'Delivery no later than 15 March 2026, penalty 2% a week capped at 10%.', 'Delivery no later than 30 April 2026, penalty 2% a week capped at 15%.'],
  ['rewrite', 'The supplier warrants the goods for one year.', 'Nothing in this agreement limits the statutory rights of the buyer.'],
  ['rewrite', 'apples', 'cherries'],
  ['rewrite', 'Section two.', 'A new obligation applies here.'],
  ['rewrite', 'Invoice total: 4,500 SAR', 'Please remit payment within thirty days of receipt.'],
]
console.log('\nshared-word share, for choosing the threshold')
const shares = { edit: [], rewrite: [] }
for (const [kind, a, b] of PAIRS) {
  const chunks = diffDocuments([{ text: a, page: 1 }], [{ text: b, page: 1 }])
  const same = chunks.filter((c) => c.op === 'same').reduce((n, c) => n + wc(c.text), 0)
  const share = same / Math.max(wc(a), wc(b))
  shares[kind].push(share)
  console.log(`  ${kind.padEnd(9)} ${(share * 100).toFixed(0).padStart(4)}%   ${a.slice(0, 40)}`)
}
const lo = Math.min(...shares.edit), hi = Math.max(...shares.rewrite)
console.log(`\n  a real edit shares at least ${(lo * 100).toFixed(0)}%`)
console.log(`  a rewrite shares at most   ${(hi * 100).toFixed(0)}%`)
console.log(hi < lo ? `  => a threshold anywhere in (${(hi * 100).toFixed(0)}%, ${(lo * 100).toFixed(0)}%) separates them`
                    : '  => NO threshold separates them; do not gate on this')
