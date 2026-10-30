// Printing for the office suite: the document laid out as real PAGES, once.
//
// The preview and the printout are the SAME document. A preview computed one way
// and a print left to the browser's own pagination is two opinions about where a
// page ends, and the reader only finds out which was right on paper. So the flow
// is laid out at the page's text width in a hidden frame, cut into page-sized
// slices at block boundaries, and every page is a fixed-size box showing its
// slice. The preview shows that document; Print prints it; the library thumbnail
// is its first page.
//
// What it does and does not do, stated so nobody expects a typesetter:
//  - A page ends at the bottom of the last block that fits (a paragraph, a list
//    item, a table row). A single block taller than a page is cut where the page
//    ends, which is the one case a line can be split.
//  - It does not break after a heading: a heading alone at the foot of a page is
//    the commonest pagination fault there is.
//  - An explicit page break ([data-page-break]) always starts a new page.
//  - `fitWidth` scales content wider than the page down to fit, which is what a
//    wide spreadsheet needs; a document is never scaled.

export interface PageSpec { width: number; height: number; landscape?: boolean; margins: { top: number; right: number; bottom: number; left: number } }
export interface FlowInput {
  title: string
  css: string
  body: string
  dir: 'ltr' | 'rtl'
  lang?: string
  page: PageSpec
  fitWidth?: boolean
  /** Running header and footer; `{page}` and `{pages}` are filled in per page. */
  header?: string
  footer?: string
}
/** Pages already made (a slide each): placed one per sheet, scaled to fit it. */
export interface FixedInput { title: string; css?: string; pages: string[]; page: { width: number; height: number }; dir?: 'ltr' | 'rtl' }
export interface Printable { html: string; pages: number; page: { width: number; height: number } }

export const MM = 96 / 25.4
const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** Page size as laid out: landscape swaps the sides, whichever way round they were stored. */
export function pageSize(p: PageSpec): { width: number; height: number } {
  const a = Math.min(p.width, p.height)
  const b = Math.max(p.width, p.height)
  return p.landscape ? { width: b, height: a } : { width: a, height: b }
}

function shell(title: string, dir: string, lang: string | undefined, css: string, page: { width: number; height: number }, body: string): string {
  const w = page.width * MM
  const h = page.height * MM
  return `<!doctype html><html dir="${dir}"${lang ? ` lang="${esc(lang)}"` : ''}><head><meta charset="utf-8"><title>${esc(title)}</title><style>${css}
html,body{margin:0;padding:0;max-width:none}
body{background:#d9dedb;padding:16px 0}
.pv-pg{position:relative;width:${w}px;height:${h}px;margin:0 auto 16px;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.18),0 6px 20px rgba(0,0,0,.10);overflow:hidden;box-sizing:border-box}
.pv-area{position:absolute;overflow:hidden}
.pv-flow{transform-origin:0 0;position:absolute;top:0}
.pv-run{position:absolute;inset-inline:0;font:9pt/1.3 "IBM Plex Sans Arabic",Calibri,Arial,sans-serif;color:#555;text-align:center;white-space:pre-wrap}
@page{size:${page.width}mm ${page.height}mm;margin:0}
@media print{body{background:none;padding:0}.pv-pg{margin:0;box-shadow:none;break-after:page;page-break-after:always}.pv-pg:last-child{break-after:auto;page-break-after:auto}}
</style></head><body>${body}</body></html>`
}

function frame(): HTMLIFrameElement {
  const f = document.createElement('iframe')
  f.setAttribute('aria-hidden', 'true')
  f.tabIndex = -1
  f.style.cssText = 'position:fixed;left:-100000px;top:0;width:2000px;height:2000px;border:0;visibility:hidden'
  document.body.appendChild(f)
  return f
}

async function settled(d: Document): Promise<void> {
  const imgs = [...d.images].map((im) => (im.complete ? Promise.resolve() : new Promise<void>((r) => { im.onload = im.onerror = () => r() })))
  const fonts = (d as Document & { fonts?: { ready: Promise<unknown> } }).fonts?.ready ?? Promise.resolve()
  // Never wait for ever on a font host that is not answering: lay out with what is there.
  await Promise.race([Promise.all([...imgs, fonts]), new Promise((r) => setTimeout(r, 2500))])
}

const BREAKABLE = new Set(['block', 'list-item', 'table', 'table-row', 'flex', 'grid', 'flow-root'])

