// The spreadsheet's ribbon. Home is what you reach for while typing; Insert is
// what you add; Data is what you do to a table; View is how you look at it. The
// Chart and Picture tabs appear only while one is selected.
import { memo } from 'react'
import { Ribbon, RGroup, RBtn, RSelect, RColor, RPopover, RItem } from '../../../components/office/Ribbon'
import { CopyIcon, ScissorsIcon, PaletteIcon, LinkIcon, ImageIcon, TableIcon, SearchIcon, CalcIcon, ListIcon, TrashIcon, GridIcon, EditIcon } from '../../../components/icons'
import type { XlStr } from '../strings'
import type { CellFormat, ChartKind, ChartSpec, SheetImage } from '../engine/model'
import type { BorderPreset } from '../actions'

export interface XlActions {
  cut(): void; copy(): void; paste(mode?: 'values' | 'formats'): void
  fmt(patch: Partial<Record<keyof CellFormat, unknown>>): void
  toggle(key: 'bold' | 'italic' | 'underline' | 'strike' | 'wrap'): void
  border(p: BorderPreset): void
  merge(on: boolean): void
  numFmt(id: string): void
  decimals(d: 1 | -1): void
  customFormat(): void
  indent(d: 1 | -1): void
  insert(axis: 'row' | 'col', where: 'before' | 'after'): void
  remove(axis: 'row' | 'col'): void
  hide(axis: 'row' | 'col'): void
  unhide(axis: 'row' | 'col'): void
  size(axis: 'row' | 'col'): void
  clear(what: 'all' | 'contents' | 'formats'): void
  autosum(fn?: string): void
  sort(dir: 'asc' | 'desc'): void
  filter(): void
  clearFilters(): void
  find(replace?: boolean): void
  chart(kind: ChartKind): void
  picture(): void
  link(): void
  note(): void
  insertFunction(): void
  validation(): void
  dedupe(): void
  protectSheet(): void
  protectBook(): void
  lockCells(): void
  names(): void
  cond(): void
  split(): void
  freeze(mode: 'top' | 'first' | 'here' | 'none'): void
  gridlines(): void
  showFormulas(): void
  zoom(z: number): void
  rtl(): void
  chartPatch(p: Partial<ChartSpec>): void
  chartDelete(): void
  picturePatch(p: Partial<SheetImage>): void
  pictureDelete(): void
  print(): void
}

const FONTS = ['IBM Plex Sans Arabic', 'Arial', 'Calibri', 'Times New Roman', 'Courier New', 'Georgia', 'Tahoma', 'Verdana', 'Amiri', 'Noto Naskh Arabic']
const SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 36, 48, 72]
const FNS = ['SUM', 'AVERAGE', 'COUNT', 'MAX', 'MIN', 'COUNTIF', 'SUMIF', 'IF', 'VLOOKUP', 'XLOOKUP', 'INDEX', 'MATCH', 'ROUND', 'TODAY', 'TEXT', 'CONCAT']

