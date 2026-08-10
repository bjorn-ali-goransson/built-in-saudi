// "Is this PDF a picture of a document?" — asked in two places.
//
// `pdf-to-text/extract.ts` and `pdf-to-word/extractRuns.ts` are separate
// extractors on purpose: one wants text, the other wants positioned runs with
// their fonts, and merging them would give each the other's cost. But both have
// to answer the same question, and both carried their own copy of the answer.
//
// They agreed — and that is exactly the state `joinPages` was in before it
// drifted. The copies were found by injecting a regression into one of them to
// prove a spec could fail, watching the spec pass, and discovering the tool
// under test reads the OTHER one. A duplicated rule is a rule that will be
// half-changed.

/**
 * Average characters per page below which a PDF is a scan.
 *
 * Ten is deliberately low. A real page of prose carries hundreds, so anything
 * near this is a page with a stray header or a page number on it and nothing
 * else — and the cost of the two mistakes is not symmetric. Calling a document
 * a scan sends somebody to OCR that will work anyway; calling a scan a document
 * hands them an empty file and lets them find out later.
 */
export const SCAN_CHARS_PER_PAGE = 10

/** True when the pages carry so little text that they must be pictures. */
export const looksScanned = (chars: number, pages: number): boolean =>
  pages > 0 && chars / pages < SCAN_CHARS_PER_PAGE
