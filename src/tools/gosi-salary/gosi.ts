// GOSI contributions and net salary, as the rules actually are.
//
// Everything here is a rule most calculators get wrong, which is the reason the
// tool is worth having:
//
// - **There are two parallel systems**, and which one applies depends on when
//   the employee FIRST registered with GOSI — not on their age, their employer,
//   or when they joined their current job. Someone with any subscription before
//   **3 July 2024** stays on the old rates permanently. A Saudi with no history
//   before that date is on the new scheme, whose PENSION rate rises half a point
//   every July from 2025 to 2028.
// - **The contributable wage is basic salary + housing allowance ONLY**, capped
//   at **SAR 45,000 a month**. Transport, phone, commission and bonus are
//   outside it. "Take 10% of your salary" is wrong for anyone with allowances,
//   and it is wrong in the employee's favour or against it depending on the
//   package — which is why it is worth showing what was excluded.
// - **A non-Saudi employee contributes NOTHING.** The employer pays 2% for
//   occupational hazards and that is the whole of it. A GOSI deduction on a
//   non-Saudi payslip is an error, and saying so is more useful than a number.
//
// Rates are published as totals; the parts are pension + SANED (+ occupational
// hazards on the employer side), and only the pension part moves.

/** Monthly ceiling on the contributable wage, in SAR. */
export const WAGE_CAP = 45_000

/** Employer-only, unchanged, and the only branch a non-Saudi is in. */
export const OCCUPATIONAL_HAZARDS = 0.02

/** Unemployment insurance: the same on both sides, unchanged. */
export const SANED = 0.0075

/**
 * The new scheme's pension rate by year, effective each July.
 *
 * Both sides pay the same pension percentage; the employer's published total is
 * higher only because occupational hazards sits on top of it.
 */
export const NEW_PENSION_BY_YEAR: Record<number, number> = {
  2024: 0.09,
  2025: 0.095,
  2026: 0.10,
  2027: 0.105,
  2028: 0.11,
}

/** The old scheme never moves. */
export const OLD_PENSION = 0.09

export type Scheme = 'old' | 'new'

export interface Input {
  saudi: boolean
  scheme: Scheme
  basic: number
  housing: number
  /** Transport, phone, commission, bonus — everything outside the base. */
  other: number
  /** Which July's rates to apply. Clamped to the published schedule. */
  year: number
}

export interface Line { label: 'pension' | 'saned' | 'hazards'; rate: number; amount: number }

export interface Result {
  /** Basic + housing, before the cap. */
  base: number
  /** What contributions are actually charged on. */
  contributable: number
  /** How much of the base the cap removed. */
  cappedOff: number
  /** Allowances outside the base entirely. */
  excluded: number
  gross: number
  employee: Line[]
  employer: Line[]
  employeeTotal: number
  employerTotal: number
  net: number
  /** Total cost to the employer: gross pay plus their contributions. */
  costToEmployer: number
  pensionRate: number
}

const round = (n: number) => Math.round(n * 100) / 100

/** The pension rate in force for a scheme in a given year. */
export function pensionRate(scheme: Scheme, year: number): number {
  if (scheme === 'old') return OLD_PENSION
  const years = Object.keys(NEW_PENSION_BY_YEAR).map(Number)
  const clamped = Math.min(Math.max(year, Math.min(...years)), Math.max(...years))
  return NEW_PENSION_BY_YEAR[clamped]
}

export function compute(input: Input): Result {
  const basic = Math.max(0, input.basic || 0)
  const housing = Math.max(0, input.housing || 0)
  const other = Math.max(0, input.other || 0)

  const base = basic + housing
  const contributable = Math.min(base, WAGE_CAP)
  const gross = base + other

  const rate = pensionRate(input.scheme, input.year)

  // A non-Saudi employee is in the occupational hazards branch only, which the
  // employer pays for outright. No pension, no SANED, no deduction.
  const employee: Line[] = input.saudi
    ? [
      { label: 'pension', rate, amount: round(contributable * rate) },
      { label: 'saned', rate: SANED, amount: round(contributable * SANED) },
    ]
    : []

  const employer: Line[] = input.saudi
    ? [
      { label: 'pension', rate, amount: round(contributable * rate) },
      { label: 'hazards', rate: OCCUPATIONAL_HAZARDS, amount: round(contributable * OCCUPATIONAL_HAZARDS) },
      { label: 'saned', rate: SANED, amount: round(contributable * SANED) },
    ]
    : [
      { label: 'hazards', rate: OCCUPATIONAL_HAZARDS, amount: round(contributable * OCCUPATIONAL_HAZARDS) },
    ]

  const employeeTotal = round(employee.reduce((n, l) => n + l.amount, 0))
  const employerTotal = round(employer.reduce((n, l) => n + l.amount, 0))

  return {
    base,
    contributable,
    cappedOff: round(Math.max(0, base - WAGE_CAP)),
    excluded: other,
    gross,
    employee,
    employer,
    employeeTotal,
    employerTotal,
    net: round(gross - employeeTotal),
    costToEmployer: round(gross + employerTotal),
    pensionRate: rate,
  }
}
