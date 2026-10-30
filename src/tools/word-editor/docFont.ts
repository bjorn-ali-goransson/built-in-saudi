// The document's own face and size, for the editor and the printed page alike.
//
// A Word document's body text carries no formatting of its own: it is drawn in the document's
// default face at its default size. Drawing it in the editor's face instead reflows every line, so
// both the screen and the paper are set in the document's face — with the metric-compatible open
// face after it, so a machine without Calibri still breaks the lines where Calibri would.
//
// "Single" line spacing is the FONT's line (ascent + descent + gap), which differs by face: 1.22 em
// for Calibri, 1.15 for Times New Roman. `--wd-lh` carries it for multiples (1.15, 1.5, double),
// measured here in the browser in the face actually drawn.

/** Faces with a metric-compatible open twin: same advance widths, same vertical metrics. */
const TWIN: Record<string, string> = {
  calibri: 'Carlito', cambria: 'Caladea', arial: 'Liberation Sans', helvetica: 'Liberation Sans',
  'times new roman': 'Liberation Serif', times: 'Liberation Serif', 'courier new': 'Liberation Mono',
}
const SERIF = /times|cambria|georgia|garamond|book antiqua|palatino|serif|caladea|minion|baskerville|traditional arabic|amiri|naskh/i
const MONO = /courier|consolas|mono|menlo/i

export function fontStack(face?: string): string | undefined {
  if (!face) return undefined
  const q = (f: string) => `"${f.replace(/"/g, '')}"`
  const twin = TWIN[face.toLowerCase()]
  const generic = MONO.test(face) ? 'monospace' : SERIF.test(face) ? 'serif' : 'sans-serif'
  // Arabic falls through to the site's Arabic face whatever the Latin face is.
  return [q(face), twin && q(twin), '"IBM Plex Sans Arabic"', generic].filter(Boolean).join(',')
}

export interface DocFace { font?: string; fontCs?: string; size?: number; rtl?: boolean }

/** CSS custom properties for a document's face and size; the editor and print read them. */
export function faceVars(d: DocFace): Record<string, string> {
  const out: Record<string, string> = {}
  const stack = fontStack(d.rtl ? d.fontCs || d.font : d.font)
  if (stack) out['--wd-font'] = stack
  if (d.size) out['--wd-size'] = `${d.size}pt`
  return out
}
export const varsCss = (v: Record<string, string>) => Object.entries(v).map(([k, x]) => `${k}:${x}`).join(';')

/** A face's variable name: the measured single line of each face the document uses lives on the root. */
export const faceSlug = (face: string) => face.toLowerCase().replace(/[^a-z0-9\u0600-\u06ff]+/g, '-').replace(/^-|-$/g, '') || 'x'

/**
 * A run in a face of its own: the face (with its metric twin), and that face's single line — Word
 * sizes a line from the faces ON it, so a heading set in Cambria in a Calibri document is not
 * spaced as Calibri. The paragraph supplies the multiple (--wd-m); docCss multiplies them.
 */
export function runFaceCss(face: string): string[] {
  return [`font-family:${fontStack(face)}`, `--wd-lhf:var(--wd-lh-${faceSlug(face)},var(--wd-lh,1.2))`]
}

/** Every face a document's runs name, from its JSON. */
export function facesIn(node: unknown, out = new Set<string>()): Set<string> {
  const n = node as { marks?: { type: string; attrs?: { font?: string | null } }[]; content?: unknown[]; attrs?: { paraFont?: string | null } }
  for (const m of n?.marks || []) if (m.type === 'textStyle' && m.attrs?.font) out.add(m.attrs.font)
  if (n?.attrs?.paraFont) out.add(n.attrs.paraFont)
  for (const c of n?.content || []) facesIn(c, out)
  return out
}
/** The measured single line of each face, as root variables. */
export function faceLineVars(faces: Iterable<string>, doc?: Document): Record<string, string> {
  const out: Record<string, string> = {}
  for (const f of faces) out[`--wd-lh-${faceSlug(f)}`] = String(lineFactor(fontStack(f), doc))
  return out
}

const cache = new Map<string, number>()
/** The face's single line, in em, as this browser draws it; 1.2 where there is no DOM to ask. */
export function lineFactor(stack: string | undefined, doc: Document | undefined = typeof document === 'undefined' ? undefined : document): number {
  // Keyed by document too: the print frame has the system's faces and not the site's web fonts,
  // so the same stack can resolve to a different face there.
  const key = (doc === (typeof document === 'undefined' ? undefined : document) ? '' : 'frame:') + (stack || '')
  const hit = cache.get(key)
  if (hit) return hit
  if (!doc || !doc.body) return 1.2
  const el = doc.createElement('div')
  // At a large size, where rounding the ascent and descent to whole pixels costs a tenth of a per cent.
  el.style.cssText = `position:absolute;visibility:hidden;left:-9999px;top:0;white-space:nowrap;font-size:1000px;line-height:normal;font-family:${stack || '"IBM Plex Sans Arabic",sans-serif'}`
  el.textContent = 'Hg'
  doc.body.appendChild(el)
  const h = el.getBoundingClientRect().height / 1000
  el.remove()
  const f = h > 0.8 && h < 2.5 ? Math.round(h * 1000) / 1000 : 1.2
  cache.set(key, f)
  return f
}
