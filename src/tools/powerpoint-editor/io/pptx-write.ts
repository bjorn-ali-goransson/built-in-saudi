// The editor's deck → .pptx.
//
// Every slide is written SELF-SUFFICIENT: each run carries its effective size,
// colour and font, each placeholder its position. A placeholder that leaned on
// the layout for its size would be one size here and another in whatever
// opens the file next, because that program's idea of our layout is not ours.
// The layout still exists — PowerPoint wants one — and carries what an
// imported deck drew behind its slides (a logo, a band, a background), so the
// shared backdrop stays shared instead of being copied into every slide.
//
// Arabic is written as Office expects it to be read: the paragraph says rtl,
// the run says its language, and the font goes in the complex-script slot,
// which is the one PowerPoint uses for Arabic.
import { PackageWriter, REL, NS, writeDocProps, parseDataUrl, sniffImage } from '../../../lib/office/opc'
import { classicImage } from '../../../lib/office/optimiseImage'
import { x, xmlDoc, type Xml, type XChild } from '../../../lib/xml'
import { THEME_ORDER } from '../../../lib/office/color'
import { isLine } from '../geom'
import { runSize, fontName, isBold, cellLook, borderColor } from '../look'
import { isRtlText, type DeckData, type El, type Fill, type Line, type Paint, type Para, type Run, type ShapeEl, type ImageEl, type TableEl, type TextBody, type Theme, type Slide, type Master } from '../model'

export const PPTX_MIME = 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
const CT = {
  pres: 'application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml',
  slide: 'application/vnd.openxmlformats-officedocument.presentationml.slide+xml',
  layout: 'application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml',
  master: 'application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml',
  theme: 'application/vnd.openxmlformats-officedocument.theme+xml',
  notes: 'application/vnd.openxmlformats-officedocument.presentationml.notesSlide+xml',
  notesMaster: 'application/vnd.openxmlformats-officedocument.presentationml.notesMaster+xml',
  presProps: 'application/vnd.openxmlformats-officedocument.presentationml.presProps+xml',
  viewProps: 'application/vnd.openxmlformats-officedocument.presentationml.viewProps+xml',
  tableStyles: 'application/vnd.openxmlformats-officedocument.presentationml.tableStyles+xml',
}
const NSA = { 'xmlns:a': NS.a, 'xmlns:r': NS.r, 'xmlns:p': NS.p }
const emu = (pt: number) => Math.round(pt * 12700)
const ARABIC_FONT = 'Arial'

export interface PptxExport { blob: Blob; loss: { what: string; count: number }[] }

function color(p: Paint | undefined, alpha?: number): Xml | null {
  if (!p) return null
  const kid = alpha !== undefined && alpha < 1 ? x('a:alpha', { val: Math.round(alpha * 100000) }) : null
  if (p.startsWith('#')) return x('a:srgbClr', { val: p.slice(1).toUpperCase() }, kid)
  return x('a:schemeClr', { val: p }, kid)
}
function fillXml(f: Fill | undefined, media: (id: string) => string | null): Xml | null {
  if (!f) return null
  switch (f.type) {
    case 'none': return x('a:noFill')
    case 'solid': return x('a:solidFill', null, color(f.color, f.alpha))
    case 'grad': return x('a:gradFill', { rotWithShape: 1 }, x('a:gsLst', null, f.stops.map((s) => x('a:gs', { pos: Math.round(s.pos * 100000) }, color(s.color)))), x('a:lin', { ang: Math.round(f.angle * 60000), scaled: 0 }))
    case 'image': { const rid = media(f.media); return rid ? x('a:blipFill', { dpi: 0, rotWithShape: 1 }, x('a:blip', { 'r:embed': rid }), x('a:stretch', null, x('a:fillRect'))) : null }
  }
}
function lineXml(l: Line | null | undefined, forLine: boolean): Xml | null {
  if (l === null) return x('a:ln', null, x('a:noFill'))
  if (!l) return forLine ? x('a:ln', { w: emu(1.5) }, x('a:solidFill', null, color('dk1'))) : null
  const dash = l.dash && l.dash !== 'solid' ? x('a:prstDash', { val: l.dash === 'dash' ? 'dash' : l.dash === 'dot' ? 'sysDot' : l.dash === 'lgDash' ? 'lgDash' : 'dashDot' }) : null
  return x('a:ln', { w: l.width !== undefined ? emu(l.width) : forLine ? emu(1.5) : undefined },
    l.color ? x('a:solidFill', null, color(l.color)) : forLine ? x('a:solidFill', null, color('dk1')) : null,
    dash,
    l.head && l.head !== 'none' ? x('a:headEnd', { type: l.head }) : null,
    l.tail && l.tail !== 'none' ? x('a:tailEnd', { type: l.tail }) : null)
}
const xfrm = (e: { x: number; y: number; w: number; h: number; rot?: number; flipH?: boolean; flipV?: boolean }, tag = 'a:xfrm') =>
  x(tag, { rot: e.rot ? Math.round(e.rot * 60000) : undefined, flipH: e.flipH ? 1 : undefined, flipV: e.flipV ? 1 : undefined },
    x('a:off', { x: emu(e.x), y: emu(e.y) }), x('a:ext', { cx: Math.max(0, emu(e.w)), cy: Math.max(0, emu(e.h)) }))
