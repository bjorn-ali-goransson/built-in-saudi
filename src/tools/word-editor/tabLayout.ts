// Tab stops, drawn. CSS has no tab stops: a tab character in `white-space: pre-wrap`
// advances to the next multiple of `tab-size` and that is all. So a CV's
// "Senior Analyst, Acme <TAB> 2018 – Present", with a right-aligned stop at the
// margin, came out as the date one tab-width after the company name instead of
// flush right, in the editor and in print alike.
//
// The fix is a measurement, run after layout: every tab in a paragraph that has
// stops is a `span.wd-tab`, and each is sized so the text after it starts (left
// stop), ends (right, decimal) or centres (centre) at its stop. Positions are
// from the start of the text column — the margin, not the paragraph's indent —
// as Word measures them. One function, used by the editor and by the printout,
// so the two cannot disagree about where a date ends.
import type { TabStop } from './schema'

const PX_PER_PT = 96 / 72
/** Word's default stops, every half inch past the last explicit one. */
const DEFAULT_STEP = 36 * PX_PER_PT

export function layoutTabs(root: ParentNode): void {
  for (const p of Array.from(root.querySelectorAll<HTMLElement>('[data-tabs]'))) layoutParagraph(p)
}

function layoutParagraph(p: HTMLElement) {
  let stops: TabStop[]
  try { stops = (JSON.parse(p.dataset.tabs || '[]') as TabStop[]).slice().sort((a, b) => a.pos - b.pos) } catch { return }
  const tabs = Array.from(p.querySelectorAll<HTMLElement>('.wd-tab'))
  if (!tabs.length) return
  const cs = getComputedStyle(p)
  const rtl = cs.direction === 'rtl'
  // A zoomed page (the editor scales on a phone): measure in the page's own pixels.
  const scale = p.offsetWidth ? p.getBoundingClientRect().width / p.offsetWidth : 1
  const rect = p.getBoundingClientRect()
  const indent = parseFloat(rtl ? cs.marginRight : cs.marginLeft) || 0
  // The text column's start edge: the paragraph's edge, less its indent.
  const origin = rtl ? rect.right + indent * scale : rect.left - indent * scale
  const along = (x: number) => (rtl ? origin - x : x - origin) / scale
  for (const t of tabs) { t.style.display = 'inline-block'; t.style.width = '0px'; t.style.whiteSpace = 'pre'; t.style.overflow = 'hidden'; t.style.verticalAlign = 'baseline' }
  tabs.forEach((t, i) => {
    const r = t.getBoundingClientRect()
    const at = along(rtl ? r.right : r.left)
    const stop = stops.find((s) => s.pos * PX_PER_PT > at + 1)
    const pos = stop ? stop.pos * PX_PER_PT : (Math.floor(at / DEFAULT_STEP) + 1) * DEFAULT_STEP
    const align = stop?.align || 'left'
    let seg = 0
    if (align !== 'left') {
      // The run of text this stop aligns: up to the next tab or the end of the line.
      const range = document.createRange()
      range.setStartAfter(t)
      if (tabs[i + 1]) range.setEndBefore(tabs[i + 1])
      else range.setEnd(p, p.childNodes.length)
      seg = range.getBoundingClientRect().width / scale
    }
    const target = align === 'right' || align === 'decimal' ? pos - seg : align === 'center' ? pos - seg / 2 : pos
    t.style.width = `${Math.max(2, target - at)}px`
    if (stop?.leader) t.style.borderBottom = `1px ${stop.leader === 'dot' ? 'dotted' : stop.leader === 'hyphen' ? 'dashed' : 'solid'} currentColor`
  })
}
