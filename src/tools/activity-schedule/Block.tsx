import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { IconPicker, NameCombo } from './parts'
import { iconFor, type IconMemory } from './icons'
import { fmtSpan, MIN_LEN, SNAP, type Item, type Trouble } from './schedule'
import type { Suggestion } from './store'

export interface BlockStrings {
  activity: string
  iconLabel: string
  clearIcon: string
  remove: string
  move: string
  resize: string
  trouble: (t: Trouble) => string
}

/**
 * How long a finger has to rest before it is moving the activity rather than
 * scrolling the sheet.
 *
 * On a pointer, pressing IS the gesture: there is nothing else a press on a
 * block could mean. On a touch screen it is ambiguous — the same press begins
 * a scroll — so the block must not claim the gesture until it is clear, and
 * 400ms with no movement is what "I meant this one" looks like.
 */
const LONG_PRESS_MS = 400

/** Move further than this before the press lands and it was a scroll. */
const TOUCH_SLOP = 10

/**
 * One activity, sitting on the axis.
 *
 * **Dragging is on the block itself, not on a grip**, because a 15-minute
 * activity is one snap tall and a grip would take most of it. Anything
 * interactive inside — the name box, the icon button, delete — carries
 * `data-nodrag`, and the handler walks up from the event target to look for
 * it. That is the only way both things fit: the block is a control AND a form.
 *
 * **On touch it takes a LONG PRESS**, and the block does not block scrolling
 * until that press lands. The first version set `touch-action: none` so a drag
 * would work, which meant a finger anywhere on the schedule — and the blocks
 * are nearly all of it — could not scroll the page at all. Waiting for the
 * press is what lets the same surface be both scrollable and draggable.
 *
 * **Arrow keys move it too**, and that is not only the accessible answer. A
 * pointer drag is almost impossible to assert on, so the keyboard path is what
 * makes the snapping testable at all — the same reasoning `doc-scan` records
 * for its corner handles.
 */
