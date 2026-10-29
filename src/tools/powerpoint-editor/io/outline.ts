// A deck as an OUTLINE, in Markdown: one `# Title` per slide, its bullets as a
// list (nested by indentation), speaker notes as a quote, and `---` between
// slides. It is the format people already draft talks in, so importing one is
// the fastest way from notes to slides — and exporting one gets the words out
// of a deck for a handout or a script.
import { blankDeck, newSlide, para, plainText, type DeckData, type Para, type Run, type ShapeEl, type Slide } from '../model'
import { spread } from '../order'

/** Inline Markdown → runs: **bold**, *italic*, `code`, [text](url). */
function runs(src: string): Run[] {
  const out: Run[] = []
  const re = /(\*\*([^*]+)\*\*|__([^_]+)__|\*([^*]+)\*|_([^_]+)_|`([^`]+)`|\[([^\]]+)\]\(([^)\s]+)\))/g
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(src))) {
    if (m.index > last) out.push({ t: src.slice(last, m.index) })
    if (m[2] || m[3]) out.push({ t: m[2] || m[3], b: true })
    else if (m[4] || m[5]) out.push({ t: m[4] || m[5], i: true })
    else if (m[6]) out.push({ t: m[6], font: 'Courier New' })
    else if (m[7]) out.push({ t: m[7], link: /^(https?:|mailto:)/i.test(m[8]) ? m[8] : undefined })
    last = m.index + m[0].length
  }
  if (last < src.length) out.push({ t: src.slice(last) })
  return out.filter((r) => r.t)
}
const isRtl = (t: string) => /^[^A-Za-z]*[؀-ۿ]/.test(t)

export function fromOutline(md: string): DeckData {
  const text = md.replace(/\r\n?/g, '\n')
  const rtl = (text.match(/[؀-ۿ]/g) || []).length > (text.match(/[A-Za-z]/g) || []).length
  const deck = blankDeck(rtl)
  deck.slides = []
  // Slides are split by `---` lines, or by every top-level heading when there are none.
  const chunks = /^\s*(---|\*\*\*)\s*$/m.test(text) ? text.split(/^\s*(?:---|\*\*\*)\s*$/m) : text.split(/^(?=#\s)/m)
  for (const chunk of chunks) {
    const lines = chunk.split('\n')
    if (!lines.some((l) => l.trim())) continue
    let title = ''
    let sub = ''
    const body: Para[] = []
    const notes: string[] = []
    for (const line of lines) {
      const h = /^(#{1,3})\s+(.*)$/.exec(line)
      if (h && !title) { title = h[2].trim(); continue }
      if (h) { sub = sub || h[2].trim(); continue }
      const q = /^\s*>\s?(.*)$/.exec(line)
      if (q) { notes.push(q[1]); continue }
      const li = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/.exec(line)
      if (li) {
        const level = Math.min(4, Math.floor(li[1].replace(/\t/g, '  ').length / 2))
        body.push(para('', { runs: runs(li[3]), bullet: /\d/.test(li[2]) ? 'number' : 'bullet', level: level || undefined, rtl: isRtl(li[3]) || undefined }))
        continue
      }
      if (line.trim()) body.push(para('', { runs: runs(line.trim()), bullet: null, rtl: isRtl(line) || undefined }))
    }
    const first = deck.slides.length === 0
    const kind = first && !body.some((p) => p.bullet) && body.length <= 2 ? 'title' : body.length ? 'titleContent' : 'section'
    const s: Slide = newSlide(kind, deck)
    const phs = s.elements.filter((e): e is ShapeEl => e.kind === 'shape' && !!e.ph)
    const set = (el: ShapeEl | undefined, paras: Para[]) => { if (el?.text) el.text = { ...el.text, paras: paras.length ? paras.map((p) => ({ ...p, align: el.text!.paras[0]?.align ?? p.align, rtl: p.rtl ?? el.text!.paras[0]?.rtl })) : el.text.paras } }
    set(phs[0], title ? [para('', { runs: runs(title), rtl: isRtl(title) || undefined })] : [])
    if (kind === 'title' || kind === 'section') set(phs[1], sub ? [para(sub, { bullet: null })] : body.map((p) => ({ ...p, bullet: null })))
    else set(phs[1], body.length ? body : sub ? [para(sub)] : [])
    if (notes.length) s.notes = notes.join('\n').trim()
    deck.slides.push(s)
  }
  if (!deck.slides.length) deck.slides.push(newSlide('title', deck))
  const keys = spread(deck.slides.length)
  deck.slides.forEach((s, i) => (s.ord = keys[i]))
  return deck
}

function mdRuns(rs: Run[]): string {
  return rs.map((r) => {
    if (r.t === '\n') return ' '
    let t = r.t.replace(/([*_`[\]])/g, '\\$1')
    if (r.b) t = `**${t}**`
    if (r.i) t = `*${t}*`
    if (r.link && !r.link.startsWith('#')) t = `[${t}](${r.link})`
    return t
  }).join('')
}

export function toOutline(d: DeckData): string {
  const out: string[] = []
  d.slides.forEach((s, i) => {
    if (i) out.push('', '---', '')
    const shapes = s.elements.filter((e): e is ShapeEl => e.kind === 'shape' && !!e.text)
    const title = shapes.find((e) => e.ph === 'title' || e.ph === 'ctrTitle')
    out.push(`# ${title ? mdRuns(title.text!.paras.flatMap((p) => p.runs)) || '' : ''}`.trimEnd())
    for (const e of shapes) {
      if (e === title) continue
      for (const p of e.text!.paras) {
        const t = mdRuns(p.runs)
        if (!t.trim()) continue
        const pad = '  '.repeat(p.level || 0)
        out.push(p.bullet === 'number' ? `${pad}1. ${t}` : p.bullet ? `${pad}- ${t}` : `${pad}${t}`)
      }
    }
    for (const e of s.elements) if (e.kind === 'table') for (const r of e.rows) out.push('', '| ' + r.cells.map((c) => (c.merged ? '' : plainText(c.text).replace(/\|/g, '\\|'))).join(' | ') + ' |')
    if (s.notes?.trim()) out.push('', ...s.notes.trim().split('\n').map((l) => `> ${l}`))
  })
  return out.join('\n') + '\n'
}
