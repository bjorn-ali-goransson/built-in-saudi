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
  // Rewritten when the catalogue was cut from 244 tools to 114 (November
  // 2026): every group names only tools that still exist. Each is a family the
  // lexical scorer cannot see, which is the reason clusters exist at all — and
  // a cluster is SYMMETRIC, so naming a tool here also rewrites its own row.
  // `check-orphans` fails the build when a tool ends up pointed at by nothing.
  // The QR generator's row must lead with the reader (related-tools.spec.ts
  // pins it): a cluster is symmetric, so qr-code goes in exactly one group.
  ['qr-code', 'qr-reader', 'barcode'],
  ['prayer-times', 'qibla', 'hijri-calendar', 'adhkar'],
  ['hajj-umrah', 'qibla', 'prayer-times'],
  ['islamic-calendar', 'hijri-calendar', 'hijri-age', 'khatma'],
  ['saudi-phone', 'iban-validator', 'short-address', 'saudi-plate'],
  ['id-expiry', 'saudi-plate', 'date-diff'],
  ['calls', 'messages', 'book-me'],
  ['translate', 'detect-language', 'diacritize'],
  ['stopwatch', 'pomodoro', 'bpm-tap', 'metronome'],
  ['typing-test', 'stopwatch', 'dice-roller'],
  ['word-editor', 'excel-editor', 'powerpoint-editor', 'pdf-to-word'],
  ['pdf-merge', 'pdf-compress', 'pdf-to-images'],
  ['pdf-ocr', 'image-to-text', 'pdf-to-word'],
  ['uuid-generator', 'fake-data', 'readme-generator'],
  ['jwt-decoder', 'cert-decoder', 'url-encoder', 'url-parser'],
  ['case-converter', 'char-finder', 'readable-text'],
  ['audio-spectrum', 'audio-convert', 'metronome'],
  ['link-shortener', 'url-parser', 'url-encoder'],
  ['barcode', 'qr-reader'],
  ['csv-json', 'csv-vcard', 'excel-editor'],
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
