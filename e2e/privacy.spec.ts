import { test, expect } from '@playwright/test'
import { deflateRawSync, deflateSync, crc32 } from 'node:zlib'
import { readFileSync } from 'node:fs'
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

export interface Case {
  id: string
  /**
   * The file input's own testid, OR — when it has none — the testid of the
   * element it sits inside, with `within: true`.
   *
   * Most tools put a testid on the dropzone and none on the `<input>` itself.
   * Reaching in through the container covers twenty of them without editing
   * twenty product files for the sake of a test, and it is no more fragile: the
   * dropzone testid is the thing those tools' own specs already click.
   */
  testid: string
  within?: boolean
  name: string; mime: string
  make: () => Promise<Buffer> | Buffer
  /**
   * A tool that does not open the file until a SECOND action — `pdf-stamp`
   * only reads it when stamping, `file-encrypt` needs a password first — must
   * be driven to that action, or the case asserts nothing at all. Measured:
   * before this existed, 2 of 68 cases were exactly that.
   */
  act?: (page: Page) => Promise<void>
  /**
   * Some tools keep the file input behind a mode or tab, so it is not on the
   * page at load. Reveal it here. Both of the tools that needed this were
   * caught by the input simply never appearing — which is the right failure,
   * but it is worth naming rather than dropping the tool from the guard.
   */
  reveal?: (page: import('@playwright/test').Page) => Promise<void>
}

/** An Office/EPUB-shaped zip: one XML part where the reader expects it. */
const xmlZip = (part: string, xml: string, extra: { name: string; data: Buffer }[] = []) =>
  zip([{ name: '[Content_Types].xml', data: Buffer.from('<?xml version="1.0"?><Types/>') },
    { name: part, data: Buffer.from(xml, 'utf8') }, ...extra])

/**
 * A real, decodable PNG carrying the token in a tEXt chunk.
 *
 * Same discipline as the WAV below: the image tools decode with
 * `createImageBitmap`, so a fixture that is not a valid image never reaches the
 * code that could upload it, and the case would pass having tested nothing.
 * tEXt is ignored by every decoder, which is what makes it the right hiding
 * place. (Shape borrowed from `e2e/file-metadata.spec.ts`, which builds the
 * same chunk for the opposite reason — to be read rather than ignored.)
 */
function pngWithToken(token: string): Buffer {
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0)
    const body = Buffer.concat([Buffer.from(type, 'latin1'), data])
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body) >>> 0, 0)
    return Buffer.concat([len, body, crc])
  }
  const w = 4, h = 3
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4)
  ihdr[8] = 8; ihdr[9] = 0 // 8-bit greyscale
  // One filter byte per row, then w bytes of pixel.
  const raw = Buffer.alloc(h * (w + 1))
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('tEXt', Buffer.from(`Comment\0${token}`, 'latin1')),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

/**
 * A real, decodable WAV that carries the run's token in a RIFF LIST/INFO chunk.
 *
 * The audio tools decode with `decodeAudioData`, so the fixture has to be valid
 * audio — otherwise the tool never gets far enough to upload anything and the
 * case passes for the wrong reason, which is the failure mode this whole spec
 * exists to avoid. Unknown chunks are skipped by every WAV parser, which is
 * what makes INFO the right place to hide a marker.
 */
function wavWithToken(token: string): Buffer {
  const rate = 8000
  const data = Buffer.alloc(rate / 5) // a tenth of a second of silence, 16-bit
  const info = Buffer.from(token, 'ascii')
  const pad = info.length % 2 // RIFF chunks are word-aligned

  const cmt = Buffer.alloc(8 + info.length + pad)
  cmt.write('ICMT', 0, 'ascii')
  cmt.writeUInt32LE(info.length, 4)
  info.copy(cmt, 8)

  const list = Buffer.concat([Buffer.alloc(12), cmt])
  list.write('LIST', 0, 'ascii')
  list.writeUInt32LE(4 + cmt.length, 4)
  list.write('INFO', 8, 'ascii')
  const listChunk = Buffer.concat([list.subarray(0, 12), cmt])

  const fmt = Buffer.alloc(24)
  fmt.write('fmt ', 0, 'ascii')
  fmt.writeUInt32LE(16, 4)
  fmt.writeUInt16LE(1, 8)   // PCM
  fmt.writeUInt16LE(1, 10)  // mono
  fmt.writeUInt32LE(rate, 12)
  fmt.writeUInt32LE(rate * 2, 16)
  fmt.writeUInt16LE(2, 20)
  fmt.writeUInt16LE(16, 22)

  const dataChunk = Buffer.concat([Buffer.alloc(8), data])
  dataChunk.write('data', 0, 'ascii')
  dataChunk.writeUInt32LE(data.length, 4)

  const body = Buffer.concat([Buffer.from('WAVE', 'ascii'), fmt, listChunk, dataChunk])
  const head = Buffer.alloc(8)
  head.write('RIFF', 0, 'ascii')
  head.writeUInt32LE(body.length, 4)
  return Buffer.concat([head, body])
}

