import { useEffect, useRef, useState, type RefObject } from 'react'
import type { ToolSection } from '../lib/toolSections'

/**
 * A jump bar for the catalogue's sections.
 *
 * MEASURED, not assumed: the home catalogue is **7.4 screens on desktop and
 * 9.6 on mobile**, and the last section starts at screen 9. Every one of the
 * sixteen headings was reachable only by scrolling to it, from wherever you
 * happened to be — so browsing to `Design` cost nine screens, and browsing back
 * cost nine more. Search was the only fast path, which makes the catalogue a
 * fallback for people who already know the word for what they want.
 *
 * It sticks BELOW the header (which is itself sticky at 68/60px) so the jump is
 * available from the bottom of the page, not only from the top. That is the
 * whole point: a jump list you have to scroll to the top to use saves nothing.
 *
 * "You are here" is what separates this from a row of links, and it has to
 * survive being scrolled past as well as jumped to. It is computed as **the
 * last section whose heading has crossed the line under the bars**, recomputed
 * on scroll. An IntersectionObserver picking the topmost intersecting section
 * was tried first and is subtly wrong: sections here are several screens tall,
 * so the one ABOVE the one you are reading is usually still intersecting and
 * still topmost, and the chip lags a whole section behind. Caught by the spec.
 *
 * `scrollRef` is what makes it work in the AppLauncher too: that surface scrolls
 * its own overlay container rather than the window, so both the observer root
 * and the jump have to be told about it. Without it the bar would be inert in
 * exactly the place a 9-screen list is most cramped.
 */
/** Fades the edge the chips continue past — logical, so it flips under RTL. */
const EDGE_MASK: Record<string, string> = {
  none: '',
  end: '[mask-image:linear-gradient(to_right,black_calc(100%_-_2.5rem),transparent)] rtl:[mask-image:linear-gradient(to_left,black_calc(100%_-_2.5rem),transparent)]',
  start: '[mask-image:linear-gradient(to_left,black_calc(100%_-_2.5rem),transparent)] rtl:[mask-image:linear-gradient(to_right,black_calc(100%_-_2.5rem),transparent)]',
  both: '[mask-image:linear-gradient(to_right,transparent,black_2.5rem,black_calc(100%_-_2.5rem),transparent)]',
}

