// Commercial registration renewal: two windows, and the second is not free.
//
// SOURCES — checked 11 August 2026
//   Ministry of Commerce guidance as reported by several independent Saudi
//   business-services summaries, corroborated before being encoded:
//     · The system allows renewal from **90 days BEFORE** the expiry date.
//     · There is a further **90-day period AFTER** expiry in which the register
//       can still be renewed — with the standard fees **plus accumulated
//       fines**, and with the business identity at risk of automatic
//       cancellation past it.
//     · Renewal is **not complete without an active Chamber of Commerce
//       subscription**; some activities also require a valid municipal (Balady)
//       licence.
//   Authority to check: the Ministry of Commerce, through its portal.
//
// TWO THINGS PEOPLE GET WRONG:
//
// 1. **The grace period reads as an extension and is not one.** Ninety days
//    after expiry the register can still be renewed, so it is widely treated as
//    "the real deadline is six months". It is not: the fines start at expiry,
//    the business is operating on a lapsed register in the meantime, and past
//    the grace the commercial identity can be cancelled outright — which is not
//    a fine, it is starting again.
// 2. **A prerequisite gates the renewal.** An unpaid Chamber of Commerce
//    subscription stops a renewal that otherwise looks available, which is the
//    same shape as a lapsed Fahes blocking an istimara renewal — and it is
//    discovered on the day, when the portal refuses.
//
// WHAT THIS DELIBERATELY DOES NOT COMPUTE: the fee. Published figures give SAR
// 200 a year for a main register and 100 for a branch, and then quote real
// renewal costs anywhere from 200 to 5,000 because the Chamber subscription is
// banded by capital and activity and the municipal licence is charged per square
// metre by zone. Adding those into one confident number would be inventing it —
// the `iqama-fees` rule, for the third tool now.

/** Renewal opens this many days before expiry. */
export const OPENS_BEFORE_DAYS = 90
/** And can still be done this many days after it, with fines. */
export const GRACE_AFTER_DAYS = 90

export type Phase = 'early' | 'open' | 'grace' | 'lapsed'

export interface CrStatus {
  phase: Phase
  /** When the portal will let you renew. */
  opensOn: Date
  expiry: Date
  /** Last day of the grace period. */
  graceEnds: Date
  /** Negative once expired. */
  daysToExpiry: number
  /** Days left in whichever window applies; negative past the grace. */
  daysLeftInPhase: number
}

const at = (d: Date, days: number) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate() + days)

/** Whole days between two local midnights. */
const between = (a: Date, b: Date) =>
  Math.round(
    (new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime()
      - new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime()) / 86400000,
  )

export function crStatus(expiry: Date, now = new Date()): CrStatus {
  const opensOn = at(expiry, -OPENS_BEFORE_DAYS)
  const graceEnds = at(expiry, GRACE_AFTER_DAYS)
  const daysToExpiry = between(now, expiry)

  const phase: Phase = daysToExpiry > OPENS_BEFORE_DAYS ? 'early'
    : daysToExpiry >= 0 ? 'open'
      : between(now, graceEnds) >= 0 ? 'grace'
        : 'lapsed'

  const daysLeftInPhase = phase === 'early' ? between(now, opensOn)
    : phase === 'open' ? daysToExpiry
      : between(now, graceEnds)

  return { phase, opensOn, expiry, graceEnds, daysToExpiry, daysLeftInPhase }
}
