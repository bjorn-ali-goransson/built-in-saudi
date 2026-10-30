// Drawing a slide. ONE renderer for the editing canvas, the thumbnails, the
// slide show and printing — so the slide you edit is the slide you present and
// the page you print, by construction rather than by care.
//
// A slide is laid out in its own units (points, used as CSS pixels) and the
// whole thing is scaled with one transform. Text is HTML, not SVG text, because
// HTML is what wraps, shapes Arabic and runs bidi correctly; shapes are SVG
// paths behind it.
import { memo, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { presetPath, textRect, isLine, custPathD } from './geom'
import { runSize, runColor, fontName, isBold, cellLook, borderColor, tableGrid, bulletLabel } from './look'
import { paint, promptFor, type DeckData, type El, type Fill, type ImageEl, type Line, type Para, type ShapeEl, type Slide, type TableEl, type TextBody, type Theme, type LayoutWords } from './model'

export interface RenderCtx {
  deck: DeckData
  /** Slide number (1-based) for ‹#› fields. */
  number: number
  /** Draw the grey prompts in empty placeholders (only while editing). */
  prompts?: LayoutWords
  /** Links are live (in the slide show). */
  onLink?: (href: string) => void
  /** Element being text-edited: drawn without its text, the editor sits on top. */
  editing?: string
}

const uid = (() => { let n = 0; return () => `g${(++n).toString(36)}` })()

export function fillCss(f: Fill | undefined, theme: Theme, deck: DeckData): string | undefined {
  if (!f || f.type === 'none') return undefined
  if (f.type === 'solid') return withAlpha(paint(f.color, theme), f.alpha)
  if (f.type === 'grad') return `linear-gradient(${f.angle + 90}deg, ${f.stops.map((s) => `${paint(s.color, theme)} ${Math.round(s.pos * 100)}%`).join(', ')})`
  const m = deck.media[f.media]
  return m ? `center / cover no-repeat url("${m.data}")` : undefined
}
function withAlpha(hex: string, a?: number): string {
  if (a === undefined || a >= 1) return hex
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`
}

export const SlideView = memo(function SlideView({ slide, ctx, width, style, children, testid }: { slide: Slide; ctx: RenderCtx; width: number; style?: CSSProperties; children?: ReactNode; testid?: string }) {
  const { deck } = ctx
  const S = deck.size
  const k = width / S.w
  const master = slide.master ? deck.masters?.find((m) => m.id === slide.master) : undefined
  const bg = fillCss(slide.bg || master?.bg, deck.theme, deck) || paint('lt1', deck.theme)
  return (
    <div data-testid={testid} style={{ width, height: S.h * k, position: 'relative', overflow: 'hidden', ...style }} dir="ltr">
      <div style={{ width: S.w, height: S.h, transform: `scale(${k})`, transformOrigin: '0 0', position: 'absolute', inset: 0, background: bg }}>
        {master && !slide.bg && null}
        {master?.elements.map((e) => <ElementView key={'m' + e.id} el={e} ctx={ctx} slide={slide} decor />)}
        {slide.elements.map((e, i) => <ElementView key={e.id} el={e} ctx={ctx} slide={slide} index={i} />)}
        {children}
      </div>
    </div>
  )
})

export function ElementView({ el, ctx, slide, decor, index = 0 }: { el: El; ctx: RenderCtx; slide: Slide; decor?: boolean; index?: number }) {
  const box: CSSProperties = {
    position: 'absolute', left: el.x, top: el.y, width: Math.max(el.w, 0.01), height: Math.max(el.h, 0.01),
    transform: el.rot ? `rotate(${el.rot}deg)` : undefined, transformOrigin: 'center',
  }
  const common = { 'data-el': decor ? undefined : el.id, 'data-kind': el.kind, style: box }
  if (el.kind === 'image') return <div {...common}><Picture el={el} deck={ctx.deck} /></div>
  if (el.kind === 'table') return <div {...common}><Table el={el} ctx={ctx} /></div>
  return (
    <div {...common} data-geom={el.geom}>
      <ShapeSvg el={el} theme={ctx.deck.theme} deck={ctx.deck} />
      {(el.text || el.ph) && ctx.editing !== el.id && <TextView el={el} ctx={ctx} slide={slide} index={index} />}
    </div>
  )
}

function ShapeSvg({ el, theme, deck }: { el: ShapeEl; theme: Theme; deck: DeckData }) {
  const id = useRef(uid()).current
  const line = isLine(el.geom)
  const ln: Line | null | undefined = el.line === undefined ? (line ? { color: 'dk1', width: 1.5 } : undefined) : el.line
  const f = line ? undefined : el.fill
  const sw = ln ? ln.width ?? 0.75 : 0
  const pad = Math.max(sw, line ? 12 : 0)
  const w = el.w
  const h = el.h
  const d = presetPath(el.geom, w, h, el.adj)
  let fillAttr = 'none'
  let defs: ReactNode = null
  if (f?.type === 'solid') fillAttr = withAlpha(paint(f.color, theme), f.alpha)
  else if (f?.type === 'grad') {
    const a = (f.angle * Math.PI) / 180
    defs = <linearGradient id={id} x1={0.5 - Math.cos(a) / 2} y1={0.5 - Math.sin(a) / 2} x2={0.5 + Math.cos(a) / 2} y2={0.5 + Math.sin(a) / 2}>{f.stops.map((s, i) => <stop key={i} offset={s.pos} stopColor={paint(s.color, theme)} />)}</linearGradient>
    fillAttr = `url(#${id})`
  } else if (f?.type === 'image' && deck.media[f.media]) {
    defs = <pattern id={id} patternUnits="userSpaceOnUse" width={w} height={h}><image href={deck.media[f.media].data} width={w} height={h} preserveAspectRatio="xMidYMid slice" /></pattern>
    fillAttr = `url(#${id})`
  }
  const dash = ln?.dash === 'dash' ? `${sw * 4} ${sw * 3}` : ln?.dash === 'dot' ? `${sw} ${sw * 2}` : ln?.dash === 'dashDot' ? `${sw * 4} ${sw * 2} ${sw} ${sw * 2}` : ln?.dash === 'lgDash' ? `${sw * 8} ${sw * 3}` : undefined
  const marker = (end: 'head' | 'tail') => {
    const t = ln?.[end]
    if (!t || t === 'none') return null
    const mid = `${id}-${end}`
    const shape = t === 'oval' ? <circle cx={5} cy={5} r={4} /> : t === 'diamond' ? <path d="M5 0 L10 5 L5 10 L0 5 Z" /> : t === 'arrow' ? <path d="M0 0 L10 5 L0 10" fill="none" stroke={paint(ln!.color || 'dk1', theme)} strokeWidth={1.6} /> : <path d="M0 0 L10 5 L0 10 Z" />
    return <marker id={mid} viewBox="0 0 10 10" refX={t === 'oval' || t === 'diamond' ? 5 : 9} refY={5} markerWidth={3.5} markerHeight={3.5} orient={end === 'head' ? 'auto-start-reverse' : 'auto'} fill={paint(ln!.color || 'dk1', theme)}>{shape}</marker>
  }
  // maxWidth 'none' overrides the site's `svg { max-width: 100% }` reset: the SVG is padded past its
  // box for the line's width and arrowheads, and squeezed back into the box a vertical line (0 wide)
  // vanished and every other line was drawn slightly narrow.
  const flip = el.flipH || el.flipV ? `translate(${el.flipH ? w : 0} ${el.flipV ? h : 0}) scale(${el.flipH ? -1 : 1} ${el.flipV ? -1 : 1})` : undefined
  return (
    <svg width={w + pad * 2} height={h + pad * 2} viewBox={`${-pad} ${-pad} ${w + pad * 2} ${h + pad * 2}`} style={{ position: 'absolute', left: -pad, top: -pad, overflow: 'visible', maxWidth: 'none', filter: el.shadow ? 'drop-shadow(0 2px 4px rgba(0,0,0,0.35))' : undefined, pointerEvents: 'none' }} aria-hidden>
      {(defs || ln?.head || ln?.tail) && <defs>{defs}{marker('head')}{marker('tail')}</defs>}
      {(el.cust ? custPathD(el.cust, w, h) : [d]).map((pd, i, all) => (
        <path key={i} d={pd} transform={flip} fill={el.cust?.[i].fill === false ? 'none' : fillAttr} fillRule="evenodd" stroke={ln && el.cust?.[i].stroke !== false ? paint(ln.color || 'dk1', theme) : 'none'} strokeWidth={sw} strokeDasharray={dash} strokeLinejoin="round"
          markerStart={i === 0 && ln?.head && ln.head !== 'none' ? `url(#${id}-head)` : undefined} markerEnd={i === all.length - 1 && ln?.tail && ln.tail !== 'none' ? `url(#${id}-tail)` : undefined} vectorEffect="non-scaling-stroke" />
      ))}
    </svg>
  )
}

function Picture({ el, deck }: { el: ImageEl; deck: DeckData }) {
  const m = deck.media[el.media]
  const c = el.crop || { l: 0, t: 0, r: 0, b: 0 }
  const fw = el.w / Math.max(0.01, 1 - c.l - c.r)
  const fh = el.h / Math.max(0.01, 1 - c.t - c.b)
  const clip = el.geom && el.geom !== 'rect' ? `path('${presetPath(el.geom, el.w, el.h)}')` : undefined
  const ln = el.line
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', clipPath: clip, transform: el.flipH || el.flipV ? `scale(${el.flipH ? -1 : 1}, ${el.flipV ? -1 : 1})` : undefined, outline: ln ? `${ln.width ?? 0.75}px solid ${paint(ln.color || 'dk1', deck.theme)}` : undefined, outlineOffset: ln ? -(ln.width ?? 0.75) : undefined }}>
      {m ? <img src={m.data} alt={el.alt || ''} draggable={false} style={{ position: 'absolute', left: -c.l * fw, top: -c.t * fh, width: fw, height: fh, maxWidth: 'none', userSelect: 'none' }} />
        : <div style={{ position: 'absolute', inset: 0, background: '#ddd' }} />}
    </div>
  )
}

