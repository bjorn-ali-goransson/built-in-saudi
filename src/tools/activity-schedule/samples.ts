// Ready-made schedules, reachable by NAME rather than by payload.
//
// `#s=…` carries the whole sheet, which is what makes a shared link work with
// no server and no account — and it is also 680 characters of base64 that
// nobody wants to paste into a message. A sheet that ships WITH the app needs
// none of that: `#t=tamhidi` is sixty characters and never expires, because
// the data is in the bundle rather than in the URL.
//
// So the two forms answer different questions. `#s=` is for a sheet somebody
// made; `#t=` is for one this site already has.
//
// These two are real nursery timetables, typed from the charts they were
// modelled on. Nothing in them is corrected — they are internally consistent,
// unlike the first chart this tool was built from, which had `9:30 – 9:30` and
// `10:00 – 19:30`. The one judgement call is `انصراف`, written on both sheets
// with a single time and no end: on an axis it takes the quarter hour it
// plainly occupies rather than being dropped.

import { SCHOOL_WEEK, newId, type DayKey, type Item, type Schedule } from './schedule'

const t = (h: number, m: number) => h * 60 + m

/** Written out, because an activity's icon is part of what the sheet says. */
const ICONS: Record<string, string> = {
  'طابور وأذكار الصباح': '🔔',
  'تبيان': '📘',
  'قرآن': '📖',
  'إنجليزي': '🔤',
  'رياضيات': '🔢',
  'وجبة': '🍎',
  'أركان': '🧱',
  'لعب حر': '🎲',
  'انصراف': '🏠',
  'مراجعة تبيان': '📚',
  'مراجعة قرآن': '📚',
  'مراجعة إنجليزي': '📚',
  'مراجعة رياضيات': '📚',
}

/** `[name, startHour, startMinute, endHour, endMinute]`. */
type Row = [string, number, number, number, number]

const morning: Row = ['طابور وأذكار الصباح', 7, 0, 7, 30]
const play: Row = ['لعب حر', 10, 45, 11, 0]
const out: Row = ['انصراف', 11, 0, 11, 15]

function sheet(
  group: string, perDay: Record<DayKey, Row[]>,
): Omit<Schedule, 'id' | 'updated'> {
  const items: Partial<Record<DayKey, Item[]>> = {}
  for (const day of SCHOOL_WEEK) {
    items[day] = perDay[day].map((r, i) => ({
      id: `${day}${i}`,
      name: r[0],
      icon: ICONS[r[0]] ?? '',
      start: t(r[1], r[2]),
      end: t(r[3], r[4]),
    }))
  }
  return {
    title: 'الجدول الأسبوعي',
    note: 'أيام الدراسة: الأحد إلى الخميس',
    group,
    days: [...SCHOOL_WEEK],
    from: t(7, 0),
    to: t(11, 15),
    items,
    art: true,
  }
}

const meal9: Row = ['وجبة', 9, 0, 9, 30]
const corners10: Row = ['أركان', 10, 0, 10, 45]

const tamhidi = sheet('تمهيدي', {
  sun: [morning, ['تبيان', 7, 30, 8, 0], ['قرآن', 8, 0, 8, 30], ['إنجليزي', 8, 30, 9, 0], meal9, ['رياضيات', 9, 30, 10, 0], corners10, play, out],
  mon: [morning, ['قرآن', 7, 30, 8, 0], ['رياضيات', 8, 0, 8, 30], ['تبيان', 8, 30, 9, 0], meal9, ['إنجليزي', 9, 30, 10, 0], corners10, play, out],
  tue: [morning, ['تبيان', 7, 30, 8, 0], ['قرآن', 8, 0, 8, 30], ['إنجليزي', 8, 30, 9, 0], meal9, ['رياضيات', 9, 30, 10, 0], corners10, play, out],
  wed: [morning, ['قرآن', 7, 30, 8, 0], ['رياضيات', 8, 0, 8, 30], ['تبيان', 8, 30, 9, 0], meal9, ['إنجليزي', 9, 30, 10, 0], corners10, play, out],
  thu: [morning, ['مراجعة تبيان', 7, 30, 8, 0], ['مراجعة إنجليزي', 8, 0, 8, 30], ['مراجعة قرآن', 8, 30, 9, 0], meal9, ['مراجعة رياضيات', 9, 30, 10, 0], corners10, play, out],
} as Record<DayKey, Row[]>)

const meal830: Row = ['وجبة', 8, 30, 9, 0]
const corners9: Row = ['أركان', 9, 0, 9, 45]

const kg2 = sheet('KG2 - براعم 2', {
  sun: [morning, ['قرآن', 7, 30, 8, 0], ['رياضيات', 8, 0, 8, 30], meal830, corners9, ['تبيان', 9, 45, 10, 15], ['إنجليزي', 10, 15, 10, 45], play, out],
  mon: [morning, ['إنجليزي', 7, 30, 8, 0], ['تبيان', 8, 0, 8, 30], meal830, corners9, ['قرآن', 9, 45, 10, 15], ['رياضيات', 10, 15, 10, 45], play, out],
  tue: [morning, ['قرآن', 7, 30, 8, 0], ['رياضيات', 8, 0, 8, 30], meal830, corners9, ['تبيان', 9, 45, 10, 15], ['إنجليزي', 10, 15, 10, 45], play, out],
  wed: [morning, ['إنجليزي', 7, 30, 8, 0], ['تبيان', 8, 0, 8, 30], meal830, corners9, ['قرآن', 9, 45, 10, 15], ['رياضيات', 10, 15, 10, 45], play, out],
  thu: [morning, ['مراجعة قرآن', 7, 30, 8, 0], ['مراجعة رياضيات', 8, 0, 8, 30], meal830, corners9, ['مراجعة تبيان', 9, 45, 10, 15], ['مراجعة إنجليزي', 10, 15, 10, 45], play, out],
} as Record<DayKey, Row[]>)

export interface Sample {
  /** The slug in `#t=`. Short, and permanent once published. */
  id: string
  label: { en: string; ar: string }
  make: () => Omit<Schedule, 'id' | 'updated'>
}

export const SAMPLES: Sample[] = [
  { id: 'tamhidi', label: { en: 'Preparatory (تمهيدي)', ar: 'تمهيدي' }, make: () => tamhidi },
  { id: 'kg2', label: { en: 'KG2', ar: 'KG2 - براعم 2' }, make: () => kg2 },
]

/**
 * A named sheet, as a fresh schedule.
 *
 * New ids every time: opening a starter twice must give two sheets, not two
 * handles on one, or saving the second overwrites the first.
 */
export function sampleSchedule(id: string): Schedule | null {
  const found = SAMPLES.find((s) => s.id === id)
  if (!found) return null
  const base = found.make()
  const items: Partial<Record<DayKey, Item[]>> = {}
  for (const day of base.days) {
    items[day] = (base.items[day] ?? []).map((it) => ({ ...it, id: newId() }))
  }
  return { ...base, items, id: newId(), updated: Date.now() }
}
