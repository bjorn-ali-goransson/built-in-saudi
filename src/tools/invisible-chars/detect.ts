// Characters that are present in text but not visible. They arrive from copied
// web pages, PDFs, Word, LLM output and — occasionally — deliberately, and they
// break exact matching, search, diffing and password fields in ways that look
// like a bug in your code rather than a problem with the string.

export type Category = 'zeroWidth' | 'bidi' | 'space' | 'control' | 'variation' | 'lineSep'

export interface Finding {
  index: number
  code: number
  name: string
  category: Category
}

interface Entry { name: string; category: Category }

const TABLE: Record<number, Entry> = {
  0x00ad: { name: 'Soft hyphen', category: 'zeroWidth' },
  0x200b: { name: 'Zero-width space', category: 'zeroWidth' },
  0x200c: { name: 'Zero-width non-joiner', category: 'zeroWidth' },
  0x200d: { name: 'Zero-width joiner', category: 'zeroWidth' },
  0x2060: { name: 'Word joiner', category: 'zeroWidth' },
  0xfeff: { name: 'Byte-order mark', category: 'zeroWidth' },
  0x200e: { name: 'Left-to-right mark', category: 'bidi' },
  0x200f: { name: 'Right-to-left mark', category: 'bidi' },
  0x202a: { name: 'LTR embedding', category: 'bidi' },
  0x202b: { name: 'RTL embedding', category: 'bidi' },
  0x202c: { name: 'Pop directional formatting', category: 'bidi' },
  0x202d: { name: 'LTR override', category: 'bidi' },
  0x202e: { name: 'RTL override', category: 'bidi' },
  0x2066: { name: 'LTR isolate', category: 'bidi' },
  0x2067: { name: 'RTL isolate', category: 'bidi' },
  0x2068: { name: 'First-strong isolate', category: 'bidi' },
  0x2069: { name: 'Pop directional isolate', category: 'bidi' },
  0x00a0: { name: 'Non-breaking space', category: 'space' },
  0x1680: { name: 'Ogham space mark', category: 'space' },
  0x2000: { name: 'En quad', category: 'space' },
  0x2001: { name: 'Em quad', category: 'space' },
  0x2002: { name: 'En space', category: 'space' },
  0x2003: { name: 'Em space', category: 'space' },
  0x2004: { name: 'Three-per-em space', category: 'space' },
  0x2005: { name: 'Four-per-em space', category: 'space' },
  0x2006: { name: 'Six-per-em space', category: 'space' },
  0x2007: { name: 'Figure space', category: 'space' },
  0x2008: { name: 'Punctuation space', category: 'space' },
  0x2009: { name: 'Thin space', category: 'space' },
  0x200a: { name: 'Hair space', category: 'space' },
  0x202f: { name: 'Narrow no-break space', category: 'space' },
  0x205f: { name: 'Medium mathematical space', category: 'space' },
  0x3000: { name: 'Ideographic space', category: 'space' },
  0x2028: { name: 'Line separator', category: 'lineSep' },
  0x2029: { name: 'Paragraph separator', category: 'lineSep' },
  0xfe0e: { name: 'Text presentation selector', category: 'variation' },
  0xfe0f: { name: 'Emoji presentation selector', category: 'variation' },
}

export function inspect(text: string): Finding[] {
  const out: Finding[] = []
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i)
    const entry = TABLE[code]
    if (entry) { out.push({ index: i, code, name: entry.name, category: entry.category }); continue }
    // Any other C0/C1 control character except tab, newline and carriage return.
    if ((code < 0x20 && ![9, 10, 13].includes(code)) || (code >= 0x7f && code <= 0x9f)) {
      out.push({ index: i, code, name: `Control character`, category: 'control' })
    }
  }
  return out
}

export interface StripOptions {
  zeroWidth: boolean
  bidi: boolean
  control: boolean
  lineSep: boolean
  /** Convert exotic spaces to a plain one rather than deleting them. */
  normalizeSpaces: boolean
  /** Variation selectors change how emoji render — removing them is usually wrong. */
  variation: boolean
}

export const DEFAULT_STRIP: StripOptions = {
  zeroWidth: true, bidi: true, control: true, lineSep: true,
  normalizeSpaces: true, variation: false,
}

export function strip(text: string, o: StripOptions): string {
  let out = ''
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i)
    const entry = TABLE[code]
    const isControl = (code < 0x20 && ![9, 10, 13].includes(code)) || (code >= 0x7f && code <= 0x9f)
    const cat: Category | null = entry ? entry.category : isControl ? 'control' : null
    if (!cat) { out += text[i]; continue }
    if (cat === 'space') { out += o.normalizeSpaces ? ' ' : text[i]; continue }
    if (cat === 'lineSep') { out += o.lineSep ? '\n' : text[i]; continue }
    if (cat === 'zeroWidth' && o.zeroWidth) continue
    if (cat === 'bidi' && o.bidi) continue
    if (cat === 'control' && o.control) continue
    if (cat === 'variation' && o.variation) continue
    out += text[i]
  }
  return out
}

export const CATEGORY_LABEL: Record<Category, { en: string; ar: string }> = {
  zeroWidth: { en: 'Zero-width', ar: 'بعرض صفري' },
  bidi: { en: 'Direction control', ar: 'تحكّم الاتجاه' },
  space: { en: 'Unusual space', ar: 'مسافة غير عادية' },
  control: { en: 'Control character', ar: 'محرف تحكّم' },
  variation: { en: 'Variation selector', ar: 'محدّد شكل' },
  lineSep: { en: 'Line separator', ar: 'فاصل سطر' },
}

export const hex = (code: number) => `U+${code.toString(16).toUpperCase().padStart(4, '0')}`
