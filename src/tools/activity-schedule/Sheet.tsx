import { FOOTER_BAND, FOOTER_URL, HEADER_BAND, HEADER_URL } from './illustrations'
import { IconPicker, NameCombo, TimeCombo } from './parts'
import {
  DAY_LABEL, DAY_TINT, cellAt, troubleWith,
  type Cell, type DayKey, type Schedule, type Trouble,
} from './schedule'
import { iconFor, type IconMemory } from './icons'
import type { Suggestion } from './store'

export interface SheetStrings {
  activity: string
  time: string
  iconLabel: string
  clearIcon: string
  fix: string
  alignRow: string
  trouble: (t: Trouble) => string
}

/**
 * The schedule itself — real HTML, and editable in place.
 *
 * It is one rendering rather than an editor plus a preview, because two would
 * drift and because the sheet IS the thing being made: a form that produces a
 * picture of a form is a worse tool than a picture you can type into. The
 * printed PDF is drawn separately on a canvas — pdf-lib cannot shape Arabic —
 * and `schedule.ts` holds everything the two have to agree about.
 *
 * A DAY IS A CARD, not a table column. The reference sheet is laid out that
 * way and it is also the only layout that survives a phone: cards stack, where
 * a five-column table becomes a horizontal scroll with the day name off-screen
 * — on the device a parent is most likely to open the link on.
 */
