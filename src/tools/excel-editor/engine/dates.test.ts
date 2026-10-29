import { describe, expect, it } from 'vitest'
import { addMonths, dateToSerial, endOfMonth, formatSerial, nowSerial, parseIsoDate, serialToParts, todaySerial } from './dates'
import { Workbook, displayValue } from './engine'
import { parseA1, type SheetData } from './model'
import { formatValue } from './numfmt'

/**
 * Dates in Tables (#1355).
 *
 * A date is a serial number wearing a date format, so almost everything that can go wrong here is
 * an OFF-BY-ONE-DAY — which renders as a perfectly plausible date and is invisible until someone
 * reconciles against another system. That is what most of these assert.
 */
function sheet(name: string, cells: Record<string, string>): SheetData {
  const c: SheetData['cells'] = {}
  for (const [ref, input] of Object.entries(cells)) {
    const a = parseA1(ref)!
    c[`${a.row},${a.col}`] = { input }
  }
  return { name, cells: c, rows: 30, cols: 10 }
}
function calc(cells: Record<string, string>, formula: string): string {
  const s = [sheet('S', { ...cells, Z1: formula })]
  return displayValue(new Workbook(s).value('S', parseA1('Z1')!))
}

describe('the serial epoch', () => {
  /**
   * The anchor the whole scheme rests on. Excel's serial 61 is 1900-03-01, and from that day
   * forward our epoch agrees with it — which is the compatibility that matters, since below it lies
   * Excel's phantom 1900-02-29 that CLAUDE.md says we do not reproduce.
   */
  it('agrees with Excel from 1900-03-01 onward', () => {
    expect(dateToSerial(1900, 3, 1)).toBe(61)
    // Two dates Excel users know by heart.
    expect(dateToSerial(2000, 1, 1)).toBe(36526)
    expect(dateToSerial(2026, 9, 9)).toBe(46274)
  })

  it('round-trips a date through its serial', () => {
    for (const [y, m, d] of [
      [2026, 9, 9],
      [2000, 2, 29], // a real leap day
      [1999, 12, 31],
      [2100, 1, 1],
    ]) {
      const parts = serialToParts(dateToSerial(y, m, d))
      expect([parts.year, parts.month, parts.day]).toEqual([y, m, d])
    }
  })

  /**
   * Serials are built in UTC on purpose. Were they built from local time, the same sheet would
   * report different days either side of a timezone boundary — a bug only some readers can see.
   */
  it('does not drift across a timezone boundary', () => {
    expect(formatSerial(dateToSerial(2026, 1, 1))).toBe('2026-01-01')
    expect(formatSerial(dateToSerial(2026, 12, 31))).toBe('2026-12-31')
  })
})

describe('DATE, YEAR, MONTH, DAY', () => {
  it('builds a date and reads its parts back', () => {
    expect(calc({}, '=YEAR(DATE(2026,9,9))')).toBe('2026')
    expect(calc({}, '=MONTH(DATE(2026,9,9))')).toBe('9')
    expect(calc({}, '=DAY(DATE(2026,9,9))')).toBe('9')
  })

  /** Excel rolls an out-of-range part over, and that is what makes "12 months from now" work. */
  it('rolls a month past December into the next year', () => {
    expect(calc({}, '=YEAR(DATE(2026,13,1))')).toBe('2027')
    expect(calc({}, '=MONTH(DATE(2026,13,1))')).toBe('1')
  })

  it('is #NUM! for a serial that names no date', () => {
    expect(calc({}, '=YEAR(-5)')).toBe('#NUM!')
  })
})

describe('date arithmetic', () => {
  /** The reason serials were chosen over a string type: subtraction is just subtraction. */
  it('subtracts two dates into a day count with no special casing', () => {
    expect(calc({ A1: '=DATE(2026,1,1)', A2: '=DATE(2026,3,1)' }, '=A2-A1')).toBe('59')
    expect(calc({ A1: '=DATE(2026,1,1)', A2: '=DATE(2026,3,1)' }, '=DAYS(A2,A1)')).toBe('59')
  })

  /**
   * The clamp is the whole difference between EDATE and adding 30 days. 31 January plus one month
   * is 28 February, not 3 March — which is what `Date` does if the day is not clamped, and it makes
   * a monthly schedule drift a day at a time.
   */
  it('clamps EDATE to a day the target month actually has', () => {
    expect(formatSerial(addMonths(dateToSerial(2026, 1, 31), 1))).toBe('2026-02-28')
    expect(formatSerial(addMonths(dateToSerial(2024, 1, 31), 1)), 'a leap year has the 29th').toBe('2024-02-29')
    expect(calc({}, '=MONTH(EDATE(DATE(2026,1,31),1))')).toBe('2')
    expect(calc({}, '=DAY(EDATE(DATE(2026,1,31),1))')).toBe('28')
  })

  it('finds the end of a month, this one and a later one', () => {
    expect(formatSerial(endOfMonth(dateToSerial(2026, 2, 5), 0))).toBe('2026-02-28')
    expect(formatSerial(endOfMonth(dateToSerial(2026, 1, 15), 1))).toBe('2026-02-28')
    expect(formatSerial(endOfMonth(dateToSerial(2026, 11, 15), 1))).toBe('2026-12-31')
    expect(calc({}, '=DAY(EOMONTH(DATE(2026,4,3),0))')).toBe('30')
  })

  it('numbers the weekday from Sunday by default and from Monday on request', () => {
    // 2026-09-09 is a Wednesday.
    expect(calc({}, '=WEEKDAY(DATE(2026,9,9))')).toBe('4')
    expect(calc({}, '=WEEKDAY(DATE(2026,9,9),2)')).toBe('3')
  })
})

