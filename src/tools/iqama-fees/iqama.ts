// SOURCES — checked 8 August 2026
//   Ministry of Interior — Jawazat, via Absher (absher.sa) and Muqeem
//     (muqeem.sa): iqama issuance/renewal SAR 650 a year (SAR 600 for a
//     domestic worker), charged pro rata for 3/6/9 months.
//   Dependent (muraafiq) fee: SAR 400 per dependent per month, introduced in
//     2017 at 100 and stepped to 400 in July 2020.
//   Ministry of Human Resources and Social Development (hrsd.gov.sa)
//     · Labour Law art. 40: iqama and work permit fees are the employer's and
//       may not be charged to the worker.
//   The work permit levy's RATE is deliberately not encoded — see the note
//     below; published figures disagree and it is not the worker's to pay.

// What renewing an iqama actually costs a family, and who is supposed to pay.
//
// The arithmetic is two multiplications. The tool exists for three things people
// get wrong, and for one number it deliberately refuses to invent.
//
// 1. **The dependent fee is per dependent, per MONTH, paid up front for the
//    whole period.** It reads like an annual charge and it is not: a spouse and
//    two children renewed for a year is 3 x 400 x 12 = SAR 14,400, due in one
//    payment before the renewal goes through. That is the number that ruins
//    somebody's month, and it dwarfs the iqama fee itself.
//
// 2. **The iqama fee is charged for the period you choose**, and the shorter
//    periods are exactly pro rata (650 / 4 per quarter) — so splitting a year
//    into quarters costs the same in iqama fee but lets the dependent fees be
//    paid in instalments. That is a real lever and nobody mentions it.
//
// 3. **The work permit levy is the EMPLOYER'S, and Article 40 of the Labour Law
//    forbids charging it to the worker.** An expat seeing it deducted is looking
//    at something unlawful, not at a fee they owe. This is the same shape as the
//    GOSI tool's "a non-Saudi contributes nothing".
//
// The levy's RATE is deliberately not computed here. Published sources disagree
// (700/800 by Saudization band, 800/900, or a flat 800), it is set by the
// employer's band rather than by anything the worker can see, and it is not the
// worker's to pay in the first place. Printing a confident figure we cannot
// stand behind — for a charge the reader does not owe — would be worse than
// saying plainly who owes it and that the rate depends on their employer.

/** SAR, for a full year. Domestic workers are charged less. */
export const IQAMA_YEAR = 650
export const IQAMA_YEAR_DOMESTIC = 600

/** SAR per dependent per month. Introduced in 2017 at 100 and stepped to 400 in July 2020. */
export const DEPENDENT_MONTH = 400

/** The periods the Jawazat offers. */
export const PERIODS = [3, 6, 9, 12] as const
export type Period = (typeof PERIODS)[number]

/** Late renewal, escalating per offence. The third also carries a deportation risk. */
export const LATE_PENALTIES = [500, 1000, 2000] as const

export interface Quote {
  months: Period
  dependents: number
  /** The iqama fee itself, for the chosen period. */
  iqama: number
  /** Dependent fees for the whole period, which is how they are charged. */
  dependentTotal: number
  /** What one dependent costs over the chosen period. */
  perDependent: number
  total: number
  /** The same renewal taken as a full year, for comparison. */
  yearTotal: number
  /** How much of the total is dependents rather than the iqama. */
  dependentShare: number
}

export function quote(months: Period, dependents: number, domestic = false): Quote {
  const deps = Math.max(0, Math.floor(dependents || 0))
  const yearFee = domestic ? IQAMA_YEAR_DOMESTIC : IQAMA_YEAR
  // Exactly pro rata, rounded up to the riyal — 650/4 is 162.5, charged as 163.
  const iqama = months === 12 ? yearFee : Math.ceil((yearFee / 12) * months)
  const perDependent = DEPENDENT_MONTH * months
  const dependentTotal = perDependent * deps
  const total = iqama + dependentTotal
  const yearTotal = yearFee + DEPENDENT_MONTH * 12 * deps
  return {
    months,
    dependents: deps,
    iqama,
    dependentTotal,
    perDependent,
    total,
    yearTotal,
    dependentShare: total ? dependentTotal / total : 0,
  }
}
