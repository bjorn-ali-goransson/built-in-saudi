// A domestic worker is not covered by the Labour Law, and almost every
// calculator on the web answers as though they were.
//
// SOURCES — checked 11 August 2026
//   Authority: Ministry of Human Resources and Social Development, through its
//   official **Musaned** platform, which publishes the rights and obligations
//   directly. The figures below are quoted from it:
//     · End of service: **one month's wage for every four consecutive years**
//       with the employer.
//     · Annual leave: **30 days after two years** of service, plus a
//       **round-trip ticket** home.
//     · Sick leave: **30 days** — the first **15 at full pay**, the rest at
//       **half pay**.
//     · Weekly rest: **one full paid day**, not less than **24 continuous
//       hours**.
//     · Daily: no more than **5 consecutive hours** without a break, and total
//       rest of not less than **8 continuous hours**.
//     · Wage paid **monthly** by the method the Ministry determines — the Wage
//       Protection System, phased from 1 July 2024 and **fully mandatory for
//       every employer from 1 January 2026** (corroborated in the press).
//
// **The sources DISAGREE about end of service, and that is why the official one
// was used.** A commercial recruitment site states "a minimum of 2 years, then
// one month's salary per YEAR" — which is **four times** the published figure
// and would tell a household it owes four months where the rule says one. An
// independent 2026 guide agrees with Musaned. When sources disagree, this repo
// takes the authority and says so rather than averaging; the disagreement is
// recorded here because it is exactly the kind of number that goes stale or
// gets embellished, and it is why the tool is badged beta.
//
// WHY THIS EXISTS, and it is a defect in our own catalogue rather than a gap in
// the market: **the Labour Law expressly excludes domestic workers**, and this
// site already ships `end-of-service` and `leave-overtime`, which implement the
// Labour Law and carried no caveat at all. Measured on a SAR 1,500 wage, the
// Labour Law answer overstates a domestic worker's end-of-service reward by
// **2.0x at four years, 2.8x at eight and 3.2x at twelve**. A household reading
// our own tool would have budgeted three times the figure; a worker reading it
// would have expected three times what the rule gives.

/** One month's wage per this many consecutive years. */
export const EOS_YEARS_PER_MONTH = 4

/** Annual leave becomes due after this many years of service. */
export const LEAVE_AFTER_YEARS = 2

/** …and is this many days, plus a round-trip ticket. */
export const LEAVE_DAYS = 30

/** Sick leave in total, per the regulation. */
export const SICK_DAYS = 30

/** …of which this many are at full pay; the rest at half. */
export const SICK_FULL_PAY_DAYS = 15

/** Weekly rest, in continuous hours, paid. */
export const WEEKLY_REST_HOURS = 24

/** The longest stretch that may be worked without a break. */
export const MAX_CONSECUTIVE_HOURS = 5

/** Total daily rest, in continuous hours. */
export const DAILY_REST_HOURS = 8

/** Wage Protection became mandatory for every employer on this date. */
export const WPS_ALL_EMPLOYERS = '2026-01-01'

export interface Service {
  /** Monthly wage in riyals. */
  wage: number
  /** Completed years of continuous service with this employer. */
  years: number
}

export interface Entitlement {
  /** Completed four-year periods — what the reward is counted in. */
  periods: number
  /** The end-of-service reward in riyals. */
  reward: number
  /** Years still to run before the next month falls due. */
  yearsToNext: number
  /** Whether annual leave has become due at all. */
  leaveDue: boolean
  /** Sick leave at full pay, and at half pay, in riyals per day. */
  sickFullDaily: number
  sickHalfDaily: number
  /** What the LABOUR LAW would have said — not owed, shown for contrast. */
  labourLawReward: number
}

/**
 * The Labour Law formula, reproduced here ONLY to show the difference.
 *
 * Half a month per year for the first five years, a full month per year
 * thereafter. It is what `end-of-service` computes and what a domestic worker
 * is NOT owed; putting the two side by side is the whole point of the tool.
 */
export function labourLawReward(wage: number, years: number): number {
  const w = Math.max(0, wage || 0)
  const y = Math.max(0, years || 0)
  return y <= 5 ? y * 0.5 * w : (2.5 + (y - 5)) * w
}

/** What a domestic worker is entitled to, by the published rules. */
export function entitlement(s: Service): Entitlement {
  const wage = Math.max(0, s.wage || 0)
  const years = Math.max(0, s.years || 0)

  // The published wording is "one month's wage for every four consecutive
  // years", so it is counted in completed four-year periods. **Whether a
  // partial period is paid pro-rata is not stated in anything published**, and
  // inventing an answer to that would be the mistake `iqama-fees` records — so
  // the tool gives what the rule gives and names the authority for the rest.
  const periods = Math.floor(years / EOS_YEARS_PER_MONTH)
  const daily = wage / 30

  return {
    periods,
    reward: periods * wage,
    yearsToNext: (periods + 1) * EOS_YEARS_PER_MONTH - years,
    leaveDue: years >= LEAVE_AFTER_YEARS,
    sickFullDaily: daily,
    sickHalfDaily: daily / 2,
    labourLawReward: labourLawReward(wage, years),
  }
}

/** How many times the Labour Law answer overstates the real entitlement. */
export function overstatement(e: Entitlement): number | null {
  if (e.reward <= 0) return null
  return e.labourLawReward / e.reward
}
