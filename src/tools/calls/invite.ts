// Build a single shareable invite image: a QR to the join link, the room code as
// text, a friendly caption, and the join URL embedded as PNG metadata (a tEXt
// chunk) — so sharing the picture shares everything at once.
import QRCode from 'qrcode'

const loadImg = (src: string) => new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src })

export async function makeInvite(url: string, code: string, ar = false): Promise<Blob> {
  const W = 620, H = 780
  const c = document.createElement('canvas'); c.width = W; c.height = H
  const x = c.getContext('2d')!
  x.fillStyle = '#0e5a3f'; x.fillRect(0, 0, W, H)
  x.textAlign = 'center'
  x.fillStyle = '#faf7f0'
  x.font = 'bold 42px Georgia, serif'; x.fillText(ar ? 'انضم إلى مكالمتي' : 'Join my call', W / 2, 92)
  x.font = '18px system-ui, sans-serif'; x.fillStyle = 'rgba(250,247,240,0.82)'
  x.fillText(ar ? 'خاص · مباشر بين الأجهزة · دون رفع' : 'Private · peer-to-peer · nothing uploaded', W / 2, 126)

  const qs = 360, qx = (W - qs) / 2, qy = 168
  const qr = await QRCode.toDataURL(url, { margin: 1, width: qs, color: { dark: '#0e5a3f', light: '#ffffff' } })
  x.fillStyle = '#ffffff'; x.fillRect(qx - 16, qy - 16, qs + 32, qs + 32)
  x.drawImage(await loadImg(qr), qx, qy, qs, qs)

  x.fillStyle = '#faf7f0'
  x.font = 'bold 34px ui-monospace, monospace'; x.fillText(code, W / 2, qy + qs + 78)
  x.font = '17px system-ui, sans-serif'; x.fillStyle = 'rgba(250,247,240,0.82)'
  x.fillText(ar ? 'امسح الرمز أو افتح:' : 'Scan the code, or open:', W / 2, qy + qs + 118)
  x.font = '16px ui-monospace, monospace'; x.fillStyle = '#d6a33f'
  x.fillText(url.replace(/^https?:\/\//, ''), W / 2, qy + qs + 148)

  const blob: Blob = await new Promise((res) => c.toBlob((b) => res(b!), 'image/png'))
  const caption = (ar ? 'انضم إلى مكالمتي في «بُنِيَ في السعودية»: ' : 'Join my Built in Saudi call: ') + url
  return addPngText(await blob.arrayBuffer(), 'Description', caption)
}

// A shareable image for a personal "call me" link: QR to the /call page, the
// sharer's name (unless opted out), and the URL as text + PNG metadata — so it
// reads well when dropped into WhatsApp etc. `name` empty ⇒ a generic "Call me".
export async function makeCallLinkImage(url: string, name: string, ar = false): Promise<Blob> {
  const W = 620, H = 720
  const c = document.createElement('canvas'); c.width = W; c.height = H
  const x = c.getContext('2d')!
  x.fillStyle = '#0e5a3f'; x.fillRect(0, 0, W, H)
  x.textAlign = 'center'
  x.fillStyle = '#faf7f0'
  const title = name ? (ar ? `اتصل بـ ${name}` : `Call ${name}`) : (ar ? 'اتصل بي' : 'Call me')
  x.font = 'bold 42px Georgia, serif'; x.fillText(title, W / 2, 92)
  x.font = '18px system-ui, sans-serif'; x.fillStyle = 'rgba(250,247,240,0.82)'
  x.fillText(ar ? 'خاص · مباشر بين الأجهزة · دون تطبيق' : 'Private · peer-to-peer · no app', W / 2, 126)

  const qs = 360, qx = (W - qs) / 2, qy = 168
  const qr = await QRCode.toDataURL(url, { margin: 1, width: qs, color: { dark: '#0e5a3f', light: '#ffffff' } })
  x.fillStyle = '#ffffff'; x.fillRect(qx - 16, qy - 16, qs + 32, qs + 32)
  x.drawImage(await loadImg(qr), qx, qy, qs, qs)

  x.font = '17px system-ui, sans-serif'; x.fillStyle = 'rgba(250,247,240,0.82)'
  x.fillText(ar ? 'امسح الرمز أو افتح:' : 'Scan the code, or open:', W / 2, qy + qs + 70)
  x.font = '16px ui-monospace, monospace'; x.fillStyle = '#d6a33f'
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
