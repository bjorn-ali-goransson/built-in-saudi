// Does the PDF we hand the candidate survive machine reading?
//
//   node evals/atscheck.mjs <run-tag> [--variant champion]
//
// Renders every CV in a run through the real template and inspects the text an
// ATS would extract for the two failure modes that make a résumé unreadable to
// a parser regardless of how good its wording is:
//
//   1. LETTER-SPACED HEADINGS — CSS letter-spacing above roughly 0.05em makes
//      pdf.js (and every parser built on the same "is this gap a space?" rule)
//      emit one text item per glyph, so "SKILLS" comes back as "S K I L L S".
//      Section detection is the first thing a résumé parser does; if it can't
//      find the headings it falls back to guessing, and everything downstream —
//      which text is a job title, which is a date — degrades with it.
//   2. GLUED WORDS — a space swallowed at the boundary between a normal and a
//      **bold** run ("usingDocker", "by20%"), which destroys the keyword or the
//      metric outright: no parser matches "Docker" inside "usingDocker".
import fs from 'node:fs'
import path from 'node:path'
import { ROOT } from './lib/env.mjs'
import { pdfToText } from './lib/extract.mjs'
import { getRenderer } from './lib/render.mjs'

const argv = process.argv.slice(2)
const tag = argv.find((a) => !a.startsWith('--'))
const variant = (argv.indexOf('--variant') >= 0 && argv[argv.indexOf('--variant') + 1]) || 'champion'

const SECTIONS = ['SUMMARY', 'SKILLS', 'EXPERIENCE', 'PROJECTS', 'EDUCATION', 'CERTIFICATIONS', 'LANGUAGES', 'TALKS', 'PUBLICATIONS']

/** "S K I L L S" — a run of single characters separated by spaces. */
const spacedOut = (line) => /(?:^|\s)(?:[A-Za-z]\s){3,}[A-Za-z](?:\s|$)/.test(line)

/** lowercase immediately followed by uppercase inside one token ("usingDocker"),
 *  or a letter running straight into a digit+% ("by20%"). Excludes legitimate
 *  camelCase product names by requiring the prefix to be a common English word. */
const GLUE_WORDS = '(?:using|with|via|and|by|to|in|on|for|of|the|a|an|through|across|into|from|at|as)'
const gluedRe = new RegExp(`\\b${GLUE_WORDS}(?=[A-Z0-9])`, 'g')

const run = JSON.parse(fs.readFileSync(path.join(ROOT, 'evals', 'out', `run-${tag}.json`), 'utf8'))
const rows = run.results.filter((r) => r && !r.error && r.variants?.[variant]?.cv)
const render = await getRenderer()

let headingsBroken = 0
let headingsTotal = 0
let cvsWithBrokenHeadings = 0
let gluedTotal = 0
let cvsWithGlue = 0
const examples = []

for (const r of rows) {
  const pdfText = await pdfToText(await render(r.variants[variant].cv))
  const lines = pdfText.split('\n')

  // A heading is "found" only if it appears as an intact word.
  const cv = r.variants[variant].cv
  const expected = SECTIONS.filter((s) => {
    const key = s.toLowerCase()
    if (key === 'summary') return !!cv.summary
    return Array.isArray(cv[key]) && cv[key].length
  })
  let broken = 0
  for (const s of expected) {
    headingsTotal++
    if (!new RegExp(`\\b${s}\\b`).test(pdfText)) { broken++; headingsBroken++ }
  }
  if (broken) cvsWithBrokenHeadings++

  const glued = [...pdfText.matchAll(gluedRe)]
  gluedTotal += glued.length
  if (glued.length) cvsWithGlue++
  if (glued.length && examples.length < 12) {
    for (const m of glued.slice(0, 2)) examples.push(pdfText.slice(Math.max(0, m.index - 34), m.index + 22).replace(/\n/g, ' '))
  }

  const spaced = lines.filter(spacedOut).map((l) => l.trim()).slice(0, 3)
  console.log(`  ${r.name.slice(0, 40).padEnd(42)} headings ${expected.length - broken}/${expected.length}  glued ${String(glued.length).padStart(2)}` +
    (spaced.length ? `   e.g. "${spaced[0].slice(0, 30)}"` : ''))
}

console.log('\n' + '─'.repeat(70))
console.log(`Section headings unreadable: ${headingsBroken}/${headingsTotal}  (${cvsWithBrokenHeadings}/${rows.length} CVs affected)`)
console.log(`Glued words (lost keyword/metric): ${gluedTotal}  (${cvsWithGlue}/${rows.length} CVs affected)`)
if (examples.length) {
  console.log('\nGlued examples:')
  for (const e of examples) console.log(`  …${e}…`)
}
