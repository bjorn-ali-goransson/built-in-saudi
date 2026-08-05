import { A4, newPage, pagesToPdf, rng, toArabicDigits, type Page } from '../../lib/printPdf'

// Arithmetic practice sheets.
//
// The two things that make a worksheet generator usable rather than a toy:
//
// 1. **A seed.** The answer key must belong to the sheet in the teacher's hand.
//    If regenerating on every render, a reprint after a paper jam produces a
//    different worksheet and the key is quietly wrong.
// 2. **Division that divides.** A random a ÷ b is almost never a whole number.
//    So division problems are built backwards from the quotient — the answer is
//    chosen first and the dividend derived — which is also how the exercise is
//    meant to work at this level.

export type Op = 'add' | 'sub' | 'mul' | 'div'

export const OPS: Op[] = ['add', 'sub', 'mul', 'div']
export const SIGN: Record<Op, string> = { add: '+', sub: '−', mul: '×', div: '÷' }

export interface WorksheetOptions {
  ops: Op[]
  min: number
  max: number
  count: number
  columns: number
  seed: string
  /** Keep subtraction answers at or above zero — the usual ask below year 5. */
  noNegative: boolean
  arabicDigits: boolean
  title: string
}

export interface Problem { a: number; op: Op; b: number; answer: number }

export const DEFAULTS: WorksheetOptions = {
  ops: ['add', 'sub'],
  min: 1,
  max: 20,
  count: 24,
  columns: 3,
  seed: 'ABC123',
  noNegative: true,
  arabicDigits: false,
  title: '',
}

function one(op: Op, o: WorksheetOptions, rand: () => number): Problem {
  const pick = () => o.min + Math.floor(rand() * (o.max - o.min + 1))
  if (op === 'add') { const a = pick(), b = pick(); return { a, op, b, answer: a + b } }
  if (op === 'sub') {
    let a = pick(), b = pick()
    if (o.noNegative && b > a) [a, b] = [b, a]
    return { a, op, b, answer: a - b }
  }
  if (op === 'mul') { const a = pick(), b = pick(); return { a, op, b, answer: a * b } }
  // Division, built from the answer so it is always exact. A divisor of zero is
  // not a hard question, it is an undefined one.
  const b = Math.max(1, pick())
  const q = Math.max(1, pick())
  return { a: b * q, op, b, answer: q }
}