export function Block({
  item, top, height, left, width, mem, suggestions, str, trouble, tint, edge,
  onName, onIcon, onMove, onStep, onResize, onRemove, onEnter,
}: {
  item: Item
  /** All in pixels, already resolved from the axis. */
  top: number
  height: number
  /** Percentages, so overlapping activities sit side by side. */
  left: number
  width: number
  mem: IconMemory
  suggestions: Suggestion[]
  str: BlockStrings
  trouble: Trouble | null
  tint: string
  /** The day's own outline, so a block belongs to its column. */
  edge: string
  onName: (name: string) => void
  onIcon: (icon: string, name: string) => void
  /**
   * Where the activity is being HELD, in minutes.
   *
   * Not where it lands: the caller turns it into a position in the day's
   * order, because that is what the gesture means. A pointer can only say
   * where a finger is.
   */
  onMove: (start: number) => void
  /** One place earlier or later — the keyboard's version of the same thing. */
  onStep: (delta: -1 | 1) => void
  onResize: (end: number) => void
  onRemove: () => void
  onEnter: () => void
}) {
  const drag = useRef<{ y: number; base: number; mode: 'move' | 'resize'; id: number } | null>(null)
  const pending = useRef<{ timer: number; y: number } | null>(null)
  const [held, setHeld] = useState(false)
  const pxPerMinute = height / Math.max(MIN_LEN, item.end - item.start)

  useEffect(() => () => { if (pending.current) clearTimeout(pending.current.timer) }, [])

  const cancelPending = () => {
    if (!pending.current) return
    clearTimeout(pending.current.timer)
    pending.current = null
  }

  const begin = (el: HTMLElement, pointerId: number, mode: 'move' | 'resize') => {
    drag.current = { y: 0, base: mode === 'move' ? item.start : item.end, mode, id: pointerId }
    setHeld(true)
    try { el.setPointerCapture(pointerId) } catch { /* a synthetic pointer has none */ }
  }

  const start = (e: ReactPointerEvent<HTMLElement>, mode: 'move' | 'resize') => {
    // A pointer that landed on a control is operating that control.
    if ((e.target as HTMLElement).closest('[data-nodrag]')) return

    if (e.pointerType === 'touch') {
      // Claim nothing yet: until the press lands this is probably a scroll.
      const el = e.currentTarget
      const pointerId = e.pointerId
      const y = e.clientY
      cancelPending()
      pending.current = {
        y,
        timer: window.setTimeout(() => {
          pending.current = null
          begin(el, pointerId, mode)
          drag.current!.y = y
          // A press that took effect with nothing moving yet needs to say so.
          try { navigator.vibrate?.(12) } catch { /* not everywhere */ }
        }, LONG_PRESS_MS),
      }
      return
    }

    e.preventDefault()
    begin(e.currentTarget, e.pointerId, mode)
    drag.current!.y = e.clientY
  }

  const moveBy = (e: ReactPointerEvent<HTMLElement>) => {
    if (pending.current) {
      // Moved before the press landed, so it was a scroll after all.
      if (Math.abs(e.clientY - pending.current.y) > TOUCH_SLOP) cancelPending()
      return
    }
    const d = drag.current
    if (!d) return
    // Stop the browser panning the sheet out from under a drag we have taken.
    if (e.cancelable) e.preventDefault()
    const minutes = d.base + (e.clientY - d.y) / pxPerMinute
    if (d.mode === 'move') onMove(minutes)
    else onResize(minutes)
  }

  const end = (e: ReactPointerEvent<HTMLElement>) => {
    cancelPending()
    if (!drag.current) return
    drag.current = null
    setHeld(false)
    if (e.currentTarget.hasPointerCapture?.(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
  }

  // Under about 40px there is room for the name and nothing else.
  const roomy = height >= 44

  return (
    <div
      data-testid={`as-item-${item.id}`}
      data-start={item.start}
      data-end={item.end}
      data-trouble={trouble ? trouble.kind : undefined}
      data-held={held ? '' : undefined}
      tabIndex={0}
      role="group"
      aria-label={`${item.name || str.activity} ${fmtSpan(item)}`}
      title={str.move}
      onPointerDown={(e) => start(e, 'move')}
      onPointerMove={moveBy}
      onPointerUp={end}
      onPointerCancel={end}
      onKeyDown={(e) => {
        if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return
        if ((e.target as HTMLElement).closest('[data-nodrag]')) return
        e.preventDefault()
        // Shift changes the LENGTH; a bare arrow changes the PLACE. They are
        // the same gesture on a block with only one axis to give, and they are
        // the two things anybody does to a lesson.
        if (e.shiftKey) onResize(item.end + (e.key === 'ArrowUp' ? -SNAP : SNAP))
        else onStep(e.key === 'ArrowUp' ? -1 : 1)
      }}
      // `touch-auto` until a press has landed: the blocks are nearly the whole
      // sheet, so claiming touch up front made the schedule unscrollable on a
      // phone. Once held, it takes the gesture and lifts off the column.
      className={`group absolute select-none rounded-md border px-1 pt-[2px] cursor-grab
        focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500
        ${held ? 'touch-none z-20 shadow-[var(--shadow-lg)] ring-2 ring-green-500' : 'touch-auto overflow-hidden'}
        ${trouble ? 'border-[color:var(--danger)]' : 'border-[color:var(--line)]'}`}
      style={{
        top, height, insetInlineStart: `${left}%`, width: `${width}%`,
        background: trouble ? '#fdecea' : tint,
        borderColor: trouble ? undefined : edge,
      }}
    >
      <div className="flex items-start gap-1">
        <span data-nodrag>
          <IconPicker
            icon={item.icon}
            suggested={item.name ? iconFor(item.name, mem) : ''}
            label={str.iconLabel}
            clearLabel={str.clearIcon}
            testId={`as-icon-${item.id}`}
            onChoose={(icon) => onIcon(icon, item.name)}
          />
        </span>
        <span data-nodrag className="min-w-0 flex-1">
          <NameCombo
            value={item.name}
            icon={item.icon}
            suggestions={suggestions}
            placeholder={str.activity}
            testId={`as-name-${item.id}`}
            onChange={onName}
            onPick={(s) => { onName(s.name); onIcon(s.icon, s.name) }}
            onEnter={onEnter}
          />
        </span>
        <button
          type="button"
          data-nodrag
          data-testid={`as-remove-${item.id}`}
          title={str.remove}
          aria-label={str.remove}
          onClick={onRemove}
          className="shrink-0 cursor-pointer rounded-sm border-0 bg-transparent px-1 text-[0.8rem] leading-none text-ink-faint
            opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100
            [@media(pointer:coarse)]:opacity-100"
        >
          ×
        </button>
      </div>

      {roomy && (
        <div className="pointer-events-none px-1 text-[0.68rem] leading-tight text-ink-faint" dir="ltr">
          {fmtSpan(item)}
        </div>
      )}
      {trouble && roomy && (
        <div
          data-testid={`as-hint-${item.id}`}
          className="px-1 text-[0.66rem] leading-tight text-[color:var(--danger)]"
        >
          {str.trouble(trouble)}
        </div>
      )}

      {/* The resize edge. Its own pointer handlers, so a drag that starts here
          changes the END rather than moving the whole activity. */}
      <div
        data-testid={`as-resize-${item.id}`}
        title={str.resize}
        onPointerDown={(e) => { e.stopPropagation(); start(e, 'resize') }}
        onPointerMove={(e) => { e.stopPropagation(); moveBy(e) }}
        onPointerUp={(e) => { e.stopPropagation(); end(e) }}
        onPointerCancel={end}
        className="absolute inset-x-0 bottom-0 h-[7px] cursor-ns-resize
          [@media(pointer:coarse)]:h-[18px]"
      />
    </div>
  )
}