function Table({ el, ctx }: { el: TableEl; ctx: RenderCtx }) {
  const { xs, ys } = tableGrid(el)
  const theme = ctx.deck.theme
  const bc = borderColor(el, theme)
  const cells: ReactNode[] = []
  el.rows.forEach((row, r) => row.cells.forEach((cell, c) => {
    if (cell.merged) return
    const [rs, cs] = cell.span || [1, 1]
    const x0 = xs[c], x1 = xs[Math.min(xs.length - 1, c + cs)]
    const y0 = ys[r], y1 = ys[Math.min(ys.length - 1, r + rs)]
    const look = cellLook(el, r, c, theme)
    const tb: TextBody = { ...cell.text, inset: cell.text.inset || [5, 3.6, 5, 3.6], defaults: { size: 14, ...cell.text.defaults, ...(look.color ? { color: look.color } : {}), ...(look.bold ? { b: true } : {}) } }
    cells.push(
      <div key={`${r}:${c}`} data-cell={`${r}:${c}`} style={{ position: 'absolute', left: x0, top: y0, width: x1 - x0, height: y1 - y0, background: look.fill, boxShadow: `inset 0 0 0 0.75px ${bc}`, overflow: 'hidden' }}>
        <TextBlock body={tb} ctx={ctx} />
      </div>,
    )
  }))
  return <div style={{ position: 'absolute', inset: 0 }}>{cells}</div>
}

