// Does the column split fire on the REAL corpus, and does it only fire where
// it should? Deterministic, so no API key — which is the point while the LLM
// evals are blocked.
//
// The risk of the fix is not that it fails to split a sidebar CV; it is that it
// splits a single-column one and shuffles the document. This reports, per CV,
// whether a gutter was found and how the extracted text changed.
//
//   node evals/pdfcolumns.mjs
//
// Real CVs are gitignored — this reads whatever is in evals/cvs.

import { readdir, readFile } from 'node:fs/promises'
import { linesFromItems, findGutter } from './lib/extract.mjs'

const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
const dir = new URL('./cvs/', import.meta.url)

const files = (await readdir(dir)).filter((f) => /\.pdf$/i.test(f))
if (!files.length) {
  console.log('No CVs in evals/cvs — nothing to measure.')
  process.exit(0)
}

let split = 0
const changed = []

for (const name of files) {
  const data = new Uint8Array(await readFile(new URL(name, dir)))
  let doc
  try {
    doc = await pdfjs.getDocument({
      data, disableStream: true, disableAutoFetch: true, isEvalSupported: false, useSystemFonts: false,
    }).promise
  } catch { console.log(`  ${name}: unreadable`); continue }

  let gutterPages = 0
  const before = []
  const after = []
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    const items = (await page.getTextContent()).items
    const width = page.view[2] - page.view[0]
    if (findGutter(items, width) != null) gutterPages++
    before.push(...linesFromItems(items))
    after.push(...linesFromItems(items, width))
  }

  if (gutterPages) {
    split++
    // Same characters, different order, is exactly what a column split should
    // do. Losing characters would be a bug.
    const norm = (a) => a.join(' ').replace(/\s+/g, ' ').trim()
    const sameChars = norm(before).split('').sort().join('') === norm(after).split('').sort().join('')
    changed.push(`  ${name}\n    pages with a gutter: ${gutterPages}/${doc.numPages}  lines ${before.length} -> ${after.length}  no text lost: ${sameChars}`)
  }
}

console.log(`CVs: ${files.length}`)
console.log(`column split fired on: ${split}`)
console.log(`left exactly as they were: ${files.length - split}`)
if (changed.length) console.log('\n' + changed.join('\n'))
