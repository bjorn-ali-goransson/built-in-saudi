// Open Packaging Conventions — the ZIP-of-XML layer every Office format shares.
//
// Reading: parts are inflated LAZILY, because a workbook with forty sheets and a
// deck with two hundred pictures should not decompress what the importer never
// asks for. Relationships are resolved to absolute part names once, here, because
// "../media/image1.png relative to ppt/slides/_rels/slide3.xml.rels" is precisely
// the arithmetic every hand-written importer gets subtly wrong.
//
// Writing: [Content_Types].xml and every _rels part are GENERATED from what was
// actually written, so a part can never be present without its content type or a
// relationship point at nothing — the two ways a hand-assembled package becomes a
// file Word "found unreadable content in".
import { zipEntries, readEntry, type ZipEntry as ReadEntry } from '../unzip'
import { zipFile } from '../zip'
import { parseXml, kids, attr, x, xmlDoc, type XEl } from '../xml'

export const NS = {
  pkgRel: 'http://schemas.openxmlformats.org/package/2006/relationships',
  ct: 'http://schemas.openxmlformats.org/package/2006/content-types',
  r: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
  w: 'http://schemas.openxmlformats.org/wordprocessingml/2006/main',
  s: 'http://schemas.openxmlformats.org/spreadsheetml/2006/main',
  p: 'http://schemas.openxmlformats.org/presentationml/2006/main',
  a: 'http://schemas.openxmlformats.org/drawingml/2006/main',
  wp: 'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing',
  pic: 'http://schemas.openxmlformats.org/drawingml/2006/picture',
  c: 'http://schemas.openxmlformats.org/drawingml/2006/chart',
  xdr: 'http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing',
  mc: 'http://schemas.openxmlformats.org/markup-compatibility/2006',
  cp: 'http://schemas.openxmlformats.org/package/2006/metadata/core-properties',
  dc: 'http://purl.org/dc/elements/1.1/',
  dcterms: 'http://purl.org/dc/terms/',
  xsi: 'http://www.w3.org/2001/XMLSchema-instance',
  ep: 'http://schemas.openxmlformats.org/officeDocument/2006/extended-properties',
  v: 'urn:schemas-microsoft-com:vml',
  x14: 'http://schemas.microsoft.com/office/spreadsheetml/2009/9/main',
  x14ac: 'http://schemas.microsoft.com/office/spreadsheetml/2009/9/ac',
  xml: 'http://www.w3.org/XML/1998/namespace',
  // Strict OOXML (ISO 29500 strict) uses different URIs for the same vocabulary.
  wStrict: 'http://purl.oclc.org/ooxml/wordprocessingml/main',
  sStrict: 'http://purl.oclc.org/ooxml/spreadsheetml/main',
  pStrict: 'http://purl.oclc.org/ooxml/presentationml/main',
  aStrict: 'http://purl.oclc.org/ooxml/drawingml/main',
  rStrict: 'http://purl.oclc.org/ooxml/officeDocument/relationships',
} as const

export const REL = {
  officeDocument: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument',
  styles: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles',
  numbering: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering',
  image: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image',
  hyperlink: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink',
  header: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/header',
  footer: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer',
  footnotes: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/footnotes',
  endnotes: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/endnotes',
  comments: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/comments',
  settings: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings',
  theme: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme',
  worksheet: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet',
  sharedStrings: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings',
  drawing: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing',
  chart: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart',
  slide: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide',
  slideLayout: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout',
  slideMaster: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster',
  notesSlide: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/notesSlide',
  notesMaster: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/notesMaster',
  coreProps: 'http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties',
  extProps: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties',
  presProps: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/presProps',
  viewProps: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/viewProps',
  tableStyles: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/tableStyles',
  fontTable: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/fontTable',
  webSettings: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/webSettings',
} as const

/** Strict-conformance relationship types end the same way; compare on the tail. */
export const relIs = (type: string, want: string) => type === want || type.split('/').pop() === want.split('/').pop()

export interface Rel { id: string; type: string; target: string; external: boolean }

/** Resolve a relationship target relative to the part that owns it. */
export function resolvePart(from: string, target: string): string {
  if (target.startsWith('/')) return target.slice(1)
  const base = from.split('/').slice(0, -1)
  for (const seg of target.split('/')) {
    if (seg === '..') base.pop()
    else if (seg !== '.' && seg !== '') base.push(seg)
  }
  return base.join('/')
}

