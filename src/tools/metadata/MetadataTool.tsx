import { useState } from 'react'
import { useLocale } from '../../i18n'
import { Stack } from '../../components/ui'

const STR = {
  en: {
    drop: 'Drop a file here, or', browse: 'browse', hint: 'Files never leave your browser.',
    file: 'File', image: 'Image', camera: 'Camera / EXIF', location: 'Location', document: 'Document', media: 'Media', text: 'Embedded text',
    name: 'Name', size: 'Size', type: 'Type', modified: 'Modified', dimensions: 'Dimensions',
    make: 'Make', model: 'Model', taken: 'Taken', orientation: 'Orientation', exposure: 'Exposure', aperture: 'Aperture', iso: 'ISO', focal: 'Focal length', lens: 'Lens', software: 'Software',
    gps: 'Coordinates', map: 'Open in map',
    title: 'Title', author: 'Author', subject: 'Subject', creator: 'Creator', producer: 'Producer', created: 'Created', pages: 'Pages',
    duration: 'Duration', none: 'No embedded metadata found — showing the basics.',
  },
  ar: {
    drop: 'أفلِت ملفًا هنا، أو', browse: 'تصفّح', hint: 'الملفات لا تغادر متصفحك.',
    file: 'الملف', image: 'الصورة', camera: 'الكاميرا / EXIF', location: 'الموقع', document: 'المستند', media: 'الوسائط', text: 'نص مضمّن',
    name: 'الاسم', size: 'الحجم', type: 'النوع', modified: 'آخر تعديل', dimensions: 'الأبعاد',
    make: 'الصانع', model: 'الطراز', taken: 'التُقطت', orientation: 'الاتجاه', exposure: 'التعريض', aperture: 'فتحة العدسة', iso: 'ISO', focal: 'البُعد البؤري', lens: 'العدسة', software: 'البرنامج',
    gps: 'الإحداثيات', map: 'فتح في الخريطة',
    title: 'العنوان', author: 'المؤلف', subject: 'الموضوع', creator: 'المُنشئ', producer: 'المُنتِج', created: 'أُنشئ', pages: 'الصفحات',
    duration: 'المدّة', none: 'لا توجد بيانات وصفية مضمّنة — نعرض الأساسيات.',
  },
}

const fmtBytes = (n: number) => {
  if (n < 1024) return `${n} B`
  const u = ['KB', 'MB', 'GB']; let i = -1; let v = n
  do { v /= 1024; i++ } while (v >= 1024 && i < u.length - 1)
  return `${v.toFixed(v < 10 ? 1 : 0)} ${u[i]}`
}

interface Row { label: string; value: string; href?: string }
interface Group { title: string; rows: Row[] }

const TYPE_SIZE = [0, 1, 1, 2, 4, 8, 0, 1, 0, 4, 8]

// ── Image dimensions by format ──
function imageDims(b: Uint8Array, dv: DataView): [number, number] | null {
  if (b[0] === 0x89 && b[1] === 0x50) return [dv.getUint32(16), dv.getUint32(20)] // PNG IHDR
  if (b[0] === 0x47 && b[1] === 0x49) return [dv.getUint16(6, true), dv.getUint16(8, true)] // GIF
  if (b[0] === 0x42 && b[1] === 0x4d) return [dv.getInt32(18, true), dv.getInt32(22, true)] // BMP
  if (b[0] === 0xff && b[1] === 0xd8) { // JPEG: scan SOF markers
    let o = 2
    while (o < b.length) {
      if (b[o] !== 0xff) { o++; continue }
      const m = b[o + 1]
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return [dv.getUint16(o + 7), dv.getUint16(o + 5)]
      o += 2 + dv.getUint16(o + 2)
    }
  }
  if (b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) { // WEBP
    const fourcc = String.fromCharCode(b[12], b[13], b[14], b[15])
    if (fourcc === 'VP8 ') return [dv.getUint16(26, true) & 0x3fff, dv.getUint16(28, true) & 0x3fff]
    if (fourcc === 'VP8L') { const bits = dv.getUint32(21, true); return [(bits & 0x3fff) + 1, ((bits >> 14) & 0x3fff) + 1] }
    if (fourcc === 'VP8X') return [((b[24] | (b[25] << 8) | (b[26] << 16)) & 0xffffff) + 1, ((b[27] | (b[28] << 8) | (b[29] << 16)) & 0xffffff) + 1]
  }
  return null
}

