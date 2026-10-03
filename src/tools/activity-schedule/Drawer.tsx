import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Button, Input } from '../../components/ui'
import { PALETTE, iconFor, rankNames, type IconMemory } from './icons'
import { MIN_LEN, SNAP, fmtSpan, type Item } from './schedule'
import type { Suggestion } from './store'

export type Editing =
  | { kind: 'item'; day: string; id: string }
  | { kind: 'text'; field: 'title' | 'note' | 'group' }
  | { kind: 'settings' }

export interface DrawerStrings {
  activity: string
  iconLabel: string
  clearIcon: string
  remove: string
  longer: string
  shorter: string
  done: string
  suggestions: string
  titleLabel: string
  noteLabel: string
  groupLabel: string
  settings: string
  groupName: (g: { group: string; groupAr: string }) => string
}

/**
 * Everything that is not the sheet, in a drawer off the bottom of the screen.
 *
 * The sheet IS the document, so nothing else should be sitting beside it: no
 * form above it for the title, no row of checkboxes, no editing chrome inside
 * the lessons. Tapping a thing on the sheet opens the one place where it is
 * edited, and that place is at the bottom of the screen where a thumb is.
 *
 * It is a drawer rather than the app's centred `Sheet` dialog because every
 * one of these edits is a small adjustment to something you are looking at —
 * covering the schedule with a modal card to change one word would hide the
 * only context that makes the word make sense. The lesson being edited stays
 * on screen above it.
 */
