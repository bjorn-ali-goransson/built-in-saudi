import { describe, it, expect } from 'vitest'
import { formatCode, formatCodeColor, isDateCode, BUILTIN_FORMATS } from './fmtcode'
import { dateToSerial } from './dates'

const f = formatCode

describe('number pictures', () => {
  it.each([
    [1234.567, '0', '1235'],
    [1234.567, '0.00', '1234.57'],
    [1234.567, '#,##0', '1,235'],
    [1234.567, '#,##0.00', '1,234.57'],
    [0.5, '0.0', '0.5'],
    [0.5, '#.##', '.5'],
    [5, '00000', '00005'],
    [1234567, '#,##0,', '1,235'],
    [1234567, '0.0,,"M"', '1.2M'],
    [0.075, '0%', '8%'],
    [0.075, '0.0%', '7.5%'],
    [-0.075, '0.0%', '-7.5%'],
    [12345, '0.00E+00', '1.23E+04'],
    [0.000123, '0.00E+00', '1.23E-04'],
    [1.5, '# ?/?', '1 1/2'],
    [0.75, '?/?', '3/4'],
    [2.25, '# ??/??', '2 1/4'],
    [0.3333, '?/4', '1/4'],
    [42, 'General', '42'],
    [0.1 + 0.2, 'General', '0.3'],
    [1e12, 'General', '1E+12'],
  ])('%s with %s', (v, code, out) => {
    expect(f(v, code)).toBe(out)
  })
  it('literal text, escapes and currency markers', () => {
    expect(f(1500, '"SAR "#,##0')).toBe('SAR 1,500')
    expect(f(1500, '#,##0" ر.س"')).toBe('1,500 ر.س')
    expect(f(1500, '[$SAR-401] #,##0.00')).toBe('SAR 1,500.00')
    expect(f(1500, '[$-409]#,##0')).toBe('1,500')
    expect(f(5, '0\\ "units"')).toBe('5 units')
    expect(f(12, '0_);(0)')).toBe('12 ')
  })
})

describe('sections and colours', () => {
  it('positive;negative;zero;text', () => {
    const code = '#,##0;[Red](#,##0);"—";"Note: "@'
    expect(f(1234, code)).toBe('1,234')
    expect(formatCodeColor(-1234, code)).toEqual({ text: '(1,234)', color: '#ff0000' })
    expect(f(0, code)).toBe('—')
    expect(f('hello', code)).toBe('Note: hello')
  })
  it('a single section adds the minus itself', () => {
    expect(f(-5, '0.00')).toBe('-5.00')
    expect(f(-1234.5, '#,##0')).toBe('-1,235')
  })
  it('conditional sections', () => {
    const code = '[>=1000000]0.0,,"M";[>=1000]0.0,"K";0'
    expect(f(2500000, code)).toBe('2.5M')
    expect(f(2500, code)).toBe('2.5K')
    expect(f(25, code)).toBe('25')
  })
  it('strings with no text section pass through; booleans read TRUE/FALSE', () => {
    expect(f('abc', '0.00')).toBe('abc')
    expect(f(true, '0')).toBe('TRUE')
    expect(f('', '0')).toBe('')
  })
})

describe('dates and times', () => {
  const d = dateToSerial(2026, 9, 7) + 13.5 / 24 + 5 / 1440 + 9 / 86400 // 2026-09-07 13:35:09, a Monday
  it.each([
    ['yyyy-mm-dd', '2026-09-07'],
    ['dd/mm/yyyy', '07/09/2026'],
    ['d-mmm-yy', '7-Sep-26'],
    ['mmmm d, yyyy', 'September 7, 2026'],
    ['dddd', 'Monday'],
    ['ddd d mmm', 'Mon 7 Sep'],
    ['hh:mm', '13:35'],
    ['h:mm AM/PM', '1:35 PM'],
    ['hh:mm:ss', '13:35:09'],
    ['yyyy-mm-dd hh:mm', '2026-09-07 13:35'],
    ['mmmmm', 'S'],
    ['m/d/yy h:mm', '9/7/26 13:35'],
  ])('%s', (code, out) => { expect(f(d, code)).toBe(out) })
  it('elapsed time keeps counting past a day', () => {
    expect(f(1.5, '[h]:mm')).toBe('36:00')
    expect(f(0.5 / 24, '[mm]:ss')).toBe('30:00')
  })
  it('recognises date codes and not number codes', () => {
    expect(isDateCode('dd/mm/yyyy')).toBe(true)
    expect(isDateCode('[h]:mm')).toBe(true)
    expect(isDateCode('#,##0.00')).toBe(false)
    expect(isDateCode('"Days" 0')).toBe(false)
    expect(isDateCode('0.00E+00')).toBe(false)
    expect(isDateCode(BUILTIN_FORMATS[14])).toBe(true)
  })
})
