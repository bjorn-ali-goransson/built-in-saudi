// The projective transform that turns a photo of a page into a page.
//
// A camera held over a document is never square to it, so the page arrives as a
// quadrilateral. Straightening it is not a rotation and not a stretch — it is a
// PROJECTIVE transform, the only one that can map an arbitrary quadrilateral to
// a rectangle, and the reason a photo cannot be fixed by cropping.
//
// Eight unknowns, eight equations from four point pairs, solved by plain
// Gaussian elimination. No dependency: this is the whole of it.

export interface Point { x: number; y: number }

/**
 * The 3×3 matrix taking `from` to `to`, as nine numbers in row order.
 *
 * Callers want the DESTINATION-to-SOURCE direction, because sampling walks the
 * output pixel by pixel and asks where each came from. Mapping forwards
 * instead leaves holes wherever the transform stretches.
 */
export function homography(from: Point[], to: Point[]): number[] | null {
  if (from.length !== 4 || to.length !== 4) return null
  const a: number[][] = []
  const b: number[] = []
  for (let i = 0; i < 4; i++) {
    const { x, y } = from[i]
    const { x: u, y: v } = to[i]
    a.push([x, y, 1, 0, 0, 0, -u * x, -u * y])
    b.push(u)
    a.push([0, 0, 0, x, y, 1, -v * x, -v * y])
    b.push(v)
  }
  const h = solve(a, b)
  if (!h) return null
  return [...h, 1]
}

/** Gaussian elimination with partial pivoting. */
function solve(a: number[][], b: number[]): number[] | null {
  const n = b.length
  const m = a.map((row, i) => [...row, b[i]])
  for (let col = 0; col < n; col++) {
    let pivot = col
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(m[r][col]) > Math.abs(m[pivot][col])) pivot = r
    }
    // A degenerate quadrilateral — three points in a line, or two on top of
    // each other — has no transform, and saying so beats dividing by zero and
    // rendering noise.
    if (Math.abs(m[pivot][col]) < 1e-10) return null
    ;[m[col], m[pivot]] = [m[pivot], m[col]]
    for (let r = 0; r < n; r++) {
      if (r === col) continue
      const f = m[r][col] / m[col][col]
      for (let c = col; c <= n; c++) m[r][c] -= f * m[col][c]
    }
  }
  // The diagonal is m[i][i], not row[i][i] — indexing into a number, which
  // the typechecker caught before it could render noise.
  return m.map((row, i) => row[n] / m[i][i])
}

/** Apply a 3×3 to a point. */
export function apply(h: number[], p: Point): Point {
  const w = h[6] * p.x + h[7] * p.y + h[8]
  return {
    x: (h[0] * p.x + h[1] * p.y + h[2]) / w,
    y: (h[3] * p.x + h[4] * p.y + h[5]) / w,
  }
}

/**
 * The output size for a quadrilateral, from the lengths of its own sides.
 *
 * Forcing everything to A4 would squash a receipt and stretch a business card.
 * The page keeps roughly the shape the corners describe, which is the shape the
 * paper actually has.
 */
export function outputSize(q: Point[], max = 2000): { w: number; h: number } {
  const d = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y)
  const w = Math.max(d(q[0], q[1]), d(q[3], q[2]))
  const h = Math.max(d(q[0], q[3]), d(q[1], q[2]))
  const scale = Math.min(1, max / Math.max(w, h))
  return { w: Math.max(1, Math.round(w * scale)), h: Math.max(1, Math.round(h * scale)) }
}
