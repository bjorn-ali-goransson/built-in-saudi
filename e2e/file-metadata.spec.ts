import { test, expect } from '@playwright/test'
import { deflateSync, crc32 } from 'node:zlib'
import { PDFDocument } from 'pdf-lib'

// The only tool of 193 with no e2e coverage, and it hand-parses five binary
// formats — EXIF, PNG text chunks, PDF document info, RIFF tags — which is
// exactly the kind of promise that rots without anyone noticing. Each fixture
// below is built to the real format rather than mocked.

// ── a JPEG carrying a real EXIF APP1 segment ──

interface Tag { tag: number; type: number; value: number | number[] | string }

/** One IFD: count, entries, next-offset, then the out-of-line values. */
function ifd(tags: Tag[], valueBase: number, next = 0): { head: Buffer; values: Buffer } {
  const head = Buffer.alloc(2 + tags.length * 12 + 4)
  head.writeUInt16BE(tags.length, 0)
  const values: Buffer[] = []
  let valueOff = valueBase
  tags.forEach((t, i) => {
    const at = 2 + i * 12
    head.writeUInt16BE(t.tag, at)
    head.writeUInt16BE(t.type, at + 2)
    if (t.type === 2) {
      // ASCII: NUL-terminated, inline when it fits in four bytes.
      const buf = Buffer.from(String(t.value) + '\0', 'latin1')
      head.writeUInt32BE(buf.length, at + 4)
      if (buf.length <= 4) { buf.copy(head, at + 8) } else {
        head.writeUInt32BE(valueOff, at + 8)
        values.push(buf); valueOff += buf.length
      }
    } else if (t.type === 3) {
      head.writeUInt32BE(1, at + 4)
      head.writeUInt16BE(Number(t.value), at + 8)
    } else if (t.type === 4) {
      head.writeUInt32BE(1, at + 4)
      head.writeUInt32BE(Number(t.value), at + 8)
    } else {
      // RATIONAL: always out of line, two uint32 per value.
      const arr = Array.isArray(t.value) ? t.value : [t.value as number]
      head.writeUInt32BE(arr.length, at + 4)
      head.writeUInt32BE(valueOff, at + 8)
      const buf = Buffer.alloc(arr.length * 8)
      arr.forEach((v, k) => {
        // Keep it exact: thirds and minutes both divide cleanly by 1000.
        buf.writeUInt32BE(Math.round(v * 1000), k * 8)
        buf.writeUInt32BE(1000, k * 8 + 4)
      })
      values.push(buf); valueOff += buf.length
    }
  })
  head.writeUInt32BE(next, 2 + tags.length * 12)
  return { head, values: Buffer.concat(values) }
}

function exifJpeg(): Buffer {
  // Layout: TIFF header (8) | IFD0 | IFD0 values | Exif IFD | its values |
  // GPS IFD | its values. Offsets are from the start of the TIFF header.
  const exifTags: Tag[] = [
    { tag: 0x9003, type: 2, value: '2026:03:14 09:30:00' }, // DateTimeOriginal
    { tag: 0x829a, type: 5, value: 0.004 },                 // ExposureTime 1/250
    { tag: 0x829d, type: 5, value: 2.8 },                   // FNumber
    { tag: 0x8827, type: 3, value: 400 },                   // ISO
  ]
  const gpsTags: Tag[] = [
    { tag: 1, type: 2, value: 'N' },
    { tag: 2, type: 5, value: [24, 42, 45] },  // Riyadh-ish
    { tag: 3, type: 2, value: 'E' },
    { tag: 4, type: 5, value: [46, 43, 30] },
  ]

  // Sizes have to be known before offsets can be written, so lay out twice.
  const size = (tags: Tag[]) => 2 + tags.length * 12 + 4
  const ifd0Tags = (exifOff: number, gpsOff: number): Tag[] => [
    { tag: 0x010f, type: 2, value: 'BuiltInSaudi' },  // Make
    { tag: 0x0110, type: 2, value: 'Model X' },       // Model
    { tag: 0x0131, type: 2, value: 'TestSuite 1.0' }, // Software
    { tag: 0x8769, type: 4, value: exifOff },
    { tag: 0x8825, type: 4, value: gpsOff },
  ]
  const probe = ifd(ifd0Tags(0, 0), 0)
  const ifd0Size = size(ifd0Tags(0, 0)) + probe.values.length
  const exifStart = 8 + ifd0Size
  const exifBlock = ifd(exifTags, exifStart + size(exifTags))
  const gpsStart = exifStart + size(exifTags) + exifBlock.values.length
  const gpsBlock = ifd(gpsTags, gpsStart + size(gpsTags))
  const real = ifd(ifd0Tags(exifStart, gpsStart), 8 + size(ifd0Tags(0, 0)))

  const tiffHeader = Buffer.alloc(8)
  tiffHeader.write('MM', 0, 'latin1')      // big-endian
  tiffHeader.writeUInt16BE(42, 2)
  tiffHeader.writeUInt32BE(8, 4)           // IFD0 starts right after
  const tiff = Buffer.concat([tiffHeader, real.head, real.values, exifBlock.head, exifBlock.values, gpsBlock.head, gpsBlock.values])

  const app1Payload = Buffer.concat([Buffer.from('Exif\0\0', 'latin1'), tiff])
  const app1 = Buffer.alloc(4)
  app1.writeUInt16BE(0xffe1, 0)
  app1.writeUInt16BE(app1Payload.length + 2, 2)

  // A JPEG the tool will also read dimensions from: SOF0 with 8x8.
  const sof = Buffer.from([0xff, 0xc0, 0x00, 0x11, 0x08, 0x00, 0x08, 0x00, 0x08, 0x03,
    0x01, 0x11, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01])
  return Buffer.concat([
    Buffer.from([0xff, 0xd8]), app1, app1Payload, sof, Buffer.from([0xff, 0xd9]),
  ])
}

