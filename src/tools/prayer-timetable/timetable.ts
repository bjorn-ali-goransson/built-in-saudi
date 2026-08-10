import { CalculationMethod, Coordinates, PrayerTimes } from 'adhan'
import { A4, newPage, pagesToPdf, type Page } from '../../lib/printPdf'
import { formatHijri } from '../prayer-times/islamic'

// A month of prayer times on one sheet of paper — for a fridge, a noticeboard,
// or a mosque door.
//
// Computed with the same library and the same method as the Prayer Times app
// (Umm al-Qura, as used across the Kingdom), because two tools on one site
// disagreeing about Maghrib would be worse than either of them not existing.
//
// The one thing a printed timetable must not do is drift: it is computed for a
// specific place and printed with that place's name on it, so a sheet found on a
// wall six months later can still be checked against where it came from.

export const PRAYER_KEYS = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'] as const
export type PrayerKey = typeof PRAYER_KEYS[number]

export interface Row {
  date: Date
  hijri: string
  times: Record<PrayerKey, Date>
}

export interface TimetableOptions {
  lat: number
  lng: number
  tz: string
  place: string
  /** First day of the month to print. */
  year: number
  month: number
  includeSunrise: boolean
  hour12: boolean
  hijriColumn: boolean
}

export function monthRows(o: TimetableOptions): Row[] {
  const coords = new Coordinates(o.lat, o.lng)
  const params = CalculationMethod.UmmAlQura()
  const out: Row[] = []
  const days = new Date(o.year, o.month + 1, 0).getDate()
  for (let d = 1; d <= days; d++) {
    const date = new Date(o.year, o.month, d, 12, 0, 0)
    const pt = new PrayerTimes(coords, date, params)
    out.push({
      date,
      hijri: '',
      times: {
        fajr: pt.fajr, sunrise: pt.sunrise, dhuhr: pt.dhuhr,
        asr: pt.asr, maghrib: pt.maghrib, isha: pt.isha,
      },
    })
  }
  return out
}

/**
 * Format in the TIMETABLE'S timezone, not the reader's.
 *
 * A sheet computed for Riyadh and printed while the laptop is set to London
 * would otherwise show London clock times against Riyadh prayers — the same
 * class of bug that made the sun-times tool wrong until it was pinned.
 */
export function fmtTime(d: Date, tz: string, hour12: boolean): string {
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit', minute: '2-digit', hour12, timeZone: tz,
  }).format(d)
}

export const columnsFor = (o: TimetableOptions): PrayerKey[] =>
  PRAYER_KEYS.filter((k) => k !== 'sunrise' || o.includeSunrise)

const INK = '#1a1a1a'
const FAINT = '#8a8a8a'

export async function buildTimetablePdf(
  rows: Row[],
  o: TimetableOptions,
  locale: 'en' | 'ar',
  labels: { title: string; day: string; date: string; hijri: string; names: Record<PrayerKey, string>; note: string; method: string },
): Promise<Blob> {
  const page: Page = newPage(A4)
  const { ctx, px } = page
  const rtl = locale === 'ar'
  const M = 12
  const cols = columnsFor(o)

  ctx.direction = rtl ? 'rtl' : 'ltr'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  ctx.fillStyle = INK
  ctx.font = `600 ${Math.round(6.5 * px)}px "IBM Plex Sans Arabic", "Hanken Grotesk", sans-serif`
  ctx.fillText(labels.title, (page.wMm / 2) * px, 10 * px)
  ctx.fillStyle = FAINT
  ctx.font = `400 ${Math.round(3.4 * px)}px "IBM Plex Sans Arabic", "Hanken Grotesk", sans-serif`
  ctx.fillText(o.place, (page.wMm / 2) * px, 19 * px)

  const top = 28
  const dayW = 10
  const hijriW = o.hijriColumn ? 26 : 0
  const dateW = 22
  const gridW = page.wMm - M * 2 - dayW - dateW - hijriW
  const colW = gridW / cols.length
  const rowH = Math.min(7.4, (page.hMm - top - 22) / (rows.length + 1))

  // Header.
  const xStart = M + dayW + dateW + hijriW
  ctx.font = `600 ${Math.round(3.1 * px)}px "IBM Plex Sans Arabic", "Hanken Grotesk", sans-serif`
  ctx.fillStyle = INK
  ctx.fillText(labels.date, (M + dayW + dateW / 2) * px, (top + 2) * px, dateW * px)
  if (o.hijriColumn) ctx.fillText(labels.hijri, (M + dayW + dateW + hijriW / 2) * px, (top + 2) * px, hijriW * px)
  cols.forEach((k, i) => ctx.fillText(labels.names[k], (xStart + i * colW + colW / 2) * px, (top + 2) * px, colW * px))

  ctx.strokeStyle = '#999999'
  ctx.lineWidth = Math.max(1, 0.3 * px)
  ctx.beginPath()
  ctx.moveTo(M * px, (top + 7) * px)
  ctx.lineTo((page.wMm - M) * px, (top + 7) * px)
  ctx.stroke()

  rows.forEach((r, i) => {
    const y = top + 8 + i * rowH
    const friday = r.date.getDay() === 5
    if (friday) {
      // Friday is the congregational day; shading it makes the sheet scannable
      // at a glance from across a room.
      ctx.fillStyle = '#eef3ef'
      ctx.fillRect(M * px, y * px, (page.wMm - M * 2) * px, rowH * px)
    }
    ctx.fillStyle = friday ? '#2f5c45' : INK
    ctx.font = `400 ${Math.round(3.1 * px)}px "IBM Plex Sans Arabic", "Hanken Grotesk", sans-serif`
    ctx.textAlign = 'center'
    ctx.fillText(String(r.date.getDate()), (M + dayW / 2) * px, (y + 1.6) * px)
    ctx.fillText(
      r.date.toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en-GB', { weekday: 'short' }),
      (M + dayW + dateW / 2) * px, (y + 1.6) * px, dateW * px,
    )
    if (o.hijriColumn) ctx.fillText(r.hijri, (M + dayW + dateW + hijriW / 2) * px, (y + 1.6) * px, hijriW * px)
    cols.forEach((k, c) => {
      ctx.fillText(fmtTime(r.times[k], o.tz, o.hour12), (xStart + c * colW + colW / 2) * px, (y + 1.6) * px, colW * px)
    })
    ctx.strokeStyle = '#dddddd'
    ctx.beginPath()
    ctx.moveTo(M * px, (y + rowH) * px)
    ctx.lineTo((page.wMm - M) * px, (y + rowH) * px)
    ctx.stroke()
  })

  ctx.fillStyle = FAINT
  ctx.font = `400 ${Math.round(2.8 * px)}px "IBM Plex Sans Arabic", "Hanken Grotesk", sans-serif`
  ctx.textAlign = 'center'
  ctx.fillText(labels.method, (page.wMm / 2) * px, (page.hMm - 16) * px)
  ctx.fillText(labels.note, (page.wMm / 2) * px, (page.hMm - 11) * px)

  return pagesToPdf([page])
}

/** Hijri label for each row, filled in against the tool's own converter. */
export function withHijri(rows: Row[], locale: 'en' | 'ar'): Row[] {
  return rows.map((r) => ({ ...r, hijri: formatHijri(r.date, locale) }))
}
