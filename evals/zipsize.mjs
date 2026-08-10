// What does store-only actually cost?
//
// `lib/zip.ts` writes uncompressed archives, and ten callers use it — three
// document writers (.docx, .xlsx, .epub) and seven tools that hand the user a
// bundle of files. `lib/unzip.ts` already READS deflate via
// `DecompressionStream('deflate-raw')`, so its mirror `CompressionStream` would
// make a real compressed writer free of any dependency.
//
// Whether that is worth doing is a question about the PAYLOADS, not about the
// API, so it is measured rather than assumed. Node's `deflateRaw` is the same
// algorithm `CompressionStream('deflate-raw')` runs.
//
// Run: node evals/zipsize.mjs

import { deflateRawSync } from 'node:zlib'
import { readFileSync, existsSync } from 'node:fs'

const rows = []
const add = (label, bytes) => {
  const deflated = deflateRawSync(bytes, { level: 6 })
  rows.push({
    label,
    raw: bytes.length,
    def: deflated.length,
    pct: 100 - (deflated.length / bytes.length) * 100,
  })
}

// 1. Split CSV — what `csv-split` bundles. Highly repetitive text.
let csv = 'id,name,city,amount,date\n'
for (let i = 0; i < 4000; i++) {
  csv += `${i},Customer ${i % 200},Riyadh,${(i * 37) % 9999}.00,2026-08-${(i % 28) + 1}\n`
}
add('CSV rows (csv-split)', Buffer.from(csv))

// 2. OOXML — what .docx/.xlsx/.epub are made of. Angle brackets everywhere.
let xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:document xmlns:w="x"><w:body>'
for (let i = 0; i < 800; i++) {
  xml += `<w:p><w:pPr><w:pStyle w:val="Normal"/></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">Paragraph number ${i} of the document.</w:t></w:r></w:p>`
}
xml += '</w:body></w:document>'
add('OOXML document.xml (.docx/.xlsx/.epub)', Buffer.from(xml))

// 3. SVG — what `svg-optimise` and the icon tools deal with.
let svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">'
for (let i = 0; i < 600; i++) svg += `<path d="M${i} ${i}L${i + 5} ${i + 9}Z" fill="#1f7a4c" stroke="none"/>`
svg += '</svg>'
add('SVG paths', Buffer.from(svg))

// 4. A real PDF — what `pdf-split` and `pdf-to-images` bundle. PDF streams are
//    ALREADY deflated internally, so this is the case where it buys nothing and
//    the honest answer is "no gain".
if (existsSync('e2e/fixtures/structured.pdf')) add('PDF (pdf-split)', readFileSync('e2e/fixtures/structured.pdf'))
if (existsSync('e2e/fixtures/locked.pdf')) add('PDF, encrypted (pdf-split)', readFileSync('e2e/fixtures/locked.pdf'))

// 5. A real PNG — what the image tools bundle. Already DEFLATE inside.
if (existsSync('e2e/fixtures/diff-a.png')) add('PNG (batch-watermark, social-resize)', readFileSync('e2e/fixtures/diff-a.png'))

// 6. A real xlsx, as a stand-in for any already-zipped payload.
if (existsSync('e2e/fixtures/sample.xlsx')) add('XLSX (already a zip)', readFileSync('e2e/fixtures/sample.xlsx'))

const kb = (n) => `${(n / 1024).toFixed(1)} KB`
console.log('payload'.padEnd(40), 'stored'.padStart(10), 'deflated'.padStart(10), 'saved'.padStart(8))
for (const r of rows) {
  console.log(r.label.padEnd(40), kb(r.raw).padStart(10), kb(r.def).padStart(10), `${r.pct.toFixed(1)}%`.padStart(8))
}

const text = rows.filter((r) => r.pct > 20)
const already = rows.filter((r) => r.pct <= 20)
console.log(`\ncompressible payloads: ${text.length}, mean saving ${(text.reduce((n, r) => n + r.pct, 0) / (text.length || 1)).toFixed(1)}%`)
console.log(`already-compressed payloads: ${already.length}, mean saving ${(already.reduce((n, r) => n + r.pct, 0) / (already.length || 1)).toFixed(1)}%`)
