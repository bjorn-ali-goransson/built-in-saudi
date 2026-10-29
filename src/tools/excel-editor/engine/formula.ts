/**
 * A compact Excel-style formula engine: tokenize → parse (AST) → evaluate, plus
 * dependency extraction for reactive recalc. Deliberately a subset — the valuable
 * 80/20, not the whole spec. We own this (MIT-clean); see CLAUDE.md.
 */
import { addMonths, dateToSerial, endOfMonth, nowSerial, parseIsoDate, serialToParts, todaySerial } from './dates'
import { formatCode } from './fmtcode'
import { CellError, colToLetters, ERR, isError, lettersToCol, movedIndex, movedSpan, parseA1, type Addr, type CellValue } from './model'

// ---- Tokens ----------------------------------------------------------------

type Tok =
  | { t: 'num'; v: number }
  | { t: 'str'; v: string }
  | { t: 'ident'; v: string }
  | { t: 'quoted'; v: string } // 'Sheet Name'
  | { t: 'op'; v: string }
  | { t: 'lp' }
  | { t: 'rp' }
  | { t: 'comma' }
  | { t: 'colon' }
  | { t: 'bang' }
  | { t: 'err'; v: string }
  | { t: 'lb' }
  | { t: 'rb' }
  | { t: 'semi' }

function tokenize(src: string): Tok[] {
  const toks: Tok[] = []
  let i = 0
  const isDigit = (c: string) => c >= '0' && c <= '9'
  // `$` starts an identifier so absolute refs (`$A$1`, `$A1`) tokenize — Excel's
  // standard syntax, which .xlsx import emits. parseA1 already strips the `$`.
  const isIdentStart = (c: string) => /[A-Za-z_$]/.test(c)
  const isIdent = (c: string) => /[A-Za-z0-9_.$]/.test(c)

  while (i < src.length) {
    const c = src[i]
    if (c === ' ' || c === '\t' || c === '\n' || c === '\r') {
      i++
      continue
    }
    if (isDigit(c) || (c === '.' && isDigit(src[i + 1] ?? ''))) {
      let j = i + 1
      // At most ONE decimal point per number: `1.2.3` must NOT silently truncate to 1.2 (#423).
      // Stopping at the second dot leaves it to re-tokenize as `1.2` then `.3` — two adjacent
      // number tokens with no operator, which the parser rejects as #VALUE!, like Excel.
      let dots = c === '.' ? 1 : 0
      while (j < src.length && (isDigit(src[j]) || (src[j] === '.' && dots === 0))) {
        if (src[j] === '.') dots++
        j++
      }
      // Scientific notation (1e5, 2.5E-3): only consume `e`/`E` when a real exponent
      // follows, so a bare `e` stays free for anything else the tokenizer handles.
      if (src[j] === 'e' || src[j] === 'E') {
        let k = j + 1
        if (src[k] === '+' || src[k] === '-') k++
        if (isDigit(src[k] ?? '')) {
          k++
          while (k < src.length && isDigit(src[k])) k++
          j = k
        }
      }
      toks.push({ t: 'num', v: parseFloat(src.slice(i, j)) })
      i = j
      continue
    }
    if (c === '"') {
      let j = i + 1
      let s = ''
      while (j < src.length) {
        if (src[j] === '"') {
          if (src[j + 1] === '"') {
            s += '"'
            j += 2
            continue
          }
          break
        }
        s += src[j++]
      }
      toks.push({ t: 'str', v: s })
      i = j + 1
      continue
    }
    if (c === "'") {
      let j = i + 1
      let s = ''
      // A sheet name with an apostrophe in it is written with the apostrophe doubled: 'O''Brien'!A1.
      while (j < src.length && (src[j] !== "'" || src[j + 1] === "'")) { if (src[j] === "'") j++; s += src[j++] }
      toks.push({ t: 'quoted', v: s })
      i = j + 1
      continue
    }
    if (isIdentStart(c)) {
      let j = i + 1
      while (j < src.length && isIdent(src[j])) j++
      toks.push({ t: 'ident', v: src.slice(i, j) })
      i = j
      continue
    }
    // An error literal (#N/A, #REF!, #DIV/0!…) — formulas imported from .xlsx carry them,
    // most often as `#REF!` where a deleted row used to be.
    if (c === '#') {
      const m = /^#(?:NULL!|DIV\/0!|VALUE!|REF!|NAME\?|NUM!|N\/A|CIRC!|SPILL!|CALC!|GETTING_DATA)/i.exec(src.slice(i))
      if (m) {
        toks.push({ t: 'err', v: m[0].toUpperCase() })
        i += m[0].length
        continue
      }
    }
    // Multi-char operators first.
    const two = src.slice(i, i + 2)
    if (two === '<>' || two === '<=' || two === '>=') {
      toks.push({ t: 'op', v: two })
      i += 2
      continue
    }
    if ('+-*/^&=<>%'.includes(c)) {
      toks.push({ t: 'op', v: c })
      i++
      continue
    }
    if (c === '(') (toks.push({ t: 'lp' }), i++)
    else if (c === ')') (toks.push({ t: 'rp' }), i++)
    else if (c === ',') (toks.push({ t: 'comma' }), i++)
    else if (c === ':') (toks.push({ t: 'colon' }), i++)
    else if (c === '!') (toks.push({ t: 'bang' }), i++)
    else if (c === '{') (toks.push({ t: 'lb' }), i++)
    else if (c === '}') (toks.push({ t: 'rb' }), i++)
    else if (c === ';') (toks.push({ t: 'semi' }), i++)
    else if (c === '@') i++ // the implicit-intersection operator newer Excel writes; a no-op here
    else throw new SyntaxError(`Unexpected '${c}'`)
  }
  return toks
}

// ---- AST -------------------------------------------------------------------

/**
 * The far edge of a whole-column (`A:A`) or whole-row (`3:3`) range. The workbook clamps it to the
 * cells actually in use before reading, so `SUM(A:A)` costs what the column holds, not a million rows.
 */
export const WHOLE = 1_048_575

export type Node =
  | { k: 'num'; v: number }
  | { k: 'str'; v: string }
  | { k: 'bool'; v: boolean }
  | { k: 'ref'; sheet?: string; addr: Addr }
  | { k: 'range'; sheet?: string; from: Addr; to: Addr }
  | { k: 'unary'; op: string; x: Node }
  | { k: 'binary'; op: string; a: Node; b: Node }
  | { k: 'func'; name: string; args: Node[] }
  | { k: 'err'; v: string }
  /** An array constant `{1,2;3,4}` — rows of scalars. */
  | { k: 'array'; rows: Node[][] }
  /** A defined name, resolved by the workbook before evaluation; unresolved is #NAME?. */
  | { k: 'name'; v: string }

class Parser {
  private p = 0
  constructor(private toks: Tok[]) {}
  private peek(): Tok | undefined {
    return this.toks[this.p]
  }
  private next(): Tok {
    return this.toks[this.p++]
  }
  private eat(t: Tok['t']): Tok {
    const tk = this.next()
    if (!tk || tk.t !== t) throw new SyntaxError(`Expected ${t}`)
    return tk
  }

  parse(): Node {
    const n = this.comparison()
    if (this.p !== this.toks.length) throw new SyntaxError('Trailing tokens')
    return n
  }

  private comparison(): Node {
    let a = this.concat()
    while (this.isOp('=', '<>', '<', '>', '<=', '>=')) {
      const op = (this.next() as { v: string }).v
      a = { k: 'binary', op, a, b: this.concat() }
    }
    return a
  }
  private concat(): Node {
    let a = this.additive()
    while (this.isOp('&')) {
      this.next()
      a = { k: 'binary', op: '&', a, b: this.additive() }
    }
    return a
  }
  private additive(): Node {
    let a = this.term()
    while (this.isOp('+', '-')) {
      const op = (this.next() as { v: string }).v
      a = { k: 'binary', op, a, b: this.term() }
    }
    return a
  }
  private term(): Node {
    let a = this.power()
    while (this.isOp('*', '/')) {
      const op = (this.next() as { v: string }).v
      a = { k: 'binary', op, a, b: this.power() }
    }
    return a
  }
  private power(): Node {
    let a = this.unary()
    // Left-associative, matching Excel/Sheets: 2^3^2 = (2^3)^2 = 64, not 2^(3^2) = 512.
    while (this.isOp('^')) {
      this.next()
      a = { k: 'binary', op: '^', a, b: this.unary() }
    }
    return a
  }
  private unary(): Node {
    if (this.isOp('-', '+')) {
      const op = (this.next() as { v: string }).v
      return { k: 'unary', op, x: this.unary() }
    }
    return this.postfix()
  }
  private postfix(): Node {
    let a = this.primary()
    while (this.isOp('%')) {
      this.next()
      a = { k: 'binary', op: '/', a, b: { k: 'num', v: 100 } }
    }
    return a
  }

  private primary(): Node {
    const tk = this.peek()
    if (!tk) throw new SyntaxError('Unexpected end')
    if (tk.t === 'err') return (this.next(), { k: 'err', v: tk.v })
    if (tk.t === 'lb') return this.arrayConst()
    // A whole-row range, `3:5` — two numbers either side of a colon.
    if (tk.t === 'num' && this.toks[this.p + 1]?.t === 'colon' && this.toks[this.p + 2]?.t === 'num' && Number.isInteger(tk.v)) {
      this.next(); this.next()
      const b = this.next() as { v: number }
      return { k: 'range', from: { row: tk.v - 1, col: 0 }, to: { row: b.v - 1, col: WHOLE }, }
    }
    if (tk.t === 'num') return (this.next(), { k: 'num', v: tk.v })
    if (tk.t === 'str') return (this.next(), { k: 'str', v: tk.v })
    if (tk.t === 'lp') {
      this.next()
      const n = this.comparison()
      this.eat('rp')
      return n
    }
    if (tk.t === 'quoted') {
      this.next()
      this.eat('bang')
      return this.refOrRange(tk.v)
    }
    if (tk.t === 'ident') {
      this.next()
      const name = tk.v
      if (this.peek()?.t === 'lp') return this.funcCall(name)
      if (this.peek()?.t === 'bang') {
        this.next()
        return this.refOrRange(name)
      }
      const up = name.toUpperCase()
      if (up === 'TRUE') return { k: 'bool', v: true }
      if (up === 'FALSE') return { k: 'bool', v: false }
      return this.refFrom(undefined, name)
    }
    throw new SyntaxError('Unexpected token')
  }

  private arrayConst(): Node {
    this.eat('lb')
    const rows: Node[][] = [[]]
    for (;;) {
      const t = this.peek()
      if (!t) throw new SyntaxError('Unterminated array')
      if (t.t === 'rb') { this.next(); break }
      if (t.t === 'comma') { this.next(); continue }
      if (t.t === 'semi') { this.next(); rows.push([]); continue }
      rows[rows.length - 1].push(this.unary())
    }
    return { k: 'array', rows }
  }

  private funcCall(name: string): Node {
    this.eat('lp')
    const args: Node[] = []
    if (this.peek()?.t !== 'rp') {
      args.push(this.comparison())
      while (this.peek()?.t === 'comma') {
        this.next()
        args.push(this.comparison())
      }
    }
    this.eat('rp')
    return { k: 'func', name: name.toUpperCase(), args }
  }

  private refOrRange(sheet: string): Node {
    const first = this.eat('ident') as { v: string }
    return this.refFrom(sheet, first.v)
  }

  private refFrom(sheet: string | undefined, first: string): Node {
    const a = parseA1(first)
    if (!a) {
      // `A:C` — whole columns.
      const col = /^\$?([A-Za-z]{1,3})$/.exec(first)
      if (col && this.peek()?.t === 'colon') {
        const save = this.p
        this.next()
        const second = this.peek()
        const c2 = second?.t === 'ident' ? /^\$?([A-Za-z]{1,3})$/.exec(second.v) : null
        if (c2) {
          this.next()
          return { k: 'range', sheet, from: { row: 0, col: lettersToCol(col[1]) }, to: { row: WHOLE, col: lettersToCol(c2[1]) } }
        }
        this.p = save
      }
      // Anything else that is not a reference is a defined name (or an unknown one).
      if (sheet === undefined && /^[A-Za-z_\\][\w.]*$/.test(first)) return { k: 'name', v: first }
      throw new SyntaxError(`Bad reference '${first}'`)
    }
    if (this.peek()?.t === 'colon') {
      this.next()
      const second = this.eat('ident') as { v: string }
      const b = parseA1(second.v)
      if (!b) throw new SyntaxError(`Bad reference '${second.v}'`)
      return { k: 'range', sheet, from: a, to: b }
    }
    return { k: 'ref', sheet, addr: a }
  }