const geomXml = (prst: string, adj?: number[]) => x('a:prstGeom', { prst }, x('a:avLst', null, (adj || []).map((v, i) => x('a:gd', { name: adj!.length === 1 ? 'adj' : `adj${i + 1}`, fmla: `val ${Math.round(v)}` }))))

class Writer {
  w = new PackageWriter()
  private mediaParts = new Map<string, string>()
  private n = 0
  constructor(public d: DeckData) {}

  mediaPart(id: string): string | null {
    const hit = this.mediaParts.get(id)
    if (hit) return hit
    const m = this.d.media[id]
    const parsed = m ? parseDataUrl(m.data) : null
    if (!parsed) return null
    const kind = sniffImage(parsed.bytes) || { mime: parsed.mime, ext: parsed.mime.split('/')[1] || 'png' }
    const ext = kind.ext === 'svg+xml' ? 'svg' : kind.ext
    const part = `ppt/media/image${++this.n}.${ext}`
    this.w.add(part, parsed.bytes, kind.mime)
    this.mediaParts.set(id, part)
    return part
  }
  /** A relationship from `from` to a media item, by id. */
  mediaRel(from: string) {
    return (id: string): string | null => { const p = this.mediaPart(id); return p ? this.w.rel(from, { type: REL.image, target: p }) : null }
  }

