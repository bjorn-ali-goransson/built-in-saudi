// .pptx → the editor's deck, read straight from the PresentationML.
//
// Worker-safe: no DOM. The hard part of a presentation is not any one shape, it
// is INHERITANCE — a placeholder says almost nothing about itself and takes its
// position from the layout, its text size from the layout's or the master's
// list style, its bullet from the master's body style, and its colours through
// a colour map from the theme. A reader that takes each shape at face value
// opens every title at 18pt in the top-left corner. So this one resolves the
// chain once, at import, and FLATTENS it into the slide: our model has no
// masters to edit, and that is what keeps it small.
//
// What a layout or master DRAWS (a logo, a coloured bar, a background picture)
// is kept as a shared `Master` the slide sits on, so it renders and exports
// without being copied into every slide.
//
// What does not come across is COUNTED, by kind, and handed back as a loss
// ledger: charts, SmartArt, video, animations, comments, freeform shapes.
import { Package, NS, REL, relIs, sniffImage, dataUrl, OpcError, readTitle, type Rel } from '../../../lib/office/opc'
import { kids, kid, find, findAll, attr, numAttr, textOf, isEl, type XEl } from '../../../lib/xml'
import { applyMods, PRESET_COLORS, DEFAULT_THEME, THEME_ORDER, type ThemeColors } from '../../../lib/office/color'
import { isKnownPreset } from '../geom'
import { spread } from '../order'
import type { DeckData, El, Fill, Line, Master, Para, Run, ShapeEl, Slide, TextBody, TextDefaults, Theme, Placeholder, Align, Dash, ArrowEnd, TransitionKind, Cell, TableEl, ImageEl } from '../model'
import { DEFAULT_DECK_THEME } from '../model'

export interface Loss { what: string; count: number }
export interface PptxImport { data: DeckData; loss: Loss[]; title: string }

const A = NS.a
const P = NS.p
const R = NS.r
const EMU_PT = 12700
const pt = (emu: number) => Math.round((emu / EMU_PT) * 100) / 100

const STRICT: Record<string, string> = { [NS.pStrict]: NS.p, [NS.aStrict]: NS.a, [NS.rStrict]: NS.r }
/** Strict OOXML spells the same vocabulary with other URIs; rewrite them once so every lookup is one. */
function unstrict(el: XEl): XEl {
  const walk = (e: XEl) => {
    if (STRICT[e.ns]) e.ns = STRICT[e.ns]
    for (const k of Object.keys(e.nattrs)) {
      const m = /^\{(.+)\}(.+)$/.exec(k)
      if (m && STRICT[m[1]]) { e.nattrs[`{${STRICT[m[1]]}}${m[2]}`] = e.nattrs[k]; delete e.nattrs[k] }
    }
    for (const c of e.children) if (isEl(c)) walk(c)
  }
  walk(el)
  return el
}

/** Markup-compatibility: keep the fallback a reader without the extension would see. */
function resolveMc(el: XEl): void {
  for (let i = 0; i < el.children.length; i++) {
    const c = el.children[i]
    if (!isEl(c)) continue
    if (c.ns === NS.mc && c.local === 'AlternateContent') {
      const choice = kids(c, NS.mc, 'Choice').find((ch) => !/\bp14\b|\bp15\b|\ba14\b/.test(attr(ch, 'Requires') || '') || false)
      const fb = kid(c, NS.mc, 'Fallback')
      const pick = fb || choice || kids(c, NS.mc, 'Choice')[0]
      const repl = pick ? pick.children.filter(isEl) : []
      for (const r of repl) r.parent = el
      el.children.splice(i, 1, ...repl)
      i += repl.length - 1
      continue
    }
    resolveMc(c)
  }
}

type ClrMap = Record<string, string>
const DEFAULT_MAP: ClrMap = { bg1: 'lt1', tx1: 'dk1', bg2: 'lt2', tx2: 'dk2', accent1: 'accent1', accent2: 'accent2', accent3: 'accent3', accent4: 'accent4', accent5: 'accent5', accent6: 'accent6', hlink: 'hlink', folHlink: 'folHlink' }

interface LvlStyle { size?: number; color?: string; font?: string; b?: boolean; i?: boolean; align?: Align; bullet?: 'bullet' | 'number' | null; char?: string; scheme?: string; lineSpacing?: number; spaceBefore?: number; spaceAfter?: number }
type ListStyle = LvlStyle[]
interface BodyProps { anchor?: 't' | 'ctr' | 'b'; inset?: [number, number, number, number]; autofit?: 'shrink' | 'resize' | 'none'; fontScale?: number; wrap?: boolean; vertical?: boolean }
interface PhInfo { type: string; idx?: string; xfrm?: Xfrm; list: ListStyle; body: BodyProps; fill?: Fill; line?: Line | null; geom?: string }
interface Xfrm { x: number; y: number; w: number; h: number; rot?: number; flipH?: boolean; flipV?: boolean }
interface Part { path: string; root: XEl; rels: Rel[] }
interface LayoutCtx { path: string; part: Part; master: MasterCtx; phs: PhInfo[]; map: ClrMap; showMasterSp: boolean; masterId: string }
interface MasterCtx { path: string; part: Part; phs: PhInfo[]; title: ListStyle; body: ListStyle; other: ListStyle; map: ClrMap; theme: Theme }

class Reader {
  loss = new Map<string, number>()
  media: Record<string, { mime: string; data: string }> = {}
  private mediaByPart = new Map<string, string>()
  private mediaBytes = 0
  masters: Master[] = []
  private layouts = new Map<string, LayoutCtx>()
  private mastersByPath = new Map<string, MasterCtx>()
  defaultText: ListStyle = []
  slideW = 960
  slideH = 540
  private seq = 0
  constructor(public pkg: Package) {}

  lose(what: string, n = 1) { this.loss.set(what, (this.loss.get(what) || 0) + n) }
  id(p: string) { return `${p}${(++this.seq).toString(36)}` }

  async part(path: string): Promise<Part> {
    const root = unstrict(await this.pkg.xml(path))
    resolveMc(root)
    return { path, root, rels: await this.pkg.rels(path) }
  }
  rel(part: Part, rid: string | undefined): Rel | undefined { return rid ? part.rels.find((r) => r.id === rid) : undefined }