// ── JPEG EXIF ──
function readTagValue(dv: DataView, entryOff: number, tiffStart: number, little: boolean): number | number[] | string | null {
  const type = dv.getUint16(entryOff + 2, little)
  const count = dv.getUint32(entryOff + 4, little)
  const es = TYPE_SIZE[type] || 0
  let valOff = entryOff + 8
  if (es * count > 4) valOff = tiffStart + dv.getUint32(entryOff + 8, little)
  if (type === 2) { let s = ''; for (let i = 0; i < count; i++) { const c = dv.getUint8(valOff + i); if (!c) break; s += String.fromCharCode(c) } return s.trim() }
  const one = (o: number): number => {
    switch (type) {
      case 1: case 7: return dv.getUint8(o)
      case 3: return dv.getUint16(o, little)
      case 4: return dv.getUint32(o, little)
      case 5: return dv.getUint32(o, little) / dv.getUint32(o + 4, little)
      case 9: return dv.getInt32(o, little)
      case 10: return dv.getInt32(o, little) / dv.getInt32(o + 4, little)
      default: return NaN
    }
  }
  if (count === 1) return one(valOff)
  const arr: number[] = []; for (let i = 0; i < count; i++) arr.push(one(valOff + i * es)); return arr
}

function readIfd(dv: DataView, tiffStart: number, ifdOff: number, little: boolean): Record<number, number | number[] | string> {
  const out: Record<number, number | number[] | string> = {}
  if (ifdOff + 2 > dv.byteLength) return out
  const n = dv.getUint16(ifdOff, little)
  for (let i = 0; i < n; i++) {
    const e = ifdOff + 2 + i * 12
    if (e + 12 > dv.byteLength) break
    const tag = dv.getUint16(e, little)
    const v = readTagValue(dv, e, tiffStart, little)
    if (v != null) out[tag] = v
  }
  return out
}

function parseExif(b: Uint8Array, dv: DataView): { ifd0: Record<number, unknown>; exif: Record<number, unknown>; gps: Record<number, unknown> } | null {
  if (!(b[0] === 0xff && b[1] === 0xd8)) return null
  let o = 2
  while (o + 4 < b.length) {
    if (b[o] !== 0xff) { o++; continue }
    if (b[o + 1] === 0xe1) { // APP1
      if (String.fromCharCode(b[o + 4], b[o + 5], b[o + 6], b[o + 7]) === 'Exif') {
        const tiff = o + 10
        const little = dv.getUint16(tiff) === 0x4949
        const ifd0Off = tiff + dv.getUint32(tiff + 4, little)
        const ifd0 = readIfd(dv, tiff, ifd0Off, little)
        const exif = ifd0[0x8769] ? readIfd(dv, tiff, tiff + Number(ifd0[0x8769]), little) : {}
        const gps = ifd0[0x8825] ? readIfd(dv, tiff, tiff + Number(ifd0[0x8825]), little) : {}
        return { ifd0, exif, gps }
      }
    }
    o += 2 + dv.getUint16(o + 2)
  }
  return null
}

const dms = (v: unknown, ref: unknown): number | null => {
  if (!Array.isArray(v) || v.length < 3) return null
  let d = v[0] + v[1] / 60 + v[2] / 3600
  if (ref === 'S' || ref === 'W') d = -d
  return d
}

