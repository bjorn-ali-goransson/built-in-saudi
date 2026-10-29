// CSV / TSV in and out of the spreadsheet editor.
//
// Import keeps text TEXT: a column of phone numbers or IBANs comes in with its
// leading zeros, because a CSV has no types and "0501234567" in one is a string
// somebody typed. Only what is unambiguously a number becomes one. A UTF-8 BOM
// (which Excel and this site's own CSV tools write) is stripped, or the first
// header would carry an invisible character for ever.
//
// Export writes what the sheet SHOWS (computed and formatted), with a BOM so
// Excel reads Arabic as Arabic, and quotes a field that starts with = + - @ so
// the file cannot smuggle a formula into whoever opens it next (CSV injection).
import { parseCsv, sniffDelimiter, toCsv, type Delimiter } from '../../../lib/csv'
import { cellKey, type SheetData } from '../engine/model'
import { Workbook } from '../engine/workbook'
import { formatCell } from '../engine/numfmt'
import { textInput } from './xlsx-read'

export function readCsv(text: string, name = 'Sheet1', delimiter?: Delimiter): SheetData {
  const clean = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
  const d = delimiter || sniffDelimiter(clean)
  const rows = parseCsv(clean.replace(/\r\n?/g, '\n'), d)
  const cells: SheetData['cells'] = {}
  let maxC = 0
  rows.forEach((row, r) => {
    row.forEach((v, c) => {
      if (v === '') return
      cells[cellKey(r, c)] = { input: csvInput(v) }
      maxC = Math.max(maxC, c + 1)
    })
  })
  return { name, cells, rows: Math.max(100, rows.length + 20), cols: Math.max(26, maxC + 4), freeze: rows.length > 1 ? { rows: 1, cols: 0 } : undefined }
}

/** A CSV field as a cell input: a plain number stays a number; anything else is text. */
export function csvInput(v: string): string {
  // A plain decimal (with optional minus) without a leading zero is a number; 007 and 0501… are not.
  if (/^-?(0|[1-9]\d{0,14})(\.\d+)?$/.test(v)) return v
  return textInput(v)
}

export function writeCsv(book: { sheets: SheetData[]; names?: { name: string; ref: string }[] }, sheetName: string, delimiter: Delimiter = ','): string {
  const wb = new Workbook(book.sheets, book.names || [])
  const sheet = wb.sheet(sheetName)
  if (!sheet) return ''
  const ext = wb.extent(sheetName)
  const out: string[][] = []
  for (let r = 0; r < ext.rows; r++) {
    const row: string[] = []
    for (let c = 0; c < ext.cols; c++) {
      const v = wb.value(sheetName, { row: r, col: c })
      let s = formatCell(v, wb.format(sheetName, { row: r, col: c }))
      if (/^[=+\-@\t\r]/.test(s) && !/^-?\d/.test(s)) s = "'" + s
      row.push(s)
    }
    out.push(row)
  }
  return '﻿' + toCsv(out, delimiter)
}