  private isOp(...ops: string[]): boolean {
    const tk = this.peek()
    return tk?.t === 'op' && ops.includes(tk.v)
  }
}

export function parse(formula: string): Node {
  return new Parser(tokenize(formula)).parse()
}

// ---- Reference shifting (copy/paste, Excel-style) --------------------------

/** A ref token like `A1`, `$A1`, `A$1`, `$A$1`, split into anchors + address. */
const REF_RE = /^(\$?)([A-Za-z]+)(\$?)(\d+)$/

function serializeTok(t: Tok): string {
  switch (t.t) {
    case 'num':
      return String(t.v)
    case 'str':
      return `"${t.v.replace(/"/g, '""')}"`
    case 'ident':
      return t.v
    case 'quoted':
      return `'${t.v.replace(/'/g, "''")}'`
    case 'op':
      return t.v
    case 'lp':
      return '('
    case 'rp':
      return ')'
    case 'comma':
      return ','
    case 'colon':
      return ':'
    case 'bang':
      return '!'
    case 'err':
      return t.v
    case 'lb':
      return '{'
    case 'rb':
      return '}'
    case 'semi':
      return ';'
  }
}

/**
 * Rewrite the RELATIVE references in a formula by (dRow, dCol) — what Excel does when
 * you copy a formula and paste it elsewhere. `$`-anchored parts stay put (`$A$1` never
 * moves, `$A1` keeps its column, `A$1` keeps its row). Function names (an ident before
 * `(`) and string literals are left untouched; a reference shifted off the sheet (row or
 * column < 1) becomes `#REF!`, which the engine renders as an error. A non-formula (no
 * leading `=`) or anything that fails to tokenize is returned verbatim, so paste never
 * corrupts a plain value.
 */
export function shiftFormula(input: string, dRow: number, dCol: number): string {
  if (!input.startsWith('=') || (dRow === 0 && dCol === 0)) return input
  let toks: Tok[]
  try {
    toks = tokenize(input.slice(1))
  } catch {
    return input
  }
  const out: string[] = []
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i]
    // Skip idents that aren't cell refs: a function name (`SUM` before `(`) and a sheet
    // name (`Sheet2` before `!` — its greedy letters would otherwise parse as a column).
    const nextT = toks[i + 1]?.t
    if (t.t === 'ident' && nextT !== 'lp' && nextT !== 'bang') {
      const m = REF_RE.exec(t.v)
      if (m) {
        const [, colAbs, letters, rowAbs, digits] = m
        const col = lettersToCol(letters) + (colAbs ? 0 : dCol)
        const row = parseInt(digits, 10) - 1 + (rowAbs ? 0 : dRow)
        if (col < 0 || row < 0) {
          out.push('#REF!')
        } else {
          out.push(`${colAbs}${colToLetters(col)}${rowAbs}${row + 1}`)
        }
        continue
      }
    }
    out.push(serializeTok(t))
  }
  return '=' + out.join('')
}

/**
 * Rewrite references for an INSERTED or DELETED row/column (#1341).
 *
 * NOT `shiftFormula`, and the difference is the whole reason this exists. That one shifts every
 * relative reference by a fixed offset and leaves `$`-anchored ones alone, which is exactly right
 * for copy/paste and exactly wrong here: `$B$5` is anchored against COPYING, not against the sheet
 * changing shape underneath it. Insert a row above 5 and Excel moves it to `$B$6`, anchors and all,
 * because the cell it names has genuinely moved.
 *
 * The other difference is that the shift is CONDITIONAL — only references at or past the change
 * move, which is what makes ranges behave. `SUM(B2:B5)` with a row inserted at 3 becomes
 * `SUM(B2:B6)`: the start is above the insertion and stays, the end is below it and moves. The two
 * endpoints tokenize separately, so handling each on its own produces the right range without the
 * function ever needing to know it was looking at one.
 *
 * `targetSheet` is which sheet changed shape, and `formulaSheet` is where this formula lives — a
 * bare `B5` means the formula's own sheet, and `Rates!B5` means that one. Without both, inserting a
 * row in Budget would silently rewrite references to Rates in every other sheet.
 *
 * A deleted single cell becomes `#REF!`. A RANGE narrows instead — `SUM(B2:B3)` with row 2 deleted
 * becomes `SUM(B2:B2)`, as in Excel — and only becomes `#REF!` when every row it covered is gone.
 * That distinction is not a nicety: deleting a line from a budget is the commonest structural edit
 * there is, and breaking the total each time would make the feature worse than not having it. It is
 * why `movedSpan` exists beside `movedIndex` rather than the ends being handled independently.
 */
export function adjustRefsForStructure(
  input: string,
  opts: { formulaSheet: string; targetSheet: string; axis: 'row' | 'col'; at: number; delta: number },
): string {
  if (!input.startsWith('=') || opts.delta === 0) return input
  let toks: Tok[]
  try {
    toks = tokenize(input.slice(1))
  } catch {
    return input
  }
  const { formulaSheet, targetSheet, axis, at, delta } = opts
  const out: string[] = []
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i]
    const nextT = toks[i + 1]?.t
    if (t.t === 'ident' && nextT !== 'lp' && nextT !== 'bang') {
      const m = REF_RE.exec(t.v)
      if (m) {
        /**
         * Which sheet does this reference point at? Two tokens back is the `!`, three back the
         * sheet name — anything else is a bare reference, which means the formula's own sheet.
         */
        const bang = toks[i - 1]?.t === 'bang'
        const named = bang ? sheetNameOf(toks[i - 2]) : null
        const refSheet = named ?? formulaSheet
        if (refSheet !== targetSheet) {
          out.push(serializeTok(t))
          continue
        }
        /**
         * A RANGE IS ONE THING, not two references that happen to be adjacent (#1341).
         *
         * Deleting a row inside `SUM(B2:B3)` has to NARROW it to `SUM(B2:B2)`. Handling the
         * endpoints separately makes the deleted one `#REF!` and breaks the total — and deleting a
         * line from a budget is the commonest structural edit there is, so that failure would be
         * hit within a minute of real use. So a `ref : ref` triple is consumed together.
         */
        const colonNext = toks[i + 1]?.t === 'colon'
        const endTok = colonNext ? toks[i + 2] : undefined
        const endM = endTok?.t === 'ident' ? REF_RE.exec(endTok.v) : null
        if (endM) {
          const rewritten = movedRange(m, endM, axis, at, delta)
          out.push(rewritten)
          i += 2 // the colon and the far endpoint are consumed
          continue
        }

        const [, colAbs, letters, rowAbs, digits] = m
        const col = lettersToCol(letters)
        const row = parseInt(digits, 10) - 1
        const idx = axis === 'row' ? row : col
        const moved = movedIndex(idx, at, delta)
        if (moved === null) {
          out.push('#REF!')
        } else {
          const r = axis === 'row' ? moved : row
          const c = axis === 'col' ? moved : col
          out.push(`${colAbs}${colToLetters(c)}${rowAbs}${r + 1}`)
        }
        continue
      }
    }
    out.push(serializeTok(t))
  }
  return '=' + out.join('')
}

/**
 * Rewrite both ends of an `A1:B9` range for a structural change, as one span.
 *
 * Only the axis being changed moves; the other keeps each endpoint's own value, so a range stays
 * the rectangle it was. A span entirely inside a deletion has nothing left to name and becomes a
 * single `#REF!` — which reads as one broken reference rather than the half-broken `#REF!:B4` that
 * treating the ends separately produces.
 */
function movedRange(
  start: RegExpExecArray,
  end: RegExpExecArray,
  axis: 'row' | 'col',
  at: number,
  delta: number,
): string {
  const [, sColAbs, sLetters, sRowAbs, sDigits] = start
  const [, eColAbs, eLetters, eRowAbs, eDigits] = end
  const sCol = lettersToCol(sLetters)
  const eCol = lettersToCol(eLetters)
  const sRow = parseInt(sDigits, 10) - 1
  const eRow = parseInt(eDigits, 10) - 1

  const span = axis === 'row' ? movedSpan(sRow, eRow, at, delta) : movedSpan(sCol, eCol, at, delta)
  if (!span) return '#REF!'

  const a = axis === 'row' ? { row: span.lo, col: sCol } : { row: sRow, col: span.lo }
  const b = axis === 'row' ? { row: span.hi, col: eCol } : { row: eRow, col: span.hi }
  return (
    `${sColAbs}${colToLetters(a.col)}${sRowAbs}${a.row + 1}` +
    ':' +
    `${eColAbs}${colToLetters(b.col)}${eRowAbs}${b.row + 1}`
  )
}

/** The sheet name a token carries, whether it was written bare (`Rates!`) or quoted (`'My Sheet'!`).
 *  `quoted` is the tokenizer's own type for the latter — `str` is a double-quoted string LITERAL and
 *  never names a sheet, so reading it here would match text that merely looked like one. */
function sheetNameOf(t: Tok | undefined): string | null {
  if (!t) return null
  return t.t === 'ident' || t.t === 'quoted' ? t.v : null
}

/** A sheet name is a bare ident if it's a safe identifier that isn't itself a cell ref
 *  (a sheet called `A1` must be quoted to disambiguate `A1!B2`); otherwise it's quoted. */
function sheetToken(name: string): string {
  const bare = /^[A-Za-z_][A-Za-z0-9_.]*$/.test(name) && !REF_RE.test(name)
  return bare ? name : `'${name}'`
}

/**
 * Rewrite cross-sheet references from `oldName!` to `newName!` — used when a sheet is
 * renamed so formulas that pointed at it keep resolving (Excel does this). Only the sheet
 * token before a `!` is touched; cell addresses are untouched. A non-formula or anything
 * that fails to tokenize is returned verbatim.
 */
export function renameSheetRefs(input: string, oldName: string, newName: string): string {
  if (!input.startsWith('=')) return input
  let toks: Tok[]
  try {
    toks = tokenize(input.slice(1))
  } catch {
    return input
  }
  let changed = false
  const out: string[] = []
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i]
    if ((t.t === 'ident' || t.t === 'quoted') && toks[i + 1]?.t === 'bang' && t.v === oldName) {
      out.push(sheetToken(newName))
      changed = true
      continue
    }
    out.push(serializeTok(t))
  }
  return changed ? '=' + out.join('') : input
}

// ---- Dependencies ----------------------------------------------------------

export type Dep = { sheet?: string; addr: Addr }

/**
 * Upper bound on cells a single range may span. Beyond this we refuse to
 * materialize it — a parseable monster like `A1:XFD1048576` would otherwise
 * allocate billions of cells and hang every recalc. We are not a data platform.
 */
export const MAX_RANGE_CELLS = 200_000

export function rangeArea(from: Addr, to: Addr): number {
  return (Math.abs(to.row - from.row) + 1) * (Math.abs(to.col - from.col) + 1)
}

/** Every cell a formula reads (ranges expanded), for the recalc graph. */
export function deps(node: Node): Dep[] {
  const out: Dep[] = []
  const walk = (n: Node) => {
    switch (n.k) {
      case 'ref':
        out.push({ sheet: n.sheet, addr: n.addr })
        break
      case 'array':
        n.rows.flat().forEach(walk)
        break
      case 'range':
        // Over the cap, record only the corners so the dep walk can't OOM; the
        // formula itself evaluates to #NUM! (see the engine's range guard).
        if (rangeArea(n.from, n.to) > MAX_RANGE_CELLS) {
          out.push({ sheet: n.sheet, addr: n.from }, { sheet: n.sheet, addr: n.to })
          break
        }
        for (let r = Math.min(n.from.row, n.to.row); r <= Math.max(n.from.row, n.to.row); r++)
          for (let c = Math.min(n.from.col, n.to.col); c <= Math.max(n.from.col, n.to.col); c++)
            out.push({ sheet: n.sheet, addr: { row: r, col: c } })
        break
      case 'unary':
        walk(n.x)
        break
      case 'binary':
        walk(n.a)
        walk(n.b)
        break
      case 'func':
        n.args.forEach(walk)
        break
    }
  }
  walk(node)
  return out
}

