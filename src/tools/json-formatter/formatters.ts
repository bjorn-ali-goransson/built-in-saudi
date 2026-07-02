// Lightweight, dependency-free beautify/minify for a few common formats.
// JSON uses the native parser (with real validation); CSS and XML use small
// hand-rolled formatters — good enough for everyday tidy-up, no Prettier weight.

export type Fmt = 'json' | 'css' | 'xml'

export type FmtResult = { ok: true; out: string } | { ok: false; line: number; col: number }

function locate(raw: string, message: string): { line: number; col: number } {
  const lc = message.match(/line (\d+) column (\d+)/i)
  if (lc) return { line: +lc[1], col: +lc[2] }
  const p = message.match(/position (\d+)/i)
  if (p) {
    const pos = +p[1]
    const before = raw.slice(0, pos)
    return { line: before.split('\n').length, col: pos - before.lastIndexOf('\n') }
  }
  return { line: 1, col: 1 }
}

function sortDeep(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sortDeep)
  if (v && typeof v === 'object') {
    return Object.keys(v as Record<string, unknown>).sort().reduce((o, k) => {
      o[k] = sortDeep((v as Record<string, unknown>)[k]); return o
    }, {} as Record<string, unknown>)
  }
  return v
}

// ── CSS ──────────────────────────────────────────────────────────────────────
function cssMinify(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')       // drop comments
    .replace(/\s+/g, ' ')
    .replace(/\s*([{}:;,>])\s*/g, '$1')
    .replace(/;}/g, '}')
    .trim()
}

function cssFormat(src: string, indent: number): string {
  const s = cssMinify(src) // normalise first, then re-expand
  const pad = (n: number) => ' '.repeat(indent * n)
  const decl = (d: string) => d.trim().replace(/;$/, '').replace(/\s*:\s*/, ': ') // "prop: value"
  let out = '', depth = 0, buf = ''
  for (const ch of s) {
    if (ch === '{') { out += pad(depth) + buf.trim().replace(/,\s*/g, ',\n' + pad(depth)) + ' {\n'; depth++; buf = '' }
    else if (ch === '}') {
      if (buf.trim()) out += pad(depth) + decl(buf) + ';\n'
      depth = Math.max(0, depth - 1); out += pad(depth) + '}\n'; buf = ''
    } else if (ch === ';') { out += pad(depth) + decl(buf) + ';\n'; buf = '' }
    else buf += ch
  }
  if (buf.trim()) out += pad(depth) + buf.trim() + '\n'
  return out.trim() + '\n'
}

// ── XML / HTML ───────────────────────────────────────────────────────────────
function xmlMinify(src: string): string {
  return src.replace(/>\s+</g, '><').replace(/\s+/g, ' ').replace(/> </g, '><').trim()
}

function xmlFormat(src: string, indent: number): string {
  const s = xmlMinify(src).replace(/></g, '>\n<')
  const pad = (n: number) => ' '.repeat(indent * n)
  let out = '', depth = 0
  for (const line of s.split('\n')) {
    const l = line.trim(); if (!l) continue
    if (/^<\//.test(l)) depth = Math.max(0, depth - 1)
    out += pad(depth) + l + '\n'
    const opens = /^<[^!?/][^>]*[^/]>$/.test(l)          // an opening tag
    const closedInline = /^<[^>]+>.*<\/[^>]+>$/.test(l)  // <a>…</a> on one line
    if (opens && !closedInline) depth++
  }
  return out.trim() + '\n'
}

// ── Dispatch ─────────────────────────────────────────────────────────────────
export function process(fmt: Fmt, raw: string, minify: boolean, indent: number, sort: boolean): FmtResult {
  if (fmt === 'json') {
    try {
      const obj = sort ? sortDeep(JSON.parse(raw)) : JSON.parse(raw)
      return { ok: true, out: minify ? JSON.stringify(obj) : JSON.stringify(obj, null, indent) }
    } catch (e) {
      return { ok: false, ...locate(raw, e instanceof Error ? e.message : String(e)) }
    }
  }
  if (fmt === 'css') return { ok: true, out: minify ? cssMinify(raw) : cssFormat(raw, indent) }
  return { ok: true, out: minify ? xmlMinify(raw) : xmlFormat(raw, indent) }
}