describe('TODAY and NOW', () => {
  it('gives today as a whole day, and now as that day plus a fraction of it', () => {
    const at = new Date(2026, 8, 9, 6, 0, 0) // local noon-ish, month is 0-based here
    expect(todaySerial(at)).toBe(dateToSerial(2026, 9, 9))
    expect(nowSerial(at)).toBeCloseTo(dateToSerial(2026, 9, 9) + 0.25, 5)
  })

  /** The point of TODAY is that it is a whole day — a fraction would break every comparison. */
  it('TODAY carries no time of day', () => {
    expect(Number.isInteger(todaySerial(new Date(2026, 8, 9, 23, 59, 59)))).toBe(true)
  })
})

describe('a date renders as a date', () => {
  /**
   * Without the format the cell shows the serial, which is the one thing that makes the whole
   * scheme look broken to a user: they asked for a date and got 46274.
   */
  it('formats a serial under the date numFmt, and leaves it a number otherwise', () => {
    expect(formatValue(dateToSerial(2026, 9, 9), 'date')).toBe('2026-09-09')
    expect(formatValue(dateToSerial(2026, 9, 9), 'general')).toBe('46274')
  })
})

describe('an ISO date typed into a cell', () => {
  it('is recognised', () => {
    expect(parseIsoDate('2026-09-09')).toBe(dateToSerial(2026, 9, 9))
    expect(parseIsoDate('  2026-09-09  ')).toBe(dateToSerial(2026, 9, 9))
  })

  /**
   * Everything ambiguous is REFUSED. A spreadsheet that turns a part number, a score line or a
   * ratio into a date is the single most complained-about behaviour Excel has, and the only way not
   * to have it is to accept one unambiguous spelling and nothing else.
   */
  it('refuses anything that is not unambiguously a date', () => {
    for (const notADate of ['9/9/2026', '1-2', '2026-9-9', 'A-100', '2026', '', 'Sept 9']) {
      expect(parseIsoDate(notADate), `${notADate} was read as a date`).toBeNull()
    }
  })

  it('refuses a date that does not exist rather than rolling it over', () => {
    expect(parseIsoDate('2026-02-30')).toBeNull()
    expect(parseIsoDate('2026-13-01')).toBeNull()
    expect(parseIsoDate('2025-02-29'), '2025 is not a leap year').toBeNull()
    expect(parseIsoDate('2024-02-29')).toBe(dateToSerial(2024, 2, 29))
  })
})

/**
 * A date somebody TYPED, rather than one built with =DATE() or imported from Excel. This is the
 * common path and it was the one left broken: `2026-09-09` is not a number to `Number()`, so before
 * this every typed date was #VALUE! the moment it reached arithmetic.
 */
describe('a typed ISO date behaves as a date', () => {
  it('subtracts, and feeds the date functions', () => {
    expect(calc({ A1: '2026-01-01', A2: '2026-03-01' }, '=A2-A1')).toBe('59')
    expect(calc({ A1: '2026-09-09' }, '=YEAR(A1)')).toBe('2026')
    expect(calc({ A1: '2026-09-09' }, '=MONTH(A1)')).toBe('9')
    expect(calc({ A1: '2026-09-09' }, '=DAYS(A1,"2026-09-01")')).toBe('8')
  })

  it('mixes with a date built by DATE()', () => {
    expect(calc({ A1: '2026-09-09' }, '=A1-DATE(2026,9,1)')).toBe('8')
  })

  /** Text that is not a date is still #VALUE! in arithmetic — the coercion widened, not loosened. */
  it('leaves ambiguous text as an error rather than guessing', () => {
    expect(calc({ A1: '9/9/2026' }, '=A1+1')).toBe('#VALUE!')
    expect(calc({ A1: 'A-100' }, '=A1+1')).toBe('#VALUE!')
  })
})
