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
 *  to extract.ts's fromPdf, so extraction artefacts show up here too.
 *
 *  Pass `pageWidth` to get the column handling production has; without it this
 *  is the old single-column behaviour, which the harness uses to show the
 *  before/after. */
export function linesFromItems(items, pageWidth) {
  if (!pageWidth) return linesByY(items)
  const out = []
  for (const group of columnGroups(items, pageWidth)) out.push(...linesByY(group))
  return out
}

const MIN_GUTTER = 0.045
const SEARCH_FROM = 0.2
const SEARCH_TO = 0.8
const MIN_ITEMS_PER_SIDE = 4

/** Mirrors src/tools/cv-generator/columns.ts. Keep the two in step. */
export function findGutter(items, pageWidth) {
  const spans = items
    .filter((i) => i.str.trim())
    .map((i) => ({ from: i.transform[4], to: i.transform[4] + (i.width ?? 0) }))
    .filter((s) => Number.isFinite(s.from) && Number.isFinite(s.to))
  if (spans.length < MIN_ITEMS_PER_SIDE * 2) return null
  const from = pageWidth * SEARCH_FROM
  const to = pageWidth * SEARCH_TO
  const edges = [...new Set(spans.map((s) => s.to).filter((x) => x >= from && x <= to))].sort((a, b) => a - b)
  let best = null
  for (const edge of edges) {
    let next = Infinity
    for (const s of spans) {
      if (s.from >= edge && s.from < next) next = s.from
      if (s.from < edge && s.to > edge) { next = -Infinity; break }
    }
    if (!Number.isFinite(next) || next <= edge) continue
    const width = next - edge
    if (width > (best?.width ?? 0)) best = { x: (edge + next) / 2, width }
  }
  if (!best || best.width < pageWidth * MIN_GUTTER) return null
  const left = spans.filter((s) => s.to <= best.x).length
  const right = spans.filter((s) => s.from >= best.x).length
  if (left < MIN_ITEMS_PER_SIDE || right < MIN_ITEMS_PER_SIDE) return null
  return best.x
}

export function columnGroups(items, pageWidth) {
  const x = findGutter(items, pageWidth)
  if (x == null) return [items]
  return [items.filter((i) => i.transform[4] < x), items.filter((i) => i.transform[4] >= x)]
}

function linesByY(items) {
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
    // page.view is [x0, y0, x1, y1]; production passes the same width.
    pages.push(linesFromItems(content.items, page.view[2] - page.view[0]).join('\n'))
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
