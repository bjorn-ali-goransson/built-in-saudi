import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
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
}>(function AvailabilityGrid({ grid, onChange, locale }, ref) {
  const [drag, setDrag] = useState<Drag | null>(null)
  const [tip, setTip] = useState<{ x: number; y: number } | null>(null)
  const [box, setBox] = useState<{ top: number; left: number; width: number; height: number } | null>(null)
  const dragRef = useRef<Drag | null>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const days = DAY_LABELS[locale]

  function scrollRowToTop(row: number) {
    const c = scrollRef.current
    if (!c) return
    const cell = c.querySelector(`[data-day="0"][data-row="${row}"]`) as HTMLElement | null
    if (cell) c.scrollTop += cell.getBoundingClientRect().top - c.getBoundingClientRect().top - 44
  }

  // On load, scroll so midday is in view (the grid now spans all 24 hours).
  useEffect(() => { scrollRowToTop(8) }, [])

  // Expose scroll-to-first-slot to the parent (the "Total slots" pill).
  useImperativeHandle(ref, () => ({
    scrollToFirst() {
      let firstRow = -1
      for (let row = 0; row < ROWS && firstRow < 0; row++)
        for (let day = 0; day < DAYS; day++) if (grid[day][row]) { firstRow = row; break }
      if (firstRow >= 0) scrollRowToTop(firstRow)
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
    const mode: Drag['mode'] = grid[cell.day][cell.row] ? 'erase' : 'paint'
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
    for (let day = 0; day < DAYS; day++)
      for (let row = 0; row < ROWS; row++) if (inRect(d, day, row)) next[day][row] = paint
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
    let count = 0
    for (let day = sel.d0; day <= sel.d1; day++)
      for (let row = sel.r0; row <= sel.r1; row++)
        if (!erasing || grid[day][row]) count++
    const dstr = sel.d0 === sel.d1 ? days[sel.d0] : `${days[sel.d0]}–${days[sel.d1]}`
    const tstr = `${minutesToHHMM(rowToMinutes(sel.r0))}–${minutesToHHMM(rowToMinutes(sel.r1) + SLOT_MIN)}`
    const noun = locale === 'ar' ? 'موعد' : `slot${count !== 1 ? 's' : ''}`
    const verb = erasing ? (locale === 'ar' ? 'حذف ' : 'remove ') : ''
    return `${verb}${count} ${noun} · ${dstr} ${tstr}`
  })()

  return (
    <div className="select-none" data-testid="availability-grid">
      <div ref={scrollRef} className="max-h-[58vh] overflow-y-auto rounded-lg border border-[color:var(--line)]">
        <div
          ref={gridRef}
          className="grid touch-none relative"
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
          {/* header row */}
          <div className="sticky top-0 z-20 bg-[var(--surface)] border-b border-[color:var(--line)] h-9" />
          {days.map((d, i) => (
            <div
              key={i}
              className="sticky top-0 z-20 bg-[var(--surface)] border-b border-s border-[color:var(--line)] grid place-items-center text-[0.78rem] font-semibold text-ink-soft h-9"
            >
              {d}
            </div>
          ))}

          {/* body: one CSS row per hour */}
          {Array.from({ length: ROWS }, (_, row) => (
            <div key={row} className="contents">
              <div className="pe-2 flex items-start justify-end text-[0.7rem] tabular-nums text-ink-faint -translate-y-[0.5em]">
                {minutesToHHMM(rowToMinutes(row))}
              </div>
              {Array.from({ length: DAYS }, (_, day) => {
                const on = grid[day][row]
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
                      'h-9 cursor-crosshair border-s border-[color:var(--line-soft)] transition-colors',
                      row < ROWS - 1 ? 'border-b border-b-[color:var(--line-soft)]' : '',
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
      <p className="mt-2 text-[0.8rem] text-ink-faint">
        {locale === 'ar'
          ? 'اسحب لرسم أوقات فراغك · اسحب فوق وقت مُحدَّد لمسحه'
          : 'Drag to paint when you’re free · drag over a filled block to erase.'}
      </p>

      {info && tip && (
        <div
          className="fixed z-[70] -translate-x-1/2 -translate-y-1/2 pointer-events-none whitespace-nowrap rounded-full bg-[var(--ink)] text-sand-100 text-[0.78rem] font-semibold px-3 py-1.5 shadow-[var(--shadow-md)]"
          style={{ left: tip.x, top: tip.y }}
          data-testid="drag-total"
        >
          {info}
        </div>
      )}
    </div>
  )
})
