/**
 * DATES AS SERIAL NUMBERS (#1355).
 *
 * A date in a sheet is a NUMBER carrying a date `numFmt`, not a distinct cell type. That is the
 * decision the issue was opened to make, and it is the one `.xlsx` already made for us: the file
 * format stores dates this way, so import and export line up without a conversion layer, and
 * `=B2-A2` is a day count for free — which is most of why anyone wants dates in a spreadsheet at
 * all. The alternative considered was an ISO string cell type: readable in the raw model, but then
 * every date calculation needs explicit parsing and subtraction has to be special-cased in the
 * engine.
 *
 * The cost is that a date is indistinguishable from a number without its format, which makes the
 * format load-bearing rather than cosmetic. That is the trade Excel and Sheets both make.
 *
 * ## The epoch, and the leap-year bug we do not reproduce
 *
 * Serials are days since **1899-12-30 UTC**. Excel's day 1 is 1900-01-01 and it believes 1900 was a
 * leap year, so it has a phantom 1900-02-29; this epoch agrees with Excel for every date from
 * 1900-03-01 onward and differs below it. CLAUDE.md names that bug as something we deliberately do
 * not carry, and no business spreadsheet contains February 1900.
 *
 * UTC throughout, never local time. A serial built from local dates lands on the wrong day for
 * anyone east or west of the machine that made it, which in a product shipping in Riyadh and read
 * anywhere is a bug that only some people can see.
 */

/** Milliseconds in a day — dates here are whole days plus an optional fraction for the time. */
const DAY_MS = 86_400_000
/** Day 0. See the note above on why this is 1899-12-30 and not 1900-01-01. */
const EPOCH_MS = Date.UTC(1899, 11, 30)

/** A calendar date to its serial. Month is 1-based, as every date function states it. */
export function dateToSerial(year: number, month: number, day: number): number {
  // `Date.UTC` normalises out-of-range parts, which is what makes DATE(2026,13,1) mean January 2027
  // and EOMONTH's "day 0 of next month" trick give the last day of this one.
  return Math.round((Date.UTC(year, month - 1, day) - EPOCH_MS) / DAY_MS)
}

/** A serial back to its calendar parts. The fractional part (a time of day) is discarded. */
export function serialToParts(serial: number): { year: number; month: number; day: number; weekday: number } {
  const d = new Date(EPOCH_MS + Math.floor(serial) * DAY_MS)
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
    // 0 = Sunday, matching `Date`; WEEKDAY's own numbering is applied by the function, not here.
    weekday: d.getUTCDay(),
  }
}

/**
 * Today as a serial, in the READER's timezone.
 *
 * Deliberately local rather than UTC: "today" is a claim about the calendar on the wall of whoever
 * is looking at the sheet, and a reader in Riyadh at 01:00 must not be shown yesterday because UTC
 * has not caught up. The serial itself is still a plain day count — only the choice of which day
 * is local.
 */
export function todaySerial(now: Date = new Date()): number {
  return dateToSerial(now.getFullYear(), now.getMonth() + 1, now.getDate())
}

/** Now as a serial, whole days plus the fraction of the day elapsed locally. */
export function nowSerial(now: Date = new Date()): number {
  const secondsIntoDay = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds()
  return todaySerial(now) + secondsIntoDay / 86_400
}

/** Add `months` to a serial, clamping to the last valid day — 31 Jan plus one month is 28 Feb. */
export function addMonths(serial: number, months: number): number {
  const { year, month, day } = serialToParts(serial)
  const target = new Date(Date.UTC(year, month - 1 + months, 1))
  // The last day of the target month, so a day number the target month does not have is clamped
  // rather than rolling into the next one — `Date` would turn 31 February into 3 March.
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate()
  return dateToSerial(target.getUTCFullYear(), target.getUTCMonth() + 1, Math.min(day, lastDay))
}

/** The last day of the month `months` away from `serial`. */
export function endOfMonth(serial: number, months: number): number {
  const { year, month } = serialToParts(serial)
  // Day 0 of the following month is the last day of this one — `Date.UTC` normalises it for us.
  return Math.round((Date.UTC(year, month + months, 0) - EPOCH_MS) / DAY_MS)
}

/** `YYYY-MM-DD` for display and export. ISO, so it reads the same in both of our locales. */
export function formatSerial(serial: number): string {
  const { year, month, day } = serialToParts(serial)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${year}-${pad(month)}-${pad(day)}`
}

/**
 * An ISO date typed into a cell, as a serial — or null when the text is not one.
 *
 * ISO ONLY, deliberately. `2026-09-09` has one reading everywhere; `9/9/26` and `1-2` do not, and a
 * spreadsheet that silently turns a part number or a score line into a date is the single most
 * complained-about behaviour Excel has. A user who wants another format writes `=DATE(...)`.
 */
export function parseIsoDate(text: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text.trim())
  if (!m) return null
  const year = Number(m[1])
  const month = Number(m[2])
  const day = Number(m[3])
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  const serial = dateToSerial(year, month, day)
  // Reject a date that does not exist (30 February) rather than accepting the day `Date` rolls to.
  const back = serialToParts(serial)
  return back.month === month && back.day === day ? serial : null
}
