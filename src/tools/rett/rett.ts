// The 5% tax on selling or transferring property, and the three things people
// get wrong about it.
//
// SOURCES — checked 11 August 2026
//   Authority: Zakat, Tax and Customs Authority (ZATCA), Real Estate
//   Transaction Tax Law, Royal Decree No. M/84 dated 19/03/1446 AH, in force
//   from 12 Shawwal 1446 AH — **10 April 2025**. First-home relief is the
//   Ministry of Municipalities and Housing, via Sakani.
//
//   Every figure below was corroborated across two independent summaries
//   before being encoded (ZATCA's own regulation page, EY's tax alerts on the
//   Law and on the Implementing Regulations, and Saudi legal/real-estate
//   guides), per this repo's rule that an uncorroborated figure does not go in:
//     · **5%** on the value of the disposal.
//     · **RETT replaced the 15% VAT on real estate**, it did not join it.
//     · Late payment: **2% of the unpaid tax for each month or part of a
//       month, capped at 50%** of it.
//     · First home: the state bears the tax on **up to SAR 1,000,000** of the
//       price — a maximum of **SAR 50,000** of relief.
//     · The **disposer** (the seller) is the taxable person; the tax is paid
//       before the deed is documented.
//
// THREE THINGS PEOPLE GET WRONG, and the first costs the most:
//
// 1. **The 15% VAT does NOT also apply.** RETT replaced it on real estate.
//    Budgeting 5% + 15% overstates the tax on a two-million-riyal flat by
//    SAR 300,000 — and the mistake is easy to make on a site that also
//    publishes a VAT calculator.
// 2. **The late penalty is 2% a month, capped at 50% — not the 5% a month
//    that much of the web still prints.** That figure is the OLD one and it is
//    still being republished by law-firm and news guides. It is a rare case of
//    a rule moving in the taxpayer's favour and nobody updating the copy.
// 3. **The first-home relief is a TAPER, not a cliff.** A first home over a
//    million riyals is not disqualified: the state bears the tax on the first
//    million and the buyer pays 5% on the rest. On a SAR 1,500,000 home that
//    is 50,000 borne and 25,000 owed. This is the exact opposite of the
//    `import-duty` threshold, which IS a cliff — so knowing one does not tell
//    you the other.
//
// WHAT IT WILL NOT DO, deliberately:
//   It does not decide whether a disposal is exempt. The Law lists a long
//   schedule of exempt cases — inheritance, gifts within a stated degree of
//   kinship, endowments, transfers to government entities, corporate
//   restructuring, listed securities and fund units — each with conditions
//   this page cannot see. Naming them and sending the reader to ZATCA is the
//   honest answer; a confident "you are exempt" is not ours to give.

/** RETT, on the value of the disposal. */
export const RETT_RATE = 0.05

/**
 * The VAT rate RETT REPLACED on real estate.
 *
 * Kept as a named constant because the tool's main job is to show what the
 * reader would have over-budgeted, not to apply it.
 */
export const OLD_VAT_RATE = 0.15

/** Late payment: this share of the unpaid tax per month or part of a month. */
export const LATE_RATE = 0.02

/** …capped at this share of the unpaid tax, however long it runs. */
export const LATE_CAP = 0.5

/** The state bears the first-home tax on up to this much of the price. */
export const FIRST_HOME_VALUE_CAP = 1_000_000

/** Which follows arithmetically: the most relief a first home can attract. */
export const FIRST_HOME_MAX_RELIEF = FIRST_HOME_VALUE_CAP * RETT_RATE

/** The Law came into force on this date; disposals before it were VAT-era. */
export const IN_FORCE = '2025-04-10'

export interface Disposal {
  /** The agreed value of the disposal, in riyals. */
  value: number
  /** Whether this is a citizen's first home under the Sakani certificate. */
  firstHome: boolean
  /** Whole months late, or part-months, counted from the due date. */
  monthsLate: number
}

export interface RettResult {
  /** 5% of the whole value, before any relief. */
  grossTax: number
  /** The part of the value the state bears, capped at the ceiling. */
  reliefValue: number
  /** The tax the state bears on it. */
  relief: number
  /** What the taxpayer actually owes. */
  tax: number
  /** The late-payment penalty, uncapped arithmetic then capped. */
  penalty: number
  /** Whether the cap is what decided the penalty. */
  penaltyCapped: boolean
  /** Tax plus penalty. */
  total: number
  /** What 5% + 15% would have come to — the mistake, not a charge. */
  ifVatAlsoApplied: number
  /** How much that mistake overstates the bill by. */
  vatOverstatement: number
  /** True when the first-home relief ran out and the rest is chargeable. */
  aboveFirstHomeCap: boolean
}

/**
 * Work out the tax on one disposal.
 *
 * The arithmetic is a multiplication; everything interesting is in which
 * value the multiplication is applied to.
 */
export function computeRett(d: Disposal): RettResult {
  const value = Math.max(0, d.value || 0)
  const grossTax = value * RETT_RATE

  // The relief is capped on the VALUE, which is why it tapers: above the
  // ceiling the excess is charged, rather than the whole relief being lost.
  const reliefValue = d.firstHome ? Math.min(value, FIRST_HOME_VALUE_CAP) : 0
  const relief = reliefValue * RETT_RATE
  const tax = grossTax - relief

  const months = Math.max(0, Math.floor(d.monthsLate || 0))
  const uncapped = tax * LATE_RATE * months
  const cap = tax * LATE_CAP
  const penalty = Math.min(uncapped, cap)

  return {
    grossTax,
    reliefValue,
    relief,
    tax,
    penalty,
    penaltyCapped: uncapped > cap && months > 0,
    total: tax + penalty,
    ifVatAlsoApplied: grossTax + value * OLD_VAT_RATE,
    vatOverstatement: value * OLD_VAT_RATE,
    aboveFirstHomeCap: d.firstHome && value > FIRST_HOME_VALUE_CAP,
  }
}

/**
 * How many months of lateness it takes to reach the cap.
 *
 * Worth stating rather than leaving to be discovered: at 2% a month the cap
 * binds at 25 months, so beyond about two years the penalty stops growing —
 * which is a fact about the rule, not an invitation.
 */
export const MONTHS_TO_CAP = Math.ceil(LATE_CAP / LATE_RATE)

/**
 * The exempt categories, named rather than decided.
 *
 * Each has conditions — degrees of kinship, holding periods, the purpose of
 * the transfer — that this page cannot verify, so these are a prompt to go and
 * check, in the `iqama-fees` tradition of naming what we will not compute.
 */
export const EXEMPT_KINDS = [
  'inheritance',
  'gift',
  'endowment',
  'government',
  'restructuring',
  'securities',
  'inKind',
  'repossession',
] as const

export type ExemptKind = (typeof EXEMPT_KINDS)[number]
