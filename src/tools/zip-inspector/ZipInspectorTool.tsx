import { useState } from 'react'
import { useLocale } from '../../i18n'

const STR = {
  en: {
    drop: 'Drop an archive here, or', browse: 'browse', hint: 'Files never leave your browser.',
    format: 'Format', files: 'Files', total: 'Uncompressed', packed: 'Compressed', ratio: 'Saved',
    name: 'Name', size: 'Size', comp: 'Packed', modified: 'Modified', method: 'Method',
    notZip: 'Not a ZIP — showing detected format only. Listing works for .zip (and .zip-based files like .docx, .apk, .jar).',
    unknown: 'Unknown / not an archive',
    stored: 'Stored', deflate: 'Deflate', dir: 'folder',
  },
  ar: {
    drop: 'أفلِت ملفًا مضغوطًا هنا، أو', browse: 'تصفّح', hint: 'الملفات لا تغادر متصفحك.',
    format: 'الصيغة', files: 'الملفات', total: 'غير مضغوط', packed: 'مضغوط', ratio: 'التوفير',
    name: 'الاسم', size: 'الحجم', comp: 'مضغوط', modified: 'التعديل', method: 'الطريقة',
    notZip: 'ليس ZIP — نعرض الصيغة المكتشفة فقط. السرد يعمل مع ملفات .zip (وما يعتمد عليها مثل .docx و.apk و.jar).',
    unknown: 'غير معروف / ليس ملفًا مضغوطًا',
    stored: 'مخزّن', deflate: 'مضغوط', dir: 'مجلد',
  },
}

interface Entry { name: string; size: number; comp: number; method: number; date: Date | null; dir: boolean }

const fmtBytes = (n: number) => {
  if (n < 1024) return `${n} B`
  const u = ['KB', 'MB', 'GB']; let i = -1; let v = n
  do { v /= 1024; i++ } while (v >= 1024 && i < u.length - 1)
  return `${v.toFixed(v < 10 ? 1 : 0)} ${u[i]}`
}

// Detect common archive/compression formats by magic bytes.
function detectFormat(b: Uint8Array): string {
  const h = (n: number) => b[n]
  if (h(0) === 0x50 && h(1) === 0x4b && (h(2) === 0x03 || h(2) === 0x05 || h(2) === 0x07)) return 'ZIP'
  if (h(0) === 0x1f && h(1) === 0x8b) return 'GZIP'
  if (h(0) === 0x42 && h(1) === 0x5a && h(2) === 0x68) return 'BZIP2'
  if (h(0) === 0xfd && h(1) === 0x37 && h(2) === 0x7a && h(3) === 0x58 && h(4) === 0x5a) return 'XZ'
  if (h(0) === 0x37 && h(1) === 0x7a && h(2) === 0xbc && h(3) === 0xaf) return '7-Zip'
  if (h(0) === 0x52 && h(1) === 0x61 && h(2) === 0x72 && h(3) === 0x21) return 'RAR'
  if (h(0) === 0x04 && h(1) === 0x22 && h(2) === 0x4d && h(3) === 0x18) return 'LZ4'
  if (h(0) === 0x28 && h(1) === 0xb5 && h(2) === 0x2f && h(3) === 0xfd) return 'Zstandard'
  // tar: "ustar" at offset 257
  if (b.length > 262 && b[257] === 0x75 && b[258] === 0x73 && b[259] === 0x74 && b[260] === 0x61 && b[261] === 0x72) return 'TAR'
  return ''
}

// Parse a ZIP central directory. Returns null if not a valid ZIP.
function parseZip(buf: ArrayBuffer): Entry[] | null {
  const dv = new DataView(buf)
  const n = buf.byteLength
  // Find End Of Central Directory (signature 0x06054b50), scanning back from the end.
  let eocd = -1
  for (let i = n - 22; i >= Math.max(0, n - 22 - 65536); i--) {
    if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break }
  }
  if (eocd < 0) return null
  const count = dv.getUint16(eocd + 10, true)
  let off = dv.getUint32(eocd + 16, true)
  const dec = new TextDecoder()
  const out: Entry[] = []
  for (let i = 0; i < count && off + 46 <= n; i++) {
    if (dv.getUint32(off, true) !== 0x02014b50) break
    const method = dv.getUint16(off + 10, true)
    const dosTime = dv.getUint16(off + 12, true)
    const dosDate = dv.getUint16(off + 14, true)
    const comp = dv.getUint32(off + 20, true)
    const size = dv.getUint32(off + 24, true)
    const nameLen = dv.getUint16(off + 28, true)
    const extraLen = dv.getUint16(off + 30, true)
    const commentLen = dv.getUint16(off + 32, true)
    const name = dec.decode(new Uint8Array(buf, off + 46, nameLen))
    let date: Date | null = null
    if (dosDate) {
      date = new Date(1980 + (dosDate >> 9), ((dosDate >> 5) & 0xf) - 1, dosDate & 0x1f,
        dosTime >> 11, (dosTime >> 5) & 0x3f, (dosTime & 0x1f) * 2)
    }
    out.push({ name, size, comp, method, date, dir: name.endsWith('/') })
    off += 46 + nameLen + extraLen + commentLen
  }
  return out
}

