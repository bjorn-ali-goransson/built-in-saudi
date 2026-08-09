// The fertile window, and the two things simple calculators get wrong.
//
// Found by a web sweep of the health-calculator market — 124 on one site, 71 on
// another — where an ovulation calculator is a staple and we had none, having
// just shipped its sibling `due-date`. The two are the same arithmetic read in
// opposite directions, and they link to each other.
//
// This module deliberately carries NO sources block of the kind the Saudi rule
// modules open with, and is declared in `check-saudi-beta.mjs`'s NOT_A_RULE for
// the same reason `due-date` is: nothing here is a published rate that moves.
// The luteal phase and the six-day fertile window are standard reproductive
// physiology, not a figure anybody republishes, so a beta badge would say
// something untrue about what kind of number this is.
//
// 1. **The LUTEAL phase is the fixed part, not the first half.** Ovulation to
//    the next period is about fourteen days whatever the cycle length; the
//    follicular phase is what varies. So ovulation is on cycle day
//    `length - 14`: day 14 on a 28-day cycle, day 21 on a 35-day one, day 7 on
//    a 21-day one. A calculator that adds a fixed 14 to the last period has
//    told a woman with a long cycle to try a week early, which is the single
//    most common error in the category.
// 2. **The fertile window ends at ovulation; it does not start there.** Sperm
//    survive up to five days, an egg about a day — so the days that matter are
//    the five BEFORE ovulation plus the day itself. People routinely wait for
//    the ovulation date and miss the window they were trying to hit.

const DAY = 86400000

/** Ovulation to period. The near-constant half of the cycle. */
export const LUTEAL_DAYS = 14
/** Sperm survival, and therefore how far before ovulation matters. */
export const SPERM_DAYS = 5

export interface Result {
  ovulation: Date
  /** Six days: five before ovulation, and ovulation itself. */
  fertileFrom: Date
  fertileTo: Date
  nextPeriod: Date
  /** A test is only reliable from the missed period. */
  testFrom: Date
  /** Negative once the window has passed; 0 while it is open. */
  daysToFertile: number
  inWindow: boolean
}

const add = (d: Date, n: number) => new Date(d.getTime() + n * DAY)

/** Midnight LOCAL, never `toISOString()` — east of Greenwich those disagree. */
export const startOfDay = (d: Date) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate())

export function calcOvulation(lmp: Date, cycle: number, luteal = LUTEAL_DAYS, today = new Date()): Result {
  const start = startOfDay(lmp)
  const len = Math.max(20, Math.min(45, Math.round(cycle)))
  const nextPeriod = add(start, len)
  // Cycle day `len - luteal`, counted 1-based from the LMP — which is the same
  // thing as counting back from the next period, and is what makes a long cycle
  // come out right. Counting forward from the LMP by a fixed 14 is the error.
  //
  // **The off-by-one here is real and was wrong at first.** Day 1 is the first
  // day of bleeding, so a 28-day cycle with a 14-day luteal phase puts
  // ovulation on day 14 and the luteal phase on days 15–28 — which is FIFTEEN
  // days before the next period's first day, not fourteen. Subtracting the
  // luteal length straight from the next period gives day 15 and contradicts
  // every published table. Its own spec caught it.
  const ovulation = add(start, Math.max(0, len - luteal - 1))
  const now = startOfDay(today)
  const fertileFrom = add(ovulation, -SPERM_DAYS)
  return {
    ovulation,
    fertileFrom,
    fertileTo: ovulation,
    nextPeriod,
    // Implantation takes about a week, so a test before the missed period is
    // mostly how people get a false negative and a bad day.
    testFrom: nextPeriod,
    daysToFertile: Math.round((fertileFrom.getTime() - now.getTime()) / DAY),
    inWindow: now >= fertileFrom && now <= ovulation,
  }
}

/** Every day of the window, for a list a person can put in a calendar. */
export function windowDays(r: Result): Date[] {
  const out: Date[] = []
  for (let d = new Date(r.fertileFrom); d <= r.ovulation; d = add(d, 1)) out.push(new Date(d))
  return out
}
