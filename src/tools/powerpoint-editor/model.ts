// The presentation as the editor stores it: plain JSON, our own format.
//
// A .pptx is IMPORTED into this and EXPORTED from it — both explicit, both with
// a loss ledger — rather than edited in place, which is the Kafani contract the
// spreadsheet and the word processor follow too. Owning the model is what keeps
// it small: no slide masters to edit, no 30-year-old corners of DrawingML.
//
// Units are POINTS throughout (1/72 inch), the unit a slide is thought of in:
// a 16:9 slide is 960 × 540 pt, a font is 18 pt. An EMU is a scale factor away
// (12 700 per point) so the converters never round twice.
//
// Colours are a `Paint`: '#rrggbb', or the NAME of a theme slot ('accent1',
// 'dk1', …). Keeping the slot rather than resolving it on import is what lets
// the Design tab recolour a whole deck by changing the theme — a deck whose
// colours were baked to hex cannot be re-themed. A slot with lum/tint changes
// applied in the file is resolved to hex, since our model has no modifiers.
import { DEFAULT_THEME, applyMods, type ThemeColors } from '../../lib/office/color'

export type Paint = string
export type ThemeSlot = keyof ThemeColors

export interface Theme {
  name: string
  colors: ThemeColors
  /** `major` is for titles, `minor` for body text — the two theme fonts. */
  fonts: { major: string; minor: string }
}

export interface Run {
  t: string
  b?: boolean; i?: boolean; u?: boolean; s?: boolean
  sup?: boolean; sub?: boolean
  color?: Paint
  highlight?: Paint
  /** Points. */
  size?: number
  /** A family name, or 'major' / 'minor' for the theme's. */
  font?: string
  link?: string
}

export type Align = 'l' | 'ctr' | 'r' | 'just'
export interface Para {
  runs: Run[]
  align?: Align
  /** 0–8, the outline level. */
  level?: number
  bullet?: 'bullet' | 'number' | null
  /** A bullet's own character, when it is not the default. */
  char?: string
  /** First number of a numbered list starting here. */
  start?: number
  /** Number scheme: 'arabicPeriod', 'alphaLcParenR', 'arabicDbPlain' (Arabic-Indic)… as DrawingML names them. */
  scheme?: string
  rtl?: boolean
  /** Percent of single line spacing (100 = single). */
  lineSpacing?: number
  spaceBefore?: number
  spaceAfter?: number
  /** The size an EMPTY paragraph has, so a blank line keeps its height. */
  size?: number
}

/** Defaults a text body inherited from its placeholder, layout and master, resolved at import. */
export interface TextDefaults { size?: number; color?: Paint; font?: string; b?: boolean; align?: Align; bullet?: 'bullet' | 'number' | null; levels?: { size?: number; bullet?: 'bullet' | 'number' | null }[] }

export interface TextBody {
  paras: Para[]
  anchor?: 't' | 'ctr' | 'b'
  /** Insets in points: left, top, right, bottom. */
  inset?: [number, number, number, number]
  /** shrink: the text is scaled to fit; resize: the box grows to fit the text. */
  autofit?: 'shrink' | 'resize' | 'none'
  /** For `shrink`, the scale the file asked for (1 = none). */
  fontScale?: number
  wrap?: boolean
  vertical?: boolean
  defaults?: TextDefaults
}

export type Fill =
  | { type: 'none' }
  | { type: 'solid'; color: Paint; alpha?: number }
  | { type: 'grad'; stops: { pos: number; color: Paint }[]; angle: number }
  | { type: 'image'; media: string }

export type Dash = 'solid' | 'dash' | 'dot' | 'dashDot' | 'lgDash'
export type ArrowEnd = 'none' | 'triangle' | 'arrow' | 'stealth' | 'oval' | 'diamond'
export interface Line { color?: Paint; width?: number; dash?: Dash; head?: ArrowEnd; tail?: ArrowEnd }

export type Placeholder = 'title' | 'ctrTitle' | 'subTitle' | 'body' | 'obj' | 'dt' | 'ftr' | 'sldNum' | 'pic'

