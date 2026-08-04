// What does the score do if the candidate actually HAS the numbers?
//
//   node evals/ceiling.mjs [--n 6] [--rounds 3] [--samples 2]
//
// The hypothesis this checks: `impact` is capped by the candidate's facts, not
// by our wording, so the route to a 5 is the follow-up questions — and enough
// rounds of them should walk the score up to the scorer's ceiling.
//
// Everything the "candidate" says here is FABRICATED by a model role-playing
// someone with a well-quantified career. That is the point: we are measuring
// the headroom of the mechanism, so we need a cooperative candidate. Nothing
// produced here is a real person's CV — the rendered example is anonymised, and
// none of it is written back anywhere.
//
// Three things get scored:
//   round 0   the optimized CV as the tool produces it today
//   round 1-N after each improve pass with the candidate's answers folded in
//   oracle    every bullet quantified in one go — the scorer's practical ceiling
import fs from 'node:fs'
import path from 'node:path'
import { ROOT, MODEL } from './lib/env.mjs'
import { extractFile } from './lib/extract.mjs'
import { cvToText } from './lib/cvText.mjs'
import { scoreCv, DIMS } from './lib/judge.mjs'
import { chatJSON, pool, usage } from './lib/openai.mjs'
import { REFINE_SYSTEM } from '../functions/cvPrompts.js'
import variant from './variants/champion.mjs'

const argv = process.argv.slice(2)
const flag = (n, d) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : d }
const N = Number(flag('n', 6))
const ROUNDS = Number(flag('rounds', 3))
const SAMPLES = Number(flag('samples', 2))

const CANDIDATE = `You are role-playing a job candidate answering an editor's follow-up questions about your own CV. You are someone who DID keep track of their numbers, so you always have a concrete figure to hand. For each question give a short first-person answer containing a specific, realistic figure — a percentage, a count, a scale, money, a time saved, a team size. Keep every answer consistent with the CV you are shown and with a normal career; no absurd or implausible numbers.
Return ONLY JSON: { "answers": [ { "id": the gap id, "answer": "…" } ] }`

// The upper bound: what the scorer gives a CV where nothing is left unquantified.
const ORACLE = `You are rewriting a CV for a SYNTHETIC BENCHMARK — this is not a real person's document and will never be used as one. Rewrite it so that essentially every experience bullet and project carries a concrete, realistic, specific figure: scale (users, transactions, systems, team size), improvement (a percentage), money, or time saved. Invent plausible figures where the CV has none — that is explicitly wanted here. Keep the same roles, employers, dates, technologies and structure; change only the level of quantification and the wording around it. Keep the exact same JSON shape you were given.
Return ONLY JSON: { "cv": { …the same CV object, quantified… } }`

function improveTask(answers) {
  const lead = 'The candidate has ANSWERED your follow-up questions (below). Fold their answers into the CV to close the gaps and RAISE the ATS score — add the metrics, keywords, skills, target-role tuning or missing details they supplied, in the right places. Use ONLY what their answers and the existing CV support; never invent facts they did not give, and if an answer is blank leave that aspect as it was. Keep every rule'
  return `${lead}.\n\nThe candidate's answers to your follow-up questions:\n${answers.map((a) => `Q: ${a.question}\nA: ${a.answer}`).join('\n\n').slice(0, 6000)}\n\nRETURN ONLY CHANGED SECTIONS (this OVERRIDES the return shape above): under "cv" include ONLY the sections your edits actually change — for any array section you touch include the COMPLETE section (every item, ids preserved); include "summary" only if you rewrote it; OMIT every section you leave unchanged (the client keeps those, which saves tokens). Still return "ats", "gaps" and "summary".`
}

/** Strip the real person out — fabricated achievements must not travel attached
 *  to someone's actual name, email or phone. */
function anonymise(cv) {
  return {
    ...cv,
    name: 'Sample Candidate',
    contact: { location: cv.contact?.location || '', phone: '+000 000 0000', email: 'sample.candidate@example.com', links: (cv.contact?.links || []).map((l) => ({ label: l.label, url: 'https://example.com' })) },
  }
}

const files = fs.readdirSync(path.join(ROOT, 'evals', 'cvs')).filter((f) => /\.(pdf|docx|txt|md)$/i.test(f)).sort().slice(0, N)
console.log(`${files.length} CVs — ${ROUNDS} improve rounds with a cooperative candidate, then an all-quantified oracle\n`)

let example = null

