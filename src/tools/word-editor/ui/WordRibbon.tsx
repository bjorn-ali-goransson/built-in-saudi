// The word processor's ribbon. Home is what you reach for while typing, Insert
// is what you add, Layout is the page as a whole, View is how you look at it.
// Table and Picture appear only while one is selected.
import { useState } from 'react'
import { Ribbon, RGroup, RBtn, RSelect, RColor, RPopover, RItem } from '../../../components/office/Ribbon'
import { LinkIcon, ImageIcon, TableIcon, SearchIcon, ListIcon, TrashIcon, PaletteIcon } from '../../../components/icons'
import type { WdStr } from '../strings'
import type { Float } from '../schema'

export interface WdFormat {
  bold: boolean; italic: boolean; underline: boolean; strike: boolean; sup: boolean; sub: boolean; code: boolean
  color?: string; highlight?: string; font?: string; size?: number
  style: string; align: string | null; dir: string | null; lineHeight: number | null
  list: 'bullet' | 'ordered' | 'check' | null; listKind?: string
  link: string | null
}

export interface WdActions {
  mark(name: 'bold' | 'italic' | 'underline' | 'strike' | 'sup' | 'sub' | 'code'): void
  textStyle(patch: Record<string, unknown>): void
  clear(): void
  style(s: string): void
  list(kind: 'bullet' | 'ordered' | 'check', listKind?: string): void
  indent(d: 1 | -1): void
  align(a: string | null): void
  dir(d: 'ltr' | 'rtl'): void
  lineHeight(v: number | null): void
  table(rows: number, cols: number): void
  picture(): void
  link(): void
  pageBreak(): void
  rule(): void
  footnote(): void
  symbol(ch: string): void
  date(): void
  pageSize(w: number, h: number): void
  orientation(landscape: boolean): void
  margins(mm: number): void
  docDir(rtl: boolean): void
  find(replace?: boolean): void
  zoom(z: number): void
  outline(): void
  pageView(): void
  table_(cmd: 'rowBefore' | 'rowAfter' | 'colBefore' | 'colAfter' | 'deleteRow' | 'deleteCol' | 'deleteTable' | 'merge' | 'split' | 'headerRow'): void
  cellShade(c: string | null): void
  picturePatch(p: { width?: number | null; alt?: string; float?: Float }): void
  textBox(): void
  textBoxPatch(p: { float?: Float; fill?: string | null; border?: boolean }): void
  textBoxDelete(): void
  pictureDelete(): void
}

export const FONTS = ['IBM Plex Sans Arabic', 'Calibri', 'Arial', 'Times New Roman', 'Georgia', 'Courier New', 'Tahoma', 'Verdana', 'Amiri', 'Noto Naskh Arabic', 'Traditional Arabic']
export const SIZES = [8, 9, 10, 10.5, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 72]
const SYMBOLS = ['﷼', '©', '®', '™', '°', '±', '×', '÷', '≈', '≠', '≤', '≥', '€', '£', '$', '§', '¶', '•', '→', '←', '✓', '☐', '☑', '★', '٪', '؟', '،', '؛', 'ﷺ', '﷽']
const PAGE_SIZES = [
  { id: 'a4', w: 210, h: 297, l: 'A4' }, { id: 'a5', w: 148, h: 210, l: 'A5' }, { id: 'a3', w: 297, h: 420, l: 'A3' },
  { id: 'letter', w: 215.9, h: 279.4, l: 'Letter' }, { id: 'legal', w: 215.9, h: 355.6, l: 'Legal' },
]

export function pageSizeId(w: number, h: number): string {
  const [a, b] = w < h ? [w, h] : [h, w]
  return PAGE_SIZES.find((p) => Math.abs(p.w - a) < 1 && Math.abs(p.h - b) < 1)?.id || 'custom'
}

