// The related-tools selection, taking the tool list as an ARGUMENT.
//
// Split out of `relatedTools.ts` so `evals/relatedcheck.mjs` can call the real
// function instead of keeping a copy of it. The copy drifted the moment the
// category fill was added to production and not to it — and went on reporting
// 77 dead ends, 37% of pages, long after the fix took that to 0. A mirror that
// reproduces the code you replaced is worse than no mirror.
//
// The only reason a copy existed is that `relatedTools.ts` imports `liveTools`,
// and through it every React component on the site. Passing the list in removes
// that, and `./fuzzy` has no runtime imports either — so this whole module
// compiles standalone with tsc, exactly like `cvPatch.ts`.
import { scoreTool } from './fuzzy'

/** The shape this needs. Deliberately narrower than `Tool`. */
export interface RelatableTool {
  id: string
  name: string
  category: string
  keywords: string[]
  tagline: string
  nameAr?: string
}

/**
 * Below this, the suggestions measured as noise rather than relations. Lowering
 * it was the obvious alternative to the category fill and would have
 * reintroduced exactly the noise it was set to exclude (gosi-salary →
 * ip-subnet at 75).
 */
export const MIN_SCORE = 120

/**
 * Groups whose members belong together by subject rather than by wording.
 * Anyone dealing with one is plausibly dealing with another, and no lexical
 * scorer can see that.
 */
export const CLUSTERS: string[][] = [
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
  // Communication holds one tool, so nothing else can fill this row.
  ['calls', 'book-me'],
]

/** Curated partners for a tool, in the order they were written. */
export function curated(id: string): string[] {
  const out: string[] = []
  for (const group of CLUSTERS) {
    if (!group.includes(id)) continue
    for (const other of group) if (other !== id && !out.includes(other)) out.push(other)
  }
  return out
}

export function pickRelated<T extends RelatableTool>(tool: T, all: T[], limit = 4): T[] {
  const byId = new Map(all.map((t) => [t.id, t]))
  const out: T[] = []
  const take = (t: T | undefined) => {
    if (t && t.id !== tool.id && !out.some((x) => x.id === t.id)) out.push(t)
  }

  for (const id of curated(tool.id)) {
    if (out.length >= limit) break
    take(byId.get(id))
  }
  if (out.length >= limit) return out.slice(0, limit)

  // The tool's own vocabulary: its name plus the keywords its author put first.
  const query = [tool.name, ...tool.keywords.slice(0, 4)].join(' ')
  const scored = all
    .filter((t) => t.id !== tool.id && !out.some((x) => x.id === t.id))
    .map((t) => ({ tool: t, score: scoreTool(query, t) }))
    .filter((x) => x.score >= MIN_SCORE)
    .sort((a, b) => b.score - a.score)

  for (const { tool: t } of scored) {
    if (out.length >= limit) break
    take(t)
  }
  if (out.length >= limit) return out.slice(0, limit)

  // Last, the tool's OWN CATEGORY — which is the site's hand-curated
  // life-domain grouping, and therefore exactly the signal the lexical scorer
  // is documented above as being blind to.
  //
  // This was added on a measurement: **81 of 203 tool pages (40%) showed no
  // related row at all** (`node evals/relatedcheck.mjs`). "Nothing rather than
  // something arbitrary" is the right answer to a bad suggestion and the wrong
  // answer to a page — a tool with no row is somewhere the catalogue leads you
  // and cannot lead you out of, except back to the search box.
  //
  // A sibling in the same category is not arbitrary the way a below-threshold
  // lexical hit is: someone put it there. Lowering MIN_SCORE instead would have
  // reintroduced the exact noise it was measured to exclude (gosi-salary →
  // ip-subnet at 75). Measured after: dead ends 81 → 1, full rows 38 → 202.
  //
  // Catalogue order, so the curated primary tools of a category come first.
  const mine = all.filter((t) => t.category === tool.category)
  for (const t of mine) {
    if (out.length >= limit) break
    take(t)
  }
  return out
}
