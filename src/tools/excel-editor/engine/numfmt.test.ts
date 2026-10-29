import { describe, expect, it } from 'vitest'
import { formatValue, toExcelNumFmt, stepDecimals, shownDecimals, MAX_DECIMALS } from './numfmt'

// Round-8 audit: display rounding must match the ROUND function (half away from zero),
// or the same value shows one way in a formatted cell and another via =ROUND(...).
describe('number-format rounding matches ROUND (half away from zero)', () => {
  it('thousands rounds negative halves away from zero', () => {
    expect(formatValue(-2.5, 'thousands')).toBe('-3') // was "-2" (Math.round → +∞)
    expect(formatValue(2.5, 'thousands')).toBe('3')
    expect(formatValue(-0.5, 'thousands')).toBe('-1')
  })

  it('percent rounds negative halves away from zero', () => {
    expect(formatValue(-0.125, 'percent')).toBe('-13%') // was "-12%"
    expect(formatValue(0.125, 'percent')).toBe('13%')
  })

  it('does not emit a negative-zero string', () => {
    expect(formatValue(-0.004, 'percent')).toBe('0%')
  })
})

/**
 * DECIMAL PLACES (#1361 follow-up).
 *
 * Every format had its places baked in — `number` always two, `percent` and `thousands` always
 * none — so a rate of 3.25 could not be shown to three places and 0.5% rendered as "1%". These
 * hold the arithmetic the screen and the exported file BOTH read, because the way this fails is
 * the two disagreeing about the same number.
 */
describe('decimal places', () => {
  it('honours the cell’s places for each format', () => {
    expect(formatValue(3.14159, 'number', undefined, 3)).toBe('3.142')
    expect(formatValue(1234.5678, 'thousands', undefined, 2)).toBe('1,234.57')
    expect(formatValue(0.005, 'percent', undefined, 1)).toBe('0.5%')
    expect(formatValue(1234.5, 'currency', 'USD', 0)).toBe('$1,235')
  })

  it('keeps each format’s own default when the cell asks for nothing', () => {
    expect(formatValue(3.14159, 'number')).toBe('3.14')
    expect(formatValue(1234.5678, 'thousands')).toBe('1,235')
    expect(formatValue(0.125, 'percent')).toBe('13%')
  })

  /**
   * A CURRENCY'S OWN PLACES when the cell does not ask — `Intl` knows a yen has none and a dinar
   * has three. Hard-coding 2 would print ¥1,200.00, which is wrong in Japan and reads as a bug.
   */
  it('lets the currency decide when the cell does not', () => {
    expect(formatValue(1200, 'currency', 'JPY')).not.toContain('.00')
    expect(formatValue(1200, 'currency', 'USD')).toContain('.00')
    // …and the cell still wins when it does ask.
    expect(formatValue(1200, 'currency', 'JPY', 2)).toContain('.00')
  })

  it('zero places means no point at all, not a trailing dot', () => {
    expect(formatValue(3.7, 'number', undefined, 0)).toBe('4')
    expect(formatValue(1234.5, 'thousands', undefined, 0)).toBe('1,235')
  })
})

describe('toExcelNumFmt with places', () => {
  /** Excel spells the places into the code itself — a wrong string silently rounds in the file. */
  it('writes the cell’s places into the format string', () => {
    expect(toExcelNumFmt('number', undefined, 3)).toBe('0.000')
    expect(toExcelNumFmt('thousands', undefined, 2)).toBe('#,##0.00')
    expect(toExcelNumFmt('percent', undefined, 1)).toBe('0.0%')
    expect(toExcelNumFmt('currency', 'USD', 0)).toBe('#,##0" USD"')
  })

  it('keeps the old strings when the cell asks for nothing', () => {
    expect(toExcelNumFmt('number')).toBe('0.00')
    expect(toExcelNumFmt('thousands')).toBe('#,##0')
    expect(toExcelNumFmt('percent')).toBe('0%')
  })
})

describe('stepDecimals', () => {
  it('adds and removes a place', () => {
    expect(stepDecimals('number', 2, 1, 0)).toEqual({ numFmt: 'number', decimals: 3 })
    expect(stepDecimals('number', 2, -1, 0)).toEqual({ numFmt: 'number', decimals: 1 })
  })

  it('starts from the format’s own default when the cell has no places yet', () => {
    expect(stepDecimals('percent', undefined, 1, 0)).toEqual({ numFmt: 'percent', decimals: 1 })
    expect(stepDecimals('number', undefined, -1, 0)).toEqual({ numFmt: 'number', decimals: 1 })
  })

  /**
   * A GENERAL cell becomes a number format — "one more place than no format at all" has to mean
   * something — and it grows from what it was ALREADY SHOWING, so pressing "more" on 3.25 gives
   * three places rather than dropping to 0.00 first.
   */
  it('turns a general cell into a number, starting from what it displays', () => {
    expect(stepDecimals('general', undefined, 1, 2)).toEqual({ numFmt: 'number', decimals: 3 })
    expect(stepDecimals(undefined, undefined, 1, 0)).toEqual({ numFmt: 'number', decimals: 1 })
  })

  it('stops at none, and at a readable maximum', () => {
    expect(stepDecimals('number', 0, -1, 0).decimals).toBe(0)
    expect(stepDecimals('number', MAX_DECIMALS, 1, 0).decimals).toBe(MAX_DECIMALS)
  })
})

describe('shownDecimals', () => {
  it('counts the places a number is already displaying', () => {
    expect(shownDecimals(3.25)).toBe(2)
    expect(shownDecimals(7)).toBe(0)
    expect(shownDecimals('text')).toBe(0)
    expect(shownDecimals(Number.NaN)).toBe(0)
  })
})
