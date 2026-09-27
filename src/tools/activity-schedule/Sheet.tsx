import { FOOTER_BAND, FOOTER_URL, HEADER_BAND, HEADER_URL } from './illustrations'
import { Block, type BlockStrings } from './Block'
import type { IconMemory } from './icons'
import {
  DAY_LABEL, DAY_TINT, SNAP, fmt, itemsOn, layoutDay, troubleFor,
  type DayKey, type Item, type Schedule,
} from './schedule'
import type { Suggestion } from './store'

/**
 * Pixels per quarter hour.
 *
 * A half-hour activity is then 52px: one line of name, its time under it, and
 * enough left to grab. Much less and the commonest block on a school sheet
 * stops being usable as a control.
 */
const PX = 26

/** How often the axis is labelled, in minutes. */
const LABEL_EVERY = 30

export interface SheetStrings extends BlockStrings {
  time: string
  addTo: (day: string) => string
  copyDay: (day: string) => string
}

/**
 * The schedule itself — real HTML, editable in place, on one shared axis.
 *
 * It is one rendering rather than an editor plus a preview, because two would
 * drift and because the sheet IS the thing being made. The printed PDF is
 * drawn separately on a canvas — pdf-lib cannot shape Arabic — and
 * `schedule.ts` holds everything the two have to agree about.
 *
 * **The axis is a column and the days are columns beside it.** The reference
 * sheet repeats a time column inside every day card, which is the same value
 * written five times; one axis is what a real schedule has, and it is what
 * makes a fifteen-minute difference between two days VISIBLE rather than
 * something you have to read two columns of text to notice.
 *
 * It scrolls sideways on a narrow screen rather than stacking the days. Five
 * columns of a continuous axis do not stack into anything readable — you would
 * get five full-height axes — and a horizontal scroll INSIDE the sheet is the
 * arrangement `SectionNav` already uses: the container scrolls, the page does
 * not.
 */
