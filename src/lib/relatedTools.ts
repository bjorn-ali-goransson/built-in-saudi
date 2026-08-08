// "Related tools" for a tool page, derived where that works and curated where
// it does not.
//
// Every tool page already links to EVERY other tool, in a crawlable block that
// exists to kill orphan pages. That is right for a search engine and useless
// for a person: a list of 197 is the same as no list at all.
//
// Deriving the relations from the existing scorer was measured before it was
// built, and the result splits cleanly by score:
//
//   csv-to-xlsx -> xlsx-convert (385), csv-vcard (266), csv-split (261)   good
//   qr-code     -> qr-reader (273), zatca-qr (212), barcode (149)         good
//   gosi-salary -> ip-subnet (75), calorie-needs (63), water-intake (56)  noise
//   early-settlement -> data-anonymize (12), dice-roller (5)              noise
//
// The reason is not a bug in the scorer. **Lexical similarity finds format
// families and is blind to life-domains**: PDF tools share the word "PDF",
// while GOSI, rent and vehicle registration share no vocabulary at all even
// though anyone dealing with one is plausibly dealing with another. So the
// automatic half is thresholded, and the handful of domain clusters are named
// by hand — eight groups rather than 197 rows of curation.

import type { Tool } from '../tools/types'
import { liveTools } from '../tools'
import { scoreTool } from './fuzzy'

/**
 * Below this, the suggestions measured as noise rather than relations. A tool
 * with nothing above it shows no related row at all, which is better than
 * showing something arbitrary.
 */
const MIN_SCORE = 120

/**
 * Groups whose members belong together by subject rather than by wording.
 * Anyone dealing with one is plausibly dealing with another, and no lexical
 * scorer can see that.
 */
const CLUSTERS: string[][] = [
  ['gosi-salary', 'end-of-service', 'leave-overtime', 'ats-cv-optimizer'],
  ['vat-calculator', 'vat-registration', 'zatca-qr', 'invoice-generator'],
  ['early-settlement', 'gosi-salary', 'zakat-calculator'],
  ['vehicle-renewal', 'saudi-plate', 'id-expiry'],
  ['rent-rules', 'vehicle-renewal', 'id-expiry'],
  ['prayer-times', 'prayer-timetable', 'qibla', 'hijri-calendar'],
  ['hajj-umrah', 'qibla', 'prayer-times'],
  ['exit-reentry', 'id-expiry', 'hajj-umrah'],
  ['electricity-bill', 'vat-calculator', 'percentage-calculator'],
  ['stopwatch', 'pomodoro', 'countdown', 'bpm-tap'],
  ['admission-score', 'percentage-calculator', 'ats-cv-optimizer'],
  ['saudi-phone', 'iban-validator', 'short-address'],
]

/** Curated partners for a tool, in the order they were written. */
function curated(id: string): string[] {
  const out: string[] = []
  for (const group of CLUSTERS) {
    if (!group.includes(id)) continue
    for (const other of group) if (other !== id && !out.includes(other)) out.push(other)
  }
  return out
}

/**
 * Up to `limit` tools worth showing beside this one.
 *
 * Curated partners come first because they were chosen; the rest is filled from
 * the scorer, and only above the threshold. Returns fewer than `limit`, or
 * nothing, rather than padding with something arbitrary.
 */
export function relatedTools(tool: Tool, limit = 4): Tool[] {
  const byId = new Map(liveTools.map((t) => [t.id, t]))
  const out: Tool[] = []
  const take = (t: Tool | undefined) => {
    if (t && t.id !== tool.id && !out.some((x) => x.id === t.id)) out.push(t)
  }

  for (const id of curated(tool.id)) {
    if (out.length >= limit) break
    take(byId.get(id))
  }
  if (out.length >= limit) return out.slice(0, limit)

  // The tool's own vocabulary: its name plus the keywords its author put first.
  const query = [tool.name, ...tool.keywords.slice(0, 4)].join(' ')
  const scored = liveTools
    .filter((t) => t.id !== tool.id && !out.some((x) => x.id === t.id))
    .map((t) => ({ tool: t, score: scoreTool(query, t) }))
    .filter((x) => x.score >= MIN_SCORE)
    .sort((a, b) => b.score - a.score)

  for (const { tool: t } of scored) {
    if (out.length >= limit) break
    take(t)
  }
  return out
}
