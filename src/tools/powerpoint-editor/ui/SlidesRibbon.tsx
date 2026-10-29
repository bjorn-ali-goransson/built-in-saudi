// The presentation editor's ribbon. Home is what you reach for while building a
// slide; Insert is what you add; Design is the deck as a whole; Transitions and
// Slide Show are presenting. Shape, Picture and Table appear only while one is
// selected, and hold what applies to it alone.
import { useState } from 'react'
import { Ribbon, RGroup, RBtn, RSelect, RColor, RPopover, RItem } from '../../../components/office/Ribbon'
import { ImageIcon, TableIcon, TextIcon, LinkIcon, TrashIcon, PlayIcon, SearchIcon, CopyIcon, ScissorsIcon } from '../../../components/icons'
import { PRESETS, presetPath } from '../geom'
import { THEMES, FONT_PAIRS } from '../themes'
import { LAYOUTS, paint, type LayoutKind, type Theme, type TransitionKind } from '../model'
import type { SlStr } from '../strings'

export interface SlFormat {
  b: boolean; i: boolean; u: boolean; s: boolean
  size?: number; font?: string; color?: string; highlight?: string
  align?: string; bullet?: string | null; rtl?: boolean; anchor?: string
  fill?: string | null; line?: string | null; lineWidth?: number; dash?: string; shadow?: boolean; arrows?: 'none' | 'end' | 'both'
}
export type ArrangeCmd = 'front' | 'back' | 'forward' | 'backward' | 'left' | 'centreH' | 'right' | 'top' | 'middle' | 'bottom' | 'distH' | 'distV' | 'rotR' | 'rotL' | 'flipH' | 'flipV'

export interface SlActions {
  newSlide(kind: LayoutKind): void
  layout(kind: LayoutKind): void
  duplicate(): void
  deleteSlide(): void
  cut(): void; copy(): void; paste(): void
  mark(k: 'b' | 'i' | 'u' | 's'): void
  run(patch: Record<string, unknown>): void
  growFont(d: 1 | -1): void
  para(patch: Record<string, unknown>): void
  bullets(kind: 'bullet' | 'number'): void
  level(d: 1 | -1): void
  anchor(a: 't' | 'ctr' | 'b'): void
  fill(c: string | null): void
  line(patch: { color?: string | null; width?: number; dash?: string; arrows?: 'none' | 'end' | 'both' }): void
  shadow(): void
  arrange(c: ArrangeCmd): void
  find(): void
  tool(t: { kind: 'shape'; geom: string } | { kind: 'text' } | { kind: 'line'; arrow?: boolean }): void
  picture(): void
  table(r: number, c: number): void
  link(): void
  symbol(ch: string): void
  slideNumber(): void
  theme(t: Theme): void
  themeColor(slot: string, c: string): void
  fonts(f: { major: string; minor: string }): void
  slideSize(w: number, h: number): void
  background(c: string | null): void
  bgPicture(): void
  bgAll(): void
  transition(k: TransitionKind): void
  transitionDur(ms: number): void
  transitionAll(): void
  present(mode: 'start' | 'current' | 'presenter' | 'window'): void
  zoom(z: number | null): void
  notes(): void
  rtl(): void
  size(p: { w?: number; h?: number }): void
  alt(text: string): void
  cropReset(): void
  replacePicture(): void
  pictureShape(geom: string): void
  tableCmd(c: 'rowAbove' | 'rowBelow' | 'colBefore' | 'colAfter' | 'deleteRow' | 'deleteCol' | 'merge' | 'split' | 'header' | 'banded'): void
  cellFill(c: string | null): void
  tableAccent(c: string): void
  deleteEl(): void
}

const FONTS = ['major', 'minor', 'Calibri', 'Arial', 'Georgia', 'Times New Roman', 'Tahoma', 'Verdana', 'Trebuchet MS', 'Courier New', 'IBM Plex Sans Arabic', 'Amiri', 'Noto Naskh Arabic', 'Traditional Arabic']
const SIZES = [8, 10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 40, 44, 48, 54, 60, 72, 88, 96, 120]
const SYMBOLS = ['→', '←', '↑', '↓', '✓', '✗', '•', '★', '♥', '©', '®', '™', '°', '±', '×', '÷', '≈', '≠', '≤', '≥', '€', '£', '$', '﷼', '٪', '؟', '﷽', 'ﷺ', '①', '②', '③']

