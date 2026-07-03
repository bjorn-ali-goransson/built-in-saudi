import QRCode from 'qrcode'

// Brand tokens (kept in sync with src/styles/theme.css).
const INK = '#0b3d2e'      // green-700 — card bg + QR modules
const INK_2 = '#0e5a3f'    // green-600 — lower band
const SAND = '#f4ecdd'     // sand-100 — primary text
const PAPER = '#fffdf8'    // QR panel
const GOLD = '#d6a33f'     // gold-400 — accent

export interface CardData {
  name: string
  ibanRaw: string   // no spaces, uppercase
  ibanFmt: string   // grouped in 4s
  account: string   // national account number (may be empty for non-SA)
  bankName?: string
  labels: { title: string; holder: string; account: string; iban: string }
  rtl: boolean
}

/** The QR payload — plain, readable text so any scanner surfaces the details. */
export function cardPayload(d: CardData): string {
  return [
    d.name && `${d.labels.holder}: ${d.name}`,
    `${d.labels.iban}: ${d.ibanRaw}`,
    d.account && `${d.labels.account}: ${d.account}`,
  ].filter(Boolean).join('\n')
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function drawQR(ctx: CanvasRenderingContext2D, payload: string, x: number, y: number, size: number) {
  const qr = QRCode.create(payload, { errorCorrectionLevel: 'M' })
  const count = qr.modules.size
  const data = qr.modules.data
  const margin = 2
  const cell = size / (count + margin * 2)
  ctx.fillStyle = INK
  for (let r = 0; r < count; r++) {
    for (let c = 0; c < count; c++) {
      if (data[r * count + c]) ctx.fillRect(x + (c + margin) * cell, y + (r + margin) * cell, cell + 0.6, cell + 0.6)
    }
  }
}

/** Render the shareable "account information" card to a canvas (2× for crisp
 *  output). Layout mirrors the familiar bank "share account" card: name up top,
 *  a plain QR in a paper panel, then the account number + IBAN. */
export async function buildIbanCard(d: CardData): Promise<HTMLCanvasElement> {
  // Fonts must be ready or canvas falls back to a system face mid-draw.
  if (document.fonts?.ready) { try { await document.fonts.ready } catch { /* ignore */ } }

  const S = 2
  const W = 680
  const H = 1000
  const canvas = document.createElement('canvas')
  canvas.width = W * S
  canvas.height = H * S
  const ctx = canvas.getContext('2d')!
  ctx.scale(S, S)

  // Background: two-tone band like the reference card.
  ctx.fillStyle = INK
  ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = INK_2
  ctx.fillRect(0, H * 0.62, W, H * 0.38)

  const P = 52
  const start = d.rtl ? W - P : P
  const sansAr = "'IBM Plex Sans Arabic', system-ui, sans-serif"
  const sans = "'Hanken Grotesk', system-ui, sans-serif"
  const display = d.rtl ? sansAr : "'Fraunces', Georgia, serif"
  const mono = "'JetBrains Mono', ui-monospace, monospace"
  const labelFont = d.rtl ? sansAr : sans

  // Header: small label + holder name.
  ctx.textBaseline = 'alphabetic'
  ctx.textAlign = d.rtl ? 'right' : 'left'
  ctx.direction = d.rtl ? 'rtl' : 'ltr'
  ctx.fillStyle = 'rgba(244,236,221,0.62)'
  ctx.font = `600 15px ${labelFont}`
  ctx.fillText(d.labels.title, start, 72)
  ctx.fillStyle = SAND
  ctx.font = `600 34px ${display}`
  ctx.fillText(d.name || '—', start, 116)
  if (d.bankName) {
    ctx.fillStyle = 'rgba(244,236,221,0.7)'
    ctx.font = `500 17px ${labelFont}`
    ctx.fillText(d.bankName, start, 146)
  }

  // QR in a paper panel, centred.
  const panel = 372
  const px = (W - panel) / 2
  const py = 186
  ctx.fillStyle = PAPER
  roundRect(ctx, px, py, panel, panel, 26)
  ctx.fill()
  const pad = 30
  drawQR(ctx, cardPayload(d), px + pad, py + pad, panel - pad * 2)

  // Info rows.
  let rowY = py + panel + 70
  const row = (label: string, value: string, valueMono: boolean) => {
    ctx.textAlign = d.rtl ? 'right' : 'left'
    ctx.direction = d.rtl ? 'rtl' : 'ltr'
    ctx.fillStyle = 'rgba(244,236,221,0.6)'
    ctx.font = `600 15px ${labelFont}`
    ctx.fillText(label, start, rowY)
    // Values (IBAN / account digits) stay LTR; right-align them on RTL cards.
    ctx.direction = 'ltr'
    ctx.textAlign = d.rtl ? 'right' : 'left'
    ctx.fillStyle = SAND
    ctx.font = valueMono ? `500 22px ${mono}` : `600 22px ${sans}`
    ctx.fillText(value, start, rowY + 32)
    rowY += 82
  }
  if (d.account) row(d.labels.account, d.account, true)
  row(d.labels.iban, d.ibanFmt, true)

  // Footer wordmark.
  ctx.textAlign = 'center'
  ctx.direction = 'ltr'
  ctx.fillStyle = GOLD
  ctx.font = `600 16px ${mono}`
  ctx.fillText('built-in-saudi.com', W / 2, H - 40)

  return canvas
}

export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png'),
  )
}
