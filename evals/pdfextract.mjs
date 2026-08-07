// Does the PDF extractor damage a CV before any prompt sees it?
//
// The companion to docxextract.mjs, and the more important one: most CVs are
// PDFs. Deterministic, so it needs no API key.
//
// Two specific hypotheses, both about the line-rebuild in
// src/tools/cv-generator/extract.ts (mirrored in evals/lib/extract.mjs):
//
//  1. It puts a space between EVERY pair of text items unless the first already
//     ends in one. A PDF splits a single word into several items all the time —
//     at a kerning pair, at a font change, at a bold keyword — so "JavaScript"
//     can arrive as "Java" + "Script" and be joined into "Java Script". That is
//     a keyword the ATS then does not match, and `keywords` is a scored
//     dimension. pdf-to-text/extract.ts already guards against exactly this and
//     says so in a comment; the CV path does not.
//  2. It groups by Y alone, so a two-column layout whose content stream is
//     row-major merges the sidebar into the main column.
//
//   node evals/pdfextract.mjs

import { PDFDocument, StandardFonts } from 'pdf-lib'
import { linesFromItems } from './lib/extract.mjs'

const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')

async function itemsOf(bytes) {
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(bytes), disableStream: true, disableAutoFetch: true,
    isEvalSupported: false, useSystemFonts: false,
  }).promise
  const page = await doc.getPage(1)
  return (await page.getTextContent()).items
}

/** Draw runs at explicit positions, so the content-stream order is ours. */
async function makePdf(runs) {
  const pdf = await PDFDocument.create()
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const page = pdf.addPage([595, 842])
  for (const r of runs) page.drawText(r.text, { x: r.x, y: r.y, size: r.size ?? 11, font })
  return await pdf.save()
}

console.log('=== 1. a word split across text items ===')
// What a PDF generator does at a bold boundary or a kerning pair: one word,
// two runs, laid out so they touch.
const split = await makePdf([
  { text: 'Built with Java', x: 50, y: 700 },
  { text: 'Script', x: 50 + 79.2, y: 700 },
  { text: 'and Type', x: 50, y: 680 },
  { text: 'Script', x: 50 + 44.6, y: 680 },
])
const splitLines = linesFromItems(await itemsOf(split), 595)
console.log(splitLines.map((l) => '  | ' + l).join('\n'))
const glued = splitLines.filter((l) => /JavaScript|TypeScript/.test(l)).length
const broken = splitLines.filter((l) => /Java Script|Type Script/.test(l)).length
console.log(`  keywords intact: ${glued}   keywords broken by an inserted space: ${broken}`)

console.log('\n=== 2. a two-column layout, row-major content stream ===')
// The sidebar-plus-main template: a row of the left column, then the matching
// row of the right, alternating — which is what a table-based generator emits.
// Sized like a real one: a sidebar CV has dozens of runs, not six. The
// gutter test is deliberately conservative about how much content it needs on
// each side, so a toy fixture would prove nothing about the real case.
const LEFT = ['SKILLS', 'Python', 'SQL', 'Power BI', 'Arabic', 'English',
  'CONTACT', 'Riyadh', 'sara@example.com', '0501234567']
const RIGHT = ['EXPERIENCE', 'Senior Analyst, Aramco', 'Cut reporting time by 40%',
  'Led a team of 6', 'Analyst, STC', 'Handled 200 tickets a month',
  'EDUCATION', 'BSc Computer Science', 'King Saud University', '2015 - 2019']
const twoCol = await makePdf([
  ...LEFT.flatMap((text, i) => [{ text, x: 50, y: 760 - i * 20 }, { text: RIGHT[i], x: 250, y: 760 - i * 20 }]),
])
const colItems = await itemsOf(twoCol)
console.log('  BEFORE (group by Y alone):')
console.log(linesFromItems(colItems).map((l) => '    | ' + l).join('\n'))
console.log('  AFTER (columns read one after the other):')
const colLines = linesFromItems(colItems, 595)
console.log(colLines.map((l) => '  | ' + l).join('\n'))
const merged = colLines.filter((l) => /SKILLS\s+EXPERIENCE|Python\s+Senior/.test(l)).length
console.log(`  lines merging the two columns: ${merged}`)

console.log('\n=== 3. a normal single-column CV, as a control ===')
const plain = await makePdf([
  { text: 'Sara Al-Otaibi', x: 50, y: 700, size: 16 },
  { text: 'EXPERIENCE', x: 50, y: 670 },
  { text: 'Cut reporting time by 40%', x: 50, y: 650 },
])
const plainLines = linesFromItems(await itemsOf(plain), 595)
console.log(plainLines.map((l) => '  | ' + l).join('\n'))
