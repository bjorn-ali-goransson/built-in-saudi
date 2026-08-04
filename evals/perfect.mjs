// Is a 5.0 reachable at all — and if so, what does it take?
//
//   node evals/perfect.mjs [--rounds 6] [--samples 3]
//
// Every real CV we optimise lands around 4.0–4.4, and three dimensions
// (clarity, format, conciseness) sat at exactly 4.00 in EVERY condition tested,
// including one where every bullet was quantified. That is suspicious in two
// different ways, and they need separating:
//
//   (a) our CV shape has a structural ceiling — something about how cvText/CvPdf
//       lay a CV out cannot earn a 5, in which case it is our bug; or
//   (b) the judge simply does not award 5s, in which case every number this
//       harness has produced is compressed and the measurement is the problem.
//
// So we build a deliberately ideal CV — fully fictional candidate, in OUR Cv
// shape, rendered through OUR renderer — and hill-climb it: score it blind, ask
// a critic what specifically is missing for a 5 on each dimension below 5,
// rewrite, rescore. If it converges on 5.0 the format is fine and the ceiling is
// the candidate's material. If it plateaus, the critic's reasons tell us which
// of (a) or (b) we are looking at.
//
// The candidate is invented. That is the point: this is a benchmark artefact, a
// proof that the target exists, not a CV for anybody.
import fs from 'node:fs'
import path from 'node:path'
import { ROOT, MODEL } from './lib/env.mjs'
import { cvToText } from '../functions/cvText.js'
import { normalize } from '../functions/cvShape.js'
import { scoreCv, DIMS } from './lib/judge.mjs'
import { chatJSON, usage } from './lib/openai.mjs'
import { SHAPE } from '../functions/cvPrompts.js'

const argv = process.argv.slice(2)
const flag = (n, d) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : d }
const ROUNDS = Number(flag('rounds', 6))
const SAMPLES = Number(flag('samples', 3))

const RUBRIC = `The document is graded 1-5 on six dimensions:
- keywords: role/industry terms, tools and technologies a parser can match to a job description. 5 = comprehensive and clearly targeted at a role.
- impact: concrete quantified achievements rather than duty lists. 5 = consistently quantified outcomes with scale and business effect.
- clarity: clear, professional, filler-free, skimmable. 5 = exceptionally sharp; every line earns its place.
- format: standard section headings, employer + title + dates on every role, one consistent date format, sane reading order. 5 = textbook.
- completeness: contact route, summary, dated roles with employers, skills, education. 5 = everything present and well developed.
- conciseness: signal per word. 5 = every line is signal, at the right length.`

const AUTHOR = `You are writing a BENCHMARK ARTEFACT: the best possible résumé for a completely fictional software engineer, invented from scratch. It is not for any real person and will never be used as one — invent the name, employers, dates, technologies and every figure. Make them realistic and mutually consistent (a coherent 9-year career, sensible dates in order, no overlaps, figures that fit the scale of the employer).

Aim squarely at a perfect score on all six dimensions below. In particular: every experience bullet should lead with an outcome and carry a CREDIBLE number — one that names what was measured, in a unit that fits the claim, and that someone in that role could genuinely move. Vary the units across the CV (counts, users, throughput, latency, money, time saved, team size), because a résumé where every bullet ends in a round percentage reads as inflated rather than accomplished, and will be scored as unquantified; the language should be sharp with no filler or buzzwords; every role needs a month-and-year start and end ("Mar 2021", ongoing = "Present"); the whole thing should read as dense signal at a natural one-to-two page length.

${RUBRIC}

${SHAPE}

Return ONLY JSON: { "cv": { …the CV object above… } }`

const CRITIC = `You are a demanding résumé examiner. You are shown a résumé and the score it received on each of six dimensions. For EVERY dimension scored below 5, state precisely and concretely what is missing or wrong — quote the offending lines and say what they should become. Do not be encouraging and do not restate the rubric; name the specific defect. If a dimension genuinely cannot reach 5 for a structural reason (something about the document's format or the medium rather than its content), say so explicitly and explain what the obstacle is.

${RUBRIC}

Return ONLY JSON: { "fixes": [ { "dimension": one of keywords|impact|clarity|format|completeness|conciseness, "defect": what is wrong, quoting the text, "change": the concrete change to make, "structural": true if this cannot be fixed by editing the content } ] }`

