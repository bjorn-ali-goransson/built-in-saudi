// A converter and its inverse are the SAME QUERY to the scorer.
//
// Word order carries the direction and `fuzzy.ts` discards it on purpose — a
// person typing into a search box does not owe anybody a word order. That is
// right for almost everything and wrong for exactly one shape: `jpg to pdf` and
// `pdf to jpg` name opposite tools, and the scorer cannot tell them apart, so
// which one wins is decided by a margin that means nothing.
//
// Measured (`evals/untuned5.mjs`, the file-extension held-out set):
//
//   | query         | won                  | should have been          | gap  |
//   |---------------|----------------------|---------------------------|------|
//   | `jpg to pdf`  | pdf-to-images 360.9  | images-to-pdf 356.3       | 1.3% |
//   | `xlsx to csv` | csv-to-xlsx 371.3    | xlsx-convert 361.5        | 2.7% |
//
// `Tool.inverse` has been declared on twelve pairs since the direction
// instrument was written, and **the scorer never read it** — it fed only
// `evals/directions.mjs`. This is that declaration finally doing something for
// the reader rather than for the harness.
//
// It is a TIE-BREAK, not a re-ranking, and the three conditions are all
// load-bearing:
//
//   1. the two tools must declare each OTHER (`check-inverses.mjs` refuses a
//      one-sided declaration, so this is symmetric by construction);
//   2. their scores must be within `NOISE` — beyond that the scorer had a real
//      opinion and is not ours to overrule;
//   3. the direction must be UNAMBIGUOUS: exactly one of the two names its
//      destination as what the query asked for.
//
// Any one of those failing leaves the order exactly as it was, which is why
// this cannot regress a bench.

/** The separator in both languages. «الى» without the hamza is common typing. */
const TO = /\s(?:to|into|→|إلى|الى)\s/i

/** Below this the gap is noise. The real ones measured 1.3–2.7%; 15% sits far
 *  above them and far below a gap the scorer meant. */
const NOISE = 0.15

export interface Directional {
  id: string
  /** Both names are tried: a converter pair is named symmetrically in each
   *  language, and the query may be in either. */
  names: string[]
  inverse?: string
  score: number
}

/** The destination the query asked for, or null when it names no direction. */
export function destinationOf(query: string): string | null {
  const parts = query.split(TO)
  if (parts.length !== 2) return null
  const dest = parts[1].trim()
  const from = parts[0].trim()
  return dest && from ? dest : null
}

/** Does this tool's name say it produces that destination? */
function producesIt(names: string[], dest: string): boolean {
  const d = dest.toLowerCase()
  return names.some((name) => {
    const parts = name.split(TO)
    if (parts.length !== 2) return false
    const to = parts[1].trim().toLowerCase()
    // Either containment: "CSV / JSON" answers `csv`, and "PDF" answers
    // `pdf file`. A bare equality would miss both.
    return to.includes(d) || d.includes(to)
  })
}

/**
 * Reorder the top two when the query names a direction and they are inverses.
 *
 * Returns a NEW array; the input is untouched. Everything below the top two is
 * left alone — a tool that lost to both of them did not lose because of word
 * order.
 */
export function preferDirection<T extends Directional>(query: string, ranked: T[]): T[] {
  if (ranked.length < 2) return ranked
  const dest = destinationOf(query)
  if (!dest) return ranked

  const [first, second] = ranked
  if (first.inverse !== second.id || second.inverse !== first.id) return ranked
  if (!first.score || (first.score - second.score) / first.score > NOISE) return ranked

  const firstFits = producesIt(first.names, dest)
  const secondFits = producesIt(second.names, dest)
  // Exactly one, or there is nothing to decide with.
  if (firstFits === secondFits) return ranked
  if (firstFits) return ranked

  return [second, first, ...ranked.slice(2)]
}