function TextView({ el, ctx, slide, index }: { el: ShapeEl; ctx: RenderCtx; slide: Slide; index: number }) {
  const r = textRect(el.geom, el.w, el.h)
  const tb = el.text || { paras: [{ runs: [] }] }
  const empty = !tb.paras.some((p) => p.runs.some((x) => x.t))
  const prompt = empty && ctx.prompts && el.ph ? promptFor(el.ph, slide.layout, ctx.prompts, index) : ''
  if (empty && !prompt) return null
  return (
    <div style={{ position: 'absolute', left: r.x, top: r.y, width: r.w, height: r.h }}>
      <TextBlock body={tb} ctx={ctx} prompt={prompt} autoShrink={tb.autofit === 'shrink'} />
    </div>
  )
}

/** A text body laid out in the box it is given. Shared with the in-place editor's measuring. */
export function TextBlock({ body, ctx, prompt, autoShrink }: { body: TextBody; ctx: RenderCtx; prompt?: string; autoShrink?: boolean }) {
  const inner = useRef<HTMLDivElement>(null)
  const outer = useRef<HTMLDivElement>(null)
  const [fit, setFit] = useState(body.fontScale || 1)
  // Shrink-to-fit is MEASURED here rather than trusted from the file, so text typed
  // in this editor fits too. A few halving steps converge well within a frame.
  useLayoutEffect(() => {
    if (!autoShrink) { setFit(1); return }
    const o = outer.current, i = inner.current
    if (!o || !i) return
    let lo = 0.3, hi = 1
    const fits = (s: number) => { i.style.setProperty('--fit', String(s)); return i.scrollHeight <= o.clientHeight + 0.5 }
    let best = 1
    if (!fits(1)) {
      for (let n = 0; n < 7; n++) { const m = (lo + hi) / 2; if (fits(m)) lo = m; else hi = m }
      best = Math.round(lo * 1000) / 1000
    }
    i.style.setProperty('--fit', String(best))
    setFit(best)
  })
  const ins = body.inset || [7.2, 3.6, 7.2, 3.6]
  const theme = ctx.deck.theme
  const justify = body.anchor === 'ctr' ? 'center' : body.anchor === 'b' ? 'flex-end' : 'flex-start'
  const counters: number[] = []
  // Text that does not fit spills out of its box, as it does in PowerPoint ("do not autofit").
  // Clipping it hid the second line of half the labels in a dense diagram.
  return (
    <div ref={outer} style={{ position: 'absolute', inset: 0, padding: `${ins[1]}px ${ins[2]}px ${ins[3]}px ${ins[0]}px`, display: 'flex', flexDirection: 'column', justifyContent: justify, overflow: autoShrink ? 'hidden' : 'visible', overflowWrap: 'anywhere', whiteSpace: body.wrap === false ? 'pre' : 'pre-wrap' }}>
      <div ref={inner} style={{ ['--fit' as string]: String(fit) }} data-fit={fit}>
        {prompt ? <p dir="auto" style={{ margin: 0, color: '#8a8a8a', fontSize: fz(body.defaults?.size || 18), fontFamily: fontName(undefined, body, theme), fontWeight: body.defaults?.b ? 700 : 400, textAlign: alignCss(body.defaults?.align) }} data-testid="sl-prompt">{prompt}</p>
          : body.paras.map((p, i) => {
            const lvl = p.level || 0
            if (p.bullet === 'number') { counters[lvl] = (counters[lvl] || 0) + 1; counters.length = lvl + 1 } else counters.length = lvl
            return <ParaView key={i} p={p} body={body} theme={theme} ctx={ctx} n={counters[lvl] || 1} />
          })}
      </div>
    </div>
  )
}