export function WordRibbon({ s, tab, onTab, fmt, act, readOnly, inTable, picture, textBox, page, rtl, zoom, outline, pageView }: {
  s: WdStr; tab: string; onTab: (t: string) => void; fmt: WdFormat; act: WdActions; readOnly: boolean
  inTable: boolean; picture: { width: number | null; alt: string; float: Float } | null
  textBox: { float: Float; border: boolean } | null
  page: { width: number; height: number; margins: number; landscape: boolean }; rtl: boolean; zoom: number; outline: boolean; pageView: boolean
}) {
  const tabs = [
    { id: 'home', label: s.home }, { id: 'insert', label: s.insert }, { id: 'layout', label: s.layout }, { id: 'view', label: s.view },
    ...(inTable ? [{ id: 'table', label: s.tableTab, contextual: true }] : []),
    ...(picture ? [{ id: 'picture', label: s.pictureTab, contextual: true }] : []),
    ...(textBox ? [{ id: 'textbox', label: s.textBoxTab, contextual: true }] : []),
  ]
  const t = tabs.some((x) => x.id === tab) ? tab : 'home'
  const dis = readOnly
  return (
    <Ribbon tabs={tabs} active={t} onTab={onTab}>
      {t === 'home' && (
        <>
          <RGroup label={s.font}>
            <RSelect label={s.fontFamily} testid="wd-font" width={132} value={fmt.font || 'IBM Plex Sans Arabic'} options={FONTS.map((f) => ({ v: f, l: f }))} onChange={(v) => act.textStyle({ font: v === 'IBM Plex Sans Arabic' ? null : v })} />
            <RSelect label={s.fontSize} testid="wd-size" width={58} value={String(fmt.size || 11)} options={SIZES.map((n) => ({ v: String(n), l: String(n) }))} onChange={(v) => act.textStyle({ size: +v === 11 ? null : +v })} />
            <RBtn label={`${s.bold} (Ctrl+B)`} testid="wd-bold" active={fmt.bold} disabled={dis} onClick={() => act.mark('bold')}><b>B</b></RBtn>
            <RBtn label={`${s.italic} (Ctrl+I)`} testid="wd-italic" active={fmt.italic} disabled={dis} onClick={() => act.mark('italic')}><i className="font-serif">I</i></RBtn>
            <RBtn label={`${s.underline} (Ctrl+U)`} testid="wd-underline" active={fmt.underline} disabled={dis} onClick={() => act.mark('underline')}><u>U</u></RBtn>
            <RBtn label={s.strike} testid="wd-strike" active={fmt.strike} disabled={dis} onClick={() => act.mark('strike')}><s>S</s></RBtn>
            <RBtn label={s.sup} testid="wd-sup" active={fmt.sup} disabled={dis} onClick={() => act.mark('sup')}>x²</RBtn>
            <RBtn label={s.sub} testid="wd-sub" active={fmt.sub} disabled={dis} onClick={() => act.mark('sub')}>x₂</RBtn>
            <RColor label={s.textColor} testid="wd-color" value={fmt.color} glyph={<span className="font-bold">A</span>} allowNone onPick={(c) => act.textStyle({ color: c })} />
            <RColor label={s.highlight} testid="wd-highlight" value={fmt.highlight} glyph={<span className="font-bold px-0.5 bg-[#fff2a8] text-ink">ab</span>} allowNone onPick={(c) => act.textStyle({ highlight: c })} />
            <RBtn label={s.clearFmt} testid="wd-clear" disabled={dis} onClick={act.clear}><span className="text-[0.82rem]">A⃠</span></RBtn>
          </RGroup>
          <RGroup label={s.paragraph}>
            <RBtn label={s.bullets} testid="wd-bullets" active={fmt.list === 'bullet'} disabled={dis} onClick={() => act.list('bullet')}><ListGlyph k="bullet" /></RBtn>
            <RBtn label={s.numbering} testid="wd-numbering" active={fmt.list === 'ordered'} disabled={dis} onClick={() => act.list('ordered')}><ListGlyph k="ordered" /></RBtn>
            <RPopover label={s.numKind} testid="wd-numkind" trigger={<span className="text-[0.7rem]">▾</span>}>
              {(close) => <div className="py-1 w-[180px]">{Object.entries(s.kinds).map(([k, l]) => <RItem key={k} testid={`wd-numkind-${k}`} onClick={() => { close(); act.list('ordered', k) }}>{l}</RItem>)}</div>}
            </RPopover>
            <RBtn label={s.checklist} testid="wd-checklist" active={fmt.list === 'check'} disabled={dis} onClick={() => act.list('check')}><span>☑</span></RBtn>
            <RBtn label={s.indentLess} testid="wd-indent-less" disabled={dis} onClick={() => act.indent(-1)}><span className="rtl:-scale-x-100 inline-block">⇤</span></RBtn>
            <RBtn label={s.indentMore} testid="wd-indent-more" disabled={dis} onClick={() => act.indent(1)}><span className="rtl:-scale-x-100 inline-block">⇥</span></RBtn>
            <RBtn label={s.alignStart} testid="wd-align-start" active={!fmt.align} disabled={dis} onClick={() => act.align(null)}><AlignGlyph k="start" /></RBtn>
            <RBtn label={s.alignCenter} testid="wd-align-center" active={fmt.align === 'center'} disabled={dis} onClick={() => act.align('center')}><AlignGlyph k="center" /></RBtn>
            <RBtn label={s.alignEnd} testid="wd-align-end" active={fmt.align === 'right'} disabled={dis} onClick={() => act.align('right')}><AlignGlyph k="end" /></RBtn>
            <RBtn label={s.justify} testid="wd-align-justify" active={fmt.align === 'justify'} disabled={dis} onClick={() => act.align('justify')}><AlignGlyph k="justify" /></RBtn>
            <RBtn label={s.ltr} testid="wd-ltr" active={fmt.dir === 'ltr'} disabled={dis} onClick={() => act.dir('ltr')}><span className="text-[0.74rem] font-semibold">¶→</span></RBtn>
            <RBtn label={s.rtl} testid="wd-rtl" active={fmt.dir === 'rtl'} disabled={dis} onClick={() => act.dir('rtl')}><span className="text-[0.74rem] font-semibold">←¶</span></RBtn>
            <RSelect label={s.lineSpacing} testid="wd-line-height" width={58} value={String(fmt.lineHeight || '')} onChange={(v) => act.lineHeight(v ? +v : null)}
              options={[{ v: '', l: '↕' }, { v: '1', l: '1.0' }, { v: '1.15', l: '1.15' }, { v: '1.5', l: '1.5' }, { v: '2', l: '2.0' }, { v: '2.5', l: '2.5' }, { v: '3', l: '3.0' }]} />
          </RGroup>
          <RGroup label={s.styles}>
            <RSelect label={s.styles} testid="wd-style" width={118} value={fmt.style} onChange={act.style}
              options={[{ v: 'normal', l: s.normal }, { v: 'h1', l: s.h1 }, { v: 'h2', l: s.h2 }, { v: 'h3', l: s.h3 }, { v: 'h4', l: s.h4 }, { v: 'quote', l: s.quote }, { v: 'code', l: s.codeBlock }]} />
            {(['h1', 'h2', 'h3'] as const).map((h) => (
              <RBtn key={h} label={s[h]} testid={`wd-style-${h}`} active={fmt.style === h} disabled={dis} onClick={() => act.style(fmt.style === h ? 'normal' : h)}><span className="font-display font-semibold text-[0.8rem]">{'H' + h[1]}</span></RBtn>
            ))}
          </RGroup>
          <RGroup label={s.editing}>
            <RBtn label={`${s.find} (Ctrl+F)`} icon={<SearchIcon />} testid="wd-find" onClick={() => act.find()} />
            <RBtn label={`${s.replace} (Ctrl+H)`} testid="wd-replace" disabled={dis} onClick={() => act.find(true)}><span className="text-[0.8rem]">ab→</span></RBtn>
          </RGroup>
        </>
      )}
      {t === 'insert' && (
        <>
          <RGroup label={s.tables}>
            <RPopover label={s.table} testid="wd-insert-table" trigger={<span className="flex items-center gap-1.5"><TableIcon /><span className="max-[640px]:hidden">{s.table}</span></span>}>
              {(close) => <TablePicker s={s} onPick={(r, c) => { close(); act.table(r, c) }} />}
            </RPopover>
          </RGroup>
          <RGroup label={s.illustrations}>
            <RBtn label={s.picture} wide icon={<ImageIcon />} testid="wd-insert-picture" disabled={dis} onClick={act.picture} />
            <RBtn label={s.textBox} wide icon={<BoxGlyph />} testid="wd-insert-textbox" disabled={dis || !!textBox} onClick={act.textBox} />
          </RGroup>
          <RGroup label={s.links}>
            <RBtn label={`${s.link} (Ctrl+K)`} wide icon={<LinkIcon />} testid="wd-insert-link" disabled={dis} onClick={act.link} />
            <RBtn label={s.footnote} wide testid="wd-insert-footnote" disabled={dis} onClick={act.footnote} icon={<span className="text-[0.8rem]">¹</span>} />
          </RGroup>
          <RGroup label={s.pages}>
            <RBtn label={`${s.pageBreak} (Ctrl+Enter)`} wide testid="wd-insert-break" disabled={dis} onClick={act.pageBreak} icon={<span>⤓</span>} />
            <RBtn label={s.rule} wide testid="wd-insert-rule" disabled={dis} onClick={act.rule} icon={<span>―</span>} />
          </RGroup>
          <RGroup label={s.symbol}>
            <RPopover label={s.symbol} testid="wd-insert-symbol" trigger={<span>Ω</span>}>
              {(close) => <div className="p-2 grid grid-cols-6 gap-1 w-[220px]">{SYMBOLS.map((c) => <button key={c} type="button" data-testid="wd-symbol" onMouseDown={(e) => e.preventDefault()} onClick={() => { close(); act.symbol(c) }} className="size-8 rounded-sm border border-[color:var(--line-soft)] bg-transparent cursor-pointer text-[1rem] hover:bg-[color-mix(in_srgb,var(--ink)_6%,transparent)]">{c}</button>)}</div>}
            </RPopover>
            <RBtn label={s.date} testid="wd-insert-date" disabled={dis} onClick={act.date}><span className="text-[0.8rem]">📅</span></RBtn>
          </RGroup>
        </>
      )}
      {t === 'layout' && (
        <>
          <RGroup label={s.setup}>
            <RSelect label={s.pageSize} testid="wd-page-size" width={86} value={pageSizeId(page.width, page.height)} onChange={(v) => { const p = PAGE_SIZES.find((x) => x.id === v); if (p) act.pageSize(p.w, p.h) }}
              options={PAGE_SIZES.map((p) => ({ v: p.id, l: p.l }))} />
            <RBtn label={s.portrait} testid="wd-portrait" active={!page.landscape} disabled={dis} onClick={() => act.orientation(false)}><span className="inline-block w-3 h-4 border-2 border-current rounded-[2px]" /></RBtn>
            <RBtn label={s.landscape} testid="wd-landscape" active={page.landscape} disabled={dis} onClick={() => act.orientation(true)}><span className="inline-block w-4 h-3 border-2 border-current rounded-[2px]" /></RBtn>
            <RSelect label={s.margins} testid="wd-margins" width={138} value={String(Math.abs(page.margins - 12.7) < 0.5 ? 12.7 : Math.abs(page.margins - 38.1) < 0.5 ? 38.1 : 25.4)} onChange={(v) => act.margins(+v)}
              options={[{ v: '25.4', l: s.marginNormal }, { v: '12.7', l: s.marginNarrow }, { v: '38.1', l: s.marginWide }]} />
          </RGroup>
          <RGroup label={s.docDirection}>
            <RBtn label={s.ltr} testid="wd-doc-ltr" active={!rtl} disabled={dis} onClick={() => act.docDir(false)}><span className="text-[0.74rem] font-semibold">LTR</span></RBtn>
            <RBtn label={s.rtl} testid="wd-doc-rtl" active={rtl} disabled={dis} onClick={() => act.docDir(true)}><span className="text-[0.74rem] font-semibold">RTL</span></RBtn>
          </RGroup>
        </>
      )}
      {t === 'view' && (
        <>
          <RGroup label={s.show}>
            <RBtn label={s.outline} wide testid="wd-outline" active={outline} onClick={act.outline} icon={<ListIcon />} />
            <RBtn label={s.ruler} wide testid="wd-page-view" active={pageView} onClick={act.pageView} icon={<span className="inline-block w-3 h-4 border-2 border-current rounded-[2px]" />} />
          </RGroup>
          <RGroup label={s.zoom}>
            {[0.75, 1, 1.25, 1.5].map((z) => <RBtn key={z} label={`${Math.round(z * 100)}%`} testid={`wd-zoom-${Math.round(z * 100)}`} active={Math.abs(zoom - z) < 0.01} onClick={() => act.zoom(z)}><span className="text-[0.78rem]">{Math.round(z * 100)}%</span></RBtn>)}
          </RGroup>
        </>
      )}
      {t === 'table' && (
        <>
          <RGroup label={s.rows}>
            <RBtn label={s.addRowAbove} wide testid="wd-row-before" disabled={dis} onClick={() => act.table_('rowBefore')} icon={<span>⤒</span>} />
            <RBtn label={s.addRowBelow} wide testid="wd-row-after" disabled={dis} onClick={() => act.table_('rowAfter')} icon={<span>⤓</span>} />
            <RBtn label={s.deleteRow} testid="wd-row-delete" disabled={dis} onClick={() => act.table_('deleteRow')}><span className="text-[0.78rem]">−≡</span></RBtn>
          </RGroup>
          <RGroup label={s.columns}>
            <RBtn label={s.addColBefore} wide testid="wd-col-before" disabled={dis} onClick={() => act.table_('colBefore')} icon={<span className="rtl:-scale-x-100 inline-block">⇤</span>} />
            <RBtn label={s.addColAfter} wide testid="wd-col-after" disabled={dis} onClick={() => act.table_('colAfter')} icon={<span className="rtl:-scale-x-100 inline-block">⇥</span>} />
            <RBtn label={s.deleteCol} testid="wd-col-delete" disabled={dis} onClick={() => act.table_('deleteCol')}><span className="text-[0.78rem]">−⦀</span></RBtn>
          </RGroup>
          <RGroup label={s.merge}>
            <RBtn label={s.mergeCells} testid="wd-merge" disabled={dis} onClick={() => act.table_('merge')}>⊞</RBtn>
            <RBtn label={s.splitCell} testid="wd-split" disabled={dis} onClick={() => act.table_('split')}>⊟</RBtn>
            <RBtn label={s.headerRow} testid="wd-header-row" disabled={dis} onClick={() => act.table_('headerRow')}><span className="text-[0.78rem] font-bold">H</span></RBtn>
            <RColor label={s.cellShade} testid="wd-cell-shade" glyph={<PaletteIcon />} allowNone onPick={act.cellShade} />
          </RGroup>
          <RGroup label={s.table}>
            <RBtn label={s.deleteTable} wide testid="wd-table-delete" disabled={dis} onClick={() => act.table_('deleteTable')} icon={<TrashIcon />} />
          </RGroup>
        </>
      )}
      {t === 'picture' && picture && (
        <>
          <RGroup label={s.width}>
            <input type="range" min={40} max={800} step={10} aria-label={s.width} data-testid="wd-picture-width" disabled={dis}
              value={picture.width || 400} onChange={(e) => act.picturePatch({ width: +e.target.value })} className="w-[140px]" />
            <RBtn label={s.resetSize} testid="wd-picture-reset" disabled={dis} onClick={() => act.picturePatch({ width: null })}><span className="text-[0.78rem]">1:1</span></RBtn>
          </RGroup>
          <WrapGroup s={s} value={picture.float} inline disabled={dis} onPick={(f) => act.picturePatch({ float: f })} testid="wd-picture-wrap" />
          <RGroup label={s.altText}>
            <input dir="auto" aria-label={s.altText} data-testid="wd-picture-alt" defaultValue={picture.alt} key={picture.alt} disabled={dis}
              onBlur={(e) => act.picturePatch({ alt: e.target.value })} onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
              placeholder={s.altText} className="h-8 w-[220px] px-2 rounded-sm border border-[color:var(--line)] bg-[var(--surface)] text-[0.84rem]" />
          </RGroup>
          <RGroup label={s.pictureTab}>
            <RBtn label={s.deletePicture} wide testid="wd-picture-delete" disabled={dis} onClick={act.pictureDelete} icon={<TrashIcon />} />
          </RGroup>
        </>
      )}
      {t === 'textbox' && textBox && (
        <>
          <WrapGroup s={s} value={textBox.float} disabled={dis} onPick={(f) => act.textBoxPatch({ float: f })} testid="wd-textbox-wrap" />
          <RGroup label={s.boxFill}>
            <RColor label={s.boxFill} testid="wd-textbox-fill" glyph={<PaletteIcon />} allowNone onPick={(c) => act.textBoxPatch({ fill: c })} />
            <RBtn label={s.boxBorder} testid="wd-textbox-border" active={textBox.border} disabled={dis} onClick={() => act.textBoxPatch({ border: !textBox.border })}><BoxGlyph /></RBtn>
          </RGroup>
          <RGroup label={s.textBoxTab}>
            <RBtn label={s.deleteTextBox} wide testid="wd-textbox-delete" disabled={dis} onClick={act.textBoxDelete} icon={<TrashIcon />} />
          </RGroup>
        </>
      )}
    </Ribbon>
  )
}

