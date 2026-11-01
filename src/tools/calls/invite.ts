// Build a single shareable invite image: a QR to the join link, the room code as
// text, a friendly caption, and the join URL embedded as PNG metadata (a tEXt
// chunk) — so sharing the picture shares everything at once.
import QRCode from 'qrcode'
import { callsHost } from './host'

// A canvas that is never added to the page has no direction to inherit, so it
// lays Arabic out left to right: the colon lands on the wrong end and a time
// zone ends up before the date. Words take the language's direction; a code
// and a link are always left to right. A link that is too long for the
// picture (one carrying a start time) is set smaller rather than cut off.
type Ctx = CanvasRenderingContext2D
function words(x: Ctx, ar: boolean) { x.direction = ar ? 'rtl' : 'ltr' }
function link(x: Ctx, text: string, cx: number, y: number, maxW: number, family = 'ui-monospace, monospace', start = 16) {
  x.direction = 'ltr'
  let size = start
  do { x.font = `${size}px ${family}` } while (x.measureText(text).width > maxW && --size > 9)
  x.fillText(text, cx, y)
}

/** The host's typeface, loaded before anything is drawn: a canvas draws with
 *  whatever is ready and never redraws, so an unloaded face is a fallback face
 *  baked into the picture. Capped, because a font host that does not answer
 *  must not stop the picture being made. */
async function fontsReady(family: string, text: string) {
  if (typeof document === 'undefined' || !document.fonts) return
  const want = Promise.all(['400', '600', '700'].map((w) => document.fonts.load(`${w} 20px ${family}`, text)))
  await Promise.race([want, new Promise((r) => setTimeout(r, 2000))]).catch(() => {})
}

/** The link as a person reads it: an Arabic name or title in it is printed in
 *  Arabic rather than as %D8%B3…, and a + as a space. The QR and the caption
 *  keep the encoded form, which is what a scanner and a chat app need. */
function readable(url: string) {
  let u = url.replace(/^https?:\/\//, '')
  try { u = decodeURIComponent(u.replace(/\+/g, ' ')) } catch { /* leave it as it is */ }
  return u
}

const loadImg = (src: string) => new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src })

export interface InviteOptions {
  /** A meeting made ahead of time ("Join my meeting") rather than a call now. */
  meeting?: boolean
  /** Its start time, printed under the title and carried in the caption. */
  at?: Date | null
  /** How long it runs: the time line then reads as a range ("09:30–10:30"). */
  minutes?: number
  /** The organiser's name, which turns the title into "Join <name>'s meeting". */
  host?: string
  /** The organiser's own wording for the title, in place of "Join my meeting".
   *  It is also the opening of the caption the picture carries. */
  title?: string
  /** A picture (any URL an <img> takes) laid behind the invitation, for looks.
   *  The words sit on panels of the brand's own colour so they stay readable on
   *  whatever it is; a picture that will not load is simply left out. */
  background?: string
  /** An emoji set in the middle of the QR. The code is then made with the
   *  highest error correction, which is what lets a scanner read through it. */
  emoji?: string
}

/** The faces a picture is set in: the host's one typeface for everything when
 *  it names one (Sawi Kalam uses IBM Plex and nothing else), else the original
 *  serif title, sans text and monospace code and link. */
function faces(font?: string) {
  return font ? { title: font, sans: font, mono: font } : { title: 'Georgia, serif', sans: 'system-ui, sans-serif', mono: 'ui-monospace, monospace' }
}

/** The start time as the picture carries it. The picture is read wherever it is
 *  forwarded to, so a time zone other than Saudi time is named; Saudi time
 *  (UTC+3, no daylight saving) is what anybody reading it here assumes, and
 *  naming it is noise. The call screen shows each viewer their own local time. */
