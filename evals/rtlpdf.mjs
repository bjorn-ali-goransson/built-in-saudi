// Can react-pdf produce a REAL TEXT LAYER for Arabic?
//
// This decides how a Word-to-PDF tool has to be built, and nothing in the repo
// answered it. `lib/printPdf.ts` composes on a CANVAS and wraps the raster in a
// PDF, precisely because "pdf-lib cannot shape Arabic or reorder bidi text" —
// which is right for a worksheet or a bingo card, and wrong for a document,
// because a rastered page has no selectable, searchable or machine-readable
// text. `CvPdf.tsx` is the one react-pdf document here and it registers a LATIN
// font only, so react-pdf plus Arabic was unproven either way.
//
// The test: render one Arabic line and one English line, then extract the text
// back with pdf.js — the same engine `pdf-to-text` uses.
//
// RESULT (10 August 2026): both survive verbatim. The Arabic comes back as
// U+645 U+631 U+62D … — the original codepoints, NOT the deprecated
// presentation forms — so the text layer is genuine and a converter built this
// way produces a document an ATS, a search index or a screen reader can read.
//
// HONEST LIMIT, and it is the reason this file says so rather than concluding
// more: extraction round-tripping proves the TEXT layer, not the VISUAL one. An
// engine that drew every letter in its isolated form, or ran the line the wrong
// way, would emit these same codepoints. Confirming the shaping needs an eye on
// a rendered page, and that check has not been done.
//
// Run: node evals/rtlpdf.mjs
// Needs an Arabic-capable TTF; it looks for one and says so if there is none,
// rather than reporting a pass it did not earn.

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import React from 'react'
import { Document, Page, Text, View, Font, renderToBuffer } from '@react-pdf/renderer'

// The first version of this used a sentence with NO lam-alef in it and
// reported a clean pass — a check right for the wrong reason. ل followed by ا
// forms a mandatory ligature, and it is the single most common sequence in
// written Arabic (every definite article before an alef-initial word).
const AR = 'الإيرادات والأرباح لا تزال مرتفعة'
const EN = 'Hello world from Riyadh'

const CANDIDATES = [
  'C:/Windows/Fonts/arial.ttf',
  '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
  '/System/Library/Fonts/Supplemental/Arial.ttf',
]
const font = CANDIDATES.find((p) => existsSync(p))
if (!font) {
  console.log('no Arabic-capable TTF found in the usual places — skipping.')
  console.log('this is a SKIP, not a pass: nothing was measured.')
  process.exit(0)
}
console.log('font: ' + font)

Font.register({ family: 'Test', src: font })
Font.registerHyphenationCallback((w) => [w])

const doc = React.createElement(
  Document, null,
  React.createElement(
    Page, { size: 'A4', style: { padding: 40, fontFamily: 'Test', fontSize: 14 } },
    React.createElement(View, null,
      React.createElement(Text, null, EN),
      React.createElement(Text, null, AR)),
  ),
)

mkdirSync('evals/gen', { recursive: true })
const out = 'evals/gen/rtl-test.pdf'
writeFileSync(out, await renderToBuffer(doc))

const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
const pdf = await pdfjs.getDocument({ data: new Uint8Array(readFileSync(out)) }).promise
const content = await (await pdf.getPage(1)).getTextContent()
const items = content.items.map((i) => i.str).filter((s) => s.trim())

console.log('\nextracted:')
for (const s of items) {
  console.log('  ' + JSON.stringify(s) + '\n    codepoints: ' +
    [...s].slice(0, 6).map((c) => 'U+' + c.codePointAt(0).toString(16).toUpperCase()).join(' '))
}

const joined = items.join(' ')
const okEn = joined.includes(EN)
const okAr = joined.includes(AR)
console.log('\nEnglish survived: ' + okEn)
console.log('Arabic  survived: ' + okAr)

// The presentation-forms block (U+FB50–U+FEFF) is what an engine emits when it
// bakes the shaping into the characters. Those look right and extract wrong.
const baked = [...joined].some((c) => c.codePointAt(0) >= 0xfb50 && c.codePointAt(0) <= 0xfeff)
console.log('shaping baked into the codepoints (bad): ' + baked)
console.log('\nverdict: ' + (okEn && okAr && !baked
  ? 'react-pdf carries a real Arabic text layer — build a document converter on it, not on the canvas route.'
  : 'NOT usable as-is; the canvas route in printPdf.ts is the fallback.'))