  // ---- colour --------------------------------------------------------------
  color(el: XEl | null | undefined, theme: Theme, map: ClrMap, ph?: string): string | undefined {
    if (!el) return undefined
    const c = kids(el).find((k) => ['srgbClr', 'schemeClr', 'sysClr', 'prstClr', 'scrgbClr', 'hslClr'].includes(k.local))
    if (!c) return undefined
    const mods: { lumMod?: number; lumOff?: number; shade?: number; tint?: number } = {}
    let modded = false
    for (const m of kids(c)) {
      const v = numAttr(m, 'val', NaN)
      if (!Number.isFinite(v)) continue
      if (m.local === 'lumMod' || m.local === 'lumOff' || m.local === 'shade' || m.local === 'tint') { mods[m.local] = v; modded = true }
    }
    let hex: string | undefined
    let slot: string | undefined
    if (c.local === 'srgbClr') hex = '#' + (attr(c, 'val') || '000000').toLowerCase()
    else if (c.local === 'sysClr') hex = '#' + (attr(c, 'lastClr') || (attr(c, 'val') === 'window' ? 'ffffff' : '000000')).toLowerCase()
    else if (c.local === 'prstClr') hex = PRESET_COLORS[attr(c, 'val') || ''] || '#000000'
    else if (c.local === 'scrgbClr') hex = '#' + [attr(c, 'r'), attr(c, 'g'), attr(c, 'b')].map((v) => Math.round((Number(v || 0) / 100000) * 255).toString(16).padStart(2, '0')).join('')
    else if (c.local === 'schemeClr') {
      let v = attr(c, 'val') || 'tx1'
      if (v === 'phClr') v = ph || 'accent1'
      slot = map[v] || v
      if (!(THEME_ORDER as readonly string[]).includes(slot)) slot = 'dk1'
    } else hex = '#000000'
    if (slot && !modded) return slot
    const base = hex || theme.colors[slot as keyof ThemeColors] || '#000000'
    return modded ? applyMods(base, mods) : base
  }
  alpha(el: XEl | null | undefined): number | undefined {
    const a = el ? find(el, A, 'alpha') : null
    return a ? numAttr(a, 'val', 100000) / 100000 : undefined
  }

  fill(spPr: XEl | null, theme: Theme, map: ClrMap, part: Part): Fill | undefined {
    if (!spPr) return undefined
    if (kid(spPr, A, 'noFill')) return { type: 'none' }
    const s = kid(spPr, A, 'solidFill')
    if (s) { const color = this.color(s, theme, map) || '#000000'; const alpha = this.alpha(s); return alpha !== undefined && alpha < 1 ? { type: 'solid', color, alpha } : { type: 'solid', color } }
    const g = kid(spPr, A, 'gradFill')
    if (g) {
      const stops = findAll(kid(g, A, 'gsLst'), A, 'gs').map((gs) => ({ pos: numAttr(gs, 'pos', 0) / 100000, color: this.color(gs, theme, map) || '#000000' }))
      const lin = kid(g, A, 'lin')
      return stops.length ? { type: 'grad', stops, angle: lin ? numAttr(lin, 'ang', 0) / 60000 : 90 } : undefined
    }
    const b = kid(spPr, A, 'blipFill')
    if (b) { const m = this.blip(b, part); return m ? { type: 'image', media: m } : undefined }
    if (kid(spPr, A, 'pattFill')) { this.lose('pattern fills (drawn as their foreground colour)'); const fg = find(spPr, A, 'fgClr'); return { type: 'solid', color: this.color(fg, theme, map) || '#000000' } }
    return undefined
  }
  line(ln: XEl | null, theme: Theme, map: ClrMap): Line | null | undefined {
    if (!ln) return undefined
    if (kid(ln, A, 'noFill')) return null
    const out: Line = {}
    const w = attr(ln, 'w')
    if (w) out.width = pt(+w)
    const s = kid(ln, A, 'solidFill')
    if (s) out.color = this.color(s, theme, map)
    const d = attr(kid(ln, A, 'prstDash'), 'val')
    const dash: Record<string, Dash> = { solid: 'solid', dash: 'dash', sysDash: 'dash', dot: 'dot', sysDot: 'dot', dashDot: 'dashDot', sysDashDot: 'dashDot', lgDash: 'lgDash', lgDashDot: 'dashDot', lgDashDotDot: 'dashDot', sysDashDotDot: 'dashDot' }
    if (d && dash[d] && dash[d] !== 'solid') out.dash = dash[d]
    const end = (e: XEl | null): ArrowEnd | undefined => { const t = attr(e, 'type'); return t && t !== 'none' ? (['triangle', 'arrow', 'stealth', 'oval', 'diamond'].includes(t) ? (t as ArrowEnd) : 'triangle') : undefined }
    const h = end(kid(ln, A, 'headEnd')); if (h) out.head = h
    const t = end(kid(ln, A, 'tailEnd')); if (t) out.tail = t
    return out
  }

  // ---- media ---------------------------------------------------------------
  private blipPart(blip: XEl | null, part: Part): string | undefined {
    if (!blip) return undefined
    const rid = attr(blip, 'embed', R)
    const rel = this.rel(part, rid)
    if (!rid && attr(blip, 'link', R)) { this.lose('linked (not embedded) pictures'); return undefined }
    if (!rel || rel.external) { if (rel?.external) this.lose('linked (not embedded) pictures'); return undefined }
    return rel.target
  }
  blip(blipFill: XEl, part: Part): string | undefined {
    const target = this.blipPart(kid(blipFill, A, 'blip'), part)
    return target ? this.mediaFor(target) : undefined
  }
  async preloadMedia(part: Part) {
    for (const r of part.rels) if (relIs(r.type, REL.image) && !r.external && this.pkg.has(r.target)) await this.loadMedia(r.target)
  }
  private loaded = new Map<string, { mime: string; data: string } | null>()
  private async loadMedia(target: string) {
    if (this.loaded.has(target)) return
    try {
      const bytes = await this.pkg.bytes(target)
      const kind = sniffImage(bytes)
      if (!kind || /emf|wmf|tif/.test(kind.mime)) { this.loaded.set(target, null); return }
      if (this.mediaBytes + bytes.length > 120 * 1024 * 1024) { this.loaded.set(target, null); return }
      this.mediaBytes += bytes.length
      this.loaded.set(target, { mime: kind.mime, data: dataUrl(bytes, kind.mime) })
    } catch { this.loaded.set(target, null) }
  }
  mediaFor(target: string): string | undefined {
    const known = this.mediaByPart.get(target)
    if (known) return known
    const m = this.loaded.get(target)
    if (!m) { this.lose(this.loaded.has(target) ? 'pictures in a format browsers cannot show (EMF, WMF, TIFF)' : 'pictures that could not be read'); return undefined }
    const id = this.id('m')
    this.media[id] = m
    this.mediaByPart.set(target, id)
    return id
  }

