// The eval's measuring instrument.
//
// Production's own numbers can't answer "did we improve this CV?": the same call
// that writes the CV also grades it, is told to grade the original too, and is
// told never to score itself below the original. So it is structurally incapable
// of reporting a regression. Every number here comes from a SEPARATE call that
// sees ONE document at a time, with no hint of where it came from, no "before"
// or "after" framing, and a fixed anchored rubric — so two documents scored on
// different days are comparable, and the same document scored twice gets the
// same answer.
import { chatJSON } from './openai.mjs'
import { JUDGE_MODEL } from './env.mjs'

export const DIMS = ['keywords', 'impact', 'clarity', 'format', 'completeness', 'conciseness']

// Anchors matter more than adjectives: without a concrete description of what a
// 2 and a 4 look like, the model drifts by a point between runs and every
// before/after delta is noise.
const SCORER = `You are a strict, calibrated ATS and recruiting-screen evaluator. You are shown the PLAIN TEXT of ONE résumé, exactly as an Applicant Tracking System would parse it. Grade it.

Score each dimension as an INTEGER 1-5 using these anchors. Be strict and consistent: apply the same standard to every résumé you ever see. Do not grade on effort or potential — grade the document in front of you.

keywords — role/industry keywords, tools and technologies a parser can match against a job description.
  1 almost none · 2 a few generic ones · 3 the obvious core terms, thinly spread · 4 rich and specific, spread across skills AND experience · 5 comprehensive and precisely targeted to a clear role.
impact — achievements that are concrete and quantified, not duty lists.
  1 pure duties · 2 duties with vague claims ("improved performance") · 3 a couple of real outcomes, mostly unquantified · 4 most bullets carry a concrete result, several with numbers · 5 consistently quantified outcomes with scale and business effect.
clarity — clear, professional, filler-free, easy to skim.
  1 confusing or broken English · 2 wordy and vague · 3 readable but padded with buzzwords · 4 crisp and professional throughout · 5 exceptionally sharp; every line earns its place.
format — structure a parser and a 10-second human scan can both handle, judged ON THIS TEXT: standard section headings, employer/title/date on every role, consistent date format, sane reading order, no garbled runs.
  1 unparseable or sections missing · 2 inconsistent headings or missing dates · 3 standard but sloppy in places · 4 clean, consistent, complete · 5 textbook.
completeness — the essentials: contact route (email/phone/links), a summary, dated roles with employers, skills, education.
  1 major essentials missing · 2 several missing · 3 the basics with a notable hole · 4 everything essential present · 5 everything present and well developed.
conciseness — signal density for its length. Reward high signal per word. Penalise padding AND penalise thinness — a half-empty page wastes the reader's time as surely as a rambling one.
  1 badly padded or nearly empty · 2 noticeably thin or bloated · 3 acceptable · 4 well-filled and dense · 5 every line is signal at exactly the right length.

Also judge, independently of the six scores:
- "interviewProbability": your honest 0-100 estimate that a recruiter screening for this candidate's apparent target role passes this résumé to a hiring manager.
- "topWeakness": the single biggest reason this résumé would be rejected, in under 15 words.

Return ONLY JSON: { "keywords": n, "impact": n, "clarity": n, "format": n, "completeness": n, "conciseness": n, "interviewProbability": n, "topWeakness": "…" }`

const clamp = (n) => {
  const v = Math.round(Number(n))
  return Number.isFinite(v) ? Math.max(1, Math.min(5, v)) : 3
}

/** Blind-score one résumé. `samples` independent calls are averaged — a single
 *  sample wobbles by up to a point and would swamp the effect we're measuring. */
export async function scoreCv(text, { samples = 3, model = JUDGE_MODEL } = {}) {
  const runs = []
  for (let i = 0; i < samples; i++) {
    const r = await chatJSON(SCORER, `RESUME TEXT:\n\n${String(text).slice(0, 24000)}`, {
      model,
      // Temperature 0 for repeatability; the samples vary only by API nondeterminism.
      temperature: 0,
    })
    runs.push(r)
  }
  const out = { samples: runs }
  for (const d of DIMS) out[d] = avg(runs.map((r) => clamp(r[d])))
  out.interviewProbability = avg(runs.map((r) => Number(r.interviewProbability) || 0))
  out.overall = avg(DIMS.map((d) => out[d]))
  out.topWeakness = runs[0]?.topWeakness || ''
  return out
}

const avg = (xs) => xs.reduce((a, b) => a + b, 0) / (xs.length || 1)

// Did the rewrite silently drop things the candidate cannot afford to lose, or
// assert things the source never supported? Both are invisible to a score.
const DIFFER = `You compare a candidate's ORIGINAL résumé text against a REWRITTEN version produced by an automated editor. The editor is allowed to condense wording, drop fluff (objective statements, references, GPA, coursework, addresses, photos) and reorder sections. It is NOT allowed to lose hard facts a recruiter or ATS needs, and it is NOT allowed to state anything the original did not support.

Report:
- "dropped": facts present in the ORIGINAL and absent from the REWRITE that a candidate would object to losing. Each { "item": the specific fact, "kind": "employer"|"role"|"date"|"technology"|"certification"|"education"|"metric"|"contact"|"link"|"other", "severity": "high"|"medium"|"low" }. "high" = materially damages the application (a whole job, a certification, a contact route, a headline technology, a quantified achievement). "low" = the editor was right to cut it. Ignore legitimate fluff removal entirely — do not report it.
- "invented": claims in the REWRITE not supported by the ORIGINAL. Each { "item": the claim, "kind": "metric"|"technology"|"employer"|"date"|"seniority"|"other", "severity": "high"|"medium"|"low" }. A fabricated number or an inflated seniority is "high". Rephrasing is not invention — only new factual content.

Be precise and literal. If nothing qualifies, return empty arrays.

Return ONLY JSON: { "dropped": [...], "invented": [...] }`

export async function diffContent(sourceText, resultText, { model = JUDGE_MODEL } = {}) {
  const r = await chatJSON(
    DIFFER,
    `ORIGINAL:\n${String(sourceText).slice(0, 16000)}\n\n---\n\nREWRITE:\n${String(resultText).slice(0, 16000)}`,
    { model, temperature: 0 },
  )
  const norm = (xs) => (Array.isArray(xs) ? xs : []).map((x) => ({
    item: String(x?.item || '').slice(0, 200),
    kind: String(x?.kind || 'other'),
    severity: ['high', 'medium', 'low'].includes(String(x?.severity)) ? String(x.severity) : 'medium',
  })).filter((x) => x.item)
  return { dropped: norm(r.dropped), invented: norm(r.invented) }
}