// ---- Evaluation ------------------------------------------------------------

export type EvalCtx = {
  cell: (sheet: string | undefined, addr: Addr) => CellValue
  range: (sheet: string | undefined, from: Addr, to: Addr) => CellValue[]
  /** The cell being computed — for ROW() and COLUMN() with no argument. */
  self?: { sheet: string; addr: Addr }
  /** Clamp a whole-column/row range to the extent in use. */
  clamp?: (sheet: string | undefined, from: Addr, to: Addr) => { from: Addr; to: Addr }
}

const num = (v: CellValue): number | CellError => {
  if (isError(v)) return v
  if (typeof v === 'number') return v
  if (typeof v === 'boolean') return v ? 1 : 0
  if (v === '' || v == null) return 0
  // All-whitespace (but non-empty) text is #VALUE! in Excel, not 0 — JS's Number("   ")===0
  // would otherwise coerce it silently (e.g. ="   "+1 → 1 instead of #VALUE!) (#423).
  if (typeof v === 'string' && v.trim() === '') return ERR.value()
  /**
   * AN ISO DATE TYPED INTO A CELL IS A DATE WHEREVER A NUMBER IS WANTED (#1355).
   *
   * `2026-09-09` is not a number to `Number()`, so without this every typed date was `#VALUE!` the
   * moment it reached arithmetic — which left `=DATE(2026,9,9)` as the only way to get a date into
   * a sheet by hand, and nobody writes that.
   *
   * The conversion is here, in the numeric coercion, rather than at INPUT on purpose. Rewriting the
   * cell's stored input to its serial would mean a person who typed `2026-09-09` and clicked back
   * into the cell would find `46274` waiting for them. This way the text they typed stays the text
   * they typed, and it behaves as a date everywhere it is used as one.
   *
   * ISO only — see `parseIsoDate` for why nothing ambiguous is accepted.
   */
  if (typeof v === 'string') {
    const serial = parseIsoDate(v)
    if (serial !== null) return serial
  }
  const n = Number(v)
  return Number.isNaN(n) ? ERR.value() : n
}

const FUNCS: Record<string, (args: Node[], ctx: EvalCtx) => CellValue> = {
  SUM: (a, c) => reduceNums(a, c, 0, (acc, n) => acc + n),
  /**
   * COUNTIF / SUMIF — conditional aggregates (#1339 follow-up).
   *
   * The two most-reached-for business functions after SUM, and until now both rendered `#NAME?`,
   * including in a spreadsheet somebody imported from Excel. They are NOT the "lookup functions"
   * CLAUDE.md rules out: the dependency stays static (a plain range), so the engine needs no
   * dynamic discovery and the reason INDIRECT/OFFSET are excluded does not apply here.
   */
  COUNTIF: (a, c) => {
    if (a.length !== 2) return ERR.value()
    const crit = evaluate(a[1], c)
    if (isError(crit)) return crit
    const test = criterionTest(crit)
    return valuesOf(a[0], c).filter(test).length
  },
  /**
   * `SUMIF(range, criteria, [sum_range])`. With no third argument the tested range is also the
   * summed one.
   *
   * The two ranges are paired BY POSITION. Excel pairs them by offset from the sum range's
   * top-left, which is the same thing whenever the ranges have the same shape — the only way
   * anybody writes it — and a shorter sum range reads as blank rather than as an error.
   *
   * Unlike the matching above, an error in a cell being SUMMED propagates: the total genuinely
   * cannot be computed, exactly as it cannot for SUM.
   */
  SUMIF: (a, c) => {
    if (a.length < 2 || a.length > 3) return ERR.value()
    const crit = evaluate(a[1], c)
    if (isError(crit)) return crit
    const test = criterionTest(crit)
    const tested = valuesOf(a[0], c)
    const summed = a.length === 3 ? valuesOf(a[2], c) : tested
    let total = 0
    for (let i = 0; i < tested.length; i++) {
      if (!test(tested[i])) continue
      const v = summed[i]
      if (isError(v)) return v
      const n = asNumber(v)
      if (n !== undefined) total += n
    }
    return total
  },
  /**
   * LOOKUPS (#1356) — the gap that made this engine unusable for real business sheets.
   *
   * Everything here has a STATIC dependency: the ranges are written into the formula, so
   * `extractRefs` sees them without evaluating anything. That is the whole reason these are in
   * scope while `INDIRECT`/`OFFSET` remain out — CLAUDE.md excludes those because they make the
   * dependency graph unknowable until evaluation, and none of these do.
   *
   * `VLOOKUP(value, table, col_index, [range_lookup])`. The fourth argument defaults to TRUE, as in
   * Excel — an approximate match over an ascending first column. Almost everybody means FALSE and
   * writes it; the default is kept faithful so an imported sheet computes what it computed before.
   */
  VLOOKUP: (a, c) => {
    if (a.length < 3 || a.length > 4) return ERR.value()
    const target = evaluate(a[0], c)
    if (isError(target)) return target
    const table = matrixOf(a[1], c)
    const colV = evalNum(a[2], c)
    if (isError(colV)) return colV
    const col = Math.trunc(colV)
    if (col < 1) return ERR.value()
    if (col > table.cols) return ERR.ref()
    const approx = a.length === 4 ? logical(evaluate(a[3], c)) : true
    if (isError(approx)) return approx
    const first: CellValue[] = []
    for (let r = 1; r <= table.rows; r++) first.push(at(table, r, 1) ?? '')
    const hit = lookupIndex(target, first, approx ? 1 : 0)
    if (hit === undefined) return ERR.na()
    return at(table, hit + 1, col) ?? ''
  },
  /** `HLOOKUP(value, table, row_index, [range_lookup])` — VLOOKUP with the axes swapped. */
  HLOOKUP: (a, c) => {
    if (a.length < 3 || a.length > 4) return ERR.value()
    const target = evaluate(a[0], c)
    if (isError(target)) return target
    const table = matrixOf(a[1], c)
    const rowV = evalNum(a[2], c)
    if (isError(rowV)) return rowV
    const row = Math.trunc(rowV)
    if (row < 1) return ERR.value()
    if (row > table.rows) return ERR.ref()
    const approx = a.length === 4 ? logical(evaluate(a[3], c)) : true
    if (isError(approx)) return approx
    const first: CellValue[] = []
    for (let k = 1; k <= table.cols; k++) first.push(at(table, 1, k) ?? '')
    const hit = lookupIndex(target, first, approx ? 1 : 0)
    if (hit === undefined) return ERR.na()
    return at(table, row, hit + 1) ?? ''
  },
  /**
   * `INDEX(range, row, [col])`. With a one-dimensional range and a single index the index runs
   * along whichever axis the range has — `INDEX(A1:A9, 3)` and `INDEX(A1:I1, 3)` both mean the
   * third cell, which is how it is written in practice.
   *
   * Excel's `0` (return the whole row or column) is NOT supported: it produces an array, and this
   * engine has no array values — see CLAUDE.md, where spill formulas are a named exclusion. It is
   * `#VALUE!` rather than a quiet wrong answer.
   */
  INDEX: (a, c) => {
    if (a.length < 2 || a.length > 3) return ERR.value()
    const m = matrixOf(a[0], c)
    const i1 = evalNum(a[1], c)
    if (isError(i1)) return i1
    let row = Math.trunc(i1)
    let col = 1
    if (a.length === 3) {
      const i2 = evalNum(a[2], c)
      if (isError(i2)) return i2
      col = Math.trunc(i2)
    } else if (m.rows === 1) {
      col = row
      row = 1
    }
    if (row < 1 || col < 1) return ERR.value()
    const v = at(m, row, col)
    return v === undefined ? ERR.ref() : v
  },
  /**
   * `MATCH(value, range, [match_type])` — the POSITION of a value, which is what makes
   * `INDEX(…, MATCH(…))` work. Defaults to 1 (approximate, ascending) as Excel does.
   */
  MATCH: (a, c) => {
    if (a.length < 2 || a.length > 3) return ERR.value()
    const target = evaluate(a[0], c)
    if (isError(target)) return target
    const m = matrixOf(a[1], c)
    if (m.rows !== 1 && m.cols !== 1) return ERR.na() // a rectangle has no single position
    let mode: 0 | 1 | -1 = 1
    if (a.length === 3) {
      const t = evalNum(a[2], c)
      if (isError(t)) return t
      mode = t > 0 ? 1 : t < 0 ? -1 : 0
    }
    const hit = lookupIndex(target, m.values, mode)
    return hit === undefined ? ERR.na() : hit + 1
  },
  /**
   * `XLOOKUP(value, lookup_range, return_range, [if_not_found])`.
   *
   * Exact match, and no fifth or sixth argument. The modern replacement for VLOOKUP and the one
   * worth having because it removes VLOOKUP's two standing hazards — counting columns by hand, and
   * an approximate default nobody wants. The match modes and search order it also offers are the
   * long tail; this is the 80/20 CLAUDE.md asks for.
   */
  XLOOKUP: (a, c) => {
    if (a.length < 3 || a.length > 4) return ERR.value()
    const target = evaluate(a[0], c)
    if (isError(target)) return target
    const from = matrixOf(a[1], c)
    const to = matrixOf(a[2], c)
    const hit = lookupIndex(target, from.values, 0)
    if (hit === undefined) return a.length === 4 ? evaluate(a[3], c) : ERR.na()
    const v = to.values[hit]
    return v === undefined ? ERR.ref() : v
  },
  /**
   * SUMIFS / COUNTIFS / AVERAGEIFS — the PLURAL forms (#1356).
   *
   * The singular pair landed first and the plural ones are what a real sheet reaches for the moment
   * there are two conditions ("this month AND this region"), which is immediately. Note the argument
   * order flips between them: SUMIF puts its sum range LAST and optional, SUMIFS puts it FIRST and
   * required. That is Excel's inconsistency, not ours, and matching it is the point.
   */
  SUMIFS: (a, c) => conditionalAggregate(a, c, 'sum'),
  AVERAGEIFS: (a, c) => conditionalAggregate(a, c, 'average'),
  COUNTIFS: (a, c) => {
    if (a.length < 2 || a.length % 2 !== 0) return ERR.value()
    const matched = matchIfs(a, 0, c)
    return isError(matched) ? matched : matched.filter(Boolean).length
  },
  /** `AVERAGEIF(range, criteria, [average_range])` — SUMIF's shape, divided by the count. */
  AVERAGEIF: (a, c) => {
    if (a.length < 2 || a.length > 3) return ERR.value()
    const crit = evaluate(a[1], c)
    if (isError(crit)) return crit
    const test = criterionTest(crit)
    const tested = valuesOf(a[0], c)
    const averaged = a.length === 3 ? valuesOf(a[2], c) : tested
    let total = 0
    let n = 0
    for (let i = 0; i < tested.length; i++) {
      if (!test(tested[i])) continue
      const v = averaged[i]
      if (isError(v)) return v
      const x = asNumber(v)
      if (x !== undefined) {
        total += x
        n++
      }
    }
    return n ? total / n : ERR.div0() // Excel's #DIV/0! when nothing matched — an average of nothing
  },
  /**
   * PRODUCT was PROMISED and not implemented (#747).
   *
   * `SYS_TABLES` has always listed it among the functions the AI may use, so a sheet the AI built
   * could contain `=PRODUCT(...)` — which resolved to no entry here and rendered `#NAME?`. An error
   * cell in a document the user did not write, in the one place they had no reason to check.
   *
   * Empty PRODUCT is 0, not 1, matching Excel: `=PRODUCT()` over nothing is not "the empty product".
   */
  PRODUCT: (a, c) => {
    const ns = collectNums(a, c)
    return isError(ns) ? ns : ns.length ? ns.reduce((x, y) => x * y, 1) : 0
  },
  AVERAGE: (a, c) => {
    const ns = collectNums(a, c)
    if (isError(ns)) return ns
    return ns.length ? ns.reduce((x, y) => x + y, 0) / ns.length : ERR.div0()
  },
  // reduce, not Math.min(...ns): spreading ~100k+ args overflows the call stack (a
  // RangeError coerced to #VALUE!), and a range that large is within MAX_RANGE_CELLS.
  MIN: (a, c) => {
    const ns = collectNums(a, c)
    return isError(ns) ? ns : ns.length ? ns.reduce((x, y) => (y < x ? y : x)) : 0
  },
  MAX: (a, c) => {
    const ns = collectNums(a, c)
    return isError(ns) ? ns : ns.length ? ns.reduce((x, y) => (y > x ? y : x)) : 0
  },
  COUNT: (a, c) => collectValues(a, c).filter((v) => typeof v === 'number').length,
  COUNTA: (a, c) => collectValues(a, c).filter((v) => v !== '' && v != null).length,
  ROUND: (a, c) => {
    const x = evalNum(a[0], c)
    const d = a[1] ? evalNum(a[1], c) : 0
    if (isError(x)) return x
    if (isError(d)) return d
    const f = 10 ** d
    // Half AWAY from zero, like Excel — Math.round breaks ties toward +∞, so
    // ROUND(-2.5,0) would give -2 instead of -3. Round the magnitude, re-sign.
    return (Math.sign(x) * Math.round(Math.abs(x) * f)) / f
  },
  ABS: (a, c) => unaryNum(a, c, Math.abs),
  SQRT: (a, c) => unaryNum(a, c, Math.sqrt),
  IF: (a, c) => {
    const t = logical(evaluate(a[0], c))
    if (isError(t)) return t
    return t ? evaluate(a[1], c) : a[2] ? evaluate(a[2], c) : false
  },
  AND: (a, c) => everyBool(a, c, (acc, b) => acc && b, true),
  OR: (a, c) => everyBool(a, c, (acc, b) => acc || b, false),
  NOT: (a, c) => {
    const t = logical(evaluate(a[0], c))
    return isError(t) ? t : !t
  },
  IFERROR: (a, c) => {
    const v = evaluate(a[0], c)
    return isError(v) ? evaluate(a[1], c) : v
  },
  CONCATENATE: (a, c) => a.map((n) => asStr(evaluate(n, c))).join(''),
  CONCAT: (a, c) => a.map((n) => asStr(evaluate(n, c))).join(''),
  LEN: (a, c) => asStr(evaluate(a[0], c)).length,
  UPPER: (a, c) => asStr(evaluate(a[0], c)).toUpperCase(),
  LOWER: (a, c) => asStr(evaluate(a[0], c)).toLowerCase(),
  TRIM: (a, c) => asStr(evaluate(a[0], c)).trim(),

  /**
   * The rest of the everyday arithmetic (#1356). Nothing clever — these are here because a sheet
   * that reaches for `ROUNDUP` or `MOD` and gets `#NAME?` is not a spreadsheet, and each is a line.
   *
   * `INT` truncates toward MINUS INFINITY, not toward zero: `INT(-2.5)` is -3 in Excel, which is
   * `Math.floor`, while `TRUNC` (not offered) would be -2. Getting this backwards is the classic
   * quiet error in a sheet full of negative adjustments.
   */
  ROUNDUP: (a, c) => roundAway(a, c, Math.ceil),
  ROUNDDOWN: (a, c) => roundAway(a, c, Math.floor),
  INT: (a, c) => unaryNum(a, c, Math.floor),
  POWER: (a, c) => {
    const x = evalNum(a[0], c)
    const y = evalNum(a[1], c)
    if (isError(x)) return x
    if (isError(y)) return y
    const r = x ** y
    return Number.isFinite(r) ? r : ERR.num()
  },
  /**
   * `MOD` takes the SIGN OF THE DIVISOR, as Excel and mathematics do — `MOD(-3, 2)` is 1, where
   * JavaScript's `%` gives -1. A remainder that flips sign is how an alternating-row or
   * every-nth-item formula quietly stops working on negative inputs.
   */
  MOD: (a, c) => {
    const x = evalNum(a[0], c)
    const d = evalNum(a[1], c)
    if (isError(x)) return x
    if (isError(d)) return d
    if (d === 0) return ERR.div0()
    return x - d * Math.floor(x / d)
  },
  CEILING: (a, c) => stepTo(a, c, Math.ceil),
  FLOOR: (a, c) => stepTo(a, c, Math.floor),
  /** The middle value — the average's honest companion whenever a couple of outliers skew it. */
  MEDIAN: (a, c) => {
    const ns = collectNums(a, c)
    if (isError(ns)) return ns
    if (!ns.length) return ERR.num()
    const sorted = [...ns].sort((x, y) => x - y)
    const mid = sorted.length >> 1
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
  },

  /**
   * Text extraction (#1356). Every position here is 1-BASED, as in Excel — the single most common
   * off-by-one when these are reimplemented, so it is asserted rather than assumed.
   */
  LEFT: (a, c) => sliceText(a, c, 'left'),
  RIGHT: (a, c) => sliceText(a, c, 'right'),
  MID: (a, c) => {
    const t = asStr(evaluate(a[0], c))
    const start = evalNum(a[1], c)
    const len = evalNum(a[2], c)
    if (isError(start)) return start
    if (isError(len)) return len
    if (start < 1 || len < 0) return ERR.value()
    return t.slice(Math.trunc(start) - 1, Math.trunc(start) - 1 + Math.trunc(len))
  },
  /** `SUBSTITUTE(text, old, new)` replaces EVERY occurrence — the instance argument is not offered. */
  SUBSTITUTE: (a, c) => {
    const t = asStr(evaluate(a[0], c))
    const from = asStr(evaluate(a[1], c))
    const to = asStr(evaluate(a[2], c))
    return from === '' ? t : t.split(from).join(to)
  },
  /** `FIND` is case-SENSITIVE and `SEARCH` is not — the only difference, and Excel's own. */
  FIND: (a, c) => findText(a, c, true),
  SEARCH: (a, c) => findText(a, c, false),

  /**
   * DATES (#1355). A date here is a serial number wearing a date `numFmt` — `dates.ts` explains
   * why, and why the epoch is 1899-12-30 rather than Excel's leap-year-bugged day 1.
   *
   * TODAY and NOW are the only functions in this engine that are not pure, and that is worth
   * naming: the workbook is a DERIVED layer each client recomputes locally rather than a synced
   * one (CLAUDE.md), so two people with the same sheet open compute these independently. They
   * agree on TODAY, which is what anyone depends on; NOW differs by however long apart they
   * pressed a key, exactly as it does in Excel. Nothing is written to the document either way.
   */
  TODAY: () => todaySerial(),
  NOW: () => nowSerial(),
  /** `DATE(year, month, day)`. Out-of-range parts roll over, so DATE(2026,13,1) is January 2027. */
  DATE: (a, c) => {
    if (a.length !== 3) return ERR.value()
    const y = evalNum(a[0], c)
    const m = evalNum(a[1], c)
    const d = evalNum(a[2], c)
    if (isError(y)) return y
    if (isError(m)) return m
    if (isError(d)) return d
    return dateToSerial(Math.trunc(y), Math.trunc(m), Math.trunc(d))
  },
  YEAR: (a, c) => datePart(a, c, 'year'),
  MONTH: (a, c) => datePart(a, c, 'month'),
  DAY: (a, c) => datePart(a, c, 'day'),
  /**
   * `WEEKDAY(serial, [type])`. Type 1 (the default) numbers Sunday as 1; type 2 numbers Monday as
   * 1, which is the one a working week in this region is usually counted with.
   */
  WEEKDAY: (a, c) => {
    const s0 = evalNum(a[0], c)
    if (isError(s0)) return s0
    if (s0 < 0) return ERR.num()
    const type = a[1] ? evalNum(a[1], c) : 1
    if (isError(type)) return type
    const sunday0 = serialToParts(s0).weekday
    return type === 2 ? ((sunday0 + 6) % 7) + 1 : sunday0 + 1
  },
  /** `EDATE(start, months)` — the same day a number of months away, clamped to a real one. */
  EDATE: (a, c) => shiftMonths(a, c, addMonths),
  /** `EOMONTH(start, months)` — the LAST day of that month, which is how a period end is written. */
  EOMONTH: (a, c) => shiftMonths(a, c, endOfMonth),
  /**
   * `DAYS(end, start)` — a plain subtraction, and offered anyway because it says what it means at
   * the point of use where a bare `=B2-A2` does not.
   */
  DAYS: (a, c) => {
    const end = evalNum(a[0], c)
    const start = evalNum(a[1], c)
    if (isError(end)) return end
    if (isError(start)) return start
    return Math.trunc(end) - Math.trunc(start)
  },
}

