import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { ALL_ICONS, PALETTE } from './icons'
import { nameKey } from './schedule'
import type { Suggestion } from './store'

const POPOVER =
  'fixed z-50 max-h-[60vh] overflow-auto rounded-md border border-[color:var(--line)] '
  + 'bg-[var(--surface)] shadow-[var(--shadow-lg)] p-1 min-w-[13rem]'

/**
 * Every panel carries `data-nodrag`, and it is load-bearing BECAUSE of the
 * portal.
 *
 * A portal escapes the DOM but NOT the React tree, so a pointerdown inside the
 * palette still bubbles — as a synthetic event — to the block that owns it,
 * which calls `preventDefault()` to start a drag. That suppresses the whole
 * mouse sequence, so the only event the button ever saw was `pointerdown`:
 * every pick and every suggestion silently did nothing while looking perfectly
 * clickable. The block's guard walks up the DOM for `[data-nodrag]`, and the
 * portalled panel is the first thing it finds.
 */
const NODRAG = { 'data-nodrag': '' } as const

/**
 * Pin a panel to its trigger, in VIEWPORT coordinates.
 *
 * It has to be `fixed`, not `absolute`. A day column clips its contents —
 * blocks have to stop at its rounded edge — so an absolutely positioned panel
 * inside a block is cut off by the column, and the icon palette, which is
 * wider than a column, was almost entirely invisible.
 *
 * And `fixed` alone is not enough, which cost a second round: the page wrapper
 * carries `animate-[fadeUp…_both]`, and `animation-fill-mode: both` leaves the
 * final keyframe's `transform` applied FOREVER — an identity matrix, but a
 * transform, which makes that wrapper the containing block for every fixed
 * descendant on the page. The panel was then positioned against the wrapper
 * rather than the viewport and sat 288px above the top of a phone screen. So
 * it goes through a PORTAL to `document.body`, where no ancestor can claim it.
 *
 * It measures itself before deciding, because the choice is "does it fit
 * below" and a panel that has not been laid out has no height to answer with.
 * On a phone the second answer is usually "no", which is exactly the case that
 * was never seen when this was `absolute` and clipped anyway.
 */
function useAnchored(open: boolean, anchor: React.RefObject<HTMLElement | null>) {
  const panel = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)

  useLayoutEffect(() => {
    if (!open) { setPos(null); return }
    const place = () => {
      const a = anchor.current?.getBoundingClientRect()
      const p = panel.current?.getBoundingClientRect()
      if (!a || !p) return
      const gap = 4
      const below = a.bottom + gap
      const wantedTop = below + p.height > window.innerHeight - 8 && a.top - gap - p.height > 8
        ? a.top - gap - p.height
        : below
      // Clamped at BOTH ends. Clamping only the bottom put a tall palette at
      // y = -288 on a phone — off the top of the screen, while every click on
      // it still passed, because the spec was checking the bottom edge too.
      const room = Math.max(8, window.innerHeight - 8 - p.height)
      const top = Math.max(8, Math.min(wantedTop, room))
      // Aligned to the edge the reader starts from, then kept on screen.
      const rtl = document.documentElement.dir === 'rtl'
      const wanted = rtl ? a.right - p.width : a.left
      const left = Math.max(8, Math.min(wanted, window.innerWidth - 8 - p.width))
      setPos({ top, left })
    }
    place()
    window.addEventListener('scroll', place, true)
    window.addEventListener('resize', place)
    return () => {
      window.removeEventListener('scroll', place, true)
      window.removeEventListener('resize', place)
    }
  }, [open, anchor])

  // Hidden until placed, or it flashes at the top-left corner for one frame.
  const style = pos ? { top: pos.top, left: pos.left } : { top: 0, left: 0, visibility: 'hidden' as const }
  return { panel, style }
}

/** The panel itself, lifted out of the tree so nothing can clip or claim it. */
function Floating({ children }: { children: ReactNode }) {
  if (typeof document === 'undefined') return null
  return createPortal(children, document.body)
}

