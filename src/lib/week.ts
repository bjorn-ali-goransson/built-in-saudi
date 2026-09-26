// The week, as it is read here.
//
// Extracted at the second GRID that renders one (`timetable`, then
// `activity-schedule`), because the two must not be able to disagree about
// either of the facts below — a copy is precisely how they would.
//
// `tools/timesheet/TimesheetTool.tsx` carries a third copy of the day keys and
// the Arabic labels. It is left alone on purpose: it renders a list of rows
// rather than a week GRID, so `columnOrder` — the part with the reason
// attached — does not apply to it. Recorded here rather than forgotten.

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
 * The days in the order the COLUMNS should be PAINTED, left to right, by a
 * renderer that has no reading direction of its own.
 *
 * Sunday is always first in reading order, so on an Arabic sheet it is the
 * RIGHTMOST column — which means a painter walking x from 0 upwards has to be
 * handed the days reversed. That is what this is for: the canvas the PDF is
 * drawn on has no `direction` to inherit, so without it the printed week comes
 * out backwards however right it looked on screen.
 *
 * **HTML must NOT use this.** A table or a grid inside `dir="rtl"` already
 * lays its columns out right-to-left, so reversing the array as well reverses
 * twice and puts Sunday back on the left — where an Arabic reader finishes
 * rather than starts, which is the exact defect this function exists to
 * prevent. Both grids on this site had that bug, and both specs missed it by
 * asserting the DOM order, which is the half that was right. The order that
 * matters is the one on screen, so measure positions.
 */
export const columnOrder = (days: DayKey[], rtl: boolean): DayKey[] =>
  rtl ? [...days].reverse() : days