/** YEAR/MONTH/DAY, which differ only in which part they read back. */
function datePart(args: Node[], ctx: EvalCtx, part: 'year' | 'month' | 'day'): CellValue {
  const s = evalNum(args[0], ctx)
  if (isError(s)) return s
  // A negative serial names no date at all; Excel is #NUM! here and so are we.
  if (s < 0) return ERR.num()
  return serialToParts(s)[part]
}

/** EDATE/EOMONTH, which differ only in where in the target month they land. */
function shiftMonths(args: Node[], ctx: EvalCtx, f: (serial: number, months: number) => number): CellValue {
  const start = evalNum(args[0], ctx)
  const months = args[1] ? evalNum(args[1], ctx) : 0
  if (isError(start)) return start
  if (isError(months)) return months
  if (start < 0) return ERR.num()
  return f(Math.trunc(start), Math.trunc(months))
}

/** ROUNDUP/ROUNDDOWN: away from or toward zero at `d` decimal places, sign preserved. */
function roundAway(args: Node[], ctx: EvalCtx, f: (n: number) => number): CellValue {
  const x = evalNum(args[0], ctx)
  const d = args[1] ? evalNum(args[1], ctx) : 0
  if (isError(x)) return x
  if (isError(d)) return d
  const m = 10 ** Math.trunc(d)
  return (Math.sign(x) * f(Math.abs(x) * m)) / m
}

/** CEILING/FLOOR: to the nearest multiple of `significance`, which defaults to 1. */
function stepTo(args: Node[], ctx: EvalCtx, f: (n: number) => number): CellValue {
  const x = evalNum(args[0], ctx)
  const step = args[1] ? evalNum(args[1], ctx) : 1
  if (isError(x)) return x
  if (isError(step)) return step
  if (step === 0) return 0 // Excel returns 0 rather than #DIV/0! for a zero significance
  return f(x / step) * step
}

function sliceText(args: Node[], ctx: EvalCtx, side: 'left' | 'right'): CellValue {
  const t = asStr(evaluate(args[0], ctx))
  const n = args[1] ? evalNum(args[1], ctx) : 1
  if (isError(n)) return n
  if (n < 0) return ERR.value()
  const k = Math.trunc(n)
  return side === 'left' ? t.slice(0, k) : k === 0 ? '' : t.slice(-k)
}

/** FIND/SEARCH: the 1-based position of `needle`, or #VALUE! when it is not there (as Excel). */
function findText(args: Node[], ctx: EvalCtx, caseSensitive: boolean): CellValue {
  const needle = asStr(evaluate(args[0], ctx))
  const hay = asStr(evaluate(args[1], ctx))
  const from = args[2] ? evalNum(args[2], ctx) : 1
  if (isError(from)) return from
  if (from < 1) return ERR.value()
  const i = caseSensitive
    ? hay.indexOf(needle, Math.trunc(from) - 1)
    : hay.toLowerCase().indexOf(needle.toLowerCase(), Math.trunc(from) - 1)
  return i === -1 ? ERR.value() : i + 1
}