  // ---- text ----------------------------------------------------------------
  runXml(r: Run, p: Para, b: TextBody, from: string): Xml {
    if (r.t === '\n') return x('a:br', null, x('a:rPr', { lang: this.d.lang || 'en-US', sz: Math.round(runSize(r, p, b) * 100) }))
    const rtl = isRtlText(r.t) || (!!p.rtl && !/[A-Za-z]/.test(r.t))
    const f = fontName(r.font, b, this.d.theme)
    const latin = r.font === 'major' || (!r.font && b.defaults?.font === 'major') ? '+mj-lt' : r.font === 'minor' || (!r.font && (!b.defaults?.font || b.defaults.font === 'minor')) ? '+mn-lt' : f
    const csFont = latin.startsWith('+') ? latin.replace('lt', 'cs') : f
    const link = r.link && /^(https?:|mailto:|tel:)/i.test(r.link) ? this.w.rel(from, { type: REL.hyperlink, target: r.link, external: true }) : null
    const slideLink = r.link?.startsWith('#slide:') ? this.slideRel(from, r.link.slice(7)) : null
    return x('a:r', null,
      x('a:rPr', {
        lang: rtl ? (this.d.lang?.startsWith('ar') ? this.d.lang : 'ar-SA') : this.d.lang?.startsWith('ar') ? 'en-US' : this.d.lang || 'en-US',
        altLang: rtl ? 'en-US' : undefined,
        sz: Math.round(runSize(r, p, b) * 100),
        b: isBold(r, b) ? 1 : 0,
        i: r.i ? 1 : undefined, u: r.u ? 'sng' : undefined, strike: r.s ? 'sngStrike' : undefined,
        baseline: r.sup ? 30000 : r.sub ? -25000 : undefined, dirty: 0,
      },
      x('a:solidFill', null, color(r.color ?? b.defaults?.color ?? 'dk1')),
      r.highlight ? x('a:highlight', null, color(r.highlight)) : null,
      x('a:latin', { typeface: latin }),
      x('a:cs', { typeface: rtl && latin.startsWith('+') ? csFont : rtl ? f || ARABIC_FONT : csFont }),
      link ? x('a:hlinkClick', { 'r:id': link }) : slideLink ? x('a:hlinkClick', { 'r:id': slideLink, action: 'ppaction://hlinksldjump' }) : r.link === '#next' ? x('a:hlinkClick', { 'r:id': '', action: 'ppaction://hlinkshowjump?jump=nextslide' }) : null),
      x('a:t', null, r.t))
  }
  paraXml(p: Para, b: TextBody, from: string): Xml {
    const lvl = p.level || 0
    const size = runSize(p.runs[0], p, b)
    const bullet = p.bullet === 'bullet' ? [x('a:buFont', { typeface: 'Arial' }), x('a:buChar', { char: p.char || '•' })]
      : p.bullet === 'number' ? [x('a:buFont', { typeface: '+mj-lt' }), x('a:buAutoNum', { type: p.scheme || 'arabicPeriod', startAt: p.start && p.start !== 1 ? p.start : undefined })]
      : [x('a:buNone')]
    const indent = p.bullet ? Math.round(size * 1.2 * 12700) : 0
    const mar = Math.round(lvl * 0.5 * 72 * 12700) + indent
    return x('a:p', null,
      x('a:pPr', { lvl: lvl || undefined, algn: p.align || undefined, rtl: p.rtl ? 1 : undefined, marL: mar || 0, indent: indent ? -indent : 0 },
        p.lineSpacing ? x('a:lnSpc', null, x('a:spcPct', { val: Math.round(p.lineSpacing * 1000) })) : null,
        p.spaceBefore ? x('a:spcBef', null, x('a:spcPts', { val: Math.round(p.spaceBefore * 100) })) : null,
        p.spaceAfter ? x('a:spcAft', null, x('a:spcPts', { val: Math.round(p.spaceAfter * 100) })) : null,
        bullet),
      p.runs.map((r) => this.runXml(r, p, b, from)),
      x('a:endParaRPr', { lang: this.d.lang || 'en-US', sz: Math.round(size * 100), dirty: 0 }))
  }
  bodyXml(b: TextBody | undefined, from: string, tag = 'p:txBody'): Xml {
    const t = b || { paras: [{ runs: [] }] }
    const ins = t.inset
    return x(tag, null,
      x('a:bodyPr', {
        wrap: t.wrap === false ? 'none' : 'square', rtlCol: 0, anchor: t.anchor || 't',
        lIns: ins ? emu(ins[0]) : undefined, tIns: ins ? emu(ins[1]) : undefined, rIns: ins ? emu(ins[2]) : undefined, bIns: ins ? emu(ins[3]) : undefined,
      }, t.autofit === 'shrink' ? x('a:normAutofit', { fontScale: t.fontScale && t.fontScale < 1 ? Math.round(t.fontScale * 100000) : undefined }) : t.autofit === 'resize' ? x('a:spAutoFit') : x('a:noAutofit')),
      x('a:lstStyle'),
      (t.paras.length ? t.paras : [{ runs: [] }]).map((p) => this.paraXml(p, t, from)))
  }

