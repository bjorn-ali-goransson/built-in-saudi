// Every eval guard that needs no API key, in one command.
//
//   node evals/check.mjs
//
// Six API-free checks were written while the OPENAI_KEY was dead, each finding
// something real — and each landed as its own script, mentioned in prose and
// run by nobody. A guard nobody runs protects nothing, which is the same
// failure as `atscheck.mjs` needing a run tag: the check existed and was
// unavailable.
//
// GATES exit non-zero on failure and are what makes this worth running in CI or
// before touching the CV pipeline. MEASUREMENTS report numbers that need a
// human to interpret and cannot pass or fail, so they are run only with
// `--all` and never affect the exit code.

import { spawn } from 'node:child_process'
import { existsSync, readdirSync } from 'node:fs'
import path from 'node:path'

const here = import.meta.dirname
const corpus = path.join(here, 'cvs')
const hasCorpus = existsSync(corpus) && readdirSync(corpus).some((f) => /\.pdf$/i.test(f))

/** Pass or fail, on a fixed synthetic input — so they work on any machine. */
const GATES = [
  ['pdfguard.mjs', 'the exported CV survives machine reading (headings, bold boundaries, font names)'],
  ['cvtextcheck.mjs', 'cvToText is what an ATS actually recovers, and its mirror has not drifted'],
  ['columncheck.mjs', 'the column-splitting mirror in evals/ still matches production'],
  ['../scripts/check-ats-dims.mjs', 'the six ATS dimensions agree across client, server and prompt'],
  ['patchcheck.mjs', 'an improve pass cannot delete a section of the candidate CV'],
]

/** Numbers a person reads. No pass/fail, and some need the real corpus. */
const MEASURES = [
  ['docxextract.mjs', 'which .docx reader keeps a CV’s bullets', false],
  ['pdfextract.mjs', 'two-column CVs and split keywords', false],
  ['pdfcolumns.mjs', 'how often the column split fires on real CVs', true],
  ['quantified.mjs', 'how many lines of a real CV carry a figure', true],
  ['roles.mjs', 'positions per CV, against the improve loop’s question count', true],
  ['roleimpact.mjs', 'which roles already have a number — targeting vs enlarging the budget', true],
]

function run(script) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [path.join(here, script)], { stdio: ['ignore', 'pipe', 'pipe'] })
    let out = ''
    child.stdout.on('data', (d) => { out += d })
    // pdf.js warns about standard fonts on every run; it is noise, not failure.
    child.stderr.on('data', (d) => { out += String(d).split('\n').filter((l) => !/^Warning:/.test(l)).join('\n') })
    child.on('close', (code) => resolve({ code, out }))
  })
}

const all = process.argv.includes('--all')
let failed = 0

console.log('=== gates ===')
for (const [script, what] of GATES) {
  const { code, out } = await run(script)
  const ok = code === 0
  if (!ok) failed++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${script.padEnd(20)} ${what}`)
  if (!ok) console.log(out.split('\n').map((l) => `      ${l}`).join('\n'))
}

if (all) {
  console.log('\n=== measurements (no pass/fail) ===')
  for (const [script, what, needsCorpus] of MEASURES) {
    if (needsCorpus && !hasCorpus) {
      console.log(`SKIP  ${script.padEnd(20)} ${what} — needs real CVs in evals/cvs`)
      continue
    }
    const { out } = await run(script)
    console.log(`\n--- ${script}: ${what}`)
    console.log(out.trim().split('\n').map((l) => `    ${l}`).join('\n'))
  }
} else {
  console.log(`\n(${MEASURES.length} measurements not run — pass --all for those)`)
}

console.log(`\n${failed ? `${failed} gate(s) FAILED` : 'all gates pass'}`)
process.exit(failed ? 1 : 0)