/** The _rels part for a part: word/document.xml -> word/_rels/document.xml.rels */
export function relsPathOf(part: string): string {
  const i = part.lastIndexOf('/')
  return i < 0 ? `_rels/${part}.rels` : `${part.slice(0, i)}/_rels/${part.slice(i + 1)}.rels`
}

export class OpcError extends Error {
  constructor(readonly code: 'not-zip' | 'not-ooxml' | 'encrypted' | 'legacy-binary' | 'missing-part', msg?: string) { super(msg || code) }
}

const OLE = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]

/** Read-side package. */
export class Package {
  private entries = new Map<string, ReadEntry>()
  private cache = new Map<string, Uint8Array>()
  private relCache = new Map<string, Rel[]>()
  private xmlCache = new Map<string, XEl>()
  contentTypes: { defaults: Record<string, string>; overrides: Record<string, string> } = { defaults: {}, overrides: {} }

  private constructor(private buf: ArrayBuffer) {}

  static async open(buf: ArrayBuffer): Promise<Package> {
    const head = new Uint8Array(buf.slice(0, 8))
    if (OLE.every((b, i) => head[i] === b)) {
      // An OLE compound file is either a pre-2007 binary (.doc/.xls/.ppt) or an
      // ENCRYPTED OOXML file — Office wraps a password-protected .docx in OLE.
      // Both are refused by name, because "could not read" sends people back to
      // try the same file again.
      const tail = new TextDecoder('utf-16le').decode(new Uint8Array(buf.slice(0, Math.min(buf.byteLength, 65536))))
      throw new OpcError(tail.includes('EncryptedPackage') ? 'encrypted' : 'legacy-binary')
    }
    const list = zipEntries(buf)
    if (!list) throw new OpcError('not-zip')
    const pkg = new Package(buf)
    for (const e of list) if (!e.name.endsWith('/')) pkg.entries.set(e.name.replace(/^\//, ''), e)
    // Part names are case-insensitive in OPC; keep a lower-cased index as well.
    for (const [k, v] of [...pkg.entries]) if (!pkg.entries.has(k.toLowerCase())) pkg.entries.set(k.toLowerCase(), v)
    const ct = await pkg.xml('[Content_Types].xml').catch(() => null)
    if (!ct) throw new OpcError('not-ooxml')
    for (const d of kids(ct, NS.ct, 'Default')) pkg.contentTypes.defaults[(attr(d, 'Extension') || '').toLowerCase()] = attr(d, 'ContentType') || ''
    for (const o of kids(ct, NS.ct, 'Override')) pkg.contentTypes.overrides[(attr(o, 'PartName') || '').replace(/^\//, '').toLowerCase()] = attr(o, 'ContentType') || ''
    return pkg
  }

  names(): string[] { return [...new Set([...this.entries.values()].map((e) => e.name.replace(/^\//, '')))] }
  has(part: string): boolean { return this.entries.has(part) || this.entries.has(part.toLowerCase()) }
  contentType(part: string): string {
    const o = this.contentTypes.overrides[part.toLowerCase()]
    if (o) return o
    const ext = part.split('.').pop()?.toLowerCase() || ''
    return this.contentTypes.defaults[ext] || ''
  }

  async bytes(part: string): Promise<Uint8Array> {
    const hit = this.cache.get(part)
    if (hit) return hit
    const e = this.entries.get(part) || this.entries.get(part.toLowerCase())
    if (!e) throw new OpcError('missing-part', part)
    const b = await readEntry(this.buf, e)
    this.cache.set(part, b)
    return b
  }
  async text(part: string): Promise<string> { return new TextDecoder().decode(await this.bytes(part)) }
  async xml(part: string): Promise<XEl> {
    const hit = this.xmlCache.get(part)
    if (hit) return hit
    const el = parseXml(await this.text(part))
    this.xmlCache.set(part, el)
    return el
  }
  async tryXml(part: string | undefined): Promise<XEl | null> {
    if (!part || !this.has(part)) return null
    try { return await this.xml(part) } catch { return null }
  }

  async rels(part: string): Promise<Rel[]> {
    const hit = this.relCache.get(part)
    if (hit) return hit
    const rp = relsPathOf(part)
    let out: Rel[] = []
    if (this.has(rp)) {
      const el = await this.xml(rp)
      out = kids(el, NS.pkgRel, 'Relationship').map((r) => {
        const external = attr(r, 'TargetMode') === 'External'
        const target = attr(r, 'Target') || ''
        return { id: attr(r, 'Id') || '', type: attr(r, 'Type') || '', target: external ? target : resolvePart(part, target), external }
      })
    }
    this.relCache.set(part, out)
    return out
  }
  async relById(part: string, id: string): Promise<Rel | undefined> { return (await this.rels(part)).find((r) => r.id === id) }
  async relsOfType(part: string, type: string): Promise<Rel[]> { return (await this.rels(part)).filter((r) => relIs(r.type, type)) }
  /** The main document part, from the package root relationships. */
  async mainPart(): Promise<string> {
    const r = (await this.relsOfType('', REL.officeDocument))[0]
    if (!r) throw new OpcError('not-ooxml')
    return r.target
  }
}

// ---- write side --------------------------------------------------------------

export interface WriteRel { type: string; target: string; external?: boolean }

/**
 * Write-side package. Add parts with their content type; relationships are
 * declared per source part and get ids assigned here, so callers never invent an
 * `rId` that collides with another.
 */
export class PackageWriter {
  private parts = new Map<string, { bytes: Uint8Array; type: string }>()
  private rels = new Map<string, { id: string; rel: WriteRel }[]>()
  private defaults: Record<string, string> = {
    rels: 'application/vnd.openxmlformats-package.relationships+xml',
    xml: 'application/xml',
    png: 'image/png', jpeg: 'image/jpeg', jpg: 'image/jpeg', gif: 'image/gif', bmp: 'image/bmp',
    svg: 'image/svg+xml', webp: 'image/webp', tif: 'image/tiff', tiff: 'image/tiff', emf: 'image/x-emf', wmf: 'image/x-wmf',
  }

  add(part: string, data: string | Uint8Array, contentType?: string): void {
    const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data
    const ext = part.split('.').pop()?.toLowerCase() || ''
    this.parts.set(part, { bytes, type: contentType || this.defaults[ext] || 'application/octet-stream' })
  }
  has(part: string): boolean { return this.parts.has(part) }
  /** Declare a relationship from `from` ('' = package root). Returns its id. */
  rel(from: string, rel: WriteRel): string {
    const list = this.rels.get(from) || []
    const same = list.find((r) => r.rel.type === rel.type && r.rel.target === rel.target && !!r.rel.external === !!rel.external)
    if (same) return same.id
    const id = `rId${list.length + 1}`
    list.push({ id, rel })
    this.rels.set(from, list)
    return id
  }
  /** A relative target from part `from` to part `to`. */
  static relTarget(from: string, to: string): string {
    const a = from.split('/').slice(0, -1)
    const b = to.split('/')
    let i = 0
    while (i < a.length && i < b.length - 1 && a[i] === b[i]) i++
    return [...a.slice(i).map(() => '..'), ...b.slice(i)].join('/')
  }

  async toBlob(mime: string): Promise<Blob> {
    const files: { name: string; bytes: Uint8Array }[] = []
    const enc = new TextEncoder()
    const exts = new Set<string>(['rels', 'xml'])
    const overrides: [string, string][] = []
    for (const [name, p] of this.parts) {
      const ext = name.split('.').pop()?.toLowerCase() || ''
      if (this.defaults[ext] === p.type) exts.add(ext)
      else overrides.push([name, p.type])
    }
    const ct = x('Types', { xmlns: NS.ct },
      [...exts].sort().map((e) => x('Default', { Extension: e, ContentType: this.defaults[e] })),
      overrides.map(([n, t]) => x('Override', { PartName: '/' + n, ContentType: t })))
    files.push({ name: '[Content_Types].xml', bytes: enc.encode(xmlDoc(ct)) })
    for (const [from, list] of this.rels) {
      const body = x('Relationships', { xmlns: NS.pkgRel }, list.map(({ id, rel }) => x('Relationship', {
        Id: id, Type: rel.type,
        Target: rel.external ? rel.target : from === '' ? rel.target : PackageWriter.relTarget(from, rel.target),
        TargetMode: rel.external ? 'External' : undefined,
      })))
      files.push({ name: relsPathOf(from), bytes: enc.encode(xmlDoc(body)) })
    }
    for (const [name, p] of this.parts) files.push({ name, bytes: p.bytes })
    const blob = await zipFile(files)
    return new Blob([blob], { type: mime })
  }
}

/** docProps/core.xml + app.xml, with the relationships, in one call. */
export function writeDocProps(w: PackageWriter, meta: { title?: string; creator?: string; app: string }): void {
  const now = new Date().toISOString().replace(/\.\d+Z$/, 'Z')
  w.add('docProps/core.xml', xmlDoc(x('cp:coreProperties', {
    'xmlns:cp': NS.cp, 'xmlns:dc': NS.dc, 'xmlns:dcterms': NS.dcterms, 'xmlns:dcmitype': 'http://purl.org/dc/dcmitype/', 'xmlns:xsi': NS.xsi,
  },
  meta.title ? x('dc:title', null, meta.title) : null,
  x('dc:creator', null, meta.creator || 'Built in Saudi'),
  x('dcterms:created', { 'xsi:type': 'dcterms:W3CDTF' }, now),
  x('dcterms:modified', { 'xsi:type': 'dcterms:W3CDTF' }, now))),
  'application/vnd.openxmlformats-package.core-properties+xml')
  w.add('docProps/app.xml', xmlDoc(x('Properties', { xmlns: NS.ep }, x('Application', null, meta.app))),
    'application/vnd.openxmlformats-officedocument.extended-properties+xml')
  w.rel('', { type: REL.coreProps, target: 'docProps/core.xml' })
  w.rel('', { type: REL.extProps, target: 'docProps/app.xml' })
}

/** Read the title out of docProps/core.xml, if any. */
export async function readTitle(pkg: Package): Promise<string> {
  const core = await pkg.tryXml('docProps/core.xml')
  if (!core) return ''
  for (const c of core.children) if (typeof c !== 'string' && c.local === 'title') return c.children.filter((k) => typeof k === 'string').join('')
  return ''
}

// ---- small shared helpers ------------------------------------------------------

/** Sniff an image's type from its bytes — content types inside real files lie. */
export function sniffImage(b: Uint8Array): { mime: string; ext: string } | null {
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return { mime: 'image/png', ext: 'png' }
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { mime: 'image/jpeg', ext: 'jpeg' }
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return { mime: 'image/gif', ext: 'gif' }
  if (b[0] === 0x42 && b[1] === 0x4d) return { mime: 'image/bmp', ext: 'bmp' }
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return { mime: 'image/webp', ext: 'webp' }
  if (b[0] === 0x01 && b[1] === 0x00 && b[2] === 0x00 && b[3] === 0x00 && b[40] === 0x20 && b[41] === 0x45 && b[42] === 0x4d && b[43] === 0x46) return { mime: 'image/x-emf', ext: 'emf' }
  if (b[0] === 0xd7 && b[1] === 0xcd && b[2] === 0xc6 && b[3] === 0x9a) return { mime: 'image/x-wmf', ext: 'wmf' }
  const head = new TextDecoder().decode(b.slice(0, 256)).trimStart()
  if (head.startsWith('<svg') || (head.startsWith('<?xml') && head.includes('<svg'))) return { mime: 'image/svg+xml', ext: 'svg' }
  return null
}

/** Base64 of bytes, chunked so a large picture does not blow the argument limit. */
export function toBase64(b: Uint8Array): string {
  let s = ''
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000))
  return btoa(s)
}
export function fromBase64(s: string): Uint8Array {
  const bin = atob(s)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}
export function dataUrl(b: Uint8Array, mime: string): string { return `data:${mime};base64,${toBase64(b)}` }
export function parseDataUrl(u: string): { mime: string; bytes: Uint8Array } | null {
  const m = /^data:([^;,]+)(;base64)?,(.*)$/s.exec(u)
  if (!m) return null
  return { mime: m[1], bytes: m[2] ? fromBase64(m[3]) : new TextEncoder().encode(decodeURIComponent(m[3])) }
}

// ---- units -----------------------------------------------------------------------
export const EMU_PER_PX = 9525
export const EMU_PER_PT = 12700
export const TWIP_PER_PT = 20
export const emuToPx = (e: number) => e / EMU_PER_PX
export const pxToEmu = (p: number) => Math.round(p * EMU_PER_PX)
export const twipToPx = (t: number) => (t / 20) * (96 / 72)
export const pxToTwip = (p: number) => Math.round(p * (72 / 96) * 20)
export const ptToPx = (p: number) => p * (96 / 72)
export const pxToPt = (p: number) => p * (72 / 96)
