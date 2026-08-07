// Writing a real .xlsx, with no dependency.
//
// This exists because "just open the CSV in Excel" quietly destroys data, and
// there is no setting a recipient can be relied on to change:
//
// - **Leading zeros vanish.** An IBAN, a phone number, a national ID or a
//   Riyadh postcode arrives as a number and loses its front. `0501234567`
//   becomes `501234567`.
// - **Long digit strings become scientific notation**, irreversibly rounded —
//   a 16-digit card or IBAN number comes back as `1.23457E+15`.
// - **Arabic arrives as mojibake**, because Excel guesses the encoding of a
//   `.csv` from the system codepage rather than reading the BOM reliably.
//
// An .xlsx has none of those problems, because each cell declares its own type
// and the XML inside is UTF-8 by definition. Written store-only (`zip.ts`) —
// the ZIP spec allows uncompressed entries and Excel reads them fine.
//
// Strings are written **inline** (`t="inlineStr"`) rather than through
// `sharedStrings.xml`: it costs some size on repetitive data and saves an
// entire part, an index and a class of off-by-one bugs.

import { zipStore } from './zip'

export interface SheetInput {
  name: string
  rows: string[][]
  /** Cells to keep as text even though they look like numbers. */
  isText?: (value: string, col: number, row: number) => boolean
  /** Style row 0 as a bold header. */
  header?: boolean
}

const enc = new TextEncoder()
const bytes = (s: string) => enc.encode(s)

/** 0 → A, 25 → Z, 26 → AA. */
export function colName(i: number): string {
  let s = ''
  for (let n = i; n >= 0; n = Math.floor(n / 26) - 1) s = String.fromCharCode(65 + (n % 26)) + s
  return s
}

function esc(s: string): string {
  return s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]!))
    // XML 1.0 simply cannot hold these, and Excel refuses to open a file that
    // tries. Dropping them beats producing a workbook that will not open.
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
}

/**
 * Is this cell safe to write as a number?
 *
 * Deliberately conservative. A leading zero, a leading `+`, a space, more than
 * 15 significant digits — anything that would not survive the round trip — stays
 * text, because a spreadsheet that renders `0501234567` correctly is worth more
 * than one where it happens to be right-aligned.
 */
export function looksNumeric(v: string): boolean {
  if (!/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(v)) return false
  if (v.replace(/[-.]/g, '').replace(/^0+/, '').length > 15) return false
  return true
}

const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
const NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'

function sheetXml(sheet: SheetInput): string {
  const rows = sheet.rows.map((cells, r) => {
    const inner = cells.map((raw, c) => {
      const v = raw ?? ''
      if (v === '') return ''
      const ref = `${colName(c)}${r + 1}`
      const style = sheet.header && r === 0 ? ' s="1"' : ''
      const asText = sheet.isText?.(v, c, r) ?? !looksNumeric(v)
      return asText
        ? `<c r="${ref}"${style} t="inlineStr"><is><t xml:space="preserve">${esc(v)}</t></is></c>`
        : `<c r="${ref}"${style}><v>${v}</v></c>`
    }).join('')
    return `<row r="${r + 1}">${inner}</row>`
  }).join('')
  return `${XML}<worksheet xmlns="${NS}"><sheetData>${rows}</sheetData></worksheet>`
}

// Excel is particular here: the fills list must have `none` at 0 and `gray125`
// at 1 or it declares the workbook corrupt, whether or not either is used.
const STYLES = `${XML}<styleSheet xmlns="${NS}">`
  + '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>'
  + '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>'
  + '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>'
  + '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
  + '<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'
  + '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs>'
  + '</styleSheet>'

/** A sheet name Excel will accept: 31 chars, none of []:*?/\ , never blank. */
export function safeSheetName(name: string, fallback = 'Sheet1'): string {
  const clean = (name || '').replace(/[[\]:*?/\\]/g, ' ').trim().slice(0, 31)
  return clean || fallback
}

export function buildXlsx(sheets: SheetInput[]): Blob {
  const used = new Set<string>()
  const named = sheets.map((s, i) => {
    let name = safeSheetName(s.name, `Sheet${i + 1}`)
    // Two sheets with the same name make a file Excel refuses to open.
    for (let n = 2; used.has(name.toLowerCase()); n++) name = safeSheetName(`${name.slice(0, 28)} ${n}`)
    used.add(name.toLowerCase())
    return { ...s, name }
  })

  const styleRel = named.length + 1
  const files = [
    {
      name: '[Content_Types].xml',
      bytes: bytes(`${XML}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">`
        + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
        + '<Default Extension="xml" ContentType="application/xml"/>'
        + '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
        + named.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')
        + '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
        + '</Types>'),
    },
    {
      name: '_rels/.rels',
      bytes: bytes(`${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">`
        + `<Relationship Id="rId1" Type="${REL}/officeDocument" Target="xl/workbook.xml"/></Relationships>`),
    },
    {
      name: 'xl/workbook.xml',
      bytes: bytes(`${XML}<workbook xmlns="${NS}" xmlns:r="${REL}"><sheets>`
        + named.map((s, i) => `<sheet name="${esc(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')
        + '</sheets></workbook>'),
    },
    {
      name: 'xl/_rels/workbook.xml.rels',
      bytes: bytes(`${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">`
        + named.map((_, i) => `<Relationship Id="rId${i + 1}" Type="${REL}/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')
        + `<Relationship Id="rId${styleRel}" Type="${REL}/styles" Target="styles.xml"/></Relationships>`),
    },
    { name: 'xl/styles.xml', bytes: bytes(STYLES) },
    ...named.map((s, i) => ({ name: `xl/worksheets/sheet${i + 1}.xml`, bytes: bytes(sheetXml(s)) })),
  ]

  return new Blob([zipStore(files)], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
}
