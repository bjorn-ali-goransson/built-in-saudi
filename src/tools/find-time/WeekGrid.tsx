import { useEffect, useMemo, useRef, useState } from 'react'
import type { Layout } from './lib'
import { slotTime } from './lib'

interface Props {
  lay: Layout
  start: number
  slotMin: number
  now: number
  free: Map<number, string[]>
  answered: number
  everyone: Set<number>
  /** My marks; null when I cannot mark (not holding a name yet). */
  mine: Set<number> | null
  onCommit: (next: Set<number>) => void
  focus: number | null
  onFocus: (slot: number | null) => void
  intl: string
  labels: { mineLegend: string; freeLegend: string; everyoneLegend: string; pastLegend: string }
}

interface Pos { col: number; row: number }
interface Drag { anchor: Pos; current: Pos; paint: boolean }

function posAt(x: number, y: number): (Pos & { slot: number | null }) | null {
  const el = (document.elementFromPoint(x, y) as HTMLElement | null)?.closest<HTMLElement>('td[data-col]')
  if (!el) return null
  return { col: Number(el.dataset.col), row: Number(el.dataset.row), slot: el.dataset.slot ? Number(el.dataset.slot) : null }
}
const inRect = (d: Drag, col: number, row: number) =>
  col >= Math.min(d.anchor.col, d.current.col) && col <= Math.max(d.anchor.col, d.current.col)
  && row >= Math.min(d.anchor.row, d.current.row) && row <= Math.max(d.anchor.row, d.current.row)

/**
 * The week on this browser's clock. Drag across cells to mark (or, starting on
 * a marked cell, unmark) a block of time; each drag is one rectangle, so
 * several drags give several separate blocks.
 *
 * Drawn with lines and fills only, nothing outlined per cell: it is a table in
 * which every cell draws just its bottom and inline-end border (the scroller
 * draws the outer edge), so each line between two cells is one hairline, a
 * slightly darker one on the hour. `border-collapse` itself is not used
 * because a sticky header cell leaves its collapsed border behind as it
 * scrolls. State is a faded fill: green by how many are free, gold where
 * everyone is, grey for the past; my own times are a stronger green with a
 * 2px bar down the inline-start edge, which runs unbroken through a block.
 */
