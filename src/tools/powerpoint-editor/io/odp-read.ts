// OpenDocument presentation (.odp) — LibreOffice Impress's own format, and
// what Google Slides and many government machines hand over. Read here; the
// editor writes .pptx, which Impress opens.
//
// ODP says what a .pptx says, differently enough to trip a reader:
//  - Formatting lives in NAMED styles (T1, P4, gr2), resolved through their
//    parents, and a shape's fill and outline are in its GRAPHIC style rather
//    than on the shape.
//  - A rotated shape has no x/y. `draw:transform="rotate (a) translate (x y)"`
//    turns it COUNTER-clockwise, in RADIANS, about its top-left corner, and then
//    moves that corner. Our model turns clockwise in degrees about the centre,
//    so the centre is computed from the transform and the box rebuilt round it.
//  - A group's children carry ABSOLUTE positions, so a group flattens without
//    any arithmetic — unlike DrawingML's child coordinate space.
//  - Placeholders are `presentation:class` (title, subtitle, outline), and an
//    EMPTY one (`presentation:placeholder="true"`) is a prompt, not content.
//  - A merged table cell leaves `covered-table-cell` placeholders that must be
//    kept as covered cells, or every merge shifts the rest of its row.
import { zipEntries, readEntry } from '../../../lib/unzip'
import { parseXml, kids, attr, isEl, textOf, type XEl } from '../../../lib/xml'
import { sniffImage, dataUrl, OpcError } from '../../../lib/office/opc'
import { isKnownPreset } from '../geom'
import { DEFAULT_DECK_THEME, isRtlText, newId, slideTitle, type Align, type Cell, type DeckData, type El, type Fill, type ImageEl, type LayoutKind, type Line, type Master, type Para, type Placeholder, type Run, type ShapeEl, type Slide, type TableEl, type TextBody, type TransitionKind } from '../model'
import { spread } from '../order'
import type { Loss, PptxImport } from './pptx-read'

const NS = {
  office: 'urn:oasis:names:tc:opendocument:xmlns:office:1.0',
  style: 'urn:oasis:names:tc:opendocument:xmlns:style:1.0',
  text: 'urn:oasis:names:tc:opendocument:xmlns:text:1.0',
  table: 'urn:oasis:names:tc:opendocument:xmlns:table:1.0',
  draw: 'urn:oasis:names:tc:opendocument:xmlns:drawing:1.0',
  fo: 'urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0',
  xlink: 'http://www.w3.org/1999/xlink',
  svg: 'urn:oasis:names:tc:opendocument:xmlns:svg-compatible:1.0',
  presentation: 'urn:oasis:names:tc:opendocument:xmlns:presentation:1.0',
  smil: 'urn:oasis:names:tc:opendocument:xmlns:smil-compatible:1.0',
  dc: 'http://purl.org/dc/elements/1.1/',
  manifest: 'urn:oasis:names:tc:opendocument:xmlns:manifest:1.0',
  loext: 'urn:org:documentfoundation:names:experimental:office:xmlns:loext:1.0',
}

/** A length in any ODF unit, as points. */
export function len(v: string | undefined): number | undefined {
  if (!v) return undefined
  const m = v.trim().match(/^(-?[\d.]+)(cm|mm|in|pt|pc|px)?$/)
  if (!m) return undefined
  const n = +m[1]
  return m[2] === 'cm' ? n * 28.3465 : m[2] === 'mm' ? n * 2.83465 : m[2] === 'in' ? n * 72 : m[2] === 'pc' ? n * 12 : m[2] === 'px' ? n * 0.75 : n
}
const r2 = (n: number) => Math.round(n * 100) / 100

/** ODF's shape names → DrawingML presets. LibreOffice also writes `ooxml-<preset>` for shapes that came from a .pptx. */
const GEOM: Record<string, string> = {
  rectangle: 'rect', 'round-rectangle': 'roundRect', ellipse: 'ellipse', circle: 'ellipse', 'isosceles-triangle': 'triangle',
  'right-triangle': 'rtTriangle', diamond: 'diamond', pentagon: 'homePlate', hexagon: 'hexagon', octagon: 'octagon',
  parallelogram: 'parallelogram', trapezoid: 'trapezoid', 'right-arrow': 'rightArrow', 'left-arrow': 'leftArrow',
  'up-arrow': 'upArrow', 'down-arrow': 'downArrow', 'left-right-arrow': 'leftRightArrow', 'up-down-arrow': 'upDownArrow',
  chevron: 'chevron', star5: 'star5', star4: 'star4', star6: 'star6', star8: 'star8', heart: 'heart', smiley: 'smileyFace',
  cloud: 'cloud', 'flowchart-process': 'flowChartProcess', 'flowchart-decision': 'flowChartDecision', 'flowchart-terminator': 'flowChartTerminator',
  'round-rectangular-callout': 'wedgeRoundRectCallout', 'rectangular-callout': 'wedgeRectCallout', 'round-callout': 'wedgeEllipseCallout',
  'mso-spt100': 'rect', frame: 'frame', ring: 'donut', cross: 'plus', moon: 'moon', 'block-arc': 'blockArc',
}
const SCHEME: Record<string, string> = { '1': 'arabicPeriod', a: 'alphaLcPeriod', A: 'alphaUcPeriod', i: 'romanLcPeriod', I: 'romanUcPeriod', '١, ٢, ٣, ...': 'arabicDbPlain' }
const TRANSITION: Record<string, TransitionKind> = { fade: 'fade', pushWipe: 'push', barWipe: 'wipe', slideWipe: 'cover', zoom: 'zoom', irisWipe: 'zoom' }

