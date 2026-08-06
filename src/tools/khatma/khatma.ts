import { A4, newPage, pagesToPdf, type Page } from '../../lib/printPdf'
import { formatHijri, gregorianToHijri, hijriToGregorian } from '../prayer-times/islamic'

// A reading plan for finishing the Qur'an — a khatma — over a chosen stretch of
// days.
//
// Deliberately built on ONE piece of reference data: the page a juz begins on in
// the Madani mushaf. That is a published, checkable fact about a specific
// printing, and the tool says which printing it is, because a plan quoting page
// numbers from an edition you do not own is worse than no plan.
//
// Everything else is arithmetic over those numbers. There is no surah/ayah
// division here on purpose: getting that right needs a verified table of 114
// starting pages, and half-remembered reference data has no place in a tool
// people will use for worship.

/** Total pages in the standard Madani (King Fahd Complex) mushaf. */
export const TOTAL_PAGES = 604

/**
 * The page each juz starts on in that mushaf. Juz 1 opens the book; the 30th
 * runs to the end.
 */
export const JUZ_START_PAGE = [
  1, 22, 42, 62, 82, 102, 121, 142, 162, 182,
  201, 222, 242, 262, 282, 302, 322, 342, 362, 382,
  402, 422, 442, 462, 482, 502, 522, 542, 562, 582,
]

export type Unit = 'pages' | 'juz'

export interface PlanOptions {
  start: Date
  days: number
  unit: Unit
  /** Skip nothing, or leave Fridays free. */
  restFridays: boolean
}

export interface PlanDay {
  index: number
  date: Date
  fromPage: number
  toPage: number
  /** Juz numbers this day touches, for a plan read by juz. */
  juz: number[]
  pages: number
}

export const juzOfPage = (page: number): number => {
  let j = 1
  for (let i = 0; i < JUZ_START_PAGE.length; i++) if (page >= JUZ_START_PAGE[i]) j = i + 1
  return j
}

export function buildPlan(o: PlanOptions): PlanDay[] {
  const days = Math.max(1, Math.min(400, Math.floor(o.days)))

  // The reading days, skipping Fridays if asked — the plan has to land its last
  // page on the last READING day, not the last calendar day.
  const dates: Date[] = []
  const cursor = new Date(o.start)
  cursor.setHours(12, 0, 0, 0)
  while (dates.length < days) {
    if (!(o.restFridays && cursor.getDay() === 5)) dates.push(new Date(cursor))
    cursor.setDate(cursor.getDate() + 1)
  }

  const out: PlanDay[] = []
  if (o.unit === 'juz') {
    // Whole juz per day where possible: the boundaries are what people actually
    // recite to, so a plan that splits one mid-way is less useful than one that
    // gives some days two.
    const per = 30 / dates.length
    let cursorJuz = 0
    dates.forEach((date, i) => {
      const nextJuz = Math.min(30, Math.round((i + 1) * per))
      const fromJ = Math.floor(cursorJuz) + 1
      const toJ = Math.max(fromJ, nextJuz)
      const fromPage = JUZ_START_PAGE[fromJ - 1]
      const toPage = toJ >= 30 ? TOTAL_PAGES : JUZ_START_PAGE[toJ] - 1
      out.push({
        index: i + 1, date, fromPage, toPage,
        juz: Array.from({ length: toJ - fromJ + 1 }, (_, k) => fromJ + k),
        pages: toPage - fromPage + 1,
      })
      cursorJuz = toJ
    })
    return out.filter((d) => d.toPage >= d.fromPage)
  }

  // Even pages per day. The remainder is spread over the first days rather than
  // dumped on the last one, which is how you end up with a 40-page final day.
  const base = Math.floor(TOTAL_PAGES / dates.length)
  const extra = TOTAL_PAGES % dates.length
  let page = 1
  dates.forEach((date, i) => {
    const n = base + (i < extra ? 1 : 0)
    const fromPage = page
    const toPage = Math.min(TOTAL_PAGES, page + n - 1)
    out.push({
      index: i + 1, date, fromPage, toPage,
      juz: [...new Set([juzOfPage(fromPage), juzOfPage(toPage)])],
      pages: toPage - fromPage + 1,
    })
    page = toPage + 1
  })
  return out.filter((d) => d.fromPage <= TOTAL_PAGES && d.pages > 0)
}

