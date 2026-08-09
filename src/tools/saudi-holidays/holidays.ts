// The official paid holidays, and the four rules people get wrong about them.
//
// SOURCES — checked 10 August 2026
//   Labour Law **Article 112** and its implementing rules, published by the
//   Ministry of Human Resources and Social Development (HRSD), corroborated
//   across two independent legal summaries before being encoded:
//     · Eid al-Fitr — **4 days, starting the day after 29 Ramadan** on the Umm
//       al-Qura calendar.
//     · Eid al-Adha — **4 days, starting on the Day of Arafah** (9 Dhu al-Hijja).
//     · National Day — **23 September**, one day. The instrument defines it as
//       the first day of Libra on the solar Umm al-Qura reckoning, which is
//       that date.
//     · Founding Day — **22 February**, one day, by royal order of 2022.
//     · A holiday falling on the weekly rest day is **compensated** by the
//       adjacent day — EXCEPT that National Day coinciding with an Eid holiday
//       is not compensated.
//     · A holiday falling inside annual leave **extends** the annual leave.
//   Ten days in total, which is the figure HRSD publishes.
//
// Found by a CODE SWEEP rather than a web sweep, and by measurement: the site
// already had Umm al-Qura conversion, an Islamic events table and an
// `upcomingEvents()` function **that nothing called**, while «الإجازات
// الرسمية» returned NOTHING from the search and «كم باقي على العيد» returned
// the vehicle-registration tool. The capability was built and no page exposed
// it.
//
// FOUR THINGS THAT MAKE THIS WORTH BUILDING RATHER THAN LISTING:
//
// 1. **Half the list is fixed and half of it moves.** National Day and
//    Founding Day are Gregorian dates set by decree; the two Eids follow the
//    Hijri year and arrive about eleven days earlier each Gregorian year. That
//    is why a hand-typed list on a blog is half-stale within a year, and it is
//    the reason to compute rather than tabulate.
//
// 2. **The Eid al-Fitr holiday can START BEFORE EID.** The rule anchors it to
//    "the day after 29 Ramadan", so in a 30-day Ramadan the first day of the
//    holiday is 30 Ramadan — still a fasting day — and Eid itself is the
//    second day. In a 29-day Ramadan the holiday and Eid begin together. Almost
//    every published list assumes the second case.
//
// 3. **The entitlement is CALENDAR-defined and the festival is SIGHTING-defined,
//    and they can differ by a day.** Article 112 names the Umm al-Qura
//    calendar; the actual Eid is announced on the moon sighting. A countdown
//    that does not say so is quietly claiming a certainty nobody has.
//
// 4. **The interaction rules are where the money is.** Landing on the weekend
//    is compensated, National Day landing inside an Eid holiday is NOT, and a
//    holiday inside annual leave extends the leave. Those are the three
//    questions an employee actually has, and no calendar page answers any.

import { gregorianToHijri, hijriToGregorian, daysInHijriMonth } from '../prayer-times/islamic'

export type HolidayKey = 'foundingDay' | 'eidFitr' | 'eidAdha' | 'nationalDay'

export interface Holiday {
  key: HolidayKey
  /** First day of the holiday, at local midnight. */
  start: Date
  days: number
  /** Set by decree to a Gregorian date, rather than moving with the Hijri year. */
  fixed: boolean
  /** True when the single-day holiday lands on the weekly rest day. */
  onWeekend: boolean
  /**
   * True when the weekend landing is NOT compensated, because this is National
   * Day and it falls inside an Eid holiday.
   */
  swallowed: boolean
}

/** Friday and Saturday. Starting the week on Monday is somebody else's rule. */
const isWeekend = (d: Date) => d.getDay() === 5 || d.getDay() === 6

const at = (y: number, m: number, d: number) => new Date(y, m - 1, d)
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
export const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())

export const daysBetween = (a: Date, b: Date) =>
  Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / 86400000)

/** Whether `day` falls inside a holiday's span. */
export const covers = (h: Holiday, day: Date) => {
  const n = daysBetween(h.start, day)
  return n >= 0 && n < h.days
}

/**
 * Eid al-Fitr's first day: the day AFTER 29 Ramadan. In a 30-day Ramadan that
 * is 30 Ramadan — the last fasting day — so the holiday opens before the
 * festival does. See note 2 above.
 */
function eidFitrStart(hy: number): Date {
  return addDays(hijriToGregorian(hy, 9, 29), 1)
}

/** Whether Ramadan runs 29 or 30 days in this Hijri year — note 2 turns on it. */
export const ramadanLength = (hy: number) => daysInHijriMonth(hy, 9)

/**
 * Every official holiday whose FIRST day falls in the given Gregorian year.
 *
 * The Hijri year is about eleven days shorter, so a Gregorian year can hold two
 * Ramadans (or none of a given event). Three candidate Hijri years are tried
 * and the ones that land are kept, rather than assuming one of each — a list
 * that silently drops the second Eid of a year would be wrong in exactly the
 * year somebody looked it up.
 */
export function holidaysIn(year: number): Holiday[] {
  const out: Holiday[] = []

  const add = (key: HolidayKey, start: Date, days: number, fixed: boolean) => {
    if (start.getFullYear() !== year) return
    out.push({ key, start, days, fixed, onWeekend: false, swallowed: false })
  }

  add('foundingDay', at(year, 2, 22), 1, true)
  add('nationalDay', at(year, 9, 23), 1, true)

  const hy = gregorianToHijri(at(year, 7, 1)).y
  for (const y of [hy - 1, hy, hy + 1]) {
    add('eidFitr', eidFitrStart(y), 4, false)
    add('eidAdha', hijriToGregorian(y, 12, 9), 4, false)
  }

  out.sort((a, b) => a.start.getTime() - b.start.getTime())

  // The interaction rules, applied only to the one-day holidays — an Eid
  // holiday is four days and always covers a working day.
  for (const h of out) {
    if (h.days !== 1) continue
    h.onWeekend = isWeekend(h.start)
    h.swallowed = h.key === 'nationalDay'
      && out.some((o) => o.days > 1 && covers(o, h.start))
  }
  return out
}

/** Total days of official holiday in a Gregorian year. */
export const totalDays = (list: Holiday[]) => list.reduce((n, h) => n + h.days, 0)

/**
 * The next holiday to begin on or after `from`, looking into next year so that
 * asking in October does not come back empty.
 */
export function nextHoliday(from: Date): Holiday | null {
  const today = startOfDay(from)
  const y = today.getFullYear()
  for (const h of [...holidaysIn(y), ...holidaysIn(y + 1)]) {
    if (daysBetween(today, addDays(h.start, h.days - 1)) >= 0) return h
  }
  return null
}
