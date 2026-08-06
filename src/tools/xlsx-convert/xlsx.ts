import { readZipText } from '../../lib/unzip'

// Reading an .xlsx without a spreadsheet library.
//
// An .xlsx is a ZIP of XML, and we can now open a ZIP (`lib/unzip.ts`), so this
// is parsing rather than dependency. Deliberately READ-ONLY and values-only:
// writing xlsx, or evaluating formulas, is a different and much larger problem,
// and pretending otherwise is how a converter quietly corrupts someone's data.
//
// The two things that silently go wrong in every naive xlsx reader:
//
// 1. **Strings live somewhere else.** A cell with t="s" holds an INDEX into
//    sharedStrings.xml, not text. Miss that and every text cell reads as a
//    number.
// 2. **Dates are numbers.** 45000 is a date only because its cell carries a
//    date number-format. So the styles have to be read, the format code
//    inspected, and the serial converted — otherwise every date in the file
//    comes out as a five-digit integer.

export interface Sheet {
  name: string
  rows: string[][]
}

export interface Workbook {
  sheets: Sheet[]
  /** Files inside the archive that were not part of the workbook proper. */
  extras: number
}

const xml = (s: string) => new DOMParser().parseFromString(s, 'application/xml')

/** "BC12" → 54 (0-based). */
export function colIndex(ref: string): number {
  let n = 0
  for (const ch of ref) {
    const c = ch.charCodeAt(0)
    if (c < 65 || c > 90) break
    n = n * 26 + (c - 64)
  }
  return n - 1
}

// Built-in number-format ids that mean a date or a time. There is no list of
// these in the file itself; they are fixed by the format.
const BUILTIN_DATE_IDS = new Set([14, 15, 16, 17, 18, 19, 20, 21, 22, 45, 46, 47])

/** Does this format code render a date rather than a number? */
export function isDateFormat(code: string): boolean {
  // Strip quoted literals and escapes so a currency like "y" does not count.
  const bare = code.replace(/\[[^\]]*\]/g, '').replace(/"[^"]*"/g, '').replace(/\\./g, '')
  return /[ymdhs]/i.test(bare)
}

/**
 * Excel's serial date → ISO.
 *
 * The epoch is 1899-12-30, not 1900-01-01, because Excel deliberately kept
 * Lotus 1-2-3's belief that 1900 was a leap year. Serial 60 is that phantom
 * 29 February; it has no real date, so it is reported as-is rather than
 * silently shifted by a day.
 */
export function serialToIso(serial: number, date1904: boolean): string | null {
  if (!isFinite(serial)) return null
  if (!date1904 && serial === 60) return null
  const base = date1904 ? Date.UTC(1904, 0, 1) : Date.UTC(1899, 11, 30)
  const days = Math.floor(serial)
  const ms = base + days * 86400000
  const frac = serial - days
  const d = new Date(ms)
  if (isNaN(d.getTime())) return null
  const iso = d.toISOString().slice(0, 10)
  if (frac <= 0) return iso
  const secs = Math.round(frac * 86400)
  const hh = String(Math.floor(secs / 3600)).padStart(2, '0')
  const mm = String(Math.floor((secs % 3600) / 60)).padStart(2, '0')
  const ss = String(secs % 60).padStart(2, '0')
  return `${iso} ${hh}:${mm}:${ss}`
}

