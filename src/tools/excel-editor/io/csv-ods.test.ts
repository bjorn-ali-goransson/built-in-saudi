import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { readCsv, writeCsv, csvInput } from './csv-io'
import { readOds, fromOpenFormula } from './ods-read'
import { dumpSheet } from './xlsx-read'
import { Workbook } from '../engine/engine'
import { parseA1, cellKey } from '../engine/model'
import { dateToSerial } from '../engine/dates'

describe('CSV', () => {
  it('keeps leading zeros and IDs as text, numbers as numbers, strips a BOM, sniffs ;', () => {
    const s = readCsv('﻿name;phone;amount;iban\nNoura;0501234567;1500.5;SA0380000000608010167519\n')
    const d = dumpSheet(s)
    expect(d.A1).toBe('name')
    expect(d.B2).toBe("'0501234567")
    expect(d.C2).toBe('1500.5')
    expect(d.D2).toBe('SA0380000000608010167519')
    expect(s.freeze).toEqual({ rows: 1, cols: 0 })
  })
  it('quoted fields with commas, quotes and newlines', () => {
    const d = dumpSheet(readCsv('a,b\n"x, y","he said ""hi""\nnext line"\n'))
    expect(d.A2).toBe('x, y')
    expect(d.B2).toBe('he said "hi"\nnext line')
  })
  it('csvInput: what counts as a number', () => {
    expect(csvInput('42')).toBe('42')
    expect(csvInput('-3.5')).toBe('-3.5')
    expect(csvInput('007')).toBe("'007")
    expect(csvInput('1e5')).toBe("'1e5")
    expect(csvInput('TRUE')).toBe("'TRUE")
    expect(csvInput('=cmd')).toBe("'=cmd")
  })
  it('exports what the sheet shows, with a BOM, and neutralises formula injection', () => {
    const cells = {
      [cellKey(0, 0)]: { input: 'item' }, [cellKey(0, 1)]: { input: 'share' },
      [cellKey(1, 0)]: { input: "'=HYPERLINK(\"evil\")" }, [cellKey(1, 1)]: { input: '0.25', fmt: { numCode: '0%' } },
      [cellKey(2, 0)]: { input: 'تمر' }, [cellKey(2, 1)]: { input: '=B2*2' },
    }
    const csv = writeCsv({ sheets: [{ name: 'S', cells, rows: 5, cols: 5 }] }, 'S')
    expect(csv.charCodeAt(0)).toBe(0xfeff)
    const lines = csv.slice(1).trim().split(/\r?\n/)
    expect(lines[1]).toBe(`"'=HYPERLINK(""evil"")",25%`)
    expect(lines[2]).toBe('تمر,0.5')
  })
})

describe('ODS (LibreOffice)', () => {
  it('reads values, formulas across sheets, dates, merges and keeps text text', async () => {
    const b = readFileSync(join(__dirname, '__fixtures__', 'libreoffice.ods'))
    const { book, loss } = await readOds(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer)
    expect(book.sheets.map((s) => s.name)).toEqual(['Data', 'Other Sheet'])
    const d = dumpSheet(book.sheets[0])
    expect(d.A2).toBe('نورة')
    expect(d.B4).toBe('=SUM(B2:B3)')
    expect(d.C2).toBe("'0501234567")
    expect(book.sheets[0].merges).toContain('A8:C8')
    const wb = new Workbook(book.sheets)
    expect(wb.value('Data', parseA1('B4')!)).toBe(1750.75)
    expect(wb.value('Data', parseA1('A6')!)).toBe(dateToSerial(2026, 9, 7))
    expect(wb.value('Other Sheet', parseA1('A1')!)).toBe(3501.5)
    expect(wb.value('Other Sheet', parseA1('A2')!)).toBe('big')
    // The base style a file inherits from (Calibri 11, bottom-aligned, 64px columns
    // in a file that began as .xlsx) is the sheet's baseline, not formatting.
    expect(book.sheets[0].cells['5,0'].fmt).toEqual({ numFmt: 'date' })
    expect(book.sheets[0].cells['7,0'].fmt).toBeUndefined()
    expect(book.sheets[0].colWidths).toBeUndefined()
    expect(loss).toEqual([])
  })
  it('converts OpenFormula syntax', () => {
    expect(fromOpenFormula('of:=SUM([.A1:.B3])')).toBe('SUM(A1:B3)')
    expect(fromOpenFormula("of:=[$'Other Sheet'.A1]*2")).toBe("'Other Sheet'!A1*2")
    expect(fromOpenFormula('of:=IF([.A1]>1;"a;b";[$Data.$B$2])')).toBe('IF(A1>1,"a;b",Data!$B$2)')
  })
})
