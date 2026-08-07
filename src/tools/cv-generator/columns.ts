// Reading a two-column CV without interleaving it.
//
// The line rebuild groups pdf.js text items by their Y position, which is right
// for a single column and destroys a sidebar layout: a skill on the left and a
// bullet on the right share a Y, so they are joined into one line. Measured on
// the sidebar template (`evals/pdfextract.mjs`), EVERY row merged —
// "SKILLS  EXPERIENCE", then "Python  Senior Analyst, Aramco". The rewriter and
// the scorer both then work from a document that says something nobody wrote.
//
// The fix is deliberately conservative, because most CVs are one column and a
// wrong split would be worse than the bug: a gutter counts only when it is a
// genuinely empty vertical band, wide enough to be a layout gutter rather than
// a word space, near the middle of the page, with real content on both sides.

export interface Item { str: string; transform: number[]; width?: number }

/** Fraction of the page width a gap must span to count as a gutter. */
const MIN_GUTTER = 0.045
/** A gutter has to sit in the middle-ish of the page, not at either margin. */
const SEARCH_FROM = 0.2
const SEARCH_TO = 0.8
/** Both sides need enough content that this is a layout, not a stray label. */
const MIN_ITEMS_PER_SIDE = 4

/**
 * Find the x of an empty vertical band, or null when the page is one column.
 *
 * Works on the items' horizontal extents rather than on rendered pixels: a
 * column boundary is exactly "an x range no text crosses".
 */
export function findGutter(items: Item[], pageWidth: number): number | null {
  const spans = items
    .filter((i) => i.str.trim())
    .map((i) => ({ from: i.transform[4], to: i.transform[4] + (i.width ?? 0) }))
    .filter((s) => Number.isFinite(s.from) && Number.isFinite(s.to))
  if (spans.length < MIN_ITEMS_PER_SIDE * 2) return null

  // Sweep candidate boundaries and keep the widest empty band in range.
  const from = pageWidth * SEARCH_FROM
  const to = pageWidth * SEARCH_TO
  const edges = [...new Set(spans.map((s) => s.to).filter((x) => x >= from && x <= to))].sort((a, b) => a - b)

  let best: { x: number; width: number } | null = null
  for (const edge of edges) {
    // How far right can we go from here before hitting text?
    let next = Infinity
    for (const s of spans) {
      if (s.from >= edge && s.from < next) next = s.from
      // Anything straddling the edge kills it outright.
      if (s.from < edge && s.to > edge) { next = -Infinity; break }
    }
    if (!Number.isFinite(next) || next <= edge) continue
    const width = next - edge
    if (width > (best?.width ?? 0)) best = { x: (edge + next) / 2, width }
  }

  if (!best || best.width < pageWidth * MIN_GUTTER) return null
  const left = spans.filter((s) => s.to <= best!.x).length
  const right = spans.filter((s) => s.from >= best!.x).length
  if (left < MIN_ITEMS_PER_SIDE || right < MIN_ITEMS_PER_SIDE) return null
  return best.x
}

/**
 * Split items into reading order: the whole left column, then the whole right.
 *
 * Returns a single group when there is no gutter, so the caller's existing
 * line-rebuild is unchanged for the common case.
 */
export function columnGroups(items: Item[], pageWidth: number): Item[][] {
  const x = findGutter(items, pageWidth)
  if (x == null) return [items]
  const left = items.filter((i) => i.transform[4] < x)
  const right = items.filter((i) => i.transform[4] >= x)
  return [left, right]
}
