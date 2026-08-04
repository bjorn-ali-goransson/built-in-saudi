// How much headroom is left once the CANDIDATE answers?
//
//   node evals/improve.mjs [--n 6] [--samples 2]
//
// Nine of ten optimized CVs are blocked on the same dimension — `impact`, i.e.
// quantified achievements — and the rewriter is forbidden from inventing a
// number, correctly. So the interesting question is not "can the prompt do
// better" but "what does the improve pass actually recover when the candidate
// supplies the figures the gaps ask for".
//
// To measure that we need answers. A separate model call ROLE-PLAYS the
// candidate, answering each gap with a plausible concrete figure consistent
// with their CV. Those numbers are fiction — which is fine here, because we are
// measuring the MECHANISM (does supplying figures raise the score, and does the
// improve pass fold them in) and never touching a real candidate's document.
import fs from 'node:fs'
import path from 'node:path'
import { ROOT, MODEL } from './lib/env.mjs'
import { extractFile } from './lib/extract.mjs'
import { cvToText } from './lib/cvText.mjs'
import { scoreCv, DIMS } from './lib/judge.mjs'
import { chatJSON, pool, usage } from './lib/openai.mjs'
import { REFINE_SYSTEM } from '../functions/cvPrompts.js'
const argv = process.argv.slice(2)
const flag = (n, d) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : d }
// Which rewrite prompt to test the improve loop against (default: production).
const variant = (await import(`./variants/${flag('variant', 'champion')}.mjs`)).default
const N = Number(flag('n', 6))
const SAMPLES = Number(flag('samples', 2))

const CANDIDATE = `You are role-playing a job candidate answering an editor's follow-up questions about your own CV. For each question give a SHORT, concrete, realistic answer in the first person, containing a specific figure wherever the question asks for one (a percentage, a count, a time saved, a money amount, a team size). Keep every answer consistent with the CV you are given and with a normal career — no absurd numbers. One or two sentences each.
Return ONLY JSON: { "answers": [ { "id": the gap id, "answer": "…" } ] }`

// Mirrors the improve branch of functions/cv.js.
function improveTask(answers) {
  const lead = 'The candidate has ANSWERED your follow-up questions (below). Fold their answers into the CV to close the gaps and RAISE the ATS score — add the metrics, keywords, skills, target-role tuning or missing details they supplied, in the right places. Use ONLY what their answers and the existing CV support; never invent facts they did not give, and if an answer is blank leave that aspect as it was. Keep every rule'
  return `${lead}.\n\nThe candidate's answers to your follow-up questions:\n${answers.map((a) => `Q: ${a.question}\nA: ${a.answer}`).join('\n\n').slice(0, 6000)}\n\nRETURN ONLY CHANGED SECTIONS (this OVERRIDES the return shape above): under "cv" include ONLY the sections your edits actually change — for any array section you touch include the COMPLETE section (every item, ids preserved); include "summary" only if you rewrote it; OMIT every section you leave unchanged (the client keeps those, which saves tokens). Still return "ats", "gaps" and "summary".`
}

const files = fs.readdirSync(path.join(ROOT, 'evals', 'cvs')).filter((f) => /\.(pdf|docx|txt|md)$/i.test(f)).sort().slice(0, N)
console.log(`${files.length} CVs — generate → answer the gaps → improve → re-score\n`)

const rows = await pool(files, 3, async (file) => {
  try {
    const source = await extractFile(path.join(ROOT, 'evals', 'cvs', file))
    const gen = await variant.generate(source)
    const afterGen = await scoreCv(cvToText(gen.cv), { samples: SAMPLES })
    if (!gen.gaps.length) return { file, afterGen, afterImp: afterGen, gaps: 0, note: 'no gaps asked' }

    // The candidate answers.
    const said = await chatJSON(
      CANDIDATE,
      `CV:\n${cvToText(gen.cv)}\n\nQuestions:\n${gen.gaps.map((g) => `[${g.id}] ${g.question}`).join('\n')}`,
      { model: MODEL, temperature: 0.6 },
    )
    const byId = new Map((said.answers || []).map((a) => [String(a.id), String(a.answer || '')]))
    const answers = gen.gaps.map((g) => ({ question: g.question, answer: byId.get(g.id) || '' })).filter((a) => a.answer)
    if (!answers.length) return { file, afterGen, afterImp: afterGen, gaps: gen.gaps.length, note: 'no answers produced' }

    const r = await chatJSON(
      REFINE_SYSTEM,
      `Current CV JSON:\n${JSON.stringify(gen.cv).slice(0, 24000)}\n\n${improveTask(answers)}`,
      { model: MODEL, temperature: 0.3 },
    )
    const patch = r && r.cv && typeof r.cv === 'object' ? r.cv : {}
    const merged = { ...gen.cv, ...patch }
    const afterImp = await scoreCv(cvToText(merged), { samples: SAMPLES })
    process.stdout.write(`  ✓ ${file.slice(0, 40)}\n`)
    return { file, afterGen, afterImp, gaps: gen.gaps.length, answered: answers.length }
  } catch (e) {
    process.stdout.write(`  ✗ ${file.slice(0, 40)}: ${e.message}\n`)
    return null
  }
})

const ok = rows.filter(Boolean)
const mean = (xs) => xs.reduce((a, b) => a + b, 0) / (xs.length || 1)
const f1 = (n) => (n >= 0 ? '+' : '') + n.toFixed(2)

console.log('\n' + '='.repeat(64))
console.log('AFTER GENERATE  →  AFTER THE CANDIDATE ANSWERS')
console.log('='.repeat(64))
console.log('  dimension        gen    improved   delta')
for (const d of [...DIMS, 'overall']) {
  const a = mean(ok.map((r) => r.afterGen[d]))
  const b = mean(ok.map((r) => r.afterImp[d]))
  console.log(`  ${d.padEnd(15)} ${a.toFixed(2).padStart(5)} ${b.toFixed(2).padStart(9)} ${f1(b - a).padStart(9)}`)
}
const pa = mean(ok.map((r) => r.afterGen.interviewProbability))
const pb = mean(ok.map((r) => r.afterImp.interviewProbability))
console.log(`  ${'interview %'.padEnd(15)} ${pa.toFixed(1).padStart(5)} ${pb.toFixed(1).padStart(9)} ${f1(pb - pa).padStart(9)}`)
console.log(`\n  questions asked per CV: ${mean(ok.map((r) => r.gaps)).toFixed(1)}`)
console.log(`  CVs reaching impact ≥4.5: ${ok.filter((r) => r.afterImp.impact >= 4.5).length}/${ok.length} (was ${ok.filter((r) => r.afterGen.impact >= 4.5).length}/${ok.length})`)
console.log(`\nOpenAI: ${usage.calls} calls, ${(usage.in / 1000).toFixed(0)}k in / ${(usage.out / 1000).toFixed(0)}k out`)
fs.writeFileSync(path.join(ROOT, 'evals', 'out', 'improve.json'), JSON.stringify(ok, null, 2))
