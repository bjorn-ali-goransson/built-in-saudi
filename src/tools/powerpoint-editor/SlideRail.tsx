// The strip of slide thumbnails: pick one, drag to reorder, and the slide's own
// menu. Each thumbnail is the real renderer at a small width, so it cannot show
// a slide that is not there.
import { useRef, useState } from 'react'
import { SlideView } from './render'
import { slideTitle, type DeckData } from './model'
import type { SlStr } from './strings'

export interface RailPeer { client: string; name: string; color: string; slide: string }

export function SlideRail({ s, deck, current, onPick, onMove, onMenu, peers, readOnly, horizontal }: {
  s: SlStr; deck: DeckData; current: string
  onPick: (id: string) => void
  onMove: (id: string, toIndex: number) => void
  onMenu: (e: React.MouseEvent | { clientX: number; clientY: number }, id: string) => void
  peers: RailPeer[]; readOnly: boolean; horizontal: boolean
}) {
  const [drag, setDrag] = useState<{ id: string; over: number } | null>(null)
  const list = useRef<HTMLDivElement>(null)
  const W = horizontal ? 128 : 168
  const indexAt = (cx: number, cy: number) => {
    const items = [...(list.current?.querySelectorAll<HTMLElement>('[data-thumb]') || [])]
    for (let i = 0; i < items.length; i++) {
      const r = items[i].getBoundingClientRect()
      if (horizontal ? cx < r.left + r.width / 2 : cy < r.top + r.height / 2) return i
    }
    return items.length
  }
  return (
    <div ref={list} data-testid="sl-rail" className={horizontal ? 'flex-none flex gap-2 overflow-x-auto px-2 py-2 border-t border-[color:var(--line-soft)] bg-[var(--surface)]' : 'flex-none w-[200px] overflow-y-auto py-2 px-2 border-e border-[color:var(--line-soft)] bg-[var(--surface)] '}
      onPointerMove={(e) => { if (drag) setDrag({ ...drag, over: indexAt(e.clientX, e.clientY) }) }}
      onPointerUp={() => { if (drag) { const from = deck.slides.findIndex((x) => x.id === drag.id); if (drag.over !== from && drag.over !== from + 1) onMove(drag.id, drag.over); setDrag(null) } }}
      onKeyDown={(e) => {
        const i = deck.slides.findIndex((x) => x.id === current)
        if (e.key === 'ArrowDown' || e.key === 'ArrowRight') { e.preventDefault(); const n = deck.slides[Math.min(deck.slides.length - 1, i + 1)]; if (n) onPick(n.id) }
        if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') { e.preventDefault(); const n = deck.slides[Math.max(0, i - 1)]; if (n) onPick(n.id) }
      }}
    >
      {deck.slides.map((sl, i) => {
        const here = peers.filter((p) => p.slide === sl.id)
        return (
          <div key={sl.id} className="relative">
            {drag && drag.over === i && <div className={horizontal ? 'absolute -start-1.5 top-0 bottom-0 w-[3px] bg-green-600 rounded' : 'absolute -top-1.5 inset-x-0 h-[3px] bg-green-600 rounded'} />}
            <button
              type="button"
              data-thumb=""
              data-testid="sl-thumb"
              data-id={sl.id}
              data-current={sl.id === current ? '1' : '0'}
              aria-label={`${i + 1}. ${slideTitle(sl)}`}
              aria-current={sl.id === current ? 'true' : undefined}
              onClick={() => onPick(sl.id)}
              onPointerDown={(e) => { if (!readOnly && e.button === 0) { const id = sl.id; const sx = e.clientX, sy = e.clientY; const mv = (ev: PointerEvent) => { if (Math.hypot(ev.clientX - sx, ev.clientY - sy) > 6) { setDrag({ id, over: i }); window.removeEventListener('pointermove', mv) } }; window.addEventListener('pointermove', mv); window.addEventListener('pointerup', () => window.removeEventListener('pointermove', mv), { once: true }) } }}
              onContextMenu={(e) => { e.preventDefault(); onMenu(e, sl.id) }}
              className={`flex items-start gap-1.5 ${horizontal ? '' : 'w-full mb-2'} p-1 rounded-md border-0 bg-transparent cursor-pointer text-start ${sl.id === current ? 'bg-[color-mix(in_srgb,var(--color-green-600)_12%,transparent)]' : 'hover:bg-[color-mix(in_srgb,var(--ink)_5%,transparent)]'}`}
            >
              {!horizontal && <span className="w-4 pt-1 text-[0.72rem] text-ink-faint text-end">{i + 1}</span>}
              <span className={`relative block rounded-sm overflow-hidden ${sl.id === current ? 'ring-2 ring-green-600' : 'ring-1 ring-[color:var(--line)]'} ${sl.hidden ? 'opacity-45' : ''}`}>
                <SlideView slide={sl} width={W} ctx={{ deck, number: i + 1 }} />
                {sl.hidden && <span className="absolute inset-0 grid place-items-center text-[0.7rem] text-ink-soft" data-testid="sl-thumb-hidden">⊘</span>}
                {here.length > 0 && <span className="absolute top-1 end-1 flex gap-0.5">{here.map((p) => <span key={p.client} title={p.name} className="size-3 rounded-full ring-1 ring-white" style={{ background: p.color }} />)}</span>}
              </span>
            </button>
          </div>
        )
      })}
      {drag && drag.over === deck.slides.length && <div className={horizontal ? 'w-[3px] bg-green-600 rounded' : 'h-[3px] bg-green-600 rounded'} />}
      <span className="sr-only">{s.slides}</span>
    </div>
  )
}