interface Props { [k: string]: string | undefined }
interface OStyle { name: string; family: string; parent?: string; graphic: Props; para: Props; text: Props; page: Props; listStyle?: string; cell: Props; col: Props; row: Props }
interface ListLevel { number: boolean; char?: string; fmt?: string; start?: number }

class OdpReader {
  styles = new Map<string, OStyle>()
  lists = new Map<string, ListLevel[]>()
  gradients = new Map<string, { start: string; end: string; angle: number }>()
  pageLayouts = new Map<string, { w: number; h: number }>()
  masterPages = new Map<string, { layout?: string; style?: string; el: XEl }>()
  manifest = new Map<string, string>()
  images = new Map<string, Uint8Array>()
  media: DeckData['media'] = {}
  mediaByPath = new Map<string, string | null>()
  loss = new Map<string, number>()
  lose(w: string, n = 1) { this.loss.set(w, (this.loss.get(w) || 0) + n) }

  readStyles(root: XEl | null) {
    if (!root) return
    const visit = (el: XEl) => {
      for (const c of el.children) {
        if (!isEl(c)) continue
        if (c.ns === NS.style && c.local === 'style') {
          const name = attr(c, 'name', NS.style)!
          const st: OStyle = { name, family: attr(c, 'family', NS.style) || '', parent: attr(c, 'parent-style-name', NS.style), graphic: {}, para: {}, text: {}, page: {}, cell: {}, col: {}, row: {}, listStyle: attr(c, 'list-style-name', NS.style) }
          for (const p of c.children) {
            if (!isEl(p)) continue
            const into = p.local === 'graphic-properties' ? st.graphic : p.local === 'paragraph-properties' ? st.para : p.local === 'text-properties' ? st.text : p.local === 'drawing-page-properties' ? st.page : p.local === 'table-cell-properties' ? st.cell : p.local === 'table-column-properties' ? st.col : p.local === 'table-row-properties' ? st.row : null
            if (into) for (const [k, v] of Object.entries(p.attrs)) into[k.replace(/^.*:/, '')] = v
            // A presentation or graphic style can carry its own list style inline.
            if (p.local === 'graphic-properties') for (const l of kids(p, NS.text, 'list-style')) this.readList(l, `${st.family}:${name}`)
          }
          this.styles.set(`${st.family}:${name}`, st)
        } else if (c.ns === NS.text && c.local === 'list-style') this.readList(c)
        else if (c.ns === NS.draw && c.local === 'gradient') {
          this.gradients.set(attr(c, 'name', NS.draw)!, { start: attr(c, 'start-color', NS.draw) || '#ffffff', end: attr(c, 'end-color', NS.draw) || '#000000', angle: parseFloat(attr(c, 'angle', NS.draw) || '0') })
        } else if (c.ns === NS.style && c.local === 'page-layout') {
          const p = kids(c, NS.style, 'page-layout-properties')[0]
          const w = len(attr(p, 'page-width', NS.fo)), h = len(attr(p, 'page-height', NS.fo))
          if (w && h) this.pageLayouts.set(attr(c, 'name', NS.style)!, { w, h })
        } else if (c.ns === NS.style && c.local === 'master-page') {
          this.masterPages.set(attr(c, 'name', NS.style)!, { layout: attr(c, 'page-layout-name', NS.style), style: attr(c, 'style-name', NS.draw), el: c })
        } else visit(c)
      }
    }
    visit(root)
  }
  readList(el: XEl, key?: string) {
    const levels: ListLevel[] = []
    for (const l of el.children) {
      if (!isEl(l)) continue
      const n = +(attr(l, 'level', NS.text) || '1') - 1
      if (l.local === 'list-level-style-number') levels[n] = { number: true, fmt: attr(l, 'num-format', NS.style), start: +(attr(l, 'start-value', NS.text) || '1') }
      else if (l.local === 'list-level-style-bullet') levels[n] = { number: false, char: attr(l, 'bullet-char', NS.text) }
    }
    this.lists.set(key || attr(el, 'name', NS.style)!, levels)
  }

