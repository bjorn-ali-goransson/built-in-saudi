// A small, deliberately-rudimentary PDF content-stream engine for the Edit PDF
// tool. It parses each page's content stream into editable *objects* — images
// (exact on-page rect from the CTM) and text runs (approximate rect) — each
// carrying the byte span needed to delete it, plus, for images, the enclosing
// `q…Q` block so we can delete or translate (move) the whole draw. pdf-lib reads
// / re-encodes the streams; pdf.js renders the page picture behind it.
//
// LIMITATIONS (surfaced to the user): text rects are approximate (glyph metrics
// aren't computed); deleting text removes a whole show-text operator, not a
// single glyph; complex/compressed/XFA constructs and unusual encodings may not
// map cleanly. It edits what it understands and leaves the rest untouched.
import { PDFDocument, PDFName, PDFArray, PDFRawStream, decodePDFRawStream } from 'pdf-lib'

export type Mat = [number, number, number, number, number, number]
const ID: Mat = [1, 0, 0, 1, 0, 0]
// row-vector concatenation: point' = point · (m · n)
function mul(m: Mat, n: Mat): Mat {
  return [
    m[0] * n[0] + m[1] * n[2],
    m[0] * n[1] + m[1] * n[3],
    m[2] * n[0] + m[3] * n[2],
    m[2] * n[1] + m[3] * n[3],
    m[4] * n[0] + m[5] * n[2] + n[4],
    m[4] * n[1] + m[5] * n[3] + n[5],
  ]
}

export interface EditObject {
  id: string
  kind: 'image' | 'text'
  page: number
  x: number; y: number; w: number; h: number // normalised, top-left origin
  delStart: number; delEnd: number            // byte span to remove on delete
  insertAt?: number                            // where to inject a move-cm (images)
  str?: string                                 // best-effort text (label only)
}

export interface PageContent {
  page: number
  content: string     // decoded content stream (latin1)
  wPt: number; hPt: number
  objects: EditObject[]
}

interface Tok { t: 'num' | 'name' | 'str' | 'arr' | 'op' | 'other'; v: string; nums?: number[]; text?: string; s: number; e: number }

const WS = new Set([' ', '\t', '\r', '\n', '\f', '\0'])
const DELIM = new Set(['(', ')', '<', '>', '[', ']', '{', '}', '/', '%'])

function unescapeLiteral(s: string): string {
  return s.replace(/\\([nrtbf()\\]|[0-7]{1,3})/g, (_m, g) => {
    const map: Record<string, string> = { n: '\n', r: '\r', t: '\t', b: '\b', f: '\f', '(': '(', ')': ')', '\\': '\\' }
    if (map[g] != null) return map[g]
    return String.fromCharCode(parseInt(g, 8) & 0xff)
  })
}
function hexToStr(h: string): string {
  const clean = h.replace(/\s+/g, '')
  const padded = clean.length % 2 ? clean + '0' : clean
  let out = ''
  for (let i = 0; i < padded.length; i += 2) out += String.fromCharCode(parseInt(padded.slice(i, i + 2), 16) & 0xff)
  return out
}

/** Tokenise a content stream just enough to interpret operators + operands. */
function tokenize(c: string): Tok[] {
  const toks: Tok[] = []
  let i = 0
  const n = c.length
  while (i < n) {
    const ch = c[i]
    if (WS.has(ch)) { i++; continue }
    if (ch === '%') { while (i < n && c[i] !== '\n' && c[i] !== '\r') i++; continue }
    const s = i
    if (ch === '/') {
      i++
      while (i < n && !WS.has(c[i]) && !DELIM.has(c[i])) i++
      toks.push({ t: 'name', v: c.slice(s + 1, i), s, e: i })
      continue
    }
    if (ch === '(') {
      let depth = 1; i++
      while (i < n && depth > 0) { const d = c[i]; if (d === '\\') i += 2; else { if (d === '(') depth++; else if (d === ')') depth--; i++ } }
      toks.push({ t: 'str', v: c.slice(s, i), text: unescapeLiteral(c.slice(s + 1, i - 1)), s, e: i })
      continue
    }
    if (ch === '<' && c[i + 1] === '<') { i += 2; toks.push({ t: 'other', v: '<<', s, e: i }); continue }
    if (ch === '>' && c[i + 1] === '>') { i += 2; toks.push({ t: 'other', v: '>>', s, e: i }); continue }
    if (ch === '<') { i++; while (i < n && c[i] !== '>') i++; i++; toks.push({ t: 'str', v: c.slice(s, i), text: hexToStr(c.slice(s + 1, i - 1)), s, e: i }); continue }
    if (ch === '[') {
      // capture the whole array as one operand (TJ needs its strings)
      let depth = 1; i++; let text = ''
      while (i < n && depth > 0) {
        const d = c[i]
        if (d === '[') { depth++; i++ }
        else if (d === ']') { depth--; i++ }
        else if (d === '(') { const st = i; let dp = 1; i++; while (i < n && dp > 0) { if (c[i] === '\\') i += 2; else { if (c[i] === '(') dp++; else if (c[i] === ')') dp--; i++ } } text += unescapeLiteral(c.slice(st + 1, i - 1)) }
        else if (d === '<') { const st = i; i++; while (i < n && c[i] !== '>') i++; i++; text += hexToStr(c.slice(st + 1, i - 1)) }
        else i++
      }
      toks.push({ t: 'arr', v: c.slice(s, i), text, s, e: i })
      continue
    }
    if ((ch >= '0' && ch <= '9') || ch === '+' || ch === '-' || ch === '.') {
      i++
      while (i < n && !WS.has(c[i]) && !DELIM.has(c[i])) i++
      toks.push({ t: 'num', v: c.slice(s, i), s, e: i })
      continue
    }
    // operator (keyword)
    i++
    while (i < n && !WS.has(c[i]) && !DELIM.has(c[i])) i++
    toks.push({ t: 'op', v: c.slice(s, i), s, e: i })
  }
  return toks
}