/**
 * The real sample video with the token hidden in a trailing `free` box.
 *
 * Same discipline as the PNG and WAV above: the tool must be able to PLAY the
 * file, or it errors out before reaching any code that could upload, and the
 * case passes having tested nothing. An ISO-BMFF reader skips a box it does not
 * recognise, and `free` is defined as skippable — so the video still decodes
 * and the bytes still carry a marker.
 */
function mp4WithToken(token: string): Buffer {
  const body = Buffer.from(token, 'ascii')
  const box = Buffer.alloc(8 + body.length)
  box.writeUInt32BE(box.length, 0)
  box.write('free', 4, 'ascii')
  body.copy(box, 8)
  return Buffer.concat([readFileSync('e2e/fixtures/sample.mp4'), box])
}

// Exported so a measurement can drive the same list without copying it —
// a second list is how a guard and its audit stop agreeing.
export const CASES: Case[] = [
  // A spread across every family that takes a file, because the promise is
  // made on all of them and a guard that only covers the tools I happened to
  // write last is a guard over my own memory.
  { id: 'pdf-to-text', testid: 'p2t-file', name: 'doc.pdf', mime: 'application/pdf', make: tokenPdf },
  { id: 'pdf-to-word', testid: 'ptw-file', name: 'doc.pdf', mime: 'application/pdf', make: tokenPdf },
  { id: 'image-base64', testid: 'ib-file', name: 'pic.png', mime: 'image/png', make: pngWithToken },
  { id: 'markdown-html', testid: 'mh-file', name: 'notes.md', mime: 'text/markdown', make: () => Buffer.from(`# Title

${TOKEN}
`) },
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
  { id: 'audio-spectrum', testid: 'as-file', name: 'clip.wav', mime: 'audio/wav', make: () => wavWithToken(TOKEN) },
  { id: 'audio-convert', testid: 'ac-file', name: 'note.wav', mime: 'audio/wav', make: () => wavWithToken(TOKEN) },
  { id: 'video-frames', testid: 'vf-file', name: 'clip.mp4', mime: 'video/mp4', make: () => mp4WithToken(TOKEN) },

  // --- Second batch off the UNVERIFIED list. These twenty reach the input
  // through the dropzone that wraps it, which is what let the batch be this
  // size without touching twenty product files.
  { id: 'image-compressor', testid: 'imgcomp-drop', within: true, name: 'shot.png', mime: 'image/png', make: () => pngWithToken(TOKEN) },
  { id: 'image-cropper', testid: 'crop-drop', within: true, name: 'shot.png', mime: 'image/png', make: () => pngWithToken(TOKEN) },
  { id: 'image-rearrange', testid: 'rearr-drop', within: true, name: 'shot.png', mime: 'image/png', make: () => pngWithToken(TOKEN) },
  { id: 'image-redact', testid: 'redact-drop', within: true, name: 'shot.png', mime: 'image/png', make: () => pngWithToken(TOKEN) },
  { id: 'images-to-pdf', testid: 'i2p-drop', within: true, name: 'shot.png', mime: 'image/png', make: () => pngWithToken(TOKEN) },
  { id: 'image-to-ascii', testid: 'ascii-drop', within: true, name: 'shot.png', mime: 'image/png', make: () => pngWithToken(TOKEN) },
  { id: 'meme-generator', testid: 'meme-drop', within: true, name: 'shot.png', mime: 'image/png', make: () => pngWithToken(TOKEN) },
  { id: 'metadata-remove', testid: 'mr-drop', within: true, name: 'shot.png', mime: 'image/png', make: () => pngWithToken(TOKEN) },
  { id: 'remove-background', testid: 'rmbg-drop', within: true, name: 'shot.png', mime: 'image/png', make: () => pngWithToken(TOKEN) },
  { id: 'steganography', testid: 'stego-drop', within: true, name: 'shot.png', mime: 'image/png', make: () => pngWithToken(TOKEN) },
  { id: 'favicon-generator', testid: 'favicon-drop', within: true, name: 'shot.png', mime: 'image/png', make: () => pngWithToken(TOKEN) },
  { id: 'qr-reader', testid: 'qr-drop', within: true, name: 'shot.png', mime: 'image/png', make: () => pngWithToken(TOKEN) },
  { id: 'pdf-compress', testid: 'cmp-drop', within: true, name: 'doc.pdf', mime: 'application/pdf', make: tokenPdf },
  { id: 'pdf-edit', testid: 'edit-drop', within: true, name: 'doc.pdf', mime: 'application/pdf', make: tokenPdf },
  { id: 'pdf-fill', testid: 'fill-drop', within: true, name: 'doc.pdf', mime: 'application/pdf', make: tokenPdf },
  { id: 'pdf-merge', testid: 'pm-drop', within: true, name: 'doc.pdf', mime: 'application/pdf', make: tokenPdf },
  { id: 'pdf-sign', testid: 'sign-drop', within: true, name: 'doc.pdf', mime: 'application/pdf', make: tokenPdf },
  { id: 'pdf-split', testid: 'ps-file', name: 'doc.pdf', mime: 'application/pdf', make: tokenPdf },
  { id: 'pdf-to-images', testid: 'p2i-file', name: 'doc.pdf', mime: 'application/pdf', make: tokenPdf },
  {
    // Needs a password before it touches the file, so picking one alone tested
    // nothing at all until this act was added.
    id: 'file-encrypt', testid: 'fe-drop', within: true, name: 'blob.bin', mime: 'application/octet-stream',
    make: () => Buffer.from(TOKEN),
    act: async (page) => {
      await page.getByTestId('fe-password').fill('correct horse battery staple')
      await page.getByTestId('fe-run').click()
    },
  },
  {
    id: 'hash-generator', testid: 'hash-drop', within: true,
    name: 'blob.bin', mime: 'application/octet-stream', make: () => Buffer.from(TOKEN),
    // Hashes TEXT by default; the dropzone only exists in file mode. Caught by
    // the input never appearing, which is the right failure — a container that
    // is not on the page is indistinguishable from a wrong selector until you
    // look.
    reveal: async (page) => {
      await expect(async () => {
        await page.getByTestId('hash-mode-file').click()
        await expect(page.getByTestId('hash-drop')).toBeVisible({ timeout: 1000 })
      }).toPass({ timeout: 15000 })
    },
  },
  { id: 'cert-decoder', testid: 'cd-file', name: 'cert.pem', mime: 'application/x-pem-file', make: () => Buffer.from(`-----BEGIN CERTIFICATE-----
${TOKEN}
-----END CERTIFICATE-----
`) },
  { id: 'video-audio', testid: 'va-file', name: 'clip.mp4', mime: 'video/mp4', make: () => mp4WithToken(TOKEN) },
  { id: 'video-gif', testid: 'vg-file', name: 'clip.mp4', mime: 'video/mp4', make: () => mp4WithToken(TOKEN) },
  { id: 'video-trim', testid: 'vt-file', name: 'clip.mp4', mime: 'video/mp4', make: () => mp4WithToken(TOKEN) },
  // --- The last of the UNVERIFIED list except the two OCR tools, which pull
  // the tesseract models and belong in a slower pass of their own.
  { id: 'image-format-converter', testid: 'ifc-drop', within: true, name: 'shot.png', mime: 'image/png', make: () => pngWithToken(TOKEN) },
  { id: 'sheet-diff', testid: 'sd-file-a', name: 'rows.csv', mime: 'text/csv', make: () => Buffer.from(`a,b
1,${TOKEN}
`) },
  { id: 'xlsx-convert', testid: 'xl-file', name: 'book.xlsx', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', make: () => xmlZip('xl/sharedStrings.xml', `<sst><si><t>${TOKEN}</t></si></sst>`) },
  { id: 'zatca-qr', testid: 'zq-file', name: 'invoice.png', mime: 'image/png', make: () => pngWithToken(TOKEN) },
  { id: 'svg-editor', testid: 'svg-file', name: 'art.svg', mime: 'image/svg+xml', make: () => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg"><title>${TOKEN}</title></svg>`) },
  // The file here is an OPTIONAL centre logo, not the tool's subject — but it
  // is still a file leaving the user's machine if anything went wrong.
  { id: 'qr-code', testid: 'qr-logo-file', name: 'logo.png', mime: 'image/png', make: () => pngWithToken(TOKEN) },
  // The last one. It pulls the tesseract wasm core and a ~2MB language model,
  // which is exactly why it was left until last — but those are same-origin
  // GETs with no body, so the guard's two assertions still hold and the only
  // cost is time. If it ever goes off-origin, `e2e/ocr.spec.ts` fails first.
  { id: 'image-to-text', testid: 'ocr-drop', within: true, name: 'scan.png', mime: 'image/png', make: () => pngWithToken(TOKEN) },
  { id: 'image-diff', testid: 'idf-file-a', name: 'shot.png', mime: 'image/png', make: () => pngWithToken(TOKEN) },

  // --- Working the UNVERIFIED list down (see scripts/check-privacy-coverage.mjs).
  // 65 tools take a file and 17 were proved; these are the next 14. Chosen
  // because their fixtures are shapes this file already builds — the image,
  // PDF, audio and archive families — rather than because they were the tools
  // most recently written, which is how the list got short in the first place.
  { id: 'color-palette', testid: 'cp-file', name: 'shot.png', mime: 'image/png', make: () => pngWithToken(TOKEN) },
  { id: 'colour-blind', testid: 'cb-file', name: 'shot.png', mime: 'image/png', make: () => pngWithToken(TOKEN),
    reveal: (page) => page.getByTestId('cb-mode-image').click() },
  { id: 'screenshot-frame', testid: 'sf-file', name: 'shot.png', mime: 'image/png', make: () => pngWithToken(TOKEN) },
  { id: 'social-resize', testid: 'sr-file', name: 'shot.png', mime: 'image/png', make: () => pngWithToken(TOKEN) },
  { id: 'passport-photo', testid: 'pp-file', name: 'shot.png', mime: 'image/png', make: () => pngWithToken(TOKEN) },
  { id: 'carousel-split', testid: 'cs-file', name: 'shot.png', mime: 'image/png', make: () => pngWithToken(TOKEN) },
  { id: 'batch-watermark', testid: 'bw-file', name: 'shot.png', mime: 'image/png', make: () => pngWithToken(TOKEN) },
  { id: 'pdf-booklet', testid: 'pb-file', name: 'doc.pdf', mime: 'application/pdf', make: tokenPdf },
  { id: 'pdf-redact', testid: 'pr-file', name: 'doc.pdf', mime: 'application/pdf', make: tokenPdf },
  {
    // Does not open the file at pick time — it only reads it when stamping.
    id: 'pdf-stamp', testid: 'ps-file', name: 'doc.pdf', mime: 'application/pdf', make: tokenPdf,
    act: async (page) => { await page.getByTestId('ps-apply').click() },
  },
  { id: 'audio-trim', testid: 'at-file', name: 'note.wav', mime: 'audio/wav', make: () => wavWithToken(TOKEN) },
  { id: 'remove-silence', testid: 'rs-file', name: 'note.wav', mime: 'audio/wav', make: () => wavWithToken(TOKEN) },
  { id: 'epub-text', testid: 'ep-file', name: 'book.epub', mime: 'application/epub+zip', make: () => xmlZip('OEBPS/ch1.xhtml', `<html><body><p>${TOKEN}</p></body></html>`) },
  {
    id: 'ics-builder', testid: 'ics-file', name: 'cal.ics', mime: 'text/calendar',
    make: () => Buffer.from(['BEGIN:VCALENDAR', 'VERSION:2.0', 'BEGIN:VEVENT', `SUMMARY:${TOKEN}`, 'END:VEVENT', 'END:VCALENDAR', ''].join('\r\n')),
    // Retried, because the click can land before React attaches and then does
    // nothing at all. The tab works perfectly in isolation and timed out here,
    // which is the signature of a hydration race rather than a wrong selector —
    // Playwright waits for the element to be actionable, not for a handler to
    // have been attached to it.
    reveal: async (page) => {
      await expect(async () => {
        await page.getByTestId('ics-tab-read').click()
        await expect(page.getByTestId('ics-file')).toBeAttached({ timeout: 1000 })
      }).toPass({ timeout: 15000 })
    },
  },
  {
    id: 'vcard-to-csv', testid: 'vc-file', name: 'contacts.vcf', mime: 'text/vcard',
    make: () => Buffer.from(`BEGIN:VCARD\r\nVERSION:3.0\r\nFN:${TOKEN}\r\nN:;${TOKEN};;;\r\nEND:VCARD\r\n`),
  },
  {
    id: 'archive-inspector', testid: 'zip-file', name: 'bundle.zip', mime: 'application/zip',
    make: () => zip([{ name: 'secret.txt', data: Buffer.from(TOKEN) }]),
  },
  {
    // A manuscript is exactly the kind of file people will not upload.
    id: 'markdown-epub', testid: 'me-file', name: 'book.md', mime: 'text/markdown',
    make: () => Buffer.from(`# Chapter

${TOKEN}
`),
  },
  {
    // A contract or a draft is exactly what people will not upload.
    id: 'docx-markdown', testid: 'dm-file', name: 'draft.docx',
    mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    make: () => xmlZip('word/document.xml',
      `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>${TOKEN}</w:t></w:r></w:p></w:body></w:document>`),
  },
  {
    // Plain text in, .docx out — the input is the sensitive half here, since
    // the thing people convert is a contract or notes about a client.
    id: 'markdown-docx', testid: 'md-file', name: 'notes.md', mime: 'text/markdown',
    make: () => Buffer.from(`# Notes

${TOKEN}
`),
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

/**
 * Counts the ways a page can actually READ a picked file.
 *
 * A guard that asserts "nothing was uploaded" against a tool that never opened
 * the file has proved nothing, and nothing checked that until it was measured.
 * The first version of this probe watched `Blob`/`FileReader` only and reported
 * 18 of 68 cases as vacuous — 16 of which were image tools using
 * `createImageBitmap` or worker tools handed the `File` itself, both invisible
 * to it. **An unfaithful measurement invents defects as readily as it hides
 * them**; the real number is 2.
 */
const READ_PROBE = `
  window.__reads = 0
  const bump = () => { window.__reads++ }
  for (const m of ['arrayBuffer', 'text', 'slice', 'stream']) {
    const orig = Blob.prototype[m]
    if (orig) Blob.prototype[m] = function (...a) { bump(); return orig.apply(this, a) }
  }
  for (const m of ['readAsArrayBuffer', 'readAsText', 'readAsDataURL', 'readAsBinaryString']) {
    const orig = FileReader.prototype[m]
    if (orig) FileReader.prototype[m] = function (...a) { bump(); return orig.apply(this, a) }
  }
  const cou = URL.createObjectURL
  URL.createObjectURL = function (...a) { bump(); return cou.apply(this, a) }
  const cib = window.createImageBitmap
  if (cib) window.createImageBitmap = function (...a) { bump(); return cib.apply(this, a) }
  // A worker is handed the File itself and reads it off the main thread, which
  // no prototype patch here can see — count the handover instead.
  const W = window.Worker
  window.Worker = class extends W {
    postMessage(...a) { bump(); return super.postMessage(...a) }
  }
`

for (const c of CASES) {
  test(`${c.id}: the file never leaves the browser`, async ({ page }) => {
    const leaked: string[] = []
    const withBody: string[] = []
    await page.addInitScript(READ_PROBE)

    page.on('request', (r) => {
      const url = r.url()
      const body = r.postData() ?? ''
      if (url.includes(TOKEN) || body.includes(TOKEN)) leaked.push(`${r.method()} ${url.slice(0, 120)}`)
      // These tools have no backend, so any request carrying a body is wrong
      // whatever is in it — which is what catches an upload we cannot read.
      if (body && !ANALYTICS.test(url)) withBody.push(`${r.method()} ${url.slice(0, 120)}`)
    })

    await page.goto(`/en/apps/${c.id}`)
    if (c.reveal) await c.reveal(page)
    const input = c.within
      ? page.getByTestId(c.testid).locator('input[type="file"]')
      : page.getByTestId(c.testid)
    await input.setInputFiles({ name: c.name, mimeType: c.mime, buffer: await c.make() })
    if (c.act) await c.act(page)

    // Wait for the tool to READ the file rather than for a fixed 1500ms. The
    // old sleep was the anti-pattern this repo documents — waiting for time to
    // pass instead of for the thing under test — and under a loaded suite it
    // could expire before a heavy tool had started, which is a green that means
    // "I watched nothing happen".
    await expect
      .poll(() => page.evaluate(() => (window as unknown as { __reads: number }).__reads), { timeout: 20_000 })
      .toBeGreaterThan(0)
    // Then a settle window, so a request made just after the read is still seen.
    await page.waitForTimeout(1200)

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
