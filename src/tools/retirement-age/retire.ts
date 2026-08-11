// When you can draw a GOSI pension — which is no longer 60 for most people.
//
// SOURCES — checked 11 August 2026
//   The Social Insurance Law in force from **3 July 2024**, as reported by
//   GOSI and corroborated across independent summaries (Asharq, Okaz quoting
//   GOSI, Lockton, DLA Piper, Saudi Gazette) before anything here was encoded:
//     · **Somebody with no prior contribution periods on 3 July 2024 is in the
//       NEW system: the standard retirement age is 65**, with early retirement
//       possible up to **ten years earlier — a floor of 55**.
//     · **Somebody with prior periods stays on the amended existing system,
//       where the standard age is between 58 and 65**, set by how old they were
//       on 3 July 2024 and rising in steps of four months.
//     · Under the pre-2024 rules a pension needed **120 months of contributions
//       and age 60**, or **300 months at any age**.
//     · The pension itself is **the average wage of the last two years ×
//       contribution months ÷ 480** — so each YEAR of contributions buys 2.5%
//       of that average, and 40 years buys all of it.
//   Authority to check: GOSI, and its own awareness platform.
//
// WHAT THIS DELIBERATELY DOES NOT COMPUTE: the exact age for somebody already
// contributing on 3 July 2024. The 58-to-65 band is corroborated and the
// four-month step is corroborated, but **the ladder itself — which age on that
// date maps to which retirement age — is not**, and inventing it would put a
// retirement date on the page that somebody might plan a life around. The band
// is given with both ends dated, and GOSI is named. Same rule as `iqama-fees`
// refusing the work-permit levy, for the fourth tool now.
//
// THREE THINGS PEOPLE GET WRONG:
//
// 1. **It is not 60 any more.** That number is from the pre-2024 rules and it
//    is what almost everybody still says.
// 2. **Which system you are in is decided by ONE date** — whether you had any
//    contribution period before 3 July 2024 — and not by your age, your
//    employer or when your current job started.
// 3. **Early retirement is a floor, not a discount.** In the new system it is
//    ten years before the standard age and no earlier, so 55 is the earliest
//    anybody in it can draw a pension however long they have contributed.

/** The day the new law's split takes effect. */
export const SPLIT = '2024-07-03'

/** New system: the standard age, and the earliest early retirement. */
export const NEW_STANDARD = 65
export const NEW_EARLIEST = 55

/** Amended existing system: the band the standard age falls in. */
export const OLD_BAND: [number, number] = [58, 65]

/** Pre-2024 rules, still the basis most people quote. */
export const LEGACY_AGE = 60
export const LEGACY_MONTHS = 120
export const LEGACY_EARLY_MONTHS = 300

/** Each contribution month buys this share of the average wage. */
export const PENSION_DIVISOR = 480

export type Scheme = 'new' | 'existing'

export interface RetireInput {
  /** Date of birth. */
  born: Date
  /** True when they had any contribution period before 3 July 2024. */
  contributedBefore: boolean
}

export interface RetireResult {
  scheme: Scheme
  /** The standard age, or null when it is a band this cannot narrow. */
  standardAge: number | null
  /** The band, always — for the new system both ends are the same number. */
  band: [number, number]
  /** Earliest and latest dates the standard age could fall on. */
  earliest: Date
  latest: Date
  /** The floor for early retirement, where one is corroborated. */
  earlyAge: number | null
  earlyDate: Date | null
}

const atAge = (born: Date, years: number) =>
  new Date(born.getFullYear() + years, born.getMonth(), born.getDate())

export function assessRetirement(input: RetireInput): RetireResult {
  const scheme: Scheme = input.contributedBefore ? 'existing' : 'new'
  if (scheme === 'new') {
    return {
      scheme,
      standardAge: NEW_STANDARD,
      band: [NEW_STANDARD, NEW_STANDARD],
      earliest: atAge(input.born, NEW_STANDARD),
      latest: atAge(input.born, NEW_STANDARD),
      earlyAge: NEW_EARLIEST,
      earlyDate: atAge(input.born, NEW_EARLIEST),
    }
  }
  return {
    scheme,
    // Not narrowed on purpose — see the note at the top of this file.
    standardAge: null,
    band: OLD_BAND,
    earliest: atAge(input.born, OLD_BAND[0]),
    latest: atAge(input.born, OLD_BAND[1]),
    earlyAge: null,
    earlyDate: null,
  }
}

/**
 * The pension as a share of the average wage of the last two years.
 *
 * Months ÷ 480, capped at 100% — 480 months is forty years, and the formula
 * would otherwise promise more than the wage it is based on.
 */
export const pensionShare = (months: number) =>
  Math.min(100, (Math.max(0, months) / PENSION_DIVISOR) * 100)
