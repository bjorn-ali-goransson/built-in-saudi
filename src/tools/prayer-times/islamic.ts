// Umm al-Qura Hijri date helpers, built on the browser's native
// `islamic-umalqura` calendar (Intl) — no date library needed.

export interface Hijri { y: number; m: number; d: number }

const NUM = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura-nu-latn', {
  day: 'numeric', month: 'numeric', year: 'numeric',
})

/** Gregorian Date → Umm al-Qura Hijri {y,m,d}. */
export function gregorianToHijri(date: Date): Hijri {
  const parts = NUM.formatToParts(date)
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value)
  return { y: get('year'), m: get('month'), d: get('day') }
}

function cmp(a: Hijri, b: Hijri): number {
  return a.y !== b.y ? a.y - b.y : a.m !== b.m ? a.m - b.m : a.d - b.d
}

/**
 * Umm al-Qura Hijri → Gregorian Date. Seeds from the mean-year estimate, then
 * corrects day-by-day against the native calendar (converges in a few steps).
 */
export function hijriToGregorian(y: number, m: number, d: number): Date {
  const approxDays = Math.round((y - 1) * 354.36707 + (m - 1) * 29.5 + (d - 1))
  let date = new Date(Date.UTC(622, 6, 19) + approxDays * 86400000)
  for (let i = 0; i < 120; i++) {
    const c = cmp(gregorianToHijri(date), { y, m, d })
    if (c === 0) break
    date = new Date(date.getTime() + (c < 0 ? 1 : -1) * 86400000)
  }
  // Normalise to local midnight.
  return new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
}

const WEEKDAY_FMT: Record<'en' | 'ar', Intl.DateTimeFormat> = {
  en: new Intl.DateTimeFormat('en-US', { weekday: 'long' }),
  ar: new Intl.DateTimeFormat('ar-SA', { weekday: 'long' }),
}
const AR_DIGITS = new Intl.NumberFormat('ar-SA-u-nu-arab', { useGrouping: false })
const localizeNum = (n: number, locale: 'en' | 'ar') => (locale === 'ar' ? AR_DIGITS.format(n) : String(n))

/**
 * Localised Hijri string, e.g. "Friday, Ramadan 12, 1447 AH" / "الجمعة، ١٢ رمضان
 * ١٤٤٧ هـ". Built from our own month table + weekday rather than Intl's Islamic
 * `month: 'long'`/era — some browsers (notably several Android WebViews) have
 * incomplete `islamic-umalqura` data and render Gregorian month names + a "BC"
 * era, which is how "Muharram 18, 1448 AH" turned into "January 18, 1448 BC".
 */
export function formatHijri(date: Date, locale: 'en' | 'ar'): string {
  const h = gregorianToHijri(date)
  const weekday = WEEKDAY_FMT[locale].format(date)
  const month = HIJRI_MONTHS[locale][h.m - 1]
  const d = localizeNum(h.d, locale)
  const y = localizeNum(h.y, locale)
  return locale === 'ar'
    ? `${weekday}، ${d} ${month} ${y} هـ`
    : `${weekday}, ${month} ${d}, ${y} AH`
}

/** Number of days (29 or 30) in an Umm al-Qura Hijri month. */
export function daysInHijriMonth(y: number, m: number): number {
  const start = hijriToGregorian(y, m, 1)
  const next = hijriToGregorian(m === 12 ? y + 1 : y, m === 12 ? 1 : m + 1, 1)
  return Math.round((next.getTime() - start.getTime()) / 86400000)
}

export const HIJRI_MONTHS = {
  en: ['Muharram', 'Safar', 'Rabiʿ al-Awwal', 'Rabiʿ al-Thani', 'Jumada al-Awwal',
    'Jumada al-Thani', 'Rajab', 'Shaʿban', 'Ramadan', 'Shawwal', 'Dhu al-Qaʿda', 'Dhu al-Hijja'],
  ar: ['محرم', 'صفر', 'ربيع الأول', 'ربيع الآخر', 'جمادى الأولى', 'جمادى الآخرة',
    'رجب', 'شعبان', 'رمضان', 'شوال', 'ذو القعدة', 'ذو الحجة'],
}

export type IslamicEventKey =
  | 'ramadan' | 'eidFitr' | 'eidAdha' | 'arafah' | 'newYear' | 'ashura'

/** The six Islamic dates the site marks. ONE list, for all three callers. */
export const ISLAMIC_EVENTS: { key: IslamicEventKey; m: number; d: number }[] = [
  { key: 'newYear', m: 1, d: 1 },
  { key: 'ashura', m: 1, d: 10 },
  { key: 'ramadan', m: 9, d: 1 },
  { key: 'eidFitr', m: 10, d: 1 },
  { key: 'arafah', m: 12, d: 9 },
  { key: 'eidAdha', m: 12, d: 10 },
]

/**
 * Hijri month-day (`"9-1"`) to the event that falls on it.
 *
 * Derived from EVENTS rather than written out a second time: `islamic-calendar`
 * kept its own identical six-entry copy, which is two places for one fact and
 * exactly how a seventh event ends up in one of them. Found by a code sweep.
 */
export const HOLIDAY_BY_HIJRI: Record<string, IslamicEventKey> =
  Object.fromEntries(ISLAMIC_EVENTS.map((ev) => [`${ev.m}-${ev.d}`, ev.key]))

