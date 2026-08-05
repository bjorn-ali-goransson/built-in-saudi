// Barcode encoding, by hand. These are small, stable, well-specified formats —
// EAN/UPC is a fixed 95-module grid and Code 128 is a lookup table — so pulling
// in a barcode library to draw a few bars would be more code than writing it.

export type Symbology = 'ean13' | 'ean8' | 'upca' | 'code128'

export interface Encoded {
  /** One character per module: '1' is a bar, '0' is a space. */
  modules: string
  /** Digits printed under the bars, grouped as the standard prints them. */
  text: string
  /** Human-readable groups for EAN/UPC, which print in separated blocks. */
  groups?: { text: string; from: number; to: number }[]
}

// ── EAN / UPC ───────────────────────────────────────────────────────────────
const L = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011']
const G = ['0100111', '0110011', '0011011', '0100001', '0011101', '0111001', '0000101', '0010001', '0001001', '0010111']
const R = ['1110010', '1100110', '1101100', '1000010', '1011100', '1001110', '1010000', '1000100', '1001000', '1110100']
// Which of the first six digits use G instead of L, selected by the leading digit.
const PARITY = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL']

/** The mod-10 check digit EAN/UPC append. */
export function eanCheckDigit(digits: string): number {
  // Weights alternate 3 and 1 from the RIGHT, which is why the parity of the
  // length matters and why a hard-coded start weight is a classic bug here.
  let sum = 0
  const rev = [...digits].reverse()
  for (let i = 0; i < rev.length; i++) sum += Number(rev[i]) * (i % 2 === 0 ? 3 : 1)
  return (10 - (sum % 10)) % 10
}

function encodeEan13(input: string): Encoded {
  const base = input.slice(0, 12).padStart(12, '0')
  const full = base + eanCheckDigit(base)
  const parity = PARITY[Number(full[0])]
  let bits = '101'
  for (let i = 1; i <= 6; i++) bits += (parity[i - 1] === 'L' ? L : G)[Number(full[i])]
  bits += '01010'
  for (let i = 7; i <= 12; i++) bits += R[Number(full[i])]
  bits += '101'
  return {
    modules: bits,
    text: full,
    groups: [
      { text: full[0], from: 0, to: 3 },
      { text: full.slice(1, 7), from: 3, to: 45 },
      { text: full.slice(7), from: 50, to: 92 },
    ],
  }
}

function encodeEan8(input: string): Encoded {
  const base = input.slice(0, 7).padStart(7, '0')
  const full = base + eanCheckDigit(base)
  let bits = '101'
  for (let i = 0; i < 4; i++) bits += L[Number(full[i])]
  bits += '01010'
  for (let i = 4; i < 8; i++) bits += R[Number(full[i])]
  bits += '101'
  return {
    modules: bits,
    text: full,
    groups: [
      { text: full.slice(0, 4), from: 3, to: 31 },
      { text: full.slice(4), from: 36, to: 64 },
    ],
  }
}

function encodeUpcA(input: string): Encoded {
  // UPC-A is EAN-13 with a leading zero, so encode it that way and relabel.
  const base = input.slice(0, 11).padStart(11, '0')
  const full = base + eanCheckDigit(base)
  const ean = encodeEan13('0' + base)
  return {
    modules: ean.modules,
    text: full,
    groups: [
      { text: full[0], from: 0, to: 3 },
      { text: full.slice(1, 6), from: 3, to: 45 },
      { text: full.slice(6, 11), from: 50, to: 92 },
      { text: full[11], from: 92, to: 95 },
    ],
  }
}

// ── Code 128 ────────────────────────────────────────────────────────────────
// Each symbol is 11 modules, given as bar/space run lengths.
const C128 = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213',
  '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132',
  '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211',
  '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331',
  '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111',
  '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214',
  '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141',
  '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141',
  '114131', '311141', '411131', '211412', '211214', '211232', '2331112',
]
const START_B = 104
const STOP = 106