  // ---- text ----------------------------------------------------------------
  lvlStyle(pPr: XEl | null, theme: Theme, map: ClrMap): LvlStyle {
    const s: LvlStyle = {}
    if (!pPr) return s
    const algn = attr(pPr, 'algn')
    if (algn) s.align = algn === 'ctr' ? 'ctr' : algn === 'r' ? 'r' : algn === 'just' || algn === 'dist' ? 'just' : 'l'
    if (kid(pPr, A, 'buNone')) s.bullet = null
    else if (kid(pPr, A, 'buAutoNum')) { s.bullet = 'number'; s.scheme = attr(kid(pPr, A, 'buAutoNum'), 'type') }
    else if (kid(pPr, A, 'buChar')) { s.bullet = 'bullet'; s.char = attr(kid(pPr, A, 'buChar'), 'char') }
    const pct = (e: XEl | null) => { const p = kid(e, A, 'spcPct'); const q = kid(e, A, 'spcPts'); return p ? { pct: numAttr(p, 'val', 100000) / 1000 } : q ? { pts: numAttr(q, 'val', 0) / 100 } : null }
    const ls = pct(kid(pPr, A, 'lnSpc')); if (ls?.pct) s.lineSpacing = ls.pct
    const sb = pct(kid(pPr, A, 'spcBef')); if (sb?.pts !== undefined) s.spaceBefore = sb.pts
    const sa = pct(kid(pPr, A, 'spcAft')); if (sa?.pts !== undefined) s.spaceAfter = sa.pts
    const def = kid(pPr, A, 'defRPr')
    if (def) Object.assign(s, this.runStyle(def, theme, map))
    return s
  }
  runStyle(rPr: XEl, theme: Theme, map: ClrMap): Partial<LvlStyle> & { u?: boolean; s?: boolean; sup?: boolean; sub?: boolean; highlight?: string; cs?: string } {
    const out: Partial<LvlStyle> & { u?: boolean; s?: boolean; sup?: boolean; sub?: boolean; highlight?: string; cs?: string } = {}
    const sz = attr(rPr, 'sz'); if (sz) out.size = +sz / 100
    const b = attr(rPr, 'b'); if (b !== undefined) out.b = b === '1' || b === 'true'
    const i = attr(rPr, 'i'); if (i !== undefined) out.i = i === '1' || i === 'true'
    const u = attr(rPr, 'u'); if (u !== undefined && u !== 'none') out.u = true
    const st = attr(rPr, 'strike'); if (st !== undefined && st !== 'noStrike') out.s = true
    const base = numAttr(rPr, 'baseline', 0); if (base > 0) out.sup = true; else if (base < 0) out.sub = true
    const f = kid(rPr, A, 'solidFill'); if (f) out.color = this.color(f, theme, map)
    const hl = kid(rPr, A, 'highlight'); if (hl) out.highlight = this.color(hl, theme, map)
    const font = (k: string) => { const t = attr(kid(rPr, A, k), 'typeface'); return t ? (t.startsWith('+mj') ? 'major' : t.startsWith('+mn') ? 'minor' : t) : undefined }
    const lat = font('latin'); if (lat) out.font = lat
    const cs = font('cs'); if (cs) out.cs = cs
    return out
  }
  listStyle(lst: XEl | null, theme: Theme, map: ClrMap): ListStyle {
    const out: ListStyle = []
    if (!lst) return out
    for (let l = 1; l <= 9; l++) { const p = kid(lst, A, `lvl${l}pPr`); if (p) out[l - 1] = this.lvlStyle(p, theme, map) }
    return out
  }
  bodyProps(bp: XEl | null): BodyProps {
    const o: BodyProps = {}
    if (!bp) return o
    const an = attr(bp, 'anchor'); if (an) o.anchor = an === 'ctr' ? 'ctr' : an === 'b' ? 'b' : 't'
    const ins = ['lIns', 'tIns', 'rIns', 'bIns'].map((k) => attr(bp, k))
    if (ins.some((v) => v !== undefined)) o.inset = ins.map((v, i) => (v === undefined ? [7.2, 3.6, 7.2, 3.6][i] : pt(+v))) as [number, number, number, number]
    if (kid(bp, A, 'normAutofit')) { o.autofit = 'shrink'; const fs = attr(kid(bp, A, 'normAutofit'), 'fontScale'); if (fs) o.fontScale = +fs / 100000 }
    else if (kid(bp, A, 'spAutoFit')) o.autofit = 'resize'
    else if (kid(bp, A, 'noAutofit')) o.autofit = 'none'
    const wrap = attr(bp, 'wrap'); if (wrap) o.wrap = wrap !== 'none'
    const vert = attr(bp, 'vert'); if (vert && vert !== 'horz') { o.vertical = true; this.lose('vertical text (shown horizontally)') }
    if (numAttr(bp, 'numCol', 1) > 1) this.lose('multiple text columns')
    return o
  }

