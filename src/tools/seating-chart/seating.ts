import { A4_LANDSCAPE, newPage, pagesToPdf, rng, shuffle, type Page } from '../../lib/printPdf'

// Seating charts.
//
// Two things make this more than a shuffle:
//
// 1. **Keep-apart pairs.** The only reason a teacher re-does a seating plan is
//    that two particular people cannot sit together. A generator that ignores
//    that is a generator that gets used once.
// 2. **Which way the room faces.** A chart drawn from where the teacher stands
//    is mirrored from where the students sit, so a plan that does not say which
//    view it is gets read backwards by whoever is holding it — and the front
//    row ends up at the back.

export interface SeatOptions {
  names: string[]
  rows: number
  cols: number
  /** Pairs that must not be adjacent. */
  apart: [string, string][]
  seed: string
  /** Draw the room as the teacher sees it, or as the class sees it. */
  view: 'teacher' | 'class'
  title: string
}

export const DEFAULTS: SeatOptions = {
  names: [], rows: 4, cols: 6, apart: [], seed: 'ABC123', view: 'teacher', title: '',
}

export interface Plan {
  /** Row-major seats; null is an empty desk. */
  seats: (string | null)[]
  rows: number
  cols: number
  /** Pairs that could not be separated, if any. */
  unsatisfied: [string, string][]
  attempts: number
}

const neighbours = (i: number, rows: number, cols: number): number[] => {
  const r = Math.floor(i / cols)
  const c = i % cols
  const out: number[] = []
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue
      const nr = r + dr
      const nc = c + dc
      if (nr < 0 || nc < 0 || nr >= rows || nc >= cols) continue
      out.push(nr * cols + nc)
    }
  }
  return out
}

function violations(seats: (string | null)[], rows: number, cols: number, apart: [string, string][]): [string, string][] {
  const bad: [string, string][] = []
  for (const [a, b] of apart) {
    const ia = seats.indexOf(a)
    const ib = seats.indexOf(b)
    if (ia < 0 || ib < 0) continue
    if (neighbours(ia, rows, cols).includes(ib)) bad.push([a, b])
  }
  return bad
}

/**
 * Place people, honouring keep-apart pairs where possible.
 *
 * Reshuffling until the constraints hold, with a bounded number of attempts:
 * an exact solver is overkill for thirty desks, but giving up silently is not
 * an option either — an impossible set of rules (everyone apart from everyone)
 * has to be REPORTED, not quietly ignored.
 */
export function makePlan(o: SeatOptions): Plan {
  const rows = Math.max(1, o.rows)
  const cols = Math.max(1, o.cols)
  const capacity = rows * cols
  const people = o.names.map((n) => n.trim()).filter(Boolean).slice(0, capacity)
  const rand = rng(o.seed)

  let best: (string | null)[] = []
  let bestBad: [string, string][] = []
  let attempts = 0
  for (let i = 0; i < 200; i++) {
    attempts++
    const seats: (string | null)[] = shuffle(people, rand)
    while (seats.length < capacity) seats.push(null)
    const bad = violations(seats, rows, cols, o.apart)
    if (!bad.length) return { seats, rows, cols, unsatisfied: [], attempts }
    if (!best.length || bad.length < bestBad.length) { best = seats; bestBad = bad }
  }
  return { seats: best, rows, cols, unsatisfied: bestBad, attempts }
}

/** The grid as it should be DRAWN for the chosen view. */
export function forView(plan: Plan, view: 'teacher' | 'class'): (string | null)[] {
  if (view === 'teacher') return plan.seats
  // From where the class sits, left and right swap: each row is reversed.
  const out: (string | null)[] = []
  for (let r = 0; r < plan.rows; r++) {
    const row = plan.seats.slice(r * plan.cols, (r + 1) * plan.cols)
    out.push(...row.reverse())
  }
  return out
}

const INK = '#1a1a1a'

export async function buildChartPdf(
  plan: Plan,
  o: SeatOptions,
  labels: { front: string; title: string; view: string },
): Promise<Blob> {
  const page: Page = newPage(A4_LANDSCAPE)
  const { ctx, px } = page
  const seats = forView(plan, o.view)
  const M = 15

  ctx.direction = 'rtl'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  ctx.fillStyle = INK
  ctx.font = `600 ${Math.round(6 * px)}px "IBM Plex Sans Arabic", "Hanken Grotesk", sans-serif`
  ctx.fillText(o.title || labels.title, (page.wMm / 2) * px, 10 * px)
  ctx.font = `400 ${Math.round(3.2 * px)}px "IBM Plex Sans Arabic", "Hanken Grotesk", sans-serif`
  ctx.fillStyle = '#8a8a8a'
  ctx.fillText(labels.view, (page.wMm / 2) * px, 19 * px)

  // The front of the room, drawn as a band so the sheet cannot be read upside
  // down by mistake.
  const bandY = 26
  ctx.fillStyle = '#e8efe9'
  ctx.fillRect(M * px, bandY * px, (page.wMm - M * 2) * px, 8 * px)
  ctx.fillStyle = '#3c6b52'
  ctx.font = `600 ${Math.round(3.6 * px)}px "IBM Plex Sans Arabic", "Hanken Grotesk", sans-serif`
  ctx.fillText(labels.front, (page.wMm / 2) * px, (bandY + 2) * px)

  const top = bandY + 14
  const gridW = page.wMm - M * 2
  const gridH = page.hMm - top - M
  const cellW = gridW / plan.cols
  const cellH = Math.min(gridH / plan.rows, 26)

  ctx.textBaseline = 'middle'
  for (let i = 0; i < seats.length; i++) {
    const r = Math.floor(i / plan.cols)
    const c = i % plan.cols
    const x = (M + c * cellW) * px
    const y = (top + r * cellH) * px
    const w = cellW * px
    const h = cellH * px
    ctx.strokeStyle = seats[i] ? '#999999' : '#dddddd'
    ctx.lineWidth = Math.max(1, 0.3 * px)
    ctx.strokeRect(x + 1 * px, y + 1 * px, w - 2 * px, h - 2 * px)
    const name = seats[i]
    if (!name) continue
    ctx.fillStyle = INK
    ctx.direction = /[؀-ۿ]/.test(name) ? 'rtl' : 'ltr'
    let size = 4.4
    ctx.font = `500 ${Math.round(size * px)}px "IBM Plex Sans Arabic", "Hanken Grotesk", sans-serif`
    while (ctx.measureText(name).width > w - 6 * px && size > 2) {
      size -= 0.3
      ctx.font = `500 ${Math.round(size * px)}px "IBM Plex Sans Arabic", "Hanken Grotesk", sans-serif`
    }
    ctx.fillText(name, x + w / 2, y + h / 2, w - 6 * px)
  }

  return pagesToPdf([page])
}