export function SectionNav({ sections, scrollRef }: { sections: ToolSection[]; scrollRef?: RefObject<HTMLElement | null> }) {
  const [active, setActive] = useState(sections[0]?.key ?? '')
  // 'none' | 'end' | 'both' | 'start' — which edges have more chips past
  // them. Exposed as an attribute so the styling is CSS and the CONTRACT is
  // testable: asserting a mask-image string would be testing Tailwind.
  const [edges, setEdges] = useState<'none' | 'end' | 'both' | 'start'>('none')
  const barRef = useRef<HTMLDivElement>(null)
  const chipRefs = useRef<Record<string, HTMLButtonElement | null>>({})

  useEffect(() => {
    const root = scrollRef?.current ?? null
    // NOT a `[data-testid^="section-"]` prefix match: this bar is
    // `section-nav` and its chips are `section-nav-<key>`, so that selector
    // watched the bar and every chip too, and nothing ever lit up.
    const scope: ParentNode = root ?? document
    // The line sits just under the sticky bar(s): a section is current once its
    // heading has gone under them, not when its last pixel leaves the screen.
    const line = root ? 70 : 150
    let frame = 0
    const measure = () => {
      frame = 0
      const els = [...scope.querySelectorAll<HTMLElement>('[data-section]')]
      if (!els.length) return
      const base = root ? root.getBoundingClientRect().top : 0
      let current = els[0]
      for (const el of els) {
        if (el.getBoundingClientRect().top - base <= line) current = el
      }
      const key = current.dataset.section
      if (key) setActive(key)
    }
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(measure) }
    const target: HTMLElement | Window = root ?? window
    target.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll, { passive: true })
    measure()
    return () => {
      if (frame) cancelAnimationFrame(frame)
      target.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [sections, scrollRef])

  /**
   * Which edges the chip row continues past.
   *
   * Measured at 217 tools: the bar is **1417px of chips in a 355px window on a
   * phone** — three quarters of the sections off-screen, in a row with nothing
   * to say it scrolls. A horizontally scrollable strip with no edge affordance
   * is a well-known way to hide half a menu, and this one exists precisely to
   * stop the catalogue hiding things.
   */
  useEffect(() => {
    const bar = barRef.current
    if (!bar) return
    const read = () => {
      const more = bar.scrollWidth - bar.clientWidth
      if (more <= 4) { setEdges('none'); return }
      const atStart = bar.scrollLeft <= 4
      const atEnd = bar.scrollLeft >= more - 4
      setEdges(atStart ? 'end' : atEnd ? 'start' : 'both')
    }
    read()
    bar.addEventListener('scroll', read, { passive: true })
    window.addEventListener('resize', read, { passive: true })
    return () => {
      bar.removeEventListener('scroll', read)
      window.removeEventListener('resize', read)
    }
  }, [sections])

  // Keep the active chip in view in the bar's own horizontal scroll — on a
  // phone the later sections are off the right edge, so without this the
  // indicator points at something you cannot see.
  useEffect(() => {
    const chip = chipRefs.current[active]
    const bar = barRef.current
    if (!chip || !bar) return
    const c = chip.getBoundingClientRect()
    const b = bar.getBoundingClientRect()
    if (c.left < b.left || c.right > b.right) {
      bar.scrollTo({ left: chip.offsetLeft - bar.clientWidth / 2 + chip.clientWidth / 2, behavior: 'smooth' })
    }
  }, [active])

  const jump = (key: string) => {
    const root = scrollRef?.current ?? null
    const scope: ParentNode = root ?? document
    const el = scope.querySelector(`[data-section="${CSS.escape(key)}"]`)
    if (!el) return
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const behavior: ScrollBehavior = reduced ? 'auto' : 'smooth'
    // scrollIntoView would put the heading underneath the sticky bar(s).
    if (root) {
      const y = el.getBoundingClientRect().top - root.getBoundingClientRect().top + root.scrollTop - 56
      root.scrollTo({ top: Math.max(0, y), behavior })
    } else {
      const y = el.getBoundingClientRect().top + window.scrollY - 124
      window.scrollTo({ top: Math.max(0, y), behavior })
    }
    setActive(key)
  }

  if (sections.length < 3) return null

  return (
    <div
      ref={barRef}
      data-testid="section-nav"
      data-scroll={edges}
      // Squared and docked under the header rather than a floating rounded
      // card, per the design principles. It stays inside the content column: a
      // full-bleed bar out of a padded container is how you get a page that
      // scrolls sideways on a phone, and only the bar itself may do that.
      // The mask is a MASK, not a background gradient: the design rule against
      // gradients is about decoration, and this is the only thing telling a
      // phone user that three quarters of the sections are off to one side.
      className={`sticky z-30 mb-6 ${scrollRef ? 'top-0' : 'top-[68px] max-[560px]:top-[60px]'} flex gap-1.5 overflow-x-auto whitespace-nowrap border-b border-[color:var(--line-soft)] bg-[color-mix(in_srgb,var(--sand-50)_88%,transparent)] backdrop-blur-[10px] py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${EDGE_MASK[edges]}`}
      role="navigation"
      aria-label="Sections"
    >
      {sections.map((sec) => (
        <button
          key={sec.key}
          ref={(el) => { chipRefs.current[sec.key] = el }}
          type="button"
          data-testid={`section-nav-${sec.key}`}
          aria-current={active === sec.key ? 'true' : undefined}
          onClick={() => jump(sec.key)}
          className={`flex-none rounded-md border px-[0.7rem] py-[0.3rem] text-[0.82rem] transition-[background,color,border-color] duration-150 rtl:font-ar ${
            active === sec.key
              ? 'border-green-700 bg-green-600 text-[color:var(--primary-ink)]'
              : 'border-[color:var(--line)] bg-[var(--surface)] text-ink-soft hover:border-[color-mix(in_srgb,var(--green-500)_35%,transparent)] hover:text-ink'
          }`}
        >
          {sec.title}
        </button>
      ))}
    </div>
  )
}