  /**
   * One text body, with the inheritance chain already merged into `chain`
   * (lowest priority first). Run sizes the chain supplies are NOT written onto
   * each run: they go into `defaults`, so a run reads as "the placeholder's
   * size" and a theme or layout change later would still reach it.
   */
  textBody(tx: XEl, chain: ListStyle[], bodyChain: BodyProps[], theme: Theme, map: ClrMap, part: Part, phType?: string): TextBody {
    const lst = this.listStyle(kid(tx, A, 'lstStyle'), theme, map)
    const levels: ListStyle = []
    for (const c of [...chain, lst]) c.forEach((l, i) => { if (l) levels[i] = { ...(levels[i] || {}), ...l } })
    const bp: BodyProps = {}
    for (const b of [...bodyChain, this.bodyProps(kid(tx, A, 'bodyPr'))]) Object.assign(bp, b)
    const paras: Para[] = []
    for (const p of kids(tx, A, 'p')) {
      const pPr = kid(p, A, 'pPr')
      const lvl = Math.min(8, numAttr(pPr, 'lvl', 0))
      const inherited = levels[lvl] || {}
      const own = this.lvlStyle(pPr, theme, map)
      const para: Para = { runs: [] }
      if (lvl) para.level = lvl
      const align = own.align ?? inherited.align
      if (align && align !== 'l') para.align = align
      const bullet = own.bullet !== undefined ? own.bullet : inherited.bullet
      // A paragraph with no text has no bullet to show; keep it plain so the empty line does not grow one.
      if (bullet) para.bullet = bullet
      const ch = own.char ?? inherited.char
      if (bullet === 'bullet' && ch && ch !== '•') para.char = ch
      const sch = own.scheme ?? inherited.scheme
      if (bullet === 'number' && sch && sch !== 'arabicPeriod') para.scheme = sch
      const start = attr(kid(pPr, A, 'buAutoNum'), 'startAt'); if (start) para.start = +start
      if (attr(pPr, 'rtl') === '1') para.rtl = true
      const lsp = own.lineSpacing ?? inherited.lineSpacing; if (lsp && lsp !== 100) para.lineSpacing = lsp
      const sb = own.spaceBefore ?? inherited.spaceBefore; if (sb) para.spaceBefore = sb
      const sa = own.spaceAfter ?? inherited.spaceAfter; if (sa) para.spaceAfter = sa
      for (const c of kids(p)) {
        if (c.ns !== A) continue
        if (c.local === 'r' || c.local === 'fld') {
          const t = textOf(kid(c, A, 't'))
          const fldType = c.local === 'fld' ? attr(c, 'type') || '' : ''
          const text = fldType === 'slidenum' ? '‹#›' : t
          if (!text) continue
          const rPr = kid(c, A, 'rPr')
          const rs = rPr ? this.runStyle(rPr, theme, map) : {}
          const run: Run = { t: text }
          if (rs.b !== undefined && rs.b !== !!inherited.b) run.b = rs.b
          if (rs.i) run.i = true
          if (rs.u) run.u = true
          if (rs.s) run.s = true
          if (rs.sup) run.sup = true
          if (rs.sub) run.sub = true
          if (rs.size && rs.size !== inherited.size) run.size = rs.size
          if (rs.color && rs.color !== inherited.color) run.color = rs.color
          if (rs.highlight) run.highlight = rs.highlight
          // Arabic runs set their font in `cs`, the complex-script slot; that is the one that shows.
          const font = /[؀-ۿ]/.test(text) && rs.cs ? rs.cs : rs.font
          if (font && font !== inherited.font) run.font = font
          const hl = rPr ? kid(rPr, A, 'hlinkClick') : null
          if (hl) {
            const rel = this.rel(part, attr(hl, 'id', R))
            const action = attr(hl, 'action') || ''
            if (rel?.external) run.link = rel.target
            else if (rel && relIs(rel.type, REL.slide)) run.link = `#slide-part:${rel.target}`
            else if (/jump=nextslide/.test(action)) run.link = '#next'
          }
          para.runs.push(run)
        } else if (c.local === 'br') {
          para.runs.push({ t: '\n' })
        } else if (c.local === 'endParaRPr' && !para.runs.length) {
          const sz = attr(c, 'sz'); if (sz && +sz / 100 !== inherited.size) para.size = +sz / 100
        }
      }
      if (findAll(p, 'http://schemas.openxmlformats.org/officeDocument/2006/math', 'oMath').length) this.lose('equations (kept as plain text)')
      paras.push(para)
    }
    const d0 = levels[0] || {}
    const defaults: TextDefaults = {}
    if (d0.size) defaults.size = d0.size
    if (d0.color) defaults.color = d0.color
    if (d0.font) defaults.font = d0.font
    if (d0.b) defaults.b = true
    if (levels.some((l) => l?.size && l.size !== d0.size)) defaults.levels = levels.map((l) => ({ size: l?.size }))
    void phType
    const out: TextBody = { paras: paras.length ? paras : [{ runs: [] }] }
    if (bp.anchor && bp.anchor !== 't') out.anchor = bp.anchor
    if (bp.inset) out.inset = bp.inset
    if (bp.autofit && bp.autofit !== 'none') out.autofit = bp.autofit
    if (bp.fontScale && bp.fontScale < 1) out.fontScale = bp.fontScale
    if (bp.wrap === false) out.wrap = false
    if (Object.keys(defaults).length) out.defaults = defaults
    return out
  }

  // ---- geometry ------------------------------------------------------------
  xfrm(x: XEl | null): Xfrm | undefined {
    if (!x) return undefined
    const off = kid(x, A, 'off')
    const ext = kid(x, A, 'ext')
    if (!off || !ext) return undefined
    const o: Xfrm = { x: pt(numAttr(off, 'x', 0)), y: pt(numAttr(off, 'y', 0)), w: pt(numAttr(ext, 'cx', 0)), h: pt(numAttr(ext, 'cy', 0)) }
    const rot = numAttr(x, 'rot', 0); if (rot) o.rot = Math.round((rot / 60000) * 100) / 100
    if (attr(x, 'flipH') === '1') o.flipH = true
    if (attr(x, 'flipV') === '1') o.flipV = true
    return o
  }