// A logical test (IF/AND/OR/NOT condition) coerces to TRUE/FALSE the SAME way a number does
// (0 = FALSE, non-0 = TRUE), so a non-numeric text condition is #VALUE! — Excel never silently
// treats "x" as TRUE (#423). Reuses `num`, which already maps ''→0, whitespace→#VALUE!, "5"→5.
function logical(v: CellValue): boolean | CellError {
  const n = num(v)
  return isError(n) ? n : n !== 0
}
// Stringify a value the SAME way a cell displays it, so a number reached through
// concatenation / LEN / UPPER etc. doesn't leak IEEE-754 fuzz the display path hides
// (e.g. =(0.1+0.2)&"x" → "0.3x", not "0.30000000000000004x"). Mirrors displayValue.
const asStr = (v: CellValue): string =>
  isError(v)
    ? v.kind
    : v === '' || v == null
      ? ''
      : typeof v === 'number' && !Number.isInteger(v)
        ? String(Math.round(v * 1e10) / 1e10)
        : String(v)

/** A range node with a whole-column/row edge clamped to the cells in use. */
function bounded(n: Extract<Node, { k: 'range' }>, ctx: EvalCtx): { from: Addr; to: Addr } {
  if ((n.to.row < WHOLE && n.to.col < WHOLE) || !ctx.clamp) return { from: n.from, to: n.to }
  return ctx.clamp(n.sheet, n.from, n.to)
}
function rangeValues(n: Extract<Node, { k: 'range' }>, ctx: EvalCtx): CellValue[] {
  const b = bounded(n, ctx)
  return ctx.range(n.sheet, b.from, b.to)
}

function collectValues(args: Node[], ctx: EvalCtx): CellValue[] {
  const out: CellValue[] = []
  for (const n of args) {
    if (n.k === 'range') out.push(...rangeValues(n, ctx))
    else if (n.k === 'array') for (const r of n.rows) for (const x of r) out.push(evaluate(x, ctx))
    else out.push(evaluate(n, ctx))
  }
  return out
}
function collectNums(args: Node[], ctx: EvalCtx): number[] | CellError {
  const out: number[] = []
  for (const v of collectValues(args, ctx)) {
    if (isError(v)) return v
    if (typeof v === 'number') out.push(v)
    else if (typeof v === 'boolean') out.push(v ? 1 : 0)
    // strings/empties are skipped, matching SUM/AVERAGE semantics
  }
  return out
}
/**
 * The values one ARGUMENT spans: a range yields its cells in order, anything else a single value.
 *
 * `collectValues` concatenates every argument into one bag, which is right for SUM and wrong here —
 * SUMIF pairs the nth cell of the test range with the nth cell of the sum range, so the arguments
 * have to stay apart and stay ordered.
 */
function valuesOf(node: Node | undefined, ctx: EvalCtx): CellValue[] {
  if (!node) return []
  if (node.k === 'range') return rangeValues(node, ctx)
  if (node.k === 'array') return node.rows.flat().map((x) => evaluate(x, ctx))
  return [evaluate(node, ctx)]
}

/**
 * One argument as a RECTANGLE rather than a bag of values (#1356).
 *
 * `valuesOf` flattens, which is all SUMIF ever needed. A lookup needs the shape: `VLOOKUP` counts
 * columns across the table, `INDEX` addresses a row and a column, and both are wrong by a whole row
 * if the width is guessed. The width is knowable without evaluating anything — a `range` node
 * carries its two corners — so the shape comes from the AST and the values from `ctx.range`, which
 * fills ROW BY ROW (`engine.ts`) and is what makes the index arithmetic below valid.
 *
 * A single cell or a literal is a 1x1 rectangle, so `INDEX(A1,1,1)` and a stray scalar do not need
 * a separate path.
 */
type Matrix = { values: CellValue[]; rows: number; cols: number }
function matrixOf(node: Node | undefined, ctx: EvalCtx): Matrix {
  if (!node) return { values: [], rows: 0, cols: 0 }
  if (node.k === 'range') {
    const b = bounded(node, ctx)
    const rows = Math.abs(b.to.row - b.from.row) + 1
    const cols = Math.abs(b.to.col - b.from.col) + 1
    return { values: ctx.range(node.sheet, b.from, b.to), rows, cols }
  }
  if (node.k === 'array') {
    const cols = Math.max(0, ...node.rows.map((r) => r.length))
    const values: CellValue[] = []
    for (const r of node.rows) for (let i = 0; i < cols; i++) values.push(r[i] ? evaluate(r[i], ctx) : ERR.na())
    return { values, rows: node.rows.length, cols }
  }
  return { values: [evaluate(node, ctx)], rows: 1, cols: 1 }
}
/** 1-based row/column into a `Matrix`, or undefined when it falls outside. */
function at(m: Matrix, row: number, col: number): CellValue | undefined {
  if (row < 1 || col < 1 || row > m.rows || col > m.cols) return undefined
  return m.values[(row - 1) * m.cols + (col - 1)]
}

/**
 * Ordering for the APPROXIMATE forms of VLOOKUP/HLOOKUP/MATCH — "the largest value not greater than
 * the one I am looking for", over a range the user has sorted.
 *
 * Only like compares with like. Excel orders every number before every piece of text and both before
 * booleans, and reproducing that ordering buys nothing here: a lookup column with numbers and words
 * mixed together is a mistake in the sheet, not a case to be faithful to. Returning `undefined` for
 * an incomparable pair makes those cells simply not candidates, which keeps a stray label in a
 * numeric column from silently becoming the match.
 */
function compareValues(a: CellValue, b: CellValue): number | undefined {
  if (isError(a) || isError(b)) return undefined
  if (typeof a === 'boolean' || typeof b === 'boolean') {
    if (typeof a !== 'boolean' || typeof b !== 'boolean') return undefined
    return a === b ? 0 : a ? 1 : -1
  }
  const na = asNumber(a)
  const nb = asNumber(b)
  if (na !== undefined && nb !== undefined) return na < nb ? -1 : na > nb ? 1 : 0
  if (na !== undefined || nb !== undefined) return undefined
  if (a === '' || a == null || b === '' || b == null) return undefined
  return String(a).toLowerCase().localeCompare(String(b).toLowerCase())
}

/** Exact equality as a lookup means it: numbers by value, text case-insensitively, no wildcards. */
function sameValue(a: CellValue, b: CellValue): boolean {
  if (isError(a) || isError(b)) return false
  if (typeof a === 'boolean' || typeof b === 'boolean') return a === b
  const na = asNumber(a)
  const nb = asNumber(b)
  if (na !== undefined && nb !== undefined) return na === nb
  if (na !== undefined || nb !== undefined) return false
  return String(a ?? '').toLowerCase() === String(b ?? '').toLowerCase()
}

/**
 * The index (0-based, into `line`) that a lookup lands on, or undefined for no match.
 *
 * `mode` follows MATCH's `match_type`, which VLOOKUP's `range_lookup` is a two-valued spelling of:
 * 0 exact, 1 the largest value <= the target in an ascending range, -1 the smallest >= it in a
 * descending one. The scan is linear rather than binary: a sheet whose lookup range is not actually
 * sorted is common, and a linear scan degrades into "no match" there instead of into a confidently
 * wrong row, which is the failure people cannot see.
 */
function lookupIndex(target: CellValue, line: CellValue[], mode: 0 | 1 | -1): number | undefined {
  if (mode === 0) {
    const i = line.findIndex((v) => sameValue(target, v))
    return i === -1 ? undefined : i
  }
  let best: number | undefined
  for (let i = 0; i < line.length; i++) {
    const c = compareValues(line[i], target)
    if (c === undefined) continue
    if (mode === 1 ? c <= 0 : c >= 0) best = i
  }
  return best
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** `*` (any run) and `?` (one character) as Excel means them, with `~` escaping a literal one. */
function wildcardRe(pattern: string): RegExp {
  let out = ''
  for (let i = 0; i < pattern.length; i++) {
    const ch = pattern[i]
    if (ch === '~' && i + 1 < pattern.length) out += escapeRe(pattern[++i])
    else if (ch === '*') out += '.*'
    else if (ch === '?') out += '.'
    else out += escapeRe(ch)
  }
  return new RegExp(`^${out}$`, 'i')
}

/**
 * Turn a COUNTIF/SUMIF criterion into a test.
 *
 * Excel writes the operator INSIDE the string — `">100"`, `"<>Riyadh"`, `"North*"` — so the
 * criterion is parsed, not compared. A bare value (number, or text with no operator) is equality.
 *
 * ERRORS IN THE TESTED RANGE DO NOT MATCH AND DO NOT PROPAGATE, which is deliberate and differs
 * from SUM. `=SUM(A1:A99)` over a range holding one `#DIV/0!` is an error because the sum genuinely
 * cannot be computed; `=COUNTIF(A1:A99,">100")` still can — the broken cell is simply not one of
 * the cells over 100. Propagating here would make the function unusable on any real sheet, where
 * one stale cell somewhere in a long column is normal. (A matched cell being SUMMED is different,
 * and SUMIF does propagate that — see below.)
 */
function criterionTest(crit: CellValue): (v: CellValue) => boolean {
  if (typeof crit === 'number' || typeof crit === 'boolean') {
    const n = typeof crit === 'boolean' ? (crit ? 1 : 0) : crit
    return (v) => !isError(v) && asNumber(v) === n
  }
  const text = String(crit ?? '')
  const m = /^(<=|>=|<>|<|>|=)?([\s\S]*)$/.exec(text)!
  const op = m[1] ?? ''
  const operand = m[2]
  const operandNum = operand.trim() === '' ? NaN : Number(operand)
  const numeric = Number.isFinite(operandNum)

  if (op === '' || op === '=' || op === '<>') {
    const re = numeric ? null : wildcardRe(operand)
    const hit = (v: CellValue) => {
      if (numeric) return asNumber(v) === operandNum
      // An empty criterion matches an empty cell; otherwise text compares case-insensitively.
      if (operand === '') return v === '' || v == null
      return typeof v !== 'boolean' && re!.test(String(v))
    }
    return (v) => (isError(v) ? false : op === '<>' ? !hit(v) : hit(v))
  }

  // A comparison. Numbers compare as numbers, text case-insensitively; blanks take part in
  // neither, matching Excel — an empty cell is not "less than 100".
  return (v) => {
    if (isError(v) || v === '' || v == null) return false
    if (numeric) {
      const n = asNumber(v)
      if (n === undefined) return false
      return op === '<' ? n < operandNum : op === '<=' ? n <= operandNum : op === '>' ? n > operandNum : n >= operandNum
    }
    const c = String(v).toLowerCase().localeCompare(operand.toLowerCase())
    return op === '<' ? c < 0 : op === '<=' ? c <= 0 : op === '>' ? c > 0 : c >= 0
  }
}

/**
 * The rows that satisfy EVERY (range, criterion) pair, as a mask.
 *
 * `start` is where the pairs begin — 0 for COUNTIFS, whose first argument is already a criteria
 * range, and 1 for SUMIFS and AVERAGEIFS, whose first argument is the range being aggregated.
 *
 * The pairs are matched BY POSITION across ranges, the same rule SUMIF uses for its two, and the
 * mask is as long as the LONGEST range: a criteria range shorter than the others then contributes
 * `undefined` there, which no criterion matches, so a mis-sized range narrows the result instead of
 * silently shifting every row after it against the wrong neighbour.
 */
function matchIfs(args: Node[], start: number, ctx: EvalCtx): boolean[] | CellError {
  const pairs: { values: CellValue[]; test: (v: CellValue) => boolean }[] = []
  for (let i = start; i + 1 < args.length; i += 2) {
    const crit = evaluate(args[i + 1], ctx)
    if (isError(crit)) return crit
    pairs.push({ values: valuesOf(args[i], ctx), test: criterionTest(crit) })
  }
  const n = pairs.reduce((max, p) => Math.max(max, p.values.length), 0)
  const mask: boolean[] = []
  for (let i = 0; i < n; i++) mask.push(pairs.every((p) => p.test(p.values[i] as CellValue)))
  return mask
}

/**
 * SUMIFS and AVERAGEIFS over that mask. Both take the aggregated range FIRST, then the pairs.
 *
 * An error in a cell that MATCHED propagates, exactly as it does in SUMIF and for the same reason:
 * the total genuinely cannot be computed. An error in a cell being TESTED does not — see
 * `criterionTest`.
 */
function conditionalAggregate(args: Node[], ctx: EvalCtx, kind: 'sum' | 'average'): CellValue {
  if (args.length < 3 || args.length % 2 === 0) return ERR.value()
  const mask = matchIfs(args, 1, ctx)
  if (isError(mask)) return mask
  const target = valuesOf(args[0], ctx)
  let total = 0
  let n = 0
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i]) continue
    const v = target[i]
    if (isError(v)) return v
    const x = asNumber(v)
    if (x !== undefined) {
      total += x
      n++
    }
  }
  if (kind === 'sum') return total
  return n ? total / n : ERR.div0()
}