export function generate(o: WorksheetOptions): Problem[] {
  const ops = o.ops.length ? o.ops : ['add' as Op]
  const rand = rng(o.seed)
  const out: Problem[] = []
  const seen = new Set<string>()
  // Repeats on one sheet look like a bug even when they are only chance, so try
  // for distinct problems — but give up rather than loop forever when the range
  // genuinely cannot supply enough of them.
  let guard = o.count * 40
  while (out.length < o.count && guard-- > 0) {
    const p = one(ops[Math.floor(rand() * ops.length)], o, rand)
    const key = `${p.a}${p.op}${p.b}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(p)
  }
  while (out.length < o.count) out.push(one(ops[0], o, rand))
  return out
}

export const format = (p: Problem, arabic: boolean) => {
  const n = (x: number) => (arabic ? toArabicDigits(x) : String(x))
  return `${n(p.a)} ${SIGN[p.op]} ${n(p.b)} =`
}

/** How many problems fit before a second page is needed. */
export function perPage(columns: number): number {
  return columns <= 2 ? 20 : columns === 3 ? 30 : 40
}

const INK = '#1a1a1a'
const FAINT = '#9a9a9a'

function header(page: Page, title: string, sub: string) {
  const { ctx, px } = page
  const rtl = /[؀-ۿ]/.test(title + sub)
  ctx.direction = rtl ? 'rtl' : 'ltr'
  ctx.textAlign = rtl ? 'right' : 'left'
  const x = rtl ? page.wMm * px - 18 * px : 18 * px
  ctx.fillStyle = INK
  ctx.font = `600 ${Math.round(7 * px)}px "IBM Plex Sans Arabic", "Hanken Grotesk", sans-serif`
  ctx.fillText(title, x, 15 * px)
  ctx.fillStyle = FAINT
  ctx.font = `400 ${Math.round(3.6 * px)}px "IBM Plex Sans Arabic", "Hanken Grotesk", sans-serif`
  ctx.fillText(sub, x, 25 * px)
  // Name / date rules — the part every teacher adds by hand otherwise.
  ctx.strokeStyle = '#cccccc'
  ctx.lineWidth = Math.max(1, 0.3 * px)
  ctx.beginPath()
  ctx.moveTo(18 * px, 33 * px)
  ctx.lineTo((page.wMm - 18) * px, 33 * px)
  ctx.stroke()
}

export async function buildWorksheet(
  problems: Problem[],
  o: WorksheetOptions,
  labels: { title: string; name: string; date: string; key: string; of: (a: number, b: number) => string },
  withKey: boolean,
): Promise<Blob> {
  const pages: Page[] = []
  const per = perPage(o.columns)
  const sheets = Math.max(1, Math.ceil(problems.length / per))

  for (let s = 0; s < sheets; s++) {
    const page = newPage(A4)
    const { ctx, px } = page
    const slice = problems.slice(s * per, (s + 1) * per)
    header(page, o.title || labels.title, `${labels.name} ____________________   ${labels.date} ____________`)

    const left = 18, right = 18
    const colW = (page.wMm - left - right) / o.columns
    const rows = Math.ceil(slice.length / o.columns)
    const top = 45
    const rowH = Math.min(14, (page.hMm - top - 22) / Math.max(rows, 1))

    ctx.direction = 'ltr'
    ctx.textAlign = 'left'
    slice.forEach((p, i) => {
      const col = i % o.columns
      const row = Math.floor(i / o.columns)
      const x = (left + col * colW) * px
      const y = (top + row * rowH) * px
      ctx.fillStyle = FAINT
      ctx.font = `400 ${Math.round(2.8 * px)}px "Hanken Grotesk", sans-serif`
      ctx.fillText(String(s * per + i + 1), x, y)
      ctx.fillStyle = INK
      ctx.font = `500 ${Math.round(5 * px)}px "IBM Plex Sans Arabic", "Hanken Grotesk", sans-serif`
      ctx.fillText(format(p, o.arabicDigits), x + 6 * px, y + 1 * px)
      // The answer rule, long enough to write on.
      ctx.strokeStyle = '#bbbbbb'
      ctx.lineWidth = Math.max(1, 0.25 * px)
      const lineY = (y + 7.5 * px)
      const startX = x + 6 * px + ctx.measureText(format(p, o.arabicDigits)).width + 2 * px
      ctx.beginPath()
      ctx.moveTo(startX, lineY)
      ctx.lineTo(Math.min(startX + 18 * px, x + colW * px - 4 * px), lineY)
      ctx.stroke()
    })

    ctx.fillStyle = FAINT
    ctx.textAlign = 'center'
    ctx.font = `400 ${Math.round(2.8 * px)}px "Hanken Grotesk", sans-serif`
    ctx.fillText(labels.of(s + 1, sheets), (page.wMm / 2) * px, (page.hMm - 14) * px)
    pages.push(page)
  }

  if (withKey) {
    const page = newPage(A4)
    const { ctx, px } = page
    header(page, `${o.title || labels.title} — ${labels.key}`, `${labels.key} · ${o.seed}`)
    const cols = 4
    const colW = (page.wMm - 36) / cols
    ctx.direction = 'ltr'
    ctx.textAlign = 'left'
    problems.forEach((p, i) => {
      const col = i % cols
      const row = Math.floor(i / cols)
      const x = (18 + col * colW) * px
      const y = (45 + row * 9) * px
      ctx.fillStyle = INK
      ctx.font = `400 ${Math.round(3.6 * px)}px "IBM Plex Sans Arabic", "Hanken Grotesk", sans-serif`
      const n = o.arabicDigits ? toArabicDigits(i + 1) : String(i + 1)
      const a = o.arabicDigits ? toArabicDigits(p.answer) : String(p.answer)
      ctx.fillText(`${n}. ${a}`, x, y)
    })
    pages.push(page)
  }

  return pagesToPdf(pages)
}