/** The Gregorian date Ramadan 1 falls on for the Hijri year covering `from`. */
export function nextRamadanStart(from: Date): Date {
  const h = gregorianToHijri(from)
  let y = h.y
  let d = hijriToGregorian(y, 9, 1)
  if (d.getTime() < from.getTime()) d = hijriToGregorian(++y, 9, 1)
  return d
}

const INK = '#1a1a1a'
const FAINT = '#8a8a8a'

export async function buildPlanPdf(
  plan: PlanDay[],
  locale: 'en' | 'ar',
  labels: { title: string; day: string; date: string; pages: string; juz: string; done: string; note: string },
): Promise<Blob> {
  const pages: Page[] = []
  const perPage = 26
  const rtl = locale === 'ar'

  for (let i = 0; i < plan.length; i += perPage) {
    const page = newPage(A4)
    const { ctx, px } = page
    const slice = plan.slice(i, i + perPage)
    const M = 18
    const right = page.wMm - M

    ctx.direction = rtl ? 'rtl' : 'ltr'
    ctx.textAlign = rtl ? 'right' : 'left'
    ctx.textBaseline = 'top'
    const x0 = rtl ? right * px : M * px

    ctx.fillStyle = INK
    ctx.font = `600 ${Math.round(7 * px)}px "IBM Plex Sans Arabic", "Hanken Grotesk", sans-serif`
    ctx.fillText(labels.title, x0, 15 * px)

    // Column layout, mirrored for Arabic so the tick box stays at the far end.
    const cols = rtl
      ? [right - 10, right - 30, right - 74, right - 110, M + 6]
      : [M, M + 20, M + 64, M + 100, right - 8]
    const heads = [labels.day, labels.date, labels.pages, labels.juz, labels.done]

    ctx.font = `600 ${Math.round(3.2 * px)}px "IBM Plex Sans Arabic", "Hanken Grotesk", sans-serif`
    ctx.fillStyle = FAINT
    heads.forEach((h, k) => ctx.fillText(h, cols[k] * px, 30 * px))
    ctx.strokeStyle = '#cccccc'
    ctx.lineWidth = Math.max(1, 0.3 * px)
    ctx.beginPath(); ctx.moveTo(M * px, 35 * px); ctx.lineTo(right * px, 35 * px); ctx.stroke()

    slice.forEach((d, k) => {
      const y = (40 + k * 8.6) * px
      ctx.fillStyle = INK
      ctx.font = `400 ${Math.round(3.4 * px)}px "IBM Plex Sans Arabic", "Hanken Grotesk", sans-serif`
      const cells = [
        String(d.index),
        `${d.date.toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en-GB', { day: '2-digit', month: 'short' })} · ${formatHijri(d.date, locale)}`,
        `${d.fromPage} – ${d.toPage}  (${d.pages})`,
        d.juz.length > 1 ? `${d.juz[0]}–${d.juz[d.juz.length - 1]}` : String(d.juz[0]),
      ]
      cells.forEach((c, ci) => ctx.fillText(c, cols[ci] * px, y))
      // The tick box — the reason a paper plan beats an app for most people.
      ctx.strokeStyle = '#999999'
      ctx.strokeRect(cols[4] * px, y - 0.5 * px, 4 * px, 4 * px)
    })

    ctx.fillStyle = FAINT
    ctx.font = `400 ${Math.round(2.9 * px)}px "IBM Plex Sans Arabic", "Hanken Grotesk", sans-serif`
    ctx.fillText(labels.note, x0, (page.hMm - 16) * px)
    pages.push(page)
  }

  return pagesToPdf(pages)
}
