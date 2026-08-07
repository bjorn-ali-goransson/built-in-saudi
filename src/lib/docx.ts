// Reading a .docx without a library.
//
// A .docx is a ZIP of XML (see unzip.ts), and the body is one file:
// `word/document.xml`. Getting readable text out of it is not "strip the tags"
// — Word's model has to be respected in three places, and each one is a
// visible bug if you skip it:
//
// - **A paragraph is `<w:p>`, a line break is `<w:br/>`, and neither leaves a
//   character behind.** Strip tags naïvely and the whole document arrives as
//   one enormous run-on line.
// - **A single word is often several `<w:t>` runs.** Word splits a run at every
//   formatting change, and at spell-check and revision boundaries — so
//   "Riyadh" can be `Riy` + `adh`. Joining runs with a space produces
//   "Riy adh"; they must be concatenated with nothing between them.
// - **`<w:tab/>` and table cells are real separators.** A table read without
//   them turns a row of figures into one number.
//
// Headers, footers and footnotes live in their own parts and are deliberately
// left out of the main body: they repeat on every page and would interleave
// nonsense into the text. They are returned separately so a caller can offer
// them.

import { zipEntries, readEntry } from './unzip'

export interface DocxText {
  /** The body, paragraph per line. */
  text: string
  /** Header/footer/footnote parts, in document order, each already flattened. */
  extras: { part: string; text: string }[]
  /** Number of paragraphs that carried any text. */
  paragraphs: number
}

/** Why a file could not be read as a .docx. */
export type DocxError = 'not-zip' | 'not-docx' | 'old-format'

const dec = new TextDecoder()

/**
 * Flatten one WordprocessingML part into text.
 *
 * Hand-rolled rather than DOMParser'd because the namespace prefixes are not
 * guaranteed (`w:t` vs `t` vs some other alias bound to the same namespace),
 * and a regex over the well-formed XML Word emits is both shorter and does not
 * inherit an XML parser's opinion about entities.
 */
export function flattenXml(xml: string): string {
  const lines: string[] = []
  let line = ''

  // Everything we care about is one of: a text run, a break, a tab, a table
  // row or cell boundary, or a paragraph end.
  const token = /<(\/?)(?:[a-zA-Z0-9]+:)?(t|br|cr|tab|p|tc|tr)(\s[^>]*)?(\/?)>/g
  let last = 0
  let inText = false
  // Non-null while inside a table row: the cells collected so far. A row has to
  // be assembled before it is emitted, because the paragraph inside a cell
  // closes BEFORE the cell does — flushing on </w:p> would put every cell on
  // its own line and turn a row of figures into a column of them.
  let row: string[] | null = null
  let m: RegExpExecArray | null

  const flush = () => { lines.push(line.trimEnd()); line = '' }

  while ((m = token.exec(xml))) {
    const [, close, name, , selfClose] = m
    if (inText && m.index > last) line += unescapeXml(xml.slice(last, m.index))

    if (name === 't') {
      // <w:t/> is empty; only a real open tag starts a text region.
      inText = !close && !selfClose
    } else if (name === 'br' || name === 'cr') {
      if (!close) flush()
    } else if (name === 'tab') {
      if (!close) line += '\t'
    } else if (name === 'tr') {
      if (close) {
        if (row) lines.push(row.join('\t'))
        row = null
      } else { row = [] }
    } else if (name === 'tc') {
      if (close && row) { row.push(line.trim()); line = '' }
    } else if (name === 'p') {
      // Several paragraphs in one cell are one cell, not several rows.
      if (close) { if (row) line += ' '; else flush() }
    }
    last = token.lastIndex
  }

  if (line.trim()) flush()
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

function unescapeXml(s: string): string {
  return s.replace(/&(#x?[0-9a-fA-F]+|amp|lt|gt|quot|apos);/g, (whole, ent: string) => {
    if (ent[0] === '#') {
      const code = ent[1] === 'x' || ent[1] === 'X' ? parseInt(ent.slice(2), 16) : parseInt(ent.slice(1), 10)
      return Number.isFinite(code) ? String.fromCodePoint(code) : whole
    }
    return { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }[ent] ?? whole
  })
}

export async function readDocx(file: File): Promise<DocxText | DocxError> {
  const buf = await file.arrayBuffer()
  const entries = zipEntries(buf)
  if (!entries) {
    // A .doc is an OLE compound file, which starts with this signature. Saying
    // so is far more useful than "could not read".
    const head = new Uint8Array(buf.slice(0, 8))
    const ole = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]
    return head.every((b, i) => b === ole[i]) ? 'old-format' : 'not-zip'
  }

  const body = entries.find((e) => e.name === 'word/document.xml')
  if (!body) return 'not-docx'

  const xml = dec.decode(await readEntry(buf, body))
  const text = flattenXml(xml)

  const extras: { part: string; text: string }[] = []
  for (const e of entries.filter((x) => /^word\/(header|footer|footnotes|endnotes)\d*\.xml$/.test(x.name)).sort((a, b) => a.name.localeCompare(b.name))) {
    const t = flattenXml(dec.decode(await readEntry(buf, e)))
    // Word ships an empty footnotes part in almost every document.
    if (t) extras.push({ part: e.name.replace(/^word\//, '').replace(/\.xml$/, ''), text: t })
  }

  return { text, extras, paragraphs: text ? text.split('\n').filter(Boolean).length : 0 }
}