  // ---- shapes --------------------------------------------------------------
  private id = 1
  nextId() { return ++this.id }
  shapeXml(e: ShapeEl, from: string): Xml {
    const name = e.name || `${e.ph ? 'Placeholder' : 'Shape'} ${this.id}`
    if (isLine(e.geom)) {
      return x('p:cxnSp', null,
        x('p:nvCxnSpPr', null, x('p:cNvPr', { id: this.nextId(), name, descr: e.alt }), x('p:cNvCxnSpPr'), x('p:nvPr')),
        x('p:spPr', null, xfrm(e), geomXml(e.geom === 'line' ? 'line' : 'straightConnector1'), fillXml({ type: 'none' }, this.mediaRel(from)), lineXml(e.line, true)))
    }
    const phType = e.ph === 'ctrTitle' ? 'ctrTitle' : e.ph === 'title' ? 'title' : e.ph === 'subTitle' ? 'subTitle' : e.ph ? 'body' : null
    const ph = phType ? x('p:ph', { type: phType === 'body' ? undefined : phType, idx: phType === 'title' || phType === 'ctrTitle' ? undefined : ++this.phIdx }) : null
    const textOnly = !e.ph && (!e.fill || e.fill.type === 'none') && e.line === null && e.geom === 'rect' && !!e.text
    return x('p:sp', null,
      x('p:nvSpPr', null, x('p:cNvPr', { id: this.nextId(), name, descr: e.alt }, this.clickXml(e.link, from)), x('p:cNvSpPr', { txBox: textOnly ? 1 : undefined }), x('p:nvPr', null, ph)),
      x('p:spPr', null, xfrm(e), geomXml(e.geom, e.adj), fillXml(e.fill || { type: 'none' }, this.mediaRel(from)), lineXml(e.line, false),
        e.shadow ? x('a:effectLst', null, x('a:outerShdw', { blurRad: 57150, dist: 19050, dir: 5400000, algn: 'ctr', rotWithShape: 0 }, x('a:srgbClr', { val: '000000' }, x('a:alpha', { val: 35000 })))) : null),
      this.bodyXml(e.text, from))
  }
  private phIdx = 0
  clickXml(link: string | undefined, from: string): Xml | null {
    if (!link) return null
    if (/^(https?:|mailto:)/i.test(link)) return x('a:hlinkClick', { 'r:id': this.w.rel(from, { type: REL.hyperlink, target: link, external: true }) })
    if (link.startsWith('#slide:')) { const r = this.slideRel(from, link.slice(7)); return r ? x('a:hlinkClick', { 'r:id': r, action: 'ppaction://hlinksldjump' }) : null }
    return null
  }
  imageXml(e: ImageEl, from: string): Xml | null {
    const rid = this.mediaRel(from)(e.media)
    if (!rid) return null
    const c = e.crop
    return x('p:pic', null,
      x('p:nvPicPr', null, x('p:cNvPr', { id: this.nextId(), name: e.name || `Picture ${this.id}`, descr: e.alt || '' }, this.clickXml(e.link, from)), x('p:cNvPicPr', null, x('a:picLocks', { noChangeAspect: 1 })), x('p:nvPr')),
      x('p:blipFill', null, x('a:blip', { 'r:embed': rid }),
        c ? x('a:srcRect', { l: Math.round(c.l * 100000) || undefined, t: Math.round(c.t * 100000) || undefined, r: Math.round(c.r * 100000) || undefined, b: Math.round(c.b * 100000) || undefined }) : null,
        x('a:stretch', null, x('a:fillRect'))),
      x('p:spPr', null, xfrm(e), geomXml(e.geom || 'rect'), lineXml(e.line ?? undefined, false)))
  }
  tableXml(t: TableEl, from: string): Xml {
    const theme = this.d.theme
    const bc = borderColor(t, theme)
    const edge = (tag: string) => x(tag, { w: 12700 }, x('a:solidFill', null, color(bc)))
    const rowsH = t.rows.reduce((a, r) => a + r.h, 0)
    return x('p:graphicFrame', null,
      x('p:nvGraphicFramePr', null, x('p:cNvPr', { id: this.nextId(), name: t.name || `Table ${this.id}` }), x('p:cNvGraphicFramePr', null, x('a:graphicFrameLocks', { noGrp: 1 })), x('p:nvPr')),
      xfrm(t, 'p:xfrm'),
      x('a:graphic', null, x('a:graphicData', { uri: 'http://schemas.openxmlformats.org/drawingml/2006/table' },
        x('a:tbl', null,
          x('a:tblPr', { firstRow: t.style?.header ? 1 : undefined, bandRow: t.style?.banded ? 1 : undefined }),
          x('a:tblGrid', null, t.cols.map((c) => x('a:gridCol', { w: emu((c / (t.cols.reduce((a, b) => a + b, 0) || 1)) * t.w) }))),
          t.rows.map((row, ri) => x('a:tr', { h: emu(rowsH ? (row.h / rowsH) * t.h : t.h / t.rows.length) },
            row.cells.map((cell, ci) => {
              const look = cellLook(t, ri, ci, theme)
              const body: TextBody = { ...cell.text, defaults: { ...cell.text.defaults, ...(look.color ? { color: look.color } : {}), ...(look.bold ? { b: true } : {}) } }
              const covered = cell.merged
              const left = ci > 0 && row.cells.slice(0, ci).some((c2, k) => (c2.span?.[1] || 1) > ci - k && !c2.merged)
              return x('a:tc', {
                gridSpan: cell.span && cell.span[1] > 1 ? cell.span[1] : undefined, rowSpan: cell.span && cell.span[0] > 1 ? cell.span[0] : undefined,
                hMerge: covered && left ? 1 : undefined, vMerge: covered && !left ? 1 : undefined,
              }, this.bodyXml(body, from, 'a:txBody'),
              x('a:tcPr', { anchor: cell.text.anchor || undefined }, edge('a:lnL'), edge('a:lnR'), edge('a:lnT'), edge('a:lnB'), look.fill ? x('a:solidFill', null, color(look.fill)) : x('a:noFill')))
            })))))))
  }
  elXml(e: El, from: string): Xml | null {
    if (e.kind === 'shape') return this.shapeXml(e, from)
    if (e.kind === 'image') return this.imageXml(e, from)
    return this.tableXml(e, from)
  }
  treeXml(els: El[], from: string): Xml {
    this.id = 1
    this.phIdx = 0
    return x('p:spTree', null,
      x('p:nvGrpSpPr', null, x('p:cNvPr', { id: 1, name: '' }), x('p:cNvGrpSpPr'), x('p:nvPr')),
      x('p:grpSpPr', null, x('a:xfrm', null, x('a:off', { x: 0, y: 0 }), x('a:ext', { cx: 0, cy: 0 }), x('a:chOff', { x: 0, y: 0 }), x('a:chExt', { cx: 0, cy: 0 }))),
      els.map((e) => this.elXml(e, from)))
  }
  bgXml(f: Fill | undefined, from: string): Xml | null {
    const fx = fillXml(f, this.mediaRel(from))
    return f && fx ? x('p:bg', null, x('p:bgPr', null, fx, x('a:effectLst'))) : null
  }

