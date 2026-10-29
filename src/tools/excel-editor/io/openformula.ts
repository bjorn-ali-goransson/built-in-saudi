// Formulas between the editor's syntax (Excel's) and OpenFormula (.ods).
//
// Both directions live here so they are tested as a pair. The syntax below was
// not recalled from the specification: it is what LibreOffice 24 writes when it
// converts an .xlsx holding each case, which is the reader that matters.
//
//   Excel                         OpenFormula
//   A1, $A$1:B3                   [.A1], [.$A$1:.B3]
//   'My Data'!B2, Main!A1         [$'My Data'.B2], [$Main.A1]
//   A:A, 2:2                      [.A:.A], [.2:.2]
//   SUM(A1, 2)                    SUM([.A1]; 2)        ; separates arguments
//   {1,2;3,4}                     {1;2|3;4}            ; columns, | rows
//   "a,b;c"                       "a,b;c"              strings are never touched
//
// The translation works on the formula's TEXT rather than on the engine's parse
// tree, because the tree keeps neither `$` (an address is a row and a column)
// nor `%` (folded into /100): a formula written from it would compute the same
// value and stop being the formula somebody wrote — `$A$1` would copy as `A1`.

const CELL = /^\$?[A-Za-z]{1,3}\$?\d+/
const COLS = /^\$?[A-Za-z]{1,3}:\$?[A-Za-z]{1,3}(?![\w(])/
const ROWS = /^\$?\d+:\$?\d+(?![\w(.])/
const SHEET = /^(?:'((?:[^']|'')+)'|([A-Za-z_][\w.]*))!/
const IDENT = /[A-Za-z0-9_.]/

/** One reference (with an optional range end) at the start of `s`, or null. */
function readRef(s: string): { sheet?: string; a: string; b?: string; len: number } | null {
  let i = 0
  let sheet: string | undefined
  const sh = SHEET.exec(s)
  if (sh) { sheet = sh[1] !== undefined ? sh[1].replace(/''/g, "'") : sh[2]; i = sh[0].length }
  const rest = s.slice(i)
  const whole = COLS.exec(rest) || ROWS.exec(rest)
  if (whole) { const [a, b] = whole[0].split(':'); return { sheet, a, b, len: i + whole[0].length } }
  const c1 = CELL.exec(rest)
  if (!c1) return null
  let len = i + c1[0].length
  // A cell name followed by "(" is a function (LOG10 is a cell in Excel's grid too).
  const after = s.slice(len)
  if (/^[\w(]/.test(after)) return null
  let b: string | undefined
  const m2 = /^:(\$?[A-Za-z]{1,3}\$?\d+)(?![\w(])/.exec(after)
  if (m2) { b = m2[1]; len += m2[0].length }
  return { sheet, a: c1[0], b, len }
}

const quoteSheetOf = (n: string) => (/^[A-Za-z_][\w]*$/.test(n) ? n : `'${n.replace(/'/g, "''")}'`)

/** Excel formula text (with or without the leading `=`) → `of:=…`. */
export function toOpenFormula(excel: string): string {
  const src = excel.replace(/^=/, '')
  let out = ''
  let depthBrace = 0
  for (let i = 0; i < src.length;) {
    const ch = src[i]
    if (ch === '"') { // a string, copied verbatim with its "" escapes
      let j = i + 1
      while (j < src.length) { if (src[j] === '"') { if (src[j + 1] === '"') j += 2; else break } else j++ }
      out += src.slice(i, j + 1)
      i = j + 1
      continue
    }
    if (ch === '{') { depthBrace++; out += ch; i++; continue }
    if (ch === '}') { depthBrace = Math.max(0, depthBrace - 1); out += ch; i++; continue }
    if (depthBrace > 0) { out += ch === ',' ? ';' : ch === ';' ? '|' : ch; i++; continue }
    if (ch === ',') { out += ';'; i++; continue }
    // A reference can only start where an identifier does not continue.
    const prev = out.length ? src[i - 1] : ''
    if ((ch === "'" || ch === '$' || /[A-Za-z0-9]/.test(ch)) && !(prev && IDENT.test(prev))) {
      const r = readRef(src.slice(i))
      if (r) {
        const s = r.sheet !== undefined ? `$${quoteSheetOf(r.sheet)}` : ''
        out += `[${s}.${r.a}${r.b ? `:.${r.b}` : ''}]`
        i += r.len
        continue
      }
      // Not a reference: copy the whole identifier, so its tail is not mistaken for one.
      const id = /^[A-Za-z0-9_.$]+/.exec(src.slice(i))
      if (id) { out += id[0]; i += id[0].length; continue }
    }
    out += ch
    i++
  }
  return `of:=${out}`
}

/** OpenFormula (`of:=…`, or LibreOffice's older `oooc:` / an Excel-flavoured `msoxl:`) → Excel formula text. */
export function fromOpenFormula(f: string): string {
  let s = f.replace(/^(of|oooc|msoxl):/, '').replace(/^=/, '')
  // [$'Sheet 2'.A1:.B3] / [.A1] / [$Sheet2.$A$1] / [.A:.A]
  s = s.replace(/\[([^\]]+)\]/g, (_m, inner: string) => {
    return inner.split(':').map((part, i) => {
      const m = /^\$?(?:'((?:[^']|'')+)'|([^.']*))?\.(.+)$/.exec(part)
      if (!m) return part
      const sheet = m[1] !== undefined ? m[1].replace(/''/g, "'") : m[2]
      const ref = m[3]
      if (i > 0) return ref
      return sheet ? `${/^[A-Za-z_][\w.]*$/.test(sheet) ? sheet : `'${sheet.replace(/'/g, "''")}'`}!${ref}` : ref
    }).join(':')
  })
  // ';' separates arguments (and columns in an array), '|' rows of an array.
  let out = ''
  let q = false
  let brace = 0
  for (const ch of s) {
    if (ch === '"') q = !q
    if (!q && ch === '{') brace++
    if (!q && ch === '}') brace = Math.max(0, brace - 1)
    out += q ? ch : ch === ';' ? ',' : ch === '|' && brace > 0 ? ';' : ch
  }
  return out
}
