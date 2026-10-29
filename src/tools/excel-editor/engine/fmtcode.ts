// Excel number format CODES — `#,##0.00`, `0%`, `[Red]-#,##0;0`, `dd/mm/yyyy hh:mm`,
// `"SAR "#,##0` — rendered the way Excel renders them.
//
// The format is half of what a cell SAYS. An imported workbook stores 0.075 and a
// code `0.0%`, and showing "0.075" is showing the wrong number to everyone who
// reads it. So this is not a nicety for TEXT(); it is the display path for every
// cell that came from a file. It is pure (dates.ts only) so the formula engine
// can call it without an import cycle, and it is exhaustively unit-tested.
//
// What it covers: up to four sections (positive;negative;zero;text) and
// conditional sections (`[<1000]0;0,"K"`), digit placeholders 0 # ?, grouping and
// thousands-scaling commas, percent, scientific E±, fractions, quoted and escaped
// literals, `_x` padding and `*x` fill (both rendered as nothing / a space —
// there is no column width to fill to), colours, locale and currency markers
// `[$SAR-401]`, `@` text, and every date/time token including elapsed `[h]:mm`.
import { serialToParts } from './dates'

export interface Formatted { text: string; color?: string }

const COLORS: Record<string, string> = { black: '#000000', blue: '#0000ff', cyan: '#00ffff', green: '#008000', magenta: '#ff00ff', red: '#ff0000', white: '#ffffff', yellow: '#ffff00' }

interface Section { code: string; color?: string; cond?: { op: string; v: number } }

function splitSections(code: string): string[] {
  const out: string[] = []
  let cur = ''
  let q = false
  for (let i = 0; i < code.length; i++) {
    const ch = code[i]
    if (ch === '"') q = !q
    if (ch === '\\' && i + 1 < code.length) { cur += ch + code[++i]; continue }
    if (ch === ';' && !q) { out.push(cur); cur = ''; continue }
    cur += ch
  }
  out.push(cur)
  return out
}

function parseSection(raw: string): Section {
  let code = raw
  let color: string | undefined
  let cond: Section['cond']
  code = code.replace(/\[(black|blue|cyan|green|magenta|red|white|yellow|color\s*\d+)\]/gi, (_m, c: string) => {
    color = COLORS[c.toLowerCase()] || color
    return ''
  })
  code = code.replace(/\[(<=|>=|<>|<|>|=)\s*(-?[\d.]+)\]/, (_m, op: string, v: string) => { cond = { op, v: Number(v) }; return '' })
  return { code, color, cond }
}

const testCond = (c: Section['cond'], v: number) => {
  if (!c) return true
  switch (c.op) {
    case '<': return v < c.v
    case '<=': return v <= c.v
    case '>': return v > c.v
    case '>=': return v >= c.v
    case '=': return v === c.v
    case '<>': return v !== c.v
  }
  return true
}

/** Is this code a date/time format? (Decides whether a number is shown as a date.) */
export function isDateCode(code: string): boolean {
  const stripped = code.replace(/"[^"]*"/g, '').replace(/\\./g, '').replace(/\[[^\]]*\]/g, (m) => (/^\[(h+|m+|s+)\]$/i.test(m) ? 'h' : ''))
  return /[dmyhs]/i.test(stripped.replace(/General/gi, '').replace(/E[+-]/g, ''))
}

/** Format a value with an Excel format code. Strings go through the text section (or `@`). */
export function formatCode(value: unknown, code: string): string { return formatCodeColor(value, code).text }

export function formatCodeColor(value: unknown, code: string): Formatted {
  if (value === null || value === undefined || value === '') return { text: '' }
  if (typeof value === 'boolean') return { text: value ? 'TRUE' : 'FALSE' }
  const sections = splitSections(code || 'General').map(parseSection)
  if (typeof value === 'string') {
    const text = sections.length >= 4 ? sections[3] : sections.find((s) => s.code.includes('@'))
    if (!text) return { text: value }
    return { text: literalWalk(text.code, value), color: text.color }
  }
  if (typeof value !== 'number' || !Number.isFinite(value)) return { text: String(value) }
  // Pick the section.
  let sec: Section
  let v = value
  let negAuto = false
  const hasConds = sections.some((s) => s.cond)
  if (hasConds) {
    sec = sections.find((s) => s.cond && testCond(s.cond, value)) || sections.find((s) => !s.cond) || sections[0]
    if (value < 0 && !sec.cond) negAuto = true
  } else if (value > 0 || sections.length === 1) {
    sec = sections[0]
    if (value < 0) negAuto = true
  } else if (value < 0) {
    sec = sections[1] || sections[0]
    if (sections.length >= 2) v = -value
    else negAuto = true
  } else {
    sec = sections[2] || sections[0]
  }
  if (negAuto) v = -value
  const body = renderNumber(v, sec.code)
  return { text: (negAuto && body !== '' && !/^[0.,%\s]*$/.test(body.replace(/[^\d.,%\s]/g, '')) ? '-' : negAuto && Math.abs(value) > 0 && /[1-9]/.test(body) ? '-' : '') + body, color: sec.color }
}