// ── PNG text chunks ──
function parsePngText(b: Uint8Array): Row[] {
  const rows: Row[] = []
  if (!(b[0] === 0x89 && b[1] === 0x50)) return rows
  let o = 8
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength)
  while (o + 8 < b.length) {
    const len = dv.getUint32(o)
    const type = String.fromCharCode(b[o + 4], b[o + 5], b[o + 6], b[o + 7])
    if (type === 'tEXt') {
      let s = ''; for (let i = 0; i < len; i++) s += String.fromCharCode(b[o + 8 + i])
      const nul = s.indexOf('\0')
      if (nul > 0) rows.push({ label: s.slice(0, nul), value: s.slice(nul + 1).slice(0, 120) })
    }
    if (type === 'IEND') break
    o += 12 + len
  }
  return rows
}

// ── PDF metadata (lightweight) ──
function parsePdf(b: Uint8Array): Row[] | null {
  if (String.fromCharCode(b[0], b[1], b[2], b[3]) !== '%PDF') return null
  let txt = ''; for (let i = 0; i < b.length; i++) txt += String.fromCharCode(b[i])
  const rows: Row[] = []
  const grab = (key: string, label: string) => {
    const m = txt.match(new RegExp('/' + key + '\\s*\\(([^)]{0,200})\\)'))
    if (m && m[1].trim()) rows.push({ label, value: m[1].replace(/\\(.)/g, '$1').trim() })
  }
  grab('Title', 'Title'); grab('Author', 'Author'); grab('Subject', 'Subject')
  grab('Creator', 'Creator'); grab('Producer', 'Producer')
  const cd = txt.match(/\/CreationDate\s*\(D:(\d{8})/)
  if (cd) rows.push({ label: 'Created', value: `${cd[1].slice(0, 4)}-${cd[1].slice(4, 6)}-${cd[1].slice(6, 8)}` })
  const pages = (txt.match(/\/Type\s*\/Page[^s]/g) || []).length
  if (pages) rows.push({ label: 'Pages', value: String(pages) })
  const ver = txt.match(/^%PDF-(\d\.\d)/)
  if (ver) rows.push({ label: 'PDF version', value: ver[1] })
  return rows
}

// ── RIFF (WAV / AVI) INFO ──
function parseRiff(b: Uint8Array): Row[] | null {
  if (!(b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46)) return null
  const rows: Row[] = []
  const tags: Record<string, string> = { INAM: 'Title', IART: 'Artist', ICMT: 'Comment', ICRD: 'Date', ISFT: 'Software', IGNR: 'Genre', IPRD: 'Album' }
  let s = ''; for (let i = 0; i < Math.min(b.length, 200000); i++) s += String.fromCharCode(b[i])
  for (const k of Object.keys(tags)) {
    const idx = s.indexOf(k)
    if (idx > 0) {
      const dv = new DataView(b.buffer, b.byteOffset, b.byteLength)
      const len = dv.getUint32(idx + 4, true)
      let val = ''; for (let i = 0; i < len && idx + 8 + i < b.length; i++) { const c = b[idx + 8 + i]; if (!c) break; val += String.fromCharCode(c) }
      if (val.trim()) rows.push({ label: tags[k], value: val.trim() })
    }
  }
  return rows
}

export default function MetadataTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const [groups, setGroups] = useState<Group[] | null>(null)
  const dateFmt = new Intl.DateTimeFormat(locale === 'ar' ? 'ar-SA' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' })

  async function handle(f: File) {
    const buf = await f.arrayBuffer()
    const b = new Uint8Array(buf)
    const dv = new DataView(buf)
    const g: Group[] = []

    g.push({ title: s.file, rows: [
      { label: s.name, value: f.name },
      { label: s.size, value: `${fmtBytes(f.size)} (${f.size.toLocaleString()} B)` },
      { label: s.type, value: f.type || '—' },
      { label: s.modified, value: dateFmt.format(new Date(f.lastModified)) },
    ] })

    const dims = imageDims(b, dv)
    if (dims) g.push({ title: s.image, rows: [{ label: s.dimensions, value: `${dims[0]} × ${dims[1]} px` }] })

    const ex = parseExif(b, dv)
    if (ex) {
      const { ifd0, exif, gps } = ex
      const str = (v: unknown) => (v == null ? '' : String(v))
      const cam: Row[] = []
      if (ifd0[0x010f]) cam.push({ label: s.make, value: str(ifd0[0x010f]) })
      if (ifd0[0x0110]) cam.push({ label: s.model, value: str(ifd0[0x0110]) })
      if (exif[0x9003] || ifd0[0x0132]) cam.push({ label: s.taken, value: str(exif[0x9003] || ifd0[0x0132]) })
      if (ifd0[0x0112]) cam.push({ label: s.orientation, value: str(ifd0[0x0112]) })
      if (exif[0x829a]) { const e = Number(exif[0x829a]); cam.push({ label: s.exposure, value: e < 1 ? `1/${Math.round(1 / e)} s` : `${e} s` }) }
      if (exif[0x829d]) cam.push({ label: s.aperture, value: `f/${Number(exif[0x829d]).toFixed(1)}` })
      if (exif[0x8827]) cam.push({ label: s.iso, value: str(Array.isArray(exif[0x8827]) ? (exif[0x8827] as number[])[0] : exif[0x8827]) })
      if (exif[0x920a]) cam.push({ label: s.focal, value: `${Math.round(Number(exif[0x920a]))} mm` })
      if (ifd0[0x0131]) cam.push({ label: s.software, value: str(ifd0[0x0131]) })
      if (cam.length) g.push({ title: s.camera, rows: cam })

      const lat = dms(gps[2], gps[1]); const lng = dms(gps[4], gps[3])
      if (lat != null && lng != null) g.push({ title: s.location, rows: [
        { label: s.gps, value: `${lat.toFixed(5)}, ${lng.toFixed(5)}`, href: `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=15/${lat}/${lng}` },
      ] })
    }

    const png = parsePngText(b); if (png.length) g.push({ title: s.text, rows: png })
    const pdf = parsePdf(b); if (pdf && pdf.length) g.push({ title: s.document, rows: pdf })
    const riff = parseRiff(b); if (riff && riff.length) g.push({ title: s.media, rows: riff })

    setGroups(g)
  }

  return (
    <Stack data-testid="metadata">
      <label className="flex flex-col items-center gap-[0.4rem] py-8 px-4 border-2 border-dashed border-[color:var(--line)] rounded-[var(--r-md)] bg-[var(--surface)] text-center cursor-pointer transition-[border-color,background] duration-150 hover:border-[color:color-mix(in_srgb,var(--green-500)_45%,transparent)] hover:bg-[color-mix(in_srgb,var(--green-400)_6%,transparent)] [&_small]:text-[color:var(--ink-faint)] [&_small]:text-[0.82rem]" data-testid="meta-drop"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handle(f) }}>
        <input type="file" className="absolute w-px h-px opacity-0" data-testid="meta-file"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handle(f) }} />
        <span>{s.drop} <strong>{s.browse}</strong></span>
        <small>🔒 {s.hint}</small>
      </label>

      {groups && groups.map((grp, i) => (
        <section key={i} className="mb-[0.4rem]">
          <h3 className="font-body text-[0.7rem] uppercase tracking-[0.07em] text-ink-faint mb-[0.4rem]">{grp.title}</h3>
          <dl className="flex flex-col border border-[color:var(--line-soft)] rounded-md overflow-hidden">
            {grp.rows.map((r, j) => (
              <div key={j} className="grid grid-cols-[minmax(0,38%)_1fr] gap-4 px-[0.85rem] py-[0.55rem] border-b border-[color:var(--line-soft)] last:border-b-0 text-[0.9rem] [&_dt]:text-ink-soft [&_dt]:m-0 [&_dd]:m-0 [&_dd]:font-mono [&_dd]:break-words">
                <dt>{r.label}</dt>
                <dd>{r.href ? <a href={r.href} target="_blank" rel="noreferrer noopener">{r.value}</a> : r.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
      {groups && groups.length === 1 && <p className="text-center text-[0.76rem] text-ink-faint mt-[0.8rem] font-body tracking-[0.02em] rtl:font-ar rtl:tracking-normal">{s.none}</p>}
    </Stack>
  )
}