export const XlRibbon = memo(function XlRibbon({ s, tab, onTab, fmt, act, merged, sheetFreeze, showGrid, rtl, zoom, showFormulas, chart, picture, readOnly, protectedSheet = false, protectedBook = false }: {
  s: XlStr; tab: string; onTab: (t: string) => void; fmt: CellFormat; act: XlActions; merged: boolean
  sheetFreeze: boolean; showGrid: boolean; rtl: boolean; zoom: number; showFormulas: boolean
  chart: ChartSpec | null; picture: SheetImage | null; readOnly: boolean; protectedSheet?: boolean; protectedBook?: boolean
}) {
  const tabs = [
    { id: 'home', label: s.home }, { id: 'insert', label: s.insert }, { id: 'data', label: s.data }, { id: 'formulas', label: s.formulas }, { id: 'view', label: s.view },
    ...(chart ? [{ id: 'chart', label: s.chartTab, contextual: true }] : []),
    ...(picture ? [{ id: 'picture', label: s.pictureTab, contextual: true }] : []),
  ]
  const t = tabs.some((x) => x.id === tab) ? tab : 'home'
  const dis = readOnly
  return (
    <Ribbon tabs={tabs} active={t} onTab={onTab}>
      {t === 'home' && (
        <>
          <RGroup label={s.clipboard}>
            <RBtn label={s.paste} testid="xl-paste" disabled={dis} onClick={() => act.paste()}><span className="text-[1rem]">⎘</span></RBtn>
            <RPopover label={s.paste} short="" testid="xl-paste-more" trigger={<span>▾</span>}>
              {(close) => <div className="py-1 w-[200px]">
                <RItem testid="xl-paste-values" onClick={() => { close(); act.paste('values') }}>{s.pasteValues}</RItem>
                <RItem testid="xl-paste-formats" onClick={() => { close(); act.paste('formats') }}>{s.pasteFormats}</RItem>
              </div>}
            </RPopover>
            <RBtn label={s.cut} icon={<ScissorsIcon />} testid="xl-cut" disabled={dis} onClick={act.cut} />
            <RBtn label={s.copy} icon={<CopyIcon />} testid="xl-copy" onClick={act.copy} />
          </RGroup>
          <RGroup label={s.font}>
            <RSelect label={s.fontFamily} testid="xl-font" width={128} value={fmt.fontFamily || 'IBM Plex Sans Arabic'} options={FONTS.map((f) => ({ v: f, l: f }))} onChange={(v) => act.fmt({ fontFamily: v === 'IBM Plex Sans Arabic' ? undefined : v })} />
            <RSelect label={s.fontSize} testid="xl-size" width={58} value={String(fmt.fontSize || 10)} options={SIZES.map((n) => ({ v: String(n), l: String(n) }))} onChange={(v) => act.fmt({ fontSize: +v === 10 ? undefined : +v })} />
            <RBtn label={s.bold} testid="xl-bold" active={!!fmt.bold} disabled={dis} onClick={() => act.toggle('bold')}><b>B</b></RBtn>
            <RBtn label={s.italic} testid="xl-italic" active={!!fmt.italic} disabled={dis} onClick={() => act.toggle('italic')}><i className="font-serif">I</i></RBtn>
            <RBtn label={s.underline} testid="xl-underline" active={!!fmt.underline} disabled={dis} onClick={() => act.toggle('underline')}><u>U</u></RBtn>
            <RBtn label={s.strike} testid="xl-strike" active={!!fmt.strike} disabled={dis} onClick={() => act.toggle('strike')}><s>S</s></RBtn>
            <RColor label={s.textColor} testid="xl-color" value={fmt.color} glyph={<span className="font-bold">A</span>} allowNone onPick={(c) => act.fmt({ color: c || undefined })} />
            <RColor label={s.fillColor} testid="xl-fill" value={fmt.bg} glyph={<PaletteIcon />} allowNone onPick={(c) => act.fmt({ bg: c || undefined })} />
            <RPopover label={s.borders} testid="xl-borders" trigger={<GridIcon />}>
              {(close) => <div className="py-1 w-[190px]">
                {(['all', 'outer', 'bottom', 'thick-bottom', 'none'] as BorderPreset[]).map((b) => (
                  <RItem key={b} testid={`xl-border-${b}`} onClick={() => { close(); act.border(b) }}>{b === 'all' ? s.allBorders : b === 'outer' ? s.outerBorder : b === 'none' ? s.noBorder : b === 'bottom' ? s.bottomBorder : s.bottomBorder + ' ▬'}</RItem>
                ))}
              </div>}
            </RPopover>
          </RGroup>
          <RGroup label={s.alignment}>
            <RBtn label={s.alignStart} testid="xl-align-start" active={fmt.align === 'start'} onClick={() => act.fmt({ align: fmt.align === 'start' ? undefined : 'start' })}><AlignGlyph k="start" /></RBtn>
            <RBtn label={s.alignCenter} testid="xl-align-center" active={fmt.align === 'center'} onClick={() => act.fmt({ align: fmt.align === 'center' ? undefined : 'center' })}><AlignGlyph k="center" /></RBtn>
            <RBtn label={s.alignEnd} testid="xl-align-end" active={fmt.align === 'end'} onClick={() => act.fmt({ align: fmt.align === 'end' ? undefined : 'end' })}><AlignGlyph k="end" /></RBtn>
            <RSelect label={s.middle} testid="xl-valign" width={70} value={fmt.valign || 'bottom'} options={[{ v: 'top', l: s.top }, { v: 'middle', l: s.middle }, { v: 'bottom', l: s.bottom }]} onChange={(v) => act.fmt({ valign: v === 'bottom' ? undefined : v })} />
            <RBtn label={s.wrap} testid="xl-wrap" active={!!fmt.wrap} onClick={() => act.toggle('wrap')}>↵</RBtn>
            <RBtn label={merged ? s.unmerge : s.merge} testid="xl-merge" active={merged} disabled={dis} onClick={() => act.merge(!merged)}>⊞</RBtn>
            <RBtn label={s.indentLess} testid="xl-indent-less" onClick={() => act.indent(-1)}>⇤</RBtn>
            <RBtn label={s.indentMore} testid="xl-indent-more" onClick={() => act.indent(1)}>⇥</RBtn>
          </RGroup>
          <RGroup label={s.number}>
            <RSelect label={s.number} testid="xl-numfmt" width={104} value={fmt.numCode ? 'custom' : fmt.numFmt || 'general'} onChange={(v) => (v === 'custom' ? act.customFormat() : act.numFmt(v))}
              options={[{ v: 'general', l: s.general }, { v: 'number', l: s.numberFmt }, { v: 'thousands', l: s.thousands }, { v: 'percent', l: s.percent }, { v: 'currency', l: s.currency }, { v: 'date', l: s.date }, { v: 'custom', l: s.customFmt }]} />
            <RBtn label={s.percent} testid="xl-percent" onClick={() => act.numFmt('percent')}>%</RBtn>
            <RBtn label={s.currency} testid="xl-currency" onClick={() => act.numFmt('currency')}>﷼</RBtn>
            <RBtn label={s.decMore} testid="xl-dec-more" onClick={() => act.decimals(1)}>.0+</RBtn>
            <RBtn label={s.decLess} testid="xl-dec-less" onClick={() => act.decimals(-1)}>.0−</RBtn>
          </RGroup>
          <RGroup label={s.cells}>
            <RPopover label={s.insert} testid="xl-insert-cells" trigger={<span className="text-[0.82rem]">＋</span>}>
              {(close) => <div className="py-1 w-[220px]">
                <RItem testid="xl-insert-row-above" onClick={() => { close(); act.insert('row', 'before') }}>{s.rowsAbove}</RItem>
                <RItem testid="xl-insert-row-below" onClick={() => { close(); act.insert('row', 'after') }}>{s.rowsBelow}</RItem>
                <RItem testid="xl-insert-col-before" onClick={() => { close(); act.insert('col', 'before') }}>{s.colsBefore}</RItem>
                <RItem testid="xl-insert-col-after" onClick={() => { close(); act.insert('col', 'after') }}>{s.colsAfter}</RItem>
              </div>}
            </RPopover>
            <RPopover label={s.deleteRow} testid="xl-delete-cells" trigger={<span className="text-[0.82rem]">−</span>}>
              {(close) => <div className="py-1 w-[200px]">
                <RItem testid="xl-delete-rows" onClick={() => { close(); act.remove('row') }}>{s.deleteRows}</RItem>
                <RItem testid="xl-delete-cols" onClick={() => { close(); act.remove('col') }}>{s.deleteCols}</RItem>
              </div>}
            </RPopover>
            <RPopover label={s.rowHeight} testid="xl-format-cells" trigger={<span className="text-[0.82rem]">↕</span>}>
              {(close) => <div className="py-1 w-[200px]">
                <RItem testid="xl-row-height" onClick={() => { close(); act.size('row') }}>{s.rowHeight}…</RItem>
                <RItem testid="xl-col-width" onClick={() => { close(); act.size('col') }}>{s.colWidth}…</RItem>
                <RItem testid="xl-hide-rows" onClick={() => { close(); act.hide('row') }}>{s.hideRows}</RItem>
                <RItem testid="xl-hide-cols" onClick={() => { close(); act.hide('col') }}>{s.hideCols}</RItem>
                <RItem testid="xl-unhide-rows" onClick={() => { close(); act.unhide('row') }}>{s.unhide} ({s.hideRows.split(' ').pop()})</RItem>
                <RItem testid="xl-unhide-cols" onClick={() => { close(); act.unhide('col') }}>{s.unhide} ({s.hideCols.split(' ').pop()})</RItem>
              </div>}
            </RPopover>
          </RGroup>
          <RGroup label={s.editing}>
            <RBtn label={s.autosum} testid="xl-autosum" disabled={dis} onClick={() => act.autosum()}>Σ</RBtn>
            <RPopover label={s.clear} testid="xl-clear" trigger={<EraseGlyph />}>
              {(close) => <div className="py-1 w-[180px]">
                <RItem testid="xl-clear-all" onClick={() => { close(); act.clear('all') }}>{s.clearAll}</RItem>
                <RItem testid="xl-clear-contents" onClick={() => { close(); act.clear('contents') }}>{s.clearContents}</RItem>
                <RItem testid="xl-clear-formats" onClick={() => { close(); act.clear('formats') }}>{s.clearFormats}</RItem>
              </div>}
            </RPopover>
            <RBtn label={s.sortAsc} testid="xl-sort-asc" disabled={dis} onClick={() => act.sort('asc')}>A↓</RBtn>
            <RBtn label={s.sortDesc} testid="xl-sort-desc" disabled={dis} onClick={() => act.sort('desc')}>Z↓</RBtn>
            <RBtn label={s.find} icon={<SearchIcon />} testid="xl-find" onClick={() => act.find()} />
          </RGroup>
        </>
      )}
      {t === 'insert' && (
        <>
          <RGroup label={s.chart}>
            {(['column', 'bar', 'line', 'area', 'pie', 'doughnut', 'scatter'] as ChartKind[]).map((k) => (
              <RBtn key={k} label={s[k]} wide testid={`xl-chart-${k}`} disabled={dis} onClick={() => act.chart(k)} icon={<ChartGlyph k={k} />} />
            ))}
          </RGroup>
          <RGroup label={s.insert}>
            <RBtn label={s.picture} wide icon={<ImageIcon />} testid="xl-insert-picture" disabled={dis} onClick={act.picture} />
            <RBtn label={s.link} wide icon={<LinkIcon />} testid="xl-insert-link" disabled={dis} onClick={act.link} />
            <RBtn label={s.note} wide icon={<EditIcon />} testid="xl-insert-note" disabled={dis} onClick={act.note} />
            <RBtn label={s.func} wide icon={<CalcIcon />} testid="xl-insert-fn" disabled={dis} onClick={act.insertFunction} />
          </RGroup>
        </>
      )}
      {t === 'data' && (
        <>
          <RGroup label={s.data}>
            <RBtn label={s.sortAsc} wide testid="xl-data-sort-asc" disabled={dis} onClick={() => act.sort('asc')} icon={<span>A↓</span>} />
            <RBtn label={s.sortDesc} wide testid="xl-data-sort-desc" disabled={dis} onClick={() => act.sort('desc')} icon={<span>Z↓</span>} />
            <RBtn label={s.filter} wide testid="xl-filter" onClick={act.filter} icon={<span>⏷</span>} />
            <RBtn label={s.clearFilter} testid="xl-clear-filter" onClick={act.clearFilters}>⨯⏷</RBtn>
          </RGroup>
          <RGroup label={s.protect}>
            <RBtn label={protectedSheet ? s.unprotectSheet : s.protectSheet} wide testid="xl-protect-sheet" active={protectedSheet} disabled={readOnly} onClick={act.protectSheet} icon={<span>{protectedSheet ? '🔒' : '🔓'}</span>} />
            <RBtn label={protectedBook ? s.unprotectBook : s.protectBook} wide testid="xl-protect-book" active={protectedBook} disabled={readOnly} onClick={act.protectBook} icon={<span>📘</span>} />
            <RBtn label={fmt.unlocked ? s.lockCells : s.unlockCells} wide testid="xl-lock-cells" active={!fmt.unlocked} disabled={readOnly || protectedSheet} onClick={act.lockCells} icon={<span>{fmt.unlocked ? '▢' : '▣'}</span>} />
          </RGroup>
          <RGroup label={s.cells}>
            <RBtn label={s.validation} wide icon={<ListIcon />} testid="xl-validation" disabled={dis} onClick={act.validation} />
            <RBtn label={s.removeDupes} wide icon={<TableIcon />} testid="xl-dedupe" disabled={dis} onClick={act.dedupe} />
            <RBtn label={s.textToCols} wide testid="xl-split" disabled={dis} onClick={act.split} icon={<span>⫼</span>} />
            <RBtn label={s.condFormat} wide icon={<PaletteIcon />} testid="xl-cond" disabled={dis} onClick={act.cond} />
          </RGroup>
        </>
      )}
      {t === 'formulas' && (
        <>
          <RGroup label={s.func}>
            <RBtn label={s.func} wide testid="xl-fn-dialog" icon={<CalcIcon />} disabled={dis} onClick={act.insertFunction} />
            <RPopover label={s.autosum} testid="xl-autosum-menu" trigger={<span>Σ ▾</span>}>
              {(close) => <div className="py-1 w-[160px]">{['SUM', 'AVERAGE', 'COUNT', 'MAX', 'MIN'].map((f) => <RItem key={f} testid={`xl-autosum-${f}`} onClick={() => { close(); act.autosum(f) }}>{f}</RItem>)}</div>}
            </RPopover>
            {FNS.slice(5, 12).map((f) => <RBtn key={f} label={f} short="" testid={`xl-fn-${f}`} disabled={dis} onClick={() => act.autosum('=' + f)}><span className="text-[0.74rem] font-mono">{f}</span></RBtn>)}
          </RGroup>
          <RGroup label={s.names}>
            <RBtn label={s.names} wide testid="xl-names" icon={<span>⟨a⟩</span>} onClick={act.names} />
            <RBtn label={s.showFormulas} wide testid="xl-show-formulas" active={showFormulas} onClick={act.showFormulas} icon={<span className="font-mono">fx</span>} />
          </RGroup>
        </>
      )}
      {t === 'view' && (
        <>
          <RGroup label={s.freeze}>
            <RBtn label={s.freezeTop} wide testid="xl-freeze-top" onClick={() => act.freeze('top')} icon={<span>▔</span>} />
            <RBtn label={s.freezeFirst} wide testid="xl-freeze-first" onClick={() => act.freeze('first')} icon={<span>▏</span>} />
            <RBtn label={s.freezeHere} wide testid="xl-freeze-here" onClick={() => act.freeze('here')} icon={<span>⌟</span>} />
            {sheetFreeze && <RBtn label={s.unfreeze} wide testid="xl-unfreeze" onClick={() => act.freeze('none')} icon={<span>✕</span>} />}
          </RGroup>
          <RGroup label={s.view}>
            <RBtn label={s.gridlines} wide testid="xl-gridlines" active={showGrid} onClick={act.gridlines} icon={<GridIcon />} />
            <RBtn label={s.rtlSheet} wide testid="xl-rtl" active={rtl} onClick={act.rtl} icon={<span>⇆</span>} />
            <RSelect label={s.zoom} testid="xl-zoom" width={72} value={String(Math.round(zoom * 100))} options={[50, 75, 90, 100, 110, 125, 150, 200].map((n) => ({ v: String(n), l: `${n}%` }))} onChange={(v) => act.zoom(+v / 100)} />
            <RBtn label={s.print} wide testid="xl-print" onClick={act.print} icon={<span>⎙</span>} />
          </RGroup>
        </>
      )}
      {t === 'chart' && chart && (
        <>
          <RGroup label={s.chartType}>
            {(['column', 'bar', 'line', 'area', 'pie', 'doughnut', 'scatter'] as ChartKind[]).map((k) => (
              <RBtn key={k} label={s[k]} testid={`xl-chart-type-${k}`} active={chart.kind === k} disabled={dis} onClick={() => act.chartPatch({ kind: k })} icon={<ChartGlyph k={k} />} />
            ))}
          </RGroup>
          <RGroup label={s.chart}>
            <input aria-label={s.chartTitle} data-testid="xl-chart-title" placeholder={s.chartTitle} defaultValue={chart.title || ''} key={chart.id + ':t'} disabled={dis}
              onBlur={(e) => act.chartPatch({ title: e.target.value || undefined })} onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
              className="h-8 w-[150px] px-2 rounded-sm border border-[color:var(--line)] bg-[var(--surface)] text-[0.85rem]" dir="auto" />
            <input aria-label={s.chartRange} data-testid="xl-chart-range" defaultValue={chart.range} key={chart.id + ':r' + chart.range} disabled={dis}
              onBlur={(e) => act.chartPatch({ range: e.target.value.toUpperCase(), series: undefined })} onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
              className="h-8 w-[90px] px-2 rounded-sm border border-[color:var(--line)] bg-[var(--surface)] text-[0.85rem] font-mono" dir="ltr" />
            <RBtn label={s.stacked} wide testid="xl-chart-stacked" active={!!chart.stacked} disabled={dis} onClick={() => act.chartPatch({ stacked: !chart.stacked })} icon={<span>▤</span>} />
            <RBtn label={s.legend} wide testid="xl-chart-legend" active={chart.legend !== false} disabled={dis} onClick={() => act.chartPatch({ legend: chart.legend === false })} icon={<span>☰</span>} />
            <RBtn label={s.deleteChart} wide testid="xl-chart-delete" disabled={dis} onClick={act.chartDelete} icon={<TrashIcon />} />
          </RGroup>
        </>
      )}
      {t === 'picture' && picture && (
        <RGroup label={s.picture}>
          <input aria-label={s.altText} data-testid="xl-picture-alt" placeholder={s.altText} defaultValue={picture.alt || ''} key={picture.id} disabled={dis}
            onBlur={(e) => act.picturePatch({ alt: e.target.value || undefined })} className="h-8 w-[200px] px-2 rounded-sm border border-[color:var(--line)] bg-[var(--surface)] text-[0.85rem]" dir="auto" />
          <RBtn label={s.deletePicture} wide testid="xl-picture-delete" disabled={dis} onClick={act.pictureDelete} icon={<TrashIcon />} />
        </RGroup>
      )}
    </Ribbon>
  )
})