export async function readWorkbook(buf: ArrayBuffer): Promise<Workbook> {
  const files = await readZipText(buf, (n) => n.startsWith('xl/') || n === '[Content_Types].xml')
  const wbXml = files.get('xl/workbook.xml')
  if (!wbXml) throw new Error('not-xlsx')

  const wb = xml(wbXml)
  const date1904 = /date1904="(1|true)"/i.test(wbXml)

  // sheet name -> target path, via the relationship id.
  const rels = new Map<string, string>()
  const relXml = files.get('xl/_rels/workbook.xml.rels')
  if (relXml) {
    for (const r of Array.from(xml(relXml).getElementsByTagName('Relationship'))) {
      const id = r.getAttribute('Id')
      const target = r.getAttribute('Target')
      if (id && target) rels.set(id, target.replace(/^\/?xl\//, '').replace(/^\//, ''))
    }
  }

  // Shared strings: a cell of type "s" is an index into this table.
  const shared: string[] = []
  const ssXml = files.get('xl/sharedStrings.xml')
  if (ssXml) {
    for (const si of Array.from(xml(ssXml).getElementsByTagName('si'))) {
      // A string can be split across runs (<r><t>) when parts are styled
      // differently; joining them is the only way to get the cell's real text.
      const ts = Array.from(si.getElementsByTagName('t'))
      shared.push(ts.map((t) => t.textContent ?? '').join(''))
    }
  }

  // Style index -> is this cell formatted as a date?
  const dateStyles = new Set<number>()
  const stylesXml = files.get('xl/styles.xml')
  if (stylesXml) {
    const st = xml(stylesXml)
    const custom = new Map<number, string>()
    for (const f of Array.from(st.getElementsByTagName('numFmt'))) {
      const id = Number(f.getAttribute('numFmtId'))
      const code = f.getAttribute('formatCode') ?? ''
      if (!isNaN(id)) custom.set(id, code)
    }
    const cellXfs = st.getElementsByTagName('cellXfs')[0]
    if (cellXfs) {
      Array.from(cellXfs.getElementsByTagName('xf')).forEach((xf, i) => {
        const id = Number(xf.getAttribute('numFmtId') ?? '0')
        const code = custom.get(id)
        if (BUILTIN_DATE_IDS.has(id) || (code && isDateFormat(code))) dateStyles.add(i)
      })
    }
  }

  const sheets: Sheet[] = []
  for (const el of Array.from(wb.getElementsByTagName('sheet'))) {
    const name = el.getAttribute('name') ?? `Sheet${sheets.length + 1}`
    const rid = el.getAttribute('r:id') ?? el.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id')
    const path = (rid && rels.get(rid)) || `worksheets/sheet${sheets.length + 1}.xml`
    const sheetXml = files.get(`xl/${path}`)
    if (!sheetXml) continue
    sheets.push({ name, rows: parseSheet(sheetXml, shared, dateStyles, date1904) })
  }

  if (!sheets.length) throw new Error('no-sheets')
  return { sheets, extras: files.size }
}

function parseSheet(sheetXml: string, shared: string[], dateStyles: Set<number>, date1904: boolean): string[][] {
  const doc = xml(sheetXml)
  const rows: string[][] = []
  for (const row of Array.from(doc.getElementsByTagName('row'))) {
    const cells: string[] = []
    for (const c of Array.from(row.getElementsByTagName('c'))) {
      const ref = c.getAttribute('r') ?? ''
      // Blank cells are simply absent from the XML, so a row is not a list —
      // each cell has to be placed at the column its reference names or the
      // whole row shifts left.
      const idx = ref ? colIndex(ref) : cells.length
      const t = c.getAttribute('t')
      const sIdx = Number(c.getAttribute('s') ?? '-1')
      let value = ''
      if (t === 's') {
        const v = c.getElementsByTagName('v')[0]?.textContent
        value = v != null ? shared[Number(v)] ?? '' : ''
      } else if (t === 'inlineStr') {
        value = Array.from(c.getElementsByTagName('t')).map((x) => x.textContent ?? '').join('')
      } else if (t === 'b') {
        value = c.getElementsByTagName('v')[0]?.textContent === '1' ? 'TRUE' : 'FALSE'
      } else if (t === 'e') {
        value = c.getElementsByTagName('v')[0]?.textContent ?? '#ERROR'
      } else {
        // Numbers, and formulas via their cached <v> — the cached value is what
        // the spreadsheet last showed, and re-evaluating formulas is out of scope.
        const v = c.getElementsByTagName('v')[0]?.textContent
        if (v == null) value = ''
        else if (dateStyles.has(sIdx)) value = serialToIso(Number(v), date1904) ?? v
        else value = v
      }
      while (cells.length < idx) cells.push('')
      cells[idx] = value
    }
    const r = Number(row.getAttribute('r') ?? rows.length + 1) - 1
    while (rows.length < r) rows.push([])
    rows[r] = cells
  }
  // Trim wholly empty trailing rows — spreadsheets are full of them.
  while (rows.length && rows[rows.length - 1].every((c) => !c)) rows.pop()
  return rows
}

const needsQuote = (s: string, delim: string) => s.includes(delim) || s.includes('"') || /[\r\n]/.test(s)

export function toCsv(rows: string[][], delim = ','): string {
  return rows
    .map((r) => r.map((c) => (needsQuote(c, delim) ? `"${c.replace(/"/g, '""')}"` : c)).join(delim))
    .join('\r\n')
}

export function toJson(rows: string[][], headerRow: boolean): string {
  if (!rows.length) return '[]'
  if (!headerRow) return JSON.stringify(rows, null, 2)
  const [head, ...rest] = rows
  const keys = head.map((h, i) => h || `column${i + 1}`)
  return JSON.stringify(
    rest.map((r) => Object.fromEntries(keys.map((k, i) => [k, r[i] ?? '']))),
    null,
    2,
  )
}
