import { parseCsv, sniffDelimiter } from './csv'
import { readWorkbook } from '../tools/xlsx-convert/xlsx'

// "Read whatever table file the user has" — the third tool to need this, so it
// belongs here rather than being copied a third time.
//
// Deliberately narrow: CSV/TSV by sniffing the delimiter, and .xlsx through the
// zip-and-XML reader. .xls and Apple Numbers are entirely different formats, so
// they get a clear refusal instead of a silent empty table.

export interface Table {
  rows: string[][]
  /** Sheet name for a workbook; the file name otherwise. */
  label: string
  /** Other sheets in the same workbook, if any. */
  sheets: string[]
}

export async function readTableFile(file: File, sheetIndex = 0): Promise<Table> {
  if (/\.xlsx$/i.test(file.name)) {
    const wb = await readWorkbook(await file.arrayBuffer())
    const sheet = wb.sheets[sheetIndex] ?? wb.sheets[0]
    if (!sheet) throw new Error('no-sheets')
    return { rows: trim(sheet.rows), label: sheet.name, sheets: wb.sheets.map((s) => s.name) }
  }
  if (/\.xls$|\.numbers$/i.test(file.name)) throw new Error('old-format')
  const text = await file.text()
  const rows = parseCsv(text, sniffDelimiter(text))
  return { rows: trim(rows), label: file.name, sheets: [] }
}

/** Drop rows that are entirely blank — spreadsheets are full of them. */
const trim = (rows: string[][]) => rows.filter((r) => r.some((c) => (c ?? '').trim()))