  /** A property, looked up through the style and its parents. */
  prop(family: string, name: string | undefined, group: 'graphic' | 'para' | 'text' | 'page' | 'cell' | 'col' | 'row', key: string): string | undefined {
    let seen = 0
    while (name && seen++ < 20) {
      const st = this.styles.get(`${family}:${name}`)
      if (!st) return undefined
      const v = st[group][key]
      if (v !== undefined) return v
      name = st.parent
    }
    return undefined
  }
  /** The list style a shape's own style implies for text that is not in an explicit list. */
  listFor(family: string, name: string | undefined): ListLevel[] | undefined {
    let seen = 0
    while (name && seen++ < 20) {
      const st = this.styles.get(`${family}:${name}`)
      if (!st) return undefined
      if (st.listStyle && this.lists.has(st.listStyle)) return this.lists.get(st.listStyle)
      if (this.lists.has(`${family}:${name}`)) return this.lists.get(`${family}:${name}`)
      name = st.parent
    }
    return undefined
  }

  // ---- text -----------------------------------------------------------------
  run(textStyle: string | undefined, paraStyle: string | undefined): Omit<Run, 't'> {
    const g = (k: string) => this.prop('text', textStyle, 'text', k) ?? this.prop('paragraph', paraStyle, 'text', k)
    const r: Omit<Run, 't'> = {}
    const w = g('font-weight'); if (w === 'bold' || (w && +w >= 600)) r.b = true
    if (g('font-style') === 'italic') r.i = true
    const u = g('text-underline-style'); if (u && u !== 'none') r.u = true
    const s = g('text-line-through-style'); if (s && s !== 'none') r.s = true
    const c = g('color'); if (c && /^#[0-9a-f]{6}$/i.test(c)) r.color = c.toLowerCase()
    const size = len(g('font-size')); if (size) r.size = r2(size)
    const f = g('font-name') || g('font-family'); if (f) r.font = f.replace(/^'|'$/g, '')
    const pos = g('text-position'); if (pos) { if (/^super|^[1-9]/.test(pos)) r.sup = true; else if (/^sub|^-/.test(pos)) r.sub = true }
    const bg = g('background-color'); if (bg && /^#[0-9a-f]{6}$/i.test(bg)) r.highlight = bg.toLowerCase()
    return r
  }
  runs(el: XEl, base: Omit<Run, 't'>, textStyle: string | undefined, paraStyle: string | undefined, out: Run[], link?: string) {
    const push = (t: string, extra: Omit<Run, 't'>) => {
      if (!t) return
      const r: Run = { t, ...extra }
      if (link) r.link = link
      const last = out[out.length - 1]
      // Adjacent runs with the same look are one run, as an editor would have written them.
      if (last && last.t !== '\n' && t !== '\n' && JSON.stringify({ ...last, t: '' }) === JSON.stringify({ ...r, t: '' })) last.t += t
      else out.push(r)
    }
    for (const c of el.children) {
      if (typeof c === 'string') { push(c.replace(/[\r\n\t]+/g, ' ').replace(/ {2,}/g, ' '), base); continue }
      if (c.ns === NS.text && c.local === 'span') { const ts = attr(c, 'style-name', NS.text); this.runs(c, { ...base, ...this.run(ts, paraStyle) }, ts, paraStyle, out, link); continue }
      if (c.ns === NS.text && c.local === 'a') {
        const href = attr(c, 'href', NS.xlink)
        this.runs(c, base, textStyle, paraStyle, out, href && /^(https?:|mailto:)/i.test(href) ? href : link)
        continue
      }
      if (c.ns === NS.text && c.local === 's') { push(' '.repeat(+(attr(c, 'c', NS.text) || '1')), base); continue }
      if (c.ns === NS.text && c.local === 'tab') { push('\t', base); continue }
      if (c.ns === NS.text && c.local === 'line-break') { out.push({ t: '\n' }); continue }
      if (c.ns === NS.text && (c.local === 'page-number' || c.local === 'date' || c.local === 'time')) { push(textOf(c), base); continue }
      this.runs(c, base, textStyle, paraStyle, out, link)
    }
  }
  para(p: XEl, level: number, list: ListLevel[] | undefined, inList: boolean): Para {
    const ps = attr(p, 'style-name', NS.text)
    const runs: Run[] = []
    this.runs(p, this.run(undefined, ps), undefined, ps, runs)
    // Whitespace at the very edges of a paragraph is XML layout, not content.
    if (runs[0]?.t !== '\n' && runs[0]) runs[0].t = runs[0].t.replace(/^ +/, '')
    const last = runs[runs.length - 1]
    if (last && last.t !== '\n') last.t = last.t.replace(/ +$/, '')
    const out: Para = { runs: runs.filter((r) => r.t) }
    const wm = this.prop('paragraph', ps, 'para', 'writing-mode')
    const rtl = wm ? wm.startsWith('rl') : isRtlText(out.runs.map((r) => r.t).join(''))
    if (rtl) out.rtl = true
    const a = this.prop('paragraph', ps, 'para', 'text-align')
    const align: Align | undefined = a === 'center' ? 'ctr' : a === 'justify' ? 'just' : a === 'end' ? (rtl ? 'l' : 'r') : a === 'right' ? 'r' : a === 'left' ? 'l' : a === 'start' ? (rtl ? 'r' : 'l') : undefined
    if (align) out.align = align
    if (level) out.level = level
    if (inList) {
      const lv = list?.[level] || list?.[0]
      if (lv?.number) { out.bullet = 'number'; if (lv.fmt && SCHEME[lv.fmt] && SCHEME[lv.fmt] !== 'arabicPeriod') out.scheme = SCHEME[lv.fmt]; if (lv.start && lv.start !== 1) out.start = lv.start }
      else { out.bullet = 'bullet'; if (lv?.char && !['•', '●'].includes(lv.char)) out.char = lv.char }
    } else out.bullet = null
    const before = len(this.prop('paragraph', ps, 'para', 'margin-top')), after = len(this.prop('paragraph', ps, 'para', 'margin-bottom'))
    if (before) out.spaceBefore = r2(before)
    if (after) out.spaceAfter = r2(after)
    const lh = this.prop('paragraph', ps, 'para', 'line-height')
    if (lh?.endsWith('%') && +lh.slice(0, -1) !== 100) out.lineSpacing = +lh.slice(0, -1)
    if (!out.runs.length) { const sz = this.run(undefined, ps).size; if (sz) out.size = sz }
    return out
  }
  paras(container: XEl, list: ListLevel[] | undefined, level = -1, out: Para[] = []): Para[] {
    for (const c of container.children) {
      if (!isEl(c) || c.ns !== NS.text) continue
      if (c.local === 'p' || c.local === 'h') out.push(this.para(c, Math.max(0, level), list, level >= 0))
      else if (c.local === 'list') {
        const own = attr(c, 'style-name', NS.text)
        const l = own && this.lists.has(own) ? this.lists.get(own) : list
        for (const item of kids(c)) {
          if (item.local === 'list-header') this.paras(item, l, -1, out)
          else if (item.local === 'list-item') this.paras(item, l, level + 1, out)
        }
      }
    }
    return out
  }
  body(container: XEl, graphicFamily: string, graphicStyle: string | undefined, textStyle: string | undefined): TextBody {
    const list = this.listFor(graphicFamily, graphicStyle)
    const paras = this.paras(container, list)
    // An outline placeholder's paragraphs are list items even outside an explicit list.
    const b: TextBody = { paras: paras.length ? paras : [{ runs: [] }] }
    const g = (k: string) => this.prop(graphicFamily, graphicStyle, 'graphic', k)
    const v = g('textarea-vertical-align')
    if (v === 'middle') b.anchor = 'ctr'
    else if (v === 'bottom') b.anchor = 'b'
    const pad = ['padding-left', 'padding-top', 'padding-right', 'padding-bottom'].map((k) => len(g(k)))
    if (pad.every((x) => x !== undefined)) b.inset = pad.map((x) => r2(x!)) as [number, number, number, number]
    if (g('shrink-to-fit') === 'true' || g('fit-to-size') === 'shrink-to-fit') b.autofit = 'shrink'
    else if (g('auto-grow-height') === 'true') b.autofit = 'resize'
    if (g('wrap-option') === 'no-wrap') b.wrap = false
    if (g('writing-mode')?.startsWith('tb')) { b.vertical = true; this.lose('vertical text (shown horizontally)') }
    void textStyle
    return b
  }

  // ---- shapes ----------------------------------------------------------------
  fill(family: string, style: string | undefined): Fill | undefined {
    const g = (k: string) => this.prop(family, style, 'graphic', k) ?? this.prop(family, style, 'page', k) ?? this.prop(family, style, 'cell', k)
    const f = g('fill')
    if (f === 'none') return { type: 'none' }
    if (f === 'solid') { const c = g('fill-color'); return c ? { type: 'solid', color: c.toLowerCase() } : undefined }
    if (f === 'gradient') {
      const gr = this.gradients.get(g('fill-gradient-name') || '')
      // ODF measures a gradient's angle counter-clockwise from top-to-bottom;
      // the model, as DrawingML does, clockwise from left-to-right.
      if (gr) return { type: 'grad', stops: [{ pos: 0, color: gr.start.toLowerCase() }, { pos: 1, color: gr.end.toLowerCase() }], angle: (((90 - gr.angle) % 360) + 360) % 360 }
    }
    if (f === 'hatch') { this.lose('pattern fills (drawn as their foreground colour)'); const c = g('fill-color'); return c ? { type: 'solid', color: c.toLowerCase() } : undefined }
    if (f === 'bitmap') { this.lose('pattern fills (drawn as their foreground colour)'); return undefined }
    return undefined
  }
  line(family: string, style: string | undefined): Line | null | undefined {
    const g = (k: string) => this.prop(family, style, 'graphic', k)
    const s = g('stroke')
    if (s === 'none') return null
    if (!s) return undefined
    const ln: Line = {}
    const c = g('stroke-color'); if (c) ln.color = c.toLowerCase()
    // Widths are stored in cm, so 2pt arrives as 2.01: snap to the quarter points line widths come in.
    const w = len(g('stroke-width')); if (w !== undefined) ln.width = Math.max(0.25, Math.round(w * 4) / 4)
    if (s === 'dash') ln.dash = 'dash'
    if (g('marker-end')) ln.tail = 'triangle'
    if (g('marker-start')) ln.head = 'triangle'
    return ln
  }
  /** Position and rotation, from svg:x/y or from a transform. */
  box(el: XEl): { x: number; y: number; w: number; h: number; rot?: number } {
    const w = len(attr(el, 'width', NS.svg)) || 0, h = len(attr(el, 'height', NS.svg)) || 0
    const tf = attr(el, 'transform', NS.draw)
    if (tf) {
      const rot = /rotate\s*\(\s*(-?[\d.eE+-]+)\s*\)/.exec(tf)
      const tr = /translate\s*\(\s*([^\s)]+)\s+([^\s)]+)\s*\)/.exec(tf)
      const th = rot ? +rot[1] : 0
      const tx = tr ? len(tr[1]) || 0 : 0, ty = tr ? len(tr[2]) || 0 : 0
      // rotate(θ) on screen with y pointing down, then translate: where the centre lands.
      const cx = tx + (w / 2) * Math.cos(th) + (h / 2) * Math.sin(th)
      const cy = ty - (w / 2) * Math.sin(th) + (h / 2) * Math.cos(th)
      const deg = r2(((-th * 180) / Math.PI % 360 + 360) % 360)
      return { x: r2(cx - w / 2), y: r2(cy - h / 2), w: r2(w), h: r2(h), ...(deg && deg !== 360 ? { rot: deg } : {}) }
    }
    return { x: r2(len(attr(el, 'x', NS.svg)) || 0), y: r2(len(attr(el, 'y', NS.svg)) || 0), w: r2(w), h: r2(h) }
  }

