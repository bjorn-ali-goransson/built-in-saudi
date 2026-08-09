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
// The parts, and why each one is here:
//   [Content_Types].xml         — or Word calls the file corrupt
//   _rels/.rels                 — points at the main document part
//   word/document.xml           — the body
//   word/styles.xml             — defines Heading 1-6 and the table style
//   word/_rels/document.xml.rels — relates the document to those styles
//
// **The styles part was missing at first, and the headings were a lie.** They
// were written as bold, larger paragraphs: they LOOKED like headings and were
// paragraphs, so Word's navigation pane was empty, an automatic table of
// contents found nothing, and a screen reader announced body text. Caught by
// building the inverse tool (`docx-markdown`) and round-tripping through
// mammoth, which reported every heading as a paragraph — and refused the table
// outright, because `w:tblStyle` named a style that did not exist.
//
// `docxguard` reasoned correctly that `document.xml.rels` is required only when
// document.xml carries relationship references. It does now: the styles part is
// exactly such a reference.

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

interface ParaOpts { size?: number; bold?: boolean; before?: number; after?: number; indent?: number; style?: string; num?: { id: number; level: number } }

const HEADING_STYLE = (level: number) => `Heading${Math.min(6, Math.max(1, level))}`

const para = (runs: string, o: ParaOpts = {}): string => {
  const props = [
    o.style ? `<w:pStyle w:val="${o.style}"/>` : '',
    // The numbering reference is what makes this a LIST rather than a
    // paragraph that starts with a bullet character.
    o.num ? `<w:numPr><w:ilvl w:val="${o.num.level}"/><w:numId w:val="${o.num.id}"/></w:numPr>` : '',
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

/**
 * The `<w:num>` entries a document needs, collected while its body is written.
 *
 * Module-level state is deliberate and safe here because `blocksToDocxXml` runs
 * to completion synchronously: it resets on entry, fills as the body is built,
 * and is read straight afterwards by `blocksToDocx`.
 */
let numRefs: { id: number; ordered: boolean }[] = []
const nextNumId = (ordered: boolean) => {
  const id = numRefs.length + 1
  numRefs.push({ id, ordered })
  return id
}

export function blocksToDocxXml(blocks: Block[]): string {
  numRefs = []
  const parts = blocks.map((b) => {
    switch (b.t) {
      case 'heading':
        // `pStyle` is what makes this a HEADING rather than large bold text —
        // the navigation pane, an automatic contents page, and every converter
        // read the style, not the font size. The size stays as a fallback for a
        // reader that does not resolve styles.
        return para(inlineRuns(b.inline), {
          style: HEADING_STYLE(b.level),
          size: HEADING_PT[b.level],
          bold: true,
          before: b.level === 1 ? 0 : 240,
          after: 120,
        })
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
      case 'list': {
        // A REAL Word list, through `numbering.xml`. It was literal text at
        // first — valid, and it prints correctly — but a list whose markers are
        // characters is not a list to anything downstream: Word will not
        // continue it, a converter reads paragraphs, and a screen reader does
        // not announce "list of three items". Building the inverse tool
        // (`docx-markdown`) is what made that visible, and the pinned test
        // there flips when this lands.
        //
        // **Each list gets its OWN numId.** Sharing one makes the second
        // ordered list in a document continue the first — 1, 2, 3 then 4, 5, 6
        // — which is the classic way hand-written OOXML numbering goes wrong.
        const id = nextNumId(b.ordered)
        return b.items.map((it) =>
          para(inlineRuns(it.inline), {
            style: 'ListParagraph',
            num: { id, level: Math.min(2, it.depth) },
            after: 40,
          })).join('')
      }
      case 'table':
        return tableXml(b.rows)
    }
  })
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`
    + `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">`
    + `<w:body>${parts.join('')}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/>`
    + `<w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134"/></w:sectPr></w:body></w:document>`
}

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/></Types>`

const DOC_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/></Relationships>`

// `w:name` is the load-bearing part: Word resolves a built-in heading from the
// styleId, but every converter maps on the NAME ("Heading 1" -> <h1>). A style
// with an id and no name is a style nothing downstream can recognise.
const headingStyle = (n: number) =>
  `<w:style w:type="paragraph" w:styleId="Heading${n}"><w:name w:val="Heading ${n}"/>`
  + `<w:basedOn w:val="Normal"/><w:qFormat/>`
  + `<w:pPr><w:outlineLvl w:val="${n - 1}"/></w:pPr>`
  + `<w:rPr><w:b/><w:sz w:val="${HEADING_PT[n] * 2}"/></w:rPr></w:style>`

const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`
  + `<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">`
  + `<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>`
  + [1, 2, 3, 4, 5, 6].map(headingStyle).join('')
  // The table style is referenced by every table this writer emits; naming a
  // style that does not exist is what made mammoth refuse the document.
  + `<w:style w:type="table" w:styleId="TableGrid"><w:name w:val="Table Grid"/><w:basedOn w:val="TableNormal"/>`
  + `<w:tblPr><w:tblBorders>${['top', 'left', 'bottom', 'right', 'insideH', 'insideV']
    .map((side) => `<w:${side} w:val="single" w:sz="4" w:color="C8CCD4"/>`).join('')}</w:tblBorders></w:tblPr></w:style>`
  + `<w:style w:type="table" w:default="1" w:styleId="TableNormal"><w:name w:val="Normal Table"/></w:style>`
  // Word puts list paragraphs in this style; naming it keeps the indentation
  // and spacing consistent with a list made in Word itself.
  + `<w:style w:type="paragraph" w:styleId="ListParagraph"><w:name w:val="List Paragraph"/><w:basedOn w:val="Normal"/><w:qFormat/>`
  + `<w:pPr><w:contextualSpacing/></w:pPr></w:style>`
  + `</w:styles>`

const RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`

/**
 * `word/numbering.xml`.
 *
 * Each list in the document gets its own `<w:num>` pointing at one of two
 * abstract definitions — bulleted or decimal. Three indent levels are defined
 * because a nested list beyond that is rare enough that clamping is kinder than
 * an unbounded part.
 */
function numberingXml(refs: { id: number; ordered: boolean }[]): string {
  const lvl = (i: number, ordered: boolean) =>
    `<w:lvl w:ilvl="${i}"><w:start w:val="1"/>`
    + `<w:numFmt w:val="${ordered ? 'decimal' : 'bullet'}"/>`
    + `<w:lvlText w:val="${ordered ? `%${i + 1}.` : ['•', 'o', '▪'][i]}"/>`
    + `<w:lvlJc w:val="left"/>`
    + `<w:pPr><w:ind w:left="${720 * (i + 1)}" w:hanging="360"/></w:pPr>`
    + (ordered ? '' : `<w:rPr><w:rFonts w:ascii="Symbol" w:hAnsi="Symbol" w:hint="default"/></w:rPr>`)
    + `</w:lvl>`
  const abstract = (id: number, ordered: boolean) =>
    `<w:abstractNum w:abstractNumId="${id}"><w:multiLevelType w:val="hybridMultilevel"/>`
    + [0, 1, 2].map((i) => lvl(i, ordered)).join('')
    + `</w:abstractNum>`
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`
    + `<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">`
    + abstract(0, false) + abstract(1, true)
    // `startOverride` is what makes each list RESTART. Two `<w:num>` entries
    // sharing an abstract definition otherwise continue one another's counter,
    // so a document with two ordered lists reads 1, 2, 3 then 4, 5, 6 — the
    // classic way hand-written OOXML numbering goes wrong, and it was doing
    // exactly that until the round trip showed it.
    + refs.map((r) => `<w:num w:numId="${r.id}"><w:abstractNumId w:val="${r.ordered ? 1 : 0}"/>`
      + [0, 1, 2].map((i) => `<w:lvlOverride w:ilvl="${i}"><w:startOverride w:val="1"/></w:lvlOverride>`).join('')
      + `</w:num>`).join('')
    + `</w:numbering>`
}

export function blocksToDocx(blocks: Block[]): Blob {
  const enc = new TextEncoder()
  // The body FIRST: writing it is what discovers how many lists the document
  // has, and `numbering.xml` has to declare one `<w:num>` for each.
  const body = blocksToDocxXml(blocks)
  return zipStore([
    { name: '[Content_Types].xml', bytes: enc.encode(CONTENT_TYPES) },
    { name: '_rels/.rels', bytes: enc.encode(RELS) },
    { name: 'word/document.xml', bytes: enc.encode(body) },
    { name: 'word/_rels/document.xml.rels', bytes: enc.encode(DOC_RELS) },
    { name: 'word/styles.xml', bytes: enc.encode(STYLES) },
    { name: 'word/numbering.xml', bytes: enc.encode(numberingXml(numRefs)) },
  ])
}