interface Base {
  id: string
  /** Stacking order among the slide's elements — see order.ts. */
  ord?: string
  x: number; y: number; w: number; h: number
  /** Degrees clockwise. */
  rot?: number
  flipH?: boolean; flipV?: boolean
  name?: string
  alt?: string
  /** Click-through link (a URL, or '#slide:<id>'). */
  link?: string
}

export interface ShapeEl extends Base {
  kind: 'shape'
  /** A DrawingML preset name: rect, roundRect, ellipse, triangle, rightArrow, line… */
  geom: string
  /** Adjust values in the preset's own units (1/100000ths), when not the default. */
  adj?: number[]
  fill?: Fill
  /** Absent = the default outline; null = no outline. */
  line?: Line | null
  text?: TextBody
  ph?: Placeholder
  shadow?: boolean
}

export interface ImageEl extends Base {
  kind: 'image'
  media: string
  /** Fractions of the picture cut off each side. */
  crop?: { l: number; t: number; r: number; b: number }
  line?: Line | null
  /** Rounded or circular picture frames, as a preset. */
  geom?: string
}

export interface Cell {
  text: TextBody
  fill?: Paint
  /** [rows, cols] this cell spans; a covered cell carries `merged`. */
  span?: [number, number]
  merged?: boolean
}
export interface TableEl extends Base {
  kind: 'table'
  cols: number[]
  rows: { h: number; cells: Cell[] }[]
  /** The look PowerPoint's table styles give: a filled header row and banded rows, in one accent. */
  style?: { header?: boolean; banded?: boolean; accent?: Paint; borders?: Paint }
}

export type El = ShapeEl | ImageEl | TableEl

export type TransitionKind = 'none' | 'fade' | 'push' | 'wipe' | 'cover' | 'zoom'
export interface Slide {
  id: string
  /** Position in the deck — see order.ts. */
  ord?: string
  elements: El[]
  bg?: Fill
  notes?: string
  hidden?: boolean
  transition?: { kind: TransitionKind; dur?: number }
  /** The layout it was made from — what "reset slide" and export name it by. */
  layout?: LayoutKind
  /** Shared decoration drawn underneath (an imported layout/master's logo and bars). */
  master?: string
}

export interface Master { id: string; name: string; bg?: Fill; elements: El[] }

export interface Media { mime: string; data: string }

export interface DeckData {
  size: { w: number; h: number }
  theme: Theme
  slides: Slide[]
  media: Record<string, Media>
  masters?: Master[]
  rtl?: boolean
  lang?: string
  footer?: { text?: string; number?: boolean; date?: boolean }
}

export type LayoutKind = 'title' | 'titleContent' | 'section' | 'twoContent' | 'titleOnly' | 'blank' | 'bigNumber' | 'quote'
export const LAYOUTS: LayoutKind[] = ['title', 'titleContent', 'section', 'twoContent', 'titleOnly', 'blank', 'bigNumber', 'quote']

export const SIZE_169 = { w: 960, h: 540 }
export const SIZE_43 = { w: 720, h: 540 }

export const DEFAULT_DECK_THEME: Theme = {
  name: 'Office',
  colors: { ...DEFAULT_THEME },
  fonts: { major: 'Calibri Light', minor: 'Calibri' },
}

export const SLOTS: ThemeSlot[] = ['dk1', 'lt1', 'dk2', 'lt2', 'accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6', 'hlink', 'folHlink']
/** The aliases a file uses for the slots: tx1 is dk1 under the default colour map, bg1 is lt1. */
const ALIAS: Record<string, ThemeSlot> = { tx1: 'dk1', tx2: 'dk2', bg1: 'lt1', bg2: 'lt2', phClr: 'accent1' }
export const slotOf = (s: string): ThemeSlot | null => (SLOTS as string[]).includes(s) ? (s as ThemeSlot) : ALIAS[s] || null

/** Paint → '#rrggbb' under a theme. */
export function paint(p: Paint | undefined, theme: Theme, fallback = '#000000'): string {
  if (!p) return fallback
  if (p.startsWith('#')) return p
  const slot = slotOf(p)
  return slot ? theme.colors[slot] : fallback
}
/** A slot lightened or darkened, as the colour pickers offer them; resolved to hex. */
export function shade(p: Paint, theme: Theme, lumMod: number, lumOff = 0): string {
  return applyMods(paint(p, theme), { lumMod, lumOff })
}

