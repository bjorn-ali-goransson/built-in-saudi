// Prints raw pdf.js text items around a needle, so we can see exactly how the
// template's runs reach a parser.  node evals/probe.mjs <tag> <cv> <needle>
import fs from 'node:fs'
import path from 'node:path'
import { ROOT } from './lib/env.mjs'
import { getRenderer } from './lib/render.mjs'

const [tag, cvNeedle, needle] = process.argv.slice(2).filter((a) => !a.startsWith('--'))
const variant = 'champion'
const run = JSON.parse(fs.readFileSync(path.join(ROOT, 'evals', 'out', `run-${tag}.json`), 'utf8'))
const row = run.results.find((r) => r?.name?.toLowerCase().includes(String(cvNeedle).toLowerCase()) && r.variants?.[variant]?.cv)
const render = await getRenderer()
const buf = await render(row.variants[variant].cv)

const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
const doc = await pdfjs.getDocument({ data: new Uint8Array(buf), disableStream: true, isEvalSupported: false, useSystemFonts: false }).promise
for (let p = 1; p <= doc.numPages; p++) {
  const items = (await (await doc.getPage(p)).getTextContent()).items
  for (const [i, it] of items.entries()) {
    if (!it.str || !it.str.includes(needle)) continue
    console.log(`\n── page ${p}, item ${i} matches "${needle}"`)
    for (const j of [i - 1, i, i + 1, i + 2]) {
      const x = items[j]
      if (!x) continue
      console.log(`  [${String(j).padStart(3)}] font=${x.fontName} str=${JSON.stringify(x.str)} width=${x.width?.toFixed(2)} x=${x.transform?.[4]?.toFixed(1)} hasEOL=${x.hasEOL}`)
    }
  }
}
