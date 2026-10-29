// A small, worker-safe XML parser and writer.
//
// Every Office format is XML inside a ZIP, and the editors convert them in a Web
// Worker so a 20MB workbook never freezes the page (#154). A worker has no
// DOMParser, so this is the parser: a single pass over the string producing a
// plain tree, with namespaces RESOLVED rather than read off the prefix.
//
// Resolving matters more than it looks. Word, Excel and PowerPoint all write the
// conventional prefixes (`w:`, `a:`, `p:`), but nothing in the format requires
// them — a file saved by another producer can bind the spreadsheet namespace to
// `x:` or to the default namespace, and a reader matching the literal `w:p`
// silently reads an empty document. So lookups go by namespace URI + local name.
//
// What it deliberately does not do: DTDs, external entities, validation. Office
// files carry none, and an XML parser that fetches external entities is a
// well-known way to read files you did not mean to.

export interface XEl {
  /** Qualified name exactly as written, e.g. `w:p`. */
  name: string
  /** Local part, e.g. `p`. */
  local: string
  /** Resolved namespace URI ('' when none). */
  ns: string
  /** Attributes by qualified name as written. */
  attrs: Record<string, string>
  /** Attributes keyed `{uri}local` (or bare `local` when unprefixed). */
  nattrs: Record<string, string>
  children: XNode[]
  parent?: XEl
}
export type XNode = XEl | string

const ENT: Record<string, string> = { lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" }

export function decodeEntities(s: string): string {
  if (s.indexOf('&') < 0) return s
  return s.replace(/&(#x[0-9a-fA-F]+|#[0-9]+|[a-zA-Z]+);/g, (m, e: string) => {
    if (e[0] === '#') {
      const cp = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)
      if (!Number.isFinite(cp) || cp < 0 || cp > 0x10ffff) return m
      try { return String.fromCodePoint(cp) } catch { return m }
    }
    return ENT[e] ?? m
  })
}

