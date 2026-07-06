// Client-side text extraction — the CV file never leaves the browser; only the
// extracted plain text is sent on for generation. PDF via pdf.js, DOCX via
// mammoth, plus plain text. Both libs are heavy, so this module is imported
// lazily from the tool.
import * as pdfjs from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
// @ts-expect-error - the browser build ships no types
import mammoth from 'mammoth/mammoth.browser'

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

async function fromPdf(buf: ArrayBuffer): Promise<string> {
  const doc = await pdfjs.getDocument({ data: buf }).promise
  const pages: string[] = []
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    const content = await page.getTextContent()
    // Rebuild lines from text items using their vertical position.
    let line = ''
    let lastY: number | null = null
    const out: string[] = []
    for (const item of content.items as { str: string; transform: number[] }[]) {
      const y = item.transform[5]
      if (lastY !== null && Math.abs(y - lastY) > 3) {
        out.push(line.trimEnd())
        line = ''
      }
      line += item.str + (item.str.endsWith(' ') ? '' : ' ')
      lastY = y
    }
    if (line.trim()) out.push(line.trimEnd())
    pages.push(out.join('\n'))
  }
  return pages.join('\n\n')
}

async function fromDocx(buf: ArrayBuffer): Promise<string> {
  const res = await mammoth.extractRawText({ arrayBuffer: buf })
  return String(res.value || '')
}

const MAX_CHARS = 30000 // plenty for a CV; guards the LLM call

export async function extractText(file: File): Promise<string> {
  const name = file.name.toLowerCase()
  let text: string
  if (name.endsWith('.pdf') || file.type === 'application/pdf') {
    text = await fromPdf(await file.arrayBuffer())
  } else if (name.endsWith('.docx')) {
    text = await fromDocx(await file.arrayBuffer())
  } else if (name.endsWith('.txt') || name.endsWith('.md') || file.type.startsWith('text/')) {
    text = await file.text()
  } else {
    throw new Error('unsupported')
  }
  return text.replace(/\r/g, '').replace(/\n{3,}/g, '\n\n').trim().slice(0, MAX_CHARS)
}