const REWRITER = `You are revising a fictional benchmark résumé to address an examiner's notes exactly. Apply every note. Keep the same fictional person, career, employers and dates unless a note says to change them. Keep the EXACT same JSON shape.

${SHAPE}

Return ONLY JSON: { "cv": { …the CV object… } }`

const fmt = (s) => DIMS.map((d) => `${d.slice(0, 4)} ${s[d].toFixed(1)}`).join('  ')

console.log(`Hill-climbing a fictional ideal CV — up to ${ROUNDS} rounds, ${SAMPLES} judge samples\n`)

let cv = normalize((await chatJSON(AUTHOR, 'Write the benchmark résumé.', { model: MODEL, temperature: 0.6 })).cv)
let best = null
const history = []
const structural = []

for (let round = 0; round <= ROUNDS; round++) {
  const text = cvToText(cv)
  const score = await scoreCv(text, { samples: SAMPLES })
  history.push({ round, score, words: text.split(/\s+/).filter(Boolean).length })
  if (!best || score.overall > best.score.overall) best = { round, score, cv, text }
  console.log(`  round ${round}  overall ${score.overall.toFixed(2)}  |  ${fmt(score)}  |  ${text.split(/\s+/).filter(Boolean).length}w`)

  const below = DIMS.filter((d) => score[d] < 5)
  if (!below.length) { console.log('\n  → 5.0 across the board.'); break }
  if (round === ROUNDS) break

  const critique = await chatJSON(
    CRITIC,
    `RESUME:\n${text}\n\nSCORES:\n${DIMS.map((d) => `${d}: ${score[d].toFixed(1)}`).join('\n')}\n\nDimensions below 5: ${below.join(', ')}`,
    { model: MODEL, temperature: 0.2 },
  )
  const fixes = (critique.fixes || []).filter((f) => f && f.change)
  for (const f of fixes) if (f.structural) structural.push({ round, dimension: f.dimension, defect: String(f.defect || '').slice(0, 300) })
  if (!fixes.length) { console.log('  (critic returned nothing actionable)'); break }

  cv = normalize((await chatJSON(
    REWRITER,
    `CURRENT CV JSON:\n${JSON.stringify(cv)}\n\nEXAMINER NOTES:\n${fixes.map((f) => `[${f.dimension}] ${f.defect}\n→ ${f.change}`).join('\n\n')}`,
    { model: MODEL, temperature: 0.4 },
  )).cv)
}

console.log('\n' + '='.repeat(72))
console.log(`BEST: round ${best.round} — overall ${best.score.overall.toFixed(2)}`)
for (const d of DIMS) console.log(`  ${d.padEnd(14)} ${best.score[d].toFixed(2)}${best.score[d] >= 5 ? '  ✓' : ''}`)
console.log(`  interview %    ${best.score.interviewProbability.toFixed(0)}`)
if (structural.length) {
  console.log('\nDimensions the critic called STRUCTURALLY capped:')
  for (const s of structural) console.log(`  [${s.dimension}] ${s.defect}`)
}

const out = path.join(ROOT, 'evals', 'out')
fs.mkdirSync(out, { recursive: true })
fs.writeFileSync(path.join(out, 'perfect-cv.json'), JSON.stringify({ cv: best.cv, score: best.score, history, structural }, null, 2))
fs.writeFileSync(path.join(out, 'perfect-cv.txt'),
  `FICTIONAL BENCHMARK CV — invented candidate, invented figures.\nBlind score ${best.score.overall.toFixed(2)}/5  (${DIMS.map((d) => `${d} ${best.score[d].toFixed(1)}`).join(', ')})\n\n${'='.repeat(72)}\n\n${best.text}\n`)
console.log(`\nWritten to evals/out/perfect-cv.txt and .json`)
console.log(`OpenAI: ${usage.calls} calls, ${(usage.in / 1000).toFixed(0)}k in / ${(usage.out / 1000).toFixed(0)}k out`)