function AlignGlyph({ k }: { k: 'start' | 'center' | 'end' }) {
  const lines = [16, 10, 16, 12]
  return (
    <svg viewBox="0 0 18 14" width={17} height={14} aria-hidden className="rtl:-scale-x-100">
      {lines.map((w, i) => <rect key={i} y={i * 3.6} height={1.8} width={w} x={k === 'start' ? 1 : k === 'end' ? 17 - w : (18 - w) / 2} fill="currentColor" rx={0.6} />)}
    </svg>
  )
}

function EraseGlyph() { return <svg viewBox="0 0 18 16" width={17} height={15} aria-hidden><path d="M6 14h10M3.5 10.5l6-7a1.5 1.5 0 0 1 2.1-.1l2.7 2.4a1.5 1.5 0 0 1 .1 2.1L9 14H5.6z" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinejoin="round" /></svg> }

export function ChartGlyph({ k }: { k: ChartKind }) {
  const c = 'currentColor'
  return (
    <svg viewBox="0 0 18 16" width={17} height={15} aria-hidden>
      {k === 'column' && <><rect x={2} y={7} width={3} height={8} fill={c} /><rect x={7} y={3} width={3} height={12} fill={c} /><rect x={12} y={9} width={3} height={6} fill={c} /></>}
      {k === 'bar' && <><rect x={1} y={2} width={9} height={3} fill={c} /><rect x={1} y={6.5} width={15} height={3} fill={c} /><rect x={1} y={11} width={6} height={3} fill={c} /></>}
      {k === 'line' && <polyline points="1,13 6,7 10,10 17,2" fill="none" stroke={c} strokeWidth={1.8} />}
      {k === 'area' && <polygon points="1,15 1,10 6,5 11,9 17,3 17,15" fill={c} opacity={0.75} />}
      {k === 'pie' && <><circle cx={9} cy={8} r={7} fill="none" stroke={c} strokeWidth={1.6} /><path d="M9 8V1A7 7 0 0 1 15.6 10.3z" fill={c} /></>}
      {k === 'doughnut' && <circle cx={9} cy={8} r={5.5} fill="none" stroke={c} strokeWidth={3} strokeDasharray="20 15" />}
      {k === 'scatter' && <>{[[3, 12], [6, 8], [9, 10], [12, 5], [15, 3], [8, 4]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r={1.6} fill={c} />)}</>}
    </svg>
  )
}
