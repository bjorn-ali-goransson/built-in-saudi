// End-to-end proof for the benchmark CV: score the JSON, render it through the
// REAL exporter, pull the text back out the way an uploader would, and score
// that too. A 5.0 that only exists in JSON would prove nothing — the candidate
// sends the PDF.
import fs from 'node:fs'
import path from 'node:path'
import { ROOT } from './lib/env.mjs'
import { getRenderer } from './lib/render.mjs'
import { pdfToText } from './lib/extract.mjs'
import { cvToText } from '../functions/cvText.js'
import { scoreDocument } from './variants/champion.mjs'

const SECTIONS = ['SUMMARY', 'SKILLS', 'EXPERIENCE', 'PROJECTS', 'EDUCATION', 'LANGUAGES', 'CERTIFICATIONS', 'TALKS']
const GLUE = /\b(?:using|with|via|and|by|to|in|on|for|through|across)(?=[A-Z0-9])/g
const mean = (o) => Object.values(o).reduce((a, b) => a + b, 0) / 6

const { cv } = JSON.parse(fs.readFileSync(path.join(ROOT, 'evals', 'out', 'perfect-cv.json'), 'utf8'))
const text = cvToText(cv)

console.log('1. the CV as JSON → text')
for (let i = 0; i < 2; i++) {
  const s = await scoreDocument(text)
  console.log(`   overall ${mean(s).toFixed(2)}  ${JSON.stringify(s)}`)
}

const buf = await (await getRenderer())(cv)
fs.writeFileSync(path.join(ROOT, 'evals', 'out', 'perfect-cv.pdf'), buf)
const pdfText = await pdfToText(buf)

console.log('\n2. rendered through the real CvPdf exporter')
const faces = [...new Set([...buf.toString('latin1').matchAll(/\/BaseFont\s*\/([A-Za-z0-9+-]+)/g)].map((m) => m[1].split('+')[1]))]
console.log(`   ${(buf.length / 1024).toFixed(0)}KB, ${(pdfText.match(/\n\n/g) || []).length + 1} page(s), ${faces.length} font faces: ${faces.join(', ')}`)

console.log('\n3. text an ATS extracts back out of that PDF')
const expected = SECTIONS.filter((h) => text.includes(h))
const broken = expected.filter((h) => !new RegExp(`\\b${h}\\b`).test(pdfText))
console.log(`   section headings readable: ${expected.length - broken.length}/${expected.length}${broken.length ? ` — BROKEN: ${broken.join(', ')}` : ''}`)
console.log(`   glued keywords: ${[...pdfText.matchAll(GLUE)].length}`)
const s2 = await scoreDocument(pdfText)
console.log(`   score of the extracted text: overall ${mean(s2).toFixed(2)}  ${JSON.stringify(s2)}`)
console.log(`\n   ${mean(s2) >= 5 ? '→ 5.00 survives the full round trip.' : '→ the round trip costs points; see above.'}`)