export const isRtlText = (t: string) => {
  for (const ch of t) {
    if (/[֐-ࣿיִ-﷿ﹰ-﻿]/.test(ch)) return true
    if (/[A-Za-zÀ-ɏͰ-ϿЀ-ӿ]/.test(ch)) return false
  }
  return false
}

let seq = 0
export function newId(prefix = 'e'): string {
  seq = (seq + 1) % 1e6
  const r = typeof crypto !== 'undefined' && 'getRandomValues' in crypto ? Array.from(crypto.getRandomValues(new Uint8Array(5)), (b) => b.toString(36).padStart(2, '0')).join('').slice(0, 8) : Math.random().toString(36).slice(2, 10)
  return `${prefix}${r}${seq.toString(36)}`
}

export const para = (t = '', extra: Partial<Para> = {}): Para => ({ runs: t ? [{ t }] : [], ...extra })
export const body = (paras: Para[], extra: Partial<TextBody> = {}): TextBody => ({ paras: paras.length ? paras : [para()], ...extra })

export function plainText(b: TextBody | undefined): string {
  return (b?.paras || []).map((p) => p.runs.map((r) => r.t).join('')).join('\n')
}
export function slideText(s: Slide): string {
  const out: string[] = []
  for (const e of s.elements) {
    if (e.kind === 'shape' && e.text) out.push(plainText(e.text))
    if (e.kind === 'table') for (const r of e.rows) for (const c of r.cells) if (!c.merged) out.push(plainText(c.text))
  }
  return out.filter(Boolean).join('\n')
}
export function slideTitle(s: Slide): string {
  const t = s.elements.find((e): e is ShapeEl => e.kind === 'shape' && (e.ph === 'title' || e.ph === 'ctrTitle'))
  return plainText(t?.text).split('\n')[0] || ''
}

// ---- layouts --------------------------------------------------------------------

export interface LayoutWords { title: string; subtitle: string; body: string; section: string; number: string; caption: string; quote: string; author: string }
export const LAYOUT_WORDS: Record<'en' | 'ar', LayoutWords> = {
  en: { title: 'Click to add title', subtitle: 'Click to add subtitle', body: 'Click to add text', section: 'Section title', number: '100%', caption: 'What the number means', quote: '“A sentence worth remembering.”', author: '— Who said it' },
  ar: { title: 'انقر لإضافة عنوان', subtitle: 'انقر لإضافة عنوان فرعي', body: 'انقر لإضافة نص', section: 'عنوان القسم', number: '١٠٠٪', caption: 'ما يعنيه الرقم', quote: '«جملة تستحق أن تُذكر.»', author: '— قائلها' },
}

/**
 * The elements a new slide of a layout starts with. Placeholders start EMPTY;
 * the prompt is drawn by the renderer while they are empty, never stored as text
 * — prompt text that became content is the classic stray "Click to add title"
 * left in a deck someone presented.
 */
