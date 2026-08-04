// At what letter-spacing does a section heading stop being a word to a parser?
// Renders "EXPERIENCE" at the template's size across a range of tracking values
// and reports the extracted string for each.
import path from 'node:path'
import { ROOT } from './lib/env.mjs'

const { Document, Page, View, Text, Font, renderToBuffer } = await import('@react-pdf/renderer')
const React = (await import('react')).default
const h = React.createElement
const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')

Font.register({ family: 'IBM Plex Sans', fonts: [{ src: path.join(ROOT, 'public', 'fonts', 'ibm-plex-sans-700.ttf'), fontWeight: 700 }] })
Font.registerHyphenationCallback((w) => [w])

const pt = (px) => px * 0.75
const SIZE = pt(10.5) // s.secHead fontSize
const EMS = [0, 0.02, 0.03, 0.04, 0.05, 0.06, 0.07, 0.08, 0.10, 0.12, 0.15]

const doc = h(Document, null, h(Page, { size: 'A4', style: { padding: 40, fontFamily: 'IBM Plex Sans' } },
  ...EMS.map((em, i) => h(View, { key: i }, h(Text, {
    style: { fontSize: SIZE, fontWeight: 700, textTransform: 'uppercase', letterSpacing: SIZE * em },
  }, `EXPERIENCE${i}`)))))

const buf = await renderToBuffer(doc)
const pdf = await pdfjs.getDocument({ data: new Uint8Array(buf), disableStream: true, isEvalSupported: false, useSystemFonts: false }).promise
const items = (await (await pdf.getPage(1)).getTextContent()).items

console.log(`"EXPERIENCE" at ${SIZE.toFixed(2)}pt — extracted per letter-spacing:\n`)
for (const [i, em] of EMS.entries()) {
  const line = items.filter((it) => it.str.replace(/\s/g, '').includes(String(i))).map((it) => it.str).join('')
  const intact = new RegExp(`\\bEXPERIENCE${i}\\b`).test(line)
  console.log(`  ${String(em).padEnd(5)} em (${(SIZE * em).toFixed(2)}pt)  ${intact ? 'OK      ' : 'BROKEN  '} ${JSON.stringify(line)}`)
}
