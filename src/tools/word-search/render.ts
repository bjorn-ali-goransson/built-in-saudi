import { newPage, pagesToPdf, A4 } from '../../lib/printPdf'
import { isArabic, type Grid } from './grid'

// The sheet is composed on a canvas and wrapped in a PDF, for the reason this
// repo already records for worksheets and label sheets: pdf-lib cannot shape
// Arabic or reorder bidi text, and a puzzle grid is layout rather than
// selectable prose. Canvas does both correctly.

interface Opts {
  title: string
  grid: Grid
  words: string[]
  seed: string
  answers: boolean
  locale: 'en' | 'ar'
}

const FONT = (ar: boolean) => (ar ? '"IBM Plex Sans Arabic", sans-serif' : '"Hanken Grotesk", sans-serif')

function drawSheet(o: Opts, withAnswers: boolean) {
  const p = newPage(A4)
  const { ctx, px } = p
  const ar = isArabic(o.title) || o.words.some(isArabic)
  const marginMm = 18
  const usableMm = 210 - marginMm * 2

  ctx.fillStyle = '#1B2230'
  ctx.textAlign = 'center'
  ctx.font = `600 ${7 * px}px ${FONT(ar)}`
  ctx.fillText(o.title, (210 / 2) * px, marginMm * px)

  // The grid is square and as wide as the page allows, so the letters are as
  // big as they can be — this is printed and solved by hand.
  const n = o.grid.size
  const cellMm = usableMm / n
  const topMm = marginMm + 14

  ctx.strokeStyle = '#C8CCD4'
  ctx.lineWidth = Math.max(1, 0.25 * px)
  ctx.textAlign = 'center'
  ctx.font = `${cellMm * 0.55 * px}px ${FONT(ar)}`

  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const x = (marginMm + c * cellMm) * px
      const y = (topMm + r * cellMm) * px
      ctx.strokeRect(x, y, cellMm * px, cellMm * px)
      ctx.fillStyle = '#1B2230'
      ctx.fillText(o.grid.cells[r][c], x + (cellMm * px) / 2, y + cellMm * px * 0.22)
    }
  }

  if (withAnswers) {
    // A line through each answer rather than a shaded cell: shading a cell that
    // two answers share hides the fact that they cross, which is the part a
    // teacher is checking.
    ctx.strokeStyle = '#1E7A5F'
    ctx.lineWidth = Math.max(2, 0.7 * px)
    ctx.lineCap = 'round'
    for (const pl of o.grid.placed) {
      const len = [...pl.word].filter((ch) => /[\p{L}\p{N}]/u.test(ch)).length
      const cx = (j: number) => (marginMm + j * cellMm + cellMm / 2) * px
      const cy = (i: number) => (topMm + i * cellMm + cellMm / 2) * px
      ctx.beginPath()
      ctx.moveTo(cx(pl.col), cy(pl.row))
      ctx.lineTo(cx(pl.col + pl.dc * (len - 1)), cy(pl.row + pl.dr * (len - 1)))
      ctx.stroke()
    }
  }

  // The word list. Right-aligned and read right-to-left for Arabic, which is
  // the direction the whole sheet is being read in.
  const listTopMm = topMm + n * cellMm + 10
  ctx.fillStyle = '#28303E'
  ctx.font = `${4.2 * px}px ${FONT(ar)}`
  ctx.textAlign = ar ? 'right' : 'left'
  const cols = 3
  const colWMm = usableMm / cols
  o.words.forEach((w, i) => {
    const col = i % cols
    const row = Math.floor(i / cols)
    const xMm = ar
      ? 210 - marginMm - col * colWMm
      : marginMm + col * colWMm
    ctx.fillText(w, xMm * px, (listTopMm + row * 6) * px)
  })

  // The seed, small, at the foot. A teacher who reprints after a paper jam must
  // get the SAME sheet, or the answer key in their hand is for another puzzle.
  ctx.fillStyle = '#5C6675'
  ctx.font = `${3 * px}px ${FONT(false)}`
  ctx.textAlign = 'center'
  ctx.fillText(
    `${o.locale === 'ar' ? 'الرمز' : 'seed'}: ${o.seed}${withAnswers ? (o.locale === 'ar' ? ' — الحل' : ' — answers') : ''}`,
    (210 / 2) * px, (297 - 12) * px,
  )
  return p
}

export async function buildPdf(o: Opts): Promise<Blob> {
  const pages = [drawSheet(o, false)]
  if (o.answers) pages.push(drawSheet(o, true))
  return pagesToPdf(pages)
}