function runsToBits(runs: string): string {
  let bits = ''
  let bar = true
  for (const ch of runs) {
    bits += (bar ? '1' : '0').repeat(Number(ch))
    bar = !bar
  }
  return bits
}

function encodeCode128(input: string): Encoded {
  // Subset B covers ASCII 32–126, which is everything a person types into a
  // barcode field. Anything outside it is rejected rather than silently dropped.
  const values: number[] = []
  for (const ch of input) {
    const code = ch.charCodeAt(0)
    if (code < 32 || code > 126) throw new Error('unsupported character')
    values.push(code - 32)
  }
  let checksum = START_B
  values.forEach((v, i) => { checksum += v * (i + 1) })
  checksum %= 103

  let bits = runsToBits(C128[START_B])
  for (const v of values) bits += runsToBits(C128[v])
  bits += runsToBits(C128[checksum])
  bits += runsToBits(C128[STOP])
  return { modules: bits, text: input }
}

export function encode(symbology: Symbology, value: string): Encoded {
  const digitsOnly = value.replace(/\D/g, '')
  switch (symbology) {
    case 'ean13': return encodeEan13(digitsOnly)
    case 'ean8': return encodeEan8(digitsOnly)
    case 'upca': return encodeUpcA(digitsOnly)
    default: return encodeCode128(value)
  }
}

export interface Spec { digits: number | null; numeric: boolean; en: string; ar: string }

export const SPECS: Record<Symbology, Spec> = {
  ean13: { digits: 12, numeric: true, en: 'EAN-13 — retail products worldwide', ar: 'EAN-13 — منتجات التجزئة عالميًا' },
  ean8: { digits: 7, numeric: true, en: 'EAN-8 — small retail packages', ar: 'EAN-8 — العبوات الصغيرة' },
  upca: { digits: 11, numeric: true, en: 'UPC-A — retail in North America', ar: 'UPC-A — التجزئة في أمريكا الشمالية' },
  code128: { digits: null, numeric: false, en: 'Code 128 — any text, for logistics and internal labels', ar: 'Code 128 — أي نص، للشحن والملصقات الداخلية' },
}

/** Draw onto a canvas at a chosen module width, with the quiet zone standards require. */
export function draw(
  canvas: HTMLCanvasElement,
  enc: Encoded,
  opts: { moduleWidth: number; height: number; showText: boolean; quietZone: number },
): void {
  const { moduleWidth: mw, height, showText, quietZone } = opts
  const textH = showText ? Math.max(14, Math.round(mw * 9)) : 0
  const width = (enc.modules.length + quietZone * 2) * mw
  const dpr = window.devicePixelRatio || 1
  canvas.width = Math.round(width * dpr)
  canvas.height = Math.round((height + textH) * dpr)
  canvas.style.width = `${width}px`
  canvas.style.height = `${height + textH}px`
  const ctx = canvas.getContext('2d')!
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  // A white quiet zone is not decoration: without it scanners cannot find the
  // start pattern, which is the most common reason a printed barcode fails.
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, width, height + textH)
  ctx.fillStyle = '#000000'
  for (let i = 0; i < enc.modules.length; i++) {
    if (enc.modules[i] === '1') ctx.fillRect((i + quietZone) * mw, 0, mw, height)
  }
  if (showText) {
    ctx.font = `${Math.round(textH * 0.8)}px "JetBrains Mono", monospace`
    ctx.textBaseline = 'bottom'
    if (enc.groups) {
      // EAN/UPC print the digits in separated blocks under their own bars.
      for (const g of enc.groups) {
        const centre = ((g.from + g.to) / 2 + quietZone) * mw
        ctx.textAlign = 'center'
        ctx.fillText(g.text, centre, height + textH - 1)
      }
    } else {
      ctx.textAlign = 'center'
      ctx.fillText(enc.text, width / 2, height + textH - 1)
    }
  }
}
