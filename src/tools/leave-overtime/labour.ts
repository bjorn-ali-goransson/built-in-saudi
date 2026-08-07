// What the Saudi Labour Law gives you, in numbers.
//
// `end-of-service` stops at the gratuity. These are the entitlements that apply
// while you are still working, and three of them are routinely got wrong:
//
// - **Annual leave steps at five years**, from at least 21 days to at least 30,
//   and only on CONTINUOUS service with the same employer. That is a cliff with
//   a date on it, and nobody is told when it arrives.
// - **Notice is asymmetric.** Thirty days when the employee resigns, sixty when
//   the employer terminates. People assume one number applies to both, and it
//   is the party giving notice that decides which.
// - **Overtime is capped**, at 720 hours a year, and going past it needs the
//   worker's explicit written consent — so the cap is a right, not a payroll
//   limit.

/** Minimum paid annual leave, in days, before and after the five-year step. */
export const LEAVE_BASE = 21
export const LEAVE_AFTER = 30
/** Years of continuous service at which the entitlement steps up. */
export const LEAVE_STEP_YEARS = 5

/** Overtime is paid at 150% of the hourly wage. */
export const OVERTIME_RATE = 1.5
/** Hours of overtime a year beyond which written consent is required. */
export const OVERTIME_CAP = 720

/** Notice in days: the figure depends on who is ending the contract. */
export const NOTICE_RESIGN = 30
export const NOTICE_TERMINATE = 60

/** Maximum probation, in days. It cannot be extended past this. */
export const PROBATION_MAX = 180

/**
 * The conventional divisors. A month is treated as 30 days and a day as 8
 * hours, which is the usual basis for an hourly rate — but a contract may set
 * its own, so the tool shows the daily and hourly figures it derived rather
 * than only the answer.
 */
export const DAYS_PER_MONTH = 30
export const HOURS_PER_DAY = 8

export interface Entitlement {
  /** Whole years of continuous service completed. */
  years: number
  /** Days of leave a year, at this length of service. */
  leaveDays: number
  /** Null once the step has already happened. */
  stepsOn: Date | null
  daysUntilStep: number | null
  dailyWage: number
  hourlyWage: number
  /** What one day of leave is worth at this wage. */
  leaveDayValue: number
  overtimeHourly: number
}

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())

/** Whole years between two dates, by calendar rather than by 365-day blocks. */
export function yearsOfService(start: Date, today = new Date()): number {
  let y = today.getFullYear() - start.getFullYear()
  const anniversary = new Date(start.getFullYear() + y, start.getMonth(), start.getDate())
  if (startOfDay(anniversary) > startOfDay(today)) y--
  return Math.max(0, y)
}

export function entitlement(start: Date, monthlyWage: number, today = new Date()): Entitlement {
  const wage = Math.max(0, monthlyWage || 0)
  const years = yearsOfService(start, today)
  const stepped = years >= LEAVE_STEP_YEARS

  const stepDate = new Date(start.getFullYear() + LEAVE_STEP_YEARS, start.getMonth(), start.getDate())
  const daysUntil = Math.round((startOfDay(stepDate).getTime() - startOfDay(today).getTime()) / 86_400_000)

  const dailyWage = wage / DAYS_PER_MONTH
  const hourlyWage = dailyWage / HOURS_PER_DAY
  const round = (n: number) => Math.round(n * 100) / 100

  return {
    years,
    leaveDays: stepped ? LEAVE_AFTER : LEAVE_BASE,
    stepsOn: stepped ? null : stepDate,
    daysUntilStep: stepped ? null : daysUntil,
    dailyWage: round(dailyWage),
    hourlyWage: round(hourlyWage),
    leaveDayValue: round(dailyWage),
    overtimeHourly: round(hourlyWage * OVERTIME_RATE),
  }
}

/** What a given number of overtime hours is worth, and whether it passes the cap. */
export function overtimePay(hours: number, hourlyWage: number) {
  const h = Math.max(0, hours || 0)
  return {
    hours: h,
    pay: Math.round(h * hourlyWage * OVERTIME_RATE * 100) / 100,
    overCap: h > OVERTIME_CAP,
    beyondCap: Math.max(0, h - OVERTIME_CAP),
  }
}
