// SOURCES — checked 8 August 2026
//   Education & Training Evaluation Commission (etec.gov.sa) — Qudurat (GAT)
//     and Tahsili (SAAT) are ETEC tests; the scores are the student's own.
//   The WEIGHTS are each university's own published admission formula (e.g.
//     KSU 30/30/40, KFUPM 20/30/50) and differ by programme. They are an INPUT
//     the student can look up, not a threshold this tool invents — which is why
//     custom weights are accepted and a set that does not total 100 is refused.

// The weighted admission percentage, and where a student's points actually are.
//
// The formula is exact — GPA, Qudurat and Tahsili each multiplied by a weight —
// but **the weights differ by university and by programme**, which is why this
// asks for them rather than assuming one set. That is the difference between
// this and a calculator that would have to guess: here the varying number is an
// input the student can look up, not a threshold we would be inventing.
//
// The part worth computing, which no simple calculator gives, is the MARGINAL
// value of each component: at a 30/30/40 weighting a point of Tahsili is worth
// a third more than a point of GPA, so a student revising blind is often
// pushing on the cheapest lever.

export interface Weights {
  /** Percentages that must total 100. */
  school: number
  qudurat: number
  tahsili: number
}

export interface Scores {
  school: number
  qudurat: number
  tahsili: number
}

/** Weightings published by well-known universities, as starting points. */
export const PRESETS: { id: string; label: string; labelAr: string; w: Weights }[] = [
  { id: 'ksu', label: 'KSU (30/30/40)', labelAr: 'جامعة الملك سعود (30/30/40)', w: { school: 30, qudurat: 30, tahsili: 40 } },
  { id: 'kfupm', label: 'KFUPM (20/30/50)', labelAr: 'جامعة الملك فهد (20/30/50)', w: { school: 20, qudurat: 30, tahsili: 50 } },
  { id: 'even', label: 'Equal thirds', labelAr: 'أثلاث متساوية', w: { school: 34, qudurat: 33, tahsili: 33 } },
]

const clamp = (n: number) => Math.min(100, Math.max(0, n || 0))
const round = (n: number) => Math.round(n * 1000) / 1000

export const weightsTotal = (w: Weights) => w.school + w.qudurat + w.tahsili
export const weightsValid = (w: Weights) => Math.abs(weightsTotal(w) - 100) < 0.001

export function weighted(s: Scores, w: Weights): number {
  return round((clamp(s.school) * w.school + clamp(s.qudurat) * w.qudurat + clamp(s.tahsili) * w.tahsili) / 100)
}

export interface Lever {
  key: keyof Scores
  /** How much the weighted total rises per extra point on this component. */
  perPoint: number
  /** Points still available before this component is maxed out. */
  headroom: number
  /** The most this component could still add. */
  potential: number
}

/**
 * Where the remaining points are.
 *
 * Sorted by what is actually attainable — the product of the weight and the
 * headroom — rather than by weight alone, because a heavily weighted component
 * already at 98 has almost nothing left to give.
 */
export function levers(s: Scores, w: Weights): Lever[] {
  const rows: Lever[] = (['school', 'qudurat', 'tahsili'] as const).map((key) => {
    const perPoint = w[key] / 100
    const headroom = round(100 - clamp(s[key]))
    return { key, perPoint: round(perPoint), headroom, potential: round(headroom * perPoint) }
  })
  return rows.sort((a, b) => b.potential - a.potential)
}
