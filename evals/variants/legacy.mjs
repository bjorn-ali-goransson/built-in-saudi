// The prompt production ran until 2026-08-04: one call that rewrote the CV,
// graded the original, graded itself, and was told never to score itself below
// the original. Kept as the eval's regression baseline — every future change
// should still beat this.
import { GENERATE_SYSTEM_LEGACY } from './legacyprompts.mjs'
import { chatJSON } from '../lib/openai.mjs'
import { MODEL } from '../lib/env.mjs'

export default {
  id: 'legacy',
  label: 'Legacy (single self-scoring call)',
  async generate(text, { model = MODEL } = {}) {
    const r = await chatJSON(
      GENERATE_SYSTEM_LEGACY,
      `Here is the raw CV text. Rebuild it as JSON per the rules:\n\n${String(text).slice(0, 30000)}`,
      { model, temperature: 0.3 },
    )
    const cv = r && r.cv && typeof r.cv === 'object' ? r.cv : r
    return { cv, ats: r?.ats || null, atsBefore: r?.atsBefore || null, issues: r?.issues || [], gaps: r?.gaps || [] }
  },
}
