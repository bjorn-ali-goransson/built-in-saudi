// Adding up a week of hours.
//
// SOURCES — checked 9 August 2026
//   Ministry of Human Resources and Social Development (HRSD), Saudi Labour Law
//   — hrsd.gov.sa. Articles 98 and 107: eight hours a day / 48 a week, reduced
//   to six a day / 36 a week for Muslim workers during Ramadan, and overtime at
//   150% of the hourly wage. Same instrument as `leave-overtime/labour.ts`,
//   which owns the fuller treatment (annual leave, notice, the 720-hour cap).
//
// Found by a web sweep: the time-card calculator is one of the highest-traffic
// free-tool categories on the web — timecardcalculator.net, redcort, My Hours,
// Clockshark, CalculatorSoup all publish one — and this site had none, next to
// a working-days calculator and a date difference calculator.
//
// The arithmetic is addition. Four things carry it, and generic calculators get
// two of them wrong:
//
// 1. **A shift can cross midnight.** An end time earlier than the start means
//    the next day, not a negative shift. Refusing it, or reporting minus
//    sixteen hours, is what most of them do — and a night shift is exactly the
//    kind of week somebody reaches for a calculator to total.
// 2. **Payroll wants decimal hours.** 7h30 is 7.5, and 7h20 is 7.33 — the
//    conversion is where hand-totalled timesheets go wrong, so both forms are
//    shown rather than one.
// 3. **The overtime threshold is WEEKLY as well as daily.** Five nine-hour days
//    is 5 hours of overtime by the daily rule and 45 hours — none — by a
//    40-hour weekly rule. Which applies is the employer's basis, not ours, so
//    it is asked rather than assumed.
// 4. **Ramadan is six hours a day, not eight.** That is a Saudi statutory
//    reduction no generic calculator knows, and it changes what counts as
//    overtime for a whole month.

export interface Day {
  /** 'HH:MM', or '' for a day not worked. */
  start: string
  end: string
  /** Unpaid break, in minutes. */
  breakMin: number
}

export interface DayResult {
  minutes: number
  overnight: boolean
  /** The break took more than the shift — a typo, not a negative day. */
  invalid: boolean
}

export interface WeekResult {
  days: DayResult[]
  totalMin: number
  regularMin: number
  overtimeMin: number
  pay: number | null
  overtimePay: number | null
}

/** Standard hours per day, and the Ramadan reduction (Labour Law art. 98). */
export const STANDARD_DAY = 8
export const RAMADAN_DAY = 6
/** Overtime is 150% of the hourly wage (art. 107). */
export const OVERTIME_RATE = 1.5

const toMin = (hhmm: string): number | null => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim())
  if (!m) return null
  const h = Number(m[1]), mm = Number(m[2])
  if (h > 23 || mm > 59) return null
  return h * 60 + mm
}

export function dayMinutes(d: Day): DayResult {
  const s = toMin(d.start), e = toMin(d.end)
  if (s === null || e === null) return { minutes: 0, overnight: false, invalid: false }
  // An end BEFORE the start crossed midnight. This is the case the generic
  // calculators refuse or report as negative, and a night shift is exactly the
  // week somebody reaches for a calculator to total.
  const overnight = e < s
  const span = overnight ? 24 * 60 - s + e : e - s
  const worked = span - Math.max(0, d.breakMin || 0)
  if (worked < 0) return { minutes: 0, overnight, invalid: true }
  return { minutes: worked, overnight, invalid: false }
}

export interface Opts {
  /** 'daily' counts overtime per day; 'weekly' counts it against the total. */
  basis: 'daily' | 'weekly'
  /** Hours before overtime starts — per day, or per week. */
  threshold: number
  /** Hourly wage, or null when the sheet is only about hours. */
  rate: number | null
}

export function calcWeek(days: Day[], o: Opts): WeekResult {
  const results = days.map(dayMinutes)
  const totalMin = results.reduce((n, r) => n + r.minutes, 0)

  let overtimeMin = 0
  if (o.basis === 'daily') {
    const cap = o.threshold * 60
    for (const r of results) overtimeMin += Math.max(0, r.minutes - cap)
  } else {
    overtimeMin = Math.max(0, totalMin - o.threshold * 60)
  }
  const regularMin = totalMin - overtimeMin

  const pay = o.rate === null ? null
    : (regularMin / 60) * o.rate + (overtimeMin / 60) * o.rate * OVERTIME_RATE
  const overtimePay = o.rate === null ? null : (overtimeMin / 60) * o.rate * OVERTIME_RATE

  return { days: results, totalMin, regularMin, overtimeMin, pay, overtimePay }
}

/** `7:30` — how a timesheet reads. */
export const hhmm = (min: number) => `${Math.floor(min / 60)}:${String(Math.round(min % 60)).padStart(2, '0')}`

/** `7.50` — what payroll wants, and where hand-totalled sheets go wrong. */
export const decimal = (min: number) => (min / 60).toFixed(2)
