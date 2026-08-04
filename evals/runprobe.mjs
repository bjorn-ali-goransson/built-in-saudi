// Characterises how @react-pdf/renderer treats whitespace at the boundary
// between two inline <Text> runs — the mechanism behind "usingPython" and
// "Python- based" in exported CVs. Renders controlled run pairs and reports the
// text that comes back out.
import path from 'node:path'
import { ROOT } from './lib/env.mjs'

const { Document, Page, View, Text, Font, renderToBuffer } = await import('@react-pdf/renderer')
const React = (await import('react')).default
const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')

Font.register({
  family: 'IBM Plex Sans',
  fonts: [400, 700].map((w) => ({ src: path.join(ROOT, 'public', 'fonts', `ibm-plex-sans-${w}.ttf`), fontWeight: w })),
})
Font.registerHyphenationCallback((word) => [word])

// [regular run, bold run] pairs; "·" marks a space in the label for legibility.
const CASES = [
  ['using ', 'Python'],
  ['using', ' Python'],
  ['using', 'Python'],
  ['using ', ' Python'],
  ['Python-', 'based'],
  ['Python', '-based'],
  ['time by ', '20%'],
  ['time by', ' 20%'],
  ['Engineer', ', Acme'],
  ['Engineer,', ' Acme'],
]

const doc = React.createElement(
  Document,
  null,
  React.createElement(
    Page,
    { size: 'A4', style: { padding: 30, fontFamily: 'IBM Plex Sans', fontSize: 11 } },
    ...CASES.map(([a, b], i) =>
      React.createElement(
        View,
        { key: i },
        React.createElement(
          Text,
          null,
          React.createElement(Text, null, `${i}| ${a}`),
          React.createElement(Text, { style: { fontWeight: 700 } }, b),
          React.createElement(Text, null, ' |end'),
        ),
      ),
    ),
  ),
)

const buf = await renderToBuffer(doc)
const pdf = await pdfjs.getDocument({ data: new Uint8Array(buf), disableStream: true, isEvalSupported: false, useSystemFonts: false }).promise
const items = (await (await pdf.getPage(1)).getTextContent()).items
const text = items.map((i) => i.str).join('')

console.log('run A            + run B           →  rendered')
console.log('─'.repeat(64))
for (const [i, [a, b]] of CASES.entries()) {
  const m = text.match(new RegExp(`${i}\\|(.*?)\\|end`))
  const got = m ? m[1] : '(not found)'
  const want = `${a}${b}`.replace(/^ /, '')
  const ok = got.trim() === want.trim() && !/\s\s/.test(got)
  console.log(
    `${JSON.stringify(a).padEnd(16)} + ${JSON.stringify(b).padEnd(16)} → ${JSON.stringify(got).padEnd(22)} ${ok ? '' : '  ← MANGLED'}`,
  )
}