/** Where a picture or a box sits. Physical sides, as Word's placement is. */
function WrapGroup({ s, value, inline, disabled, onPick, testid }: { s: WdStr; value: Float; inline?: boolean; disabled: boolean; onPick: (f: Float) => void; testid: string }) {
  const opts: { v: Float; l: string; k: string }[] = [
    ...(inline ? [{ v: null, l: s.inLine, k: 'inline' }] : []),
    { v: 'left', l: s.wrapLeft, k: 'left' }, { v: 'right', l: s.wrapRight, k: 'right' }, { v: 'center', l: s.wrapCenter, k: 'center' },
  ]
  return (
    <RGroup label={s.wrap}>
      {opts.map((o) => (
        <RBtn key={o.k} label={o.l} testid={`${testid}-${o.k}`} active={value === o.v} disabled={disabled} onClick={() => onPick(o.v)}><WrapGlyph k={o.k} /></RBtn>
      ))}
    </RGroup>
  )
}

function WrapGlyph({ k }: { k: string }) {
  // Drawn as on the page, not mirrored: a picture on the right is on the right in Arabic too.
  const box = k === 'left' ? 1 : k === 'right' ? 10 : 5.5
  return (
    <svg viewBox="0 0 18 14" width={17} height={14} aria-hidden>
      <rect x={k === 'inline' ? 6 : box} y={k === 'inline' ? 5 : 2} width={k === 'inline' ? 4 : 7} height={k === 'inline' ? 4 : 7} fill="currentColor" opacity={0.55} rx={0.6} />
      {k === 'inline' ? <><rect x={1} y={6.2} width={4} height={1.6} rx={0.6} fill="currentColor" /><rect x={11} y={6.2} width={6} height={1.6} rx={0.6} fill="currentColor" /><rect x={1} y={11} width={16} height={1.6} rx={0.6} fill="currentColor" /></>
        : k === 'center' ? <rect x={1} y={11} width={16} height={1.6} rx={0.6} fill="currentColor" />
          : <>{[2.2, 5.2, 8.2].map((y) => <rect key={y} x={k === 'left' ? 9.5 : 1} y={y} width={7.5} height={1.6} rx={0.6} fill="currentColor" />)}<rect x={1} y={11} width={16} height={1.6} rx={0.6} fill="currentColor" /></>}
    </svg>
  )
}