export function Sheet({
  schedule, locale, mem, suggestions, str,
  onName, onIcon, onMove, onResize, onRemove, onAdd, onCopyDay,
}: {
  schedule: Schedule
  locale: 'en' | 'ar'
  mem: IconMemory
  suggestions: Suggestion[]
  str: SheetStrings
  onName: (day: DayKey, id: string, name: string) => void
  onIcon: (day: DayKey, id: string, icon: string, name: string) => void
  onMove: (day: DayKey, id: string, start: number, precise?: boolean) => void
  onResize: (day: DayKey, id: string, end: number, precise?: boolean) => void
  onRemove: (day: DayKey, id: string) => void
  onAdd: (day: DayKey, after?: Item) => void
  onCopyDay: (day: DayKey) => void
}) {
  // The day columns are HTML inside `dir="rtl"`, which already lays them out
  // right-to-left, so the natural order is what puts Sunday where an Arabic
  // reader starts. `columnOrder` is for the canvas the PDF is painted on; see
  // `lib/week.ts`, and `draw.ts`, which does use it.
  const cols = schedule.days
  const span = Math.max(SNAP, schedule.to - schedule.from)
  const height = (span / SNAP) * PX
  const y = (minutes: number) => ((minutes - schedule.from) / SNAP) * PX

  const marks: number[] = []
  for (
    let t = Math.ceil(schedule.from / LABEL_EVERY) * LABEL_EVERY;
    t <= schedule.to;
    t += LABEL_EVERY
  ) marks.push(t)

  return (
    <article
      data-testid="as-sheet"
      className="overflow-hidden rounded-lg border border-[color:var(--line)] bg-[#fbf7ef]"
    >
      {schedule.art && (
        <div className="w-full" style={{ aspectRatio: `100 / ${HEADER_BAND}` }}>
          <img src={HEADER_URL} alt="" data-testid="as-art-header"
            className="block size-full object-contain" />
        </div>
      )}

      <div className="px-3 pb-2 pt-3 text-center sm:px-5">
        <h2 className="font-display text-[1.5rem] leading-tight text-ink rtl:font-ar" data-testid="as-sheet-title">
          {schedule.title}
        </h2>
        {schedule.note.trim() && (
          <p className="mt-1 text-[0.86rem] text-ink-soft rtl:font-ar" data-testid="as-sheet-note">
            {schedule.note}
          </p>
        )}
      </div>

      <div className="overflow-x-auto px-2 pb-4 sm:px-4">
        <div
          className="grid min-w-[44rem] gap-x-2"
          style={{ gridTemplateColumns: `3.4rem repeat(${cols.length}, minmax(0, 1fr))` }}
          data-testid="as-grid"
        >
          <div className="pb-1 text-center text-[0.72rem] font-semibold text-ink-faint rtl:font-ar">
            {str.time}
          </div>
          {cols.map((day) => (
            <h3
              key={day}
              className="mb-1 flex items-center justify-between gap-1 rounded-t-md px-2 py-1 text-[0.9rem] font-semibold text-ink rtl:font-ar"
              style={{ background: DAY_TINT[day].head }}
              data-testid={`as-head-${day}`}
            >
              <span className="truncate">{DAY_LABEL[day][locale]}</span>
              <span className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  data-testid={`as-copy-${day}`}
                  title={str.copyDay(DAY_LABEL[day][locale])}
                  aria-label={str.copyDay(DAY_LABEL[day][locale])}
                  onClick={() => onCopyDay(day)}
                  className="cursor-pointer rounded-sm border-0 bg-transparent px-1 text-[0.8rem] leading-none text-ink-soft"
                >
                  ⧉
                </button>
                <button
                  type="button"
                  data-testid={`as-add-${day}`}
                  title={str.addTo(DAY_LABEL[day][locale])}
                  aria-label={str.addTo(DAY_LABEL[day][locale])}
                  onClick={() => onAdd(day)}
                  className="cursor-pointer rounded-sm border-0 bg-transparent px-1 text-[0.95rem] leading-none text-ink-soft"
                >
                  +
                </button>
              </span>
            </h3>
          ))}

          <div className="relative" style={{ height }} data-testid="as-axis">
            {marks.map((t) => (
              <div
                key={t}
                data-testid={`as-mark-${t}`}
                dir="ltr"
                className={`absolute inset-x-0 -translate-y-1/2 pe-1 text-end text-[0.68rem] leading-none
                  ${t % 60 === 0 ? 'text-ink-soft' : 'text-ink-faint/70'}`}
                style={{ top: y(t) }}
              >
                {fmt(t)}
              </div>
            ))}
          </div>

          {cols.map((day) => {
            const laid = layoutDay(itemsOn(schedule, day))
            return (
              <div
                key={day}
                data-day={day}
                data-testid={`as-col-${day}`}
                className="relative rounded-b-md border border-[color:var(--line)] bg-[var(--surface)]"
                style={{ height }}
              >
                {marks.map((t) => (
                  <div
                    key={t}
                    className={`pointer-events-none absolute inset-x-0 border-t
                      ${t % 60 === 0 ? 'border-[color:var(--line)]' : 'border-[color:var(--line-soft)]'}`}
                    style={{ top: y(t) }}
                  />
                ))}
                {laid.map(({ item, col, cols: n }) => (
                  <Block
                    key={item.id}
                    item={item}
                    top={y(item.start)}
                    height={Math.max(PX, ((item.end - item.start) / SNAP) * PX)}
                    left={(col / n) * 100}
                    width={100 / n}
                    mem={mem}
                    suggestions={suggestions}
                    str={str}
                    trouble={troubleFor(schedule, day, item)}
                    tint={DAY_TINT[day].band}
                    onName={(name) => onName(day, item.id, name)}
                    onIcon={(icon, name) => onIcon(day, item.id, icon, name)}
                    onMove={(start, precise) => onMove(day, item.id, start, precise)}
                    onResize={(end, precise) => onResize(day, item.id, end, precise)}
                    onRemove={() => onRemove(day, item.id)}
                    onEnter={() => onAdd(day, item)}
                  />
                ))}
              </div>
            )
          })}
        </div>
      </div>

      {schedule.art && (
        <div className="w-full" style={{ aspectRatio: `100 / ${FOOTER_BAND}` }}>
          <img src={FOOTER_URL} alt="" data-testid="as-art-footer"
            className="block size-full object-contain" />
        </div>
      )}
    </article>
  )
}
