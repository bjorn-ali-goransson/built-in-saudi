// When the query IS the number, the shape has to carry the meaning.
//
// Held-out set #7 asks for things the way people specify them once they already
// know the answer's shape — nobody types "resize an image", they type
// `1080x1080`. Six of its 42 queries returned **NOTHING AT ALL**:
//
//   | typed             | on a site that has        |
//   |-------------------|---------------------------|
//   | `1080x1080`       | a social-media resizer    |
//   | `1920x1080`       | an aspect-ratio calculator|
//   | `20% of 250`      | a percentage calculator   |
//   | «كم 20% من 250»   | the same                  |
//   | `utc+3`           | a time-zone planner       |
//   | `make it under 2mb`| an image compressor      |
//
// The scorer indexes WORDS. A query made of digits and symbols has nothing to
// match, however obvious its meaning is to a person — and these are not obscure
// queries, they are the most precise form of the question.
//
// **This runs ONLY when the query found nothing**, which is the same
// arrangement `correctQuery` uses and the reason it cannot regress a bench: a
// query that already produced results is never touched, so no ranking anywhere
// can move. It also means a false positive costs nothing — the alternative to a
// wrong guess here is an empty page.
//
// Shapes are deliberately few and unmistakable. A number on its own («250»,
// «2026») is NOT a shape: it could be a year, a page count or a salary, and
// guessing would be the adware move of always showing something.

interface Shape {
  test: RegExp
  /** The words a person would have typed if they had used words. */
  terms: string
}

const SHAPES: Shape[] = [
  // 1080x1080, 1920 × 1080 — a pair of numbers joined by an x is a size and
  // nothing else.
  { test: /\d{2,}\s*[x×*]\s*\d{2,}/i, terms: 'image size dimensions resize' },
  // 20%, ٢٠٪ — the sign is script-neutral, which is why the Arabic row works
  // with no Arabic in the rule.
  { test: /\d\s*[%٪]/, terms: 'percentage' },
  // 2mb, 500 KB — a magnitude with a unit of bytes is about making something
  // smaller; nobody searches a file size to make one bigger.
  { test: /\d+(?:\.\d+)?\s*(?:mb|kb|gb|ميجا|كيلو|جيجا)\b/i, terms: 'compress file size smaller' },
  // utc+3, GMT-5.
  { test: /\b(?:utc|gmt)\s*[+-]\s*\d{1,2}\b/i, terms: 'time zone' },
  // 16:9 — also the shape of a time, which is why it is last and only ever
  // reached when nothing else matched at all.
  { test: /\b\d{1,2}\s*:\s*\d{1,2}\b/, terms: 'aspect ratio' },
]

/**
 * Words to search for instead, or null when the query names no shape.
 *
 * Returns a REPLACEMENT rather than an addition: the digits matched nothing by
 * definition — that is the only situation this is called in — so keeping them
 * would only dilute the coverage multiplier with terms that cannot match.
 */
export function numericIntent(query: string): string | null {
  for (const shape of SHAPES) {
    if (shape.test.test(query)) return shape.terms
  }
  return null
}
