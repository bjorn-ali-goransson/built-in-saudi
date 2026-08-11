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
  // FIRST on purpose. `check-orphans` failed the build that added
  // `retirement-age` — the gate doing its job — and adding the cluster at the
  // end did not fix it, because curated partners are taken in the order the
  // clusters are written and `gosi-salary` already had five ahead of it, so a
  // row of four filled before reaching it. Retirement is the closest relative
  // of a GOSI calculator, so it leads.
  ['retirement-age', 'gosi-salary', 'end-of-service'],
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

  // --- Added after measuring INBOUND links (`node evals/inbound.mjs`) --------
  //
  // `relatedcheck` drove OUTGOING dead ends to zero; nobody had asked the
  // incoming question, and 31 of 231 tools turned out to be pointed at by
  // nothing at all — no related row, no collection, no curated list, no
  // hand-written link. A tool nothing points at is reachable only by searching
  // for its name, which is the one thing a person who does not know it exists
  // cannot do.
  //
  // Each group below is a real family whose members the lexical scorer cannot
  // see, which is the documented reason clusters exist at all.

  // The three on-device AI tools. They share an entire subsystem — the same
  // availability gate, the same download-with-progress, the same honesty about
  // what the browser can and cannot do — and share almost no vocabulary.
  ['translate', 'summarize', 'detect-language'],

  // What a person or a business OWES, which is a life-domain and not a format
  // family: a fine, a customs bill, a register renewal, a transfer fee.
  ['traffic-fine', 'vehicle-renewal', 'id-expiry'],
  ['cr-renewal', 'vat-registration', 'zatca-wave'],
  ['import-duty', 'vat-calculator', 'currency-converter'],
  ['sponsorship-transfer', 'iqama-fees', 'end-of-service'],
  ['fuel-cost', 'vehicle-renewal', 'timesheet'],
  ['gpa-calculator', 'admission-score', 'ats-cv-optimizer'],
  ['ac-size', 'electricity-bill'],

  // Scaffolding a developer reaches for at the start of a project. They have
  // nothing lexically in common and are used within minutes of each other.
  ['gitignore', 'robots-txt', 'readme-generator', 'fake-data'],
  ['uuid-generator', 'fake-data', 'hash-generator'],
  ['ip-subnet', 'unix-timestamp', 'user-agent'],
  ['lorem-ipsum', 'fake-data', 'paper-generator'],

  // Tidying text, which is several verbs and one job.
  ['case-converter', 'line-breaks', 'slugify', 'char-finder'],
  ['readable-text', 'readability', 'text-counter'],
  ['pptx-to-text', 'docx-to-text', 'pdf-to-text'],

  // Things made for a screen or a page.
  ['meme-generator', 'favicon-generator', 'social-resize'],
  ['paper-generator', 'label-sheet', 'certificate'],
  ['typing-test', 'stopwatch', 'dice-roller'],
  ['sound-meter', 'audio-spectrum', 'metronome'],
  ['sleep-cycle', 'water-intake', 'calorie-needs'],
  // Adding `timetable` displaced `sun-times` from the last row it was in —
  // the same instability `check-orphans` exists to catch, now twice over.
  ['sun-times', 'prayer-times', 'timezone-planner'],
  // NOT clustered with `qr-code`: a cluster is SYMMETRIC, so naming it here to
  // serve the shortener also rewrote the QR generator's own row and displaced
  // `qr-reader` from the head of it — which a spec pins. Giving a tool inbound
  // links must not cost a neighbour its best outgoing one.
  ['link-shortener', 'link-preview', 'url-parser'],

  // `barcode` was the last tool nothing pointed at. Deliberately NOT clustered
  // with `qr-code`: a curated partner is taken before a lexical one, so it
  // would displace `qr-reader` at the head of the QR generator's row — which a
  // spec pins, because the filler must never take over from a real relation.
  // Pointing at it from the neighbours costs that nothing.
  ['barcode', 'qr-reader', 'zatca-qr'],

  // Orphanhood is NOT stable when a tool is added: shipping `pdf-diff` changed
  // enough lexical picks to push `json-to-types` out of every row it had been
  // in. Re-run `node evals/inbound.mjs` after adding a tool.
  ['json-to-types', 'json-formatter', 'csv-json'],
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
  // ROTATED catalogue order, starting just after this tool's own position.
  //
  // Straight catalogue order was the cause of a recurring, hand-patched
  // problem: every tool in a category filled from the top of it, so the first
  // few siblings collected all the filler links and the tail collected none.
  // Measured over the related rows alone: **17 of 235 tools had no inbound edge
  // at all**, and **79 PAIRS showed an identical row** — `carousel-split`,
  // `image-redact`, `batch-watermark` and `photo-booth` all offered the same
  // four tools. The collections and hand-written clusters were what rescued the
  // 17, which is why every new tool reshuffled WHICH 17 and orphaned a
  // different old one; `check-orphans` caught that twice in three tools.
  //
  // Rotating: **0 orphans, 0 identical pairs, and the most-pointed-at tool
  // drops from 21 inbound to 11.** It costs the stated benefit of catalogue
  // order — that a category's primary tools come first — and only in the
  // LAST-RESORT slot, after curated and lexical relations have had their pick.
  // An even graph is worth more there than a familiar name.
  const mine = all.filter((t) => t.category === tool.category)
  const start = Math.max(0, mine.findIndex((t) => t.id === tool.id))
  for (let i = 1; i <= mine.length; i++) {
    if (out.length >= limit) break
    take(mine[(start + i) % mine.length])
  }
  return out
}
