// Build a single shareable invite image: a QR to the join link, the room code as
// text, a friendly caption, and the join URL embedded as PNG metadata (a tEXt
// chunk) — so sharing the picture shares everything at once.
import QRCode from 'qrcode'
import { callsHost } from './host'

const loadImg = (src: string) => new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src })

export interface InviteOptions {
  /** A meeting made ahead of time ("Join my meeting") rather than a call now. */
  meeting?: boolean
  /** Its start time, printed under the title and carried in the caption. */
  at?: Date | null
}

/** The start time as the picture carries it. The picture is read wherever it is
 *  forwarded to, so it names the sharer's time zone; the call screen, by
 *  contrast, shows each viewer their own local time. */
function atLine(at: Date, ar: boolean) {
  return new Intl.DateTimeFormat(ar ? 'ar-SA-u-ca-gregory' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' }).format(at)
}

export async function makeInvite(url: string, code: string, ar = false, opts: InviteOptions = {}): Promise<Blob> {
  const at = opts.at && !Number.isNaN(opts.at.getTime()) ? opts.at : null
  const when = at ? atLine(at, ar) : ''
  // A start time takes a line of its own between the title and the QR.
  const drop = when ? 44 : 0
  const W = 620, H = 780 + drop
  const c = document.createElement('canvas'); c.width = W; c.height = H
  const x = c.getContext('2d')!
  const b = callsHost().brand
  x.fillStyle = b.bg; x.fillRect(0, 0, W, H)
  x.textAlign = 'center'
  x.fillStyle = b.ink
  const title = opts.meeting ? (ar ? 'انضم إلى اجتماعي' : 'Join my meeting') : (ar ? 'انضم إلى مكالمتي' : 'Join my call')
  x.font = 'bold 42px Georgia, serif'; x.fillText(title, W / 2, 92)
  x.font = '18px system-ui, sans-serif'; x.fillStyle = b.soft
  x.fillText(ar ? 'خاص · مباشر بين الأجهزة · دون رفع' : 'Private · peer-to-peer · nothing uploaded', W / 2, 126)
  if (when) { x.font = 'bold 22px system-ui, sans-serif'; x.fillStyle = b.ink; x.fillText(when, W / 2, 168) }

  const qs = 360, qx = (W - qs) / 2, qy = 168 + drop
  const qr = await QRCode.toDataURL(url, { margin: 1, width: qs, color: { dark: b.qr, light: '#ffffff' } })
  x.fillStyle = '#ffffff'; x.fillRect(qx - 16, qy - 16, qs + 32, qs + 32)
  x.drawImage(await loadImg(qr), qx, qy, qs, qs)

  x.fillStyle = b.ink
  x.font = 'bold 34px ui-monospace, monospace'; x.fillText(code, W / 2, qy + qs + 78)
  x.font = '17px system-ui, sans-serif'; x.fillStyle = b.soft
  x.fillText(ar ? 'امسح الرمز أو افتح:' : 'Scan the code, or open:', W / 2, qy + qs + 118)
  x.font = '16px ui-monospace, monospace'; x.fillStyle = b.accent
  x.fillText(url.replace(/^https?:\/\//, ''), W / 2, qy + qs + 148)

  const blob: Blob = await new Promise((res) => c.toBlob((b) => res(b!), 'image/png'))
  const what = opts.meeting ? (ar ? 'اجتماعي' : 'meeting') : (ar ? 'مكالمتي' : 'call')
  const caption = (ar ? `انضم إلى ${what} في «${b.name.ar}»${when ? ` (${when})` : ''}: ` : `Join my ${b.name.en} ${what}${when ? ` (${when})` : ''}: `) + url
  return addPngText(await blob.arrayBuffer(), 'Description', caption)
}

// A shareable image for a personal "call me" link: QR to the /call page, the
// sharer's name (unless opted out), and the URL as text + PNG metadata — so it
// reads well when dropped into WhatsApp etc. `name` empty ⇒ a generic "Call me".
export async function makeCallLinkImage(url: string, name: string, ar = false): Promise<Blob> {
  const W = 620, H = 720
  const c = document.createElement('canvas'); c.width = W; c.height = H
  const x = c.getContext('2d')!
  const b = callsHost().brand
  x.fillStyle = b.bg; x.fillRect(0, 0, W, H)
  x.textAlign = 'center'
  x.fillStyle = b.ink
  const title = name ? (ar ? `اتصل بـ ${name}` : `Call ${name}`) : (ar ? 'اتصل بي' : 'Call me')
  x.font = 'bold 42px Georgia, serif'; x.fillText(title, W / 2, 92)
  x.font = '18px system-ui, sans-serif'; x.fillStyle = b.soft
  x.fillText(ar ? 'خاص · مباشر بين الأجهزة · دون تطبيق' : 'Private · peer-to-peer · no app', W / 2, 126)

  const qs = 360, qx = (W - qs) / 2, qy = 168
  const qr = await QRCode.toDataURL(url, { margin: 1, width: qs, color: { dark: b.qr, light: '#ffffff' } })
  x.fillStyle = '#ffffff'; x.fillRect(qx - 16, qy - 16, qs + 32, qs + 32)
  x.drawImage(await loadImg(qr), qx, qy, qs, qs)

  x.font = '17px system-ui, sans-serif'; x.fillStyle = b.soft
  x.fillText(ar ? 'امسح الرمز أو افتح:' : 'Scan the code, or open:', W / 2, qy + qs + 70)
  x.font = '16px ui-monospace, monospace'; x.fillStyle = b.accent
  x.fillText(url.replace(/^https?:\/\//, ''), W / 2, qy + qs + 104)

  const blob: Blob = await new Promise((res) => c.toBlob((b) => res(b!), 'image/png'))
  const caption = (name ? (ar ? `اتصل بـ ${name}: ` : `Call ${name}: `) : (ar ? 'اتصل بي: ' : 'Call me: ')) + url
  return addPngText(await blob.arrayBuffer(), 'Description', caption)
}

// --- inject a PNG tEXt metadata chunk (before IEND) ---
function crc32(buf: Uint8Array): number {
  let crc = 0xffffffff
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i]
    for (let k = 0; k < 8; k++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1))
  }
  return (crc ^ 0xffffffff) >>> 0
}
function addPngText(png: ArrayBuffer, keyword: string, text: string): Blob {
  const buf = new Uint8Array(png)
  const iend = buf.length - 12 // IEND is a fixed 12-byte trailer
  const data = new TextEncoder().encode(`${keyword}\0${text}`)
  const chunk = new Uint8Array(12 + data.length)
  const dv = new DataView(chunk.buffer)
  dv.setUint32(0, data.length)
  chunk.set([0x74, 0x45, 0x58, 0x74], 4) // 'tEXt'
  chunk.set(data, 8)
  dv.setUint32(8 + data.length, crc32(chunk.subarray(4, 8 + data.length)))
  const out = new Uint8Array(buf.length + chunk.length)
  out.set(buf.subarray(0, iend), 0)
  out.set(chunk, iend)
  out.set(buf.subarray(iend), iend + chunk.length)
  return new Blob([out as BlobPart], { type: 'image/png' })
}
