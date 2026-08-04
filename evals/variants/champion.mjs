// The variant under test = exactly what production runs today. It imports the
// real prompt module and mirrors functions/cv.js's call sequence — rebuild,
// then score the upload and the rebuild through the SAME blind scorer — so a
// win here is a win in production and nothing else.
import { GENERATE_SYSTEM, SCORE_SYSTEM, ATS_DIMENSIONS } from '../../functions/cvPrompts.js'
import { cvToText } from '../../functions/cvText.js'
// The same shaping the server applies. Without it the eval scored raw model
// output and missed real defects — e.g. an education entry carrying only an
// institution, which production silently dropped.
import { normalize, normalizeIssues, normalizeGaps } from '../../functions/cvShape.js'
import { chatJSON, pool } from '../lib/openai.mjs'
import { MODEL } from '../lib/env.mjs'

export async function scoreDocument(text, { model = MODEL } = {}) {
  const r = await chatJSON(SCORE_SYSTEM, `RESUME TEXT:\n\n${String(text).slice(0, 24000)}`, { model, temperature: 0 })
  const out = {}
  for (const d of ATS_DIMENSIONS) {
    const n = Math.round(Number(r?.[d]))
    out[d] = Number.isFinite(n) ? Math.max(1, Math.min(5, n)) : 3
  }
  return out
}

export default {
  id: 'champion',
  label: 'Production (current prompt)',
  async generate(text, { model = MODEL } = {}) {
    const r = await chatJSON(
      GENERATE_SYSTEM,
      `Here is the raw CV text. Rebuild it as JSON per the rules:\n\n${String(text).slice(0, 30000)}`,
      { model, temperature: 0.3 },
    )
    const cv = normalize(r && r.cv && typeof r.cv === 'object' ? r.cv : r)
    const [atsBefore, ats] = await pool([text, cvToText(cv)], 2, (t) => scoreDocument(t, { model }))
    return { cv, ats, atsBefore, issues: normalizeIssues(r?.issues), gaps: normalizeGaps(r?.gaps) }
  },
}