/** A length that follows the shrink-to-fit scale, which the measuring loop drives through one variable. */
const fz = (n: number) => `calc(${n}px * var(--fit, 1))`
const alignCss = (a?: string) => (a === 'ctr' ? 'center' : a === 'r' ? 'end' : a === 'just' ? 'justify' : 'start')

function ParaView({ p, body, theme, ctx, n }: { p: Para; body: TextBody; theme: Theme; ctx: RenderCtx; n: number }) {
  const size = runSize(p.runs[0], p, body)
  const lvl = p.level || 0
  const bullet = p.bullet ? bulletLabel(p, n, !!p.rtl) : null
  const hang = bullet ? size * 1.15 : 0
  const align = alignCss(p.align ?? body.defaults?.align)
  const style: CSSProperties = {
    margin: 0, marginInlineStart: fz(lvl * 28 + hang), textIndent: fz(-hang), textAlign: align as CSSProperties['textAlign'],
    lineHeight: p.lineSpacing ? (p.lineSpacing / 100) * 1.2 : 1.2,
    paddingTop: fz(p.spaceBefore || 0), paddingBottom: fz(p.spaceAfter ?? 0),
    fontSize: fz(size), minHeight: fz(size * 1.2),
  }
  const runs = p.runs.length ? p.runs : []
  return (
    <p dir={p.rtl ? 'rtl' : 'auto'} style={style}>
      {bullet && <span style={{ display: 'inline-block', width: fz(hang), textIndent: 0, color: runColor(p.runs[0], body, theme) }} aria-hidden>{bullet}</span>}
      {runs.map((r, i) => {
        const t = r.t === '‹#›' ? String(ctx.number) : r.t
        const rs = runSize(r, p, body) * (r.sup || r.sub ? 0.7 : 1)
        const st: CSSProperties = {
          fontSize: fz(rs), color: runColor(r, body, theme), fontFamily: `"${fontName(r.font, body, theme)}", "IBM Plex Sans Arabic", sans-serif`,
          fontWeight: isBold(r, body) ? 700 : 400, fontStyle: r.i ? 'italic' : undefined,
          textDecoration: [r.u || r.link ? 'underline' : '', r.s ? 'line-through' : ''].filter(Boolean).join(' ') || undefined,
          verticalAlign: r.sup ? 'super' : r.sub ? 'sub' : undefined, background: r.highlight ? paint(r.highlight, theme) : undefined,
          letterSpacing: r.spc ? fz(r.spc) : undefined,
          textTransform: r.caps === 'all' ? 'uppercase' : undefined, fontVariant: r.caps === 'small' ? 'small-caps' : undefined,
        }
        if (r.link && ctx.onLink) return <a key={i} href={r.link.startsWith('#') ? undefined : r.link} style={{ ...st, cursor: 'pointer' }} onClick={(e) => { e.preventDefault(); e.stopPropagation(); ctx.onLink!(r.link!) }}>{t}</a>
        if (r.link) st.color = paint('hlink', theme)
        return t === '\n' ? <br key={i} /> : <span key={i} style={st}>{t}</span>
      })}
      {!runs.length && '​'}
    </p>
  )
}
