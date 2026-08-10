// Transferring sponsorship (نقل الكفالة): the fee, who owes it, and whether
// you need permission at all.
//
// SOURCES — checked 10 August 2026
//   Ministry of Human Resources and Social Development (HRSD) / Qiwa, as
//   reported by several independent legal summaries that agree on the figures:
//     · The transfer fee is **TIERED by the worker's transfer count** —
//       **SAR 2,000** for the first, **4,000** for the second, **6,000** for the
//       third, and 6,000 for every one after that.
//     · **Labour Law Article 40**: the NEW EMPLOYER bears it. It may not be
//       charged to the worker or deducted from wages — the same article that
//       forbids charging the work-permit levy to the worker, which
//       `iqama-fees` already records.
//     · Transfer **without the current employer's consent** is available in
//       named cases, of which four are consistently reported: the contract has
//       expired; wages unpaid for three consecutive months; the employer did
//       not renew the iqama within a month of its expiry; the employer refuses
//       to pay what the contract agreed.
//     · After a contract ends there is a **60-day** window to complete a
//       transfer or arrange an exit; past it the worker's residency status is
//       irregular.
//
// **A CAP ON THE NUMBER OF TRANSFERS IS NOT ENCODED.** One source reports a
// maximum of four per worker and the others do not mention it at all. That is
// the `iqama-fees` situation exactly: an uncorroborated figure does not go in,
// and a tool that invents a hard limit tells somebody their case is impossible
// when it may not be. It is named in the UI as something to check instead.
//
// THE TWO THINGS PEOPLE GET WRONG:
//
// 1. **The fee is not flat.** Everyone quotes "2,000 riyals". It is 2,000 only
//    for a worker who has never transferred; the third and later cost three
//    times that, and the count follows the WORKER, not the employer — so a new
//    hire who has moved twice already costs 6,000 on arrival.
// 2. **The worker does not pay it, and often does not need permission either.**
//    Both halves are worth more than the arithmetic: a fee deducted from a
//    worker's wages is a breach of Article 40, and somebody whose contract has
//    simply expired does not need their employer to agree to anything.

/** Article 40 — the new employer's cost, in riyals, by prior transfer count. */
export const FEES = [2000, 4000, 6000] as const
/** Every transfer after the third costs the same as the third. */
export const FEE_CAP = 6000
/** Days after a contract ends before the residency status becomes irregular. */
export const GRACE_DAYS = 60

/** The fee for a worker who has transferred `previous` times before. */
export function feeFor(previous: number): number {
  const n = Math.max(0, Math.floor(previous))
  return n < FEES.length ? FEES[n] : FEE_CAP
}

/** What the next `count` transfers would cost in total, from `previous`. */
export function cumulative(previous: number, count: number): number {
  let total = 0
  for (let i = 0; i < Math.max(0, count); i++) total += feeFor(previous + i)
  return total
}

export type ConsentReason =
  | 'contractExpired'
  | 'wagesUnpaid'
  | 'iqamaNotRenewed'
  | 'contractBreached'

export const CONSENT_REASONS: ConsentReason[] = [
  'contractExpired', 'wagesUnpaid', 'iqamaNotRenewed', 'contractBreached',
]

/**
 * Whether any of the named grounds applies.
 *
 * Deliberately a set of independent yes/no grounds rather than a single
 * question: they are separate legal routes with the same consequence, and a
 * form that made you choose between them would pretend the choice mattered.
 * The same shape as `end-of-service`'s Article 87 question.
 */
export const needsConsent = (grounds: ConsentReason[]) => grounds.length === 0

export const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())

export interface Deadline {
  /** The last day the transfer or exit can be arranged without a violation. */
  by: Date
  /** Negative once it has passed. */
  daysLeft: number
  passed: boolean
}

/** The 60-day window, counted from the day the contract ended. */
export function deadline(contractEnd: Date, today = new Date()): Deadline {
  const start = startOfDay(contractEnd)
  const by = new Date(start.getFullYear(), start.getMonth(), start.getDate() + GRACE_DAYS)
  const daysLeft = Math.round((by.getTime() - startOfDay(today).getTime()) / 86400000)
  return { by, daysLeft, passed: daysLeft < 0 }
}