/** Lay the flow out, cut it into pages, and return the paged document. */
export async function paginate(input: FlowInput): Promise<Printable> {
  const page = pageSize(input.page)
  const m = input.page.margins
  const cw = (page.width - m.left - m.right) * MM
  const ch = (page.height - m.top - m.bottom) * MM
  const f = frame()
  try {
    const d = f.contentDocument!
    d.open()
    d.write(`<!doctype html><html dir="${input.dir}"><head><meta charset="utf-8"><style>${input.css}
html,body{margin:0;padding:0;background:none;max-width:none}#pv-m{width:${cw}px;margin:0;padding:0;display:flow-root}</style></head><body><div id="pv-m" dir="${input.dir}">${input.body}</div></body></html>`)
    d.close()
    await settled(d)
    const root = d.getElementById('pv-m')!
    // Wider than the page: scale down to fit rather than lose the right-hand columns.
    const natural = Math.max(cw, root.scrollWidth)
    const scale = input.fitWidth && natural > cw + 1 ? cw / natural : 1
    if (scale !== 1) root.style.width = `${natural}px`
    const top = root.getBoundingClientRect().top
    const total = root.scrollHeight
    const H = ch / scale
    const cuts: number[] = []
    const forced: number[] = []
    const all = root.querySelectorAll<HTMLElement>('*')
    const cap = Math.min(all.length, 40000)
    const view = d.defaultView!
    for (let i = 0; i < cap; i++) {
      const el = all[i]
      if (el.hasAttribute('data-page-break') || el.classList.contains('page-break')) { forced.push(el.getBoundingClientRect().top - top); continue }
      if (/^H[1-6]$/.test(el.tagName)) continue
      const disp = view.getComputedStyle(el).display
      if (!BREAKABLE.has(disp)) continue
      const r = el.getBoundingClientRect()
      if (r.height <= 0) continue
      cuts.push(r.bottom - top)
    }
    cuts.sort((a, b) => a - b)
    forced.sort((a, b) => a - b)
    const slices: { start: number; end: number }[] = []
    let s = 0
    let guard = 0
    while (s < total - 0.5 && guard++ < 5000) {
      const f1 = forced.find((x) => x > s + 0.5 && x <= s + H)
      let end: number
      if (f1 !== undefined) end = f1
      else if (s + H >= total) end = total
      else {
        let best = -1
        // The last cut that fits, but not one so early that the page is mostly empty.
        for (let i = cuts.length - 1; i >= 0; i--) { const c = cuts[i]; if (c <= s + H && c > s + H * 0.25) { best = c; break } }
        end = best > s ? best : s + H
      }
      slices.push({ start: s, end })
      s = end
      // A forced break starts the next page AT the break.
    }
    if (!slices.length) slices.push({ start: 0, end: 0 })
    const n = slices.length
    const run = (t: string | undefined, i: number) => (t ? esc(t).replace(/\{page\}/g, String(i + 1)).replace(/\{pages\}/g, String(n)) : '')
    const pages = slices.map((sl, i) => {
      const hdr = run(input.header, i)
      const ftr = run(input.footer, i)
      return `<div class="pv-pg" data-page="${i + 1}">`
        + (hdr ? `<div class="pv-run" style="top:${(m.top * MM) / 2 - 8}px;padding:0 ${m.left * MM}px" dir="auto">${hdr}</div>` : '')
        + `<div class="pv-area" style="left:${m.left * MM}px;top:${m.top * MM}px;width:${cw}px;height:${Math.ceil((sl.end - sl.start) * scale)}px">`
        + `<div class="pv-flow" dir="${input.dir}" style="width:${scale === 1 ? cw : natural}px;transform:scale(${scale}) translateY(${-sl.start}px)">${input.body}</div></div>`
        + (ftr ? `<div class="pv-run" style="bottom:${(m.bottom * MM) / 2 - 8}px;padding:0 ${m.left * MM}px" dir="auto">${ftr}</div>` : '')
        + '</div>'
    })
    return { html: shell(input.title, input.dir, input.lang, input.css, page, pages.join('')), pages: n, page }
  } finally { f.remove() }
}

/** Pages that are already pages — a slide each — one to a sheet. */
export function fixedPages(input: FixedInput): Printable {
  const body = input.pages.map((p, i) => `<div class="pv-pg" data-page="${i + 1}">${p}</div>`).join('')
  return { html: shell(input.title, input.dir || 'ltr', undefined, input.css || '', input.page, body), pages: input.pages.length, page: input.page }
}

/** Print a paged document through a hidden frame. */
export function printDocument(p: Printable, testid = 'office-print-frame'): void {
  const f = frame()
  f.setAttribute('data-testid', testid)
  const d = f.contentDocument!
  d.open(); d.write(p.html); d.close()
  window.setTimeout(() => { try { f.contentWindow?.focus(); f.contentWindow?.print() } catch { /* */ } window.setTimeout(() => f.remove(), 60_000) }, 300)
}

/**
 * The first page as a small picture, for the library. Drawn by the browser from
 * the paged document itself (an SVG foreignObject onto a canvas), so it is the
 * page as it prints — not a sketch of it. Fonts the page loads from the web are
 * not available inside that picture; the browser's own fallback stands in, which
 * at thumbnail size is invisible.
 */
export async function pageThumbnail(p: Printable, width = 240): Promise<string | undefined> {
  const f = frame()
  try {
    const d = f.contentDocument!
    d.open(); d.write(p.html); d.close()
    await settled(d)
    const pg = d.querySelector('.pv-pg') as HTMLElement | null
    if (!pg) return undefined
    const w = p.page.width * MM
    const h = p.page.height * MM
    const css = [...d.querySelectorAll('style')].map((s) => s.textContent || '').join('\n')
    const clone = pg.cloneNode(true) as HTMLElement
    clone.style.margin = '0'
    clone.style.boxShadow = 'none'
    const xhtml = new XMLSerializer().serializeToString(clone)
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><foreignObject width="100%" height="100%"><div xmlns="http://www.w3.org/1999/xhtml" dir="${d.documentElement.dir || 'ltr'}"><style>${esc(css).replace(/&quot;/g, '"').replace(/&gt;/g, '>')}</style>${xhtml}</div></foreignObject></svg>`
    const img = new Image()
    img.decoding = 'async'
    const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
    await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = () => rej(new Error('thumbnail')); img.src = url })
    const c = document.createElement('canvas')
    c.width = width
    c.height = Math.round((width * h) / w)
    const g = c.getContext('2d')!
    g.fillStyle = '#fff'
    g.fillRect(0, 0, c.width, c.height)
    g.drawImage(img, 0, 0, c.width, c.height)
    return c.toDataURL('image/jpeg', 0.82)
  } catch { return undefined } finally { f.remove() }
}
