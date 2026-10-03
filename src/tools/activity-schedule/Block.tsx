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
 * How far a finger may wander WHILE waiting for the press to land.
 *
 * Deliberately larger than `SLOP`. A finger resting on glass is never still —
 * a thumb drifts several pixels over 400ms without its owner intending
 * anything — so the tolerance that decides "this was a scroll after all" has
 * to be looser than the one that decides "this was a drag, not a tap". At 8px
 * the long press simply never landed for a real hand, and it looked exactly
 * like a gesture that was not implemented.
 */
const HOLD_SLOP = 16

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
  const pending = useRef<{ timer: number; y: number; mode: 'move' | 'resize' } | null>(null)
  const [held, setHeld] = useState(false)
  const node = useRef<HTMLDivElement>(null)
  const pxPerMinute = height / Math.max(SNAP, item.end - item.start)

  // Latest handlers, so the native listener below never needs re-binding and
  // never closes over a stale `onDrag`.
  const live = useRef({ onDrag, onResize, pxPerMinute })
  live.current = { onDrag, onResize, pxPerMinute }

  useEffect(() => () => { if (pending.current) clearTimeout(pending.current.timer) }, [])

  const cancelPending = () => {
    if (!pending.current) return
    clearTimeout(pending.current.timer)
    pending.current = null
  }

  const begin = (mode: 'move' | 'resize', y: number) => {
    drag.current = { y, base: mode === 'move' ? item.start : item.end, mode, moved: false }
    setHeld(true)
  }

  /**
   * Touch is handled NATIVELY, and that is the whole fix.
   *
   * `touch-action` is read when the gesture BEGINS. Flipping it to `none` when
   * the long press lands is too late — the browser has already decided this
   * touch belongs to the scroller, so every later move scrolls the page and no
   * drag ever happens. It looked right in a spec that dispatched synthetic
   * pointer events, because those never consult `touch-action` at all: the
   * test proved the handler and not the gesture.
   *
   * What actually works is calling `preventDefault()` on `touchmove`, which
   * takes the gesture back — but only from a listener registered
   * `{ passive: false }`, and React marks its own touch listeners passive. So
   * it is bound here by hand. It works because the press landed with no
   * movement: nothing has started scrolling yet, so there is still a gesture
   * to claim.
   */
  useEffect(() => {
    const el = node.current
    if (!el) return

    const onTouchMove = (e: TouchEvent) => {
      const t = e.touches[0]
      if (!t) return
      if (pending.current) {
        // Moved before the press landed, so it was a scroll after all.
        if (Math.abs(t.clientY - pending.current.y) > HOLD_SLOP) cancelPending()
        return
      }
      const d = drag.current
      if (!d) return
      if (e.cancelable) e.preventDefault()
      d.moved = true
      const { onDrag: drag_, onResize: resize_, pxPerMinute: ppm } = live.current
      const minutes = d.base + (t.clientY - d.y) / ppm
      if (d.mode === 'move') drag_(t.clientX, t.clientY, minutes)
      else resize_(minutes)
    }

    el.addEventListener('touchmove', onTouchMove, { passive: false })
    return () => el.removeEventListener('touchmove', onTouchMove)
  }, [])

  const touchStart = (e: React.TouchEvent, mode: 'move' | 'resize') => {
    const t = e.touches[0]
    if (!t) return
    cancelPending()
    const y = t.clientY
    pending.current = {
      y,
      mode,
      timer: window.setTimeout(() => {
        pending.current = null
        begin(mode, y)
        // Nothing has moved, so the press needs to say it took effect.
        try { navigator.vibrate?.(12) } catch { /* not everywhere */ }
      }, LONG_PRESS_MS),
    }
  }

  const touchEnd = (e: React.TouchEvent) => {
    const wasPending = !!pending.current
    cancelPending()
    const d = drag.current
    drag.current = null
    if (held) setHeld(false)
    if (d) {
      // The press had landed, so this finger was moving an activity — even if
      // it never actually moved one. Opening the drawer here would mean a
      // long press ends in an editor, which is the one thing a long press is
      // not for.
      if (e.cancelable) e.preventDefault()
      if (d.mode === 'move' && d.moved) onDragEnd()
      return
    }
    // A tap: down and up again before the press ever landed.
    if (wasPending) onOpen()
  }

  /**
   * A cancel is the browser TAKING the gesture, and it is never a tap.
   *
   * This was the whole bug, and it reported itself as two unrelated ones. A
   * long press on Android raises the context menu at around 500ms, which
   * cancels the touch — and `touchcancel` was wired straight to `touchEnd`,
   * so the cancel was read as a release and opened the drawer. From outside
   * that is "the drawer expands on press" and "dragging does not work",
   * which sound like two defects and are one line.
   *
   * Preventing the context menu (below) stops most of these from happening at
   * all; this makes the rest harmless rather than actively wrong.
   */
  const touchCancel = () => {
    cancelPending()
    const d = drag.current
    drag.current = null
    if (held) setHeld(false)
    // The day re-lays itself live during a drag, so whatever was moved has
    // already moved. There is nothing to roll back — only state to clear.
    if (d?.mode === 'move' && d.moved) onDragEnd()
  }

  /** The pointer path is MOUSE and pen only; touch is handled above. */
  const start = (e: ReactPointerEvent<HTMLElement>, mode: 'move' | 'resize') => {
    if (e.pointerType === 'touch') return
    e.preventDefault()
    begin(mode, e.clientY)
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* synthetic */ }
  }

  const moveBy = (e: ReactPointerEvent<HTMLElement>) => {
    if (e.pointerType === 'touch') return
    const d = drag.current
    if (!d) return
    if (Math.abs(e.clientY - d.y) > SLOP) d.moved = true
    if (!d.moved) return
    const minutes = d.base + (e.clientY - d.y) / pxPerMinute
    if (d.mode === 'move') onDrag(e.clientX, e.clientY, minutes)
    else onResize(minutes)
  }

  const end = (e: ReactPointerEvent<HTMLElement>) => {
    if (e.pointerType === 'touch') return
    const d = drag.current
    drag.current = null
    if (held) setHeld(false)
    if (e.currentTarget.hasPointerCapture?.(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
    if (d?.mode === 'move' && d.moved) { onDragEnd(); return }
    if (d && !d.moved) onOpen()
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
      ref={node}
      onPointerDown={(e) => start(e, 'move')}
      onPointerMove={moveBy}
      onPointerUp={end}
      onPointerCancel={end}
      onTouchStart={(e) => touchStart(e, 'move')}
      onTouchEnd={touchEnd}
      onTouchCancel={touchCancel}
      onContextMenu={(e) => e.preventDefault()}
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
      style={{
        top, height, insetInlineStart: `${left}%`, width: `${width}%`,
        // Safari's own long-press menu, which cancels the touch exactly as
        // Android's context menu does.
        WebkitTouchCallout: 'none',
      }}
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
        onTouchStart={(e) => { e.stopPropagation(); touchStart(e, 'resize') }}
        onTouchEnd={(e) => { e.stopPropagation(); touchEnd(e) }}
        onTouchCancel={(e) => { e.stopPropagation(); touchCancel() }}
        onContextMenu={(e) => e.preventDefault()}
        className="absolute inset-x-0 bottom-0 h-[7px] cursor-ns-resize [@media(pointer:coarse)]:h-[16px]"
      />
    </div>
  )
}
