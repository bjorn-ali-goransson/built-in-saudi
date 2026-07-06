import { useRef, useState } from 'react'
import { DAYS, ROWS, rowToMinutes, minutesToHHMM, type Grid } from './lib'

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

export function AvailabilityGrid({
  grid,
  onChange,
  locale,
}: {
  grid: Grid
  onChange: (next: Grid) => void
  locale: 'en' | 'ar'
}) {
  const [drag, setDrag] = useState<Drag | null>(null)
  const dragRef = useRef<Drag | null>(null)
  const days = DAY_LABELS[locale]

  function begin(cell: Cell) {
    const mode: Drag['mode'] = grid[cell.day][cell.row] ? 'erase' : 'paint'
    const d: Drag = { anchor: cell, current: cell, mode }
    dragRef.current = d
    setDrag(d)
  }

  function extend(cell: Cell) {
    const d = dragRef.current
    if (!d) return
    if (d.current.day === cell.day && d.current.row === cell.row) return
    const next = { ...d, current: cell }
    dragRef.current = next
    setDrag(next)
  }

  function commit() {
    const d = dragRef.current
    dragRef.current = null
    setDrag(null)
    if (!d) return
    const next = grid.map((col) => col.slice())
    const paint = d.mode === 'paint'
    for (let day = 0; day < DAYS; day++)
      for (let row = 0; row < ROWS; row++) if (inRect(d, day, row)) next[day][row] = paint
    onChange(next)
  }

  return (
    <div className="select-none" data-testid="availability-grid">
      <div
        className="grid touch-none"
        style={{ gridTemplateColumns: `3.2rem repeat(${DAYS}, minmax(0, 1fr))` }}
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
        <div className="sticky top-0 z-10 bg-[color:var(--surface)]" />
        {days.map((d, i) => (
          <div
            key={i}
            className="sticky top-0 z-10 bg-[color:var(--surface)] pb-2 text-center text-[0.78rem] font-semibold text-ink-soft"
          >
            {d}
          </div>
        ))}

        {/* body: one CSS row per 30-min slot */}
        {Array.from({ length: ROWS }, (_, row) => {
          const isHour = rowToMinutes(row) % 60 === 0
          return (
            <div key={row} className="contents">
              <div
                className={`pe-2 text-end text-[0.68rem] leading-none tabular-nums text-ink-faint ${
                  isHour ? '' : 'opacity-0'
                }`}
                style={{ transform: 'translateY(-0.4em)' }}
              >
                {isHour ? minutesToHHMM(rowToMinutes(row)) : ''}
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
                      'h-7 cursor-crosshair border-[color:var(--line-soft)]',
                      day === 0 ? 'border-s' : '',
                      'border-e border-b',
                      isHour ? 'border-t border-t-[color:var(--line)]' : '',
                      active
                        ? 'bg-[color-mix(in_srgb,var(--green-400)_42%,transparent)]'
                        : 'bg-transparent hover:bg-[color-mix(in_srgb,var(--green-400)_12%,transparent)]',
                      preview ? 'outline outline-1 outline-green-600' : '',
                    ].join(' ')}
                  />
                )
              })}
            </div>
          )
        })}
      </div>
      <p className="mt-2 text-[0.8rem] text-ink-faint">
        {locale === 'ar'
          ? 'اسحب لرسم أوقات فراغك · اسحب فوق وقت مُحدَّد لمسحه'
          : 'Drag to paint when you’re free · drag over a filled block to erase.'}
      </p>
    </div>
  )
}
