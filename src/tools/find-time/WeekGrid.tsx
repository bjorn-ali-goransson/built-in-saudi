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
  const el = (document.elementFromPoint(x, y) as HTMLElement | null)?.closest<HTMLElement>('[data-col]')
  if (!el) return null
  return { col: Number(el.dataset.col), row: Number(el.dataset.row), slot: el.dataset.slot ? Number(el.dataset.slot) : null }
}
const inRect = (d: Drag, col: number, row: number) =>
  col >= Math.min(d.anchor.col, d.current.col) && col <= Math.max(d.anchor.col, d.current.col)
  && row >= Math.min(d.anchor.row, d.current.row) && row <= Math.max(d.anchor.row, d.current.row)

/**
 * The week on this browser's clock. Drag across cells to mark (or, starting on
 * a marked cell, unmark) a block of time; each drag is one rectangle, so
 * several drags give several separate blocks. Behind my marks, every cell is
 * shaded by how many of those who answered are free then, and the cells that
 * suit all of them are gold.
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
    const el = sc.querySelector<HTMLElement>(`[data-row="${row}"]`)
    const head = sc.querySelector<HTMLElement>('[data-head]')
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
    if (!selectable(slot)) return slot != null && mine.has(slot)
    return drag && inRect(drag, col, row) ? drag.paint : mine.has(slot)
  }
  // One outline round a marked block rather than one per half hour: an edge
  // is drawn only where the neighbour across it is not marked. Inline-start
  // and inline-end come out right in either direction, since the grid itself
  // is laid out by `dir`.
  const W = '2px', C = 'var(--green-700)'
  function edge(col: number, row: number): string {
    const rtl = scroller.current ? getComputedStyle(scroller.current).direction === 'rtl' : false
    const sides: string[] = []
    if (!mineAt(col, row - 1)) sides.push(`inset 0 ${W} 0 0 ${C}`)
    if (!mineAt(col, row + 1)) sides.push(`inset 0 -${W} 0 0 ${C}`)
    const left = rtl ? col + 1 : col - 1, right = rtl ? col - 1 : col + 1
    if (!mineAt(left, row)) sides.push(`inset ${W} 0 0 0 ${C}`)
    if (!mineAt(right, row)) sides.push(`inset -${W} 0 0 0 ${C}`)
    return sides.join(', ') || 'none'
  }

  const cols = lay.cols.length
  return (
    <div className="select-none grid gap-2" data-testid="ft-grid">
      <div
        ref={scroller}
        className="relative max-h-[30rem] overflow-auto rounded-lg border border-[color:var(--line)] bg-[var(--surface)] max-[560px]:max-h-[70vh]"
      >
        <div
          className="grid"
          style={{ gridTemplateColumns: `3.2rem repeat(${cols}, minmax(2.6rem, 1fr))` }}
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
          <div data-head className="sticky top-0 start-0 z-30 h-11 bg-[var(--surface)] border-b border-[color:var(--line)]" />
          {lay.cols.map((c, i) => {
            const isToday = c.date.toDateString() === today
            return (
              <div
                key={c.key}
                data-testid={`ft-day-${i}`}
                className={`sticky top-0 z-20 h-11 px-1 grid place-items-center text-center text-[0.74rem] leading-tight font-semibold border-b border-s border-[color:var(--line)] ${isToday ? 'bg-[color-mix(in_srgb,var(--green-500)_14%,var(--surface))] text-green-800' : 'bg-[var(--surface)] text-ink-soft'}`}
              >
                {dayFmt.format(c.date)}
              </div>
            )
          })}

          {Array.from({ length: lay.rows }, (_, row) => (
            <div key={row} className="contents">
              <div data-row={row} className="sticky start-0 z-10 bg-[var(--surface)] pe-1.5 h-6 flex items-start justify-end text-[0.68rem] tabular-nums text-ink-faint touch-pan-x touch-pan-y">
                {row % 2 === 0 && <span className="-translate-y-[0.45em]">{timeFmt.format(new Date(2000, 0, 1, 0, row * slotMin))}</span>}
              </div>
              {lay.cols.map((_, col) => {
                const slot = lay.cell.get(`${col}:${row}`)
                const open = selectable(slot)
                const isMine = mineAt(col, row)
                const names = slot != null ? free.get(slot) || [] : []
                const gold = slot != null && everyone.has(slot)
                const frac = answered ? names.length / answered : 0
                const bg = !open
                  ? 'var(--line-soft)'
                  : gold
                    ? 'color-mix(in srgb, var(--gold-500) 55%, var(--surface))'
                    : names.length
                      ? `color-mix(in srgb, var(--green-500) ${Math.round(12 + frac * 55)}%, var(--surface))`
                      : 'var(--surface)'
                return (
                  <div
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
                      'h-6 border-s border-[color:var(--line-soft)]',
                      row % 2 === 1 ? 'border-b border-b-[color:var(--line)]' : 'border-b border-b-[color:var(--line-soft)] border-dashed',
                      open && editable ? 'cursor-crosshair touch-none' : open ? 'cursor-pointer' : 'opacity-60',

                      focus === slot && slot != null ? 'outline outline-2 -outline-offset-2 outline-[var(--ink)]' : '',
                    ].join(' ')}
                    style={{ background: bg, boxShadow: isMine ? edge(col, row) : undefined }}
                  />
                )
              })}
            </div>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[0.78rem] text-ink-soft">
        {editable && <span className="inline-flex items-center gap-1.5"><i className="inline-block size-3.5 rounded-[3px] shadow-[inset_0_0_0_2px_var(--green-700)]" />{labels.mineLegend}</span>}
        <span className="inline-flex items-center gap-1.5"><i className="inline-block size-3.5 rounded-[3px]" style={{ background: 'color-mix(in srgb, var(--green-500) 45%, var(--surface))' }} />{labels.freeLegend}</span>
        <span className="inline-flex items-center gap-1.5"><i className="inline-block size-3.5 rounded-[3px]" style={{ background: 'color-mix(in srgb, var(--gold-500) 55%, var(--surface))' }} />{labels.everyoneLegend}</span>
        <span className="inline-flex items-center gap-1.5"><i className="inline-block size-3.5 rounded-[3px] opacity-60" style={{ background: 'var(--line-soft)' }} />{labels.pastLegend}</span>
      </div>
    </div>
  )
}
