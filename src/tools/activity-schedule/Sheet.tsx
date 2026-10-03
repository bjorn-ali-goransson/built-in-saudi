import { useRef } from 'react'
import { FOOTER_BAND, FOOTER_URL, HEADER_BAND, HEADER_URL } from './illustrations'
import { Block, type BlockStrings } from './Block'
import type { IconMemory } from './icons'
import {
  DAY_LABEL, DAY_TINT, SNAP, fmt, indexFor, itemsOn, layoutDay, troubleFor,
  type DayKey, type Item, type Schedule,
} from './schedule'

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
  editTitle: string
  editNote: string
  editGroup: string
  hideArt: string
  untitled: string
}

/**
 * The schedule itself — real HTML, and the only thing on the page.
 *
 * **Everything on it is clicked, nothing beside it is a form.** The title, the
 * line under it, the class and every lesson open the drawer; the illustrations
 * are removed by clicking them. A sheet with a form above it is two documents
 * pretending to be one, and the form always wins the attention it does not
 * deserve.
 *
 * **No borders anywhere.** Each day column is that day's solid colour and each
 * lesson is a white card on it, so the shapes carry the structure — an outline
 * round every lesson on an outlined column inside an outlined sheet is three
 * lines doing one job.
 *
 * **The axis is a column and the days are columns beside it**, which is what
 * makes a fifteen-minute difference between two days visible rather than
 * something you have to read two columns of text to notice. It scrolls
 * sideways on a narrow screen rather than stacking the days: five columns of a
 * continuous axis do not stack into anything readable, and a horizontal scroll
 * INSIDE the sheet is the arrangement `SectionNav` already uses — the
 * container scrolls, the page does not.
 */
export function Sheet({
  schedule, locale, mem, str, dragging,
  onOpen, onEditText, onHideArt, onDrag, onDragEnd, onStep, onResize, onAdd, onCopyDay,
}: {
  schedule: Schedule
  locale: 'en' | 'ar'
  mem: IconMemory
  str: SheetStrings
  /** The id of the activity being dragged, if any. */
  dragging: string | null
  onOpen: (day: DayKey, id: string) => void
  onEditText: (field: 'title' | 'note' | 'group') => void
  onHideArt: () => void
  /** Day and index the held activity currently wants. */
  onDrag: (from: DayKey, id: string, to: DayKey, index: number) => void
  onDragEnd: () => void
  onStep: (day: DayKey, id: string, delta: -1 | 1) => void
  onResize: (day: DayKey, id: string, end: number) => void
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

  /**
   * The day column under a pointer, so a lesson can be dragged into another
   * day. Measured from the live rects rather than from the pointer's own
   * target, which during a capture is always the block being dragged.
   */
  const columns = useRef(new Map<DayKey, HTMLDivElement>())
  const dayAt = (clientX: number): DayKey | null => {
    for (const [day, el] of columns.current) {
      const r = el.getBoundingClientRect()
      if (clientX >= r.left && clientX <= r.right) return day
    }
    return null
  }

  return (
    <article
      data-testid="as-sheet"
      className="overflow-hidden rounded-xl bg-[#fdf9f0] font-ar"
    >
      {schedule.art && (
        <button
          type="button"
          data-testid="as-art-header"
          title={str.hideArt}
          aria-label={str.hideArt}
          onClick={onHideArt}
          className="block w-full cursor-pointer border-0 bg-transparent p-0"
          style={{ aspectRatio: `100 / ${HEADER_BAND}` }}
        >
          <img src={HEADER_URL} alt="" className="block size-full object-contain" />
        </button>
      )}

      <div className="px-3 pb-3 pt-2 text-center sm:px-5">
        <div>
          <button
            type="button"
            data-testid="as-sheet-title"
            title={str.editTitle}
            onClick={() => onEditText('title')}
            className="inline-block cursor-pointer rounded-lg border-0 bg-[#fdf3de] px-6 py-1.5 font-ar text-[1.55rem] font-bold leading-tight text-[#2f4f3e]"
          >
            {schedule.title || str.untitled}
          </button>
        </div>
        <div className="mt-2">
          <button
            type="button"
            data-testid="as-sheet-note"
            title={str.editNote}
            onClick={() => onEditText('note')}
            className="inline-block cursor-pointer rounded-full border-0 bg-[#fdf3de] px-4 py-1 font-ar text-[0.86rem] text-[#5a6a5d]"
          >
            {schedule.note || str.editNote}
          </button>
        </div>
        <div className="mt-1.5">
          <button
            type="button"
            data-testid="as-sheet-group"
            title={str.editGroup}
            onClick={() => onEditText('group')}
            className="cursor-pointer border-0 bg-transparent font-ar text-[1rem] font-bold text-[#2f4f3e]"
          >
            {schedule.group || str.editGroup}
          </button>
        </div>
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
          {cols.map((day) => (
            <h3
              key={day}
              className="flex items-center justify-between gap-1 rounded-t-lg px-2 py-1 text-[0.92rem] font-bold text-[#2f4f3e]"
              style={{ background: DAY_TINT[day].head }}
              data-testid={`as-head-${day}`}
            >
              <span className="flex min-w-0 items-center gap-1">
                <span aria-hidden className="text-[0.8rem] text-[#8a6a1f]">★</span>
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
            const items = itemsOn(schedule, day)
            return (
              <div
                key={day}
                data-day={day}
                data-testid={`as-col-${day}`}
                ref={(el) => {
                  if (el) columns.current.set(day, el)
                  else columns.current.delete(day)
                }}
                className="rounded-b-lg px-1.5"
                style={{ height: height + 8, background: DAY_TINT[day].solid }}
              >
                {/*
                  An inner box, so the padding actually bites. A block is
                  absolutely positioned, and a percentage on one resolves
                  against the PADDING box of its containing block — so `p-1` on
                  the column moved nothing and the white cards ran edge to
                  edge. This box is the containing block, and the day's colour
                  shows down both sides like a frame, which is what lets the
                  rounded corners read as cards sitting ON the column rather
                  than as holes cut out of it.
                */}
                <div className="relative size-full">
                {layoutDay(items).map(({ item, col, cols: n }) => (
                  <Block
                    key={item.id}
                    item={item}
                    top={y(item.start) + 4}
                    height={Math.max(PX, ((item.end - item.start) / SNAP) * PX) - 3}
                    left={(col / n) * 100}
                    width={100 / n}
                    mem={mem}
                    str={str}
                    trouble={troubleFor(schedule, day, item)}
                    dim={!!dragging && dragging !== item.id}
                    onOpen={() => onOpen(day, item.id)}
                    onDrag={(clientX, _clientY, start) => {
                      const target = dayAt(clientX) ?? day
                      const into = target === day ? items : itemsOn(schedule, target)
                      onDrag(day, item.id, target, indexFor(into, item.id, start))
                    }}
                    onDragEnd={onDragEnd}
                    onStep={(delta) => onStep(day, item.id, delta)}
                    onResize={(end) => onResize(day, item.id, end)}
                  />
                ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {schedule.art && (
        <button
          type="button"
          data-testid="as-art-footer"
          title={str.hideArt}
          aria-label={str.hideArt}
          onClick={onHideArt}
          className="block w-full cursor-pointer border-0 bg-transparent p-0"
          style={{ aspectRatio: `100 / ${FOOTER_BAND}` }}
        >
          <img src={FOOTER_URL} alt="" className="block size-full object-contain" />
        </button>
      )}
    </article>
  )
}
