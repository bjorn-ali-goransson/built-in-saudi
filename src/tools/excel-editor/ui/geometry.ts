// Where every row and column is, for a grid with variable sizes, hidden lines,
// and up to a million rows. Offsets are prefix sums computed on demand and
// cached in blocks, so a sheet that is 100 rows tall costs nothing and one that
// is 1,048,576 tall does not allocate a million-entry array to scroll it.
export const DEFAULT_COL_W = 96
export const DEFAULT_ROW_H = 24
export const HEADER_W = 46
export const HEADER_H = 24

const BLOCK = 256

export class Axis {
  private blocks: number[] = [0] // offset at the start of each block
  constructor(
    readonly count: number,
    private sizeOf: (i: number) => number,
  ) {}

  size(i: number): number { return this.sizeOf(i) }

  /** Offset of the start of line `i` (0 ≤ i ≤ count). */
  offset(i: number): number {
    if (i <= 0) return 0
    const n = Math.min(i, this.count)
    const b = Math.floor(n / BLOCK)
    while (this.blocks.length <= b) {
      const k = this.blocks.length - 1
      let o = this.blocks[k]
      for (let j = k * BLOCK; j < (k + 1) * BLOCK && j < this.count; j++) o += this.sizeOf(j)
      this.blocks.push(o)
    }
    let o = this.blocks[b]
    for (let j = b * BLOCK; j < n; j++) o += this.sizeOf(j)
    return o
  }

  get total(): number { return this.offset(this.count) }

  /** The line containing pixel `px` (clamped). */
  at(px: number): number {
    // Not an early `return 0`: a hidden first line has no pixels, so pixel 0 belongs to the next one.
    px = Math.max(0, px)
    const total = this.total
    if (px >= total) return Math.max(0, this.count - 1)
    // Binary search over blocks, then a walk.
    let lo = 0
    let hi = this.blocks.length - 1
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1
      if (this.blocks[mid] <= px) lo = mid
      else hi = mid - 1
    }
    let i = lo * BLOCK
    let o = this.blocks[lo]
    while (i < this.count) {
      const s = this.sizeOf(i)
      if (o + s > px) return i
      o += s
      i++
    }
    return this.count - 1
  }

  /** Visible lines between two pixel offsets, inclusive, with overscan. */
  range(from: number, to: number, overscan = 2): [number, number] {
    const a = Math.max(0, this.at(from) - overscan)
    const b = Math.min(this.count - 1, this.at(to) + overscan)
    return [a, b]
  }
}

export type Box = { r0: number; c0: number; r1: number; c1: number }

export function normBox(a: { row: number; col: number }, b: { row: number; col: number }): Box {
  return { r0: Math.min(a.row, b.row), c0: Math.min(a.col, b.col), r1: Math.max(a.row, b.row), c1: Math.max(a.col, b.col) }
}

export const inBox = (b: Box, r: number, c: number) => r >= b.r0 && r <= b.r1 && c >= b.c0 && c <= b.c1

export function boxArea(b: Box): number { return (b.r1 - b.r0 + 1) * (b.c1 - b.c0 + 1) }

/** Grow a box until no merge crosses its edge — selecting half a merge selects all of it. */
export function expandForMerges(b: Box, merges: Box[]): Box {
  let out = { ...b }
  for (let pass = 0; pass < 8; pass++) {
    let grew = false
    for (const m of merges) {
      const overlaps = m.r0 <= out.r1 && m.r1 >= out.r0 && m.c0 <= out.c1 && m.c1 >= out.c0
      if (!overlaps) continue
      const next = { r0: Math.min(out.r0, m.r0), c0: Math.min(out.c0, m.c0), r1: Math.max(out.r1, m.r1), c1: Math.max(out.c1, m.c1) }
      if (next.r0 !== out.r0 || next.c0 !== out.c0 || next.r1 !== out.r1 || next.c1 !== out.c1) { out = next; grew = true }
    }
    if (!grew) break
  }
  return out
}

/**
 * Ctrl+Arrow: jump to the edge of the data block, as every spreadsheet does.
 * From a filled cell, run to the last filled one before a gap; from an empty
 * cell (or the edge of a block), run to the next filled one; with nothing
 * further, stop at the edge of the sheet.
 */
export function jump(filled: (r: number, c: number) => boolean, r: number, c: number, dr: number, dc: number, maxR: number, maxC: number): { row: number; col: number } {
  const ok = (rr: number, cc: number) => rr >= 0 && cc >= 0 && rr <= maxR && cc <= maxC
  let rr = r
  let cc = c
  const nextFilled = ok(r + dr, c + dc) && filled(r + dr, c + dc)
  if (filled(r, c) && nextFilled) {
    while (ok(rr + dr, cc + dc) && filled(rr + dr, cc + dc)) { rr += dr; cc += dc }
    return { row: rr, col: cc }
  }
  rr += dr; cc += dc
  while (ok(rr, cc) && !filled(rr, cc)) { rr += dr; cc += dc }
  if (!ok(rr, cc)) return { row: Math.max(0, Math.min(maxR, rr - dr)), col: Math.max(0, Math.min(maxC, cc - dc)) }
  return { row: rr, col: cc }
}
