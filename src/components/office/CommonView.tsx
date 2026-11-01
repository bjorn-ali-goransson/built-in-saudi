import { useEffect, useRef, useState, type ReactNode } from 'react'

// In a live session everybody looks at the same document through a screen of
// their own size. This dims the part of OUR document area that is not on
// everybody's screen, the way the call's whiteboard dims what is not in the
// common view: the clear rectangle is as wide as the narrowest screen in the
// session and as tall as the shortest.
//
// It covers the document area only, never the ribbon, and it is drawn over a
// wrapper that does not scroll, so it stays put while the document moves.
//
// Each person's area travels with their presence (`vw`, merged in by
// useCollab's sendPresence), so it needs no message of its own.

export type CommonViewCollab = {
  state: string
  presence: Record<string, { d: unknown; at: number }>
  roster: { client: string }[]
  me: string
  setViewSize: (w: number, h: number) => void
}

/** Where the document sits in its area, which is where everybody's screen
 *  agrees: a page is centred across, a sheet starts at the top and the start. */
export type Anchor = { x: 'center' | 'start'; y: 'center' | 'start' }

export function CommonView({ collab, anchor, className, children }: { collab: CommonViewCollab; anchor: Anchor; className?: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState<[number, number] | null>(null)
  const live = collab.state === 'live'
  const report = useRef(collab.setViewSize); report.current = collab.setViewSize
  useEffect(() => {
    const el = ref.current; if (!el) return
    const measure = () => { const w = Math.round(el.clientWidth), h = Math.round(el.clientHeight); setSize((s) => (s && s[0] === w && s[1] === h ? s : [w, h])) }
    measure()
    const ro = new ResizeObserver(measure); ro.observe(el)
    return () => ro.disconnect()
  }, [])
  useEffect(() => { if (size && live) report.current(size[0], size[1]) }, [size, live])

  let fade: { w: number; h: number } | null = null
  if (size && live) {
    const here = new Set(collab.roster.map((r) => r.client))
    let w = size[0], h = size[1], others = 0
    for (const [client, p] of Object.entries(collab.presence)) {
      if (client === collab.me || !here.has(client)) continue
      const vw = (p.d as { vw?: unknown } | null)?.vw
      if (!Array.isArray(vw) || typeof vw[0] !== 'number' || typeof vw[1] !== 'number') continue
      others++; w = Math.min(w, vw[0]); h = Math.min(h, vw[1])
    }
    // Under a couple of pixels is rounding, not a smaller screen.
    if (others && (size[0] - w > 2 || size[1] - h > 2)) fade = { w, h }
  }
  const x = fade && size ? (anchor.x === 'center' ? (size[0] - fade.w) / 2 : 0) : 0
  const y = fade && size ? (anchor.y === 'center' ? (size[1] - fade.h) / 2 : 0) : 0
  return (
    <div ref={ref} className={`relative ${className || ''}`}>
      {children}
      {fade && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-[4]" aria-hidden="true">
          <div data-testid="office-common-view" data-w={fade.w} data-h={fade.h} className="absolute"
            style={{ insetInlineStart: x, top: y, width: fade.w, height: fade.h, boxShadow: '0 0 0 9999px color-mix(in srgb, var(--ink) 38%, transparent)' }} />
        </div>
      )}
    </div>
  )
}
