// Tesseract, configured to keep the privacy promise literally true.
//
// Extracted here because a second tool now needs it, and every one of these
// settings is load-bearing:
//
// - **Everything is served from OUR origin** (`public/ocr` — the wasm core is
//   copied there at build by `scripts/copy-ocr-core.mjs`, the `.traineddata`
//   files are committed). The library's default is a CDN, which would put
//   third-party requests in the middle of a tool whose whole promise is that
//   your passport scan never leaves the page.
// - **The core build is chosen explicitly, as an exact file.** Given only a
//   directory, tesseract.js probes for relaxed-SIMD too and asks for a third
//   variant we do not ship — and a missing file here does NOT 404: the SPA
//   fallback answers 200 with index.html, so `importScripts` dies on HTML with
//   a misleading NetworkError.
// - **`gzip: false`**, because the models here are plain `.traineddata` rather
//   than the `.gz` the CDN serves.

export type OcrLang = 'eng' | 'ara' | 'eng+ara'

const OCR_BASE = `${import.meta.env.BASE_URL}ocr`

// The standard wasm-feature-detect SIMD module.
const SIMD_PROBE = Uint8Array.of(0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11)

export function corePath(): string {
  let simd = false
  try { simd = WebAssembly.validate(SIMD_PROBE) } catch { /* ancient engine — take the plain build */ }
  return `${OCR_BASE}/tesseract-core-${simd ? 'simd-' : ''}lstm.wasm.js`
}

export interface OcrProgress { status: string; progress: number }

/** A tesseract worker wired to our own assets. Caller must `terminate()` it. */
export async function createOcrWorker(lang: OcrLang, onProgress?: (p: OcrProgress) => void) {
  const { createWorker } = await import('tesseract.js')
  return createWorker(lang, 1, {
    corePath: corePath(),
    langPath: OCR_BASE,
    // Without this the worker script itself is fetched from jsdelivr.
    workerPath: `${OCR_BASE}/worker.min.js`,
    gzip: false,
    logger: onProgress ? (m: OcrProgress) => onProgress(m) : undefined,
  })
}