  // ---- links between slides -------------------------------------------------
  slidePart = new Map<string, string>()
  slideRel(from: string, id: string): string | null {
    const target = this.slidePart.get(id)
    return target ? this.w.rel(from, { type: REL.slide, target }) : null
  }

  // ---- the package ---------------------------------------------------------
  theme(): string {
    const t = this.d.theme
    const c = t.colors
    const fill = (k: string) => x('a:solidFill', null, x('a:schemeClr', { val: k }))
    return xmlDoc(x('a:theme', { 'xmlns:a': NS.a, name: t.name || 'Theme' },
      x('a:themeElements', null,
        x('a:clrScheme', { name: t.name || 'Theme' }, THEME_ORDER.map((k) => x(`a:${k}`, null, x('a:srgbClr', { val: (c[k] || '#000000').slice(1).toUpperCase() })))),
        x('a:fontScheme', { name: t.name || 'Theme' },
          x('a:majorFont', null, x('a:latin', { typeface: t.fonts.major }), x('a:ea', { typeface: '' }), x('a:cs', { typeface: ARABIC_FONT }), x('a:font', { script: 'Arab', typeface: ARABIC_FONT })),
          x('a:minorFont', null, x('a:latin', { typeface: t.fonts.minor }), x('a:ea', { typeface: '' }), x('a:cs', { typeface: ARABIC_FONT }), x('a:font', { script: 'Arab', typeface: ARABIC_FONT }))),
        x('a:fmtScheme', { name: 'Office' },
          x('a:fillStyleLst', null, fill('phClr'), fill('phClr'), fill('phClr')),
          x('a:lnStyleLst', null, [6350, 12700, 19050].map((w) => x('a:ln', { w, cap: 'flat', cmpd: 'sng', algn: 'ctr' }, fill('phClr'), x('a:prstDash', { val: 'solid' }), x('a:miter', { lim: 800000 })))),
          x('a:effectStyleLst', null, [0, 1, 2].map(() => x('a:effectStyle', null, x('a:effectLst')))),
          x('a:bgFillStyleLst', null, fill('phClr'), fill('phClr'), fill('phClr'))))))
  }
  txStyle(tag: string, sizes: number[], font: string, color2: string, bullets: boolean): Xml {
    return x(tag, null, sizes.map((sz, i) => x(`a:lvl${i + 1}pPr`, { marL: bullets ? Math.round((i * 0.5 + 0.3) * 914400) : 0, indent: bullets ? -228600 : 0, algn: 'l', defTabSz: 914400, rtl: 0, eaLnBrk: 1, latinLnBrk: 0, hangingPunct: 1 },
      bullets ? [x('a:buFont', { typeface: 'Arial' }), x('a:buChar', { char: '•' })] : x('a:buNone'),
      x('a:defRPr', { sz: sz * 100, kern: 1200 }, x('a:solidFill', null, x('a:schemeClr', { val: color2 })), x('a:latin', { typeface: font }), x('a:ea', { typeface: '+mn-ea' }), x('a:cs', { typeface: font.replace('lt', 'cs') })))))
  }
  master(layoutIds: number[]): string {
    const S = this.d.size
    const ph = (id: number, name: string, type: string | undefined, idx: number | undefined, y: number, h: number) =>
      x('p:sp', null, x('p:nvSpPr', null, x('p:cNvPr', { id, name }), x('p:cNvSpPr', null, x('a:spLocks', { noGrp: 1 })), x('p:nvPr', null, x('p:ph', { type, idx }))),
        x('p:spPr', null, xfrm({ x: S.w * 0.065, y: S.h * y, w: S.w * 0.87, h: S.h * h }), geomXml('rect')),
        x('p:txBody', null, x('a:bodyPr', { anchor: type === 'title' ? 'b' : 't' }), x('a:lstStyle'), x('a:p', null, x('a:endParaRPr', { lang: 'en-US' }))))
    return xmlDoc(x('p:sldMaster', NSA,
      x('p:cSld', null, x('p:bg', null, x('p:bgRef', { idx: 1001 }, x('a:schemeClr', { val: 'bg1' }))),
        x('p:spTree', null, x('p:nvGrpSpPr', null, x('p:cNvPr', { id: 1, name: '' }), x('p:cNvGrpSpPr'), x('p:nvPr')), x('p:grpSpPr'),
          ph(2, 'Title Placeholder 1', 'title', undefined, 0.05, 0.18), ph(3, 'Text Placeholder 2', 'body', 1, 0.27, 0.64))),
      x('p:clrMap', { bg1: 'lt1', tx1: 'dk1', bg2: 'lt2', tx2: 'dk2', accent1: 'accent1', accent2: 'accent2', accent3: 'accent3', accent4: 'accent4', accent5: 'accent5', accent6: 'accent6', hlink: 'hlink', folHlink: 'folHlink' }),
      x('p:sldLayoutIdLst', null, layoutIds.map((id, i) => x('p:sldLayoutId', { id: 2147483649 + i, 'r:id': `rId${id}` }))),
      x('p:txStyles', null,
        this.txStyle('p:titleStyle', [40, 40, 40, 40, 40, 40, 40, 40, 40], '+mj-lt', 'tx1', false),
        this.txStyle('p:bodyStyle', [24, 20, 18, 16, 16, 16, 16, 16, 16], '+mn-lt', 'tx1', true),
        this.txStyle('p:otherStyle', [18, 18, 18, 18, 18, 18, 18, 18, 18], '+mn-lt', 'tx1', false))))
  }
  layout(name: string, m: Master | null, from: string): string {
    return xmlDoc(x('p:sldLayout', { ...NSA, preserve: 1, userDrawn: 1 },
      x('p:cSld', { name }, this.bgXml(m?.bg, from), this.treeXml(m?.elements || [], from)),
      x('p:clrMapOvr', null, x('a:masterClrMapping'))))
  }
  slide(s: Slide, from: string): string {
    const tr = s.transition && s.transition.kind !== 'none' ? x('p:transition', { spd: (s.transition.dur || 700) >= 900 ? 'slow' : (s.transition.dur || 700) <= 500 ? 'fast' : 'med' },
      s.transition.kind === 'push' ? x('p:push', { dir: 'u' }) : s.transition.kind === 'wipe' ? x('p:wipe', { dir: 'r' }) : s.transition.kind === 'cover' ? x('p:cover', { dir: 'l' }) : s.transition.kind === 'zoom' ? x('p:zoom') : x('p:fade')) : null
    return xmlDoc(x('p:sld', { ...NSA, show: s.hidden ? 0 : undefined },
      x('p:cSld', null, this.bgXml(s.bg, from), this.treeXml(s.elements, from)),
      x('p:clrMapOvr', null, x('a:masterClrMapping')),
      tr))
  }
  notes(text: string, from: string): string {
    const S = this.d.size
    const tb: TextBody = { paras: text.split('\n').map((t) => ({ runs: t ? [{ t, size: 12 }] : [], size: 12 })) }
    return xmlDoc(x('p:notes', NSA,
      x('p:cSld', null, x('p:spTree', null, x('p:nvGrpSpPr', null, x('p:cNvPr', { id: 1, name: '' }), x('p:cNvGrpSpPr'), x('p:nvPr')), x('p:grpSpPr'),
        x('p:sp', null, x('p:nvSpPr', null, x('p:cNvPr', { id: 2, name: 'Slide Image Placeholder 1' }), x('p:cNvSpPr', null, x('a:spLocks', { noGrp: 1, noRot: 1, noChangeAspect: 1 })), x('p:nvPr', null, x('p:ph', { type: 'sldImg' }))), x('p:spPr')),
        x('p:sp', null, x('p:nvSpPr', null, x('p:cNvPr', { id: 3, name: 'Notes Placeholder 2' }), x('p:cNvSpPr', null, x('a:spLocks', { noGrp: 1 })), x('p:nvPr', null, x('p:ph', { type: 'body', idx: 1 }))),
          x('p:spPr', null, xfrm({ x: 0, y: S.h * 0.55, w: S.w, h: S.h * 0.4 })), this.bodyXml(tb, from)))),
      x('p:clrMapOvr', null, x('a:masterClrMapping'))))
  }
  notesMaster(): string {
    return xmlDoc(x('p:notesMaster', NSA,
      x('p:cSld', null, x('p:bg', null, x('p:bgRef', { idx: 1001 }, x('a:schemeClr', { val: 'bg1' }))),
        x('p:spTree', null, x('p:nvGrpSpPr', null, x('p:cNvPr', { id: 1, name: '' }), x('p:cNvGrpSpPr'), x('p:nvPr')), x('p:grpSpPr'),
          x('p:sp', null, x('p:nvSpPr', null, x('p:cNvPr', { id: 2, name: 'Notes Placeholder 1' }), x('p:cNvSpPr', null, x('a:spLocks', { noGrp: 1 })), x('p:nvPr', null, x('p:ph', { type: 'body', idx: 1 }))),
            x('p:spPr', null, xfrm({ x: 54, y: 300, w: 432, h: 300 }), geomXml('rect')), x('p:txBody', null, x('a:bodyPr'), x('a:lstStyle'), x('a:p', null, x('a:endParaRPr', { lang: 'en-US' })))))),
      x('p:clrMap', { bg1: 'lt1', tx1: 'dk1', bg2: 'lt2', tx2: 'dk2', accent1: 'accent1', accent2: 'accent2', accent3: 'accent3', accent4: 'accent4', accent5: 'accent5', accent6: 'accent6', hlink: 'hlink', folHlink: 'folHlink' }),
      x('p:notesStyle', null, x('a:lvl1pPr', { marL: 0, algn: 'l' }, x('a:defRPr', { sz: 1200 }, x('a:solidFill', null, x('a:schemeClr', { val: 'tx1' })), x('a:latin', { typeface: '+mn-lt' }))))))
  }