export function Sheet({
  schedule, locale, mem, suggestions, times, str, onCell, onIcon, onAlign,
}: {
  schedule: Schedule
  locale: 'en' | 'ar'
  mem: IconMemory
  suggestions: Suggestion[]
  times: string[]
  str: SheetStrings
  onCell: (row: number, day: DayKey, patch: Partial<Cell>) => void
  onIcon: (row: number, day: DayKey, icon: string, name: string) => void
  onAlign: (row: number) => void
}) {
  // The day cards are HTML inside `dir="rtl"`, which already lays them out
  // right-to-left, so the natural order is what puts Sunday where an Arabic
  // reader starts. `columnOrder` is for the canvas the PDF is painted on; see
  // `lib/week.ts`, and `draw.ts`, which does use it.
  const cols = schedule.days

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

      {/*
        One grid for the whole sheet, with each day card taking its rows from
        it via `subgrid`.
        A card that stacks its own rows lines up with its neighbours only while
        every cell is the same height — and the moment a cell carries a hint it
        grows, so every row below it slips out of step with the other days.
        That breaks the one idea the sheet is built on: that a ROW is a period
        shared across the week. Subgrid makes the row band a property of the
        sheet rather than of each card, so a hint pushes ALL five days down
        together. Below 720px the container is `block`, the cards stack, and
        none of it applies — there is only one day on screen to line up with.
      */}
      <div
        className="grid gap-2 px-2 pb-4 max-[720px]:block sm:px-4"
        style={{
          gridTemplateColumns: `repeat(${cols.length}, minmax(0, 1fr))`,
          gridTemplateRows: `auto repeat(${schedule.rows.length}, auto)`,
        }}
        data-testid="as-grid"
      >
        {cols.map((day) => (
          <section
            key={day}
            data-day={day}
            data-testid={`as-col-${day}`}
            className="row-span-full grid min-w-0 grid-rows-subgrid overflow-hidden rounded-md border border-[color:var(--line)] bg-[var(--surface)] max-[720px]:mb-2 max-[720px]:block"
          >
            <h3
              className="px-2 py-1 text-center text-[0.9rem] font-semibold text-ink rtl:font-ar"
              style={{ background: DAY_TINT[day].head }}
              data-testid={`as-head-${day}`}
            >
              {DAY_LABEL[day][locale]}
            </h3>
            {schedule.rows.map((row, r) => {
                const cell = cellAt(row, day)
                const trouble = troubleWith(row, day, schedule.days)
                const suggested = cell.name ? iconFor(cell.name, mem) : ''
                return (
                  <div
                    key={r}
                    data-testid={`as-cell-${r}-${day}`}
                    className="border-t border-[color:var(--line-soft)] px-1 py-1 first:border-t-0"
                    style={{ background: r % 2 ? DAY_TINT[day].band : 'transparent' }}
                  >
                    <TimeCombo
                      value={cell.time}
                      options={times}
                      placeholder={str.time}
                      testId={`as-time-${r}-${day}`}
                      onChange={(time) => onCell(r, day, { time })}
                    />
                    <div className="flex items-center gap-1">
                      <IconPicker
                        icon={cell.icon}
                        suggested={suggested}
                        label={str.iconLabel}
                        clearLabel={str.clearIcon}
                        testId={`as-icon-${r}-${day}`}
                        onChoose={(icon) => onIcon(r, day, icon, cell.name)}
                      />
                      <NameCombo
                        value={cell.name}
                        icon={cell.icon}
                        suggestions={suggestions}
                        placeholder={str.activity}
                        testId={`as-name-${r}-${day}`}
                        onChange={(name) => onCell(r, day, { name })}
                        onPick={(s) => onCell(r, day, { name: s.name, icon: s.icon })}
                      />
                    </div>
                    {trouble && (
                      <div
                        data-testid={`as-hint-${r}-${day}`}
                        data-trouble={trouble.kind}
                        className="mt-1 flex items-center gap-1 rounded-sm bg-[color-mix(in_srgb,var(--color-gold-400)_20%,transparent)] px-1 py-[2px]"
                      >
                        <span className="min-w-0 flex-1 text-[0.68rem] leading-tight text-ink-soft rtl:font-ar">
                          {str.trouble(trouble)}
                        </span>
                        {(trouble.kind === 'odd' || trouble.kind === 'missing') && (
                          <button
                            type="button"
                            data-testid={`as-fix-${r}-${day}`}
                            title={str.alignRow}
                            onClick={() => onCell(r, day, { time: trouble.expected })}
                            className="shrink-0 rounded-sm border border-[color:var(--line)] bg-[var(--surface)] px-1 text-[0.68rem] text-ink cursor-pointer rtl:font-ar"
                          >
                            {str.fix}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )
            })}
          </section>
        ))}
      </div>

      <RowAligners schedule={schedule} label={str.alignRow} onAlign={onAlign} />

      {schedule.art && (
        <div className="w-full" style={{ aspectRatio: `100 / ${FOOTER_BAND}` }}>
          <img src={FOOTER_URL} alt="" data-testid="as-art-footer"
            className="block size-full object-contain" />
        </div>
      )}
    </article>
  )
}

/**
 * One "align this row" per row that needs it.
 *
 * Separate from the per-cell fix because they answer different questions: the
 * cell button fixes the day you are looking at, and this fixes a row where
 * more than one day drifted — which is what happens when a whole period moves
 * and only some of the week was updated.
 */
function RowAligners({
  schedule, label, onAlign,
}: { schedule: Schedule; label: string; onAlign: (row: number) => void }) {
  const rows = schedule.rows
    .map((row, r) => ({
      r,
      n: schedule.days.filter((d) => {
        const t = troubleWith(row, d, schedule.days)
        return t && (t.kind === 'odd' || t.kind === 'missing')
      }).length,
    }))
    .filter((x) => x.n > 1)
  if (!rows.length) return null
  return (
    <div className="flex flex-wrap gap-2 px-2 pb-3 sm:px-4" data-testid="as-row-aligners">
      {rows.map(({ r, n }) => (
        <button
          key={r}
          type="button"
          data-testid={`as-align-${r}`}
          onClick={() => onAlign(r)}
          className="rounded-sm border border-[color:var(--line)] bg-[var(--surface)] px-2 py-1 text-[0.76rem] text-ink-soft cursor-pointer rtl:font-ar"
        >
          {label} {r + 1} ({n})
        </button>
      ))}
    </div>
  )
}
