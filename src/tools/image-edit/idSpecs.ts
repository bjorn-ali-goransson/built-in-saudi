// Photo specifications. Sizes are in millimetres; the head-height fraction is
// the share of the total photo height the head (chin to crown) should occupy,
// which is the rule every one of these standards is actually built around and
// the thing people get wrong.
//
// These are the published dimensions, not legal advice — requirements change and
// the accepting office has the final say. The UI says so.

export interface Spec {
  id: string
  en: string
  ar: string
  wmm: number
  hmm: number
  /** [min, max] head height as a fraction of photo height. */
  head: [number, number]
  /** Where the eye line should sit, as a fraction from the top. */
  eyes: number
  background: 'white' | 'light'
  note?: { en: string; ar: string }
}

export const SPECS: Spec[] = [
  {
    id: 'saudi-4x6', en: 'Saudi 4×6 cm', ar: 'سعودي ٤×٦ سم',
    wmm: 40, hmm: 60, head: [0.62, 0.75], eyes: 0.42, background: 'white',
    note: {
      en: 'The size used for most Saudi applications — iqama, licences and general paperwork.',
      ar: 'المقاس المستخدم في معظم المعاملات السعودية — الإقامة والرخص والأوراق العامة.',
    },
  },
  {
    id: 'passport-35x45', en: 'Passport 35×45 mm', ar: 'جواز ٣٥×٤٥ مم',
    wmm: 35, hmm: 45, head: [0.7, 0.8], eyes: 0.45, background: 'white',
    note: {
      en: 'The international standard used by most passports, and by Schengen visas.',
      ar: 'المقاس الدولي المعتمد في معظم الجوازات وتأشيرات شنغن.',
    },
  },
  {
    id: 'us-2x2', en: 'US visa 2×2 in', ar: 'تأشيرة أمريكية ٢×٢ إنش',
    wmm: 51, hmm: 51, head: [0.5, 0.69], eyes: 0.6, background: 'white',
    note: {
      en: 'Square. US visa and passport photos allow a wider head range than most.',
      ar: 'مربّع. تسمح صور التأشيرة والجواز الأمريكية بمدى أوسع لحجم الرأس.',
    },
  },
  {
    id: 'uk-35x45', en: 'UK 35×45 mm', ar: 'بريطاني ٣٥×٤٥ مم',
    wmm: 35, hmm: 45, head: [0.64, 0.76], eyes: 0.45, background: 'light',
  },
  {
    id: 'india-51x51', en: 'India 51×51 mm', ar: 'هندي ٥١×٥١ مم',
    wmm: 51, hmm: 51, head: [0.6, 0.7], eyes: 0.55, background: 'white',
  },
  {
    id: 'china-33x48', en: 'China visa 33×48 mm', ar: 'تأشيرة صينية ٣٣×٤٨ مم',
    wmm: 33, hmm: 48, head: [0.6, 0.72], eyes: 0.45, background: 'white',
  },
]

export const DPI_CHOICES = [300, 600] as const

export function pixelSize(spec: Spec, dpi: number): { w: number; h: number } {
  const mmToIn = 1 / 25.4
  return {
    w: Math.round(spec.wmm * mmToIn * dpi),
    h: Math.round(spec.hmm * mmToIn * dpi),
  }
}

/** Print sheets: how many photos fit on a 4×6in print, the cheapest way to get them. */
export interface Sheet { id: string; en: string; ar: string; wmm: number; hmm: number }
export const SHEETS: Sheet[] = [
  { id: '4x6in', en: '4×6 in photo print', ar: 'طبعة ٤×٦ إنش', wmm: 152.4, hmm: 101.6 },
  { id: 'a4', en: 'A4 sheet', ar: 'ورقة A4', wmm: 210, hmm: 297 },
]

export function tileCount(sheet: Sheet, spec: Spec, gapMm: number): { cols: number; rows: number } {
  const cols = Math.floor((sheet.wmm + gapMm) / (spec.wmm + gapMm))
  const rows = Math.floor((sheet.hmm + gapMm) / (spec.hmm + gapMm))
  return { cols: Math.max(0, cols), rows: Math.max(0, rows) }
}

/**
 * Tile the finished photo across a print sheet, with cut gaps. A print sheet is
 * the cheapest way to get the copies an application asks for: one 4×6in print
 * at a photo counter holds three Saudi 4×6cm photos.
 */
export function drawSheet(photo: HTMLCanvasElement, spec: Spec, sheet: Sheet, dpi: number, gapMm: number): HTMLCanvasElement {
  const mmToPx = (mm: number) => Math.round((mm / 25.4) * dpi)
  const canvas = document.createElement('canvas')
  canvas.width = mmToPx(sheet.wmm)
  canvas.height = mmToPx(sheet.hmm)
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  const { cols, rows } = tileCount(sheet, spec, gapMm)
  const pw = mmToPx(spec.wmm)
  const ph = mmToPx(spec.hmm)
  const gap = mmToPx(gapMm)
  const originX = Math.round((canvas.width - (cols * pw + (cols - 1) * gap)) / 2)
  const originY = Math.round((canvas.height - (rows * ph + (rows - 1) * gap)) / 2)
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = originX + c * (pw + gap)
      const y = originY + r * (ph + gap)
      ctx.drawImage(photo, x, y, pw, ph)
      // Hairline cut guides — without them people cut by eye and lose the margin.
      ctx.strokeStyle = 'rgba(0,0,0,0.25)'
      ctx.lineWidth = 1
      ctx.strokeRect(x + 0.5, y + 0.5, pw - 1, ph - 1)
    }
  }
  return canvas
}
