import { test, expect } from '@playwright/test'
import { deflateRawSync, crc32 } from 'node:zlib'
import { PDFDocument, StandardFonts } from 'pdf-lib'

// "Files are never uploaded" is the site's first principle and the reason it
// exists rather than the adware incumbents. **109 tools say it in their own
// copy.** Almost none of them tested it: the specs that watch the network do so
// for other reasons (asset origin, mocked backends), so the claim itself rested
// on nobody having made a mistake.
//
// This watches every request a tool makes while a file is put through it, and
// asserts two things:
//
//   1. no request carries the file's contents — a token unique to the run, so a
//      match cannot be coincidence;
//   2. no request with a body goes anywhere at all. These tools have no
//      backend, so a POST is wrong regardless of what is in it — and that
//      catches an upload whose body is compressed or encoded past recognising.
//
// Analytics is allowlisted by origin and separately asserted never to carry the
// token, because "we do not upload your file" and "we count page views" are
// different claims and only one of them is being tested here.

const ANALYTICS = /googletagmanager\.com|google-analytics\.com|analytics\.google\.com/

const TOKEN = `bis-privacy-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`

function zip(files: { name: string; data: Buffer }[]): Buffer {
  const locals: Buffer[] = []; const central: Buffer[] = []; let offset = 0
  for (const f of files) {
    const name = Buffer.from(f.name, 'utf8')
    const body = deflateRawSync(f.data)
    const crc = crc32(f.data)
    const lh = Buffer.alloc(30)
    lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(8, 8)
    lh.writeUInt32LE(crc, 14); lh.writeUInt32LE(body.length, 18); lh.writeUInt32LE(f.data.length, 22)
    lh.writeUInt16LE(name.length, 26)
    locals.push(lh, name, body)
    const cd = Buffer.alloc(46)
    cd.writeUInt32LE(0x02014b50, 0); cd.writeUInt16LE(20, 4); cd.writeUInt16LE(20, 6)
    cd.writeUInt16LE(8, 10); cd.writeUInt32LE(crc, 16); cd.writeUInt32LE(body.length, 20)
    cd.writeUInt32LE(f.data.length, 24); cd.writeUInt16LE(name.length, 28); cd.writeUInt32LE(offset, 42)
    central.push(cd, name)
    offset += lh.length + name.length + body.length
  }
  const cdBuf = Buffer.concat(central)
  const eocd = Buffer.alloc(22)
  eocd.writeUInt32LE(0x06054b50, 0); eocd.writeUInt16LE(files.length, 8); eocd.writeUInt16LE(files.length, 10)
  eocd.writeUInt32LE(cdBuf.length, 12); eocd.writeUInt32LE(offset, 16)
  return Buffer.concat([...locals, cdBuf, eocd])
}

async function tokenPdf(): Promise<Buffer> {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  doc.addPage([300, 300]).drawText(TOKEN, { x: 20, y: 200, size: 10, font })
  return Buffer.from(await doc.save())
}

interface Case { id: string; testid: string; name: string; mime: string; make: () => Promise<Buffer> | Buffer }

/** An Office/EPUB-shaped zip: one XML part where the reader expects it. */
const xmlZip = (part: string, xml: string, extra: { name: string; data: Buffer }[] = []) =>
  zip([{ name: '[Content_Types].xml', data: Buffer.from('<?xml version="1.0"?><Types/>') },
    { name: part, data: Buffer.from(xml, 'utf8') }, ...extra])