export function SlidesRibbon({ s, tab, onTab, fmt, act, readOnly, sel, theme, deckSize, transition, zoom, notes, rtl, picture, table, elSize }: {
  s: SlStr; tab: string; onTab: (t: string) => void; fmt: SlFormat; act: SlActions; readOnly: boolean
  sel: 'none' | 'shape' | 'text' | 'line' | 'image' | 'table' | 'multi'
  theme: Theme; deckSize: { w: number; h: number }; transition: { kind: TransitionKind; dur?: number }; zoom: number | null; notes: boolean; rtl: boolean
  picture: { alt: string } | null; table: { header: boolean; banded: boolean } | null; elSize: { w: number; h: number } | null
}) {
  const shapeTab = sel === 'shape' || sel === 'text' || sel === 'line' || sel === 'multi'
  const tabs = [
    { id: 'home', label: s.home }, { id: 'insert', label: s.insert }, { id: 'design', label: s.design }, { id: 'transitions', label: s.transitions }, { id: 'show', label: s.show }, { id: 'view', label: s.view },
    ...(shapeTab ? [{ id: 'shape', label: s.shapeTab, contextual: true }] : []),
    ...(sel === 'image' ? [{ id: 'picture', label: s.pictureTab, contextual: true }] : []),
    ...(sel === 'table' ? [{ id: 'table', label: s.tableTab, contextual: true }] : []),
  ]
  const t = tabs.some((x) => x.id === tab) ? tab : 'home'
  const dis = readOnly
  const textOk = sel === 'shape' || sel === 'text' || sel === 'table' || sel === 'multi'
  const fontLabel = (f: string) => (f === 'major' ? `${theme.fonts.major} (${s.themeFonts})` : f === 'minor' ? `${theme.fonts.minor} (${s.text})` : f)
  return (
    <Ribbon tabs={tabs} active={t} onTab={onTab} end={<RBtn label={s.fromStart} testid="sl-present-start" wide icon={<PlayIcon />} onClick={() => act.present('start')} />}>
      {t === 'home' && (
        <>
          <RGroup label={s.slides}>
            <RPopover label={s.newSlide} testid="sl-new-slide" wide trigger={<span className="flex items-center gap-1 text-[0.82rem] font-semibold">＋ <span className="max-[640px]:hidden">{s.newSlide}</span></span>}>
              {(close) => <LayoutGrid s={s} theme={theme} onPick={(k) => { close(); act.newSlide(k) }} testid="sl-layout" />}
            </RPopover>
            <RPopover label={s.layout} testid="sl-change-layout" wide trigger={<span className="text-[0.82rem]">{s.layout} ▾</span>}>
              {(close) => <LayoutGrid s={s} theme={theme} onPick={(k) => { close(); act.layout(k) }} testid="sl-relayout" />}
            </RPopover>
            <RBtn label={s.duplicate} testid="sl-duplicate" disabled={dis} onClick={act.duplicate}><CopyIcon /></RBtn>
          </RGroup>
          <RGroup label={s.editing}>
            <RBtn label={s.cut} testid="sl-cut" icon={<ScissorsIcon />} disabled={dis || sel === 'none'} onClick={act.cut} />
            <RBtn label={s.copy} testid="sl-copy" icon={<CopyIcon />} disabled={sel === 'none'} onClick={act.copy} />
            <RBtn label={s.paste} testid="sl-paste" disabled={dis} onClick={act.paste}><span className="text-[0.8rem] font-semibold">{s.paste}</span></RBtn>
          </RGroup>
          <RGroup label={s.font}>
            <RSelect label={s.fontFamily} testid="sl-font" width={140} value={fmt.font || 'minor'} options={FONTS.map((f) => ({ v: f, l: fontLabel(f) }))} onChange={(v) => act.run({ font: v === 'minor' ? null : v })} />
            <RSelect label={s.fontSize} testid="sl-size" width={58} value={String(fmt.size || 18)} options={SIZES.map((n) => ({ v: String(n), l: String(n) }))} onChange={(v) => act.run({ size: +v })} />
            <RBtn label={s.grow} testid="sl-grow" disabled={dis || !textOk} onClick={() => act.growFont(1)}><span className="text-[0.85rem]">A<sup>+</sup></span></RBtn>
            <RBtn label={s.shrink} testid="sl-shrink" disabled={dis || !textOk} onClick={() => act.growFont(-1)}><span className="text-[0.75rem]">A<sup>−</sup></span></RBtn>
            <RBtn label={`${s.bold} (Ctrl+B)`} testid="sl-bold" active={fmt.b} disabled={dis || !textOk} onClick={() => act.mark('b')}><b>B</b></RBtn>
            <RBtn label={`${s.italic} (Ctrl+I)`} testid="sl-italic" active={fmt.i} disabled={dis || !textOk} onClick={() => act.mark('i')}><i className="font-serif">I</i></RBtn>
            <RBtn label={`${s.underline} (Ctrl+U)`} testid="sl-underline" active={fmt.u} disabled={dis || !textOk} onClick={() => act.mark('u')}><u>U</u></RBtn>
            <RBtn label={s.strike} testid="sl-strike" active={fmt.s} disabled={dis || !textOk} onClick={() => act.mark('s')}><s>S</s></RBtn>
            <ThemeColor s={s} theme={theme} label={s.textColor} testid="sl-color" value={fmt.color} glyph={<span className="font-bold">A</span>} onPick={(c) => act.run({ color: c })} />
          </RGroup>
          <RGroup label={s.paragraph}>
            <RBtn label={s.bullets} testid="sl-bullets" active={fmt.bullet === 'bullet'} disabled={dis || !textOk} onClick={() => act.bullets('bullet')}><span>•≡</span></RBtn>
            <RBtn label={s.numbering} testid="sl-numbering" active={fmt.bullet === 'number'} disabled={dis || !textOk} onClick={() => act.bullets('number')}><span className="text-[0.78rem]">1≡</span></RBtn>
            <RBtn label={s.indentLess} testid="sl-level-less" disabled={dis || !textOk} onClick={() => act.level(-1)}><span className="rtl:-scale-x-100 inline-block">⇤</span></RBtn>
            <RBtn label={s.indentMore} testid="sl-level-more" disabled={dis || !textOk} onClick={() => act.level(1)}><span className="rtl:-scale-x-100 inline-block">⇥</span></RBtn>
            <RBtn label={s.alignStart} testid="sl-align-l" active={!fmt.align || fmt.align === 'l'} disabled={dis || !textOk} onClick={() => act.para({ align: null })}><AlignGlyph k="start" /></RBtn>
            <RBtn label={s.alignCenter} testid="sl-align-ctr" active={fmt.align === 'ctr'} disabled={dis || !textOk} onClick={() => act.para({ align: 'ctr' })}><AlignGlyph k="center" /></RBtn>
            <RBtn label={s.alignEnd} testid="sl-align-r" active={fmt.align === 'r'} disabled={dis || !textOk} onClick={() => act.para({ align: 'r' })}><AlignGlyph k="end" /></RBtn>
            <RBtn label={s.rtl} testid="sl-rtl" active={!!fmt.rtl} disabled={dis || !textOk} onClick={() => act.para({ rtl: !fmt.rtl })}><span className="text-[0.74rem] font-semibold">←¶</span></RBtn>
            <RSelect label={s.anchorMiddle} testid="sl-anchor" width={72} value={fmt.anchor || 't'} onChange={(v) => act.anchor(v as 't')} options={[{ v: 't', l: s.anchorTop }, { v: 'ctr', l: s.anchorMiddle }, { v: 'b', l: s.anchorBottom }]} />
          </RGroup>
          <RGroup label={s.drawing}>
            <RPopover label={s.shapes} testid="sl-shapes-home" wide trigger={<span className="text-[0.82rem]">◇ ▾</span>}>{(close) => <ShapeGallery s={s} onPick={(g) => { close(); act.tool(g) }} />}</RPopover>
            <ThemeColor s={s} theme={theme} label={s.fill} testid="sl-fill" value={fmt.fill || undefined} glyph={<span className="inline-block w-3.5 h-3.5 rounded-sm border border-current" />} allowNone noneLabel={s.noFill} onPick={(c) => act.fill(c)} disabled={sel === 'none' || sel === 'image' || sel === 'table'} />
            <ThemeColor s={s} theme={theme} label={s.outline} testid="sl-outline" value={fmt.line || undefined} glyph={<span className="inline-block w-3.5 h-3.5 rounded-sm border-2 border-current" />} allowNone noneLabel={s.noOutline} onPick={(c) => act.line({ color: c })} disabled={sel === 'none' || sel === 'table'} />
            <RPopover label={s.arrange} testid="sl-arrange" trigger={<span className="text-[0.82rem]">{s.arrange} ▾</span>}>{(close) => <ArrangeMenu s={s} onPick={(c) => { close(); act.arrange(c) }} />}</RPopover>
          </RGroup>
          <RGroup label={s.editing}>
            <RBtn label={s.find} icon={<SearchIcon />} testid="sl-find" onClick={act.find} />
          </RGroup>
        </>
      )}
      {t === 'insert' && (
        <>
          <RGroup label={s.slides}>
            <RPopover label={s.newSlide} testid="sl-new-slide-insert" wide trigger={<span className="text-[0.82rem] font-semibold">＋ {s.newSlide}</span>}>{(close) => <LayoutGrid s={s} theme={theme} onPick={(k) => { close(); act.newSlide(k) }} testid="sl-layout2" />}</RPopover>
          </RGroup>
          <RGroup label={s.illustrations}>
            <RBtn label={s.picture} wide icon={<ImageIcon />} testid="sl-insert-picture" disabled={dis} onClick={act.picture} />
            <RPopover label={s.shapes} testid="sl-insert-shape" wide trigger={<span className="flex items-center gap-1.5"><span>◇</span><span className="max-[640px]:hidden">{s.shapes}</span></span>}>{(close) => <ShapeGallery s={s} onPick={(g) => { close(); act.tool(g) }} />}</RPopover>
            <RPopover label={s.table} testid="sl-insert-table" trigger={<span className="flex items-center gap-1.5"><TableIcon /><span className="max-[640px]:hidden">{s.table}</span></span>}>{(close) => <TablePicker onPick={(r, c) => { close(); act.table(r, c) }} />}</RPopover>
          </RGroup>
          <RGroup label={s.text}>
            <RBtn label={s.textBox} wide icon={<TextIcon />} testid="sl-insert-text" disabled={dis} onClick={() => act.tool({ kind: 'text' })} />
            <RBtn label={s.line} testid="sl-insert-line" disabled={dis} onClick={() => act.tool({ kind: 'line' })}><span>╱</span></RBtn>
            <RBtn label={s.arrow} testid="sl-insert-arrow" disabled={dis} onClick={() => act.tool({ kind: 'line', arrow: true })}><span>↗</span></RBtn>
            <RBtn label={s.link} wide icon={<LinkIcon />} testid="sl-insert-link" disabled={dis || sel === 'none'} onClick={act.link} />
            <RBtn label={s.slideNumber} testid="sl-insert-number" disabled={dis} onClick={act.slideNumber}><span className="text-[0.78rem]">#</span></RBtn>
            <RPopover label={s.symbol} testid="sl-insert-symbol" trigger={<span>Ω</span>}>
              {(close) => <div className="p-2 grid grid-cols-6 gap-1 w-[220px]">{SYMBOLS.map((c) => <button key={c} type="button" data-testid="sl-symbol" onMouseDown={(e) => e.preventDefault()} onClick={() => { close(); act.symbol(c) }} className="size-8 rounded-sm border border-[color:var(--line-soft)] bg-transparent cursor-pointer text-[1rem] hover:bg-[color-mix(in_srgb,var(--ink)_6%,transparent)]">{c}</button>)}</div>}
            </RPopover>
          </RGroup>
        </>
      )}
      {t === 'design' && (
        <>
          <RGroup label={s.themes}>
            <div className="flex gap-1 max-w-[520px] overflow-x-auto">
              {THEMES.map((th) => (
                <button key={th.name} type="button" title={th.name} aria-label={th.name} data-testid={`sl-theme-${th.name}`} disabled={dis} aria-pressed={theme.name === th.name} onMouseDown={(e) => e.preventDefault()} onClick={() => act.theme(th)}
                  className={`flex-none w-[64px] h-[40px] rounded-sm border cursor-pointer p-1 flex flex-col justify-between ${theme.name === th.name ? 'border-green-600 ring-2 ring-green-600/40' : 'border-[color:var(--line)]'}`} style={{ background: th.colors.lt1 }}>
                  <span className="text-[10px] font-semibold leading-none truncate" style={{ color: th.colors.dk1, fontFamily: th.fonts.major }}>Aa</span>
                  <span className="flex gap-0.5">{(['accent1', 'accent2', 'accent3', 'accent4'] as const).map((k) => <span key={k} className="flex-1 h-1.5 rounded-[1px]" style={{ background: th.colors[k] }} />)}</span>
                </button>
              ))}
            </div>
          </RGroup>
          <RGroup label={s.variants}>
            {(['accent1', 'accent2', 'dk1', 'lt1'] as const).map((k) => <RColor key={k} label={`${s.themeColors}: ${k}`} testid={`sl-themecolor-${k}`} value={theme.colors[k]} glyph={<span className="inline-block w-3.5 h-3.5 rounded-sm" style={{ background: theme.colors[k] }} />} onPick={(c) => c && act.themeColor(k, c)} />)}
            <RPopover label={s.themeFonts} testid="sl-theme-fonts" trigger={<span className="text-[0.82rem]">{s.themeFonts} ▾</span>}>
              {(close) => <div className="py-1 w-[260px]">{FONT_PAIRS.map((f) => <RItem key={f.major + f.minor} testid="sl-font-pair" onClick={() => { close(); act.fonts(f) }}><span style={{ fontFamily: f.major }}>{f.major}</span> · <span style={{ fontFamily: f.minor }}>{f.minor}</span></RItem>)}</div>}
            </RPopover>
          </RGroup>
          <RGroup label={s.customize}>
            <RSelect label={s.slideSize} testid="sl-slide-size" width={150} value={Math.abs(deckSize.w / deckSize.h - 4 / 3) < 0.02 ? '43' : '169'} onChange={(v) => act.slideSize(v === '43' ? 720 : 960, 540)} options={[{ v: '169', l: s.wide }, { v: '43', l: s.standard }]} />
            <ThemeColor s={s} theme={theme} label={s.background} testid="sl-bg" glyph={<span className="text-[0.8rem]">{s.background}</span>} allowNone noneLabel={s.bgReset} onPick={(c) => act.background(c)} />
            <RBtn label={s.bgPicture} testid="sl-bg-picture" disabled={dis} onClick={act.bgPicture}><ImageIcon /></RBtn>
            <RBtn label={s.applyAll} testid="sl-bg-all" disabled={dis} onClick={act.bgAll}><span className="text-[0.78rem]">{s.applyAll}</span></RBtn>
            <RBtn label={rtl ? s.ltr : s.rtl} testid="sl-deck-rtl" active={rtl} disabled={dis} onClick={act.rtl}><span className="text-[0.74rem] font-semibold">RTL</span></RBtn>
          </RGroup>
        </>
      )}
      {t === 'transitions' && (
        <>
          <RGroup label={s.transition}>
            {(['none', 'fade', 'push', 'wipe', 'cover', 'zoom'] as TransitionKind[]).map((k) => <RBtn key={k} label={s[k]} wide testid={`sl-trans-${k}`} active={transition.kind === k} disabled={dis} onClick={() => act.transition(k)} icon={<TransGlyph k={k} />} />)}
          </RGroup>
          <RGroup label={s.duration}>
            <RSelect label={s.duration} testid="sl-trans-dur" width={80} value={String(transition.dur || 700)} onChange={(v) => act.transitionDur(+v)} options={[300, 500, 700, 1000, 1500, 2000].map((n) => ({ v: String(n), l: `${(n / 1000).toFixed(1)}s` }))} />
            <RBtn label={s.applyToAll} wide testid="sl-trans-all" disabled={dis} onClick={act.transitionAll} icon={<span>⇶</span>} />
          </RGroup>
        </>
      )}
      {t === 'show' && (
        <RGroup label={s.show}>
          <RBtn label={s.fromStart} wide testid="sl-show-start" icon={<PlayIcon />} onClick={() => act.present('start')} />
          <RBtn label={s.fromCurrent} wide testid="sl-show-current" icon={<span>▶︎</span>} onClick={() => act.present('current')} />
          <RBtn label={s.presenterView} wide testid="sl-show-presenter" icon={<span>⊞</span>} onClick={() => act.present('presenter')} />
          <RBtn label={s.separateWindow} wide testid="sl-show-window" icon={<span>⧉</span>} onClick={() => act.present('window')} />
        </RGroup>
      )}
      {t === 'view' && (
        <>
          <RGroup label={s.view}>
            <RBtn label={s.notes} wide testid="sl-toggle-notes" active={notes} onClick={act.notes} icon={<span>✎</span>} />
          </RGroup>
          <RGroup label={s.zoomFit}>
            <RBtn label={s.zoomFit} testid="sl-zoom-fit" active={zoom === null} onClick={() => act.zoom(null)}><span className="text-[0.78rem]">{s.zoomFit}</span></RBtn>
            {[0.5, 1, 1.5, 2].map((z) => <RBtn key={z} label={`${z * 100}%`} testid={`sl-zoom-${z * 100}`} active={zoom === z} onClick={() => act.zoom(z)}><span className="text-[0.78rem]">{z * 100}%</span></RBtn>)}
          </RGroup>
        </>
      )}
      {t === 'shape' && (
        <>
          <RGroup label={s.drawing}>
            <ThemeColor s={s} theme={theme} label={s.fill} testid="sl-shape-fill" value={fmt.fill || undefined} glyph={<span className="inline-block w-3.5 h-3.5 rounded-sm border border-current" />} allowNone noneLabel={s.noFill} onPick={(c) => act.fill(c)} disabled={sel === 'line'} />
            <ThemeColor s={s} theme={theme} label={s.outline} testid="sl-shape-outline" value={fmt.line || undefined} glyph={<span className="inline-block w-3.5 h-3.5 rounded-sm border-2 border-current" />} allowNone noneLabel={s.noOutline} onPick={(c) => act.line({ color: c })} />
            <RSelect label={s.outlineWidth} testid="sl-line-width" width={64} value={String(fmt.lineWidth ?? 1)} onChange={(v) => act.line({ width: +v })} options={[0.5, 0.75, 1, 1.5, 2.25, 3, 4.5, 6].map((n) => ({ v: String(n), l: `${n} pt` }))} />
            <RSelect label={s.dash} testid="sl-line-dash" width={72} value={fmt.dash || 'solid'} onChange={(v) => act.line({ dash: v })} options={[{ v: 'solid', l: '———' }, { v: 'dash', l: '– – –' }, { v: 'dot', l: '· · · ·' }, { v: 'dashDot', l: '–·–·' }]} />
            {sel === 'line' && <RSelect label={s.arrows} testid="sl-arrows" width={92} value={fmt.arrows || 'none'} onChange={(v) => act.line({ arrows: v as 'none' })} options={[{ v: 'none', l: s.noArrow }, { v: 'end', l: s.arrowEnd }, { v: 'both', l: s.arrowBoth }]} />}
            <RBtn label={s.shadow} testid="sl-shadow" active={!!fmt.shadow} disabled={dis} onClick={act.shadow}><span className="[text-shadow:1px_1px_2px_#0006]">S</span></RBtn>
          </RGroup>
          <RGroup label={s.arrange}>
            <RBtn label={s.front} testid="sl-front" disabled={dis} onClick={() => act.arrange('front')}><span>⇈</span></RBtn>
            <RBtn label={s.back} testid="sl-back" disabled={dis} onClick={() => act.arrange('back')}><span>⇊</span></RBtn>
            <RPopover label={s.alignObjects} testid="sl-align-objects" trigger={<span className="text-[0.82rem]">{s.alignObjects} ▾</span>}>{(close) => <ArrangeMenu s={s} onPick={(c) => { close(); act.arrange(c) }} />}</RPopover>
          </RGroup>
          {elSize && <SizeBox s={s} size={elSize} onSize={act.size} disabled={dis} />}
          <RGroup label={s.deleteEl}>
            <RBtn label={s.deleteEl} testid="sl-delete-el" icon={<TrashIcon />} disabled={dis} onClick={act.deleteEl} />
          </RGroup>
        </>
      )}
      {t === 'picture' && picture && (
        <>
          <RGroup label={s.altText}>
            <input dir="auto" aria-label={s.altText} data-testid="sl-picture-alt" defaultValue={picture.alt} key={picture.alt} disabled={dis} placeholder={s.altText}
              onBlur={(e) => act.alt(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
              className="h-8 w-[220px] px-2 rounded-sm border border-[color:var(--line)] bg-[var(--surface)] text-[0.84rem]" />
          </RGroup>
          <RGroup label={s.crop}>
            <RBtn label={s.resetCrop} testid="sl-crop-reset" disabled={dis} onClick={act.cropReset}><span className="text-[0.78rem]">{s.resetCrop}</span></RBtn>
            <RSelect label={s.shapes} testid="sl-picture-shape" width={110} value="rect" onChange={(v) => act.pictureShape(v)} options={['rect', 'roundRect', 'ellipse', 'hexagon', 'star5', 'heart'].map((g) => ({ v: g, l: g }))} />
            <RBtn label={s.replacePicture} testid="sl-picture-replace" disabled={dis} onClick={act.replacePicture}><ImageIcon /></RBtn>
          </RGroup>
          <RGroup label={s.arrange}>
            <RBtn label={s.front} testid="sl-pic-front" disabled={dis} onClick={() => act.arrange('front')}><span>⇈</span></RBtn>
            <RBtn label={s.back} testid="sl-pic-back" disabled={dis} onClick={() => act.arrange('back')}><span>⇊</span></RBtn>
            <ThemeColor s={s} theme={theme} label={s.outline} testid="sl-picture-outline" glyph={<span className="inline-block w-3.5 h-3.5 rounded-sm border-2 border-current" />} allowNone noneLabel={s.noOutline} onPick={(c) => act.line({ color: c })} />
          </RGroup>
          {elSize && <SizeBox s={s} size={elSize} onSize={act.size} disabled={dis} />}
          <RGroup label={s.deleteEl}><RBtn label={s.deleteEl} testid="sl-picture-delete" icon={<TrashIcon />} disabled={dis} onClick={act.deleteEl} /></RGroup>
        </>
      )}
      {t === 'table' && table && (
        <>
          <RGroup label={s.rows}>
            <RBtn label={s.rowAbove} wide testid="sl-row-above" disabled={dis} onClick={() => act.tableCmd('rowAbove')} icon={<span>⤒</span>} />
            <RBtn label={s.rowBelow} wide testid="sl-row-below" disabled={dis} onClick={() => act.tableCmd('rowBelow')} icon={<span>⤓</span>} />
            <RBtn label={s.deleteRow} testid="sl-row-delete" disabled={dis} onClick={() => act.tableCmd('deleteRow')}><span className="text-[0.78rem]">−≡</span></RBtn>
          </RGroup>
          <RGroup label={s.columns}>
            <RBtn label={s.colBefore} wide testid="sl-col-before" disabled={dis} onClick={() => act.tableCmd('colBefore')} icon={<span className="rtl:-scale-x-100 inline-block">⇤</span>} />
            <RBtn label={s.colAfter} wide testid="sl-col-after" disabled={dis} onClick={() => act.tableCmd('colAfter')} icon={<span className="rtl:-scale-x-100 inline-block">⇥</span>} />
            <RBtn label={s.deleteCol} testid="sl-col-delete" disabled={dis} onClick={() => act.tableCmd('deleteCol')}><span className="text-[0.78rem]">−⦀</span></RBtn>
          </RGroup>
          <RGroup label={s.tableStyle}>
            <RBtn label={s.headerRow} testid="sl-table-header" active={table.header} disabled={dis} onClick={() => act.tableCmd('header')}><span className="text-[0.78rem] font-bold">H</span></RBtn>
            <RBtn label={s.banded} testid="sl-table-banded" active={table.banded} disabled={dis} onClick={() => act.tableCmd('banded')}><span>☰</span></RBtn>
            <ThemeColor s={s} theme={theme} label={s.tableStyle} testid="sl-table-accent" glyph={<span className="text-[0.78rem]">◩</span>} onPick={(c) => c && act.tableAccent(c)} />
            <ThemeColor s={s} theme={theme} label={s.cellFill} testid="sl-cell-fill" glyph={<span className="inline-block w-3.5 h-3.5 rounded-sm border border-current" />} allowNone noneLabel={s.noFill} onPick={(c) => act.cellFill(c)} />
            <RBtn label={s.merge} testid="sl-merge" disabled={dis} onClick={() => act.tableCmd('merge')}>⊞</RBtn>
            <RBtn label={s.split} testid="sl-split" disabled={dis} onClick={() => act.tableCmd('split')}>⊟</RBtn>
          </RGroup>
          {elSize && <SizeBox s={s} size={elSize} onSize={act.size} disabled={dis} />}
          <RGroup label={s.deleteEl}><RBtn label={s.deleteEl} testid="sl-table-delete" icon={<TrashIcon />} disabled={dis} onClick={act.deleteEl} /></RGroup>
        </>
      )}
    </Ribbon>
  )
}

/** A colour picker offering the THEME first — picking a theme colour keeps a shape re-themable. */
function ThemeColor({ s, theme, label, testid, value, glyph, onPick, allowNone, noneLabel, disabled }: { s: SlStr; theme: Theme; label: string; testid: string; value?: string; glyph: React.ReactNode; onPick: (c: string | null) => void; allowNone?: boolean; noneLabel?: string; disabled?: boolean }) {
  const slots = ['dk1', 'lt1', 'dk2', 'lt2', 'accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6'] as const
  if (disabled) return <RBtn label={label} testid={testid} disabled>{glyph}</RBtn>
  return (
    <RPopover label={label} testid={testid} trigger={<span className="flex flex-col items-center leading-none">{glyph}<span className="block w-4 h-[3px] mt-0.5 rounded-sm" style={{ background: value ? paint(value, theme) : 'transparent', outline: value ? undefined : '1px solid var(--line)' }} /></span>}>
      {(close) => (
        <div className="p-2 w-[236px]">
          <div className="text-[0.7rem] text-ink-faint mb-1">{s.themeColors}</div>
          <div className="grid grid-cols-10 gap-1">
            {slots.map((k) => <button key={k} type="button" aria-label={k} data-testid={`${testid}-${k}`} onClick={() => { onPick(k); close() }} className="size-5 rounded-sm border border-[color:var(--line)] cursor-pointer" style={{ background: theme.colors[k] }} />)}
          </div>
          <div className="text-[0.7rem] text-ink-faint mt-2 mb-1">#</div>
          <div className="grid grid-cols-10 gap-1">
            {['#000000', '#ffffff', '#c00000', '#ff0000', '#ffc000', '#ffff00', '#92d050', '#00b050', '#00b0f0', '#0070c0', '#002060', '#7030a0', '#7f7f7f', '#f4b183', '#a9d18e', '#9dc3e6', '#0b6e4f', '#c9a54a', '#1f2a24', '#f7f2e8'].map((c) => (
              <button key={c} type="button" aria-label={c} data-testid={`${testid}-${c.slice(1)}`} onClick={() => { onPick(c); close() }} className="size-5 rounded-sm border border-[color:var(--line)] cursor-pointer" style={{ background: c }} />
            ))}
          </div>
          <div className="flex items-center gap-2 mt-2">
            <input type="color" aria-label={label} defaultValue={value && value.startsWith('#') ? value : '#000000'} onChange={(e) => onPick(e.target.value)} className="h-7 w-10 border-0 bg-transparent p-0 cursor-pointer" />
            {allowNone && <button type="button" onClick={() => { onPick(null); close() }} className="text-[0.8rem] border-0 bg-transparent text-ink-soft underline cursor-pointer" data-testid={`${testid}-none`}>{noneLabel || '∅'}</button>}
          </div>
        </div>
      )}
    </RPopover>
  )
}

function LayoutGrid({ s, theme, onPick, testid }: { s: SlStr; theme: Theme; onPick: (k: LayoutKind) => void; testid: string }) {
  const box = (k: LayoutKind) => {
    const ln = (x: number, y: number, w: number, h = 3, c = theme.colors.dk2) => <rect x={x} y={y} width={w} height={h} rx={1} fill={c} opacity={0.7} />
    switch (k) {
      case 'title': return <>{ln(14, 18, 52, 6, theme.colors.dk1)}{ln(24, 30, 32)}</>
      case 'titleContent': return <>{ln(8, 6, 40, 5, theme.colors.dk1)}{[16, 22, 28, 34].map((y) => ln(10, y, 50))}</>
      case 'section': return <>{ln(8, 18, 50, 6, theme.colors.accent1)}{ln(8, 30, 30)}</>
      case 'twoContent': return <>{ln(8, 6, 40, 5, theme.colors.dk1)}{[16, 22, 28].map((y) => <g key={y}>{ln(8, y, 28)}{ln(44, y, 28)}</g>)}</>
      case 'titleOnly': return <>{ln(8, 6, 40, 5, theme.colors.dk1)}</>
      case 'bigNumber': return <>{ln(26, 12, 28, 14, theme.colors.accent1)}{ln(20, 32, 40)}</>
      case 'quote': return <>{ln(14, 14, 52, 5, theme.colors.dk1)}{ln(14, 22, 52, 5, theme.colors.dk1)}{ln(30, 34, 20, 3, theme.colors.accent1)}</>
      default: return null
    }
  }
  return (
    <div className="p-2 grid grid-cols-4 gap-2 w-[340px]">
      {LAYOUTS.map((k) => (
        <button key={k} type="button" data-testid={`${testid}-${k}`} onClick={() => onPick(k)} className="flex flex-col items-center gap-1 p-1 rounded-sm border border-[color:var(--line-soft)] bg-transparent cursor-pointer hover:border-green-600">
          <svg viewBox="0 0 80 45" width={72} height={40} style={{ background: theme.colors.lt1, border: '1px solid #ddd' }} aria-hidden>{box(k)}</svg>
          <span className="text-[0.68rem] text-ink-soft text-center leading-tight">{s.layouts[k]}</span>
        </button>
      ))}
    </div>
  )
}

function ShapeGallery({ s, onPick }: { s: SlStr; onPick: (t: { kind: 'shape'; geom: string } | { kind: 'line'; arrow?: boolean }) => void }) {
  const groups = ['basic', 'arrow', 'flow', 'star', 'callout'] as const
  return (
    <div className="p-2 w-[320px] max-h-[60dvh] overflow-auto" data-testid="sl-shape-gallery">
      <div className="text-[0.72rem] text-ink-faint mb-1">{s.shapeGroups.line}</div>
      <div className="flex gap-1 mb-2">
        <button type="button" data-testid="sl-shape-line" onClick={() => onPick({ kind: 'line' })} className="size-8 grid place-items-center rounded-sm border border-[color:var(--line-soft)] bg-transparent cursor-pointer hover:border-green-600">╱</button>
        <button type="button" data-testid="sl-shape-arrowline" onClick={() => onPick({ kind: 'line', arrow: true })} className="size-8 grid place-items-center rounded-sm border border-[color:var(--line-soft)] bg-transparent cursor-pointer hover:border-green-600">↗</button>
      </div>
      {groups.map((g) => (
        <div key={g} className="mb-2">
          <div className="text-[0.72rem] text-ink-faint mb-1">{s.shapeGroups[g]}</div>
          <div className="grid grid-cols-8 gap-1">
            {PRESETS.filter((p) => p.group === g).map((p) => (
              <button key={p.id} type="button" title={p.id} aria-label={p.id} data-testid={`sl-shape-${p.id}`} onClick={() => onPick({ kind: 'shape', geom: p.id })} className="size-8 grid place-items-center rounded-sm border border-[color:var(--line-soft)] bg-transparent cursor-pointer hover:border-green-600">
                <svg viewBox="-2 -2 28 22" width={24} height={18} aria-hidden><path d={presetPath(p.id, 24, 18)} fill="currentColor" fillOpacity={0.18} stroke="currentColor" strokeWidth={1.2} /></svg>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function ArrangeMenu({ s, onPick }: { s: SlStr; onPick: (c: ArrangeCmd) => void }) {
  const items: [ArrangeCmd, string][] = [['front', s.front], ['forward', s.forward], ['backward', s.backward], ['back', s.back], ['left', s.alignLeft], ['centreH', s.alignCentreH], ['right', s.alignRight], ['top', s.alignTop], ['middle', s.alignMiddle], ['bottom', s.alignBottom], ['distH', s.distributeH], ['distV', s.distributeV], ['rotR', s.rotateRight], ['rotL', s.rotateLeft], ['flipH', s.flipH], ['flipV', s.flipV]]
  return <div className="py-1 w-[220px]">{items.map(([c, l], i) => <div key={c}>{(i === 4 || i === 12) && <div className="my-1 border-t border-[color:var(--line-soft)]" />}<RItem testid={`sl-arr-${c}`} onClick={() => onPick(c)}>{l}</RItem></div>)}</div>
}

function TablePicker({ onPick }: { onPick: (r: number, c: number) => void }) {
  const [h, setH] = useState({ r: 3, c: 3 })
  return (
    <div className="p-2" data-testid="sl-table-picker">
      <div className="grid grid-cols-8 gap-[3px]">
        {Array.from({ length: 64 }, (_, i) => {
          const r = Math.floor(i / 8) + 1, c = (i % 8) + 1
          const on = r <= h.r && c <= h.c
          return <button key={i} type="button" aria-label={`${r} × ${c}`} data-testid={`sl-table-${r}x${c}`} onMouseEnter={() => setH({ r, c })} onFocus={() => setH({ r, c })} onMouseDown={(e) => e.preventDefault()} onClick={() => onPick(r, c)}
            className={`size-5 rounded-[2px] border cursor-pointer ${on ? 'bg-[color-mix(in_srgb,var(--color-green-600)_30%,transparent)] border-green-600' : 'bg-transparent border-[color:var(--line)]'}`} />
        })}
      </div>
      <div className="mt-2 text-center text-[0.8rem] text-ink-soft" dir="ltr">{h.c} × {h.r}</div>
    </div>
  )
}

function SizeBox({ s, size, onSize, disabled }: { s: SlStr; size: { w: number; h: number }; onSize: (p: { w?: number; h?: number }) => void; disabled: boolean }) {
  const f = (k: 'w' | 'h', label: string) => (
    <label className="flex items-center gap-1 text-[0.74rem] text-ink-soft">{label}
      <input type="number" step={1} min={4} data-testid={`sl-size-${k}`} disabled={disabled} key={`${k}${Math.round(size[k])}`} defaultValue={Math.round(size[k])} onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }} onBlur={(e) => { const v = +e.target.value; if (v > 0 && Math.round(v) !== Math.round(size[k])) onSize({ [k]: v }) }}
        className="w-[64px] h-7 px-1 rounded-sm border border-[color:var(--line)] bg-[var(--surface)] text-ink text-[0.82rem]" dir="ltr" />
    </label>
  )
  return <RGroup label={s.size}><div className="flex flex-col gap-0.5">{f('w', s.width)}{f('h', s.height)}</div></RGroup>
}

function AlignGlyph({ k }: { k: 'start' | 'center' | 'end' }) {
  const lines = [16, 10, 16, 12]
  return <svg viewBox="0 0 18 14" width={17} height={14} aria-hidden className="rtl:-scale-x-100">{lines.map((w, i) => <rect key={i} y={i * 3.6} height={1.8} width={w} x={k === 'start' ? 1 : k === 'end' ? 17 - w : (18 - w) / 2} fill="currentColor" rx={0.6} />)}</svg>
}
function TransGlyph({ k }: { k: TransitionKind }) {
  const g: Record<TransitionKind, string> = { none: '∅', fade: '◐', push: '⇡', wipe: '▷', cover: '⇠', zoom: '⊕' }
  return <span className="text-[0.95rem]">{g[k]}</span>
}