const rows = await pool(files, 3, async (file, idx) => {
  try {
    const source = await extractFile(path.join(ROOT, 'evals', 'cvs', file))
    const gen = await variant.generate(source)
    let cv = gen.cv
    let gaps = gen.gaps
    const scores = [await scoreCv(cvToText(cv), { samples: SAMPLES })]
    const asked = []

    for (let round = 0; round < ROUNDS; round++) {
      if (!gaps.length) { scores.push(scores[scores.length - 1]); continue }
      asked.push(gaps.length)
      const said = await chatJSON(
        CANDIDATE,
        `CV:\n${cvToText(cv)}\n\nQuestions:\n${gaps.map((g) => `[${g.id}] ${g.question}`).join('\n')}`,
        { model: MODEL, temperature: 0.7 },
      )
      const byId = new Map((said.answers || []).map((a) => [String(a.id), String(a.answer || '')]))
      const answers = gaps.map((g) => ({ question: g.question, answer: byId.get(g.id) || '' })).filter((a) => a.answer)
      if (!answers.length) { scores.push(scores[scores.length - 1]); continue }

      const r = await chatJSON(REFINE_SYSTEM, `Current CV JSON:\n${JSON.stringify(cv).slice(0, 24000)}\n\n${improveTask(answers)}`, { model: MODEL, temperature: 0.3 })
      const patch = r && r.cv && typeof r.cv === 'object' ? r.cv : {}
      cv = { ...cv, ...patch }
      gaps = Array.isArray(r?.gaps) ? r.gaps.filter((g) => g && g.question).map((g, i) => ({ id: String(g.id || `g${i}`), question: String(g.question) })) : []
      scores.push(await scoreCv(cvToText(cv), { samples: SAMPLES }))
    }

    const orc = await chatJSON(ORACLE, `CV JSON:\n${JSON.stringify(gen.cv).slice(0, 24000)}`, { model: MODEL, temperature: 0.4 })
    const oracleCv = orc && orc.cv && typeof orc.cv === 'object' ? orc.cv : gen.cv
    const oracle = await scoreCv(cvToText(oracleCv), { samples: SAMPLES })

    if (idx === 0) example = { base: anonymise(gen.cv), improved: anonymise(cv), oracle: anonymise(oracleCv), scores, oracleScore: oracle }
    process.stdout.write(`  ✓ ${file.slice(0, 38).padEnd(40)} ${scores.map((s) => s.overall.toFixed(2)).join(' → ')}  | oracle ${oracle.overall.toFixed(2)}\n`)
    return { file, scores, oracle, asked }
  } catch (e) {
    process.stdout.write(`  ✗ ${file.slice(0, 38)}: ${e.message}\n`)
    return null
  }
})

const ok = rows.filter(Boolean)
const mean = (xs) => xs.reduce((a, b) => a + b, 0) / (xs.length || 1)

console.log('\n' + '='.repeat(76))
console.log('SCORE AS THE CANDIDATE SUPPLIES NUMBERS  (blind judge, same rubric throughout)')
console.log('='.repeat(76))
const cols = ['round 0', ...Array.from({ length: ROUNDS }, (_, i) => `round ${i + 1}`), 'oracle']
console.log('  dimension       ' + cols.map((c) => c.padStart(9)).join(''))
for (const d of [...DIMS, 'overall']) {
  const cells = []
  for (let r = 0; r <= ROUNDS; r++) cells.push(mean(ok.map((x) => x.scores[Math.min(r, x.scores.length - 1)][d])).toFixed(2).padStart(9))
  cells.push(mean(ok.map((x) => x.oracle[d])).toFixed(2).padStart(9))
  console.log(`  ${d.padEnd(15)}` + cells.join(''))
}
const ip = []
for (let r = 0; r <= ROUNDS; r++) ip.push(mean(ok.map((x) => x.scores[Math.min(r, x.scores.length - 1)].interviewProbability)).toFixed(1).padStart(9))
ip.push(mean(ok.map((x) => x.oracle.interviewProbability)).toFixed(1).padStart(9))
console.log(`  ${'interview %'.padEnd(15)}` + ip.join(''))
console.log(`\n  questions asked per round: ${ok.flatMap((x) => x.asked).length ? mean(ok.flatMap((x) => x.asked)).toFixed(1) : '0'}`)
console.log(`  CVs at overall ≥4.5 — round 0: ${ok.filter((x) => x.scores[0].overall >= 4.5).length}/${ok.length}` +
  `, final: ${ok.filter((x) => x.scores[x.scores.length - 1].overall >= 4.5).length}/${ok.length}` +
  `, oracle: ${ok.filter((x) => x.oracle.overall >= 4.5).length}/${ok.length}`)
console.log(`  impact — round 0 ${mean(ok.map((x) => x.scores[0].impact)).toFixed(2)}, final ${mean(ok.map((x) => x.scores[x.scores.length - 1].impact)).toFixed(2)}, oracle ${mean(ok.map((x) => x.oracle.impact)).toFixed(2)}`)

if (example) {
  const out = path.join(ROOT, 'evals', 'out')
  const banner = (t) => `\n${'='.repeat(72)}\n${t}  — FIGURES BELOW ARE FABRICATED FOR TESTING; IDENTITY ANONYMISED\n${'='.repeat(72)}\n`
  fs.writeFileSync(path.join(out, 'ceiling-example.txt'),
    banner(`ROUND 0 — as the tool produces it   (overall ${example.scores[0].overall.toFixed(2)}, impact ${example.scores[0].impact.toFixed(2)})`) + cvToText(example.base) +
    banner(`AFTER ${ROUNDS} IMPROVE ROUNDS   (overall ${example.scores[example.scores.length - 1].overall.toFixed(2)}, impact ${example.scores[example.scores.length - 1].impact.toFixed(2)})`) + cvToText(example.improved) +
    banner(`ORACLE — everything quantified   (overall ${example.oracleScore.overall.toFixed(2)}, impact ${example.oracleScore.impact.toFixed(2)})`) + cvToText(example.oracle))
  fs.writeFileSync(path.join(out, 'ceiling-example.json'), JSON.stringify(example, null, 2))
  console.log(`\nExample written to evals/out/ceiling-example.txt (anonymised, fabricated figures)`)
}
console.log(`\nOpenAI: ${usage.calls} calls, ${(usage.in / 1000).toFixed(0)}k in / ${(usage.out / 1000).toFixed(0)}k out`)