/**
 * The activity name box: free text, with everything this person has ever typed
 * offered underneath it.
 *
 * Two decisions worth keeping.
 *
 * **It opens on FOCUS, not on the first keystroke.** The suggestions are drawn
 * from every saved schedule, so the list is the answer to "what did I call
 * that last term" — a question you cannot type the first letter of, because
 * not remembering the wording is the whole reason you are looking. A list that
 * only appears once you have guessed correctly is a list for somebody who did
 * not need it.
 *
 * **A suggestion carries its icon.** Picking «قرآن» from the list without its
 * 📖 would make the icon memory a thing you had to maintain separately from
 * the thing it is about.
 */
export function NameCombo({
  value, icon, suggestions, placeholder, testId, onPick, onChange, onEnter,
}: {
  value: string
  icon: string
  suggestions: Suggestion[]
  placeholder: string
  testId: string
  onChange: (name: string) => void
  onPick: (s: Suggestion) => void
  /**
   * Enter with no suggestion to take.
   *
   * It adds the next activity below this one, which is what makes filling a
   * day a typing job rather than forty trips to a + button. Enter means "take
   * the highlighted suggestion" while the list is open, so this only fires
   * when there is nothing highlighted to take — one key, two meanings, decided
   * by what is on screen rather than by a modifier nobody would guess.
   */
  onEnter?: () => void
}) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const box = useRef<HTMLDivElement>(null)
  const { panel, style } = useAnchored(open && true, box)

  const matches = useMemo(() => {
    const key = nameKey(value)
    const pool = suggestions.filter((s) => nameKey(s.name) !== key || s.icon !== icon)
    if (!key) return pool.slice(0, 40)
    // Starts-with first: somebody who has typed three letters means a word
    // beginning with them far more often than one merely containing them.
    const starts = pool.filter((s) => nameKey(s.name).startsWith(key))
    const has = pool.filter((s) => !nameKey(s.name).startsWith(key) && nameKey(s.name).includes(key))
    return [...starts, ...has].slice(0, 40)
  }, [suggestions, value, icon])

  // A new list resets the highlight to the top. Without it one more letter
  // leaves the highlight on row 5 of a list that now has two, and Enter picks
  // something the reader never looked at.
  useEffect(() => { setActive(0) }, [matches.length])

  useEffect(() => {
    if (!open) return
    const away = (e: MouseEvent) => {
      const t = e.target as Node
      // The panel is portalled to <body>, so it is NOT inside `box` any more
      // and a click on it would otherwise read as a click away.
      if (box.current?.contains(t) || panel.current?.contains(t)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', away)
    return () => document.removeEventListener('mousedown', away)
  }, [open])

  const choose = (s: Suggestion) => { onPick(s); setOpen(false) }

  return (
    <div className="relative flex-1 min-w-0" ref={box}>
      <input
        value={value}
        placeholder={placeholder}
        data-testid={testId}
        role="combobox"
        aria-expanded={open && matches.length > 0}
        aria-autocomplete="list"
        autoComplete="off"
        onChange={(e) => { onChange(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) { setOpen(true); return }
          if (!matches.length) {
            if (e.key === 'Enter' && onEnter) { e.preventDefault(); onEnter() }
            return
          }
          if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => (i + 1) % matches.length) }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => (i - 1 + matches.length) % matches.length) }
          else if (e.key === 'Enter' && open) { e.preventDefault(); choose(matches[active]) }
          else if (e.key === 'Enter' && onEnter) { e.preventDefault(); onEnter() }
          else if (e.key === 'Escape') setOpen(false)
        }}
        className="w-full bg-transparent border-0 p-1 text-[0.86rem] text-ink focus:outline-none"
      />
      {open && matches.length > 0 && (
        <Floating>
        <div {...NODRAG} ref={panel} style={style} className={POPOVER} role="listbox" data-testid={`${testId}-list`}>
          {matches.map((s, i) => (
            <button
              key={s.name + i}
              type="button"
              role="option"
              aria-selected={i === active}
              data-testid={`${testId}-opt-${i}`}
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setActive(i)}
              onClick={() => choose(s)}
              className={`flex w-full items-center gap-2 rounded-sm px-2 py-1 text-start text-[0.86rem] cursor-pointer border-0 rtl:font-ar
                ${i === active ? 'bg-[color-mix(in_srgb,var(--color-green-600)_12%,transparent)]' : 'bg-transparent'}`}
            >
              <span className="w-5 text-center text-[1rem] leading-none">{s.icon || '·'}</span>
              <span className="flex-1 truncate text-ink">{s.name}</span>
              {s.count > 1 && <span className="text-[0.72rem] text-ink-faint">{s.count}</span>}
            </button>
          ))}
        </div>
        </Floating>
      )}
    </div>
  )
}