export default function ZipInspectorTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const [file, setFile] = useState<{ name: string; format: string; entries: Entry[] | null } | null>(null)
  const dateFmt = new Intl.DateTimeFormat(locale === 'ar' ? 'ar-SA' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' })

  async function handle(f: File) {
    const buf = await f.arrayBuffer()
    const head = new Uint8Array(buf.slice(0, 512))
    const format = detectFormat(head) || s.unknown
    const entries = format === 'ZIP' ? parseZip(buf) : null
    setFile({ name: f.name, format, entries })
  }

  const totals = file?.entries
    ? file.entries.reduce((a, e) => ({ size: a.size + e.size, comp: a.comp + e.comp, files: a.files + (e.dir ? 0 : 1) }), { size: 0, comp: 0, files: 0 })
    : null
  const saved = totals && totals.size > 0 ? Math.round((1 - totals.comp / totals.size) * 100) : 0

  return (
    <div className="stack" data-testid="zip-inspector">
      <label className="dropzone" data-testid="zip-drop"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handle(f) }}>
        <input type="file" className="dropzone__input" data-testid="zip-file"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handle(f) }} />
        <span>{s.drop} <strong>{s.browse}</strong></span>
        <small>🔒 {s.hint}</small>
      </label>

      {file && (
        <>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(120px,1fr))] gap-[0.8rem]">
            <div className="bg-[var(--surface)] border border-[color:var(--line-soft)] rounded-md px-4 py-[0.9rem] text-center"><span className="block font-display text-[1.7rem] text-green-700 leading-none rtl:font-ar" data-testid="zip-format">{file.format}</span><span className="block mt-[0.35rem] text-[0.78rem] text-ink-faint">{s.format}</span></div>
            {totals && <div className="bg-[var(--surface)] border border-[color:var(--line-soft)] rounded-md px-4 py-[0.9rem] text-center"><span className="block font-display text-[1.7rem] text-green-700 leading-none rtl:font-ar" data-testid="zip-files">{totals.files}</span><span className="block mt-[0.35rem] text-[0.78rem] text-ink-faint">{s.files}</span></div>}
            {totals && <div className="bg-[var(--surface)] border border-[color:var(--line-soft)] rounded-md px-4 py-[0.9rem] text-center"><span className="block font-display text-[1.7rem] text-green-700 leading-none rtl:font-ar">{fmtBytes(totals.size)}</span><span className="block mt-[0.35rem] text-[0.78rem] text-ink-faint">{s.total}</span></div>}
            {totals && <div className="bg-[var(--surface)] border border-[color:var(--line-soft)] rounded-md px-4 py-[0.9rem] text-center"><span className="block font-display text-[1.7rem] text-green-700 leading-none rtl:font-ar">{saved}%</span><span className="block mt-[0.35rem] text-[0.78rem] text-ink-faint">{s.ratio}</span></div>}
          </div>

          {file.entries === null && <p className="pray__geoerr">{s.notZip}</p>}

          {file.entries && (
            <div className="zip__list" data-testid="zip-list">
              {file.entries.map((e, i) => (
                <div key={i} className={`zip__row ${e.dir ? 'is-dir' : ''}`}>
                  <span className="zip__name" title={e.name}>{e.dir ? '📁 ' : ''}{e.name}</span>
                  <span className="zip__size">{e.dir ? s.dir : fmtBytes(e.size)}</span>
                  <span className="zip__meta">{e.date ? dateFmt.format(e.date) : ''}{e.method === 0 && !e.dir ? ` · ${s.stored}` : ''}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
