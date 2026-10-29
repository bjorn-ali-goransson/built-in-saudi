// How a cell looks: its text as formatted, and the CSS that draws it. Pure, so
// the rules (numbers to the end, errors centred, a format's [Red]) are tested
// without rendering a grid.
import { formatCell, formatColor } from '../engine/numfmt'
import { isError, borderSides, type CellFormat, type CellValue } from '../engine/model'
import { displayValue } from '../engine/workbook'
import type { CSSProperties } from 'react'

export const BASE_FONT_PT = 10

export interface Look {
  text: string
  /** 'start' | 'center' | 'end', in the sheet's own direction. */
  align: 'start' | 'center' | 'end'
  style: CSSProperties
  isNumber: boolean
}

const BD_STYLE: Record<string, string> = {
  thin: '1px solid', hair: '1px solid', medium: '2px solid', thick: '3px solid',
  dashed: '1px dashed', mediumDashed: '2px dashed', dotted: '1px dotted', double: '3px double',
  dashDot: '1px dashed', mediumDashDot: '2px dashed', dashDotDot: '1px dotted', slantDashDot: '2px dashed',
}

export function borderCss(fmt: CellFormat | undefined): CSSProperties {
  const out: CSSProperties = {}
  if (!fmt) return out
  if (fmt.bd) {
    const side = (k: 't' | 'r' | 'b' | 'l') => { const b = fmt.bd![k]; return b ? `${BD_STYLE[b.s] || '1px solid'} ${b.c || '#000'}` : undefined }
    if (fmt.bd.t) out.borderTop = side('t')
    if (fmt.bd.b) out.borderBottom = side('b')
    // Left and right are PHYSICAL in a file; the grid is laid out logically, and an
    // RTL sheet mirrors — so they map to inline start/end the way the grid does.
    if (fmt.bd.l) out.borderInlineStart = side('l')
    if (fmt.bd.r) out.borderInlineEnd = side('r')
    return out
  }
  const s = borderSides(fmt.border)
  const line = '1px solid var(--ink)'
  if (s.t) out.borderTop = line
  if (s.b) out.borderBottom = line
  if (s.l) out.borderInlineStart = line
  if (s.r) out.borderInlineEnd = line
  return out
}

export function cellLook(v: CellValue, fmt: CellFormat | undefined, opts: { zoom: number; showFormula?: string; condBg?: string }): Look {
  let text: string
  let isNumber = false
  if (opts.showFormula !== undefined) text = opts.showFormula
  else if (isError(v)) text = v.kind
  else if (typeof v === 'number') { text = formatCell(v, fmt); isNumber = true }
  else if (typeof v === 'boolean') text = displayValue(v)
  else text = fmt ? formatCell(v, fmt) : displayValue(v)
  const natural: Look['align'] = opts.showFormula !== undefined ? 'start' : isError(v) || typeof v === 'boolean' ? 'center' : isNumber ? 'end' : 'start'
  const align = fmt?.align || natural
  const style: CSSProperties = {}
  const pt = fmt?.fontSize || BASE_FONT_PT
  style.fontSize = `${(pt * 4 / 3 * opts.zoom).toFixed(2)}px`
  if (fmt?.bold) style.fontWeight = 700
  if (fmt?.italic) style.fontStyle = 'italic'
  const deco = [fmt?.underline && 'underline', fmt?.strike && 'line-through'].filter(Boolean).join(' ')
  if (deco) style.textDecoration = deco
  if (fmt?.fontFamily) style.fontFamily = `"${fmt.fontFamily}", var(--font-body)`
  const fc = opts.showFormula === undefined ? formatColor(v, fmt) : undefined
  if (fc) style.color = fc
  else if (fmt?.color) style.color = fmt.color
  else if (isError(v)) style.color = 'var(--danger)'
  const bg = opts.condBg || fmt?.bg
  if (bg) style.background = bg
  if (fmt?.indent) style.paddingInlineStart = `${(3 + fmt.indent * 9) * opts.zoom}px`
  Object.assign(style, borderCss(fmt))
  return { text, align, style, isNumber }
}

/** Hash marks, as Excel shows a number that does not fit its column. */
export function overflowHashes(width: number, zoom: number): string {
  return '#'.repeat(Math.max(1, Math.floor(width / (7 * zoom))))
}

/** A colour on a two- or three-point scale, for colour-scale conditional formats. */
export function scaleColor(t: number, three: boolean): string {
  const clamp = Math.max(0, Math.min(1, t))
  const lerp = (a: number[], b: number[], k: number) => a.map((x, i) => Math.round(x + (b[i] - x) * k))
  const red = [248, 105, 107]
  const yellow = [255, 235, 132]
  const green = [99, 190, 123]
  const white = [252, 252, 255]
  const c = three ? (clamp < 0.5 ? lerp(red, yellow, clamp * 2) : lerp(yellow, green, (clamp - 0.5) * 2)) : lerp(white, green, clamp)
  return `rgb(${c[0]},${c[1]},${c[2]})`
}
