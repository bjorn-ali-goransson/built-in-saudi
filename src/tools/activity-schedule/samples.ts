// A starter sheet, so an empty axis is not the first thing anybody meets.
//
// It is FICTIONAL, and deliberately so. A real class timetable is not site
// content: it belongs to the school that wrote it and it changes through the
// term, so shipping one would publish somebody's week and then slowly become
// wrong. A starter exists to show the shape of a filled sheet — the half-hour
// rhythm, an activity that runs longer than the rest, and a day that differs
// from the other four — and a made-up week does that just as well.
//
// This is the one case `#t=` is for: a sheet that SHIPS with the app, named in
// sixty characters. A sheet somebody MADE travels in `#s=`, which carries the
// whole thing and needs no server, no account and nothing stored — that is the
// shareable form, and the one the printed QR points at.

import { SCHOOL_WEEK, newId, type DayKey, type Item, type Schedule } from './schedule'

const t = (h: number, m: number) => h * 60 + m

/** `[nameEn, nameAr, icon, startHour, startMin, endHour, endMin]`. */
type Row = [string, string, string, number, number, number, number]

const assembly: Row = ['Morning assembly', 'طابور الصباح', '🔔', 7, 0, 7, 30]
const snack: Row = ['Snack', 'وجبة', '🍎', 9, 0, 9, 30]
const centres: Row = ['Learning centres', 'أركان', '🧱', 9, 30, 10, 15]
const play: Row = ['Free play', 'لعب حر', '⚽', 10, 15, 10, 45]
const home: Row = ['Home time', 'انصراف', '🏠', 10, 45, 11, 0]

const quran: Row = ['Quran', 'قرآن', '📖', 7, 30, 8, 0]
const maths: Row = ['Maths', 'رياضيات', '🔢', 8, 0, 8, 30]
const english: Row = ['English', 'إنجليزي', '🔤', 8, 30, 9, 0]
const reading: Row = ['Reading', 'قراءة', '📘', 7, 30, 8, 0]
const art: Row = ['Art', 'فن', '🎨', 8, 0, 9, 0]
const story: Row = ['Story', 'قصة', '🧸', 8, 30, 9, 0]
const review: Row = ['Review', 'مراجعة', '📚', 7, 30, 8, 30]
const outdoor: Row = ['Outdoor play', 'نشاط خارجي', '🌳', 8, 30, 9, 0]

const WEEK_PLAN: Record<DayKey, Row[]> = {
  sun: [assembly, quran, maths, english, snack, centres, play, home],
  mon: [assembly, reading, maths, story, snack, centres, play, home],
  tue: [assembly, quran, maths, english, snack, centres, play, home],
  wed: [assembly, reading, art, snack, centres, play, home],
  // Thursday is shorter and differs, which is the thing the axis exists for.
  thu: [assembly, review, outdoor, snack, centres, play, home],
} as Record<DayKey, Row[]>

function starter(locale: 'en' | 'ar'): Omit<Schedule, 'id' | 'updated'> {
  const items: Partial<Record<DayKey, Item[]>> = {}
  for (const day of SCHOOL_WEEK) {
    items[day] = WEEK_PLAN[day].map((r, i) => ({
      id: `${day}${i}`,
      name: locale === 'ar' ? r[1] : r[0],
      icon: r[2],
      start: t(r[3], r[4]),
      end: t(r[5], r[6]),
    }))
  }
  return {
    title: locale === 'ar' ? 'الجدول الأسبوعي' : 'Weekly schedule',
    note: locale === 'ar' ? 'أيام الدراسة: الأحد إلى الخميس' : 'School days: Sunday to Thursday',
    group: locale === 'ar' ? 'فصل تجريبي' : 'Sample class',
    days: [...SCHOOL_WEEK],
    from: t(7, 0),
    to: t(11, 15),
    items,
    teachers: {},
    art: true,
  }
}

export interface Sample {
  /** The slug in `#t=`. Short, and permanent once published. */
  id: string
  label: { en: string; ar: string }
  make: (locale: 'en' | 'ar') => Omit<Schedule, 'id' | 'updated'>
}

export const SAMPLES: Sample[] = [
  {
    id: 'sample',
    label: { en: 'A sample week', ar: 'أسبوع نموذجي' },
    make: starter,
  },
]

/**
 * A named sheet, as a fresh schedule.
 *
 * New ids every time: opening a starter twice must give two sheets, not two
 * handles on one, or saving the second overwrites the first.
 */
export function sampleSchedule(id: string, locale: 'en' | 'ar'): Schedule | null {
  const found = SAMPLES.find((s) => s.id === id)
  if (!found) return null
  const base = found.make(locale)
  const items: Partial<Record<DayKey, Item[]>> = {}
  for (const day of base.days) {
    items[day] = (base.items[day] ?? []).map((it) => ({ ...it, id: newId() }))
  }
  return { ...base, items, id: newId(), updated: Date.now() }
}
