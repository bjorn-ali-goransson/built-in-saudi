// SOURCES — checked 8 August 2026
//   Zakat, Tax and Customs Authority (ZATCA), zatca.gov.sa — e-invoicing
//     (Fatoora) Phase 2 integration waves.
//     · Wave 23: VAT-taxable revenue above SAR 750,000 → integrate by 31 Mar 2026
//     · Wave 24: above SAR 375,000 → 30 Jun 2026
//     · Wave 25: above SAR 187,500 → 1 Feb 2027
//     · The threshold is met if ANY ONE of 2022, 2023 or 2024 crossed it.
//     · ZATCA notifies each taxpayer directly, at least six months ahead.
//   Waves 1–22 (from SAR 3 billion down) are not enumerated here — see the note
//   on `EARLIER` below.

// Which ZATCA e-invoicing wave a business falls into, and by when.
//
// The arithmetic is a comparison. Three things about the RULE are what people
// get wrong, and each one changes the answer:
//
// 1. **It is the highest of 2022, 2023 or 2024 — any one of them.** Not the
//    latest year, not an average, not all three. A business whose revenue fell
//    after a good 2022 is still in the wave that 2022 put it in.
// 2. **A BIGGER business has an EARLIER deadline**, which is the opposite of
//    what people assume when they see the thresholds falling over time. Waves
//    started at SAR 3 billion and step down, so crossing a higher threshold
//    puts you in an earlier wave — someone over 750,000 who reads "375,000 →
//    June 2026" and relaxes has given themselves three extra months they do not
//    have.
// 3. **The tool's answer is not the notice.** ZATCA writes to each taxpayer at
//    least six months before their deadline, and that letter is the official
//    trigger. This says which wave the published thresholds put you in.

export interface Wave {
  n: number
  /** Above this, in any qualifying year. */
  threshold: number
  /** Integration deadline, local date. */
  deadline: string
}

/** Announced waves, lowest wave number first — i.e. highest threshold first. */
export const WAVES: Wave[] = [
  { n: 23, threshold: 750_000, deadline: '2026-03-31' },
  { n: 24, threshold: 375_000, deadline: '2026-06-30' },
  { n: 25, threshold: 187_500, deadline: '2027-02-01' },
]


export const YEARS = [2022, 2023, 2024] as const

export interface Verdict {
  /** The highest of the three years — the figure the rule actually uses. */
  basis: number
  /** null when no announced wave reaches this business yet. */
  wave: Wave | null
  /**
   * True when a wave applies AND the business is large enough that an earlier
   * wave may already have caught it. Informational — it never replaces the
   * wave, because the boundaries of waves 1–22 are not known here.
   */
  maybeEarlier: boolean
  /** Days until the deadline; negative once it has passed. */
  daysLeft: number | null
  /** The next threshold down, for a business that is under all of them. */
  nextThreshold: number
}

const DAY = 86_400_000
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())

export function classify(revenues: number[], today = new Date()): Verdict {
  const basis = Math.max(0, ...revenues.map((r) => (Number.isFinite(r) ? r : 0)))
  const lowest = WAVES[WAVES.length - 1]

  // The FIRST wave whose threshold is crossed — the earliest deadline, not the
  // most recently announced one.
  const wave = WAVES.find((w) => basis > w.threshold) ?? null
  const maybeEarlier = wave?.n === WAVES[0].n
  if (!wave) {
    return { basis, wave: null, maybeEarlier: false, daysLeft: null, nextThreshold: lowest.threshold }
  }
  const due = new Date(`${wave.deadline}T00:00:00`)
  const daysLeft = Math.round((startOfDay(due).getTime() - startOfDay(today).getTime()) / DAY)
  return { basis, wave, maybeEarlier, daysLeft, nextThreshold: lowest.threshold }
}