  phInfos(spTree: XEl | null, theme: Theme, map: ClrMap, part: Part): PhInfo[] {
    const out: PhInfo[] = []
    for (const sp of kids(spTree, P, 'sp')) {
      const ph = find(kid(sp, P, 'nvSpPr'), P, 'ph')
      if (!ph) continue
      const spPr = kid(sp, P, 'spPr')
      const tx = kid(sp, P, 'txBody')
      out.push({
        type: attr(ph, 'type') || 'body', idx: attr(ph, 'idx'),
        xfrm: this.xfrm(kid(spPr, A, 'xfrm')),
        list: this.listStyle(kid(tx, A, 'lstStyle'), theme, map),
        body: this.bodyProps(kid(tx, A, 'bodyPr')),
        fill: this.fill(spPr, theme, map, part), line: this.line(kid(spPr, A, 'ln'), theme, map),
        geom: attr(kid(spPr, A, 'prstGeom'), 'prst'),
      })
    }
    return out
  }

  async master(path: string): Promise<MasterCtx> {
    const hit = this.mastersByPath.get(path)
    if (hit) return hit
    const part = await this.part(path)
    await this.preloadMedia(part)
    const themeRel = part.rels.find((r) => relIs(r.type, REL.theme))
    const theme = themeRel ? await this.theme(themeRel.target) : { ...DEFAULT_DECK_THEME }
    const map = clrMap(kid(part.root, P, 'clrMap'))
    const ts = kid(part.root, P, 'txStyles')
    const m: MasterCtx = {
      path, part, theme, map,
      phs: this.phInfos(kid(kid(part.root, P, 'cSld'), P, 'spTree'), theme, map, part),
      title: this.listStyle(kid(ts, P, 'titleStyle'), theme, map),
      body: this.listStyle(kid(ts, P, 'bodyStyle'), theme, map),
      other: this.listStyle(kid(ts, P, 'otherStyle'), theme, map),
    }
    this.mastersByPath.set(path, m)
    return m
  }

  async theme(path: string): Promise<Theme> {
    const el = unstrict(await this.pkg.xml(path))
    const cs = find(el, A, 'clrScheme')
    const colors = { ...DEFAULT_THEME } as ThemeColors
    for (const k of THEME_ORDER) {
      const c = kid(cs, A, k)
      if (!c) continue
      const v = this.color(c, { ...DEFAULT_DECK_THEME, colors }, DEFAULT_MAP)
      if (v) colors[k] = v.startsWith('#') ? v : colors[k]
    }
    const fs = find(el, A, 'fontScheme')
    const face = (k: string) => attr(kid(kid(fs, A, k), A, 'latin'), 'typeface') || ''
    const csFace = (k: string) => attr(kid(kid(fs, A, k), A, 'cs'), 'typeface') || ''
    return {
      name: attr(find(el, A, 'clrScheme'), 'name') || attr(el, 'name') || 'Theme',
      colors,
      fonts: { major: face('majorFont') || csFace('majorFont') || DEFAULT_DECK_THEME.fonts.major, minor: face('minorFont') || csFace('minorFont') || DEFAULT_DECK_THEME.fonts.minor },
    }
  }

  async layout(path: string): Promise<LayoutCtx> {
    const hit = this.layouts.get(path)
    if (hit) return hit
    const part = await this.part(path)
    await this.preloadMedia(part)
    const mrel = part.rels.find((r) => relIs(r.type, REL.slideMaster))
    if (!mrel) throw new OpcError('missing-part', 'slide master')
    const master = await this.master(mrel.target)
    const ovr = kid(kid(part.root, P, 'clrMapOvr'), A, 'overrideClrMapping')
    const map = ovr ? clrMap(ovr) : master.map
    const ctx: LayoutCtx = {
      path, part, master, map, masterId: '',
      phs: this.phInfos(kid(kid(part.root, P, 'cSld'), P, 'spTree'), master.theme, map, part),
      showMasterSp: attr(part.root, 'showMasterSp') !== '0',
    }
    // What the layout and its master DRAW: a shared backdrop for every slide on this layout.
    const els: El[] = []
    const ms = master.part
    if (ctx.showMasterSp) els.push(...(await this.shapes(kid(kid(ms.root, P, 'cSld'), P, 'spTree'), { part: ms, theme: master.theme, map: master.map, decor: true })))
    els.push(...(await this.shapes(kid(kid(part.root, P, 'cSld'), P, 'spTree'), { part, theme: master.theme, map, decor: true })))
    const bg = this.background(kid(part.root, P, 'cSld'), master.theme, map, part) || this.background(kid(ms.root, P, 'cSld'), master.theme, master.map, ms)
    if (els.length || bg) {
      const id = this.id('L')
      const keys = spread(els.length)
      els.forEach((e, i) => (e.ord = keys[i]))
      this.masters.push({ id, name: attr(kid(part.root, P, 'cSld'), 'name') || 'Layout', bg, elements: els })
      ctx.masterId = id
    }
    this.layouts.set(path, ctx)
    return ctx
  }

  background(cSld: XEl | null, theme: Theme, map: ClrMap, part: Part): Fill | undefined {
    const bg = kid(cSld, P, 'bg')
    if (!bg) return undefined
    const pr = kid(bg, P, 'bgPr')
    if (pr) return this.fill(pr, theme, map, part)
    const ref = kid(bg, P, 'bgRef')
    if (ref) { const c = this.color(ref, theme, map); return c ? { type: 'solid', color: c } : undefined }
    return undefined
  }

