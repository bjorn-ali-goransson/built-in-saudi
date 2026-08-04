// PDF fidelity check.
//
//   node evals/pdfcheck.mjs <run-tag> [--variant v2] [--keep]
//
// The candidate does not send employers our JSON — they send the PDF that
// CvPdf.tsx renders, and an ATS re-extracts text from it. This renders the REAL
// CvDocument (bundled from the app source with esbuild, so it can't drift from
// production), then pulls the text back out through the SAME pdf.js path the
// uploader uses. Anything that survives the JSON but not the PDF is invisible
// to every ATS the candidate applies through.
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { ROOT } from './lib/env.mjs'
import { pdfToText } from './lib/extract.mjs'
import { cvToText } from './lib/cvText.mjs'
import { techTokens, metrics, contacts } from './lib/retention.mjs'

const argv = process.argv.slice(2)
const tag = argv.find((a) => !a.startsWith('--'))
const variantId = (argv.indexOf('--variant') >= 0 && argv[argv.indexOf('--variant') + 1]) || 'v2'
const KEEP = argv.includes('--keep')
if (!tag) {
  console.error('usage: node evals/pdfcheck.mjs <run-tag> [--variant v2] [--keep]')
  process.exit(1)
}

const TMP = path.join(ROOT, 'evals', 'out', '.pdfbuild')
fs.mkdirSync(TMP, { recursive: true })

// Bundle the real CvPdf.tsx for node. react-pdf and react stay external so the
// installed versions are used; import.meta.env is stubbed (Vite-only global).
const esbuild = (await import('esbuild')).default
const entry = path.join(TMP, 'entry.mjs')
fs.writeFileSync(entry, `export { CvDocument, registerCvFonts } from ${JSON.stringify(path.join(ROOT, 'src/tools/cv-generator/CvPdf.tsx').replace(/\\/g, '/'))}\n`)
await esbuild.build({
  entryPoints: [entry],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile: path.join(TMP, 'cvpdf.mjs'),
  external: ['@react-pdf/renderer', 'react', 'react/jsx-runtime'],
  jsx: 'automatic',
  define: { 'import.meta.env.BASE_URL': '"/"' },
  logLevel: 'warning',
})

const { CvDocument } = await import(pathToFileURL(path.join(TMP, 'cvpdf.mjs')).href)
const { Font, renderToBuffer } = await import('@react-pdf/renderer')
const React = (await import('react')).default

// Same faces as the browser, loaded from disk instead of over HTTP.
const fontDir = path.join(ROOT, 'public', 'fonts')
Font.register({
  family: 'IBM Plex Sans',
  fonts: [400, 500, 600, 700].map((w) => ({ src: path.join(fontDir, `ibm-plex-sans-${w}.ttf`), fontWeight: w })),
})
Font.registerHyphenationCallback((word) => [word])

const runFile = path.join(ROOT, 'evals', 'out', `run-${tag}.json`)
const run = JSON.parse(fs.readFileSync(runFile, 'utf8'))
const rows = run.results.filter((r) => r && !r.error && r.variants?.[variantId]?.cv)

const norm = (s) => String(s || '').replace(/\*\*/g, '').toLowerCase()
const setLost = (src, out) => [...src].filter((t) => !norm(out).includes(norm(t)))

console.log(`PDF fidelity — ${rows.length} CVs, variant "${variantId}"\n`)
let totalLost = 0
let pageCounts = []
const problems = []

for (const r of rows) {
  const cv = r.variants[variantId].cv
  const jsonText = cvToText(cv)
  let pdfText
  try {
    const buf = await renderToBuffer(React.createElement(CvDocument, { cv }))
    pdfText = await pdfToText(buf)
    if (KEEP) fs.writeFileSync(path.join(ROOT, 'evals', 'out', `${r.name.slice(0, 40)}.pdf`), buf)
  } catch (e) {
    console.log(`  ✗ ${r.name}: render failed — ${e.message}`)
    problems.push({ name: r.name, kind: 'render', detail: e.message })
    continue
  }

  // Everything the JSON claims should survive the render → extract round trip.
  const lostTech = setLost(techTokens(jsonText), pdfText)
  const lostMetrics = setLost(metrics(jsonText), pdfText)
  const a = contacts(jsonText)
  const b = contacts(pdfText)
  const lostEmails = [...a.emails].filter((e) => !b.emails.has(e))
  const lostPhones = [...a.phones].filter((p) => ![...b.phones].some((q) => q.endsWith(p.slice(-8))))
  // Links render as a label; the URL lives in the annotation, not the text
  // layer — so a URL missing from extracted text is expected, not a fault.

  const pages = (pdfText.match(/\n\n/g) || []).length + 1
  pageCounts.push(pages)
  const lost = lostTech.length + lostMetrics.length + lostEmails.length + lostPhones.length
  totalLost += lost
  const flag = lost ? '⚠' : '✓'
  console.log(`  ${flag} ${r.name.slice(0, 44).padEnd(46)} ${String(pages)}p  ${pdfText.split(/\s+/).filter(Boolean).length} words` +
    (lost ? `  LOST: ${[...lostTech, ...lostMetrics, ...lostEmails, ...lostPhones].slice(0, 8).join(', ')}` : ''))
  if (lost) problems.push({ name: r.name, lostTech, lostMetrics, lostEmails, lostPhones })
}

console.log(`\nTotal tokens lost in the PDF round trip: ${totalLost}`)
console.log(`Page counts: ${pageCounts.join(', ')}`)
if (!KEEP) fs.rmSync(TMP, { recursive: true, force: true })
fs.writeFileSync(path.join(ROOT, 'evals', 'out', `pdfcheck-${tag}.json`), JSON.stringify(problems, null, 2))
