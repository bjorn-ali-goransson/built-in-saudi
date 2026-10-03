import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { iconFor, type IconMemory } from './icons'
import { fmtSpan, SNAP, type Item, type Trouble } from './schedule'

export interface BlockStrings {
  activity: string
  move: string
  trouble: (t: Trouble) => string
}

/**
 * How long a finger has to rest before it is moving the activity rather than
 * scrolling the sheet.
 *
 * On a pointer, a press that then moves IS a drag; a press that does not is a
 * click. On a touch screen the same press also begins a scroll, so the block
 * must not claim the gesture until it is clear, and 400ms with no movement is
 * what "I meant this one" looks like.
 */
const LONG_PRESS_MS = 400

/** Move further than this and it was a drag, not a tap. */
const SLOP = 8

/**
 * One activity on the axis — a white card on its day's colour.
 *
 * **It holds no form.** Earlier it carried the name box, the icon picker and a
 * delete button, which made every lesson a cluster of controls and the sheet a
 * wall of chrome rather than a schedule. Tapping it opens the drawer, which is
 * the one place anything is edited; what is left here is what the printed
 * sheet shows, which is also what the thing is for.
 *
 * **No border.** It is white on a solid colour, and that is already a card.
 *
 * Three gestures on one surface: a TAP opens the drawer, a DRAG reorders the
 * day, and on touch the drag needs a long press first so a finger can still
 * scroll. Arrow keys do the same two jobs — one place, or Shift for length —
 * and are the only path a spec can assert exactly.
 */
export function Block({
  item, top, height, left, width, mem, str, trouble, dim,
  onOpen, onDrag, onStep, onResize, onDragEnd,
}: {
  item: Item
  /** All in pixels, already resolved from the axis. */
  top: number
  height: number
  /** Percentages, so overlapping activities sit side by side. */
  left: number
  width: number
  mem: IconMemory
  str: BlockStrings
  trouble: Trouble | null
  /** True while another block is being dragged over this day. */
  dim: boolean
  onOpen: () => void
  /** Where it is being held, in viewport pixels and in minutes. */
  onDrag: (clientX: number, clientY: number, start: number) => void
  onDragEnd: () => void
  onStep: (delta: -1 | 1) => void
  onResize: (end: number) => void
}) {
  const drag = useRef<{ y: number; base: number; mode: 'move' | 'resize'; moved: boolean } | null>(null)
  const pending = useRef<{ timer: number; y: number } | null>(null)
  const [held, setHeld] = useState(false)
  const pxPerMinute = height / Math.max(SNAP, item.end - item.start)

  useEffect(() => () => { if (pending.current) clearTimeout(pending.current.timer) }, [])

  const cancelPending = () => {
    if (!pending.current) return
    clearTimeout(pending.current.timer)
    pending.current = null
  }

  const begin = (el: HTMLElement, pointerId: number, mode: 'move' | 'resize', y: number) => {
    drag.current = { y, base: mode === 'move' ? item.start : item.end, mode, moved: false }
    setHeld(true)
    try { el.setPointerCapture(pointerId) } catch { /* a synthetic pointer has none */ }
  }

  const start = (e: ReactPointerEvent<HTMLElement>, mode: 'move' | 'resize') => {
    if (e.pointerType === 'touch') {
      const el = e.currentTarget
      const pointerId = e.pointerId
      const y = e.clientY
      cancelPending()
      pending.current = {
        y,
        timer: window.setTimeout(() => {
          pending.current = null
          begin(el, pointerId, mode, y)
          try { navigator.vibrate?.(12) } catch { /* not everywhere */ }
        }, LONG_PRESS_MS),
      }
      return
    }
    e.preventDefault()
    begin(e.currentTarget, e.pointerId, mode, e.clientY)
  }

  const moveBy = (e: ReactPointerEvent<HTMLElement>) => {
    if (pending.current) {
      if (Math.abs(e.clientY - pending.current.y) > SLOP) cancelPending()
      return
    }
    const d = drag.current
    if (!d) return
    if (Math.abs(e.clientY - d.y) > SLOP) d.moved = true
    if (!d.moved) return
    if (e.cancelable) e.preventDefault()
    const minutes = d.base + (e.clientY - d.y) / pxPerMinute
    if (d.mode === 'move') onDrag(e.clientX, e.clientY, minutes)
    else onResize(minutes)
  }

  const end = (e: ReactPointerEvent<HTMLElement>) => {
    const wasPending = !!pending.current
    cancelPending()
    const d = drag.current
    drag.current = null
    if (held) setHeld(false)
    if (e.currentTarget.hasPointerCapture?.(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
    if (d?.mode === 'move' && d.moved) { onDragEnd(); return }
    // Nothing moved and no long press landed: that was a tap.
    if (wasPending || (d && !d.moved)) onOpen()
  }

  const roomy = height >= 44
  const icon = item.icon || iconFor(item.name, mem)

  return (
    <div
      data-testid={`as-item-${item.id}`}
      data-start={item.start}
      data-end={item.end}
      data-trouble={trouble ? trouble.kind : undefined}
      data-held={held ? '' : undefined}
      tabIndex={0}
      role="button"
      aria-label={`${item.name || str.activity} ${fmtSpan(item)}`}
      title={str.move}
      onPointerDown={(e) => start(e, 'move')}
      onPointerMove={moveBy}
      onPointerUp={end}
      onPointerCancel={end}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(); return }
        if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return
        e.preventDefault()
        // Shift changes the LENGTH; a bare arrow changes the PLACE. They are
        // the two things anybody does to a lesson.
        if (e.shiftKey) onResize(item.end + (e.key === 'ArrowUp' ? -SNAP : SNAP))
        else onStep(e.key === 'ArrowUp' ? -1 : 1)
      }}
      className={`group absolute flex cursor-pointer select-none flex-col justify-center overflow-hidden
        rounded-lg bg-white px-2 text-center
        focus:outline-none focus-visible:ring-2 focus-visible:ring-green-600
        ${held ? 'touch-none z-20 scale-[1.02] shadow-[0_8px_24px_rgba(18,33,27,0.22)]' : 'touch-auto'}
        ${dim && !held ? 'opacity-70' : ''}
        ${trouble ? 'text-[color:var(--danger)]' : ''}`}
      style={{ top, height, insetInlineStart: `${left}%`, width: `${width}%` }}
    >
      <div className="flex items-center justify-center gap-1.5">
        {icon && <span aria-hidden className="shrink-0 text-[1rem] leading-none">{icon}</span>}
        <span data-testid="as-label" className="truncate text-[0.86rem] font-semibold text-ink">
          {item.name || <span className="text-ink-faint">{str.activity}</span>}
        </span>
      </div>
      {roomy && (
        <div className="text-[0.7rem] leading-tight text-ink-faint" dir="ltr">{fmtSpan(item)}</div>
      )}
      {trouble && roomy && (
        <div data-testid={`as-hint-${item.id}`} className="truncate text-[0.66rem] leading-tight">
          {str.trouble(trouble)}
        </div>
      )}

      {/* The resize edge. Its own pointer handlers, so a drag that starts here
          changes the END rather than moving the whole activity. */}
      <div
        data-testid={`as-resize-${item.id}`}
        onPointerDown={(e) => { e.stopPropagation(); start(e, 'resize') }}
        onPointerMove={(e) => { e.stopPropagation(); moveBy(e) }}
        onPointerUp={(e) => { e.stopPropagation(); end(e) }}
        onPointerCancel={end}
        className="absolute inset-x-0 bottom-0 h-[7px] cursor-ns-resize [@media(pointer:coarse)]:h-[16px]"
      />
    </div>
  )
}
