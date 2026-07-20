// A lean, dependency-free SVG optimiser (SVGOMG-style, sane defaults) that runs
// entirely in the browser via DOMParser/XMLSerializer. It drops editor cruft
// (comments, <metadata>, inkscape/sodipodi/illustrator namespaces), collapses
// whitespace, and rounds coordinates — the big wins — without pulling in SVGO.

const EDITOR_NS = ['inkscape', 'sodipodi', 'sketch', 'figma', 'adobe', 'illustrator', 'krita', 'serif', 'vectornator']

const round = (n: number, d: number) => { const f = 10 ** d; return Math.round(n * f) / f }

// Round every number in a string (path data, transforms, viewBox, styles).
function roundNums(s: string, d: number): string {
  return s.replace(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi, (m) => {
    const n = Number(m)
    return Number.isFinite(n) ? String(round(n, d)) : m
  })
}

function clean(el: Element, d: number) {
  for (const child of Array.from(el.childNodes)) {
    if (child.nodeType === 8 /* comment */) { child.remove(); continue }
    if (child.nodeType === 3 /* text */ && !(child.textContent || '').trim()) { child.remove(); continue }
    if (child.nodeType === 1 /* element */) {
      const e = child as Element
      const name = e.nodeName.toLowerCase()
      if (name === 'metadata' || EDITOR_NS.some((ns) => name.startsWith(ns + ':'))) { e.remove(); continue }
      clean(e, d)
    }
  }
  for (const attr of Array.from(el.attributes)) {
    const n = attr.name.toLowerCase()
    if (EDITOR_NS.some((ns) => n.startsWith(ns + ':') || n === `xmlns:${ns}`)) { el.removeAttribute(attr.name); continue }
    const v = attr.value
    if (n === 'd' || n === 'points' || n === 'transform' || n === 'viewbox' || n === 'style' || n === 'gradienttransform') {
      el.setAttribute(attr.name, roundNums(v, d)); continue
    }
    if (/^-?\d*\.?\d+$/.test(v.trim())) el.setAttribute(attr.name, String(round(Number(v), d)))
  }
}

export interface OptResult { ok: boolean; svg: string; before: number; after: number }

const bytes = (s: string) => new TextEncoder().encode(s).length

/** Optimise `src`. On invalid input, returns the trimmed source unchanged with ok:false. */
export function optimizeSvg(src: string, decimals = 2): OptResult {
  const before = bytes(src)
  const trimmed = src.trim()
  try {
    const doc = new DOMParser().parseFromString(trimmed, 'image/svg+xml')
    const root = doc.documentElement
    if (doc.querySelector('parsererror') || !root || root.nodeName.toLowerCase() !== 'svg') {
      return { ok: false, svg: trimmed, before, after: before }
    }
    clean(root, decimals)
    let out = new XMLSerializer().serializeToString(root)
    out = out.replace(/<\?xml[^>]*\?>/g, '').replace(/>\s+</g, '><').replace(/[ \t]{2,}/g, ' ').trim()
    return { ok: true, svg: out, before, after: bytes(out) }
  } catch {
    return { ok: false, svg: trimmed, before, after: before }
  }
}