/** A cell's numeric value for criterion purposes, or undefined when it simply is not a number. */
function asNumber(v: CellValue): number | undefined {
  if (typeof v === 'number') return v
  if (typeof v === 'boolean') return v ? 1 : 0
  if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v)
  return undefined
}

function reduceNums(args: Node[], ctx: EvalCtx, init: number, f: (acc: number, n: number) => number) {
  const ns = collectNums(args, ctx)
  return isError(ns) ? ns : ns.reduce(f, init)
}
function evalNum(n: Node, ctx: EvalCtx): number | CellError {
  return num(evaluate(n, ctx))
}
function unaryNum(args: Node[], ctx: EvalCtx, f: (n: number) => number): CellValue {
  const x = evalNum(args[0], ctx)
  return isError(x) ? x : f(x)
}
function everyBool(
  args: Node[],
  ctx: EvalCtx,
  f: (acc: boolean, b: boolean) => boolean,
  init: boolean,
): CellValue {
  let acc = init
  let seen = false
  for (const v of collectValues(args, ctx)) {
    if (isError(v)) return v
    // Excel skips blank cells in AND/OR — a single empty cell in a range must not
    // force the result false. Only actual logical values fold into the accumulator.
    if (v === '' || v == null) continue
    const t = logical(v)
    if (isError(t)) return t // a non-numeric text condition is #VALUE!, like Excel (#423)
    acc = f(acc, t)
    seen = true
  }
  return seen ? acc : ERR.value() // no logical values at all → #VALUE!, like Excel
}

/**
 * The function names this engine actually implements (#747).
 *
 * Exported so the Tables system prompt can be checked against it, exactly as `SUPPORTED_TAGS` is for
 * the Write prompt (#646). A prompt is a contract: naming a function we do not have puts `#NAME?`
 * into a document the user did not write.
 */
Object.assign(FUNCS, EXTRA_FUNCS())
export const SUPPORTED_FUNCTIONS: readonly string[] = Object.keys(FUNCS)

export function evaluate(node: Node, ctx: EvalCtx): CellValue {
  switch (node.k) {
    case 'num':
      return node.v
    case 'str':
      return node.v
    case 'bool':
      return node.v
    case 'ref':
      return ctx.cell(node.sheet, node.addr)
    case 'range': {
      // A range used as a scalar: implicit intersection with the formula's own row/column
      // (what Excel does for `=A:A` in row 5), else its top-left.
      const b = bounded(node, ctx)
      const self = ctx.self
      if (self && (!node.sheet || node.sheet === self.sheet)) {
        const r0 = Math.min(b.from.row, b.to.row), r1 = Math.max(b.from.row, b.to.row)
        const c0 = Math.min(b.from.col, b.to.col), c1 = Math.max(b.from.col, b.to.col)
        if (c0 === c1 && self.addr.row >= r0 && self.addr.row <= r1) return ctx.cell(node.sheet, { row: self.addr.row, col: c0 })
        if (r0 === r1 && self.addr.col >= c0 && self.addr.col <= c1) return ctx.cell(node.sheet, { row: r0, col: self.addr.col })
      }
      return ctx.range(node.sheet, b.from, b.to)[0] ?? ''
    }
    case 'err':
      return new CellError(node.v === '#CIRC!' ? '#CIRC!' : node.v)
    case 'array':
      return node.rows[0]?.[0] ? evaluate(node.rows[0][0], ctx) : ERR.value()
    case 'name':
      return ERR.name()
    case 'unary': {
      const x = num(evaluate(node.x, ctx))
      if (isError(x)) return x
      return node.op === '-' ? -x : x
    }
    case 'binary':
      return binop(node.op, node.a, node.b, ctx)
    case 'func': {
      const fn = FUNCS[node.name]
      return fn ? fn(node.args, ctx) : ERR.name()
    }
  }
}

function binop(op: string, aN: Node, bN: Node, ctx: EvalCtx): CellValue {
  const a = evaluate(aN, ctx)
  const b = evaluate(bN, ctx)
  if (isError(a)) return a
  if (isError(b)) return b
  if (op === '&') return asStr(a) + asStr(b)
  if (op === '=' || op === '<>') {
    const eq = looseEq(a, b)
    return op === '=' ? eq : !eq
  }
  if (op === '<' || op === '>' || op === '<=' || op === '>=') {
    const x = num(a)
    const y = num(b)
    if (isError(x)) return x
    if (isError(y)) return y
    return op === '<' ? x < y : op === '>' ? x > y : op === '<=' ? x <= y : x >= y
  }
  const x = num(a)
  const y = num(b)
  if (isError(x)) return x
  if (isError(y)) return y
  switch (op) {
    case '+':
      return x + y
    case '-':
      return x - y
    case '*':
      return x * y
    case '/':
      return y === 0 ? ERR.div0() : x / y
    case '^':
      return x ** y
  }
  return ERR.value()
}

function looseEq(a: CellValue, b: CellValue): boolean {
  // A blank cell is the "empty" of whatever it meets: it equals "", 0 AND FALSE. So
  // =A1=0 on an empty A1 is TRUE (it was FALSE before — inconsistent with =A1="").
  const aBlank = a === '' || a == null
  const bBlank = b === '' || b == null
  if (aBlank && bBlank) return true
  if (aBlank || bBlank) {
    const other = aBlank ? b : a
    if (typeof other === 'number') return other === 0
    if (typeof other === 'boolean') return other === false
    return other === '' // a blank equals an empty string, not a non-empty one
  }
  // Both present: equal only WITHIN a type. A number never equals text (=1="1" is
  // FALSE in Excel); text compares case-insensitively.
  if (typeof a === 'number' && typeof b === 'number') return a === b
  if (typeof a === 'boolean' && typeof b === 'boolean') return a === b
  if (typeof a === 'string' && typeof b === 'string') return a.toLowerCase() === b.toLowerCase()
  return false
}

export { lettersToCol }