export function escText(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
export function escAttr(s: string): string {
  return escText(s).replace(/"/g, '&quot;').replace(/\n/g, '&#10;').replace(/\r/g, '&#13;').replace(/\t/g, '&#9;')
}
/** XML 1.0 forbids most C0 controls even escaped; a stray one makes Word refuse the file. */
export function stripInvalidXmlChars(s: string): string {
  // eslint-disable-next-line no-control-regex
  return s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, '')
}

export class XmlError extends Error {}

/** Parse a document. Returns the root element. Throws XmlError on malformed input. */
export function parseXml(src: string): XEl {
  let i = 0
  const n = src.length
  if (src.charCodeAt(0) === 0xfeff) i = 1
  const root: XEl = { name: '#document', local: '#document', ns: '', attrs: {}, nattrs: {}, children: [] }
  const stack: XEl[] = [root]
  // Namespace scopes parallel the element stack.
  const scopes: Record<string, string>[] = [{ xml: 'http://www.w3.org/XML/1998/namespace' }]
  const lookup = (prefix: string): string => {
    for (let s = scopes.length - 1; s >= 0; s--) {
      const v = scopes[s][prefix]
      if (v !== undefined) return v
    }
    return ''
  }
  let textStart = i
  const flushText = (end: number) => {
    if (end > textStart) {
      const raw = src.slice(textStart, end)
      const top = stack[stack.length - 1]
      if (top !== root) top.children.push(decodeEntities(raw))
    }
  }
  while (i < n) {
    const lt = src.indexOf('<', i)
    if (lt < 0) { i = n; break }
    flushText(lt)
    i = lt
    const c1 = src.charCodeAt(i + 1)
    if (c1 === 33 /* ! */) {
      if (src.startsWith('<!--', i)) {
        const e = src.indexOf('-->', i + 4)
        if (e < 0) throw new XmlError('unterminated comment')
        i = e + 3
      } else if (src.startsWith('<![CDATA[', i)) {
        const e = src.indexOf(']]>', i + 9)
        if (e < 0) throw new XmlError('unterminated CDATA')
        const top = stack[stack.length - 1]
        if (top !== root) top.children.push(src.slice(i + 9, e))
        i = e + 3
      } else {
        // <!DOCTYPE …> — skip, including an internal subset in brackets. Never expanded.
        let depth = 0
        let j = i + 2
        for (; j < n; j++) {
          const ch = src[j]
          if (ch === '[') depth++
          else if (ch === ']') depth--
          else if (ch === '>' && depth <= 0) break
        }
        i = j + 1
      }
      textStart = i
      continue
    }
    if (c1 === 63 /* ? */) {
      const e = src.indexOf('?>', i + 2)
      if (e < 0) throw new XmlError('unterminated processing instruction')
      i = e + 2
      textStart = i
      continue
    }
    if (c1 === 47 /* / */) {
      const e = src.indexOf('>', i + 2)
      if (e < 0) throw new XmlError('unterminated end tag')
      const name = src.slice(i + 2, e).trim()
      const top = stack.pop()
      scopes.pop()
      if (!top || top === root) throw new XmlError(`unexpected </${name}>`)
      if (top.name !== name) throw new XmlError(`mismatched </${name}>, expected </${top.name}>`)
      i = e + 1
      textStart = i
      continue
    }
    // Start tag.
    let j = i + 1
    while (j < n && !isSpaceOrEnd(src.charCodeAt(j))) j++
    const name = src.slice(i + 1, j)
    if (!name) throw new XmlError('empty tag name')
    const attrs: Record<string, string> = {}
    let selfClose = false
    for (;;) {
      while (j < n && isSpace(src.charCodeAt(j))) j++
      if (j >= n) throw new XmlError('unterminated start tag')
      const ch = src.charCodeAt(j)
      if (ch === 62 /* > */) { j++; break }
      if (ch === 47 /* / */) {
        if (src.charCodeAt(j + 1) !== 62) throw new XmlError('bad self-closing tag')
        selfClose = true
        j += 2
        break
      }
      const ns = j
      while (j < n && src.charCodeAt(j) !== 61 /* = */ && !isSpaceOrEnd(src.charCodeAt(j))) j++
      const an = src.slice(ns, j)
      while (j < n && isSpace(src.charCodeAt(j))) j++
      if (src.charCodeAt(j) !== 61) {
        // HTML-ish bare attribute; tolerate it.
        attrs[an] = ''
        continue
      }
      j++
      while (j < n && isSpace(src.charCodeAt(j))) j++
      const q = src[j]
      if (q !== '"' && q !== "'") throw new XmlError(`unquoted attribute ${an}`)
      const ve = src.indexOf(q, j + 1)
      if (ve < 0) throw new XmlError('unterminated attribute')
      attrs[an] = decodeEntities(src.slice(j + 1, ve))
      j = ve + 1
    }
    const scope: Record<string, string> = {}
    for (const k in attrs) {
      if (k === 'xmlns') scope[''] = attrs[k]
      else if (k.startsWith('xmlns:')) scope[k.slice(6)] = attrs[k]
    }
    scopes.push(scope)
    const colon = name.indexOf(':')
    const prefix = colon >= 0 ? name.slice(0, colon) : ''
    const local = colon >= 0 ? name.slice(colon + 1) : name
    const nattrs: Record<string, string> = {}
    for (const k in attrs) {
      if (k === 'xmlns' || k.startsWith('xmlns:')) continue
      const c = k.indexOf(':')
      if (c < 0) nattrs[k] = attrs[k]
      else nattrs[`{${lookup(k.slice(0, c))}}${k.slice(c + 1)}`] = attrs[k]
    }
    const parent = stack[stack.length - 1]
    const el: XEl = { name, local, ns: lookup(prefix), attrs, nattrs, children: [], parent }
    parent.children.push(el)
    if (selfClose) scopes.pop()
    else stack.push(el)
    i = j
    textStart = i
  }
  if (stack.length > 1) throw new XmlError(`unclosed <${stack[stack.length - 1].name}>`)
  const top = root.children.find((c): c is XEl => typeof c !== 'string')
  if (!top) throw new XmlError('no root element')
  top.parent = undefined
  return top
}

function isSpace(c: number) { return c === 32 || c === 9 || c === 10 || c === 13 }
function isSpaceOrEnd(c: number) { return isSpace(c) || c === 62 || c === 47 }

// ---- navigation ------------------------------------------------------------

export const isEl = (n: XNode | undefined | null): n is XEl => !!n && typeof n !== 'string'

/** Direct element children, optionally filtered by namespace + local name. */
export function kids(el: XEl | null | undefined, ns?: string, local?: string): XEl[] {
  if (!el) return []
  const out: XEl[] = []
  for (const c of el.children) {
    if (typeof c === 'string') continue
    if (local !== undefined && c.local !== local) continue
    if (ns !== undefined && c.ns !== ns) continue
    out.push(c)
  }
  return out
}
export function kid(el: XEl | null | undefined, ns: string, local: string): XEl | null {
  if (!el) return null
  for (const c of el.children) if (typeof c !== 'string' && c.local === local && c.ns === ns) return c
  return null
}
/** First descendant (depth-first) with this name. */
export function find(el: XEl | null | undefined, ns: string, local: string): XEl | null {
  if (!el) return null
  for (const c of el.children) {
    if (typeof c === 'string') continue
    if (c.local === local && c.ns === ns) return c
    const d = find(c, ns, local)
    if (d) return d
  }
  return null
}
/** All descendants with this name, document order. */
export function findAll(el: XEl | null | undefined, ns: string, local: string, out: XEl[] = []): XEl[] {
  if (!el) return out
  for (const c of el.children) {
    if (typeof c === 'string') continue
    if (c.local === local && c.ns === ns) out.push(c)
    findAll(c, ns, local, out)
  }
  return out
}
/** Attribute by local name and (optional) namespace URI. */
export function attr(el: XEl | null | undefined, local: string, ns?: string): string | undefined {
  if (!el) return undefined
  return ns ? el.nattrs[`{${ns}}${local}`] : el.nattrs[local]
}
export function numAttr(el: XEl | null | undefined, local: string, d: number, ns?: string): number {
  const v = attr(el, local, ns)
  if (v === undefined || v === '') return d
  const x = Number(v)
  return Number.isFinite(x) ? x : d
}
/** OOXML "on/off": absent element = false; present with no val, or val true/1/on = true. */
export function onOff(el: XEl | null | undefined, ns: string): boolean | undefined {
  if (!el) return undefined
  const v = attr(el, 'val', ns) ?? attr(el, 'val')
  if (v === undefined) return true
  return !(v === '0' || v === 'false' || v === 'off' || v === 'none')
}
/** Concatenated text content of an element. */
export function textOf(el: XEl | null | undefined): string {
  if (!el) return ''
  let s = ''
  for (const c of el.children) s += typeof c === 'string' ? c : textOf(c)
  return s
}

// ---- writing ---------------------------------------------------------------

/** Built markup. A wrapper rather than a branded string, so plain text can never be
 *  mistaken for markup — text that happens to start with `<` is still escaped. */
export class Xml {
  constructor(readonly s: string) {}
  toString() { return this.s }
}
export type XChild = Xml | string | number | null | undefined | false | XChild[]
export const raw = (s: string) => new Xml(s)
/** `x('w:p', {'w:rsidR': '1'}, child1, 'text')`. Strings are escaped; null/false/undefined attrs are omitted. */
export function x(name: string, attrs?: Record<string, string | number | boolean | undefined | null> | null, ...children: XChild[]): Xml {
  let s = '<' + name
  if (attrs) {
    for (const k in attrs) {
      const v = attrs[k]
      if (v === undefined || v === null || v === false) continue
      s += ` ${k}="${escAttr(stripInvalidXmlChars(String(v === true ? 1 : v)))}"`
    }
  }
  let body = ''
  const add = (c: XChild) => {
    if (c === null || c === undefined || c === false) return
    if (Array.isArray(c)) { for (const d of c) add(d); return }
    body += c instanceof Xml ? c.s : escText(stripInvalidXmlChars(String(c)))
  }
  for (const c of children) add(c)
  return new Xml(body ? `${s}>${body}</${name}>` : `${s}/>`)
}
export const XML_DECL = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
export function xmlDoc(root: Xml): string { return XML_DECL + root.s }
