// Real .docx (Office Open XML) export — a valid Word document, no dependencies.
// A .docx is a ZIP of XML parts; we build the ZIP with STORED (uncompressed)
// entries so we only need a CRC32, not a deflate implementation. Modern Word
// rejects the old "HTML saved as .doc" trick as corrupt, hence this.
import type { Cv } from './schema'

// ---- ZIP (stored entries) ---------------------------------------------------

let CRC: Uint32Array | null = null
function crc32(bytes: Uint8Array): number {
  if (!CRC) {
    CRC = new Uint32Array(256)
    for (let n = 0; n < 256; n++) {
      let c = n
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
      CRC[n] = c >>> 0
    }
  }
  let crc = 0xffffffff
  for (let i = 0; i < bytes.length; i++) crc = CRC[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

interface Entry { name: string; data: Uint8Array }

function zipStore(entries: Entry[]): Uint8Array {
  const enc = new TextEncoder()
  const parts: Uint8Array[] = []
  const central: Uint8Array[] = []
  let offset = 0
  for (const e of entries) {
    const nameBytes = enc.encode(e.name)
    const crc = crc32(e.data)
    const size = e.data.length
    const local = new Uint8Array(30 + nameBytes.length)
    const dv = new DataView(local.buffer)
    dv.setUint32(0, 0x04034b50, true)
    dv.setUint16(4, 20, true)
    dv.setUint16(8, 0, true) // method: stored
    dv.setUint32(14, crc, true)
    dv.setUint32(18, size, true)
    dv.setUint32(22, size, true)
    dv.setUint16(26, nameBytes.length, true)
    local.set(nameBytes, 30)
    parts.push(local, e.data)

    const cen = new Uint8Array(46 + nameBytes.length)
    const cd = new DataView(cen.buffer)
    cd.setUint32(0, 0x02014b50, true)
    cd.setUint16(4, 20, true)
    cd.setUint16(6, 20, true)
    cd.setUint16(10, 0, true) // method: stored
    cd.setUint32(16, crc, true)
    cd.setUint32(20, size, true)
    cd.setUint32(24, size, true)
    cd.setUint16(28, nameBytes.length, true)
    cd.setUint32(42, offset, true)
    cen.set(nameBytes, 46)
    central.push(cen)
    offset += local.length + e.data.length
  }
  const centralSize = central.reduce((a, c) => a + c.length, 0)
  const end = new Uint8Array(22)
  const ed = new DataView(end.buffer)
  ed.setUint32(0, 0x06054b50, true)
  ed.setUint16(8, entries.length, true)
  ed.setUint16(10, entries.length, true)
  ed.setUint32(12, centralSize, true)
  ed.setUint32(16, offset, true)

  const all = [...parts, ...central, end]
  const total = all.reduce((a, c) => a + c.length, 0)
  const out = new Uint8Array(total)
  let p = 0
  for (const c of all) { out.set(c, p); p += c.length }
  return out
}

// ---- OOXML document ---------------------------------------------------------

const INK = '1B2230', INK_SOFT = '28303E', ACCENT = '1E3A5F', ACCENT2 = '2F5482', MUTED = '5C6675'

const xml = (s: string | undefined) =>
  (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

interface RunOpts { b?: boolean; color?: string; sz?: number; caps?: boolean; italic?: boolean }
function run(text: string, o: RunOpts = {}): string {
  const rpr: string[] = []
  if (o.b) rpr.push('<w:b/>')
  if (o.italic) rpr.push('<w:i/>')
  if (o.caps) rpr.push('<w:caps/>')
  if (o.color) rpr.push(`<w:color w:val="${o.color}"/>`)
  if (o.sz) rpr.push(`<w:sz w:val="${o.sz}"/><w:szCs w:val="${o.sz}"/>`)
  const pr = rpr.length ? `<w:rPr>${rpr.join('')}</w:rPr>` : ''
  return `<w:r>${pr}<w:t xml:space="preserve">${xml(text)}</w:t></w:r>`
}

/** Split **bold** markers into runs. */
function rich(text: string, base: RunOpts = {}): string {
  return String(text || '')
    .split(/(\*\*[^*]+\*\*)/g)
    .filter(Boolean)
    .map((p) => {
      const m = p.match(/^\*\*([^*]+)\*\*$/)
      return m ? run(m[1], { ...base, b: true, color: INK }) : run(p, base)
    })
    .join('')
}

interface ParaOpts { align?: 'center' | 'right'; before?: number; after?: number; indent?: number }
function para(runs: string, o: ParaOpts = {}): string {
  const ppr: string[] = []
  if (o.align) ppr.push(`<w:jc w:val="${o.align}"/>`)
  if (o.indent) ppr.push(`<w:ind w:left="${o.indent}"/>`)
  if (o.before != null || o.after != null) ppr.push(`<w:spacing w:before="${o.before ?? 0}" w:after="${o.after ?? 0}"/>`)
  const pr = ppr.length ? `<w:pPr>${ppr.join('')}</w:pPr>` : ''
  return `<w:p>${pr}${runs}</w:p>`
}

function heading(title: string): string {
  return para(run(title, { b: true, caps: true, color: ACCENT, sz: 19 }), { before: 240, after: 60 })
}

function dates(a?: string, b?: string): string {
  if (a && b) return `${a} – ${b}`
  return a || b || ''
}

function buildBody(cv: Cv): string {
  const P: string[] = []

  // Header
  P.push(para(run(cv.name, { b: true, caps: true, color: ACCENT, sz: 40 }), { align: 'center', after: 40 }))
  const contact: string[] = []
  if (cv.contact.location) contact.push(cv.contact.location)
  if (cv.contact.phone) contact.push(cv.contact.phone)
  if (cv.contact.email) contact.push(cv.contact.email)
  for (const l of cv.contact.links || []) contact.push(l.label)
  if (contact.length) P.push(para(run(contact.join('    |    '), { color: MUTED, sz: 18 }), { align: 'center', after: 40 }))
  P.push(para(
    run(cv.role, { b: true, color: ACCENT, sz: 22 }) + (cv.available ? run('    |    ' + cv.available, { color: MUTED, sz: 20 }) : ''),
    { align: 'center', after: 160 },
  ))

  if (cv.summary) {
    P.push(heading('Summary'))
    P.push(para(rich(cv.summary, { color: INK_SOFT, sz: 21 })))
  }

  if (cv.skills.length) {
    P.push(heading('Skills'))
    for (const g of cv.skills) {
      P.push(para(run(g.category + ':  ', { b: true, color: ACCENT2, sz: 20 }) + run(g.items, { color: INK, sz: 21 }), { after: 20 }))
    }
  }

  if (cv.experience.length) {
    P.push(heading('Experience'))
    for (const j of cv.experience) {
      P.push(para(
        run(j.role, { b: true, color: INK, sz: 21 })
        + run(', ' + j.company, { color: ACCENT, sz: 21 })
        + (j.location ? run(' (' + j.location + ')', { color: MUTED, sz: 21 }) : '')
        + (dates(j.startYear, j.endYear) ? run('    —    ' + dates(j.startYear, j.endYear), { color: MUTED, sz: 18 }) : ''),
        { before: 80, after: 20 },
      ))
      for (const b of j.bullets) {
        P.push(para(run('•   ', { color: ACCENT2, sz: 21 }) + rich(b, { color: INK_SOFT, sz: 21 }), { indent: 260, after: 10 }))
      }
    }
  }

  if (cv.projects.length) {
    P.push(heading('Projects'))
    for (const pr of cv.projects) {
      P.push(para(run(pr.name, { b: true, color: INK, sz: 21 }) + run(' — ', { color: INK_SOFT, sz: 21 }) + rich(pr.description, { color: INK_SOFT, sz: 21 }), { after: 20 }))
    }
  }

  const dated = (title: string, items: Cv['certifications']) => {
    if (!items.length) return
    P.push(heading(title))
    for (const t of items) {
      P.push(para(
        run(t.title, { b: true, color: INK, sz: 21 })
        + (t.detail ? run(' · ' + t.detail, { color: MUTED, sz: 21 }) : '')
        + (t.year ? run('    ' + t.year, { color: MUTED, sz: 18 }) : ''),
        { after: 20 },
      ))
    }
  }
  dated('Talks', cv.talks)
  dated('Certifications', cv.certifications)
  dated('Publications', cv.publications)

  if (cv.education.length) {
    P.push(heading('Education'))
    for (const e of cv.education) {
      P.push(para(
        run(e.degree, { b: true, color: INK, sz: 21 })
        + (e.institution ? run(' · ' + e.institution, { color: MUTED, sz: 21 }) : '')
        + (e.year ? run('    ' + e.year, { color: MUTED, sz: 18 }) : ''),
        { after: 20 },
      ))
    }
  }

  if (cv.languages.length) {
    P.push(heading('Languages'))
    P.push(para(run(cv.languages.map((l) => l.name + (l.level ? ` (${l.level})` : '')).join('    ·    '), { color: INK, sz: 21 })))
  }

  return P.join('')
}

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`

const RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`

function documentXml(cv: Cv): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`
    + `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">`
    + `<w:body>${buildBody(cv)}`
    + `<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="907" w:right="907" w:bottom="907" w:left="907" w:header="0" w:footer="0" w:gutter="0"/></w:sectPr>`
    + `</w:body></w:document>`
}

/** A valid, editable Word .docx of the CV. */
export function cvToDocxBlob(cv: Cv): Blob {
  const enc = new TextEncoder()
  const zip = zipStore([
    { name: '[Content_Types].xml', data: enc.encode(CONTENT_TYPES) },
    { name: '_rels/.rels', data: enc.encode(RELS) },
    { name: 'word/document.xml', data: enc.encode(documentXml(cv)) },
  ])
  return new Blob([zip as unknown as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })
}
