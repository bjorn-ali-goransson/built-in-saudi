// How the presentation editor reads and writes files. Every conversion runs in
// the shared office worker, so a deck with a hundred photos unzips without
// freezing the page.
import { office } from '../../lib/office/officeClient'
import type { EditorKit } from '../../components/office/hooks'
import { blankDeck, usedMedia, slideTitle, type DeckData } from './model'
import { lossText, SL_STR } from './strings'

type Loss = { what: string; count: number }
const extOf = (n: string) => (n.match(/\.[a-z0-9]+$/i)?.[0] || '').toLowerCase()

/** The deck without media nothing points at any more — a deleted picture is not saved forever. */
export function pruned(d: DeckData): DeckData {
  const used = usedMedia(d)
  const media: DeckData['media'] = {}
  for (const k of Object.keys(d.media)) if (used.has(k)) media[k] = d.media[k]
  return { ...d, media }
}

export function slidesKit(locale: 'en' | 'ar'): EditorKit<DeckData> {
  const s = SL_STR[locale]
  const L = (l: Loss[]) => l.map((x) => lossText(x, locale))
  return {
    kind: 'powerpoint',
    tool: 'powerpoint-editor',
    formats: [{ ext: '.pptx', label: s.pptx }, { ext: '.md', label: s.markdown }],
    accepts: ['.pptx', '.pptm', '.potx', '.ppsx', '.odp', '.md', '.markdown', '.txt'],
    blank: () => blankDeck(locale === 'ar'),
    async exportAs(deck, ext, title) {
      if (ext === '.md') {
        const text = await office<string>('outline-write', { data: deck })
        const lossy = deck.slides.some((x) => x.elements.some((e) => e.kind === 'image' || e.kind === 'table' || (e.kind === 'shape' && !e.text)))
        return { blob: new Blob([text], { type: 'text/markdown;charset=utf-8' }), loss: lossy ? L([{ what: 'pictures, tables and layout (an outline holds titles and text only)', count: 1 }]) : [] }
      }
      const r = await office<{ blob: Blob; loss: Loss[] }>('pptx-write', { data: pruned(deck), opts: { title } })
      return { blob: r.blob, loss: L(r.loss) }
    },
    async importFile(file) {
      const buf = await file.arrayBuffer()
      const ext = extOf(file.name)
      const op = ext === '.md' || ext === '.markdown' || ext === '.txt' ? 'outline-read' : ext === '.odp' ? 'odp-read' : 'pptx-read'
      const r = await office<{ data: DeckData; loss: Loss[]; title: string }>(op, { buf })
      return { data: r.data, loss: L(r.loss), title: r.title || slideTitle(r.data.slides[0] || { id: '', elements: [] }) || undefined }
    },
    thumb: (deck) => thumbnail(deck),
  }
}

/** The first slide as a tiny picture for the library: background, boxes and the title. */
export function thumbnail(d: DeckData): string | undefined {
  const s = d.slides[0]
  if (!s) return undefined
  const W = 240
  const k = W / d.size.w
  const H = Math.round(d.size.h * k)
  const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const col = (p: string | undefined, f: string) => (!p ? f : p.startsWith('#') ? p : (d.theme.colors as Record<string, string>)[p] || f)
  const bg = s.bg?.type === 'solid' ? col(s.bg.color, '#fff') : col('lt1', '#fff')
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="100%" height="100%" fill="${esc(bg)}"/>`
  for (const e of s.elements) {
    const x = e.x * k, y = e.y * k, w = e.w * k, h = e.h * k
    if (e.kind === 'shape' && e.fill?.type === 'solid') svg += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${esc(col(e.fill.color, '#ccc'))}"${e.geom === 'ellipse' ? ` rx="${w / 2}" ry="${h / 2}"` : ''}/>`
    if (e.kind === 'image' && d.media[e.media]) svg += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#cfd8d3"/>`
    if (e.kind === 'table') svg += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="#999"/>`
    if (e.kind === 'shape' && e.text) {
      const t = e.text.paras.map((p) => p.runs.map((r) => r.t).join('')).join(' ').slice(0, 40)
      const size = Math.max(5, Math.min(18, (e.text.paras[0]?.runs[0]?.size || e.text.defaults?.size || 18) * k))
      if (t) svg += `<text x="${x + w / 2}" y="${y + h / 2 + size / 3}" font-size="${size}" font-family="sans-serif" text-anchor="middle" fill="${esc(col(e.text.defaults?.color, '#222'))}"${e.text.defaults?.b ? ' font-weight="700"' : ''}>${esc(t)}</text>`
    }
  }
  svg += '</svg>'
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
}
