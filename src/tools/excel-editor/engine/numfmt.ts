/**
 * A small, fixed set of number formats — the business 80/20, not Excel's whole
 * format-string grammar. Each preset knows how to render a number; text/bool/error
 * pass through unformatted.
 */
import { displayValue } from './engine'
import { formatSerial } from './dates'
import { isError, type CellValue } from './model'

export type NumFmtId = 'general' | 'number' | 'thousands' | 'percent' | 'currency' | 'date'

export const NUM_FORMATS: { id: NumFmtId; label: string }[] = [
  { id: 'general', label: 'General' },
  { id: 'number', label: '0.00' },
  { id: 'thousands', label: '#,##0' },
  { id: 'percent', label: '0%' },
  { id: 'currency', label: 'Currency' },
  /**
   * A date is a NUMBER wearing this format (#1355) — see `dates.ts` for why. Which makes this
   * entry load-bearing rather than cosmetic: without it the cell shows 46275, not 2026-09-09.
   */
  { id: 'date', label: 'Date' },
]

/** Currencies the picker offers. The code is stored on the cell; SAR is the default. */
export const CURRENCIES: { code: string; label: string }[] = [
  { code: 'SAR', label: 'SAR — Saudi Riyal' },
  { code: 'USD', label: 'USD — US Dollar' },
  { code: 'EUR', label: 'EUR — Euro' },
  { code: 'GBP', label: 'GBP — Pound Sterling' },
  { code: 'AED', label: 'AED — UAE Dirham' },
  { code: 'QAR', label: 'QAR — Qatari Riyal' },
  { code: 'KWD', label: 'KWD — Kuwaiti Dinar' },
  { code: 'BHD', label: 'BHD — Bahraini Dinar' },
  { code: 'EGP', label: 'EGP — Egyptian Pound' },
  { code: 'JPY', label: 'JPY — Japanese Yen' },
]
export const DEFAULT_CURRENCY = 'SAR'

/**
 * HOW MANY DECIMAL PLACES, when the cell does not say.
 *
 * Every format had its places baked in — `number` was always two, `percent` and `thousands` always
 * none — so a sheet could show 0.5% as "1%" or a rate of 3.25 as "3.25" with no way to ask for
 * three places. These are the defaults a cell falls back to, and `CellFormat.decimals` overrides
 * them.
 *
 * `currency` is absent DELIBERATELY: the right number of places is a property of the CURRENCY (two
 * for a riyal, none for a yen), and `Intl` already knows every one of them. Baking in 2 would print
 * ¥1,200.00, which is wrong in Japan and looks wrong everywhere.
 */
export const DEFAULT_DECIMALS: Partial<Record<NumFmtId, number>> = {
  number: 2,
  thousands: 0,
  percent: 0,
}

/** The most places a cell may ask for — past this the number is noise, and the column is unreadable. */
export const MAX_DECIMALS = 10

/**
 * What "more decimals" and "fewer decimals" do, including the case Excel is careful about: pressing
 * either on a GENERAL cell turns it into a number format, because "one more place than no format at
 * all" has to mean something. Pure, so the two buttons and their tests share one answer.
 */
export function stepDecimals(
  fmt: NumFmtId | undefined,
  decimals: number | undefined,
  dir: 1 | -1,
  shown: number,
): { numFmt: NumFmtId; decimals: number } {
  /**
   * A cell with NO format adopts the plain number one and starts from what it was ALREADY
   * SHOWING — otherwise "more places" on a cell displaying 3.25 would first drop it to 3.00.
   * A cell that HAS a format starts from that format's own default (`number` is two places,
   * `percent` none), which is what its display was using.
   */
  const explicit = fmt && fmt !== 'general' ? fmt : undefined
  const base = explicit ?? 'number'
  const from = decimals ?? (explicit ? (DEFAULT_DECIMALS[explicit] ?? 2) : shown)
  return { numFmt: base, decimals: Math.max(0, Math.min(MAX_DECIMALS, from + dir)) }
}

/** The decimal places a value is already displayed with — the starting point for a general cell. */
export function shownDecimals(v: unknown): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) return 0
  const s = String(v)
  const dot = s.indexOf('.')
  return dot === -1 ? 0 : Math.min(MAX_DECIMALS, s.length - dot - 1)
}