export function Drawer({
  editing, item, text, mem, suggestions, str, children,
  onName, onIcon, onText, onResize, onRemove, onClose,
}: {
  editing: Editing
  item: Item | null
  text: string
  mem: IconMemory
  suggestions: Suggestion[]
  str: DrawerStrings
  /** The settings body, which the tool owns. */
  children?: React.ReactNode
  onName: (name: string) => void
  onIcon: (icon: string) => void
  onText: (value: string) => void
  onResize: (end: number) => void
  onRemove: () => void
  onClose: () => void
}) {
  const [showIcons, setShowIcons] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => { setShowIcons(false) }, [editing])

  const matches = useMemo(() => {
    if (editing.kind !== 'item' || !item) return []
    return rankNames(item.name, suggestions.filter((s) => s.name !== item.name)).slice(0, 8)
  }, [editing, item, suggestions])

  const label = editing.kind === 'text'
    ? (editing.field === 'title' ? str.titleLabel : editing.field === 'note' ? str.noteLabel : str.groupLabel)
    : editing.kind === 'settings' ? str.settings : (item?.name || str.activity)

  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center"
      role="dialog"
      aria-modal="true"
      data-testid="as-drawer"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      {/* Dimmed, but not blacked out: the lesson being edited stays legible. */}
      <div className="absolute inset-0 bg-[color-mix(in_srgb,var(--ink)_28%,transparent)]" />
      <div className="relative flex max-h-[80dvh] w-full max-w-[34rem] flex-col gap-3 rounded-t-xl bg-[var(--surface)] p-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] shadow-[0_-10px_40px_rgba(18,33,27,0.25)] animate-[fadeUp_0.18s_ease_both]">
        <div className="flex items-center justify-between gap-3">
          <h3 className="truncate font-ar text-[1.05rem] font-bold text-ink">{label}</h3>
          <button
            type="button"
            data-testid="as-drawer-close"
            aria-label={str.done}
            onClick={onClose}
            className="grid size-9 shrink-0 cursor-pointer place-items-center rounded-md border-0 bg-transparent text-[1.05rem] leading-none text-ink-soft"
          >
            ✕
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain">
          {editing.kind === 'settings' && children}

          {editing.kind === 'text' && (
            <Input
              autoFocus
              value={text}
              data-testid="as-drawer-text"
              onChange={(e) => onText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') onClose() }}
            />
          )}

          {editing.kind === 'item' && item && (
            <>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  data-testid="as-drawer-icon"
                  title={str.iconLabel}
                  aria-label={str.iconLabel}
                  onClick={() => setShowIcons((v) => !v)}
                  className="grid size-11 shrink-0 cursor-pointer place-items-center rounded-md border-0 bg-sand-100 text-[1.4rem] leading-none"
                >
                  {item.icon || iconFor(item.name, mem) || '+'}
                </button>
                <Input
                  autoFocus
                  value={item.name}
                  placeholder={str.activity}
                  data-testid="as-drawer-name"
                  className="font-ar"
                  onChange={(e) => onName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') onClose() }}
                />
              </div>

              {showIcons && (
                <div data-testid="as-drawer-palette" className="grid gap-2">
                  {PALETTE.map((g) => (
                    <div key={g.group}>
                      <div className="px-1 pb-1 text-[0.72rem] font-semibold text-ink-faint font-ar">
                        {str.groupName(g)}
                      </div>
                      <div className="grid grid-cols-9 gap-1">
                        {g.icons.map((em) => (
                          <button
                            key={em}
                            type="button"
                            data-testid={`as-drawer-pick-${em}`}
                            onClick={() => { onIcon(em); setShowIcons(false) }}
                            className={`grid aspect-square cursor-pointer place-items-center rounded-md border-0 text-[1.15rem]
                              ${em === item.icon ? 'bg-[color-mix(in_srgb,var(--color-green-600)_18%,transparent)]' : 'bg-transparent'}`}
                          >
                            {em}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                  <button
                    type="button"
                    data-testid="as-drawer-clear-icon"
                    onClick={() => { onIcon(''); setShowIcons(false) }}
                    className="justify-self-start rounded-md border-0 bg-sand-100 px-3 py-1.5 text-[0.82rem] text-ink-soft font-ar cursor-pointer"
                  >
                    {str.clearIcon}
                  </button>
                </div>
              )}

              {!showIcons && matches.length > 0 && (
                <div className="grid gap-1">
                  <div className="text-[0.74rem] font-semibold text-ink-faint font-ar">{str.suggestions}</div>
                  <div className="flex flex-wrap gap-1.5" data-testid="as-drawer-suggestions">
                    {matches.map((s, i) => (
                      <button
                        key={s.name}
                        type="button"
                        data-testid={`as-drawer-suggestion-${i}`}
                        onClick={() => { onName(s.name); if (s.icon) onIcon(s.icon) }}
                        className="flex cursor-pointer items-center gap-1.5 rounded-md border-0 bg-sand-100 px-2.5 py-1.5 text-[0.86rem] text-ink font-ar"
                      >
                        <span>{s.icon || '·'}</span>
                        <span>{s.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2">
                <span className="font-ar text-[0.82rem] text-ink-faint" dir="ltr" data-testid="as-drawer-span">
                  {fmtSpan(item)}
                </span>
                <span className="flex gap-1">
                  <button
                    type="button"
                    data-testid="as-drawer-shorter"
                    aria-label={str.shorter}
                    title={str.shorter}
                    disabled={item.end - item.start <= MIN_LEN}
                    onClick={() => onResize(item.end - SNAP)}
                    className="grid size-9 cursor-pointer place-items-center rounded-md border-0 bg-sand-100 text-[1.1rem] leading-none text-ink disabled:opacity-40"
                  >
                    −
                  </button>
                  <button
                    type="button"
                    data-testid="as-drawer-longer"
                    aria-label={str.longer}
                    title={str.longer}
                    onClick={() => onResize(item.end + SNAP)}
                    className="grid size-9 cursor-pointer place-items-center rounded-md border-0 bg-sand-100 text-[1.1rem] leading-none text-ink"
                  >
                    +
                  </button>
                </span>
              </div>
            </>
          )}
        </div>

        <div className="flex gap-2">
          {editing.kind === 'item' && (
            <Button type="button" data-testid="as-drawer-remove" onClick={onRemove}>{str.remove}</Button>
          )}
          <Button variant="primary" type="button" data-testid="as-drawer-done" onClick={onClose} className="flex-1">
            {str.done}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