/**
 * The icon button and its palette.
 *
 * Choosing here is what TEACHES the memory — every later cell with the same
 * activity name gets this icon, in this schedule and in the next one. So the
 * palette is a place you visit once per activity, which is why it can afford
 * to be a grid of a hundred rather than a tidy dropdown of eight.
 */
export function IconPicker({
  icon, suggested, testId, label, clearLabel, onChoose,
}: {
  icon: string
  /** What the name implies, shown faintly when nothing is chosen. */
  suggested: string
  testId: string
  label: string
  clearLabel: string
  onChoose: (icon: string) => void
}) {
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const { panel, style } = useAnchored(open, box)
  const locale = typeof document !== 'undefined' && document.documentElement.lang === 'ar' ? 'ar' : 'en'

  useEffect(() => {
    if (!open) return
    const away = (e: MouseEvent) => {
      const t = e.target as Node
      // The panel is portalled to <body>, so it is NOT inside `box` any more
      // and a click on it would otherwise read as a click away.
      if (box.current?.contains(t) || panel.current?.contains(t)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', away)
    return () => document.removeEventListener('mousedown', away)
  }, [open])

  const shown = icon || suggested

  return (
    <div className="relative shrink-0" ref={box}>
      <button
        type="button"
        title={label}
        aria-label={label}
        data-testid={testId}
        onClick={() => setOpen((o) => !o)}
        // Borderless until you reach for it: on a finished sheet the icon is a
        // picture, not a control, and forty-five little outlined buttons read
        // as chrome laid over the schedule.
        className={`grid size-7 place-items-center rounded-sm border border-transparent bg-transparent text-[1.05rem] leading-none cursor-pointer
          hover:border-[color:var(--line)] hover:bg-[var(--surface)]
          focus-visible:border-[color:var(--line)] focus-visible:bg-[var(--surface)]
          ${icon ? '' : 'opacity-50'}`}
      >
        {shown || '+'}
      </button>
      {open && (
        <Floating>
        <div {...NODRAG} ref={panel} style={style} className={`${POPOVER} w-[17rem]`} data-testid={`${testId}-palette`}>
          {PALETTE.map((g) => (
            <div key={g.group} className="px-1 pb-1">
              <div className="px-1 py-1 text-[0.72rem] font-semibold text-ink-faint rtl:font-ar">
                {locale === 'ar' ? g.groupAr : g.group}
              </div>
              <div className="grid grid-cols-9 gap-[2px]">
                {g.icons.map((em) => (
                  <button
                    key={em}
                    type="button"
                    data-testid={`${testId}-pick-${em}`}
                    onClick={() => { onChoose(em); setOpen(false) }}
                    className={`grid aspect-square place-items-center rounded-sm border-0 text-[1.05rem] cursor-pointer
                      ${em === icon ? 'bg-[color-mix(in_srgb,var(--color-green-600)_18%,transparent)]' : 'bg-transparent hover:bg-sand-100'}`}
                  >
                    {em}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <button
            type="button"
            data-testid={`${testId}-clear`}
            onClick={() => { onChoose(''); setOpen(false) }}
            className="m-1 rounded-sm border border-[color:var(--line)] bg-transparent px-2 py-1 text-[0.78rem] text-ink-soft cursor-pointer rtl:font-ar"
          >
            {clearLabel}
          </button>
        </div>
        </Floating>
      )}
    </div>
  )
}

export const ICON_COUNT = ALL_ICONS.length
