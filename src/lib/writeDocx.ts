import { zipStore } from './zip'
import type { Block, Inline } from './markdown'

// A .docx from a block tree — a real Office Open XML document, no dependency.
//
// The site could already write Word, and exactly one tool did: the CV
// optimizer's `src/tools/cv-generator/docx.ts`. That writer is CV-shaped
// (right-aligned date tabs, a fixed colour scheme, `buildBody(cv)`), it is
// guarded by `evals/docxguard.mjs`, and it predates `lib/zip.ts` — so it keeps
// its own CRC32 and stored-ZIP code. It is deliberately NOT refactored into
// this: rewriting the writer behind the document a candidate sends to an
// employer, to save a duplicate ZIP header, is a bad trade. The duplication is
// recorded rather than removed.
//
// Everything Word actually requires is here and nothing else:
//   [Content_Types].xml   — or Word calls the file corrupt
//   _rels/.rels           — points at the main document part
//   word/document.xml     — the body
//
// There is deliberately NO `word/_rels/document.xml.rels`. That part is
// required only when document.xml carries relationship references (images,
// hyperlinks as real relationships, an external style part), and this writer
// emits none — the same conclusion `docxguard` reached when its first version
// asserted the part existed and failed on a perfectly valid file.

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;')

interface RunOpts { b?: boolean; i?: boolean; strike?: boolean; mono?: boolean; size?: number; color?: string }

function run(text: string, o: RunOpts = {}): string {
  const props = [
    o.mono ? '<w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/>' : '',
    o.b ? '<w:b/>' : '',
    o.i ? '<w:i/>' : '',
    o.strike ? '<w:strike/>' : '',
    o.color ? `<w:color w:val="${o.color}"/>` : '',
    o.size ? `<w:sz w:val="${o.size * 2}"/>` : '',
  ].join('')
  // xml:space="preserve" or Word eats the space between two runs, which is
  // exactly how "using **Python**" becomes "usingPython" in an extractor.
  return `<w:r>${props ? `<w:rPr>${props}</w:rPr>` : ''}<w:t xml:space="preserve">${esc(text)}</w:t></w:r>`
}

function inlineRuns(inline: Inline[], base: RunOpts = {}): string {
  return inline.map((n) => {
    switch (n.t) {
      case 'strong': return run(n.v, { ...base, b: true })
      case 'em': return run(n.v, { ...base, i: true })
      case 'strike': return run(n.v, { ...base, strike: true })
      case 'code': return run(n.v, { ...base, mono: true })
      // A link is written as its label followed by the URL, because a real
      // w:hyperlink needs a relationship part and this writer emits none.
      // Dropping the URL would lose information the document carried.
      case 'link': return n.v === n.href ? run(n.v, base) : run(n.v, base) + run(` (${n.href})`, { ...base, color: '5C6675' })
      default: return run(n.v, base)
    }
  }).join('')
}

interface ParaOpts { size?: number; bold?: boolean; before?: number; after?: number; indent?: number; style?: string }

const para = (runs: string, o: ParaOpts = {}): string => {
  const props = [
    o.style ? `<w:pStyle w:val="${o.style}"/>` : '',
    o.indent ? `<w:ind w:left="${o.indent}"/>` : '',
    `<w:spacing w:before="${o.before ?? 0}" w:after="${o.after ?? 120}"/>`,
    o.bold || o.size ? `<w:rPr>${o.bold ? '<w:b/>' : ''}${o.size ? `<w:sz w:val="${o.size * 2}"/>` : ''}</w:rPr>` : '',
  ].join('')
  return `<w:p><w:pPr>${props}</w:pPr>${runs}</w:p>`
}

const HEADING_PT = [0, 20, 16, 14, 12, 11, 11]

function tableXml(rows: Inline[][][]): string {
  const width = Math.max(...rows.map((r) => r.length))
  // The header row is bold via the run options, NOT by rewriting the generated
  // XML: string surgery on your own output is how a second <w:rPr> ends up
  // inside the first and Word calls the file corrupt.
  const cell = (c: Inline[] | undefined, head: boolean) =>
    `<w:tc><w:tcPr><w:tcW w:w="0" w:type="auto"/></w:tcPr>`
    + para(c ? inlineRuns(c, head ? { b: true } : {}) : '', { after: 0 })
    + '</w:tc>'
  const body = rows
    .map((r, ri) => `<w:tr>${Array.from({ length: width }, (_, ci) => cell(r[ci], ri === 0)).join('')}</w:tr>`)
    .join('')
  return `<w:tbl><w:tblPr><w:tblStyle w:val="TableGrid"/><w:tblW w:w="0" w:type="auto"/>`
    + `<w:tblBorders>${['top', 'left', 'bottom', 'right', 'insideH', 'insideV']
      .map((s) => `<w:${s} w:val="single" w:sz="4" w:color="C8CCD4"/>`).join('')}</w:tblBorders>`
    + `</w:tblPr>${body}</w:tbl>`
}

export function blocksToDocxXml(blocks: Block[]): string {
  const parts = blocks.map((b) => {
    switch (b.t) {
      case 'heading':
        return para(inlineRuns(b.inline), { size: HEADING_PT[b.level], bold: true, before: b.level === 1 ? 0 : 240, after: 120 })
      case 'para':
        return para(inlineRuns(b.inline))
      case 'quote':
        return para(inlineRuns(b.inline), { indent: 480 })
      case 'rule':
        // A paragraph with a bottom border: Word has no <hr>, and an empty
        // paragraph with a rule on it is what Word itself writes for one.
        return `<w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="6" w:color="C8CCD4"/></w:pBdr><w:spacing w:before="120" w:after="120"/></w:pPr></w:p>`
      case 'code':
        // Each line its own paragraph: a single run with \n in it renders as
        // one long line, because Word breaks on <w:br/>, not on the character.
        return (b.text ? b.text.split('\n') : ['']).map((l) => para(run(l, { mono: true, size: 9 }), { after: 0, indent: 240 })).join('')
      case 'list':
        // Numbered by hand rather than through a numbering part: `numbering.xml`
        // is a whole extra part plus a relationship, and a document whose list
        // markers are literal text still reads and prints correctly.
        return b.items.map((it, n) =>
          para(run(b.ordered ? `${n + 1}. ` : '• ') + inlineRuns(it.inline),
            { indent: 360 + it.depth * 360, after: 40 })).join('')
      case 'table':
        return tableXml(b.rows)
    }
  })
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`
    + `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">`
    + `<w:body>${parts.join('')}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/>`
    + `<w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134"/></w:sectPr></w:body></w:document>`
}

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`

const RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`

export function blocksToDocx(blocks: Block[]): Blob {
  const enc = new TextEncoder()
  return zipStore([
    { name: '[Content_Types].xml', bytes: enc.encode(CONTENT_TYPES) },
    { name: '_rels/.rels', bytes: enc.encode(RELS) },
    { name: 'word/document.xml', bytes: enc.encode(blocksToDocxXml(blocks)) },
  ])
}