  // ---- shapes --------------------------------------------------------------
  async shapes(tree: XEl | null, ctx: { part: Part; theme: Theme; map: ClrMap; layout?: LayoutCtx; decor?: boolean; group?: (x: Xfrm) => Xfrm }): Promise<El[]> {
    const out: El[] = []
    if (!tree) return out
    const T = (x: Xfrm | undefined) => (x && ctx.group ? ctx.group(x) : x)
    for (const c of kids(tree)) {
      if (c.ns !== P) continue
      if (c.local === 'sp') { const e = this.sp(c, ctx, T); if (e) out.push(e) }
      else if (c.local === 'cxnSp') { const e = this.sp(c, ctx, T, true); if (e) out.push(e) }
      else if (c.local === 'pic') { const e = this.pic(c, ctx, T); if (e) out.push(e) }
      else if (c.local === 'graphicFrame') { const e = this.frame(c, ctx, T); if (e) out.push(e) }
      else if (c.local === 'grpSp') {
        const gx = kid(kid(c, P, 'grpSpPr'), A, 'xfrm')
        const off = kid(gx, A, 'off'), ext = kid(gx, A, 'ext'), choff = kid(gx, A, 'chOff'), chext = kid(gx, A, 'chExt')
        if (numAttr(gx, 'rot', 0)) this.lose('rotated groups (their shapes are placed unrotated)')
        const ox = pt(numAttr(off, 'x', 0)), oy = pt(numAttr(off, 'y', 0))
        const cx = pt(numAttr(choff, 'x', 0)), cy = pt(numAttr(choff, 'y', 0))
        const sx = numAttr(chext, 'cx', 0) ? numAttr(ext, 'cx', 0) / numAttr(chext, 'cx', 1) : 1
        const sy = numAttr(chext, 'cy', 0) ? numAttr(ext, 'cy', 0) / numAttr(chext, 'cy', 1) : 1
        const inner = (x: Xfrm): Xfrm => ({ ...x, x: ox + (x.x - cx) * sx, y: oy + (x.y - cy) * sy, w: x.w * sx, h: x.h * sy })
        const outer = ctx.group
        out.push(...(await this.shapes(c, { ...ctx, group: outer ? (x) => outer(inner(x)) : inner })))
      } else if (c.local === 'contentPart') this.lose('ink drawings')
    }
    return out
  }

  private phMatch(list: PhInfo[], type: string, idx?: string): PhInfo | undefined {
    const norm = (t: string) => (t === 'ctrTitle' ? 'title' : t === 'subTitle' || t === 'obj' ? 'body' : t)
    return (idx !== undefined ? list.find((p) => p.idx === idx) : undefined) || list.find((p) => p.type === type) || list.find((p) => norm(p.type) === norm(type) && (type !== 'body' || !p.idx || p.idx === idx))
  }

  sp(sp: XEl, ctx: { part: Part; theme: Theme; map: ClrMap; layout?: LayoutCtx; decor?: boolean }, T: (x: Xfrm | undefined) => Xfrm | undefined, connector = false): ShapeEl | null {
    const nv = kid(sp, P, connector ? 'nvCxnSpPr' : 'nvSpPr')
    const ph = find(nv, P, 'ph')
    // A layout's or master's own placeholders are prompts for slides, not decoration.
    if (ctx.decor && ph) return null
    const cNvPr = find(nv, P, 'cNvPr')
    if (attr(cNvPr, 'hidden') === '1') return null
    const spPr = kid(sp, P, 'spPr')
    const { theme } = ctx
    const map = ctx.map
    const phType = ph ? attr(ph, 'type') || 'body' : undefined
    const phIdx = ph ? attr(ph, 'idx') : undefined
    const lay = ph && ctx.layout ? this.phMatch(ctx.layout.phs, phType!, phIdx) : undefined
    const mas = ph && ctx.layout ? this.phMatch(ctx.layout.master.phs, phType!, undefined) : undefined
    const x = T(this.xfrm(kid(spPr, A, 'xfrm')) || lay?.xfrm || mas?.xfrm)
    if (!x) return null
    if (find(nv, P, 'videoFile') || find(nv, P, 'audioFile')) this.lose('video and sound')
    const custom = kid(spPr, A, 'custGeom')
    if (custom) this.lose('freeform shapes (drawn as their outline box)')
    let geom = attr(kid(spPr, A, 'prstGeom'), 'prst') || lay?.geom || mas?.geom || (connector ? 'line' : 'rect')
    if (!isKnownPreset(geom) && !custom) { this.lose('shapes this editor does not draw (shown as rectangles)'); geom = /connector/i.test(geom) ? 'line' : geom }
    const adj = kids(kid(kid(spPr, A, 'prstGeom'), A, 'avLst'), A, 'gd').map((g) => { const m = /val\s+(-?\d+)/.exec(attr(g, 'fmla') || ''); return m ? +m[1] : NaN })
    const style = kid(sp, P, 'style')
    // A shape that sets no fill takes its theme style's: `fillRef idx` with a colour.
    const styleFill = (() => { const fr = kid(style, A, 'fillRef'); if (!fr || numAttr(fr, 'idx', 0) === 0) return undefined; const c = this.color(fr, theme, map); return c ? ({ type: 'solid', color: c } as Fill) : undefined })()
    const styleLine = (() => { const lr = kid(style, A, 'lnRef'); if (!lr || numAttr(lr, 'idx', 0) === 0) return undefined; const c = this.color(lr, theme, map); return c ? ({ color: c, width: 0.75 * numAttr(lr, 'idx', 1) } as Line) : undefined })()
    const fill = this.fill(spPr, theme, map, ctx.part) ?? lay?.fill ?? mas?.fill ?? styleFill
    const ln = kid(spPr, A, 'ln')
    let line = this.line(ln, theme, map)
    if (line === undefined) line = lay?.line ?? mas?.line ?? styleLine
    else if (line && !line.color && styleLine?.color) line.color = styleLine.color
    if (ln && line && !line.width && styleLine?.width) line.width = styleLine.width
    const out: ShapeEl = { id: this.id('e'), kind: 'shape', geom, x: x.x, y: x.y, w: x.w, h: x.h }
    if (x.rot) out.rot = x.rot
    if (x.flipH) out.flipH = true
    if (x.flipV) out.flipV = true
    if (adj.length && adj.every(Number.isFinite)) out.adj = adj
    out.fill = fill || { type: 'none' }
    out.line = line === undefined ? null : line
    const name = attr(cNvPr, 'name'); if (name) out.name = name
    const descr = attr(cNvPr, 'descr'); if (descr) out.alt = descr
    if (find(spPr, A, 'outerShdw') || find(kid(style, A, 'effectRef'), A, 'schemeClr') && numAttr(kid(style, A, 'effectRef'), 'idx', 0) > 1) out.shadow = true
    if (phType) out.ph = (['title', 'ctrTitle', 'subTitle', 'body', 'obj', 'dt', 'ftr', 'sldNum', 'pic'].includes(phType) ? phType : 'body') as Placeholder
    const tx = kid(sp, P, 'txBody')
    if (tx) {
      const master = ctx.layout?.master
      const base = !ph ? this.defaultText : !master ? [] : phType === 'title' || phType === 'ctrTitle' ? master.title : ['body', 'subTitle', 'obj'].includes(phType!) ? master.body : master.other
      // A subtitle in the master's body style keeps the body's bullets unless something says otherwise — PowerPoint's own subtitles say buNone.
      const chain = [base, mas?.list || [], lay?.list || []]
      const bodyChain = [mas?.body || {}, lay?.body || {}]
      const fontRef = kid(style, A, 'fontRef')
      const fc = fontRef ? this.color(fontRef, theme, map) : undefined
      if (fc) chain.unshift([{ color: fc }])
      out.text = this.textBody(tx, chain, bodyChain, theme, map, ctx.part, phType)
      if (phType === 'title' || phType === 'ctrTitle') out.text.defaults = { font: 'major', ...out.text.defaults }
      if (!out.text.paras.some((p) => p.runs.length) && !ph) delete out.text
    }
    if (ph && (phType === 'sldNum' || phType === 'dt' || phType === 'ftr') && !out.text?.paras.some((p) => p.runs.length)) return null
    return out
  }

