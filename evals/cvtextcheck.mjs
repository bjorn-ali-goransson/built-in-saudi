// Is `cvToText` actually the text an ATS recovers from the exported PDF?
//
//   node evals/cvtextcheck.mjs
//
// Both `functions/cvText.js` and its mirror `evals/lib/cvText.mjs` open by
// claiming exactly that, and the claim carries real weight: the blind scorer
// grades `cvToText(cv)` rather than our JSON, precisely so that a score means
// the same thing whether it came from an upload or from our own rebuild. If the
// two drift, the scorer is grading a document nobody receives — the same class
// of failure as the letter-spacing and font-name regressions, and just as
// invisible.
//
// Nothing tested it. This does, deterministically and with no API key:
//
//   1. the two implementations agree with each other (mirrors drift);
//   2. every content word in `cvToText` survives into the real extracted PDF
//      text, and nothing material appears only in one.

import { getRenderer } from './lib/render.mjs'
import { pdfToText } from './lib/extract.mjs'
import { cvToText as cvToTextEval } from './lib/cvText.mjs'
import { cvToText as cvToTextProd } from '../functions/cvText.js'

const cv = {
  name: 'Sara Al-Otaibi',
  role: 'Senior Data Analyst',
  available: 'Open to relocation',
  contact: { location: 'Riyadh, Saudi Arabia', email: 'sara@example.com', phone: '0501234567', links: [{ label: 'GitHub', url: 'https://github.com/example' }] },
  summary: 'Data analyst with eight years building reporting in **Python** and **SQL**.',
  skills: [
    { category: 'Languages & Core', items: 'Python, SQL, Power BI' },
    { category: 'Cloud', items: 'AWS, Databricks' },
  ],
  experience: [{
    role: 'Senior Analyst', company: 'Aramco', location: 'Dhahran',
    startDate: 'Mar 2021', endDate: 'Present',
    bullets: ['Cut monthly reporting time by 40% using **Python**', 'Led a team of 6 analysts'],
  }, {
    role: 'Analyst', company: 'STC', startDate: 'Jan 2019', endDate: 'Feb 2021',
    bullets: ['Handled 200 tickets a month'],
  }],
  projects: [{ name: 'Tawazun', description: 'An internal **forecasting** dashboard' }],
  talks: [{ title: 'Forecasting at scale', detail: 'RiyadhTech', year: '2024' }],
  certifications: [{ title: 'AWS Data Analytics', detail: 'Amazon', year: '2023' }],
  publications: [],
  education: [{ degree: 'BSc Computer Science', institution: 'King Saud University', year: '2015' }],
  languages: [{ name: 'Arabic', level: 'Native' }, { name: 'English', level: 'Fluent' }],
}

// ── 1. mirror drift ────────────────────────────────────────────────────────
const prod = cvToTextProd(cv)
const mirror = cvToTextEval(cv)
console.log('=== mirror ===')
if (prod === mirror) {
  console.log('  functions/cvText.js and evals/lib/cvText.mjs agree exactly')
} else {
  const a = prod.split('\n')
  const b = mirror.split('\n')
  const diff = []
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (a[i] !== b[i]) diff.push(`    line ${i + 1}\n      prod:   ${JSON.stringify(a[i])}\n      mirror: ${JSON.stringify(b[i])}`)
  }
  console.log(`  THEY HAVE DRIFTED — ${diff.length} differing lines`)
  console.log(diff.slice(0, 10).join('\n'))
}

// ── 2. does it match the real PDF? ─────────────────────────────────────────
const render = await getRenderer()
const extracted = await pdfToText(await render(cv))

// Compare on content words, not layout: the PDF's line breaks are the
// template's business, and no ATS grades them.
const words = (s) => new Set(
  s.toLowerCase()
    .replace(/\*\*/g, '')
    .split(/[^a-z0-9%+@./-]+/i)
    .filter((w) => w.length > 1 && !/^[-./]+$/.test(w)),
)

const inClaim = words(prod)
const inPdf = words(extracted)
const missing = [...inClaim].filter((w) => !inPdf.has(w))
const extra = [...inPdf].filter((w) => !inClaim.has(w))

console.log('\n=== cvToText vs the real exported PDF ===')
console.log(`  words in cvToText: ${inClaim.size}   words extracted from the PDF: ${inPdf.size}`)
console.log(`  claimed but NOT in the PDF: ${missing.length ? JSON.stringify(missing) : 'none'}`)
console.log(`  in the PDF but not claimed: ${extra.length ? JSON.stringify(extra) : 'none'}`)

const ok = prod === mirror && missing.length === 0
console.log(`\n${ok ? 'PASS' : 'FAIL'} — mirror in step: ${prod === mirror}, nothing the scorer sees is absent from the PDF: ${missing.length === 0}`)
process.exit(ok ? 0 : 1)
