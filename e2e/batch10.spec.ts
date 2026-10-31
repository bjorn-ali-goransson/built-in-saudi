import { test, expect } from '@playwright/test'
import { PDFDocument, StandardFonts } from 'pdf-lib'
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'

async function textPdf(lines: string[]): Promise<Buffer> {
  const pdf = await PDFDocument.create()
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const page = pdf.addPage([400, 400])
  lines.forEach((line, i) => page.drawText(line, { x: 40, y: 340 - i * 30, size: 16, font }))
  return Buffer.from(await pdf.save())
}

async function textInPdf(bytes: Uint8Array): Promise<string> {
  const doc = await pdfjs.getDocument({ data: bytes, useWorkerFetch: false, isEvalSupported: false }).promise
  let out = ''
  for (let i = 1; i <= doc.numPages; i++) {
    const content = await (await doc.getPage(i)).getTextContent()
    out += (content.items as { str?: string }[]).map((x) => x.str ?? '').join('')
  }
  return out
}

test.describe('carousel splitter', () => {
  async function attach(page: import('@playwright/test').Page, w: number, h: number) {
    const dataUrl = await page.evaluate(([cw, ch]) => {
      const c = document.createElement('canvas')
      c.width = cw; c.height = ch
      const ctx = c.getContext('2d')!
      const g = ctx.createLinearGradient(0, 0, cw, 0)
      g.addColorStop(0, '#1f5c3d'); g.addColorStop(1, '#c2903a')
      ctx.fillStyle = g; ctx.fillRect(0, 0, cw, ch)
      return c.toDataURL('image/png')
    }, [w, h])
    await page.getByTestId('cs-file').setInputFiles({
      name: 'wide.png', mimeType: 'image/png', buffer: Buffer.from(dataUrl.split(',')[1], 'base64'),
    })
  }
})

test.describe('csv merge', () => {
  const A = 'id,name\n1,Ahmed\n2,Fatimah\n3,Khalid'
  const B = 'id,city\n1,Riyadh\n2,Jeddah\n9,Dammam'
})