// ---- The wider function library --------------------------------------------------
//
// Opening somebody else's workbook is the test this engine has to pass, and a
// function it does not know turns their total into #NAME?. These are the ones a
// sweep of ordinary business workbooks reaches for after the core set above —
// statistics, text, dates, information and the logical family. Three rules hold:
//
// - **Dependencies stay static.** Nothing here needs to evaluate before the
//   engine knows what it reads, which is why INDIRECT and OFFSET are still out.
// - **No spills.** A function that returns an array (SORT, FILTER, UNIQUE) has
//   nowhere to put it in a cell-at-a-time engine, so it is not pretended.
// - **No loan arithmetic.** PMT, IPMT, PPMT, RATE and NPER exist to price
//   interest, which this site does not build tools for (docs/ROADMAP.md "Out of
//   scope"). NPV and IRR measure the return of a cash flow — a business case or a
//   project — and are kept. A workbook using the others opens with #NAME? in
//   those cells, which is honest rather than silent.
function EXTRA_FUNCS(): Record<string, (args: Node[], ctx: EvalCtx) => CellValue> {
  const nums = (a: Node[], c: EvalCtx) => collectNums(a, c)
  const stat = (f: (xs: number[]) => CellValue) => (a: Node[], c: EvalCtx): CellValue => {
    const xs = nums(a, c)
    return isError(xs) ? xs : f(xs)
  }
  const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length
  const variance = (xs: number[], sample: boolean): CellValue => {
    if (xs.length < (sample ? 2 : 1)) return ERR.div0()
    const m = mean(xs)
    return xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - (sample ? 1 : 0))
  }
  const sorted = (xs: number[]) => [...xs].sort((p, q) => p - q)
  const percentile = (xs: number[], k: number): CellValue => {
    if (!xs.length || k < 0 || k > 1) return ERR.num()
    const s = sorted(xs)
    const pos = (s.length - 1) * k
    const lo = Math.floor(pos)
    return s[lo] + (s[Math.min(lo + 1, s.length - 1)] - s[lo]) * (pos - lo)
  }
  const arg = (a: Node[], c: EvalCtx, i: number): CellValue => (a[i] ? evaluate(a[i], c) : '')
  const argNum = (a: Node[], c: EvalCtx, i: number, d?: number): number | CellError => (a[i] === undefined && d !== undefined ? d : evalNum(a[i], c))
  const argStr = (a: Node[], c: EvalCtx, i: number): string | CellError => {
    const v = arg(a, c, i)
    return isError(v) ? v : asStr(v)
  }
  const isBlank = (v: CellValue) => v === '' || v == null
  const minmaxIfs = (kind: 'min' | 'max') => (a: Node[], c: EvalCtx): CellValue => {
    if (a.length < 3 || a.length % 2 === 0) return ERR.value()
    const mask = matchIfs(a, 1, c)
    if (isError(mask)) return mask
    const target = valuesOf(a[0], c)
    let best: number | undefined
    for (let i = 0; i < mask.length; i++) {
      if (!mask[i]) continue
      const v = target[i]
      if (isError(v)) return v
      const x = asNumber(v)
      if (x === undefined) continue
      if (best === undefined || (kind === 'min' ? x < best : x > best)) best = x
    }
    return best ?? 0
  }
  const isWeekend = (serial: number, mask = '0000011') => {
    // `mask` Monday..Sunday, 1 = weekend (NETWORKDAYS.INTL's string form).
    const wd = serialToParts(serial).weekday // 0 Sunday
    return mask[(wd + 6) % 7] === '1'
  }
  // NETWORKDAYS.INTL weekend codes. 1 Sat-Sun is Excel's default; 7 is Fri-Sat, the Saudi week.
  const WEEKEND_CODES: Record<number, string> = { 1: '0000011', 2: '1000001', 3: '1100000', 4: '0110000', 5: '0011000', 6: '0001100', 7: '0000110', 11: '0000001', 12: '1000000', 13: '0100000', 14: '0010000', 15: '0001000', 16: '0000100', 17: '0000010' }
  const weekendMask = (v: CellValue | undefined): string | CellError => {
    if (v === undefined || v === '') return '0000011'
    if (typeof v === 'string' && /^[01]{7}$/.test(v)) return v
    const n = num(v)
    if (isError(n)) return n
    return WEEKEND_CODES[n] ?? ERR.num()
  }
  const holidaySet = (n: Node | undefined, c: EvalCtx) => new Set(valuesOf(n, c).map((v) => asNumber(v)).filter((x): x is number => x !== undefined).map(Math.floor))

  return {
    // -- math
    SUMPRODUCT: (a, c) => {
      const ms = a.map((n) => matrixOf(n, c))
      if (!ms.length) return ERR.value()
      const len = ms[0].values.length
      if (ms.some((m) => m.values.length !== len)) return ERR.value()
      let total = 0
      for (let i = 0; i < len; i++) {
        let p = 1
        for (const m of ms) {
          const v = m.values[i]
          if (isError(v)) return v
          p *= typeof v === 'number' ? v : typeof v === 'boolean' ? (v ? 1 : 0) : 0
        }
        total += p
      }
      return total
    },
    SUMSQ: stat((xs) => xs.reduce((s, x) => s + x * x, 0)),
    SIGN: (a, c) => unaryNum(a, c, Math.sign),
    PI: () => Math.PI,
    EXP: (a, c) => unaryNum(a, c, Math.exp),
    LN: (a, c) => { const x = evalNum(a[0], c); return isError(x) ? x : x <= 0 ? ERR.num() : Math.log(x) },
    LOG10: (a, c) => { const x = evalNum(a[0], c); return isError(x) ? x : x <= 0 ? ERR.num() : Math.log10(x) },
    LOG: (a, c) => {
      const x = evalNum(a[0], c)
      const b = argNum(a, c, 1, 10)
      if (isError(x)) return x
      if (isError(b)) return b
      return x <= 0 || b <= 0 || b === 1 ? ERR.num() : Math.log(x) / Math.log(b)
    },
    TRUNC: (a, c) => {
      const x = evalNum(a[0], c)
      const d = argNum(a, c, 1, 0)
      if (isError(x)) return x
      if (isError(d)) return d
      const f = 10 ** Math.trunc(d)
      return Math.trunc(x * f) / f
    },
    MROUND: (a, c) => {
      const x = evalNum(a[0], c)
      const m = evalNum(a[1], c)
      if (isError(x)) return x
      if (isError(m)) return m
      if (m === 0) return 0
      if (Math.sign(x) * Math.sign(m) < 0) return ERR.num()
      return Math.round(x / m) * m
    },
    EVEN: (a, c) => unaryNum(a, c, (x) => { const r = Math.ceil(Math.abs(x) / 2) * 2; return x < 0 ? -r : r }),
    ODD: (a, c) => unaryNum(a, c, (x) => { let r = Math.ceil(Math.abs(x)); if (r % 2 === 0) r++; return x < 0 ? -r : r }),
    FACT: (a, c) => { const x = evalNum(a[0], c); if (isError(x)) return x; if (x < 0) return ERR.num(); let f = 1; for (let i = 2; i <= Math.floor(x); i++) f *= i; return f },
    GCD: stat((xs) => { if (xs.some((x) => x < 0)) return ERR.num(); const g = (p: number, q: number): number => (q ? g(q, p % q) : p); return xs.map(Math.floor).reduce(g, 0) }),
    LCM: stat((xs) => { if (xs.some((x) => x < 0)) return ERR.num(); const g = (p: number, q: number): number => (q ? g(q, p % q) : p); return xs.map(Math.floor).reduce((p, q) => (p && q ? (p * q) / g(p, q) : 0), 1) }),
    QUOTIENT: (a, c) => { const x = evalNum(a[0], c); const y = evalNum(a[1], c); if (isError(x)) return x; if (isError(y)) return y; return y === 0 ? ERR.div0() : Math.trunc(x / y) },
    RAND: () => Math.random(),
    RANDBETWEEN: (a, c) => { const lo = evalNum(a[0], c); const hi = evalNum(a[1], c); if (isError(lo)) return lo; if (isError(hi)) return hi; if (hi < lo) return ERR.num(); return Math.floor(Math.ceil(lo) + Math.random() * (Math.floor(hi) - Math.ceil(lo) + 1)) },
    RADIANS: (a, c) => unaryNum(a, c, (x) => (x * Math.PI) / 180),
    DEGREES: (a, c) => unaryNum(a, c, (x) => (x * 180) / Math.PI),
    SIN: (a, c) => unaryNum(a, c, Math.sin),
    COS: (a, c) => unaryNum(a, c, Math.cos),
    TAN: (a, c) => unaryNum(a, c, Math.tan),
    ASIN: (a, c) => unaryNum(a, c, Math.asin),
    ACOS: (a, c) => unaryNum(a, c, Math.acos),
    ATAN: (a, c) => unaryNum(a, c, Math.atan),
    ATAN2: (a, c) => { const x = evalNum(a[0], c); const y = evalNum(a[1], c); if (isError(x)) return x; if (isError(y)) return y; return x === 0 && y === 0 ? ERR.div0() : Math.atan2(y, x) },
    // -- statistics
    COUNTBLANK: (a, c) => valuesOf(a[0], c).filter(isBlank).length,
    LARGE: (a, c) => { const xs = collectNums([a[0]], c); const k = evalNum(a[1], c); if (isError(xs)) return xs; if (isError(k)) return k; const s = sorted(xs).reverse(); return k >= 1 && k <= s.length ? s[Math.ceil(k) - 1] : ERR.num() },
    SMALL: (a, c) => { const xs = collectNums([a[0]], c); const k = evalNum(a[1], c); if (isError(xs)) return xs; if (isError(k)) return k; const s = sorted(xs); return k >= 1 && k <= s.length ? s[Math.ceil(k) - 1] : ERR.num() },
    RANK: (a, c) => rank(a, c),
    'RANK.EQ': (a, c) => rank(a, c),
    STDEV: stat((xs) => { const v = variance(xs, true); return isError(v) ? v : Math.sqrt(v as number) }),
    'STDEV.S': stat((xs) => { const v = variance(xs, true); return isError(v) ? v : Math.sqrt(v as number) }),
    STDEVP: stat((xs) => { const v = variance(xs, false); return isError(v) ? v : Math.sqrt(v as number) }),
    'STDEV.P': stat((xs) => { const v = variance(xs, false); return isError(v) ? v : Math.sqrt(v as number) }),
    VAR: stat((xs) => variance(xs, true)),
    'VAR.S': stat((xs) => variance(xs, true)),
    VARP: stat((xs) => variance(xs, false)),
    'VAR.P': stat((xs) => variance(xs, false)),
    MODE: stat((xs) => mode(xs)),
    'MODE.SNGL': stat((xs) => mode(xs)),
    GEOMEAN: stat((xs) => (!xs.length || xs.some((x) => x <= 0) ? ERR.num() : Math.exp(xs.reduce((s, x) => s + Math.log(x), 0) / xs.length))),
    PERCENTILE: (a, c) => { const xs = collectNums([a[0]], c); const k = evalNum(a[1], c); if (isError(xs)) return xs; if (isError(k)) return k; return percentile(xs, k) },
    'PERCENTILE.INC': (a, c) => { const xs = collectNums([a[0]], c); const k = evalNum(a[1], c); if (isError(xs)) return xs; if (isError(k)) return k; return percentile(xs, k) },
    QUARTILE: (a, c) => { const xs = collectNums([a[0]], c); const q = evalNum(a[1], c); if (isError(xs)) return xs; if (isError(q)) return q; return q < 0 || q > 4 ? ERR.num() : percentile(xs, Math.floor(q) / 4) },
    'QUARTILE.INC': (a, c) => { const xs = collectNums([a[0]], c); const q = evalNum(a[1], c); if (isError(xs)) return xs; if (isError(q)) return q; return q < 0 || q > 4 ? ERR.num() : percentile(xs, Math.floor(q) / 4) },
    CORREL: (a, c) => {
      const x = valuesOf(a[0], c)
      const y = valuesOf(a[1], c)
      if (x.length !== y.length) return ERR.na()
      const px: number[] = []
      const py: number[] = []
      for (let i = 0; i < x.length; i++) if (typeof x[i] === 'number' && typeof y[i] === 'number') { px.push(x[i] as number); py.push(y[i] as number) }
      if (px.length < 2) return ERR.div0()
      const mx = mean(px), my = mean(py)
      let sxy = 0, sxx = 0, syy = 0
      for (let i = 0; i < px.length; i++) { sxy += (px[i] - mx) * (py[i] - my); sxx += (px[i] - mx) ** 2; syy += (py[i] - my) ** 2 }
      return sxx && syy ? sxy / Math.sqrt(sxx * syy) : ERR.div0()
    },
    MAXIFS: minmaxIfs('max'),
    MINIFS: minmaxIfs('min'),
    COUNTA: (a, c) => collectValues(a, c).filter((v) => !isBlank(v)).length,
    // -- logical
    IFS: (a, c) => {
      for (let i = 0; i + 1 < a.length; i += 2) {
        const t = logical(evaluate(a[i], c))
        if (isError(t)) return t
        if (t) return evaluate(a[i + 1], c)
      }
      return ERR.na()
    },
    SWITCH: (a, c) => {
      const v = evaluate(a[0], c)
      if (isError(v)) return v
      let i = 1
      for (; i + 1 < a.length; i += 2) if (looseEq(v, evaluate(a[i], c))) return evaluate(a[i + 1], c)
      return i < a.length ? evaluate(a[i], c) : ERR.na()
    },
    CHOOSE: (a, c) => { const k = evalNum(a[0], c); if (isError(k)) return k; const i = Math.floor(k); return i >= 1 && i < a.length ? evaluate(a[i], c) : ERR.value() },
    IFNA: (a, c) => { const v = evaluate(a[0], c); return isError(v) && v.kind === '#N/A' ? evaluate(a[1], c) : v },
    XOR: (a, c) => { let n = 0; for (const v of collectValues(a, c)) { if (isError(v)) return v; if (isBlank(v)) continue; const t = logical(v); if (isError(t)) return t; if (t) n++ } return n % 2 === 1 },
    TRUE: () => true,
    FALSE: () => false,
    NA: () => ERR.na(),
    // -- information
    ISBLANK: (a, c) => isBlank(arg(a, c, 0)),
    ISNUMBER: (a, c) => typeof arg(a, c, 0) === 'number',
    ISTEXT: (a, c) => { const v = arg(a, c, 0); return typeof v === 'string' && v !== '' },
    ISNONTEXT: (a, c) => { const v = arg(a, c, 0); return !(typeof v === 'string' && v !== '') },
    ISLOGICAL: (a, c) => typeof arg(a, c, 0) === 'boolean',
    ISERROR: (a, c) => isError(arg(a, c, 0)),
    ISERR: (a, c) => { const v = arg(a, c, 0); return isError(v) && v.kind !== '#N/A' },
    ISNA: (a, c) => { const v = arg(a, c, 0); return isError(v) && v.kind === '#N/A' },
    ISEVEN: (a, c) => { const x = evalNum(a[0], c); return isError(x) ? x : Math.floor(Math.abs(x)) % 2 === 0 },
    ISODD: (a, c) => { const x = evalNum(a[0], c); return isError(x) ? x : Math.floor(Math.abs(x)) % 2 === 1 },
    TYPE: (a, c) => { const v = arg(a, c, 0); return isError(v) ? 16 : typeof v === 'number' ? 1 : typeof v === 'boolean' ? 4 : 2 },
    'ERROR.TYPE': (a, c) => { const v = arg(a, c, 0); const map: Record<string, number> = { '#NULL!': 1, '#DIV/0!': 2, '#VALUE!': 3, '#REF!': 4, '#NAME?': 5, '#NUM!': 6, '#N/A': 7 }; return isError(v) ? map[v.kind] ?? ERR.na() : ERR.na() },
    N: (a, c) => { const v = arg(a, c, 0); return isError(v) ? v : typeof v === 'number' ? v : v === true ? 1 : 0 },
    T: (a, c) => { const v = arg(a, c, 0); return isError(v) ? v : typeof v === 'string' ? v : '' },
    // -- text
    VALUE: (a, c) => { const v = arg(a, c, 0); if (isError(v)) return v; if (typeof v === 'number') return v; const t = String(v).trim().replace(/,/g, ''); if (/%$/.test(t) && Number.isFinite(Number(t.slice(0, -1)))) return Number(t.slice(0, -1)) / 100; const d = parseIsoDate(t); if (d !== null) return d; const n = Number(t); return t !== '' && Number.isFinite(n) ? n : ERR.value() },
    NUMBERVALUE: (a, c) => { const t = argStr(a, c, 0); if (isError(t)) return t; const dec = a[1] ? asStr(evaluate(a[1], c)) : '.'; const grp = a[2] ? asStr(evaluate(a[2], c)) : ','; const clean = t.split(grp).join('').replace(dec, '.').trim(); const n = Number(clean); return clean && Number.isFinite(n) ? n : ERR.value() },
    REPT: (a, c) => { const t = argStr(a, c, 0); const n = evalNum(a[1], c); if (isError(t)) return t; if (isError(n)) return n; if (n < 0 || t.length * n > 32767) return ERR.value(); return t.repeat(Math.floor(n)) },
    PROPER: (a, c) => { const t = argStr(a, c, 0); return isError(t) ? t : t.toLowerCase().replace(/(^|[^\p{L}])(\p{L})/gu, (_m, p, l) => p + l.toUpperCase()) },
    EXACT: (a, c) => { const x = argStr(a, c, 0); const y = argStr(a, c, 1); if (isError(x)) return x; if (isError(y)) return y; return x === y },
    CHAR: (a, c) => { const x = evalNum(a[0], c); return isError(x) ? x : x < 1 || x > 255 ? ERR.value() : String.fromCharCode(x) },
    UNICHAR: (a, c) => { const x = evalNum(a[0], c); if (isError(x)) return x; try { return String.fromCodePoint(Math.floor(x)) } catch { return ERR.value() } },
    CODE: (a, c) => { const t = argStr(a, c, 0); return isError(t) ? t : t ? t.charCodeAt(0) : ERR.value() },
    UNICODE: (a, c) => { const t = argStr(a, c, 0); return isError(t) ? t : t ? t.codePointAt(0)! : ERR.value() },
    CLEAN: (a, c) => { const t = argStr(a, c, 0); return isError(t) ? t : t.replace(/[\x00-\x1f]/g, '') }, // eslint-disable-line no-control-regex
    REPLACE: (a, c) => { const t = argStr(a, c, 0); const s = evalNum(a[1], c); const n = evalNum(a[2], c); const r = argStr(a, c, 3); if (isError(t)) return t; if (isError(s)) return s; if (isError(n)) return n; if (isError(r)) return r; if (s < 1 || n < 0) return ERR.value(); return t.slice(0, s - 1) + r + t.slice(s - 1 + n) },
    TEXTJOIN: (a, c) => {
      const d = argStr(a, c, 0)
      if (isError(d)) return d
      const skip = logical(arg(a, c, 1))
      if (isError(skip)) return skip
      const parts: string[] = []
      for (const v of collectValues(a.slice(2), c)) { if (isError(v)) return v; if (skip && isBlank(v)) continue; parts.push(asStr(v)) }
      return parts.join(d)
    },
    TEXT: (a, c) => { const v = arg(a, c, 0); const f = argStr(a, c, 1); if (isError(v)) return v; if (isError(f)) return f; return formatCode(v, f) },
    FIXED: (a, c) => { const x = evalNum(a[0], c); const d = argNum(a, c, 1, 2); if (isError(x)) return x; if (isError(d)) return d; const noCommas = a[2] ? logical(evaluate(a[2], c)) === true : false; return x.toLocaleString('en-US', { minimumFractionDigits: Math.max(0, d), maximumFractionDigits: Math.max(0, d), useGrouping: !noCommas }) },
    HYPERLINK: (a, c) => (a[1] ? evaluate(a[1], c) : arg(a, c, 0)),
    // -- dates and times
    TIME: (a, c) => { const h = evalNum(a[0], c); const m = evalNum(a[1], c); const s2 = evalNum(a[2], c); if (isError(h)) return h; if (isError(m)) return m; if (isError(s2)) return s2; const t = (h * 3600 + m * 60 + s2) / 86400; return t < 0 ? ERR.num() : t - Math.floor(t) },
    HOUR: (a, c) => unaryNum(a, c, (x) => Math.floor(((x % 1) + 1e-9) * 24) % 24),
    MINUTE: (a, c) => unaryNum(a, c, (x) => Math.floor(((x % 1) * 1440) + 1e-6) % 60),
    SECOND: (a, c) => unaryNum(a, c, (x) => Math.round((x % 1) * 86400) % 60),
    DATEVALUE: (a, c) => { const t = argStr(a, c, 0); if (isError(t)) return t; const d = parseIsoDate(t) ?? parseLooseDate(t); return d ?? ERR.value() },
    TIMEVALUE: (a, c) => { const t = argStr(a, c, 0); if (isError(t)) return t; const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)?$/i.exec(t.trim()); if (!m) return ERR.value(); let h = Number(m[1]); if (m[4]) { h %= 12; if (/pm/i.test(m[4])) h += 12 } return (h * 3600 + Number(m[2]) * 60 + Number(m[3] || 0)) / 86400 },
    WEEKNUM: (a, c) => { const x = evalNum(a[0], c); const t = argNum(a, c, 1, 1); if (isError(x)) return x; if (isError(t)) return t; const p = serialToParts(x); const jan1 = dateToSerial(p.year, 1, 1); const startDow = t === 2 ? 1 : 0; const off = (serialToParts(jan1).weekday - startDow + 7) % 7; return Math.floor((Math.floor(x) - jan1 + off) / 7) + 1 },
    ISOWEEKNUM: (a, c) => unaryNum(a, c, (x) => { const d = Math.floor(x); const wd = (serialToParts(d).weekday + 6) % 7; const thu = d - wd + 3; const y = serialToParts(thu).year; return Math.floor((thu - dateToSerial(y, 1, 1)) / 7) + 1 }),
    NETWORKDAYS: (a, c) => networkdays(a[0], a[1], undefined, a[2], c),
    'NETWORKDAYS.INTL': (a, c) => networkdays(a[0], a[1], a[2], a[3], c),
    WORKDAY: (a, c) => workday(a[0], a[1], undefined, a[2], c),
    'WORKDAY.INTL': (a, c) => workday(a[0], a[1], a[2], a[3], c),
    DATEDIF: (a, c) => {
      const s1 = evalNum(a[0], c), e1 = evalNum(a[1], c)
      const u = argStr(a, c, 2)
      if (isError(s1)) return s1; if (isError(e1)) return e1; if (isError(u)) return u
      if (e1 < s1) return ERR.num()
      const p = serialToParts(s1), q = serialToParts(e1)
      let months = (q.year - p.year) * 12 + (q.month - p.month)
      if (q.day < p.day) months--
      switch (u.toUpperCase()) {
        case 'D': return Math.floor(e1) - Math.floor(s1)
        case 'M': return months
        case 'Y': return Math.floor(months / 12)
        case 'YM': return months % 12
        case 'MD': { const anchor = addMonths(Math.floor(s1), months); return Math.floor(e1) - anchor }
        case 'YD': { const anchor = addMonths(Math.floor(s1), Math.floor(months / 12) * 12); return Math.floor(e1) - anchor }
      }
      return ERR.num()
    },
    YEARFRAC: (a, c) => {
      const s1 = evalNum(a[0], c), e1 = evalNum(a[1], c)
      const basis = argNum(a, c, 2, 0)
      if (isError(s1)) return s1; if (isError(e1)) return e1; if (isError(basis)) return basis
      const [lo, hi] = s1 <= e1 ? [s1, e1] : [e1, s1]
      if (basis === 1 || basis === 3) return (hi - lo) / (basis === 3 ? 365 : 365.25)
      if (basis === 2) return (hi - lo) / 360
      // 30/360 US
      const p = serialToParts(lo), q = serialToParts(hi)
      const d1 = Math.min(p.day, 30)
      const d2 = q.day === 31 && d1 >= 30 ? 30 : q.day
      return ((q.year - p.year) * 360 + (q.month - p.month) * 30 + (d2 - d1)) / 360
    },
    // -- reference
    ROW: (a, c) => { const n = a[0]; if (n && (n.k === 'ref')) return n.addr.row + 1; if (n && n.k === 'range') return Math.min(n.from.row, n.to.row) + 1; return c.self ? c.self.addr.row + 1 : ERR.value() },
    COLUMN: (a, c) => { const n = a[0]; if (n && (n.k === 'ref')) return n.addr.col + 1; if (n && n.k === 'range') return Math.min(n.from.col, n.to.col) + 1; return c.self ? c.self.addr.col + 1 : ERR.value() },
    ROWS: (a, c) => { const m = matrixOf(a[0], c); return m.rows },
    COLUMNS: (a, c) => { const m = matrixOf(a[0], c); return m.cols },
    LOOKUP: (a, c) => {
      const key = evaluate(a[0], c)
      if (isError(key)) return key
      const look = matrixOf(a[1], c)
      const line = look.rows === 1 ? look.values : look.cols === 1 ? look.values : Array.from({ length: look.rows }, (_, i) => look.values[i * look.cols])
      const i = lookupIndex(key, line, 1)
      if (i === undefined) return ERR.na()
      if (a[2]) { const res = valuesOf(a[2], c); return res[i] ?? ERR.na() }
      if (look.rows === 1 || look.cols === 1) return line[i]
      return look.values[i * look.cols + look.cols - 1]
    },
    // -- cash flows
    NPV: (a, c) => {
      const r = evalNum(a[0], c)
      if (isError(r)) return r
      const flows = collectNums(a.slice(1), c)
      if (isError(flows)) return flows
      return flows.reduce((s, x, i) => s + x / (1 + r) ** (i + 1), 0)
    },
    IRR: (a, c) => {
      const flows = collectNums([a[0]], c)
      if (isError(flows)) return flows
      if (!flows.some((x) => x > 0) || !flows.some((x) => x < 0)) return ERR.num()
      let r = a[1] ? (evalNum(a[1], c) as number) : 0.1
      if (typeof r !== 'number' || !Number.isFinite(r)) r = 0.1
      for (let it = 0; it < 100; it++) {
        let f = 0, df = 0
        for (let i = 0; i < flows.length; i++) { f += flows[i] / (1 + r) ** i; df -= (i * flows[i]) / (1 + r) ** (i + 1) }
        if (Math.abs(f) < 1e-10) return r
        if (df === 0) break
        const next = r - f / df
        if (!Number.isFinite(next) || next <= -1) break
        if (Math.abs(next - r) < 1e-12) return next
        r = next
      }
      return ERR.num()
    },
  }

  function rank(a: Node[], c: EvalCtx): CellValue {
    const x = evalNum(a[0], c)
    if (isError(x)) return x
    const xs = collectNums([a[1]], c)
    if (isError(xs)) return xs
    const asc = a[2] ? evalNum(a[2], c) : 0
    if (isError(asc)) return asc
    if (!xs.includes(x)) return ERR.na()
    return 1 + xs.filter((y) => (asc ? y < x : y > x)).length
  }
  function mode(xs: number[]): CellValue {
    const counts = new Map<number, number>()
    let best: number | undefined
    let bestN = 1
    for (const x of xs) {
      const n = (counts.get(x) || 0) + 1
      counts.set(x, n)
      if (n > bestN) { bestN = n; best = x }
    }
    return best ?? ERR.na()
  }
  function networkdays(s0: Node, e0: Node, w: Node | undefined, h: Node | undefined, c: EvalCtx): CellValue {
    const s1 = evalNum(s0, c), e1 = evalNum(e0, c)
    if (isError(s1)) return s1
    if (isError(e1)) return e1
    const mask = weekendMask(w ? evaluate(w, c) : undefined)
    if (isError(mask)) return mask
    const hol = holidaySet(h, c)
    const [lo, hi, sign] = s1 <= e1 ? [Math.floor(s1), Math.floor(e1), 1] : [Math.floor(e1), Math.floor(s1), -1]
    if (hi - lo > 200_000) return ERR.num()
    let n = 0
    for (let d = lo; d <= hi; d++) if (!isWeekend(d, mask) && !hol.has(d)) n++
    return n * sign
  }
  function workday(s0: Node, d0: Node, w: Node | undefined, h: Node | undefined, c: EvalCtx): CellValue {
    const s1 = evalNum(s0, c), days = evalNum(d0, c)
    if (isError(s1)) return s1
    if (isError(days)) return days
    const mask = weekendMask(w ? evaluate(w, c) : undefined)
    if (isError(mask)) return mask
    if (mask === '1111111') return ERR.value()
    const hol = holidaySet(h, c)
    let d = Math.floor(s1)
    let left = Math.trunc(days)
    const step = left < 0 ? -1 : 1
    while (left !== 0) {
      d += step
      if (!isWeekend(d, mask) && !hol.has(d)) left -= step
      if (Math.abs(d - s1) > 400_000) return ERR.num()
    }
    return d
  }
}

/** D/M/YYYY and M/D/YYYY are ambiguous; DATEVALUE accepts only forms with a named month. */
function parseLooseDate(t: string): number | null {
  const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
  const m = /^(\d{1,2})[\s-]+([A-Za-z]{3,9})[\s-,]+(\d{4})$/.exec(t.trim()) || /^([A-Za-z]{3,9})[\s-]+(\d{1,2}),?[\s-]+(\d{4})$/.exec(t.trim())
  if (!m) return null
  const isDayFirst = /^\d/.test(m[1])
  const name = (isDayFirst ? m[2] : m[1]).slice(0, 3).toLowerCase()
  const mi = months.indexOf(name)
  if (mi < 0) return null
  const day = Number(isDayFirst ? m[1] : m[2])
  return dateToSerial(Number(m[3]), mi + 1, day)
}
