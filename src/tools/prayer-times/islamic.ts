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

/** Localised Hijri string, e.g. "12 Ramadan 1447 AH" / "١٢ رمضان ١٤٤٧ هـ". */
export function formatHijri(date: Date, locale: 'en' | 'ar'): string {
  const cal = locale === 'ar' ? 'ar-SA-u-ca-islamic-umalqura' : 'en-u-ca-islamic-umalqura'
  return new Intl.DateTimeFormat(cal, {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  }).format(date)
}

export const HIJRI_MONTHS = {
  en: ['Muharram', 'Safar', 'Rabiʿ al-Awwal', 'Rabiʿ al-Thani', 'Jumada al-Awwal',
    'Jumada al-Thani', 'Rajab', 'Shaʿban', 'Ramadan', 'Shawwal', 'Dhu al-Qaʿda', 'Dhu al-Hijja'],
  ar: ['محرم', 'صفر', 'ربيع الأول', 'ربيع الآخر', 'جمادى الأولى', 'جمادى الآخرة',
    'رجب', 'شعبان', 'رمضان', 'شوال', 'ذو القعدة', 'ذو الحجة'],
}

export type IslamicEventKey =
  | 'ramadan' | 'eidFitr' | 'eidAdha' | 'arafah' | 'newYear' | 'ashura'

const EVENTS: { key: IslamicEventKey; m: number; d: number }[] = [
  { key: 'newYear', m: 1, d: 1 },
  { key: 'ashura', m: 1, d: 10 },
  { key: 'ramadan', m: 9, d: 1 },
  { key: 'eidFitr', m: 10, d: 1 },
  { key: 'arafah', m: 12, d: 9 },
  { key: 'eidAdha', m: 12, d: 10 },
]

export interface UpcomingEvent { key: IslamicEventKey; date: Date }

/** The next occurrence (>= today) of each Islamic event, sorted by date. */
export function upcomingEvents(from: Date): UpcomingEvent[] {
  const today = new Date(from.getFullYear(), from.getMonth(), from.getDate())
  const hy = gregorianToHijri(today).y
  const out: UpcomingEvent[] = []
  for (const ev of EVENTS) {
    for (const year of [hy, hy + 1]) {
      const date = hijriToGregorian(year, ev.m, ev.d)
      if (date >= today) { out.push({ key: ev.key, date }); break }
    }
  }
  return out.sort((a, b) => a.date.getTime() - b.date.getTime())
}