export function WeekGrid({ lay, start, slotMin, now, free, answered, everyone, mine, onCommit, focus, onFocus, intl, labels }: Props) {
  const [drag, setDrag] = useState<Drag | null>(null)
  const dragRef = useRef<Drag | null>(null)
  const scroller = useRef<HTMLDivElement>(null)
  const editable = mine != null

  const dayFmt = useMemo(() => new Intl.DateTimeFormat(intl, { weekday: 'short', day: 'numeric', month: 'short' }), [intl])
  const timeFmt = useMemo(() => new Intl.DateTimeFormat(intl, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }), [intl])
  const today = new Date(now).toDateString()

  // Open on the working day rather than at midnight: row 08:00 at the top,
  // unless somebody marked a time earlier than that — someone hours ahead
  // marks their morning, which can be the small hours here.
  useEffect(() => {
    const sc = scroller.current
    if (!sc) return
    let row = (8 * 60) / slotMin
    for (const s of free.keys()) { const w = lay.where.get(s); if (w && w[1] < row) row = w[1] }
    const el = sc.querySelector<HTMLElement>(`tr[data-row="${row}"]`)
    const head = sc.querySelector<HTMLElement>('thead')
    if (el) sc.scrollTop = el.offsetTop - (head?.offsetHeight || 0)
    // Once, when the grid first appears.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const selectable = (slot: number | undefined): slot is number =>
    slot != null && slotTime(start, slotMin, slot) + slotMin * 60000 > now

  function commit() {
    const d = dragRef.current
    dragRef.current = null
    setDrag(null)
    if (!d || !mine) return
    const next = new Set(mine)
    for (const [k, slot] of lay.cell) {
      const [c, r] = k.split(':').map(Number)
      if (!inRect(d, c, r) || !selectable(slot)) continue
      if (d.paint) next.add(slot); else next.delete(slot)
    }
    onCommit(next)
  }

  /** Whether the cell is marked as I will have it once the drag lands. */
  function mineAt(col: number, row: number): boolean {
    if (!mine) return false
    const slot = lay.cell.get(`${col}:${row}`)
    if (slot == null) return false
    if (!selectable(slot)) return mine.has(slot)
    return drag && inRect(drag, col, row) ? drag.paint : mine.has(slot)
  }

  const fill = {
    past: 'color-mix(in srgb, var(--ink) 5%, var(--surface))',
    mine: 'color-mix(in srgb, var(--green-500) 34%, var(--surface))',
    gold: 'color-mix(in srgb, var(--gold-500) 42%, var(--surface))',
    free: (f: number) => `color-mix(in srgb, var(--green-500) ${Math.round(6 + f * 20)}%, var(--surface))`,
  }
  // Every cell draws only its own bottom and inline-end line.
  const cellLine = (row: number) =>
    `border-e border-e-[color:var(--line-soft)] border-b ${row % 2 === 1 ? 'border-b-[color:var(--line)]' : 'border-b-[color:var(--line-soft)]'}`

  return (
    <div className="select-none grid gap-2" data-testid="ft-grid">
      <div
        ref={scroller}
        className="relative max-h-[30rem] overflow-auto rounded-lg border border-[color:var(--line)] bg-[var(--surface)] max-[560px]:max-h-[70vh]"
      >
        <table
          className="w-full table-fixed border-separate border-spacing-0"
          style={{ minWidth: `${3.2 + lay.cols.length * 2.6}rem` }}
          onPointerDown={(e) => {
            const p = posAt(e.clientX, e.clientY)
            if (!p) return
            if (p.slot != null) onFocus(p.slot)
            if (!editable || !selectable(p.slot ?? undefined)) return
            e.preventDefault()
            ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
            const d: Drag = { anchor: p, current: p, paint: !mine!.has(p.slot!) }
            dragRef.current = d
            setDrag(d)
          }}
          onPointerMove={(e) => {
            const p = posAt(e.clientX, e.clientY)
            if (!p) return
            if (!dragRef.current) { if (e.pointerType === 'mouse' && p.slot != null && p.slot !== focus) onFocus(p.slot); return }
            const d = dragRef.current
            if (d.current.col === p.col && d.current.row === p.row) return
            const next = { ...d, current: { col: p.col, row: p.row } }
            dragRef.current = next
            setDrag(next)
          }}
          onPointerUp={commit}
          onPointerCancel={commit}
        >
          <colgroup>
            <col style={{ width: '3.2rem' }} />
            {lay.cols.map((c) => <col key={c.key} />)}
          </colgroup>
          <thead>
            <tr>
              <th className="sticky top-0 start-0 z-30 h-11 bg-[var(--surface)] border-e border-b border-[color:var(--line)]" />
              {lay.cols.map((c, i) => {
                const isToday = c.date.toDateString() === today
                return (
                  <th
                    key={c.key}
                    data-testid={`ft-day-${i}`}
                    className={`sticky top-0 z-20 h-11 px-1 text-center text-[0.74rem] leading-tight font-semibold border-b border-b-[color:var(--line)] ${i < lay.cols.length - 1 ? 'border-e border-e-[color:var(--line-soft)]' : ''} ${isToday ? 'text-green-800' : 'text-ink-soft'}`}
                    style={{ background: isToday ? 'color-mix(in srgb, var(--green-500) 12%, var(--surface))' : 'var(--surface)' }}
                  >
                    {dayFmt.format(c.date)}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: lay.rows }, (_, row) => (
              <tr key={row} data-row={row}>
                <th
                  scope="row"
                  className={`sticky start-0 z-10 h-6 p-0 pe-1.5 align-top text-end text-[0.68rem] font-normal tabular-nums text-ink-faint bg-[var(--surface)] border-e border-e-[color:var(--line)] ${row % 2 === 1 ? 'border-b border-b-[color:var(--line)]' : ''}`}
                >
                  {row % 2 === 0 && row > 0 && <span className="relative -top-[0.55em]">{timeFmt.format(new Date(2000, 0, 1, 0, row * slotMin))}</span>}
                </th>
                {lay.cols.map((_, col) => {
                  const slot = lay.cell.get(`${col}:${row}`)
                  const open = selectable(slot)
                  const isMine = mineAt(col, row)
                  const names = slot != null ? free.get(slot) || [] : []
                  const gold = slot != null && everyone.has(slot)
                  const bg = !open ? fill.past
                    : gold ? fill.gold
                    : isMine ? fill.mine
                    : names.length ? fill.free(answered ? names.length / answered : 0)
                    : 'var(--surface)'
                  const last = col === lay.cols.length - 1
                  return (
                    <td
                      key={col}
                      data-col={col}
                      data-row={row}
                      data-slot={slot ?? ''}
                      data-testid={slot != null ? `ft-cell-${slot}` : undefined}
                      data-mine={isMine ? '1' : undefined}
                      data-free={names.length || undefined}
                      data-everyone={gold ? '1' : undefined}
                      aria-label={slot != null ? `${dayFmt.format(lay.cols[col].date)} ${timeFmt.format(slotTime(start, slotMin, slot))}` : undefined}
                      className={[
                        'relative h-6 p-0 transition-[filter] duration-75',
                        cellLine(row),
                        last ? '!border-e-0' : '',
                        row === lay.rows - 1 ? '!border-b-0' : '',
                        open && editable ? 'cursor-crosshair touch-none hover:brightness-[0.96]' : open ? 'cursor-pointer hover:brightness-[0.96]' : '',
                        focus === slot && slot != null ? 'brightness-[0.92]' : '',
                      ].join(' ')}
                      style={{ background: bg }}
                    >
                      {/* Through the line below too, so a block's bar is unbroken. */}
                      {isMine && <span aria-hidden="true" className={`pointer-events-none absolute start-0 top-0 w-[2px] bg-green-600 ${mineAt(col, row + 1) ? '-bottom-px' : 'bottom-0'}`} />}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[0.78rem] text-ink-soft">
        {editable && <span className="inline-flex items-center gap-1.5"><i className="relative inline-block size-3.5 rounded-[2px] overflow-hidden" style={{ background: fill.mine }}><i className="absolute inset-y-0 start-0 w-[2px] bg-green-600" /></i>{labels.mineLegend}</span>}
        <span className="inline-flex items-center gap-1.5"><i className="inline-block size-3.5 rounded-[2px]" style={{ background: fill.free(0.7) }} />{labels.freeLegend}</span>
        <span className="inline-flex items-center gap-1.5"><i className="inline-block size-3.5 rounded-[2px]" style={{ background: fill.gold }} />{labels.everyoneLegend}</span>
        <span className="inline-flex items-center gap-1.5"><i className="inline-block size-3.5 rounded-[2px] border border-[color:var(--line-soft)]" style={{ background: fill.past }} />{labels.pastLegend}</span>
      </div>
    </div>
  )
}