  pic(pic: XEl, ctx: { part: Part; theme: Theme; map: ClrMap; layout?: LayoutCtx; decor?: boolean }, T: (x: Xfrm | undefined) => Xfrm | undefined): ImageEl | null {
    const nv = kid(pic, P, 'nvPicPr')
    if (ctx.decor && find(nv, P, 'ph')) return null
    const cNvPr = kid(nv, P, 'cNvPr')
    if (attr(cNvPr, 'hidden') === '1') return null
    if (find(nv, P, 'videoFile') || find(nv, P, 'audioFile') || find(nv, NS.a, 'videoFile')) this.lose('video and sound (their poster picture is kept)')
    const spPr = kid(pic, P, 'spPr')
    const x = T(this.xfrm(kid(spPr, A, 'xfrm')))
    const bf = kid(pic, P, 'blipFill')
    const media = bf ? this.blip(bf, ctx.part) : undefined
    if (!x || !media) return null
    const out: ImageEl = { id: this.id('e'), kind: 'image', media, x: x.x, y: x.y, w: x.w, h: x.h }
    if (x.rot) out.rot = x.rot
    if (x.flipH) out.flipH = true
    if (x.flipV) out.flipV = true
    const src = kid(bf, A, 'srcRect')
    if (src) {
      const c = { l: numAttr(src, 'l', 0) / 100000, t: numAttr(src, 't', 0) / 100000, r: numAttr(src, 'r', 0) / 100000, b: numAttr(src, 'b', 0) / 100000 }
      if (c.l || c.t || c.r || c.b) out.crop = c
    }
    const geom = attr(kid(spPr, A, 'prstGeom'), 'prst'); if (geom && geom !== 'rect' && isKnownPreset(geom)) out.geom = geom
    const ln = this.line(kid(spPr, A, 'ln'), ctx.theme, ctx.map); if (ln) out.line = ln
    const descr = attr(cNvPr, 'descr'); if (descr) out.alt = descr
    const name = attr(cNvPr, 'name'); if (name) out.name = name
    return out
  }

  frame(gf: XEl, ctx: { part: Part; theme: Theme; map: ClrMap; layout?: LayoutCtx; decor?: boolean }, T: (x: Xfrm | undefined) => Xfrm | undefined): El | null {
    const gd = find(gf, A, 'graphicData')
    const uri = attr(gd, 'uri') || ''
    const x = T(this.xfrm(kid(gf, P, 'xfrm')))
    if (/\/chart$|chartex/.test(uri)) { this.lose('charts'); return null }
    if (/diagram/.test(uri)) { this.lose('SmartArt diagrams'); return null }
    if (/ole/.test(uri)) {
      // An embedded object usually carries a preview picture; keep that.
      const p = find(gd, P, 'pic')
      this.lose('embedded objects (their preview picture is kept)')
      return p ? this.pic(p, ctx, () => x) : null
    }
    const tbl = kid(gd, A, 'tbl')
    if (!tbl || !x) { this.lose('embedded objects'); return null }
    const cols = kids(kid(tbl, A, 'tblGrid'), A, 'gridCol').map((g) => pt(numAttr(g, 'w', 0)))
    const tblPr = kid(tbl, A, 'tblPr')
    const out: TableEl = { id: this.id('e'), kind: 'table', x: x.x, y: x.y, w: x.w, h: x.h, cols, rows: [] }
    const hasStyle = !!kid(tblPr, A, 'tableStyleId') || !!attr(tblPr, 'firstRow')
    if (hasStyle) out.style = { header: attr(tblPr, 'firstRow') === '1', banded: attr(tblPr, 'bandRow') === '1', accent: 'accent1' }
    for (const tr of kids(tbl, A, 'tr')) {
      const row: { h: number; cells: Cell[] } = { h: pt(numAttr(tr, 'h', 0)), cells: [] }
      for (const tc of kids(tr, A, 'tc')) {
        const tx = kid(tc, A, 'txBody')
        const cell: Cell = { text: tx ? this.textBody(tx, [this.defaultText], [], ctx.theme, ctx.map, ctx.part) : { paras: [{ runs: [] }] } }
        const rs = numAttr(tc, 'rowSpan', 1), cs = numAttr(tc, 'gridSpan', 1)
        if (rs > 1 || cs > 1) cell.span = [rs, cs]
        if (attr(tc, 'hMerge') === '1' || attr(tc, 'vMerge') === '1') cell.merged = true
        const fill = this.fill(kid(tc, A, 'tcPr'), ctx.theme, ctx.map, ctx.part)
        if (fill?.type === 'solid') cell.fill = fill.color
        row.cells.push(cell)
      }
      out.rows.push(row)
    }
    const name = attr(find(kid(gf, P, 'nvGraphicFramePr'), P, 'cNvPr'), 'name'); if (name) out.name = name
    return out
  }

