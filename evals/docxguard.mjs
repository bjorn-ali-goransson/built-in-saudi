// The exported .docx is the THIRD document this tool hands a candidate, and
// nothing tested it.
//
//   node evals/docxguard.mjs
//
// No API key. `pdfguard` exists because the PDF path carried two silent,
// catastrophic bugs — every CV rendered in one font weight, and every section
// heading unreadable to an ATS — for as long as nobody looked. The Word export
// is a hand-written Office Open XML writer with no dependency and, until this,
// no test of any kind. The same argument applies with the same force: a
// candidate sends this file to an employer.
//
// It round-trips through our OWN reader (`src/lib/docx.ts`), which is worth
// being explicit about: two hand-written implementations agreeing is weaker
// evidence than one of them being right, because a shared misconception would
// satisfy both. So the structural checks below do NOT go through the reader —
// they look at the ZIP directly for the parts Word requires, and at the raw XML
// for the escaping. The round-trip then checks that content actually survives.
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'

const here = new URL('.', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
const root = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
const compile = (src) => {
  execFileSync(process.execPath, [
    `${root}/node_modules/typescript/bin/tsc`, `${root}/${src}`,
    '--outDir', `${here}gen`, '--module', 'esnext', '--target', 'es2022',
    '--moduleResolution', 'bundler',
  ], { stdio: 'inherit' })
}
if (!existsSync(`${here}gen/cvdocx.js`)) {
  // Compiled to its own name so it cannot collide with lib/docx.ts's output —
  // one writes a .docx and the other reads one, and they are both "docx.ts".
  execFileSync(process.execPath, [
    `${root}/node_modules/typescript/bin/tsc`, `${root}/src/tools/cv-generator/docx.ts`,
    '--outDir', `${here}gen/cvdocx`, '--module', 'esnext', '--target', 'es2022',
    '--moduleResolution', 'bundler',
  ], { stdio: 'inherit' })
}
if (!existsSync(`${here}gen/docx.js`)) compile('src/lib/docx.ts')

const { cvToDocxBlob } = await import('./gen/cvdocx/docx.js')
const { readDocx } = await import('./gen/docx.js')

// Characters that end a naive XML writer. A candidate really can be called
// "Sara & Co <Ltd>" as far as the writer is concerned, and a bullet really can
// contain a < or an ampersand.
const HOSTILE = 'Scaled R&D from 3 < 5 teams & cut cost by 40%'

const CV = {
  name: 'Sara Al-Otaibi',
  role: 'Data Engineer & Analyst',
  contact: { email: 'sara@example.com', phone: '0501234567', location: 'Riyadh', links: [] },
  summary: 'Nine years building **data pipelines** for large organisations.',
  skills: [{ id: 'skills-1', category: 'Data', items: 'Python, SQL, Airflow' }],
  experience: [
    { id: 'experience-1', role: 'Senior Data Engineer', company: 'Aramco', startDate: 'Jan 2021', endDate: 'Present', bullets: [HOSTILE, 'Led the warehouse migration'] },
    { id: 'experience-2', role: 'Data Engineer', company: 'STC', startDate: 'Jan 2018', endDate: 'Dec 2020', bullets: ['Built the ingest layer'] },
  ],
  projects: [], talks: [], certifications: [], publications: [],
  education: [{ id: 'education-1', degree: 'BSc Computer Science', institution: 'King Saud University', year: '2018' }],
  languages: [{ id: 'languages-1', name: 'Arabic', level: 'Native' }],
}

const bytes = new Uint8Array(await cvToDocxBlob(CV).arrayBuffer())
const text = new TextDecoder('latin1').decode(bytes)

let failures = 0
const check = (ok, label, detail = '') => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  — ${detail}` : ''}`)
  if (!ok) failures++
}

console.log('STRUCTURE (read off the ZIP, not through our own reader)')
check(bytes[0] === 0x50 && bytes[1] === 0x4b, 'it is a ZIP')
// Word refuses a .docx missing any of these, and the failure is "corrupt file"
// with no clue which part is absent.
// Deliberately NOT asserting `word/_rels/document.xml.rels`. It is required
// only when document.xml carries relationship references — images, hyperlinks,
// an external style part — and this writer emits none. The first version of
// this guard demanded it anyway and failed on a file that is perfectly valid,
// which is a check asserting a requirement nobody verified.
for (const part of ['[Content_Types].xml', '_rels/.rels', 'word/document.xml']) {
  check(text.includes(part), `contains ${part}`)
}

console.log('\nESCAPING (raw XML, before any parser has a chance to be lenient)')
const doc = /<w:document[\s\S]*<\/w:document>/.exec(text)?.[0] ?? ''
check(doc.length > 0, 'word/document.xml is present in the archive')
// A bare & or < in element text is not well-formed XML, and Word rejects the
// whole document rather than dropping the run.
const bare = doc.replace(/&(amp|lt|gt|quot|apos|#\d+);/g, '')
check(!/&/.test(bare), 'no unescaped ampersand', bare.match(/.{0,30}&.{0,30}/)?.[0] ?? '')
check(doc.includes('R&amp;D'), 'the ampersand in a bullet is escaped, not dropped')
check(doc.includes('3 &lt; 5'), 'the less-than in a bullet is escaped, not dropped')

console.log('\nROUND TRIP (does the content actually survive?)')
const read = await readDocx(new File([bytes], 'cv.docx'))
if (typeof read === 'string') {
  check(false, 'our reader could open it', read)
} else {
  // `text`, not `body`. Getting this wrong made every content check fail
  // against a file that was completely fine — a guard can be vacuously RED as
  // well as vacuously green, and the only reason it was caught quickly is that
  // it printed the string it went looking for.
  const body = read.text || ''
  for (const [label, needle] of [
    ['the name', 'Sara Al-Otaibi'],
    ['the headline role', 'Data Engineer'],
    ['the summary', 'Nine years building'],
    ['the first employer', 'Aramco'],
    ['the second employer', 'STC'],
    ['a bullet with hostile characters', 'R&D from 3 < 5 teams'],
    ['the education line', 'King Saud University'],
    ['the skills', 'Airflow'],
  ]) {
    check(body.includes(needle), `${label} survives`, body.includes(needle) ? '' : `missing: ${needle}`)
  }
  // The bold markers are a rendering instruction, not content. If they leak
  // through as literal asterisks the candidate is sending a CV with **stars**
  // in it — which is exactly what the PDF path was doing with its font names.
  check(!body.includes('**'), 'no literal ** markers leaked into the text')
}

console.log()
if (failures) {
  console.error(`docxguard: ${failures} check(s) failed — the exported Word file is not what it claims to be.`)
  process.exit(1)
}
console.log('docxguard: the exported .docx is a valid Word document and keeps its content.')
