import { A4, newPage, pagesToPdf, type Page } from '../../lib/printPdf'

// A quiz you can print and a quiz you can send — with nothing stored anywhere.
//
// The share link carries the whole quiz in the URL fragment. That is the reason
// this tool needs no backend and keeps the privacy promise literally: a
// fragment is never sent to a server, not even in the request that loads the
// page. The cost is length, so `encode` compacts the shape (single-letter keys,
// the correct index rather than a repeat of the answer text) and the UI warns
// when a link grows past what messaging apps and old proxies will carry intact.

export type Kind = 'mcq' | 'tf' | 'short'

export interface Question {
  kind: Kind
  q: string
  /** MCQ options. Unused for tf/short. */
  choices: string[]
  /** Index into `choices` for mcq; 0 = true, 1 = false for tf. */
  correct: number
  /** The expected text for a short answer. */
  answer: string
}

export interface Quiz {
  title: string
  questions: Question[]
}

export const blank = (kind: Kind = 'mcq'): Question => ({
  kind,
  q: '',
  choices: kind === 'mcq' ? ['', '', '', ''] : [],
  correct: 0,
  answer: '',
})

/** The answer as text, whatever the question kind. */
export function answerText(q: Question, tf: [string, string]): string {
  if (q.kind === 'short') return q.answer
  if (q.kind === 'tf') return tf[q.correct === 0 ? 0 : 1]
  return q.choices[q.correct] ?? ''
}

export function isAnswered(q: Question): boolean {
  if (!q.q.trim()) return false
  if (q.kind === 'short') return q.answer.trim().length > 0
  if (q.kind === 'tf') return true
  return q.choices.filter((c) => c.trim()).length >= 2 && !!q.choices[q.correct]?.trim()
}

// --- share link -------------------------------------------------------------

interface Compact { t: string; q: [number, string, string[], number, string][] }

const KINDS: Kind[] = ['mcq', 'tf', 'short']

export function encodeQuiz(quiz: Quiz): string {
  const c: Compact = {
    t: quiz.title,
    q: quiz.questions.map((x) => [KINDS.indexOf(x.kind), x.q, x.choices, x.correct, x.answer]),
  }
  const bytes = new TextEncoder().encode(JSON.stringify(c))
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  // base64url — '+' and '/' do not survive being pasted into a chat message.
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function decodeQuiz(s: string): Quiz | null {
  try {
    const b64 = s.replace(/-/g, '+').replace(/_/g, '/')
    const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4))
    const bytes = Uint8Array.from(bin, (ch) => ch.charCodeAt(0))
    const c = JSON.parse(new TextDecoder().decode(bytes)) as Compact
    if (!c || !Array.isArray(c.q)) return null
    return {
      title: String(c.t ?? ''),
      questions: c.q.map((x) => ({
        kind: KINDS[x[0]] ?? 'mcq',
        q: String(x[1] ?? ''),
        choices: Array.isArray(x[2]) ? x[2].map(String) : [],
        correct: Number(x[3]) || 0,
        answer: String(x[4] ?? ''),
      })),
    }
  } catch { return null }
}

/** Past this, a link starts getting truncated by chat apps and old proxies. */
export const LINK_LIMIT = 2000

// --- printing ---------------------------------------------------------------

const INK = '#1a1a1a'
const FAINT = '#8a8a8a'

const rtlOf = (s: string) => /[؀-ۿ]/.test(s)

function text(page: Page, s: string, xMm: number, yMm: number, sizeMm: number, weight = 400, colour = INK, maxMm?: number) {
  const { ctx, px } = page
  ctx.fillStyle = colour
  ctx.direction = rtlOf(s) ? 'rtl' : 'ltr'
  ctx.textAlign = rtlOf(s) ? 'right' : 'left'
  ctx.font = `${weight} ${Math.round(sizeMm * px)}px "IBM Plex Sans Arabic", "Hanken Grotesk", sans-serif`
  const x = rtlOf(s) ? (xMm + (maxMm ?? page.wMm - xMm * 2)) * px : xMm * px
  ctx.fillText(s, x, yMm * px, (maxMm ?? page.wMm - xMm * 2) * px)
}

export interface PrintLabels {
  name: string
  date: string
  score: string
  key: string
  tf: [string, string]
  of: (a: number, b: number) => string
}

export async function buildQuizPdf(quiz: Quiz, labels: PrintLabels, withKey: boolean): Promise<Blob> {
  const pages: Page[] = []
  const M = 18
  let page = newPage(A4)
  let y = 15

  const newSheet = () => { pages.push(page); page = newPage(A4); y = 18 }

  text(page, quiz.title || '—', M, y, 7, 600); y += 12
  text(page, `${labels.name} ________________   ${labels.date} __________   ${labels.score} ____ / ${quiz.questions.length}`, M, y, 3.4, 400, FAINT)
  y += 10

  quiz.questions.forEach((q, i) => {
    const rows = q.kind === 'mcq' ? q.choices.filter((c) => c.trim()).length : q.kind === 'tf' ? 2 : 2
    const needed = 10 + rows * 7
    if (y + needed > page.hMm - 20) newSheet()
    text(page, `${i + 1}. ${q.q}`, M, y, 4.2, 500); y += 8
    if (q.kind === 'mcq') {
      q.choices.filter((c) => c.trim()).forEach((c, k) => {
        text(page, `☐  ${String.fromCharCode(65 + k)}.  ${c}`, M + 6, y, 3.8); y += 7
      })
    } else if (q.kind === 'tf') {
      text(page, `☐  ${labels.tf[0]}      ☐  ${labels.tf[1]}`, M + 6, y, 3.8); y += 7
    } else {
      const { ctx, px } = page
      ctx.strokeStyle = '#cccccc'
      ctx.lineWidth = Math.max(1, 0.25 * px)
      ctx.beginPath(); ctx.moveTo((M + 6) * px, (y + 4) * px); ctx.lineTo((page.wMm - M) * px, (y + 4) * px); ctx.stroke()
      y += 9
    }
    y += 4
  })
  pages.push(page)

  if (withKey) {
    let kp = newPage(A4)
    let ky = 15
    text(kp, `${quiz.title || '—'} — ${labels.key}`, M, ky, 6, 600); ky += 14
    quiz.questions.forEach((q, i) => {
      if (ky > kp.hMm - 20) { pages.push(kp); kp = newPage(A4); ky = 18 }
      text(kp, `${i + 1}. ${answerText(q, labels.tf) || '—'}`, M, ky, 4, 400); ky += 8
    })
    pages.push(kp)
  }

  pages.forEach((p, i) => {
    text(p, labels.of(i + 1, pages.length), M, p.hMm - 14, 3, 400, FAINT)
  })

  return pagesToPdf(pages)
}