function getImageNames(pdf: PDFDocument, page: ReturnType<PDFDocument['getPage']>): Set<string> {
  const names = new Set<string>()
  try {
    const res = page.node.Resources()
    const xobj = res?.lookup(PDFName.of('XObject'))
    // @ts-expect-error dict shape is loose
    const entries = xobj && xobj.entries ? xobj.entries() : []
    for (const [key, ref] of entries) {
      const st = pdf.context.lookup(ref)
      // @ts-expect-error stream dict access
      const sub = st?.dict?.get(PDFName.of('Subtype'))
      if (sub && sub.toString() === '/Image') names.add(key.toString().replace(/^\//, ''))
    }
  } catch { /* no resources */ }
  return names
}

function pageContentString(pdf: PDFDocument, page: ReturnType<PDFDocument['getPage']>): string {
  const raw = page.node.get(PDFName.of('Contents'))
  const obj = pdf.context.lookup(raw)
  const streams = obj instanceof PDFArray ? obj.asArray().map((r) => pdf.context.lookup(r)) : [obj]
  return streams
    .filter((s): s is PDFRawStream => s instanceof PDFRawStream)
    .map((s) => String.fromCharCode(...decodePDFRawStream(s).decode()))
    .join('\n')
}

/** Parse one page's content into editable objects. */
function parsePage(content: string, page: number, wPt: number, hPt: number, imageNames: Set<string>): EditObject[] {
  const toks = tokenize(content)
  const objs: EditObject[] = []
  let ctm: Mat = [...ID]
  let tm: Mat = [...ID], tlm: Mat = [...ID], fontSize = 12, leading = 0
  const gstack: { ctm: Mat; qStart: number; imgs: EditObject[] }[] = []
  let block: { qStart: number; imgs: EditObject[] } | null = null
  const ops: Tok[] = [] // operand buffer
  let uid = 0
  const nums = () => ops.filter((o) => o.t === 'num').map((o) => Number(o.v))

  for (let k = 0; k < toks.length; k++) {
    const tk = toks[k]
    if (tk.t !== 'op') { ops.push(tk); continue }
    const op = tk.v
    switch (op) {
      case 'q': gstack.push({ ctm: [...ctm], qStart: tk.s, imgs: [] }); block = gstack[gstack.length - 1]; break
      case 'Q': {
        const popped = gstack.pop()
        if (popped) { ctm = popped.ctm; for (const im of popped.imgs) im.delEnd = tk.e }
        block = gstack.length ? gstack[gstack.length - 1] : null
        break
      }
      case 'cm': { const a = nums(); if (a.length >= 6) ctm = mul(a.slice(0, 6) as Mat, ctm); break }
      case 'BT': tm = [...ID]; tlm = [...ID]; break
      case 'Tf': { const a = nums(); if (a.length) fontSize = a[a.length - 1]; break }
      case 'TL': { const a = nums(); if (a.length) leading = a[a.length - 1]; break }
      case 'Td': case 'TD': { const a = nums(); if (a.length >= 2) { if (op === 'TD') leading = -a[1]; tlm = mul([1, 0, 0, 1, a[0], a[1]], tlm); tm = [...tlm] } break }
      case 'Tm': { const a = nums(); if (a.length >= 6) { tm = a.slice(0, 6) as Mat; tlm = [...tm] } break }
      case 'T*': tlm = mul([1, 0, 0, 1, 0, -leading], tlm); tm = [...tlm]; break
      case 'Tj': case "'": case '"': {
        if (op !== 'Tj') { tlm = mul([1, 0, 0, 1, 0, -leading], tlm); tm = [...tlm] }
        const strTok = [...ops].reverse().find((o) => o.t === 'str')
        if (strTok) objs.push(textObj(strTok.s, tk.e, strTok.text || '', tm, ctm, fontSize, page, wPt, hPt, uid++))
        break
      }
      case 'TJ': {
        const arr = [...ops].reverse().find((o) => o.t === 'arr')
        if (arr) objs.push(textObj(arr.s, tk.e, arr.text || '', tm, ctm, fontSize, page, wPt, hPt, uid++))
        break
      }
      case 'Do': {
        const nm = [...ops].reverse().find((o) => o.t === 'name')
        if (nm && imageNames.has(nm.v) && block) {
          const [a, , , d, e, f] = ctm
          const x0 = Math.min(e, e + a), y1 = Math.max(f, f + d)
          const im: EditObject = {
            id: `o${page}_${uid++}`, kind: 'image', page,
            x: x0 / wPt, y: 1 - y1 / hPt, w: Math.abs(a) / wPt, h: Math.abs(d) / hPt,
            delStart: block.qStart, delEnd: tk.e, insertAt: block.qStart + 1,
          }
          block.imgs.push(im)
          objs.push(im)
        }
        break
      }
      case 'BI': { // inline image — skip to EI
        let j = k + 1
        while (j < toks.length && toks[j].v !== 'EI') j++
        k = j
        break
      }
      default: break
    }
    ops.length = 0
  }
  return objs
}

function textObj(s: number, e: number, str: string, tm: Mat, ctm: Mat, fontSize: number, page: number, wPt: number, hPt: number, id: number): EditObject {
  const trm = mul(tm, ctm)
  const size = Math.max(1, fontSize * Math.hypot(tm[0], tm[1]) * Math.hypot(ctm[0], ctm[1]))
  const width = Math.max(size * 0.5, str.length * size * 0.5)
  const baselineX = trm[4], baselineY = trm[5]
  const top = baselineY + size * 0.8
  return {
    id: `o${page}_t${id}`, kind: 'text', page,
    x: baselineX / wPt, y: 1 - top / hPt, w: width / wPt, h: size / hPt,
    delStart: s, delEnd: e, str: str.slice(0, 60),
  }
}

/** Load a PDF and extract every page's editable objects (keeps the doc + the
 *  decoded content strings so edits can be applied to the same instance). */
export async function loadEditable(data: ArrayBuffer): Promise<{ pdf: PDFDocument; pages: PageContent[] }> {
  const pdf = await PDFDocument.load(data)
  const pages: PageContent[] = []
  pdf.getPages().forEach((page, i) => {
    const { width, height } = page.getSize()
    let content = ''
    try { content = pageContentString(pdf, page) } catch { /* unreadable */ }
    const objects = content ? parsePage(content, i, width, height, getImageNames(pdf, page)) : []
    pages.push({ page: i, content, wPt: width, hPt: height, objects })
  })
  return { pdf, pages }
}

/** A manipulated image: target centre + unrotated size (normalised, top-left
 *  origin) + screen-clockwise rotation in radians. */
export interface ImgXf { cx: number; cy: number; w: number; h: number; rot: number }

/** Apply deletions + image transforms (move/scale/rotate) to a page's content.
 *  For a transformed image we inject one `cm` at its draw block that maps the
 *  original placement to the target box (scale·rotate·translate about centres). */
export function applyEdits(pc: PageContent, deleted: Set<string>, transforms: Map<string, ImgXf>): string {
  type Edit = { start: number; end: number; rep: string }
  const edits: Edit[] = []
  const W = pc.wPt, H = pc.hPt
  const fmt = (n: number) => (Object.is(n, -0) ? 0 : n).toFixed(4)
  for (const o of pc.objects) {
    if (deleted.has(o.id)) { edits.push({ start: o.delStart, end: o.delEnd, rep: '' }); continue }
    if (o.kind === 'image' && o.insertAt != null && transforms.has(o.id)) {
      const t = transforms.get(o.id)!
      const sx = o.w ? t.w / o.w : 1, sy = o.h ? t.h / o.h : 1
      const R = -t.rot // screen y-down is flipped vs PDF y-up
      const cos = Math.cos(R), sin = Math.sin(R)
      const a = sx * cos, b = sx * sin, c = -sy * sin, d = sy * cos
      const ocx = (o.x + o.w / 2) * W, ocy = H - (o.y + o.h / 2) * H
      const tcx = t.cx * W, tcy = H - t.cy * H
      const e = tcx - (ocx * a + ocy * c), f = tcy - (ocx * b + ocy * d)
      edits.push({ start: o.insertAt, end: o.insertAt, rep: `\n${fmt(a)} ${fmt(b)} ${fmt(c)} ${fmt(d)} ${fmt(e)} ${fmt(f)} cm` })
    }
  }
  edits.sort((x, y) => y.start - x.start)
  let out = pc.content
  for (const ed of edits) out = out.slice(0, ed.start) + ed.rep + out.slice(ed.end)
  return out
}

/** Replace a page's content with an edited string (uncompressed stream). */
export function writePage(pdf: PDFDocument, pageIndex: number, content: string): void {
  const bytes = Uint8Array.from(content, (ch) => ch.charCodeAt(0) & 0xff)
  const stream = pdf.context.stream(bytes)
  pdf.getPage(pageIndex).node.set(PDFName.of('Contents'), pdf.context.register(stream))
}
