// A weekly timetable that reads the right way round.
//
// Found by a seasonal sweep in the week the school year starts here. The
// category is crowded with printable templates and **the Arabic half of it is
// essentially unserved**: the one Arabic result was a fixed image, and the
// generic makers get two things wrong that matter here and nowhere else.
//
// 1. **The week starts on SUNDAY.** Friday and Saturday are the weekend, so a
//    Monday-first grid puts the weekend in the middle of the sheet. This repo
//    already measured that for `timesheet` and it is the same fact.
// 2. **Right-to-left means the COLUMNS reverse, not just the labels.** A tool
//    that "supports Arabic" by translating the day names and leaving the grid
//    alone prints the days backwards — Sunday on the far left, where an Arabic
//    reader's eye finishes rather than starts. Reversing the column order is
//    the whole of the fix and almost nobody does it.

export type DayKey = 'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat'

/** Sunday first, always. The weekend is at the END of the week here. */
export const WEEK: DayKey[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']

/** The school and working week: Sunday to Thursday. */
export const SCHOOL_WEEK: DayKey[] = ['sun', 'mon', 'tue', 'wed', 'thu']

export const DAY_LABEL: Record<DayKey, { en: string; ar: string }> = {
  sun: { en: 'Sunday', ar: 'الأحد' },
  mon: { en: 'Monday', ar: 'الاثنين' },
  tue: { en: 'Tuesday', ar: 'الثلاثاء' },
  wed: { en: 'Wednesday', ar: 'الأربعاء' },
  thu: { en: 'Thursday', ar: 'الخميس' },
  fri: { en: 'Friday', ar: 'الجمعة' },
  sat: { en: 'Saturday', ar: 'السبت' },
}

/**
 * The days in the order the COLUMNS should appear.
 *
 * Sunday is always first in reading order; in an RTL sheet that means the
 * rightmost column. Reversing here rather than relying on CSS `direction`
 * keeps the printed PDF and the on-screen grid in agreement — the canvas the
 * PDF is drawn on has no `direction` of its own to inherit.
 */
export const columnOrder = (days: DayKey[], rtl: boolean): DayKey[] =>
  rtl ? [...days].reverse() : days

export interface Slot {
  /** Label shown in the row header, e.g. a time or a period number. */
  label: string
  /** Cell text per day. */
  cells: Partial<Record<DayKey, string>>
}

export interface Timetable {
  title: string
  days: DayKey[]
  slots: Slot[]
}

/** A blank timetable: eight periods across the school week. */
export function emptyTimetable(locale: 'en' | 'ar'): Timetable {
  return {
    title: locale === 'ar' ? 'الجدول الأسبوعي' : 'Weekly timetable',
    days: [...SCHOOL_WEEK],
    slots: Array.from({ length: 8 }, (_, i) => ({
      label: locale === 'ar' ? `الحصة ${i + 1}` : `Period ${i + 1}`,
      cells: {},
    })),
  }
}

/** Whether anything has been typed into the grid. */
export const isEmpty = (t: Timetable) =>
  t.slots.every((s) => Object.values(s.cells).every((v) => !v || !v.trim()))