function generalNumber(v: number): string {
  if (v === 0) return '0'
  const a = Math.abs(v)
  if (a >= 1e11 || a < 1e-9) {
    const s = v.toExponential(5).replace(/\.?0+e/, 'E').replace('e', 'E')
    return s.replace(/E([+-])(\d)$/, 'E$10$2').replace(/E(\d)/, 'E+$1')
  }
  const r = Math.round(v * 1e10) / 1e10
  let s = String(r)
  if (s.length > 11 && s.includes('.')) s = String(Number(r.toPrecision(10)))
  return s
}

function renderNumber(v: number, code: string): string {
  if (/^\s*General\s*$/i.test(code) || code.trim() === '') return generalNumber(v)
  if (isDateCode(code)) return renderDate(v, code)
  // Strip locale/currency markers, keeping the currency symbol.
  code = code.replace(/\[\$([^\]-]*)(?:-[^\]]*)?\]/g, (_m, sym: string) => (sym ? `"${sym}"` : ''))
  code = code.replace(/\[[^\]]*\]/g, '')
  // Tokenise into literal text and the numeric picture.
  const toks: { lit?: string; pic?: string }[] = []
  let pic = ''
  const flushPic = () => { if (pic) { toks.push({ pic }); pic = '' } }
  for (let i = 0; i < code.length; i++) {
    const ch = code[i]
    if (ch === '"') {
      const e = code.indexOf('"', i + 1)
      flushPic()
      toks.push({ lit: code.slice(i + 1, e < 0 ? code.length : e) })
      i = e < 0 ? code.length : e
    } else if (ch === '\\') {
      flushPic()
      toks.push({ lit: code[++i] ?? '' })
    } else if (ch === '_') {
      flushPic()
      toks.push({ lit: ' ' })
      i++
    } else if (ch === '*') {
      flushPic()
      i++
    } else if (ch === '%') {
      flushPic()
      toks.push({ lit: '%' })
    } else if (/\d/.test(ch) && /\/\d*$/.test(pic)) {
      pic += ch // a fixed denominator, `?/4`
    } else if ('0#?.,Ee+-/ '.includes(ch) && !(ch === ' ' && !pic) && !(ch === '-' && !/[Ee]$/.test(pic) && !pic) && !(ch === '+' && !/[Ee]$/.test(pic))) {
      if ((ch === '-' || ch === '+') && !/[Ee]$/.test(pic)) { flushPic(); toks.push({ lit: ch }); continue }
      if (ch === ' ' && !/[0#?]/.test(code.slice(i + 1, i + 2)) && !/\//.test(code.slice(i))) { flushPic(); toks.push({ lit: ' ' }); continue }
      pic += ch
    } else {
      flushPic()
      toks.push({ lit: ch })
    }
  }
  flushPic()
  let picture = toks.filter((t) => t.pic).map((t) => t.pic).join('')
  const pct = toks.filter((t) => t.lit === '%').length
  let x = v * 100 ** pct
  // Thousands scaling: commas immediately left of the decimal point, or at the end
  // of the picture, each divide by 1000 (`#,##0,` shows thousands, `0.0,,` millions).
  const trailing = /,+$/.exec(picture)?.[0].length || 0
  const beforeDot = /(,+)\./.exec(picture)?.[1].length || 0
  const scale = trailing || beforeDot
  if (scale) { x /= 1000 ** scale; picture = picture.replace(/,+(?=\.|$)/, '') }
  let numText: string
  if (/[Ee][+-]/.test(picture)) numText = renderScientific(x, picture)
  else if (/\//.test(picture)) numText = renderFraction(x, picture)
  else numText = renderPlain(x, picture.replace(/%/g, ''))
  // Reassemble: the numeric picture appears once; literals before/after stay put.
  let out = ''
  let placed = false
  for (const t of toks) {
    if (t.lit !== undefined) out += t.lit
    else if (!placed) { out += numText; placed = true }
  }
  return out
}

function renderPlain(x: number, picture: string): string {
  const [ip = '', dp = ''] = picture.split('.')
  const decimals = dp.replace(/[^0#?]/g, '')
  const intDigits = ip.replace(/[^0#?]/g, '')
  const grouping = /[0#?],[0#?]/.test(ip)
  const minDec = (decimals.match(/0/g) || []).length
  const maxDec = decimals.length
  const fixed = Math.abs(x).toFixed(maxDec)
  let [ints, decs = ''] = fixed.split('.')
  // Trim optional trailing decimals (# and ?).
  if (maxDec > minDec) {
    let k = decs.length
    while (k > minDec && decs[k - 1] === '0') k--
    const kept = decs.slice(0, k)
    decs = kept + decimals.slice(k).replace(/#/g, '').replace(/\?/g, ' ').replace(/0/g, '0')
    decs = decs.slice(0, Math.max(k, decs.length))
  }
  const minInt = (intDigits.match(/0/g) || []).length
  if (ints === '0' && minInt === 0) ints = ''
  while (ints.length < minInt) ints = '0' + ints
  const qInt = (intDigits.match(/\?/g) || []).length
  if (ints.length < qInt + minInt && !ints) ints = ' '.repeat(Math.max(0, qInt))
  if (grouping && ints) ints = ints.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  const hasDot = picture.includes('.')
  return ints + (hasDot ? (decs || maxDec === 0 || decimals.length ? '.' + decs : '.') : '')
}

function renderScientific(x: number, picture: string): string {
  const m = /^([^Ee]*)[Ee]([+-])(.*)$/.exec(picture)!
  const mant = m[1]
  const expDigits = m[3].replace(/[^0#]/g, '').length || 1
  const [ip, dp = ''] = mant.split('.')
  const intLen = Math.max(1, ip.replace(/[^0#?]/g, '').length)
  if (x === 0) return renderPlain(0, mant) + 'E' + (m[2] === '+' ? '+' : '') + '0'.repeat(expDigits)
  let e = Math.floor(Math.log10(Math.abs(x)))
  // With more than one integer digit the exponent is a multiple of that count (engineering style).
  if (intLen > 1) e = Math.floor(e / intLen) * intLen
  let mantissa = x / 10 ** e
  const dec = dp.replace(/[^0#?]/g, '').length
  if (Math.abs(Number(mantissa.toFixed(dec))) >= 10 ** intLen) { e += intLen; mantissa = x / 10 ** e }
  const sign = e < 0 ? '-' : m[2] === '+' ? '+' : ''
  return renderPlain(mantissa, mant) + 'E' + sign + String(Math.abs(e)).padStart(expDigits, '0')
}

function renderFraction(x: number, picture: string): string {
  const m = /^(?:([0#?,]+)\s+)?([0#?]+)\/([0#?]+|\d+)$/.exec(picture.trim())
  if (!m) return renderPlain(x, picture.replace(/\//g, ''))
  const whole = m[1] !== undefined
  const a = Math.abs(x)
  const ip = whole ? Math.floor(a) : 0
  const frac = a - ip
  let num = 0, den = 1
  if (/^\d+$/.test(m[3])) {
    den = Number(m[3])
    num = Math.round(frac * den)
  } else {
    const maxDen = 10 ** m[3].length - 1
    let best = Infinity
    for (let d = 1; d <= maxDen; d++) {
      const n = Math.round(frac * d)
      const err = Math.abs(frac - n / d)
      if (err < best - 1e-12) { best = err; num = n; den = d }
    }
  }
  if (!whole) num += ip * den
  const ipText = whole ? (ip || !num ? String(ip) : '') : ''
  if (num === 0) return whole ? String(ip) : '0'
  return `${ipText}${ipText ? ' ' : ''}${num}/${den}`
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function renderDate(v: number, code: string): string {
  code = code.replace(/\[\$[^\]]*\]/g, '')
  const p = serialToParts(v)
  let secs = Math.round((v - Math.floor(v)) * 86400)
  if (secs === 86400) secs = 0
  const totalSecs = Math.round(v * 86400)
  let H = Math.floor(secs / 3600)
  const M = Math.floor((secs % 3600) / 60)
  const S = secs % 60
  const ampm = /AM\/PM|A\/P/i.test(code)
  let suffix = ''
  if (ampm) { suffix = H < 12 ? 'AM' : 'PM'; H = H % 12 || 12 }
  const toks: string[] = []
  for (let i = 0; i < code.length;) {
    const rest = code.slice(i)
    let m: RegExpExecArray | null
    if (rest[0] === '"') { const e = code.indexOf('"', i + 1); toks.push('\u0001' + code.slice(i + 1, e < 0 ? code.length : e)); i = e < 0 ? code.length : e + 1; continue }
    if (rest[0] === '\\') { toks.push('\u0001' + (rest[1] ?? '')); i += 2; continue }
    if ((m = /^\[(h+|m+|s+)\]/i.exec(rest))) { toks.push('E' + m[1].toLowerCase()); i += m[0].length; continue }
    if ((m = /^(AM\/PM|A\/P)/i.exec(rest))) { toks.push(m[1].length > 3 ? 'AP' : 'ap'); i += m[0].length; continue }
    if ((m = /^(y+|m+|d+|h+|s+)/i.exec(rest))) { toks.push(m[1].toLowerCase()); i += m[0].length; continue }
    if ((m = /^\.0+/.exec(rest))) { toks.push('F' + m[0].length); i += m[0].length; continue }
    if (rest[0] === '_') { toks.push('\u0001 '); i += 2; continue }
    if (rest[0] === '*') { i += 2; continue }
    toks.push('\u0001' + rest[0])
    i++
  }
  // `m` after an h or before an s is minutes, otherwise month.
  const isMin = (k: number) => {
    for (let j = k - 1; j >= 0; j--) { const t = toks[j]; if (t[0] === '\u0001') continue; if (/^h+$|^Eh/.test(t)) return true; break }
    for (let j = k + 1; j < toks.length; j++) { const t = toks[j]; if (t[0] === '\u0001') continue; if (/^s+$|^Es/.test(t)) return true; break }
    return false
  }
  let out = ''
  toks.forEach((t, k) => {
    if (t[0] === '\u0001') { out += t.slice(1); return }
    const pad = (n: number, w: number) => String(n).padStart(w, '0')
    if (t[0] === 'E') {
      const unit = t[1]
      const n = unit === 'h' ? Math.floor(totalSecs / 3600) : unit === 'm' ? Math.floor(totalSecs / 60) : totalSecs
      out += pad(n, t.length - 1)
      return
    }
    if (t === 'AP') { out += suffix; return }
    if (t === 'ap') { out += suffix[0]; return }
    if (t[0] === 'F') { const frac = (v * 86400) % 1; out += '.' + Math.round(frac * 10 ** Number(t.slice(1))).toString().padStart(Number(t.slice(1)), '0'); return }
    const c = t[0]
    const n = t.length
    if (c === 'y') out += n <= 2 ? pad(p.year % 100, 2) : String(p.year)
    else if (c === 'd') out += n === 1 ? String(p.day) : n === 2 ? pad(p.day, 2) : n === 3 ? DAYS[p.weekday].slice(0, 3) : DAYS[p.weekday]
    else if (c === 'h') out += n === 1 ? String(H) : pad(H, 2)
    else if (c === 's') out += n === 1 ? String(S) : pad(S, 2)
    else if (c === 'm') {
      if (isMin(k)) out += n === 1 ? String(M) : pad(M, 2)
      else out += n === 1 ? String(p.month) : n === 2 ? pad(p.month, 2) : n === 3 ? MONTHS[p.month - 1].slice(0, 3) : n === 5 ? MONTHS[p.month - 1][0] : MONTHS[p.month - 1]
    }
  })
  return out
}

function literalWalk(code: string, text: string): string {
  let out = ''
  for (let i = 0; i < code.length; i++) {
    const ch = code[i]
    if (ch === '"') { const e = code.indexOf('"', i + 1); out += code.slice(i + 1, e < 0 ? code.length : e); i = e < 0 ? code.length : e } else if (ch === '\\') out += code[++i] ?? ''
    else if (ch === '@') out += text
    else if (ch === '_') { out += ' '; i++ } else if (ch === '*') i++
    else out += ch
  }
  return out
}

/** Built-in number formats by id (ECMA-376 §18.8.30), for files that reference them by number. */
export const BUILTIN_FORMATS: Record<number, string> = {
  0: 'General', 1: '0', 2: '0.00', 3: '#,##0', 4: '#,##0.00', 9: '0%', 10: '0.00%', 11: '0.00E+00', 12: '# ?/?', 13: '# ??/??',
  14: 'mm-dd-yy', 15: 'd-mmm-yy', 16: 'd-mmm', 17: 'mmm-yy', 18: 'h:mm AM/PM', 19: 'h:mm:ss AM/PM', 20: 'h:mm', 21: 'h:mm:ss', 22: 'm/d/yy h:mm',
  37: '#,##0 ;(#,##0)', 38: '#,##0 ;[Red](#,##0)', 39: '#,##0.00;(#,##0.00)', 40: '#,##0.00;[Red](#,##0.00)', 45: 'mm:ss', 46: '[h]:mm:ss', 47: 'mmss.0', 48: '##0.0E+0', 49: '@',
}
