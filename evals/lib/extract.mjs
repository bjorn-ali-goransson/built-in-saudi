// Text extraction that MIRRORS the browser's src/tools/cv-generator/extract.ts
// exactly — same pdf.js line-rebuild-by-Y heuristic, same normalisation, same
// 30k cap. If this drifts, the eval stops measuring what production sees.
import fs from 'node:fs/promises'
import path from 'node:path'

const MAX_CHARS = 30000

let pdfjs
async function loadPdfjs() {
  if (!pdfjs) pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  return pdfjs
}

/** Rebuild lines from pdf.js text items by vertical position — identical logic
 *  to extract.ts's fromPdf, so extraction artefacts show up here too. */
export function linesFromItems(items) {
  let line = ''
  let lastY = null
  const out = []
  for (const item of items) {
    const y = item.transform[5]
    if (lastY !== null && Math.abs(y - lastY) > 3) {
      out.push(line.trimEnd())
      line = ''
    }
    line += item.str + (item.str.endsWith(' ') ? '' : ' ')
    lastY = y
  }
  if (line.trim()) out.push(line.trimEnd())
  return out
}

export async function pdfToText(data) {
  const lib = await loadPdfjs()
  const task = lib.getDocument({
    data: new Uint8Array(data),
    disableStream: true,
    disableAutoFetch: true,
    isEvalSupported: false,
    useSystemFonts: false,
  })
  const doc = await task.promise
  const pages = []
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    const content = await page.getTextContent()
    pages.push(linesFromItems(content.items).join('\n'))
  }
  await task.destroy()
  return pages.join('\n\n')
}

export async function extractFile(file) {
  const ext = path.extname(file).toLowerCase()
  let text
  if (ext === '.pdf') {
    text = await pdfToText(await fs.readFile(file))
  } else if (ext === '.docx') {
    const mammoth = (await import('mammoth')).default
    text = String((await mammoth.extractRawText({ buffer: await fs.readFile(file) })).value || '')
  } else {
    text = await fs.readFile(file, 'utf8')
  }
  return text.replace(/\r/g, '').replace(/\n{3,}/g, '\n\n').trim().slice(0, MAX_CHARS)
}
