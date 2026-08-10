// The 25% traffic-fine reduction, and the deadline nobody reads correctly.
//
// SOURCES — checked 10 August 2026
//   Article 75 of the Traffic Law, as explained in the General Department of
//   Traffic's own published FAQ, reported by several independent Saudi outlets
//   (Sabq, Al-Riyadh, Al-Yaum, Al-Mowaten) and corroborated against English
//   summaries (Saudi Gazette, Zawya) before being encoded:
//
//     · A single violation committed **on or after 18 April 2024** may be paid
//       at a **25% reduction**.
//     · The reduction stands for the **first 45 days** from the day the
//       violation is registered.
//     · That 45 is **30 + 15**: a **30-day objection window**, and then a
//       **15-day payment window that begins when the objection window ends**.
//     · A **90-day payment extension** may be requested through Absher — and
//       the reduction continues for only **30 more days** into it, not for the
//       whole 90.
//     · After the windows lapse: seizure and enforcement (الحجز والتنفيذ).
//
//   Authority to check: the General Department of Traffic, through Absher.
//
// THREE THINGS PEOPLE GET WRONG, and the tool exists for the second:
//
// 1. **The windows run in SERIES, not in parallel.** The 15 days to pay start
//    when the 30 days to object END — so it is 45 days, not 30 and not 15.
//    Reading them as concurrent loses two weeks of it.
// 2. **The 90-day extension does NOT extend the discount by 90 days.** It buys
//    time to pay; the reduction dies 30 days into it. So the extension is worth
//    asking for and the discount is gone on day 75 either way, and somebody who
//    requested it believing they had until day 135 pays the full amount.
// 3. **A long list of violations is excluded entirely.** Assuming every fine is
//    discountable is how the arithmetic comes out wrong before it starts.

/** The reduction on a single violation. */
export const DISCOUNT = 0.25

/** From the violation date: the window to object. */
export const OBJECTION_DAYS = 30
/** Then, the window to pay — it BEGINS when the objection window ends. */
export const PAYMENT_DAYS = 15
/** Which is why the reduction stands for 45 days, not 15 and not 30. */
export const DISCOUNT_DAYS = OBJECTION_DAYS + PAYMENT_DAYS
/** The extension Absher can grant. */
export const EXTENSION_DAYS = 90
/** How much of that extension still carries the reduction. */
export const EXTENSION_DISCOUNT_DAYS = 30

/** The reduction applies only from this date onwards. */
export const SCHEME_START = '2024-04-18'

/**
 * Violations the reduction does not cover.
 *
 * Written out rather than summarised as "serious violations", because the list
 * is not intuitive — a periodic-inspection violation is on it and a red light
 * is not.
 */
export const EXCLUDED = [
  'accident-overtaking', 'accident-speeding', 'drifting', 'driving-school',
  'weights-dimensions', 'periodic-inspection', 'workshop', 'confiscated-licence',
  'export-dismantle', 'showroom',
] as const

export type Excluded = (typeof EXCLUDED)[number]

/** Days added to a date, in LOCAL terms — never through an ISO string, which
 *  east of Greenwich names the day before. */
export function addDays(from: Date, days: number): Date {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate())
  d.setDate(d.getDate() + days)
  return d
}

/** Local "YYYY-MM-DD", for the calendar export and for date inputs. */
export function isoLocal(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/** Whole days from today to then; negative once it has passed. */
export function daysUntil(target: Date, now = new Date()): number {
  const a = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const b = new Date(target.getFullYear(), target.getMonth(), target.getDate()).getTime()
  return Math.round((b - a) / 86400000)
}

export interface FineInput {
  /** The day the violation was registered. */
  date: Date
  /** The fine as issued, before any reduction. */
  amount: number
  /** Whether it falls in one of the excluded categories. */
  excluded: boolean
  /** Whether a 90-day extension has been requested through Absher. */
  extended: boolean
}

export interface FineResult {
  /** Before 18 April 2024 the scheme does not apply at all. */
  beforeScheme: boolean
  eligible: boolean
  discount: number
  payable: number
  /** Last day to object. */
  objectBy: Date
  /** Last day the reduction stands. */
  discountUntil: Date
  /** Last day to pay before enforcement, given the path chosen. */
  payBy: Date
  /** Days left on the reduction; negative once gone. */
  daysLeft: number
}

export function assess(input: FineInput, now = new Date()): FineResult {
  const scheme = new Date(`${SCHEME_START}T00:00:00`)
  const beforeScheme = input.date.getTime() < scheme.getTime()
  const eligible = !beforeScheme && !input.excluded

  const objectBy = addDays(input.date, OBJECTION_DAYS)
  // The 15 days to pay begin where the 30 to object end — in SERIES. Reading
  // them as concurrent is the commonest way to lose the reduction.
  const plainPayBy = addDays(input.date, DISCOUNT_DAYS)
  const discountUntil = input.extended
    ? addDays(plainPayBy, EXTENSION_DISCOUNT_DAYS)
    : plainPayBy
  const payBy = input.extended ? addDays(plainPayBy, EXTENSION_DAYS) : plainPayBy

  const daysLeft = daysUntil(discountUntil, now)
  const stillOn = eligible && daysLeft >= 0
  const discount = stillOn ? input.amount * DISCOUNT : 0

  return {
    beforeScheme,
    eligible,
    discount,
    payable: input.amount - discount,
    objectBy,
    discountUntil,
    payBy,
    daysLeft,
  }
}