  // ---- a slide -------------------------------------------------------------
  async slide(path: string): Promise<Slide> {
    const part = await this.part(path)
    await this.preloadMedia(part)
    const lrel = part.rels.find((r) => relIs(r.type, REL.slideLayout))
    const layout = lrel ? await this.layout(lrel.target) : undefined
    const theme = layout?.master.theme || DEFAULT_DECK_THEME
    const ovr = kid(kid(part.root, P, 'clrMapOvr'), A, 'overrideClrMapping')
    const map = ovr ? clrMap(ovr) : layout?.map || DEFAULT_MAP
    const cSld = kid(part.root, P, 'cSld')
    const elements = await this.shapes(kid(cSld, P, 'spTree'), { part, theme, map, layout })
    const keys = spread(elements.length)
    elements.forEach((e, i) => (e.ord = keys[i]))
    const s: Slide = { id: this.id('s'), elements }
    const bg = this.background(cSld, theme, map, part)
    if (bg) s.bg = bg
    // A slide that turns off the master's graphics gets none of the shared backdrop.
    if (layout?.masterId && attr(part.root, 'showMasterSp') !== '0') s.master = layout.masterId
    else if (layout?.masterId) { const m = this.masters.find((x) => x.id === layout.masterId); if (m?.bg && !s.bg) s.bg = m.bg }
    if (attr(part.root, 'show') === '0') s.hidden = true
    const tr = kid(part.root, P, 'transition')
    if (tr) {
      const kind = kids(tr).find((k) => k.ns === P || /p14|p15/.test(k.ns))?.local || 'fade'
      const map2: Record<string, TransitionKind> = { fade: 'fade', dissolve: 'fade', push: 'push', wipe: 'wipe', cover: 'cover', pull: 'cover', zoom: 'zoom', split: 'wipe', cut: 'none', random: 'fade' }
      s.transition = { kind: map2[kind] || 'fade' }
      const dur = attr(tr, 'dur', 'http://schemas.microsoft.com/office/powerpoint/2010/main') || attr(tr, 'dur')
      if (dur) s.transition.dur = +dur
      else if (attr(tr, 'spd')) s.transition.dur = { slow: 1000, med: 750, fast: 500 }[attr(tr, 'spd') as 'slow'] || 700
    }
    if (kid(part.root, P, 'timing') && findAll(kid(part.root, P, 'timing'), P, 'par').length > 1) this.lose('animations')
    if (part.rels.some((r) => /comments/i.test(r.type))) this.lose('comments')
    const nrel = part.rels.find((r) => relIs(r.type, REL.notesSlide))
    if (nrel && this.pkg.has(nrel.target)) {
      try {
        const np = await this.part(nrel.target)
        const bodySp = kids(find(np.root, P, 'spTree'), P, 'sp').find((sp) => attr(find(sp, P, 'ph'), 'type') === 'body')
        const text = kids(kid(bodySp, P, 'txBody'), A, 'p').map((p) => kids(p).filter((k) => k.local === 'r' || k.local === 'br' || k.local === 'fld').map((k) => (k.local === 'br' ? '\n' : textOf(kid(k, A, 't')))).join('')).join('\n').trim()
        if (text) s.notes = text
      } catch { /* notes are a courtesy */ }
    }
    return s
  }
}

function clrMap(el: XEl | null): ClrMap {
  if (!el) return { ...DEFAULT_MAP }
  const out: ClrMap = { ...DEFAULT_MAP }
  for (const k of Object.keys(DEFAULT_MAP)) { const v = attr(el, k); if (v) out[k] = v }
  return out
}

export async function readPptx(buf: ArrayBuffer): Promise<PptxImport> {
  const pkg = await Package.open(buf)
  const main = await pkg.mainPart()
  if (!/presentation\.xml$/i.test(main) && !pkg.contentType(main).includes('presentationml')) throw new OpcError('not-ooxml')
  const r = new Reader(pkg)
  const pres = await r.part(main)
  const sz = kid(pres.root, P, 'sldSz')
  r.slideW = pt(numAttr(sz, 'cx', 12192000))
  r.slideH = pt(numAttr(sz, 'cy', 6858000))
  const slideIds = kids(kid(pres.root, P, 'sldIdLst'), P, 'sldId').map((s) => r.rel(pres, attr(s, 'id', R))?.target).filter((t): t is string => !!t && pkg.has(t))
  // The presentation's default text style is what a plain text box (not a placeholder) inherits.
  const firstMaster = kids(kid(pres.root, P, 'sldMasterIdLst'), P, 'sldMasterId').map((m) => r.rel(pres, attr(m, 'id', R))?.target).find((t) => t && pkg.has(t))
  const m0 = firstMaster ? await r.master(firstMaster) : null
  const theme = m0?.theme || DEFAULT_DECK_THEME
  r.defaultText = r.listStyle(kid(pres.root, P, 'defaultTextStyle'), theme, m0?.map || DEFAULT_MAP)
  const slides: Slide[] = []
  for (const s of slideIds) slides.push(await r.slide(s))
  // Slide-to-slide links were read as part paths; now that every slide has an id, point at it.
  const byPart = new Map(slideIds.map((p, i) => [p, slides[i].id]))
  for (const s of slides) for (const e of s.elements) if (e.kind === 'shape' && e.text) for (const p of e.text.paras) for (const run of p.runs) if (run.link?.startsWith('#slide-part:')) { const id = byPart.get(run.link.slice(12)); run.link = id ? `#slide:${id}` : undefined; if (!run.link) delete run.link }
  const keys = spread(slides.length)
  slides.forEach((s, i) => (s.ord = keys[i]))
  // Arabic anywhere in the deck makes it a right-to-left deck for new slides.
  const text = slides.flatMap((s) => s.elements.flatMap((e) => (e.kind === 'shape' && e.text ? e.text.paras.flatMap((p) => p.runs.map((x) => x.t)) : []))).join(' ')
  const ar = (text.match(/[؀-ۿ]/g) || []).length
  const lat = (text.match(/[A-Za-z]/g) || []).length
  const rtl = ar > lat
  const data: DeckData = { size: { w: r.slideW, h: r.slideH }, theme, slides, media: r.media, masters: r.masters, rtl, lang: rtl ? 'ar-SA' : 'en-US' }
  const sections = find(pres.root, 'http://schemas.microsoft.com/office/powerpoint/2010/main', 'sectionLst')
  if (sections) r.lose('sections')
  return { data, loss: [...r.loss].map(([what, count]) => ({ what, count })), title: await readTitle(pkg) }
}
