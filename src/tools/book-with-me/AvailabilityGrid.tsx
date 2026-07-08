import { forwardRef, useImperativeHandle, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { DAYS, ROWS, SLOT_MIN, rowToMinutes, minutesToHHMM, type Grid } from './lib'

export interface GridHandle {
  scrollToFirst: () => void
}

interface Cell {
  day: number
  row: number
}

interface Drag {
  anchor: Cell
  current: Cell
  mode: 'paint' | 'erase'
}

const DAY_LABELS = {
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  ar: ['أحد', 'إثن', 'ثلا', 'أرب', 'خمي', 'جمع', 'سبت'],
}

function inRect(d: Drag, day: number, row: number): boolean {
  const [d0, d1] = [Math.min(d.anchor.day, d.current.day), Math.max(d.anchor.day, d.current.day)]
  const [r0, r1] = [Math.min(d.anchor.row, d.current.row), Math.max(d.anchor.row, d.current.row)]
  return day >= d0 && day <= d1 && row >= r0 && row <= r1
}

/** Read the {day,row} cell under a pointer via the elementFromPoint dataset. */
function cellAt(x: number, y: number): Cell | null {
  const el = document.elementFromPoint(x, y) as HTMLElement | null
  const c = el?.closest<HTMLElement>('[data-day]')
  if (!c || c.dataset.day === undefined || c.dataset.row === undefined) return null
  return { day: Number(c.dataset.day), row: Number(c.dataset.row) }
}

export const AvailabilityGrid = forwardRef<GridHandle, {
  grid: Grid
  onChange: (next: Grid) => void
  locale: 'en' | 'ar'
  firstDay: number
}>(function AvailabilityGrid({ grid, onChange, locale, firstDay }, ref) {
  // Visual column c maps to real weekday dayOrder[c] (0 = Sun … 6 = Sat).
  const dayOrder = Array.from({ length: DAYS }, (_, i) => (firstDay + i) % 7)
  const [drag, setDrag] = useState<Drag | null>(null)
  const [tip, setTip] = useState<{ x: number; y: number } | null>(null)
  const [box, setBox] = useState<{ top: number; left: number; width: number; height: number } | null>(null)
  const dragRef = useRef<Drag | null>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  const days = dayOrder.map((d) => DAY_LABELS[locale][d])

  // Expose scroll-to-first-slot to the parent (the "Total slots" pill). The grid
  // is full-height with no inner scroller, so this scrolls the page.
  useImperativeHandle(ref, () => ({
    scrollToFirst() {
      let firstRow = -1
      for (let row = 0; row < ROWS && firstRow < 0; row++)
        for (let day = 0; day < DAYS; day++) if (grid[day][row]) { firstRow = row; break }
      if (firstRow < 0) return
      gridRef.current?.querySelector(`[data-day="0"][data-row="${firstRow}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    },
  }), [grid])

  const cellRect = (c: Cell) =>
    gridRef.current?.querySelector(`[data-day="${c.day}"][data-row="${c.row}"]`)?.getBoundingClientRect()

  function boxCenter(d: Drag): { x: number; y: number } | null {
    const a = cellRect(d.anchor)
    const b = cellRect(d.current)
    if (!a || !b) return null
    return { x: (Math.min(a.left, b.left) + Math.max(a.right, b.right)) / 2, y: (Math.min(a.top, b.top) + Math.max(a.bottom, b.bottom)) / 2 }
  }

  // The selection rect in grid-content coordinates (for the absolute overlay).
  function computeBox(d: Drag): { top: number; left: number; width: number; height: number } | null {
    const g = gridRef.current
    const a = cellRect(d.anchor)
    const b = cellRect(d.current)
    if (!g || !a || !b) return null
    const gr = g.getBoundingClientRect()
    return {
      left: Math.min(a.left, b.left) - gr.left,
      top: Math.min(a.top, b.top) - gr.top,
      width: Math.max(a.right, b.right) - Math.min(a.left, b.left),
      height: Math.max(a.bottom, b.bottom) - Math.min(a.top, b.top),
    }
  }

  function begin(cell: Cell) {
    const mode: Drag['mode'] = grid[dayOrder[cell.day]][cell.row] ? 'erase' : 'paint'
    const d: Drag = { anchor: cell, current: cell, mode }
    dragRef.current = d
    setDrag(d)
    setTip(boxCenter(d))
    setBox(computeBox(d))
  }

  function extend(cell: Cell) {
    const d = dragRef.current
    if (!d) return
    if (d.current.day === cell.day && d.current.row === cell.row) return
    const next = { ...d, current: cell }
    dragRef.current = next
    setDrag(next)
    setTip(boxCenter(next))
    setBox(computeBox(next))
  }

  function commit() {
    const d = dragRef.current
    dragRef.current = null
    setDrag(null)
    setTip(null)
    setBox(null)
    if (!d) return
    const next = grid.map((col) => col.slice())
    const paint = d.mode === 'paint'
    for (let col = 0; col < DAYS; col++)
      for (let row = 0; row < ROWS; row++) if (inRect(d, col, row)) next[dayOrder[col]][row] = paint
    onChange(next)
  }

  // Selection bounds — one outline round the whole drag box (no internal doubling).
  const sel = drag
    ? {
        d0: Math.min(drag.anchor.day, drag.current.day),
        d1: Math.max(drag.anchor.day, drag.current.day),
        r0: Math.min(drag.anchor.row, drag.current.row),
        r1: Math.max(drag.anchor.row, drag.current.row),
      }
    : null

  // Live totals shown in the floating tooltip while dragging. When erasing we
  // count only the slots actually painted (that will really be removed), not
  // the whole rectangle.
  const info = (() => {
    if (!sel || !drag) return null
    const erasing = drag.mode === 'erase'
    // Count only the slots that actually change: painted ones when erasing,
    // empty ones when painting (overlaps with already-painted don't count).
    let count = 0
    for (let col = sel.d0; col <= sel.d1; col++)
      for (let row = sel.r0; row <= sel.r1; row++)
        if (erasing ? grid[dayOrder[col]][row] : !grid[dayOrder[col]][row]) count++
    const dstr = sel.d0 === sel.d1 ? days[sel.d0] : `${days[sel.d0]}–${days[sel.d1]}`
    const tstr = `${minutesToHHMM(rowToMinutes(sel.r0))}–${minutesToHHMM(rowToMinutes(sel.r1) + SLOT_MIN)}`
    const noun = locale === 'ar' ? 'موعد' : `slot${count !== 1 ? 's' : ''}`
    const verb = erasing ? (locale === 'ar' ? 'حذف ' : 'remove ') : (locale === 'ar' ? 'إضافة ' : 'add ')
    return `${verb}${count} ${noun} · ${dstr} ${tstr}`
  })()

  return (
    <div className="select-none" data-testid="availability-grid">
      {/* No overflow-hidden here: it would create a scroll container and break the
          sticky weekday header. Corner cells are rounded individually instead. */}
      <div className="rounded-lg border border-[color:var(--line)] max-[560px]:mx-[calc(50%-50vw)] max-[560px]:w-screen max-[560px]:max-w-[100vw] max-[560px]:rounded-none max-[560px]:border-x-0">
        <div
          ref={gridRef}
          className="grid relative"
          style={{ gridTemplateColumns: `3.4rem repeat(${DAYS}, minmax(0, 1fr))` }}
          onPointerDown={(e) => {
            const cell = cellAt(e.clientX, e.clientY)
            if (!cell) return
            e.preventDefault()
            ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
            begin(cell)
          }}
          onPointerMove={(e) => {
            if (!dragRef.current) return
            const cell = cellAt(e.clientX, e.clientY)
            if (cell) extend(cell)
          }}
          onPointerUp={commit}
          onPointerCancel={commit}
        >
          {/* header row — sticky below the navbar while the page scrolls */}
          <div className="bg-[var(--surface)] border-b border-[color:var(--line)] h-9 sticky top-[68px] max-[560px]:top-[60px] z-20 rounded-tl-lg max-[560px]:rounded-none" />
          {days.map((d, i) => (
            <div
              key={i}
              className={`bg-[var(--surface)] border-b border-s border-[color:var(--line)] grid place-items-center text-[0.78rem] font-semibold text-ink-soft h-9 sticky top-[68px] max-[560px]:top-[60px] z-20 ${i === days.length - 1 ? 'rounded-tr-lg max-[560px]:rounded-none' : ''}`}
            >
              {d}
            </div>
          ))}

          {/* body: one CSS row per hour */}
          {Array.from({ length: ROWS }, (_, row) => (
            <div key={row} className="contents">
              <div className="pe-2 flex items-start justify-end text-[0.7rem] tabular-nums text-ink-faint -translate-y-[0.5em] touch-pan-y">
                {minutesToHHMM(rowToMinutes(row))}
              </div>
              {Array.from({ length: DAYS }, (_, day) => {
                const on = grid[dayOrder[day]][row]
                const preview = drag && inRect(drag, day, row)
                const painting = preview && drag!.mode === 'paint'
                const erasing = preview && drag!.mode === 'erase'
                const active = erasing ? false : painting ? true : on
                return (
                  <div
                    key={day}
                    data-day={day}
                    data-row={row}
                    data-testid={`cell-${day}-${row}`}
                    aria-label={`${days[day]} ${minutesToHHMM(rowToMinutes(row))}`}
                    className={[
                      'h-9 cursor-crosshair touch-none border-s border-[color:var(--line-soft)] transition-colors',
                      row < ROWS - 1 ? 'border-b border-b-[color:var(--line-soft)]' : '',
                      row === ROWS - 1 && day === DAYS - 1 ? 'rounded-br-lg max-[560px]:rounded-none' : '',
                      active
                        ? 'bg-[color-mix(in_srgb,var(--green-500)_30%,transparent)] hover:bg-[color-mix(in_srgb,var(--green-500)_38%,transparent)]'
                        : 'bg-[var(--surface)] hover:bg-[color-mix(in_srgb,var(--green-400)_15%,transparent)]',
                    ].join(' ')}
                  />
                )
              })}
            </div>
          ))}

          {/* One outline around the whole drag box — absolutely positioned so it
              stays out of the grid's auto-placement (a grid item would shove the
              cells around). No internal doubling. */}
          {box && (
            <div
              className={`pointer-events-none absolute z-[3] rounded-[2px] border-2 ${drag?.mode === 'erase' ? 'border-gold-500' : 'border-green-700'}`}
              style={{ left: box.left, top: box.top, width: box.width, height: box.height }}
            />
          )}
        </div>
      </div>

      {info && tip && createPortal(
        <div
          className="fixed z-[70] -translate-x-1/2 -translate-y-1/2 pointer-events-none whitespace-nowrap rounded-full bg-[var(--ink)] text-sand-100 text-[0.78rem] font-semibold px-3 py-1.5 shadow-[var(--shadow-md)]"
          style={{ left: tip.x, top: tip.y }}
          data-testid="drag-total"
        >
          {info}
        </div>,
        document.body,
      )}
    </div>
  )
})