export function layoutElements(kind: LayoutKind, size: { w: number; h: number }, rtl: boolean): El[] {
  const W = size.w
  const H = size.h
  const m = W * 0.065
  const ph = (p: Placeholder, x: number, y: number, w: number, h: number, d: TextDefaults, anchor: TextBody['anchor'] = 't'): ShapeEl => ({
    id: newId('p'), kind: 'shape', geom: 'rect', x, y, w, h, ph: p, line: null, fill: { type: 'none' },
    text: { paras: [para('', { align: d.align, rtl: rtl || undefined, bullet: d.bullet ?? null })], anchor, autofit: 'shrink', defaults: d },
  })
  const title = (y: number, h: number, size = 40) => ph('title', m, y, W - 2 * m, h, { size, font: 'major', color: 'dk1' }, 'b')
  const bodyD: TextDefaults = { size: 24, color: 'dk1', bullet: 'bullet', levels: [{ size: 24 }, { size: 20 }, { size: 18 }, { size: 16 }, { size: 16 }] }
  switch (kind) {
    case 'title':
      return [
        ph('ctrTitle', m * 1.4, H * 0.22, W - 2.8 * m, H * 0.36, { size: 54, font: 'major', color: 'dk1', align: 'ctr' }, 'b'),
        ph('subTitle', m * 1.4, H * 0.6, W - 2.8 * m, H * 0.2, { size: 24, color: 'dk2', align: 'ctr', bullet: null }, 't'),
      ]
    case 'titleContent':
      return [title(H * 0.05, H * 0.18), ph('body', m, H * 0.27, W - 2 * m, H * 0.64, bodyD)]
    case 'section':
      return [
        ph('title', m, H * 0.3, W - 2 * m, H * 0.3, { size: 54, font: 'major', color: 'accent1' }, 'b'),
        ph('body', m, H * 0.62, W - 2 * m, H * 0.16, { size: 24, color: 'dk2', bullet: null }, 't'),
      ]
    case 'twoContent': {
      const gap = m * 0.5
      const cw = (W - 2 * m - gap) / 2
      return [title(H * 0.05, H * 0.18), ph('body', m, H * 0.27, cw, H * 0.64, bodyD), ph('body', m + cw + gap, H * 0.27, cw, H * 0.64, bodyD)]
    }
    case 'titleOnly':
      return [title(H * 0.05, H * 0.18)]
    case 'bigNumber':
      return [
        ph('title', m, H * 0.12, W - 2 * m, H * 0.46, { size: 120, font: 'major', color: 'accent1', align: 'ctr', b: true }, 'b'),
        ph('body', m, H * 0.6, W - 2 * m, H * 0.22, { size: 28, color: 'dk2', align: 'ctr', bullet: null }, 't'),
      ]
    case 'quote':
      return [
        ph('title', m * 1.6, H * 0.16, W - 3.2 * m, H * 0.5, { size: 40, font: 'major', color: 'dk1', align: 'ctr' }, 'ctr'),
        ph('body', m * 1.6, H * 0.7, W - 3.2 * m, H * 0.14, { size: 20, color: 'accent1', align: 'ctr', bullet: null }, 't'),
      ]
    case 'blank':
    default:
      return []
  }
}

export function newSlide(kind: LayoutKind, deck: Pick<DeckData, 'size' | 'rtl'>): Slide {
  return { id: newId('s'), elements: layoutElements(kind, deck.size, !!deck.rtl), layout: kind }
}

/** Which prompt a placeholder shows while empty. */
export function promptFor(ph: Placeholder | undefined, layout: LayoutKind | undefined, w: LayoutWords, index: number): string {
  if (!ph) return ''
  if (layout === 'bigNumber') return ph === 'title' ? w.number : w.caption
  if (layout === 'quote') return ph === 'title' ? w.quote : w.author
  if (layout === 'section' && ph === 'title') return w.section
  if (ph === 'title' || ph === 'ctrTitle') return w.title
  if (ph === 'subTitle') return w.subtitle
  if (ph === 'body' || ph === 'obj') return index >= 0 ? w.body : w.body
  return ''
}

export function blankDeck(rtl: boolean): DeckData {
  const d: DeckData = { size: { ...SIZE_169 }, theme: { ...DEFAULT_DECK_THEME, colors: { ...DEFAULT_DECK_THEME.colors }, fonts: { ...DEFAULT_DECK_THEME.fonts } }, slides: [], media: {}, rtl, lang: rtl ? 'ar-SA' : 'en-US' }
  d.slides.push(newSlide('title', d))
  return d
}

/** Media no element refers to any more, so a save does not keep pictures that were deleted. */
export function usedMedia(d: DeckData): Set<string> {
  const out = new Set<string>()
  const els = [...d.slides.flatMap((s) => s.elements), ...(d.masters || []).flatMap((m) => m.elements)]
  for (const e of els) { if (e.kind === 'image') out.add(e.media); if (e.kind === 'shape' && e.fill?.type === 'image') out.add(e.fill.media) }
  for (const f of [...d.slides.map((s) => s.bg), ...(d.masters || []).map((m) => m.bg)]) if (f?.type === 'image') out.add(f.media)
  return out
}
