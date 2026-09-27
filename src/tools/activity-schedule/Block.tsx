import { useRef, type PointerEvent as ReactPointerEvent } from 'react'
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
 * One activity, sitting on the axis.
 *
 * **Dragging is on the block itself, not on a grip**, because a 15-minute
 * activity is one snap tall and a grip would take most of it. Anything
 * interactive inside — the name box, the icon button, delete — carries
 * `data-nodrag`, and the handler walks up from the event target to look for
 * it. That is the only way both things fit: the block is a control AND a form.
 *
 * **Arrow keys move it too**, and that is not only the accessible answer. A
 * pointer drag is almost impossible to assert on, so the keyboard path is what
 * makes the snapping testable at all — the same reasoning `doc-scan` records
 * for its corner handles.
 */
export function Block({
  item, top, height, left, width, mem, suggestions, str, trouble, tint,
  onName, onIcon, onMove, onResize, onRemove, onEnter,
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
  onName: (name: string) => void
  onIcon: (icon: string, name: string) => void
  /**
   * New start, in minutes; the caller snaps and clamps.
   *
   * `precise` is the keyboard: an arrow key means exactly one quarter hour and
   * must not be pulled onto a neighbouring day's edge instead, or the same key
   * moves a different distance depending on what the rest of the week happens
   * to contain. The magnet is for dragging, where the pointer has already
   * given an approximate answer.
   */
  onMove: (start: number, precise?: boolean) => void
  onResize: (end: number, precise?: boolean) => void
  onRemove: () => void
  onEnter: () => void
}) {
  const drag = useRef<{ y: number; base: number; mode: 'move' | 'resize' } | null>(null)
  const pxPerMinute = height / Math.max(MIN_LEN, item.end - item.start)

  const start = (e: ReactPointerEvent<HTMLElement>, mode: 'move' | 'resize') => {
    // A pointer that landed on a control is operating that control.
    if ((e.target as HTMLElement).closest('[data-nodrag]')) return
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { y: e.clientY, base: mode === 'move' ? item.start : item.end, mode }
  }

  const moveBy = (e: ReactPointerEvent<HTMLElement>) => {
    const d = drag.current
    if (!d) return
    const minutes = d.base + (e.clientY - d.y) / pxPerMinute
    if (d.mode === 'move') onMove(minutes)
    else onResize(minutes)
  }

  const end = (e: ReactPointerEvent<HTMLElement>) => {
    if (!drag.current) return
    drag.current = null
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
  }

  // Under about 40px there is room for the name and nothing else.
  const roomy = height >= 44

  return (
    <div
      data-testid={`as-item-${item.id}`}
      data-start={item.start}
      data-end={item.end}
      data-trouble={trouble ? trouble.kind : undefined}
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
        const step = e.key === 'ArrowUp' ? -SNAP : SNAP
        // Shift resizes, because the two are the same gesture on a block that
        // has only one axis to give.
        if (e.shiftKey) onResize(item.end + step, true)
        else onMove(item.start + step, true)
      }}
      className={`absolute touch-none select-none overflow-hidden rounded-sm border px-1 pt-[2px] cursor-grab
        focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500
        ${trouble ? 'border-[color:var(--danger)] bg-[color-mix(in_srgb,var(--danger)_12%,#fff)]' : 'border-[color:var(--line)]'}`}
      style={{
        top, height, insetInlineStart: `${left}%`, width: `${width}%`,
        background: trouble ? undefined : tint,
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
          className="shrink-0 cursor-pointer rounded-sm border-0 bg-transparent px-1 text-[0.8rem] leading-none text-ink-faint"
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
          className="px-1 text-[0.66rem] leading-tight text-[color:var(--danger)] rtl:font-ar"
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
        className="absolute inset-x-0 bottom-0 h-[7px] cursor-ns-resize touch-none"
      />
    </div>
  )
}