function atLine(at: Date, ar: boolean, minutes = 0) {
  const ksa = at.getTimezoneOffset() === -180
  const f = new Intl.DateTimeFormat(ar ? 'ar-SA-u-ca-gregory' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', ...(ksa ? {} : { timeZoneName: 'short' }) })
  // formatRange is in every engine this runs in; the lib target predates it.
  return minutes > 0 ? (f as Intl.DateTimeFormat & { formatRange(a: Date, b: Date): string }).formatRange(at, new Date(at.getTime() + minutes * 60_000)) : f.format(at)
}

/** Text that may be longer than the picture is wide (a long name in the title)
 *  is set smaller rather than run off the edge. */
function fit(x: Ctx, text: string, cx: number, y: number, maxW: number, weight: string, family: string, start: number) {
  let size = start
  do { x.font = `${weight} ${size}px ${family}` } while (x.measureText(text).width > maxW && --size > 16)
  x.fillText(text, cx, y)
}

function panel(x: Ctx, px: number, py: number, w: number, h: number, colour: string) {
  x.save(); x.globalAlpha = 0.9; x.fillStyle = colour
  x.beginPath(); x.roundRect(px, py, w, h, 16); x.fill(); x.restore()
}

/** Cover the picture with an image, cropped from its middle as CSS
 *  `object-fit: cover` would. */
function cover(x: Ctx, img: HTMLImageElement, W: number, H: number) {
  const s = Math.max(W / img.naturalWidth, H / img.naturalHeight)
  const w = img.naturalWidth * s, h = img.naturalHeight * s
  x.drawImage(img, (W - w) / 2, (H - h) / 2, w, h)
}

/** A meeting's invitation: the title, the start time if there is one, the QR
 *  and the link. Nothing else — the picture is read at a glance in a chat, and
 *  the QR and the link say how to join without being told. */
export function meetingTitle(ar: boolean, host = '', custom = '') {
  if (custom.trim()) return custom.trim()
  host = host.trim()
  if (!host) return ar ? 'انضم للاجتماع' : 'Join my meeting'
  return ar ? `انضم إلى اجتماع ${host}` : `Join ${host}’s meeting`
}

async function drawMeeting(url: string, ar: boolean, when: string, host = '', background = '', custom = '', emoji = ''): Promise<HTMLCanvasElement> {
  const b = callsHost().brand
  const family = b.font || 'system-ui, sans-serif'
  const title = meetingTitle(ar, host, custom)
  if (b.font) await fontsReady(b.font, title + when + url)
  const bg = background ? await loadImg(background).catch(() => null) : null
  const W = 620, qs = 360, qx = (W - qs) / 2
  const qy = when ? 186 : 140
  const H = qy + qs + 96
  const c = document.createElement('canvas'); c.width = W; c.height = H
  const x = c.getContext('2d')!
  x.fillStyle = b.bg; x.fillRect(0, 0, W, H)
  if (bg) {
    cover(x, bg, W, H)
    panel(x, 24, 32, W - 48, qy - 64, b.bg)
    panel(x, 24, qy + qs + 26, W - 48, 52, b.bg)
  }
  x.textAlign = 'center'
  words(x, ar)
  x.fillStyle = b.ink
  fit(x, title, W / 2, 86, W - 72, '700', family, 44)
  if (when) { x.font = `600 24px ${family}`; x.fillText(when, W / 2, 136) }
  const qr = await QRCode.toDataURL(url, { margin: 1, width: qs, errorCorrectionLevel: emoji ? 'H' : 'M', color: { dark: b.qr, light: '#ffffff' } })
  x.fillStyle = '#ffffff'; x.fillRect(qx - 16, qy - 16, qs + 32, qs + 32)
  x.drawImage(await loadImg(qr), qx, qy, qs, qs)
  if (emoji) {
    // A fifth of the width: well inside what level H recovers (30% of the
    // code), with the finder patterns in the corners untouched.
    const e = Math.round(qs * 0.22), ex = qx + (qs - e) / 2, ey = qy + (qs - e) / 2
    x.fillStyle = '#ffffff'; x.beginPath(); x.roundRect(ex, ey, e, e, 12); x.fill()
    x.save(); x.textAlign = 'center'; x.textBaseline = 'middle'; x.direction = 'ltr'
    x.font = `${Math.round(e * 0.72)}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`
    x.fillText(emoji, qx + qs / 2, qy + qs / 2 + e * 0.04)
    x.restore()
  }
  x.fillStyle = b.accent
  link(x, readable(url), W / 2, qy + qs + 62, W - 40, family, 18)
  return c
}

export async function makeInvite(url: string, code: string, ar = false, opts: InviteOptions = {}): Promise<Blob> {
  const at = opts.at && !Number.isNaN(opts.at.getTime()) ? opts.at : null
  const when = at ? atLine(at, ar, opts.meeting ? opts.minutes : 0) : ''
  if (opts.meeting) return finish(await drawMeeting(url, ar, when, opts.host, opts.background, opts.title, opts.emoji), url, ar, true, when, opts.host, opts.title)
  // A start time takes a line of its own between the title and the QR.
  const drop = when ? 44 : 0
  const W = 620, H = 780 + drop
  const c = document.createElement('canvas'); c.width = W; c.height = H
  const x = c.getContext('2d')!
  const b = callsHost().brand
  const f = faces(b.font)
  if (b.font) await fontsReady(b.font, 'Join انضم ' + url)
  x.fillStyle = b.bg; x.fillRect(0, 0, W, H)
  x.textAlign = 'center'
  words(x, ar)
  x.fillStyle = b.ink
  const title = opts.meeting ? (ar ? 'انضم للاجتماع' : 'Join my meeting') : (ar ? 'انضم إلى مكالمتي' : 'Join my call')
  x.font = `bold 42px ${f.title}`; x.fillText(title, W / 2, 92)
  x.font = `18px ${f.sans}`; x.fillStyle = b.soft
  x.fillText(ar ? 'خاص · مباشر بين الأجهزة · دون رفع' : 'Private · peer-to-peer · nothing uploaded', W / 2, 126)
  if (when) { x.font = `bold 22px ${f.sans}`; x.fillStyle = b.ink; x.fillText(when, W / 2, 168) }

  const qs = 360, qx = (W - qs) / 2, qy = 168 + drop
  const qr = await QRCode.toDataURL(url, { margin: 1, width: qs, color: { dark: b.qr, light: '#ffffff' } })
  x.fillStyle = '#ffffff'; x.fillRect(qx - 16, qy - 16, qs + 32, qs + 32)
  x.drawImage(await loadImg(qr), qx, qy, qs, qs)

  x.fillStyle = b.ink
  x.direction = 'ltr'
  x.font = `bold 34px ${f.mono}`; x.fillText(code, W / 2, qy + qs + 78)
  words(x, ar)
  x.font = `17px ${f.sans}`; x.fillStyle = b.soft
  x.fillText(ar ? 'امسح الرمز أو افتح:' : 'Scan the code, or open:', W / 2, qy + qs + 118)
  x.fillStyle = b.accent
  link(x, url.replace(/^https?:\/\//, ''), W / 2, qy + qs + 148, W - 40, f.mono)

  return finish(c, url, ar, false, when)
}

/** The PNG, with the invitation and the link in it as text, so the link
 *  survives the picture being forwarded on its own. */
async function finish(c: HTMLCanvasElement, url: string, ar: boolean, meeting: boolean, when: string, host = '', custom = ''): Promise<Blob> {
  const b = callsHost().brand
  const blob: Blob = await new Promise((res) => c.toBlob((x) => res(x!), 'image/png'))
  const who = host.trim()
  const at = when ? ` (${when})` : ''
  const join = ar
    ? (meeting ? (who ? `انضم إلى اجتماع ${who}` : 'انضم للاجتماع') : 'انضم إلى مكالمتي') + ` في «${b.name.ar}»`
    : `Join ${who ? `${who}’s` : 'my'} ${b.name.en} ${meeting ? 'meeting' : 'call'}`
  const caption = `${custom.trim() || join}${at}: ${url}`
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
  const f = faces(b.font)
  if (b.font) await fontsReady(b.font, 'Join انضم ' + url)
  x.fillStyle = b.bg; x.fillRect(0, 0, W, H)
  x.textAlign = 'center'
  words(x, ar)
  x.fillStyle = b.ink
  const title = name ? (ar ? `اتصل بـ ${name}` : `Call ${name}`) : (ar ? 'اتصل بي' : 'Call me')
  x.font = `bold 42px ${f.title}`; x.fillText(title, W / 2, 92)
  x.font = `18px ${f.sans}`; x.fillStyle = b.soft
  x.fillText(ar ? 'خاص · مباشر بين الأجهزة · دون تطبيق' : 'Private · peer-to-peer · no app', W / 2, 126)

  const qs = 360, qx = (W - qs) / 2, qy = 168
  const qr = await QRCode.toDataURL(url, { margin: 1, width: qs, color: { dark: b.qr, light: '#ffffff' } })
  x.fillStyle = '#ffffff'; x.fillRect(qx - 16, qy - 16, qs + 32, qs + 32)
  x.drawImage(await loadImg(qr), qx, qy, qs, qs)

  x.font = `17px ${f.sans}`; x.fillStyle = b.soft
  x.fillText(ar ? 'امسح الرمز أو افتح:' : 'Scan the code, or open:', W / 2, qy + qs + 70)
  x.fillStyle = b.accent
  link(x, url.replace(/^https?:\/\//, ''), W / 2, qy + qs + 104, W - 40, f.mono)

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