function BoxGlyph() {
  return (
    <svg viewBox="0 0 18 14" width={17} height={14} aria-hidden>
      <rect x={1.5} y={1.5} width={15} height={11} fill="none" stroke="currentColor" strokeWidth={1.4} rx={1} />
      <rect x={4} y={4.5} width={10} height={1.5} rx={0.6} fill="currentColor" /><rect x={4} y={8} width={7} height={1.5} rx={0.6} fill="currentColor" />
    </svg>
  )
}

function TablePicker({ s, onPick }: { s: WdStr; onPick: (r: number, c: number) => void }) {
  const [h, setH] = useState({ r: 2, c: 3 })
  return (
    <div className="p-2" data-testid="wd-table-picker">
      <div className="grid grid-cols-8 gap-[3px]" onMouseLeave={() => setH({ r: 2, c: 3 })}>
        {Array.from({ length: 64 }, (_, i) => {
          const r = Math.floor(i / 8) + 1
          const c = (i % 8) + 1
          const on = r <= h.r && c <= h.c
          return <button key={i} type="button" aria-label={s.insertTable(r, c)} data-testid={`wd-table-${r}x${c}`} onMouseEnter={() => setH({ r, c })} onFocus={() => setH({ r, c })} onMouseDown={(e) => e.preventDefault()} onClick={() => onPick(r, c)}
            className={`size-5 rounded-[2px] border cursor-pointer ${on ? 'bg-[color-mix(in_srgb,var(--color-green-600)_30%,transparent)] border-green-600' : 'bg-transparent border-[color:var(--line)]'}`} />
        })}
      </div>
      <div className="mt-2 text-center text-[0.8rem] text-ink-soft">{s.insertTable(h.r, h.c)}</div>
    </div>
  )
}

function AlignGlyph({ k }: { k: 'start' | 'center' | 'end' | 'justify' }) {
  const lines = k === 'justify' ? [16, 16, 16, 11] : [16, 10, 16, 12]
  return (
    <svg viewBox="0 0 18 14" width={17} height={14} aria-hidden className="rtl:-scale-x-100">
      {lines.map((w, i) => <rect key={i} y={i * 3.6} height={1.8} width={w} x={k === 'start' || k === 'justify' ? 1 : k === 'end' ? 17 - w : (18 - w) / 2} fill="currentColor" rx={0.6} />)}
    </svg>
  )
}

function ListGlyph({ k }: { k: 'bullet' | 'ordered' }) {
  return (
    <svg viewBox="0 0 18 14" width={17} height={14} aria-hidden className="rtl:-scale-x-100">
      {[0, 1, 2].map((i) => (
        <g key={i}>
          {k === 'bullet' ? <circle cx={2} cy={2 + i * 5} r={1.4} fill="currentColor" /> : <text x={0} y={4 + i * 5} fontSize={5} fill="currentColor">{i + 1}</text>}
          <rect x={6} y={1.2 + i * 5} width={11} height={1.6} rx={0.6} fill="currentColor" />
        </g>
      ))}
    </svg>
  )
}