  async picture(href: string | undefined): Promise<string | null> {
    if (!href) return null
    const path = href.replace(/^\.\//, '')
    if (this.mediaByPath.has(path)) return this.mediaByPath.get(path)!
    let id: string | null = null
    if (/^https?:/i.test(path)) this.lose('linked (not embedded) pictures')
    else {
      const bytes = this.images.get(path)
      const kind = bytes ? sniffImage(bytes) : null
      if (!bytes) this.lose('pictures that could not be read')
      else if (!kind || !/^image\/(png|jpeg|gif|webp|svg\+xml|bmp)$/.test(kind.mime)) this.lose('pictures in a format browsers cannot show (EMF, WMF, TIFF)')
      else { id = newId('m'); this.media[id] = { mime: kind.mime, data: dataUrl(bytes, kind.mime) } }
    }
    this.mediaByPath.set(path, id)
    return id
  }

  async elements(container: XEl, ctx: { master?: boolean }): Promise<El[]> {
    const out: El[] = []
    for (const c of container.children) {
      if (!isEl(c)) continue
      if (c.ns === NS.draw && c.local === 'g') { out.push(...(await this.elements(c, ctx))); continue }
      if (c.ns === NS.presentation && c.local === 'notes') continue
      const el = await this.element(c, ctx)
      if (el) out.push(el)
    }
    return out
  }

  async element(c: XEl, ctx: { master?: boolean }): Promise<El | null> {
    if (c.ns !== NS.draw) return null
    const gs = attr(c, 'style-name', NS.draw)
    const ps = attr(c, 'style-name', NS.presentation)
    const fam = ps ? 'presentation' : 'graphic'
    const style = ps || gs
    const name = attr(c, 'name', NS.draw)
    const alt = textOf(kids(c, NS.svg, 'desc')[0]) || textOf(kids(c, NS.svg, 'title')[0]) || undefined
    const pos = this.box(c)
    if (c.local === 'frame') {
      const cls = attr(c, 'class', NS.presentation)
      // Header, footer, date and number placeholders are drawn by the editor's own footer.
      if (cls && ['page-number', 'footer', 'date-time', 'header', 'page'].includes(cls)) return null
      if (ctx.master && cls) return null // a master's placeholders are prompts for slides, not decoration
      const tb = kids(c, NS.draw, 'text-box')[0]
      const table = kids(c, NS.table, 'table')[0]
      const obj = kids(c, NS.draw, 'object')[0] || kids(c, NS.draw, 'object-ole')[0]
      const imgs = kids(c, NS.draw, 'image')
      if (table) return this.table(table, pos, name)
      if (obj) {
        const href = (attr(obj, 'href', NS.xlink) || '').replace(/^\.\//, '').replace(/\/$/, '')
        const type = this.manifest.get(href + '/') || this.manifest.get(href) || ''
        this.lose(/chart/.test(type) ? 'charts' : 'embedded objects')
        return null
      }
      if (tb) {
        const ph = cls === 'title' ? 'title' : cls === 'subtitle' ? 'subTitle' : cls === 'outline' ? 'body' : cls === 'text' || cls === 'object' ? 'body' : undefined
        const empty = attr(c, 'placeholder', NS.presentation) === 'true'
        const text = this.body(tb, fam, style, attr(c, 'text-style-name', NS.draw))
        if (ph === 'body' && !kids(tb, NS.text, 'list').length) text.paras.forEach((p) => { if (p.bullet === null && cls === 'outline' && !empty) p.bullet = 'bullet' })
        if (!ph && !text.paras.some((p) => p.runs.length)) return null
        const el: ShapeEl = { id: newId(), kind: 'shape', geom: 'rect', ...pos, text, fill: this.fill(fam, style) || { type: 'none' }, line: this.line(fam, style) ?? null }
        if (ph) el.ph = ph as Placeholder
        if (name) el.name = name
        if (this.prop(fam, style, 'graphic', 'shadow') === 'visible') el.shadow = true
        return el
      }
      // A picture: the first of a frame's alternatives a browser can show.
      for (const im of imgs) {
        const id = await this.picture(attr(im, 'href', NS.xlink))
        if (id) {
          const e: ImageEl = { id: newId(), kind: 'image', media: id, ...pos }
          if (alt) e.alt = alt
          if (name) e.name = name
          const ln = this.line(fam, style)
          if (ln) e.line = ln
          return e
        }
      }
      return null
    }
    if (c.local === 'custom-shape' || c.local === 'rect' || c.local === 'ellipse' || c.local === 'circle') {
      let geom = c.local === 'rect' ? 'rect' : c.local === 'custom-shape' ? 'rect' : 'ellipse'
      if (c.local === 'custom-shape') {
        const eg = kids(c, NS.draw, 'enhanced-geometry')[0]
        const t = attr(eg, 'type', NS.draw) || ''
        const o = t.replace(/^ooxml-/, '')
        if (t.startsWith('ooxml-') && isKnownPreset(o)) geom = o
        else if (GEOM[t] && isKnownPreset(GEOM[t])) geom = GEOM[t]
        else if (t === 'non-primitive' || !t) { this.lose('freeform shapes (drawn as their outline box)'); geom = 'rect' }
        else this.lose('shapes this editor does not draw (shown as rectangles)')
        if (attr(eg, 'mirror-horizontal', NS.draw) === 'true') (pos as Record<string, unknown>).flipH = true
        if (attr(eg, 'mirror-vertical', NS.draw) === 'true') (pos as Record<string, unknown>).flipV = true
      } else if (c.local === 'rect' && len(attr(c, 'corner-radius', NS.draw))) geom = 'roundRect'
      const text = this.body(c, fam, style, attr(c, 'text-style-name', NS.draw))
      const el: ShapeEl = { id: newId(), kind: 'shape', geom, ...pos }
      const f = this.fill(fam, style); if (f) el.fill = f
      const ln = this.line(fam, style); if (ln !== undefined) el.line = ln
      if (text.paras.some((p) => p.runs.length)) el.text = text
      else el.text = { ...text, paras: [{ runs: [], align: 'ctr' }] }
      if (name) el.name = name
      if (alt) el.alt = alt
      if (this.prop(fam, style, 'graphic', 'shadow') === 'visible') el.shadow = true
      return el
    }
    if (c.local === 'line' || c.local === 'connector') {
      const x1 = len(attr(c, 'x1', NS.svg)) || 0, y1 = len(attr(c, 'y1', NS.svg)) || 0, x2 = len(attr(c, 'x2', NS.svg)) || 0, y2 = len(attr(c, 'y2', NS.svg)) || 0
      const el: ShapeEl = { id: newId(), kind: 'shape', geom: 'line', x: r2(Math.min(x1, x2)), y: r2(Math.min(y1, y2)), w: r2(Math.abs(x2 - x1)), h: r2(Math.abs(y2 - y1)), line: this.line(fam, style) || { color: '#000000', width: 1 } }
      if (x2 < x1) el.flipH = true
      if (y2 < y1) el.flipV = true
      return el
    }
    if (['polygon', 'polyline', 'path'].includes(c.local)) {
      this.lose('freeform shapes (drawn as their outline box)')
      const el: ShapeEl = { id: newId(), kind: 'shape', geom: 'rect', ...pos }
      const f = this.fill(fam, style); if (f) el.fill = f
      const ln = this.line(fam, style); if (ln !== undefined) el.line = ln
      return el
    }
    if (c.local === 'object' || c.local === 'object-ole') { this.lose('embedded objects'); return null }
    if (c.local === 'plugin') { this.lose('video and sound'); return null }
    return null
  }

  table(t: XEl, pos: { x: number; y: number; w: number; h: number; rot?: number }, name?: string): TableEl {
    const cols: number[] = []
    for (const col of kids(t, NS.table, 'table-column')) {
      const w = len(this.prop('table-column', attr(col, 'style-name', NS.table), 'col', 'column-width')) || 0
      for (let i = 0; i < +(attr(col, 'number-columns-repeated', NS.table) || '1'); i++) cols.push(r2(w))
    }
    const rows: TableEl['rows'] = []
    const rowEls = [...kids(t, NS.table, 'table-row'), ...kids(t, NS.table, 'table-rows').flatMap((g) => kids(g, NS.table, 'table-row')), ...kids(t, NS.table, 'table-header-rows').flatMap((g) => kids(g, NS.table, 'table-row'))]
    for (const r of rowEls) {
      const rs = attr(r, 'style-name', NS.table)
      const def = attr(r, 'default-cell-style-name', NS.table)
      const cells: Cell[] = []
      for (const c of kids(r)) {
        if (c.local === 'covered-table-cell') { cells.push({ text: { paras: [{ runs: [] }] }, merged: true }); continue }
        if (c.local !== 'table-cell') continue
        const cs = attr(c, 'style-name', NS.table) || def
        const cell: Cell = { text: { paras: this.paras(c, undefined) } }
        if (!cell.text.paras.length) cell.text.paras = [{ runs: [] }]
        const f = this.fill('table-cell', cs)
        if (f?.type === 'solid') cell.fill = f.color
        const cspan = +(attr(c, 'number-columns-spanned', NS.table) || '1'), rspan = +(attr(c, 'number-rows-spanned', NS.table) || '1')
        if (cspan > 1 || rspan > 1) cell.span = [rspan, cspan]
        cells.push(cell)
      }
      rows.push({ h: r2(len(this.prop('table-row', rs, 'row', 'row-height')) || len(this.prop('table-row', rs, 'row', 'min-row-height')) || 30), cells })
    }
    const n = Math.max(cols.length, ...rows.map((r) => r.cells.length))
    while (cols.length < n) cols.push(r2(pos.w / n))
    const el: TableEl = { id: newId(), kind: 'table', ...pos, cols, rows, w: r2(cols.reduce((a, b) => a + b, 0)) || pos.w, h: r2(rows.reduce((a, r) => a + r.h, 0)) || pos.h }
    if (name) el.name = name
    return el
  }
}

/** Which of our layouts a slide's placeholders amount to — what "reset slide" uses. */
function layoutOf(els: El[]): LayoutKind {
  const phs = els.filter((e): e is ShapeEl => e.kind === 'shape' && !!e.ph).map((e) => e.ph)
  if (phs.includes('subTitle')) return 'title'
  const bodies = phs.filter((p) => p === 'body').length
  if (phs.includes('title') && bodies >= 2) return 'twoContent'
  if (phs.includes('title') && bodies === 1) return 'titleContent'
  if (phs.includes('title')) return 'titleOnly'
  return 'blank'
}

export async function readOdp(buf: ArrayBuffer): Promise<PptxImport> {
  const entries = zipEntries(buf)
  if (!entries) {
    const head = new Uint8Array(buf.slice(0, 8))
    if (head[0] === 0xd0 && head[1] === 0xcf) throw new OpcError('legacy-binary', 'legacy binary presentation')
    throw new OpcError('not-zip', 'not a zip')
  }
  const get = async (n: string) => { const e = entries.find((x) => x.name === n); return e ? readEntry(buf, e) : null }
  const mime = await get('mimetype')
  if (mime && !new TextDecoder().decode(mime).includes('opendocument.presentation')) throw new OpcError('not-ooxml', 'not a presentation')
  const content = await get('content.xml')
  if (!content) throw new OpcError('missing-part', 'content.xml')
  const r = new OdpReader()
  for (const e of entries) if (/^Pictures\//.test(e.name) && e.size < 40 * 1024 * 1024) r.images.set(e.name, await readEntry(buf, e))
  const man = await get('META-INF/manifest.xml')
  if (man) for (const f of kids(parseXml(new TextDecoder().decode(man)), NS.manifest, 'file-entry')) r.manifest.set(attr(f, 'full-path', NS.manifest) || '', attr(f, 'media-type', NS.manifest) || '')
  const stylesBytes = await get('styles.xml')
  r.readStyles(stylesBytes ? parseXml(new TextDecoder().decode(stylesBytes)) : null)
  const root = parseXml(new TextDecoder().decode(content))
  r.readStyles(root)
  const pres = kids(kids(root, NS.office, 'body')[0], NS.office, 'presentation')[0]
  if (!pres) throw new OpcError('not-ooxml', 'no presentation body')
  const pages = kids(pres, NS.draw, 'page')

  // The slide size is the first slide's master's page layout.
  const firstMaster = r.masterPages.get(attr(pages[0], 'master-page-name', NS.draw) || '') || [...r.masterPages.values()][0]
  const size = (firstMaster?.layout && r.pageLayouts.get(firstMaster.layout)) || { w: 960, h: 540 }

  // Masters: what each draws behind its slides, read once.
  const masters: Master[] = []
  const masterId = new Map<string, string | undefined>()
  const masterFor = async (name: string | undefined): Promise<string | undefined> => {
    if (!name) return undefined
    if (masterId.has(name)) return masterId.get(name)
    const mp = r.masterPages.get(name)
    let id: string | undefined
    if (mp) {
      const els = await r.elements(mp.el, { master: true })
      const bg = r.fill('drawing-page', mp.style)
      if (els.length || (bg && bg.type !== 'none')) {
        id = newId('mst')
        const k = spread(els.length)
        els.forEach((e, i) => (e.ord = k[i]))
        masters.push({ id, name: name.replace(/_20_/g, ' '), elements: els, ...(bg && bg.type !== 'none' ? { bg } : {}) })
      }
    }
    masterId.set(name, id)
    return id
  }

  const slides: Slide[] = []
  for (const pg of pages) {
    const ds = attr(pg, 'style-name', NS.draw)
    const els = await r.elements(pg, {})
    const k = spread(els.length)
    els.forEach((e, i) => (e.ord = k[i]))
    const s: Slide = { id: newId('s'), elements: els, layout: layoutOf(els) }
    const m = await masterFor(attr(pg, 'master-page-name', NS.draw))
    if (m) s.master = m
    const bg = r.fill('drawing-page', ds)
    if (bg && bg.type !== 'none') s.bg = bg
    if (r.prop('drawing-page', ds, 'page', 'visibility') === 'hidden') s.hidden = true
    const tt = r.prop('drawing-page', ds, 'page', 'type') || r.prop('drawing-page', ds, 'page', 'transition-type')
    if (tt && tt !== 'none' && tt !== 'manual') {
      const kind = TRANSITION[tt]
      if (kind) { const dur = parseFloat(r.prop('drawing-page', ds, 'page', 'transition-duration') || r.prop('drawing-page', ds, 'page', 'dur') || ''); s.transition = { kind, ...(dur ? { dur: Math.round(dur * 1000) } : {}) } }
      else r.lose('animations')
    }
    // Speaker notes: the notes page's text, a line per paragraph.
    const notes = kids(pg, NS.presentation, 'notes')[0]
    if (notes) {
      const frame = kids(notes, NS.draw, 'frame').find((f) => attr(f, 'class', NS.presentation) === 'notes')
      const tb = kids(frame, NS.draw, 'text-box')[0]
      if (tb) { const t = r.paras(tb, undefined).map((p) => p.runs.map((x) => x.t).join('')).join('\n').trim(); if (t) s.notes = t }
    }
    if (pg.children.some((c) => isEl(c) && c.local === 'animations')) r.lose('animations')
    slides.push(s)
  }
  const keys = spread(slides.length)
  slides.forEach((s, i) => (s.ord = keys[i]))

  let title = ''
  const meta = await get('meta.xml')
  if (meta) { const find = (e: XEl): string => { for (const c of e.children) if (isEl(c)) { if (c.ns === NS.dc && c.local === 'title') return textOf(c); const f = find(c); if (f) return f } return '' }; title = find(parseXml(new TextDecoder().decode(meta))) }
  const all = slides.flatMap((s) => s.elements.flatMap((e) => (e.kind === 'shape' && e.text ? e.text.paras : [])))
  const rtl = all.length > 0 && all.filter((p) => p.rtl).length > all.length / 2
  const data: DeckData = {
    size: { w: r2(size.w), h: r2(size.h) },
    theme: JSON.parse(JSON.stringify(DEFAULT_DECK_THEME)),
    slides: slides.length ? slides : [{ id: newId('s'), ord: spread(1)[0], elements: [], layout: 'blank' }],
    media: r.media,
    ...(masters.length ? { masters } : {}),
    ...(rtl ? { rtl, lang: 'ar-SA' } : {}),
  }
  return { data, loss: [...r.loss].map(([what, count]): Loss => ({ what, count })), title: title || slideTitle(data.slides[0]) }
}