  async build(meta: { title?: string }): Promise<Blob> {
    const d = this.d
    const w = this.w
    const pres = 'ppt/presentation.xml'
    w.add(pres, '', CT.pres) // replaced at the end, once every relationship exists
    w.rel('', { type: REL.officeDocument, target: pres })
    writeDocProps(w, { title: meta.title, app: 'Built in Saudi — Presentation Editor' })
    w.add('ppt/theme/theme1.xml', this.theme(), CT.theme)
    w.add('ppt/theme/theme2.xml', this.theme(), CT.theme)
    // One plain layout, and one per shared backdrop an imported deck brought.
    const masters = (d.masters || []).filter((m) => d.slides.some((s) => s.master === m.id))
    const layouts: { part: string; master: Master | null }[] = [{ part: 'ppt/slideLayouts/slideLayout1.xml', master: null }, ...masters.map((m, i) => ({ part: `ppt/slideLayouts/slideLayout${i + 2}.xml`, master: m }))]
    const masterPart = 'ppt/slideMasters/slideMaster1.xml'
    const layoutRids: number[] = []
    for (const l of layouts) {
      w.add(l.part, this.layout(l.master?.name || 'Blank', l.master, l.part), CT.layout)
      w.rel(l.part, { type: REL.slideMaster, target: masterPart })
      layoutRids.push(+w.rel(masterPart, { type: REL.slideLayout, target: l.part }).slice(3))
    }
    w.rel(masterPart, { type: REL.theme, target: 'ppt/theme/theme1.xml' })
    w.add(masterPart, this.master(layoutRids), CT.master)
    const masterRid = w.rel(pres, { type: REL.slideMaster, target: masterPart })
    const nmPart = 'ppt/notesMasters/notesMaster1.xml'
    const anyNotes = d.slides.some((s) => s.notes?.trim())
    let nmRid: string | null = null
    if (anyNotes) {
      w.add(nmPart, this.notesMaster(), CT.notesMaster)
      w.rel(nmPart, { type: REL.theme, target: 'ppt/theme/theme2.xml' })
      nmRid = w.rel(pres, { type: REL.notesMaster, target: nmPart })
    }
    d.slides.forEach((s, i) => this.slidePart.set(s.id, `ppt/slides/slide${i + 1}.xml`))
    const slideRids: string[] = []
    d.slides.forEach((s, i) => {
      const part = `ppt/slides/slide${i + 1}.xml`
      const lay = layouts.find((l) => l.master && l.master.id === s.master) || layouts[0]
      w.rel(part, { type: REL.slideLayout, target: lay.part })
      w.add(part, this.slide(s, part), CT.slide)
      if (s.notes?.trim()) {
        const np = `ppt/notesSlides/notesSlide${i + 1}.xml`
        w.add(np, this.notes(s.notes, np), CT.notes)
        w.rel(np, { type: REL.notesMaster, target: nmPart })
        w.rel(np, { type: REL.slide, target: part })
        w.rel(part, { type: REL.notesSlide, target: np })
      }
      slideRids.push(w.rel(pres, { type: REL.slide, target: part }))
    })
    w.add('ppt/presProps.xml', xmlDoc(x('p:presentationPr', NSA)), CT.presProps)
    w.add('ppt/viewProps.xml', xmlDoc(x('p:viewPr', NSA, x('p:normalViewPr'), x('p:slideViewPr', null, x('p:cSldViewPr', null, x('p:cViewPr', null, x('p:scale', null, x('a:sx', { n: 100, d: 100 }), x('a:sy', { n: 100, d: 100 })), x('p:origin', { x: 0, y: 0 })))))), CT.viewProps)
    w.add('ppt/tableStyles.xml', xmlDoc(x('a:tblStyleLst', { 'xmlns:a': NS.a, def: '{5C22544A-7EE6-4342-B048-85BDC9FD1C3A}' })), CT.tableStyles)
    w.rel(pres, { type: REL.presProps, target: 'ppt/presProps.xml' })
    w.rel(pres, { type: REL.viewProps, target: 'ppt/viewProps.xml' })
    w.rel(pres, { type: REL.theme, target: 'ppt/theme/theme1.xml' })
    w.rel(pres, { type: REL.tableStyles, target: 'ppt/tableStyles.xml' })
    const S = d.size
    const children: XChild[] = [
      x('p:sldMasterIdLst', null, x('p:sldMasterId', { id: 2147483648, 'r:id': masterRid })),
      nmRid ? x('p:notesMasterIdLst', null, x('p:notesMasterId', { 'r:id': nmRid })) : null,
      x('p:sldIdLst', null, slideRids.map((rid, i) => x('p:sldId', { id: 256 + i, 'r:id': rid }))),
      x('p:sldSz', { cx: emu(S.w), cy: emu(S.h) }),
      x('p:notesSz', { cx: 6858000, cy: 9144000 }),
      x('p:defaultTextStyle', null, x('a:defPPr', null, x('a:defRPr', { lang: d.lang || 'en-US' })),
        [1, 2, 3, 4, 5].map((l) => x(`a:lvl${l}pPr`, { marL: (l - 1) * 457200, algn: 'l', defTabSz: 914400, rtl: 0 }, x('a:defRPr', { sz: 1800, kern: 1200 }, x('a:solidFill', null, x('a:schemeClr', { val: 'tx1' })), x('a:latin', { typeface: '+mn-lt' }), x('a:cs', { typeface: '+mn-cs' }))))),
    ]
    w.add(pres, xmlDoc(x('p:presentation', { ...NSA, saveSubsetFonts: 1, rtl: d.rtl ? 1 : undefined }, children)), CT.pres)
    return w.toBlob(PPTX_MIME)
  }
}

export async function writePptx(d: DeckData, meta: { title?: string } = {}): Promise<PptxExport> {
  d = await classicMedia(d)
  const wr = new Writer(d)
  const blob = await wr.build(meta)
  const loss: { what: string; count: number }[] = []
  const missing = d.slides.flatMap((s) => s.elements).filter((e) => e.kind === 'image' && !wr.mediaPart(e.media)).length
  if (missing) loss.push({ what: 'pictures that could not be read', count: missing })
  return { blob, loss }
}

export const _themeForTest = (t: Theme) => t

/** WebP pictures as JPEG or PNG, which every PowerPoint opens; the deck itself is left as it is. */
async function classicMedia(d: DeckData): Promise<DeckData> {
  const media = { ...d.media }
  let changed = false
  for (const [id, m] of Object.entries(media)) {
    const p = parseDataUrl(m.data)
    if (!p) continue
    const c = await classicImage(p.bytes)
    if (!c) continue
    let s = ''
    for (let i = 0; i < c.bytes.length; i += 0x8000) s += String.fromCharCode(...c.bytes.subarray(i, i + 0x8000))
    media[id] = { ...m, data: `data:${c.mime};base64,${btoa(s)}` }
    changed = true
  }
  return changed ? { ...d, media } : d
}
