// The slide show. Full screen, the same renderer as the editor, and the
// controls people already have in their fingers: arrows, space, Page Up/Down
// (which is what a presentation clicker sends), B and W for a black or white
// screen, a number then Enter to jump, Escape to end.
//
// PRESENTER VIEW is the half that matters on a laptop with a projector: the
// audience sees the slide, the speaker sees it too plus the next one, the
// notes and the time. "Present in a separate window" puts the audience's view
// in a second browser window — drag it to the projector — and keeps the
// presenter view here. It is ONE React tree rendered into two documents
// (a portal into the pop-up), so the two cannot disagree about which slide
// is showing.
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { SlideView } from './render'
import type { DeckData, Slide } from './model'
import type { SlStr } from './strings'

const ANIM = `
@keyframes sl-fade{from{opacity:0}to{opacity:1}}
@keyframes sl-push{from{transform:translateY(100%)}to{transform:none}}
@keyframes sl-wipe{from{clip-path:inset(0 100% 0 0)}to{clip-path:inset(0 0 0 0)}}
@keyframes sl-cover{from{transform:translateX(100%)}to{transform:none}}
@keyframes sl-zoom{from{opacity:0;transform:scale(.82)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion: reduce){[data-sl-anim]{animation:none!important}}
`

export function Present({ s, deck, startAt, presenter, popup, onExit, onSlide, locale }: {
  s: SlStr; deck: DeckData; startAt: number; presenter: boolean; popup: Window | null
  onExit: () => void; onSlide?: (slideId: string) => void; locale: 'en' | 'ar'
}) {
  // Hidden slides are skipped — unless the show was started ON one, which means the presenter wants it.
  const order = useMemo(() => deck.slides.map((x, i) => ({ x, i })).filter(({ x, i }) => !x.hidden || i === startAt), [deck.slides, startAt])
  const [pos, setPos] = useState(() => Math.max(0, order.findIndex((o) => o.i === startAt)))
  const [screen, setScreen] = useState<'' | 'black' | 'white' | 'end'>('')
  const [laser, setLaser] = useState(false)
  const [mouse, setMouse] = useState<{ x: number; y: number } | null>(null)
  const [typed, setTyped] = useState('')
  const [t0, setT0] = useState(() => Date.now())
  const [now, setNow] = useState(() => Date.now())
  const [dir, setDir] = useState(1)
  const shell = useRef<HTMLDivElement>(null)
  const ratio = deck.size.w / deck.size.h
  const cur = order[pos]?.x
  const next = order[pos + 1]?.x
  useEffect(() => { const t = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(t) }, [])
  useEffect(() => { if (cur) onSlide?.(cur.id) }, [cur?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const go = useCallback((n: number) => {
    setScreen('')
    if (n >= order.length) { setScreen('end'); return }
    const to = Math.max(0, n)
    setDir(to >= pos ? 1 : -1)
    setPos(to)
  }, [order.length, pos])
  const fwd = useCallback(() => { if (screen === 'end') onExit(); else if (screen) setScreen(''); else go(pos + 1) }, [screen, pos, go, onExit])
  const back = useCallback(() => { if (screen === 'end') { setScreen(''); return } if (screen) setScreen(''); else go(pos - 1) }, [screen, pos, go])

  // Full screen where the browser allows it; the overlay is full-window either way.
  useEffect(() => {
    const el = popup ? popup.document.documentElement : shell.current
    el?.requestFullscreen?.().catch(() => {})
    const onFs = () => { if (!popup && !document.fullscreenElement && fsWas.current) onExit() }
    const fsWas = { current: false }
    const mark = () => { fsWas.current = !!document.fullscreenElement }
    document.addEventListener('fullscreenchange', mark)
    document.addEventListener('fullscreenchange', onFs)
    return () => { document.removeEventListener('fullscreenchange', mark); document.removeEventListener('fullscreenchange', onFs); if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {}) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = e.key
      if (/^\d$/.test(k)) { setTyped((t) => (t + k).slice(-3)); return }
      if (k === 'Enter' && typed) { const n = +typed - 1; setTyped(''); const j = order.findIndex((o) => o.i === n); if (j >= 0) go(j); return }
      if (['ArrowRight', 'ArrowDown', ' ', 'PageDown', 'Enter', 'n', 'N'].includes(k)) { e.preventDefault(); fwd() }
      else if (['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace', 'p', 'P'].includes(k)) { e.preventDefault(); back() }
      else if (k === 'Home') go(0)
      else if (k === 'End') go(order.length - 1)
      else if (k === 'b' || k === 'B' || k === '.') setScreen((x) => (x === 'black' ? '' : 'black'))
      else if (k === 'w' || k === 'W' || k === ',') setScreen((x) => (x === 'white' ? '' : 'white'))
      else if (k === 'l' || k === 'L') setLaser((x) => !x)
      else if (k === 'Escape') { e.preventDefault(); onExit() }
    }
    window.addEventListener('keydown', onKey)
    popup?.addEventListener('keydown', onKey)
    return () => { window.removeEventListener('keydown', onKey); popup?.removeEventListener('keydown', onKey) }
  }, [fwd, back, go, order, typed, onExit, popup])

  // A closed pop-up ends the separate-window show rather than leaving a presenter view with no audience.
  useEffect(() => {
    if (!popup) return
    const t = window.setInterval(() => { if (popup.closed) onExit() }, 500)
    const end = () => onExit()
    popup.addEventListener('beforeunload', end)
    return () => { window.clearInterval(t); popup.removeEventListener('beforeunload', end) }
  }, [popup, onExit])

  const onLink = useCallback((href: string) => {
    if (href === '#next') return fwd()
    if (href.startsWith('#slide:')) { const j = order.findIndex((o) => o.x.id === href.slice(7)); if (j >= 0) go(j); return }
    window.open(href, '_blank', 'noopener')
  }, [fwd, go, order])

  const touch = useRef<{ x: number; y: number } | null>(null)
  const audience = (w: number, h: number, win: Window) => (
    <Audience deck={deck} slide={cur} number={(order[pos]?.i ?? 0) + 1} dir={dir} screen={screen} s={s} w={w} h={h} win={win}
      laser={laser ? mouse : null} onLink={onLink}
      onClick={(e) => { if (e.button === 0) fwd() }} onContext={(e) => { e.preventDefault(); back() }}
      onMouse={(m) => setMouse(m)}
      onTouchStart={(e) => { const t = e.touches[0]; touch.current = { x: t.clientX, y: t.clientY } }}
      onTouchEnd={(e) => { const st = touch.current; touch.current = null; const t = e.changedTouches[0]; if (st && Math.abs(t.clientX - st.x) > 40) { if (t.clientX < st.x) fwd(); else back() } }} />
  )

  const elapsed = Math.max(0, Math.floor((now - t0) / 1000))
  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0'), ss = String(elapsed % 60).padStart(2, '0')
  const slideNo = (order[pos]?.i ?? 0) + 1
  const btn = 'h-9 px-3 rounded-md border border-white/20 bg-white/10 text-white text-[0.85rem] cursor-pointer hover:bg-white/20'

  const presenterUi = (
    <div className="absolute inset-0 grid grid-cols-[minmax(0,3fr)_minmax(260px,2fr)] max-[760px]:grid-cols-1 gap-4 p-4 text-white" dir={locale === 'ar' ? 'rtl' : 'ltr'} data-testid="sl-presenter">
      <div className="min-h-0 flex flex-col gap-3">
        <div className="text-[0.8rem] text-white/60" data-testid="sl-present-count">{s.slideN(slideNo, deck.slides.length)}</div>
        <FitBox ratio={ratio}>{(w, h) => (popup ? <div style={{ width: w, height: h }}><Static deck={deck} slide={cur} number={slideNo} w={w} h={h} screen={screen} /></div> : audience(w, h, window))}</FitBox>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={btn} data-testid="sl-present-prev" onClick={back}>{s.present.prev}</button>
          <button type="button" className={btn} data-testid="sl-present-next" onClick={fwd}>{s.present.next}</button>
          <button type="button" className={btn} aria-pressed={screen === 'black'} onClick={() => setScreen((x) => (x === 'black' ? '' : 'black'))}>{s.present.black}</button>
          <button type="button" className={btn} aria-pressed={laser} onClick={() => setLaser((x) => !x)}>{s.present.laser}</button>
          <button type="button" className={btn} data-testid="sl-present-exit" onClick={onExit}>{s.present.exit}</button>
        </div>
      </div>
      <div className="min-h-0 flex flex-col gap-3">
        <div className="flex items-baseline gap-4 text-[1.6rem] font-mono" dir="ltr">
          <span data-testid="sl-present-timer" title={s.present.timer}>{mm}:{ss}</span>
          <button type="button" className="text-[0.8rem] font-sans text-white/60 border-0 bg-transparent cursor-pointer underline" onClick={() => setT0(Date.now())}>↺</button>
          <span className="ms-auto text-[1rem] text-white/60" title={s.present.clock}>{new Date(now).toLocaleTimeString(locale === 'ar' ? 'ar-SA' : 'en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
        <div className="text-[0.8rem] text-white/60">{s.present.nextSlide}</div>
        <div className="w-full max-w-[420px]">{next ? <SlideView slide={next} width={Math.min(420, 360)} ctx={{ deck, number: (order[pos + 1]?.i ?? 0) + 1 }} testid="sl-present-next-slide" /> : <div className="aspect-video grid place-items-center bg-black/60 text-white/50 text-[0.85rem]">{s.present.endOfShow}</div>}</div>
        <div className="flex-1 min-h-0 overflow-auto rounded-md bg-white/5 p-3 text-[1.15rem] leading-relaxed whitespace-pre-wrap" dir="auto" data-testid="sl-present-notes">{cur?.notes?.trim() || <span className="text-white/40">{s.present.noNotes}</span>}</div>
      </div>
    </div>
  )

  const main = (
    <div ref={shell} className="fixed inset-0 z-[90] bg-[#111] select-none" data-testid="sl-show" data-pos={pos} data-slide={cur?.id} data-screen={screen || undefined}>
      <style>{ANIM}</style>
      {presenter || popup ? presenterUi : <FitBox full ratio={ratio}>{(w, h) => audience(w, h, window)}</FitBox>}
      {typed && <div className="absolute bottom-4 start-4 px-3 py-1 rounded bg-white/15 text-white text-[1.2rem] font-mono" data-testid="sl-goto">{typed}</div>}
    </div>
  )

  return (
    <>
      {createPortal(main, document.body)}
      {popup && createPortal(
        <div className="fixed inset-0 bg-black" data-testid="sl-audience-window"><style>{ANIM}</style><FitBox full win={popup} ratio={ratio}>{(w, h) => audience(w, h, popup)}</FitBox></div>,
        popup.document.body,
      )}
    </>
  )
}

function Audience({ deck, slide, number, dir, screen, s, w, h, laser, onLink, onClick, onContext, onMouse, onTouchStart, onTouchEnd, win }: {
  deck: DeckData; slide?: Slide; number: number; dir: number; screen: string; s: SlStr; w: number; h: number; win: Window
  laser: { x: number; y: number } | null; onLink: (h: string) => void
  onClick: (e: React.MouseEvent) => void; onContext: (e: React.MouseEvent) => void; onMouse: (m: { x: number; y: number } | null) => void
  onTouchStart: (e: React.TouchEvent) => void; onTouchEnd: (e: React.TouchEvent) => void
}) {
  void win
  const kind = slide?.transition?.kind || 'none'
  const dur = slide?.transition?.dur || 600
  return (
    <div style={{ width: w, height: h, position: 'relative', overflow: 'hidden', cursor: laser ? 'none' : 'default' }} data-testid="sl-audience"
      onClick={onClick} onContextMenu={onContext} onMouseMove={(e) => { const r = e.currentTarget.getBoundingClientRect(); onMouse({ x: e.clientX - r.left, y: e.clientY - r.top }) }} onMouseLeave={() => onMouse(null)}
      onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      {slide && <div key={slide.id} data-sl-anim="" style={kind !== 'none' ? { animation: `sl-${kind} ${dur}ms ease ${dir < 0 && (kind === 'push' || kind === 'cover') ? 'reverse' : 'normal'} both`, position: 'absolute', inset: 0 } : { position: 'absolute', inset: 0 }}>
        <SlideView slide={slide} width={w} ctx={{ deck, number, onLink }} testid="sl-show-slide" />
      </div>}
      {screen === 'black' && <div className="absolute inset-0 bg-black" data-testid="sl-black" />}
      {screen === 'white' && <div className="absolute inset-0 bg-white" />}
      {screen === 'end' && <div className="absolute inset-0 bg-black grid place-items-center text-white/70 text-[1rem]" data-testid="sl-end">{s.present.endOfShow}</div>}
      {laser && <div aria-hidden style={{ position: 'absolute', left: laser.x - 7, top: laser.y - 7, width: 14, height: 14, borderRadius: '50%', background: 'radial-gradient(circle, #ff3b3b 0 40%, rgba(255,59,59,0.35) 60%, transparent 70%)', pointerEvents: 'none' }} data-testid="sl-laser" />}
    </div>
  )
}

function Static({ deck, slide, number, w, screen }: { deck: DeckData; slide?: Slide; number: number; w: number; h: number; screen: string }) {
  return <div style={{ position: 'relative' }}>{slide && <SlideView slide={slide} width={w} ctx={{ deck, number }} />}{screen === 'black' && <div className="absolute inset-0 bg-black" />}</div>
}

/** The largest 16:9 (or whatever the deck is) box that fits the space, centred. */
function FitBox({ children, full, win, ratio }: { children: (w: number, h: number) => ReactNode; full?: boolean; win?: Window; ratio: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState({ w: 0, h: 0 })
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const W = (win || window) as Window & typeof globalThis
    const measure = () => setBox({ w: el.clientWidth, h: el.clientHeight })
    measure()
    const ro = new W.ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [win])
  return (
    <div ref={ref} className={full ? 'absolute inset-0 grid place-items-center' : 'relative flex-1 min-h-[200px] grid place-items-center'}>
      {box.w > 0 && (() => { const w = Math.min(box.w, box.h * ratio); return children(Math.floor(w), Math.floor(w / ratio)) })()}
    </div>
  )
}
/** Open the audience window, with this page's styles copied in so the slide looks the same. */
export function openAudienceWindow(title: string): Window | null {
  const w = window.open('', 'bis-slideshow', 'popup,width=1280,height=760')
  if (!w) return null
  w.document.title = title
  w.document.body.style.margin = '0'
  w.document.body.style.background = '#000'
  for (const n of document.querySelectorAll('style, link[rel="stylesheet"]')) w.document.head.appendChild(n.cloneNode(true))
  return w
}