const CASES: Case[] = [
  // A spread across every family that takes a file, because the promise is
  // made on all of them and a guard that only covers the tools I happened to
  // write last is a guard over my own memory.
  { id: 'pdf-to-text', testid: 'p2t-file', name: 'doc.pdf', mime: 'application/pdf', make: tokenPdf },
  { id: 'pdf-organise', testid: 'po-file', name: 'doc.pdf', mime: 'application/pdf', make: tokenPdf },
  { id: 'pdf-ocr', testid: 'pk-file', name: 'scan.pdf', mime: 'application/pdf', make: tokenPdf },
  { id: 'file-metadata', testid: 'meta-file', name: 'notes.txt', mime: 'text/plain', make: () => Buffer.from(TOKEN) },
  { id: 'hex-viewer', testid: 'hx-file', name: 'blob.bin', mime: 'application/octet-stream', make: () => Buffer.from(TOKEN) },
  { id: 'csv-to-xlsx', testid: 'cx-file', name: 'rows.csv', mime: 'text/csv', make: () => Buffer.from(`name,note\nSara,${TOKEN}\n`) },
  { id: 'csv-split', testid: 'cs-file', name: 'rows.csv', mime: 'text/csv', make: () => Buffer.from(`a,b\n1,${TOKEN}\n2,x\n`) },
  { id: 'csv-clean', testid: 'cc-file', name: 'rows.csv', mime: 'text/csv', make: () => Buffer.from(`a,b\n1,${TOKEN}\n`) },
  { id: 'csv-vcard', testid: 'cv-file', name: 'rows.csv', mime: 'text/csv', make: () => Buffer.from(`name,phone\n${TOKEN},0501234567\n`) },
  // Found missing by the code sweep that wired this tool to the shared table
  // reader: it has always taken a file and was never in this list. Which is the
  // documented failure mode of a guard scoped to whatever was written most
  // recently — grep src/tools for a file input, do not rely on memory.
  { id: 'csv-merge', testid: 'cm-file-a', name: 'rows.csv', mime: 'text/csv', make: () => Buffer.from(`a,b\n1,${TOKEN}\n`) },
  {
    id: 'vcard-to-csv', testid: 'vc-file', name: 'contacts.vcf', mime: 'text/vcard',
    make: () => Buffer.from(`BEGIN:VCARD\r\nVERSION:3.0\r\nFN:${TOKEN}\r\nN:;${TOKEN};;;\r\nEND:VCARD\r\n`),
  },
  {
    id: 'archive-inspector', testid: 'zip-file', name: 'bundle.zip', mime: 'application/zip',
    make: () => zip([{ name: 'secret.txt', data: Buffer.from(TOKEN) }]),
  },
  {
    id: 'docx-to-text', testid: 'dx-file', name: 'letter.docx',
    mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    make: () => xmlZip('word/document.xml',
      `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>${TOKEN}</w:t></w:r></w:p></w:body></w:document>`),
  },
  {
    id: 'pptx-to-text', testid: 'pt-file', name: 'deck.pptx',
    mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    make: () => xmlZip('ppt/slides/slide1.xml',
      `<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><p:cSld><p:spTree><a:p><a:r><a:t>${TOKEN}</a:t></a:r></a:p></p:spTree></p:cSld></p:sld>`),
  },
  {
    id: 'subtitle-editor', testid: 'sub-file', name: 'movie.srt', mime: 'text/plain',
    make: () => Buffer.from(`1\n00:00:01,000 --> 00:00:03,000\n${TOKEN}\n`),
  },
  {
    id: 'svg-optimise', testid: 'so-file', name: 'logo.svg', mime: 'image/svg+xml',
    make: () => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg"><title>${TOKEN}</title><rect width="10" height="10"/></svg>`),
  },
]

for (const c of CASES) {
  test(`${c.id}: the file never leaves the browser`, async ({ page }) => {
    const leaked: string[] = []
    const withBody: string[] = []

    page.on('request', (r) => {
      const url = r.url()
      const body = r.postData() ?? ''
      if (url.includes(TOKEN) || body.includes(TOKEN)) leaked.push(`${r.method()} ${url.slice(0, 120)}`)
      // These tools have no backend, so any request carrying a body is wrong
      // whatever is in it — which is what catches an upload we cannot read.
      if (body && !ANALYTICS.test(url)) withBody.push(`${r.method()} ${url.slice(0, 120)}`)
    })

    await page.goto(`/en/apps/${c.id}`)
    await page.getByTestId(c.testid).setInputFiles({ name: c.name, mimeType: c.mime, buffer: await c.make() })
    // Give the tool time to do its work — and to make a request if it were going to.
    await page.waitForTimeout(1500)

    expect(leaked, 'the file contents appeared in a request').toEqual([])
    expect(withBody, 'a request carried a body').toEqual([])
  })
}

test('the guard itself would notice a leak', async ({ page }) => {
  // Every check above has only ever passed, which on its own is no evidence
  // that it can fail. This fires exactly the request an uploading tool would
  // and asserts the same listener catches it — so a green run above means the
  // tools are clean, not that the detector is asleep.
  const leaked: string[] = []
  const withBody: string[] = []
  page.on('request', (r) => {
    const body = r.postData() ?? ''
    if (r.url().includes(TOKEN) || body.includes(TOKEN)) leaked.push(r.url())
    if (body && !ANALYTICS.test(r.url())) withBody.push(r.url())
  })

  await page.goto('/en/apps/pdf-to-text')
  await page.evaluate(async (token) => {
    // Deliberately what a tool must never do with a file.
    await fetch('/upload-that-should-not-exist', { method: 'POST', body: `file=${token}` }).catch(() => {})
  }, TOKEN)
  await page.waitForTimeout(500)

  expect(leaked.length, 'the token detector did not fire').toBeGreaterThan(0)
  expect(withBody.length, 'the body detector did not fire').toBeGreaterThan(0)
})

test('analytics never carries what you typed', async ({ page }) => {
  // A separate claim from "your file is not uploaded", and worth its own test:
  // page views are counted, the content is not.
  const carrying: string[] = []
  page.on('request', (r) => {
    if (!ANALYTICS.test(r.url())) return
    if (r.url().includes(TOKEN) || (r.postData() ?? '').includes(TOKEN)) carrying.push(r.url().slice(0, 120))
  })
  await page.goto('/en/apps/text-counter')
  await page.locator('textarea').first().fill(TOKEN)
  await page.waitForTimeout(1000)
  expect(carrying).toEqual([])
})
