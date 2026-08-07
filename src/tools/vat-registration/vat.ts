// Must you register for VAT in Saudi Arabia?
//
// The arithmetic is addition. What makes it worth a tool is that the two
// commonest mistakes both make the answer wrong in a way you would not notice:
//
// - **It is a rolling twelve months, not a calendar year.** ZATCA looks at ANY
//   twelve consecutive months. A business that never crosses in a calendar year
//   can have crossed months ago on the rolling window, and the clock started
//   then.
// - **Exempt supplies do not count; zero-rated ones do.** Counting exempt
//   income inflates the total and produces a registration nobody needed;
//   leaving out zero-rated income hides one that was due.
//
// And the deadline is short: **30 days** from crossing, with a SAR 10,000
// penalty for missing it — so the useful output is a date, not a yes.

export const MANDATORY = 375_000
export const VOLUNTARY = 187_500
/** Days from crossing the mandatory threshold to the registration deadline. */
export const REGISTER_WITHIN_DAYS = 30

export type Status = 'none' | 'voluntary' | 'mandatory'

export interface Verdict {
  status: Status
  /** The highest total across any twelve consecutive months. */
  peak: number
  /** 0-based index of the month that ENDS the peak window, when known. */
  peakEndsAt: number | null
  /** Set when the forward-looking test is what triggers registration. */
  byExpectation: boolean
}

/** The simple form: one figure for the past year, one for the year ahead. */
export function fromTotals(past12: number, next12: number): Verdict {
  const p = Math.max(0, past12 || 0)
  const n = Math.max(0, next12 || 0)
  // Registration is due if EITHER the last twelve months crossed or the next
  // twelve are expected to. The forward test is not a courtesy — it is in the
  // rule, and it is why a business can owe registration before it has earned
  // anything at all.
  if (p >= MANDATORY) return { status: 'mandatory', peak: p, peakEndsAt: null, byExpectation: false }
  if (n >= MANDATORY) return { status: 'mandatory', peak: p, peakEndsAt: null, byExpectation: true }
  if (p >= VOLUNTARY || n >= VOLUNTARY) return { status: 'voluntary', peak: Math.max(p, n), peakEndsAt: null, byExpectation: n > p }
  return { status: 'none', peak: p, peakEndsAt: null, byExpectation: false }
}

/**
 * The honest form: month by month, so the ROLLING window is what decides.
 *
 * `months` runs oldest-first. Windows shorter than twelve are still summed —
 * a business six months old that has already taken 400,000 has crossed, and
 * telling it "come back when you have twelve months of history" would be wrong.
 */
export function fromMonths(months: number[], next12 = 0): Verdict {
  const vals = months.map((m) => Math.max(0, m || 0))
  let peak = 0
  let peakEndsAt: number | null = null
  for (let end = 0; end < vals.length; end++) {
    const start = Math.max(0, end - 11)
    let sum = 0
    for (let i = start; i <= end; i++) sum += vals[i]
    if (sum > peak) { peak = sum; peakEndsAt = end }
  }
  const n = Math.max(0, next12 || 0)
  if (peak >= MANDATORY) return { status: 'mandatory', peak, peakEndsAt, byExpectation: false }
  if (n >= MANDATORY) return { status: 'mandatory', peak, peakEndsAt, byExpectation: true }
  if (peak >= VOLUNTARY || n >= VOLUNTARY) return { status: 'voluntary', peak, peakEndsAt, byExpectation: n > peak }
  return { status: 'none', peak, peakEndsAt, byExpectation: false }
}

/**
 * The first month whose rolling window crossed — the one that started the
 * clock, which is usually earlier than people think.
 */
export function crossedAt(months: number[]): number | null {
  const vals = months.map((m) => Math.max(0, m || 0))
  for (let end = 0; end < vals.length; end++) {
    const start = Math.max(0, end - 11)
    let sum = 0
    for (let i = start; i <= end; i++) sum += vals[i]
    if (sum >= MANDATORY) return end
  }
  return null
}

/** Registration deadline: end of the crossing month, plus 30 days. */
export function deadlineFrom(monthEnd: Date): Date {
  const d = new Date(monthEnd.getTime())
  d.setDate(d.getDate() + REGISTER_WITHIN_DAYS)
  return d
}
