// Does the .docx extractor damage a CV before any prompt sees it?
//
// Extraction is upstream of every score and is fully deterministic, so it can
// be measured with no API key at all — which matters, because it is the one
// part of the CV pipeline that no amount of prompt work can repair. If a bullet
// arrives glued to the cell beside it, the rewriter is working from damaged
// input and the scorer is grading damage.
//
// Compares the production path (mammoth `extractRawText`, used by
// src/tools/cv-generator/extract.ts) against `src/lib/docx.ts`, written for
// docx-to-text and structure-preserving.
//
//   npx tsc src/lib/docx.ts src/lib/unzip.ts --outDir evals/gen --module esnext \
//     --target es2022 --moduleResolution bundler --skipLibCheck
//   node -e "const f='evals/gen/docx.js',s=require('fs');s.writeFileSync(f,s.readFileSync(f,'utf8').replace(/'.\/unzip'/,\"'./unzip.js'\"))"
//   node evals/docxextract.mjs
//
// (tsc emits extensionless imports, which Node's ESM loader will not resolve —
// hence the one-line patch in the middle.)

import { deflateRawSync, crc32 } from 'node:zlib'
import mammoth from 'mammoth'
import { flattenXml } from './gen/docx.js'

function zip(files) {
  const locals = []; const central = []; let offset = 0
  for (const f of files) {
    const name = Buffer.from(f.name, 'utf8')
    const comp = deflateRawSync(f.data)
    const crc = crc32(f.data)
    const lh = Buffer.alloc(30)
    lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(8, 8)
    lh.writeUInt32LE(crc, 14); lh.writeUInt32LE(comp.length, 18); lh.writeUInt32LE(f.data.length, 22)
    lh.writeUInt16LE(name.length, 26)
    locals.push(lh, name, comp)
    const cd = Buffer.alloc(46)
    cd.writeUInt32LE(0x02014b50, 0); cd.writeUInt16LE(20, 4); cd.writeUInt16LE(20, 6)
    cd.writeUInt16LE(8, 10); cd.writeUInt32LE(crc, 16); cd.writeUInt32LE(comp.length, 20)
    cd.writeUInt32LE(f.data.length, 24); cd.writeUInt16LE(name.length, 28); cd.writeUInt32LE(offset, 42)
    central.push(cd, name)
    offset += lh.length + name.length + comp.length
  }
  const cdBuf = Buffer.concat(central)
  const eocd = Buffer.alloc(22)
  eocd.writeUInt32LE(0x06054b50, 0); eocd.writeUInt16LE(files.length, 8); eocd.writeUInt16LE(files.length, 10)
  eocd.writeUInt32LE(cdBuf.length, 12); eocd.writeUInt32LE(offset, 16)
  return Buffer.concat([...locals, cdBuf, eocd])
}

const P = (...runs) => `<w:p>${runs.map((r) => `<w:r><w:t xml:space="preserve">${r}</w:t></w:r>`).join('')}</w:p>`
const CELL = (...ps) => `<w:tc>${ps.join('')}</w:tc>`
const ROW = (...cells) => `<w:tr>${cells.join('')}</w:tr>`

// A CV in the two-column table layout half of them use: dates on the left,
// the role and its bullets on the right.
const BODY = [
  P('Sara Al-Otaibi'),
  P('EXPERIENCE'),
  '<w:tbl>'
  + ROW(CELL(P('2021 - 2024')), CELL(P('Senior Analyst, Aramco'), P('Cut reporting time by 40%'), P('Led a team of 6')))
  + ROW(CELL(P('2019 - 2021')), CELL(P('Analyst, STC'), P('Handled 200 tickets a month')))
  + '</w:tbl>',
  P('SKILLS'),
  // A run split at a formatting boundary, as Word writes bolded keywords.
  P('Python', ', SQL, ', 'Power BI'),
].join('')

const docx = zip([
  { name: '[Content_Types].xml', data: Buffer.from('<?xml version="1.0"?><Types/>') },
  {
    name: 'word/document.xml',
    data: Buffer.from(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${BODY}</w:body></w:document>`, 'utf8'),
  },
])

const { value: viaMammoth } = await mammoth.extractRawText({ buffer: docx })
const viaOurs = flattenXml(new TextDecoder().decode(
  await (async () => {
    const { zipEntries, readEntry } = await import('./gen/unzip.js')
    const buf = docx.buffer.slice(docx.byteOffset, docx.byteOffset + docx.byteLength)
    const e = zipEntries(buf).find((x) => x.name === 'word/document.xml')
    return readEntry(buf, e)
  })(),
))

// What actually matters to a résumé parser: does a date stay attached to the
// role it belongs to, and does a bullet survive as its own line?
function report(label, text) {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean)
  const glued = lines.filter((l) => /\d{4}\s*-\s*\d{4}\s*\S/.test(l) && !/\t/.test(l))
  const bullets = lines.filter((l) => /\d+%|\bteam of \d+|\d+ tickets/.test(l))
  const rowsIntact = lines.filter((l) => /\d{4} - \d{4}\t/.test(l))
  console.log(`\n--- ${label}`)
  console.log(`lines: ${lines.length}`)
  console.log(`rows keeping date+role on one line, tab-separated: ${rowsIntact.length}`)
  console.log(`quantified bullets surviving as their own line: ${bullets.length}`)
  console.log(`date glued to text with no separator: ${glued.length}`)
  console.log(lines.map((l) => '  | ' + l.replace(/\t/g, ' [TAB] ')).join('\n'))
}

report('mammoth extractRawText (production)', viaMammoth)
report('lib/docx.ts (docx-to-text)', viaOurs)
