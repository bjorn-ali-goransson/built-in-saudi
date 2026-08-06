import { A4, newPage, pagesToPdf, type Page } from '../../lib/printPdf'
import { FORMS, LETTERS, shaped } from './letters'

// Drawing the practice sheet.
//
// The whole page is composed on a canvas because that is what shapes and orders
// Arabic correctly — the same reason `textImage.ts` exists. A row is: a solid
// model at the right-hand end (Arabic starts on the right), then faded copies to
// trace over, then empty ruled space to write in unaided.

export type Style = 'trace' | 'outline' | 'dots'

export interface SheetOptions {
  /** What to practise: whole letters, or a word/name/phrase. */
  mode: 'letters' | 'text'
  letters: string[]
  text: string
  /** Include the four positional forms for each letter. */
  showForms: boolean
  rows: number
  /** Faded copies per row, before the blank space. */
  traced: number
  style: Style
  size: number
  guides: boolean
  title: string
}

export const DEFAULTS: SheetOptions = {
  mode: 'letters',
  letters: ['ب'],
  text: '',
  showForms: true,
  rows: 4,
  traced: 3,
  style: 'trace',
  size: 22,
  guides: true,
  title: '',
}

const INK = '#1a1a1a'
const FAINT = '#b8b8b8'
const GUIDE = '#d8e3dc'

const font = (mm: number, px: number, weight = 400) =>
  `${weight} ${Math.round(mm * px)}px "IBM Plex Sans Arabic", "Hanken Grotesk", sans-serif`

/** One practice row: model, faded copies, then space. */
function drawRow(page: Page, glyph: string, yMm: number, o: SheetOptions) {
  const { ctx, px } = page
  const right = page.wMm - 18
  const left = 18
  const h = o.size

  if (o.guides) {
    ctx.strokeStyle = GUIDE
    ctx.lineWidth = Math.max(1, 0.3 * px)
    // Baseline plus a dashed height line — the two lines a child is asked to
    // sit the letter between.
    ctx.setLineDash([])
    ctx.beginPath()
    ctx.moveTo(left * px, (yMm + h * 0.72) * px)
    ctx.lineTo(right * px, (yMm + h * 0.72) * px)
    ctx.stroke()
    ctx.setLineDash([3 * px, 3 * px])
    ctx.beginPath()
    ctx.moveTo(left * px, (yMm + h * 0.2) * px)
    ctx.lineTo(right * px, (yMm + h * 0.2) * px)
    ctx.stroke()
    ctx.setLineDash([])
  }

  ctx.direction = 'rtl'
  ctx.textAlign = 'right'
  ctx.textBaseline = 'alphabetic'
  ctx.font = font(h, px)

  const baseline = (yMm + h * 0.72) * px
  const width = ctx.measureText(glyph).width
  const gap = width * 0.6
  let x = right * px

  // The model, solid.
  ctx.fillStyle = INK
  ctx.fillText(glyph, x, baseline)
  x -= width + gap

  // The copies to trace over.
  for (let i = 0; i < o.traced; i++) {
    if (x - width < left * px) break
    if (o.style === 'trace') {
      ctx.fillStyle = FAINT
      ctx.fillText(glyph, x, baseline)
    } else {
      ctx.strokeStyle = FAINT
      ctx.lineWidth = Math.max(1, 0.35 * px)
      ctx.setLineDash(o.style === 'dots' ? [1.2 * px, 1.8 * px] : [])
      ctx.strokeText(glyph, x, baseline)
      ctx.setLineDash([])
    }
    x -= width + gap
  }
}

export function rowGlyphs(o: SheetOptions): { glyph: string; label: string }[] {
  if (o.mode === 'text') {
    const t = o.text.trim()
    return t ? [{ glyph: t, label: '' }] : []
  }
  const byCh = new Map(LETTERS.map((l) => [l.ch, l]))
  const out: { glyph: string; label: string }[] = []
  for (const ch of o.letters) {
    const letter = byCh.get(ch)
    if (!letter) continue
    if (!o.showForms) { out.push({ glyph: letter.ch, label: letter.name }); continue }
    for (const form of FORMS) {
      const g = shaped(letter, form)
      // A non-joining letter has no initial or medial form; printing the
      // isolated shape under those headings would teach something false.
      if (g) out.push({ glyph: g, label: `${letter.name} · ${FORM_AR[form]}` })
    }
  }
  return out
}

const FORM_AR: Record<string, string> = {
  isolated: 'مفردة', initial: 'أول الكلمة', medial: 'وسط الكلمة', final: 'آخر الكلمة',
}

export async function buildSheet(o: SheetOptions, labels: { title: string; name: string; date: string }): Promise<Blob> {
  const glyphs = rowGlyphs(o)
  if (!glyphs.length) throw new Error('nothing-to-print')

  const pages: Page[] = []
  const rowH = o.size + 6
  const top = 42
  const perPage = Math.max(1, Math.floor((297 - top - 20) / rowH))

  // Each glyph gets `rows` rows of its own, in order.
  const allRows: { glyph: string; label: string }[] = []
  for (const g of glyphs) for (let i = 0; i < o.rows; i++) allRows.push({ ...g, label: i === 0 ? g.label : '' })

  for (let i = 0; i < allRows.length; i += perPage) {
    const page = newPage(A4)
    const { ctx, px } = page
    const slice = allRows.slice(i, i + perPage)

    ctx.direction = 'rtl'
    ctx.textAlign = 'right'
    ctx.textBaseline = 'top'
    ctx.fillStyle = INK
    ctx.font = font(7, px, 600)
    ctx.fillText(o.title || labels.title, (page.wMm - 18) * px, 15 * px)
    ctx.fillStyle = '#9a9a9a'
    ctx.font = font(3.6, px)
    ctx.fillText(`${labels.name} ____________   ${labels.date} ________`, (page.wMm - 18) * px, 25 * px)

    slice.forEach((r, k) => {
      const y = top + k * rowH
      if (r.label) {
        ctx.fillStyle = '#9a9a9a'
        ctx.textAlign = 'left'
        ctx.direction = 'rtl'
        ctx.textBaseline = 'top'
        ctx.font = font(3.2, px)
        ctx.fillText(r.label, 18 * px, (y - 4) * px)
      }
      drawRow(page, r.glyph, y, o)
    })
    pages.push(page)
  }

  return pagesToPdf(pages)
}
