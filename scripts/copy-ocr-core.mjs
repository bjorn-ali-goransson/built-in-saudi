// Copies the Tesseract wasm core out of node_modules into public/ocr/ so the
// OCR tool loads its engine from OUR origin instead of a CDN — same stance as
// every other tool here: nothing about the user's file, and no third-party
// request, leaves the page.
//
// These files are NOT committed (see .gitignore): tesseract.js-core ships ~44MB
// of build variants and we only serve two, so copying at install/build time
// keeps them out of git while still shipping them in dist/. The .traineddata
// language models next to them ARE committed, because npm has no reliable
// source for them.
//
// Run automatically from the `predev` / `prebuild` npm scripts.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const TO = path.join(ROOT, 'public', 'ocr')

// The LSTM-only builds: they drop the legacy engine we never use, saving ~700KB
// each. We ship exactly two — SIMD and plain — and the tool picks between them
// itself. Left to its own devices tesseract.js probes for relaxed-SIMD too and
// asks for a third variant; serving three costs another 6MB in dist, and a
// missing one is invisible because the SPA's 404 fallback answers 200 with
// index.html, so importScripts fails on HTML instead of 404ing honestly.
//
// worker.min.js comes from tesseract.js itself and MUST be served by us: the
// default pulls it from jsdelivr, which would put a third-party request in the
// middle of a tool whose whole promise is that the file never leaves the page.
const FILES = [
  ['tesseract.js-core', 'tesseract-core-simd-lstm.wasm'],
  ['tesseract.js-core', 'tesseract-core-simd-lstm.wasm.js'],
  ['tesseract.js-core', 'tesseract-core-lstm.wasm'],
  ['tesseract.js-core', 'tesseract-core-lstm.wasm.js'],
  ['tesseract.js/dist', 'worker.min.js'],
]

fs.mkdirSync(TO, { recursive: true })
let copied = 0
for (const [pkg, f] of FILES) {
  const src = path.join(ROOT, 'node_modules', ...pkg.split('/'), f)
  const dest = path.join(TO, f)
  if (!fs.existsSync(path.dirname(src))) {
    console.warn(`copy-ocr-core: ${pkg} not installed — skipping (run npm install)`)
    break
  }
  if (!fs.existsSync(src)) {
    console.warn(`copy-ocr-core: ${f} missing from ${pkg} — the OCR tool may fail to start`)
    continue
  }
  // Skip an identical copy so repeated dev starts don't churn the file mtimes
  // (Vite watches public/ and would reload for nothing).
  if (fs.existsSync(dest) && fs.statSync(dest).size === fs.statSync(src).size) continue
  fs.copyFileSync(src, dest)
  copied++
}
if (copied) console.log(`copy-ocr-core: copied ${copied} file(s) into public/ocr/`)