const group = (s: string) => s.replace(/\B(?=(\d{3})+(?!\d))/g, ',')

function formatCurrency(n: number, code: string, decimals?: number): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: code,
      // Left to `Intl` when the cell does not ask: it knows a yen has no decimal places and a
      // dinar has three, which is not something to hard-code per currency here.
      ...(decimals === undefined ? {} : { minimumFractionDigits: decimals, maximumFractionDigits: decimals }),
    }).format(n)
  } catch {
    // Unknown code → fall back to a plain grouped amount with the code appended.
    return `${group(n.toFixed(decimals ?? 2))} ${code}`
  }
}

// Half away from zero, matching the ROUND function (formula.ts). Math.round breaks
// ties toward +∞, so a formatted -2.5 showed "-2" while =ROUND(-2.5,0) gives -3 — our
// display and our formulas disagreeing on the same value. Consistency wins.
const roundHalfAway = (n: number): number => Math.sign(n) * Math.round(Math.abs(n))

/** Render a cell value under a number format. Non-numbers are shown as-is. */
export function formatValue(
  v: CellValue,
  fmt: NumFmtId | undefined,
  currency: string = DEFAULT_CURRENCY,
  /** Places the cell asks for; absent means the format's own default (`DEFAULT_DECIMALS`). */
  decimals?: number,
): string {
  if (fmt == null || fmt === 'general' || typeof v !== 'number' || isError(v)) {
    return displayValue(v)
  }
  const n = v
  const dp = decimals ?? DEFAULT_DECIMALS[fmt]
  switch (fmt) {
    case 'number':
      return n.toFixed(dp ?? 2)
    case 'thousands':
      // Grouped, and the places (if any) after it — `group` works on the integer part only.
      return dp ? group(n.toFixed(dp)) : group(roundHalfAway(n).toString())
    case 'percent':
      return dp ? `${(n * 100).toFixed(dp)}%` : `${roundHalfAway(n * 100)}%`
    case 'currency':
      return formatCurrency(n, currency || DEFAULT_CURRENCY, decimals)
    case 'date':
      // A date has no decimal places — a serial with a fraction is a TIME, which is its own format.
      return formatSerial(n)
  }
}

/**
 * A CELL'S OWN FORMAT, which is what every surface actually has in its hand.
 *
 * `formatValue` takes the pieces loose, and there are six callers — the grid, the embed, the live
 * sheet, the copy-to-clipboard path, the public share page and the export. Adding decimals as a
 * fourth argument would have been five chances to forget it, and forgetting it is silent: the cell
 * renders with the default places and the person's choice is simply ignored on that one surface.
 */
export function formatCell(v: CellValue, fmt: CellFmtish | undefined): string {
  return formatValue(v, fmt?.numFmt as NumFmtId | undefined, fmt?.currency, fmt?.decimals)
}

/** The three fields formatting reads — narrower than `CellFormat`, so this module stays leaf-ish. */
export type CellFmtish = { numFmt?: string; currency?: string; decimals?: number }

/** Map our preset to an Excel number-format code for export. */
export function toExcelNumFmt(
  fmt: NumFmtId | undefined,
  currency: string = DEFAULT_CURRENCY,
  decimals?: number,
): string | undefined {
  /**
   * Excel spells the places out in the code itself — `0.000`, not a separate setting — so the
   * cell's choice has to be written INTO the string or the exported file quietly rounds to whatever
   * was hard-coded here. The screen and the file would then disagree about the same number.
   */
  const places = (d: number | undefined, fallback: number) => {
    const n = d ?? fallback
    return n > 0 ? `.${'0'.repeat(n)}` : ''
  }
  switch (fmt) {
    case 'number':
      return `0${places(decimals, 2)}`
    case 'thousands':
      return `#,##0${places(decimals, 0)}`
    case 'percent':
      return `0${places(decimals, 0)}%`
    case 'currency':
      return `#,##0${places(decimals, 2)}" ${currency || DEFAULT_CURRENCY}"`
    case 'date':
      // Excel's own code, so a date exported from here opens as a date there rather than a number.
      return 'yyyy-mm-dd'
    default:
      return undefined
  }
}
