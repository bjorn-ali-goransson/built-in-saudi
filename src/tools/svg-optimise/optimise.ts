// SVG optimisation, without SVGO.
//
// SVGO is the right answer for a build pipeline and the wrong one here: it is a
// large Node-oriented dependency, and the plugins that actually win the bytes
// are a handful of transforms that are safe to write out. Everything below is
// conservative — an optimiser that shrinks a file by 60% and breaks the artwork
// is worse than one that shrinks it by 40% and never does.
//
// What is deliberately NOT done: merging paths, converting shapes to paths, or
// removing "unused" ids. Each of those breaks real files (CSS hooks, JS
// references, `<use>` targets) and the failures are silent.

export interface OptimiseOptions {
  /** Editor cruft: Inkscape/Illustrator/Figma namespaces and metadata. */
  stripEditor: boolean
  comments: boolean
  /** <title>/<desc> — removing them costs accessibility, so it is opt-in. */
  stripTitles: boolean
  /** Decimal places to keep in path and coordinate numbers. */
  precision: number
  /** Collapse whitespace between elements. */
  minifyWhitespace: boolean
  /** Drop width/height when a viewBox exists, so the SVG scales to its container. */
  responsive: boolean
  stripIds: boolean
}

export const DEFAULTS: OptimiseOptions = {
  stripEditor: true, comments: true, stripTitles: false,
  precision: 2, minifyWhitespace: true, responsive: false, stripIds: false,
}

export interface Result {
  svg: string
  before: number
  after: number
  notes: string[]
}

/** Round every number in a path/points/transform string. */
function roundNumbers(text: string, precision: number): string {
  return text.replace(/-?\d*\.\d+(?:e[-+]?\d+)?/gi, (m) => {
    const n = Number(m)
    if (!Number.isFinite(n)) return m
    const r = Number(n.toFixed(precision))
    // Drop the leading zero: "0.5" → ".5" is valid in path data and saves a byte
    // per number, which across a complex path is real.
    return String(r).replace(/^(-?)0\./, '$1.')
  })
}

const NUMERIC_ATTRS = /^(d|points|transform|gradientTransform|x|y|x1|y1|x2|y2|cx|cy|r|rx|ry|width|height|stroke-width|offset|viewBox)$/

const EDITOR_NS = ['inkscape', 'sodipodi', 'sketch', 'figma', 'adobe', 'illustrator', 'graph', 'i', 'x']

export function optimise(input: string, o: OptimiseOptions): Result {
  const before = new TextEncoder().encode(input).length
  const notes: string[] = []

  const doc = new DOMParser().parseFromString(input, 'image/svg+xml')
  if (doc.querySelector('parsererror')) {
    return { svg: input, before, after: before, notes: ['parse-error'] }
  }
  const root = doc.documentElement
  if (root.tagName.toLowerCase() !== 'svg') {
    return { svg: input, before, after: before, notes: ['not-svg'] }
  }

  const walk = (node: Element) => {
    // Attributes first, on a copy — removing during iteration skips entries.
    for (const attr of [...node.attributes]) {
      const name = attr.name
      const local = name.includes(':') ? name.split(':')[0] : ''

      if (o.stripEditor && (EDITOR_NS.includes(local) || name.startsWith('xmlns:') && EDITOR_NS.includes(name.slice(6)))) {
        node.removeAttribute(name)
        continue
      }
      if (o.stripIds && name === 'id' && !input.includes(`#${attr.value}`) && !input.includes(`"${attr.value}"`)) {
        // Only when nothing in the file appears to reference it — a URL(#id),
        // a <use href>, or a CSS selector would all break otherwise.
        node.removeAttribute(name)
        continue
      }
      if (NUMERIC_ATTRS.test(name)) {
        const rounded = roundNumbers(attr.value, o.precision)
          .replace(/\s+/g, ' ')
          .replace(/\s*,\s*/g, ',')
          .trim()
        if (rounded !== attr.value) node.setAttribute(name, rounded)
      }
      // A style attribute holding only what a presentation attribute could say
      // is left alone: rewriting it is where "optimisers" break rendering order.
    }
    for (const child of [...node.children]) walk(child)
  }
  walk(root)

  // Remove nodes by type.
  const removeAll = (selector: string) => {
    const found = doc.querySelectorAll(selector)
    found.forEach((n) => n.remove())
    return found.length
  }
  if (o.stripEditor) {
    const n = removeAll('metadata')
    if (n) notes.push(`metadata:${n}`)
    // Editor-only elements live in their own namespace.
    for (const el of [...doc.getElementsByTagName('*')]) {
      const name = el.tagName.toLowerCase()
      if (name.includes(':') && EDITOR_NS.includes(name.split(':')[0])) el.remove()
    }
  }
  if (o.stripTitles) {
    const n = removeAll('title, desc')
    if (n) notes.push(`titles:${n}`)
  }
  // Empty groups carry nothing and are common editor debris.
  let emptied = 0
  for (const g of [...doc.querySelectorAll('g')]) {
    if (!g.children.length && !g.textContent?.trim()) { g.remove(); emptied++ }
  }
  if (emptied) notes.push(`empty-groups:${emptied}`)

  if (o.responsive && root.getAttribute('viewBox')) {
    if (root.hasAttribute('width') || root.hasAttribute('height')) {
      root.removeAttribute('width')
      root.removeAttribute('height')
      notes.push('responsive')
    }
  }

  let out = new XMLSerializer().serializeToString(doc)

  if (o.comments) out = out.replace(/<!--[\s\S]*?-->/g, '')
  if (o.minifyWhitespace) {
    out = out.replace(/>\s+</g, '><').replace(/\s{2,}/g, ' ').trim()
  }
  // The XML declaration is optional for inline and <img> use alike.
  out = out.replace(/^<\?xml[^>]*\?>\s*/, '')

  return { svg: out, before, after: new TextEncoder().encode(out).length, notes }
}

/** Does it still parse and still contain drawable content? */
export function stillValid(svg: string): boolean {
  const doc = new DOMParser().parseFromString(svg, 'image/svg+xml')
  if (doc.querySelector('parsererror')) return false
  const root = doc.documentElement
  if (root.tagName.toLowerCase() !== 'svg') return false
  return !!root.querySelector('path, rect, circle, ellipse, line, polyline, polygon, text, image, use')
}
