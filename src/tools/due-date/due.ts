// Working out a due date, and the dates around it.
//
// Found by a web sweep of the Arabic tool sites we compete with: a pregnancy
// due-date calculator is on essentially every one of them (3arabhub, hesaby,
// alarabictools all list حاسبة الحمل) and this site had none, while shipping a
// calorie calculator, a water-intake calculator, a sleep-cycle calculator and a
// glucose-unit converter.
//
// This module deliberately carries NO sources block of the kind the Saudi rule
// modules open with. That block means "a published rate that MOVES, verified on
// this date", and `check-saudi-beta.mjs` reads it as a reason to demand a beta
// badge — rightly, since a beta badge says the figure can go stale without
// anyone touching the code. Naegele's rule (EDD = first day of the last
// menstrual period + 280 days, assuming ovulation on day 14 of a 28-day cycle)
// dates from 1812, and the 37–42 week term window is not a rate anybody
// publishes annually. Claiming otherwise would be a lie about what kind of
// number this is, so `due-date` is declared in that script's NOT_A_RULE with
// this reason instead.

export type Basis = 'lmp' | 'conception' | 'ivf3' | 'ivf5' | 'edd'

export interface DueResult {
  /** Estimated due date. */
  edd: Date
  /** The date the 280 days are counted from (a derived LMP). */
  lmp: Date
  /** Completed weeks and days of gestation today. */
  weeks: number
  days: number
  /** 1, 2 or 3 — or 0 before conception, 4 past 42 weeks. */
  trimester: number
  /** Days between today and the due date; negative once past it. */
  daysToGo: number
  /** How far off a 28-day cycle shifted the due date, in days. */
  cycleShift: number
  milestones: { key: string; date: Date }[]
}

const DAY = 86400000
export const GESTATION_DAYS = 280

/**
 * Full term, in days from the LMP: 37 weeks to 42 weeks.
 *
 * Exported because the calendar export needs the RANGE rather than the due
 * date. About 1 baby in 25 arrives on the due date, and everything from 37 to
 * 42 weeks is full term — so a calendar carrying one dated "Due date" and
 * nothing else reinforces exactly the misconception this tool refuses on
 * screen.
 */
export const FULL_TERM_FROM_DAYS = 37 * 7
export const FULL_TERM_TO_DAYS = 42 * 7

const add = (d: Date, days: number) => new Date(d.getTime() + days * DAY)

/** Midnight LOCAL, never `toISOString()` — east of Greenwich those disagree. */
export const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())

/**
 * The LMP the 280 days are counted from, whatever the user actually knows.
 *
 * **The cycle length is the thing every simple calculator gets wrong.** Naegele's
 * rule assumes ovulation on day 14; on a 35-day cycle it happens around day 21,
 * so the due date is a WEEK later than "LMP + 280" says. A woman with a long
 * cycle told the wrong date is the one who gets offered an induction she does
 * not need, so the shift is applied and then stated in words rather than folded
 * silently into the answer.
 *
 * The other bases are exact and need no cycle at all — which is the point of
 * offering them. An IVF transfer date is known to the day, so guessing at
 * ovulation from it would be inventing uncertainty that does not exist.
 */
export function toLmp(basis: Basis, date: Date, cycle: number): { lmp: Date; shift: number } {
  const d = startOfDay(date)
  switch (basis) {
    case 'lmp': {
      const shift = Math.round(cycle - 28)
      return { lmp: add(d, shift), shift }
    }
    // Conception is ovulation, which the rule puts 14 days after the LMP.
    case 'conception': return { lmp: add(d, -14), shift: 0 }
    // A day-3 embryo is 3 days past fertilisation, a day-5 blastocyst 5.
    case 'ivf3': return { lmp: add(d, -17), shift: 0 }
    case 'ivf5': return { lmp: add(d, -19), shift: 0 }
    // A first-trimester scan dates a pregnancy better than any period does, so
    // when one has given an EDD it is taken as given and worked backwards from.
    case 'edd': return { lmp: add(d, -GESTATION_DAYS), shift: 0 }
  }
}

export function calcDue(basis: Basis, date: Date, cycle: number, today = new Date()): DueResult {
  const { lmp, shift } = toLmp(basis, date, cycle)
  const edd = add(lmp, GESTATION_DAYS)
  const now = startOfDay(today)
  const elapsed = Math.floor((now.getTime() - lmp.getTime()) / DAY)
  const weeks = Math.floor(elapsed / 7)
  const days = ((elapsed % 7) + 7) % 7

  let trimester = 0
  if (elapsed >= 0 && weeks < 14) trimester = 1
  else if (weeks < 28) trimester = 2
  else if (weeks <= 42) trimester = 3
  else trimester = 4

  return {
    edd,
    lmp,
    weeks: Math.max(0, weeks),
    days: elapsed < 0 ? 0 : days,
    trimester,
    daysToGo: Math.round((startOfDay(edd).getTime() - now.getTime()) / DAY),
    cycleShift: shift,
    milestones: [
      { key: 'trimester2', date: add(lmp, 14 * 7) },
      { key: 'viability', date: add(lmp, 24 * 7) },
      { key: 'trimester3', date: add(lmp, 28 * 7) },
      { key: 'termEarly', date: add(lmp, 37 * 7) },
      { key: 'edd', date: edd },
      { key: 'termLate', date: add(lmp, 42 * 7) },
    ],
  }
}