// ── a PNG with a tEXt chunk ──
function pngWithText(key: string, value: string): Buffer {
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0)
    const body = Buffer.concat([Buffer.from(type, 'latin1'), data])
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body) >>> 0, 0)
    return Buffer.concat([len, body, crc])
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(4, 0); ihdr.writeUInt32BE(3, 4)
  ihdr[8] = 8; ihdr[9] = 0
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('tEXt', Buffer.from(`${key}\0${value}`, 'latin1')),
    chunk('IDAT', deflateSync(Buffer.alloc(4 * 3 + 3))),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// ── a WAV with a LIST/INFO block ──
function wavWithTags(tags: Record<string, string>): Buffer {
  const entries = Object.entries(tags).map(([k, v]) => {
    const val = Buffer.from(v + '\0', 'latin1')
    const pad = val.length % 2 ? 1 : 0
    const head = Buffer.alloc(8)
    head.write(k, 0, 'latin1')
    head.writeUInt32LE(val.length, 4)
    return Buffer.concat([head, val, Buffer.alloc(pad)])
  })
  const infoBody = Buffer.concat([Buffer.from('INFO', 'latin1'), ...entries])
  const listHead = Buffer.alloc(8)
  listHead.write('LIST', 0, 'latin1')
  listHead.writeUInt32LE(infoBody.length, 4)

  const fmt = Buffer.alloc(24)
  fmt.write('fmt ', 0, 'latin1'); fmt.writeUInt32LE(16, 4)
  fmt.writeUInt16LE(1, 8); fmt.writeUInt16LE(1, 10)
  fmt.writeUInt32LE(8000, 12); fmt.writeUInt32LE(16000, 16)
  fmt.writeUInt16LE(2, 20); fmt.writeUInt16LE(16, 22)
  const data = Buffer.alloc(8 + 16)
  data.write('data', 0, 'latin1'); data.writeUInt32LE(16, 4)

  const body = Buffer.concat([Buffer.from('WAVE', 'latin1'), fmt, listHead, infoBody, data])
  const riff = Buffer.alloc(8)
  riff.write('RIFF', 0, 'latin1'); riff.writeUInt32LE(body.length, 4)
  return Buffer.concat([riff, body])
}

const drop = async (page: import('@playwright/test').Page, name: string, mimeType: string, buffer: Buffer) => {
  await page.goto('/en/apps/file-metadata')
  await page.getByTestId('meta-file').setInputFiles({ name, mimeType, buffer })
}

test.describe('file metadata', () => {
  test('camera EXIF is read out of a real APP1 segment', async ({ page }) => {
    await drop(page, 'photo.jpg', 'image/jpeg', exifJpeg())
    const panel = page.getByTestId('metadata')
    await expect(panel).toContainText('BuiltInSaudi')
    await expect(panel).toContainText('Model X')
    await expect(panel).toContainText('2026:03:14 09:30:00')
    await expect(panel).toContainText('TestSuite 1.0')
  })

  test('exposure and aperture are shown the way a photographer reads them', async ({ page }) => {
    await drop(page, 'photo.jpg', 'image/jpeg', exifJpeg())
    const panel = page.getByTestId('metadata')
    // 0.004s is 1/250, not "0.004 s".
    await expect(panel).toContainText('1/250 s')
    await expect(panel).toContainText('f/2.8')
    await expect(panel).toContainText('400')
  })

  test('GPS is converted from degrees-minutes-seconds and offered as a map link', async ({ page }) => {
    await drop(page, 'photo.jpg', 'image/jpeg', exifJpeg())
    const panel = page.getByTestId('metadata')
    // 24° 42' 45" N = 24.7125; 46° 43' 30" E = 46.725.
    await expect(panel).toContainText('24.71250')
    await expect(panel).toContainText('46.72500')
    await expect(panel.locator('a[href*="openstreetmap"]')).toBeVisible()
  })

  test('a PNG text chunk is surfaced', async ({ page }) => {
    await drop(page, 'shot.png', 'image/png', pngWithText('Description', 'Taken in Riyadh'))
    await expect(page.getByTestId('metadata')).toContainText('Taken in Riyadh')
  })

  test('PDF document info and page count', async ({ page }) => {
    const doc = await PDFDocument.create()
    doc.setTitle('Employment Contract')
    doc.setAuthor('Sara Al-Otaibi')
    doc.addPage([200, 200])
    doc.addPage([200, 200])
    await drop(page, 'doc.pdf', 'application/pdf', Buffer.from(await doc.save()))
    const panel = page.getByTestId('metadata')
    await expect(panel).toContainText('Employment Contract')
    await expect(panel).toContainText('Sara Al-Otaibi')
    await expect(panel).toContainText('2')
  })

  test('WAV RIFF tags are read', async ({ page }) => {
    await drop(page, 'clip.wav', 'audio/wav', wavWithTags({ INAM: 'Adhan', IART: 'Muadhin', ISFT: 'Recorder 2' }))
    const panel = page.getByTestId('metadata')
    await expect(panel).toContainText('Adhan')
    await expect(panel).toContainText('Muadhin')
  })

  test('a file with nothing hidden in it still reports the basics', async ({ page }) => {
    await drop(page, 'notes.txt', 'text/plain', Buffer.from('just text'))
    await expect(page.getByTestId('metadata')).toContainText('notes.txt')
  })
})
