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
 * sheets repeat a time column inside every day card, which is the same value
 * written five times; one axis is what a real schedule has, and it is what
 * makes a fifteen-minute difference between two days VISIBLE rather than
 * something you have to read two columns of text to notice.
 *
 * **The WHOLE sheet is set in IBM Plex Sans Arabic, in both languages** —
 * not `rtl:font-ar`, which would give the Arabic sheet one face and the
 * English sheet another. This is a printed bilingual artefact whose activity
 * names are routinely Arabic whatever the interface language, and Plex is the
 * one loaded family that sets Latin and Arabic evenly, which is also why the
 * times already used it. A sheet in two families is two sheets.
 *
 * It scrolls sideways on a narrow screen rather than stacking the days. Five
 * columns of a continuous axis do not stack into anything readable — you would
 * get five full-height axes — and a horizontal scroll INSIDE the sheet is the
 * arrangement `SectionNav` already uses: the container scrolls, the page does
 * not.
 */
export function Sheet({
  schedule, locale, mem, suggestions, str,
  onName, onIcon, onMove, onStep, onResize, onRemove, onAdd, onCopyDay,
}: {
  schedule: Schedule
  locale: 'en' | 'ar'
  mem: IconMemory
  suggestions: Suggestion[]
  str: SheetStrings
  onName: (day: DayKey, id: string, name: string) => void
  onIcon: (day: DayKey, id: string, icon: string, name: string) => void
  onMove: (day: DayKey, id: string, start: number) => void
  onStep: (day: DayKey, id: string, delta: -1 | 1) => void
  onResize: (day: DayKey, id: string, end: number) => void
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

  // The half-hour bands, alternating, the way every one of these sheets tints
  // its rows. On a continuous axis they do more than decorate: they are what
  // lets the eye carry a time from the column on the side across five days.
  const bands: Array<{ top: number; height: number; odd: boolean }> = []
  for (let i = 0, t = schedule.from; t < schedule.to; i++, t += LABEL_EVERY) {
    const end = Math.min(t + LABEL_EVERY, schedule.to)
    bands.push({ top: y(t), height: y(end) - y(t), odd: i % 2 === 1 })
  }

  return (
    <article
      data-testid="as-sheet"
      className="overflow-hidden rounded-lg border border-[color:var(--line)] bg-[#fdf9f0] font-ar"
    >
      {schedule.art && (
        <div className="w-full" style={{ aspectRatio: `100 / ${HEADER_BAND}` }}>
          <img src={HEADER_URL} alt="" data-testid="as-art-header"
            className="block size-full object-contain" />
        </div>
      )}

      <div className="px-3 pb-3 pt-2 text-center sm:px-5">
        {/* Each on its OWN line: as inline-block siblings in a centred box
            they flowed together, so the title banner and the note pill sat
            side by side on one row. */}
        <div>
          <h2
            data-testid="as-sheet-title"
            className="inline-block rounded-lg border-2 border-[#e4d5b4] bg-[#fdf3de] px-6 py-1.5 text-[1.55rem] font-bold leading-tight text-[#2f4f3e] shadow-[0_2px_0_#e4d5b4]"
          >
            {schedule.title}
          </h2>
        </div>
        {schedule.note.trim() && (
          <div className="mt-2">
            <p
              data-testid="as-sheet-note"
              className="inline-block rounded-full bg-[#fdf3de] px-4 py-1 text-[0.86rem] text-[#5a6a5d]"
            >
              {schedule.note}
            </p>
          </div>
        )}
        {schedule.group.trim() && (
          <p data-testid="as-sheet-group" className="mt-1.5 text-[1rem] font-bold text-[#2f4f3e]">
            {schedule.group}
          </p>
        )}
      </div>

      <div className="overflow-x-auto px-2 pb-4 sm:px-4">
        <div
          className="grid min-w-[46rem] gap-x-2"
          style={{ gridTemplateColumns: `3.6rem repeat(${cols.length}, minmax(0, 1fr))` }}
          data-testid="as-grid"
        >
          <div className="pb-1 text-center text-[0.72rem] font-semibold text-ink-faint">
            {str.time}
          </div>
          {/*
            The head and the body below are two grid cells and ONE card: the
            head carries every border but its bottom, the body every border but
            its top, and there is no gap between them. They used to be a tinted
            bar floating a pixel above a bordered box, which read as a card
            that had come apart.
          */}
          {cols.map((day) => (
            <h3
              key={day}
              className="flex items-center justify-between gap-1 rounded-t-lg border-2 border-b-0 px-2 py-1 text-[0.92rem] font-bold text-[#2f4f3e]"
              style={{ background: DAY_TINT[day].head, borderColor: DAY_TINT[day].edge }}
              data-testid={`as-head-${day}`}
            >
              <span className="flex min-w-0 items-center gap-1">
                <span aria-hidden className="text-[0.8rem] text-[#f0b429]">★</span>
                <span className="truncate">{DAY_LABEL[day][locale]}</span>
              </span>
              <span className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  data-testid={`as-copy-${day}`}
                  title={str.copyDay(DAY_LABEL[day][locale])}
                  aria-label={str.copyDay(DAY_LABEL[day][locale])}
                  onClick={() => onCopyDay(day)}
                  className="cursor-pointer rounded-sm border-0 bg-transparent px-1 text-[0.8rem] leading-none text-[#2f4f3e]/70"
                >
                  ⧉
                </button>
                <button
                  type="button"
                  data-testid={`as-add-${day}`}
                  title={str.addTo(DAY_LABEL[day][locale])}
                  aria-label={str.addTo(DAY_LABEL[day][locale])}
                  onClick={() => onAdd(day)}
                  className="cursor-pointer rounded-sm border-0 bg-transparent px-1 text-[1rem] leading-none text-[#2f4f3e]/70"
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
                className={`absolute inset-x-0 -translate-y-1/2 pe-1 text-end text-[0.7rem] leading-none
                  ${t % 60 === 0 ? 'font-semibold text-ink-soft' : 'text-ink-faint/80'}`}
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
                className="relative overflow-hidden rounded-b-lg border-2 border-t-0 bg-white"
                style={{ height, borderColor: DAY_TINT[day].edge }}
              >
                {bands.map((b, i) => (
                  <div
                    key={i}
                    className="pointer-events-none absolute inset-x-0"
                    style={{
                      top: b.top,
                      height: b.height,
                      background: b.odd ? DAY_TINT[day].band : 'transparent',
                    }}
                  />
                ))}
                {marks.map((t) => (
                  <div
                    key={t}
                    className="pointer-events-none absolute inset-x-0 border-t"
                    style={{
                      top: y(t),
                      borderColor: t % 60 === 0 ? DAY_TINT[day].edge : 'transparent',
                    }}
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
                    tint={DAY_TINT[day].block}
                    edge={DAY_TINT[day].edge}
                    onName={(name) => onName(day, item.id, name)}
                    onIcon={(icon, name) => onIcon(day, item.id, icon, name)}
                    onMove={(start) => onMove(day, item.id, start)}
                    onStep={(delta) => onStep(day, item.id, delta)}
                    onResize={(end) => onResize(day, item.id, end)}
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
