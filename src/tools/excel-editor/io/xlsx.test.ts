import { describe, it, expect } from 'vitest'
import { readFileSync, writeFileSync, mkdtempSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { execFileSync } from 'node:child_process'
import { readXlsx, dumpSheet, textInput, cleanFormula } from './xlsx-read'
import { writeXlsx, safeSheetName, hex6, chartSeries } from './xlsx-write'
import { Workbook, displayValue } from '../engine/engine'
import { cellKey, parseA1, type SheetData, type WorkbookData } from '../engine/model'
import { dateToSerial } from '../engine/dates'
import { formatCell } from '../engine/numfmt'

const FX = join(__dirname, '__fixtures__')
const load = (name: string) => { const b = readFileSync(join(FX, name)); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer }
const cell = (s: SheetData, a: string) => { const p = parseA1(a)!; return s.cells[cellKey(p.row, p.col)] }
const val = (book: WorkbookData, sheet: string, a: string) => new Workbook(book.sheets, book.names).value(sheet, parseA1(a)!)

// Independent validators. Skipped LOUDLY where unavailable, never silently.
const hasPy = (() => { try { execFileSync('python3', ['-c', 'import openpyxl'], { stdio: 'ignore' }); return true } catch { return false } })()
const hasSoffice = existsSync('/usr/bin/soffice')
if (!hasPy) console.warn('⚠ openpyxl not available — the independent .xlsx validation cases are SKIPPED')

describe('reading files other programs wrote', () => {
  it('openpyxl: values, formulas, styles, structure, notes, links, validation, conditional formats, picture, chart, names', async () => {
    const { book, loss } = await readXlsx(load('openpyxl-rich.xlsx'))
    expect(book.sheets.map((s) => s.name)).toEqual(['Sales', 'Settings', 'الملخص'])
    const s = book.sheets[0]
    const d = dumpSheet(s)
    expect(d.A1).toBe('Region')
    expect(d.D2).toBe('=SUM(B2:C2)')
    expect(d.B11).toBe("'0501234567") // text that looks like a number stays text
    expect(d.B12).toBe('TRUE')
    expect(val(book, 'Sales', 'D6')).toBe(120 + 135 + 98 + 110 + 75.5 + 80)
    expect(val(book, 'Sales', 'B14')).toBeCloseTo(0.15 * 618.5)
    expect(val(book, 'Sales', 'B15')).toBe(15) // defined name
    expect(displayValue(val(book, 'Sales', 'B13'))).toBe('#DIV/0!')
    // number formats
    expect(formatCell(val(book, 'Sales', 'B8'), cell(s, 'B8').fmt)).toBe('7.5%')
    expect(formatCell(val(book, 'Sales', 'B9'), cell(s, 'B9').fmt)).toBe('07/09/2026')
    expect(formatCell(val(book, 'Sales', 'B10'), cell(s, 'B10').fmt)).toBe('1,234,567.89')
    // styles
    expect(cell(s, 'A1').fmt).toMatchObject({ bold: true, italic: true, color: '#c00000', fontSize: 14, fontFamily: 'Arial' })
    expect(cell(s, 'B1').fmt?.bg).toBe('#fff2cc')
    expect(cell(s, 'D6').fmt?.bd).toMatchObject({ t: { s: 'thin' }, b: { s: 'double', c: '#0e5a3f' } })
    expect(cell(s, 'A6').fmt).toMatchObject({ align: 'end', valign: 'middle', wrap: true })
    // structure
    expect(s.merges).toContain('A17:C18')
    expect(s.freeze).toEqual({ rows: 1, cols: 1 })
    expect(s.colWidths?.[0]).toBeGreaterThan(150)
    expect(s.rowHeights?.[0]).toBe(40)
    expect(s.hiddenRows).toContain(15)
    expect(s.hiddenCols).toContain(5)
    expect(s.autoFilter).toBe('A1:D4')
    expect(cell(s, 'A2').note).toBe('Head office')
    expect(cell(s, 'A3').link).toBe('https://built-in-saudi.com')
    expect(cell(s, 'E3').fmt?.control).toEqual({ kind: 'dropdown', options: ['Open', 'Closed', 'Pending'] })
    expect(s.conds?.[0]).toMatchObject({ op: '>', value: 100, bg: '#c6efce' })
    expect(s.scales?.[0]).toMatchObject({ kind: 'scale2' })
    expect(s.images?.[0]?.src).toMatch(/^data:image\/png;base64,/)
    expect(s.images?.[0]?.anchor).toMatchObject({ row: 1, col: 6 })
    expect(s.charts?.[0]).toMatchObject({ kind: 'column', title: 'Quarterly' })
    expect(s.charts?.[0].series).toHaveLength(2)
    // the Arabic sheet reads right-to-left with its tab colour
    expect(book.sheets[2]).toMatchObject({ rtl: true, tabColor: '#0e5a3f' })
    expect(val(book, 'الملخص', 'B1')).toBe(618.5)
    expect(book.names?.[0]).toMatchObject({ name: 'TaxRate' })
    expect(Array.isArray(loss)).toBe(true)
  })

  it('xlsxwriter with future functions: the _xlfn prefixes are stripped and the functions work', async () => {
    const { book } = await readXlsx(load('xlsxwriter-future.xlsx'))
    const d = dumpSheet(book.sheets[0])
    expect(d.E1).toBe('=XLOOKUP("B2",A2:A4,B2:B4)')
    expect(val(book, 'Lookup', 'E1')).toBe('Coffee')
    expect(val(book, 'Lookup', 'E2')).toBe('mid')
    expect(val(book, 'Lookup', 'E3')).toBe('Dates, Coffee, Oud')
    expect(val(book, 'Lookup', 'E4')).toBe(40)
    expect(d.E5).toBe("'=not a formula") // a string beginning with = is text, not a formula
    expect(book.sheets[0].cells[cellKey(6, 0)].fmt).toMatchObject({ bold: true, bg: '#0e5a3f', color: '#ffffff' })
  })

  it('Excel-style shared formulas expand to every cell of the block', async () => {
    const { book } = await readXlsx(load('excel-shared.xlsx'))
    const d = dumpSheet(book.sheets[0])
    expect(d.B2).toBe('=A2*3+$A$2')
    expect(d.B3).toBe('=A3*3+$A$2')
    expect(d.B11).toBe('=A11*3+$A$2')
    expect(val(book, 'Shared', 'B11')).toBe(31)
  })

  it('LibreOffice output reads too', async () => {
    const { book } = await readXlsx(load('libreoffice-shared.xlsx'))
    expect(val(book, book.sheets[0].name, 'C21')).toBe(210)
  })

  it('the 1904 date system is honoured', async () => {
    const { book } = await readXlsx(load('date1904.xlsx'))
    const v = val(book, book.sheets[0].name, 'A1')
    expect(v).toBe(dateToSerial(2026, 1, 15))
  })

  it('refuses a legacy .xls, a non-zip and a .docx by name', async () => {
    const ole = new Uint8Array(1024); ole.set([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])
    await expect(readXlsx(ole.buffer)).rejects.toMatchObject({ code: 'legacy-binary' })
    await expect(readXlsx(new TextEncoder().encode('a,b\n1,2').buffer)).rejects.toMatchObject({ code: 'not-zip' })
  })
})

function sample(): WorkbookData {
  const s1: SheetData = { name: 'Budget', cells: {}, rows: 50, cols: 10, merges: ['A10:C10'], freeze: { rows: 1, cols: 0 }, colWidths: { 0: 180 }, rowHeights: { 0: 32 }, hiddenRows: [8], rtl: false, tabColor: '#c08a2d', autoFilter: 'A1:C4' }
  const put = (a: string, input: string, extra: Partial<SheetData['cells'][string]> = {}) => { const p = parseA1(a)!; s1.cells[cellKey(p.row, p.col)] = { input, ...extra } }
  put('A1', 'Item', { fmt: { bold: true, bg: '#0e5a3f', color: '#ffffff', align: 'center' } })
  put('B1', 'Cost')
  put('C1', 'Share')
  put('A2', 'Rent'); put('B2', '4500'); put('C2', '=B2/B$5', { fmt: { numCode: '0.0%' } })
  put('A3', 'Food'); put('B3', '2200.5'); put('C3', '=B3/B$5', { fmt: { numFmt: 'percent', decimals: 1 } })
  put('A4', 'زكاة', { note: 'Two and a half percent' }); put('B4', '=Settings!B1*10000'); put('C4', '=B4/B$5')
  put('A5', 'Total', { fmt: { bold: true, border: { t: true, b: true }, bd: { t: { s: 'thin' }, b: { s: 'double', c: '#0e5a3f' } } } }); put('B5', '=SUM(B2:B4)', { fmt: { numCode: '#,##0.00" SAR"' } })
  put('A6', "'0501234567")
  put('A7', 'TRUE')
  put('A8', '=1/0')
  put('A9', 'Link', { link: 'https://built-in-saudi.com' })
  put('A10', 'Merged')
  put('D2', 'Open', { fmt: { control: { kind: 'dropdown', options: ['Open', 'Closed'] } } })
  put('E2', String(dateToSerial(2026, 9, 7)), { fmt: { numFmt: 'date' } })
  put('F2', '=TaxRate*2')
  s1.conds = [{ op: '>', value: 3000, bg: '#c6efce' }]
  s1.scales = [{ box: { r0: 1, c0: 1, r1: 3, c1: 1 }, kind: 'scale3' }]
  s1.charts = [{ id: 'c1', kind: 'column', range: 'A1:B4', title: 'Costs', anchor: { row: 12, col: 4 }, size: { w: 400, h: 260 } }, { id: 'c2', kind: 'pie', range: 'A1:B4', anchor: { row: 30, col: 4 } }]
  s1.images = [{ id: 'i1', src: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkqPtfDwAEBQG/2X0bxAAAAABJRU5ErkJggg==', anchor: { row: 1, col: 8 }, size: { w: 50, h: 40 } }]
  const s2: SheetData = { name: 'Settings', cells: { [cellKey(0, 1)]: { input: '0.025' } }, rows: 10, cols: 5 }
  const s3: SheetData = { name: 'الملخص', cells: { [cellKey(0, 0)]: { input: '=Budget!B5' } }, rows: 10, cols: 5, rtl: true, showGrid: false }
  return { sheets: [s1, s2, s3], names: [{ name: 'TaxRate', ref: '=Settings!$B$1' }], active: 0 }
}

describe('writing and reading back', () => {
  it('round-trips values, formulas, formats, structure, notes, links, dropdowns, charts, pictures and names', async () => {
    const book = sample()
    const { blob } = await writeXlsx(book, { title: 'Household' })
    const back = await readXlsx(await blob.arrayBuffer())
    expect(back.title).toBe('Household')
    const [b, s, a] = back.book.sheets
    expect(back.book.sheets.map((x) => x.name)).toEqual(['Budget', 'Settings', 'الملخص'])
    const d = dumpSheet(b)
    expect(d.C2).toBe('=B2/B$5')
    expect(d.A6).toBe("'0501234567")
    expect(d.A7).toBe('TRUE')
    expect(val(back.book, 'Budget', 'B5')).toBe(4500 + 2200.5 + 250)
    expect(val(back.book, 'Budget', 'F2')).toBe(0.05)
    expect(val(back.book, 'الملخص', 'A1')).toBe(6950.5)
    expect(cell(b, 'A1').fmt).toMatchObject({ bold: true, bg: '#0e5a3f', color: '#ffffff', align: 'center' })
    expect(cell(b, 'A5').fmt?.bd?.b).toMatchObject({ s: 'double', c: '#0e5a3f' })
    expect(formatCell(val(back.book, 'Budget', 'C2'), cell(b, 'C2').fmt)).toBe('64.7%')
    expect(formatCell(val(back.book, 'Budget', 'C3'), cell(b, 'C3').fmt)).toBe('31.7%')
    expect(formatCell(val(back.book, 'Budget', 'B5'), cell(b, 'B5').fmt)).toBe('6,950.50 SAR')
    expect(formatCell(val(back.book, 'Budget', 'E2'), cell(b, 'E2').fmt)).toBe('2026-09-07')
    expect(b.merges).toEqual(['A10:C10'])
    expect(b.freeze).toEqual({ rows: 1, cols: 0 })
    expect(b.colWidths?.[0]).toBeGreaterThanOrEqual(178)
    expect(b.colWidths?.[0]).toBeLessThanOrEqual(182)
    expect(b.rowHeights?.[0]).toBe(32)
    expect(b.hiddenRows).toEqual([8])
    expect(b.tabColor).toBe('#c08a2d')
    expect(b.autoFilter).toBe('A1:C4')
    expect(cell(b, 'A4').note).toBe('Two and a half percent')
    expect(cell(b, 'A9').link).toBe('https://built-in-saudi.com')
    expect(cell(b, 'D2').fmt?.control).toEqual({ kind: 'dropdown', options: ['Open', 'Closed'] })
    expect(b.conds?.[0]).toMatchObject({ op: '>', value: 3000 })
    expect(b.scales?.[0].kind).toBe('scale3')
    expect(b.charts?.map((c) => c.kind)).toEqual(['column', 'pie'])
    expect(b.charts?.[0].title).toBe('Costs')
    expect(b.charts?.[0].range).toBe('A1:B4')
    expect(b.images).toHaveLength(1)
    expect(a.rtl).toBe(true)
    expect(a.showGrid).toBe(false)
    expect(back.book.names?.[0]).toMatchObject({ name: 'TaxRate', ref: '=Settings!$B$1' })
    expect(s.name).toBe('Settings')
  })

  it.skipIf(!hasPy)('openpyxl opens the export and sees the same workbook', async () => {
    const { blob } = await writeXlsx(sample())
    const dir = mkdtempSync(join(tmpdir(), 'xl-'))
    const f = join(dir, 'out.xlsx')
    writeFileSync(f, Buffer.from(await blob.arrayBuffer()))
    const py = `
import openpyxl, json, sys
wb = openpyxl.load_workbook(sys.argv[1])
wv = openpyxl.load_workbook(sys.argv[1], data_only=True)
ws = wb['Budget']; wsv = wv['Budget']
print(json.dumps({
 'sheets': wb.sheetnames,
 'C2': ws['C2'].value, 'B5v': wsv['B5'].value, 'A6': ws['A6'].value, 'A6q': ws['A6'].quotePrefix,
 'bold': ws['A1'].font.b, 'fill': ws['A1'].fill.fgColor.rgb, 'fmt': ws['B5'].number_format,
 'merged': [str(r) for r in ws.merged_cells.ranges], 'freeze': ws.freeze_panes,
 'note': ws['A4'].comment.text if ws['A4'].comment else None,
 'link': ws['A9'].hyperlink.target if ws['A9'].hyperlink else None,
 'dv': [d.formula1 for d in ws.data_validations.dataValidation],
 'charts': len(ws._charts), 'images': len(ws._images),
 'rtl': wb['الملخص'].sheet_view.rightToLeft, 'names': list(wb.defined_names.keys()),
 'width': ws.column_dimensions['A'].width, 'hidden9': ws.row_dimensions[9].hidden,
}))`
    const out = JSON.parse(execFileSync('python3', ['-c', py, f]).toString())
    expect(out.sheets).toEqual(['Budget', 'Settings', 'الملخص'])
    expect(out.C2).toBe('=B2/B$5')
    expect(out.B5v).toBe(6950.5)
    expect(out.A6).toBe('0501234567')
    expect(out.A6q).toBe(true)
    expect(out.bold).toBe(true)
    expect(out.fill).toBe('FF0E5A3F')
    expect(out.fmt).toBe('#,##0.00" SAR"')
    expect(out.merged).toEqual(['A10:C10'])
    expect(out.freeze).toBe('A2')
    expect(out.note).toBe('Two and a half percent')
    expect(out.link).toBe('https://built-in-saudi.com')
    expect(out.dv).toEqual(['"Open,Closed"'])
    expect(out.charts).toBe(2)
    expect(out.images).toBe(1)
    expect(out.rtl).toBe(true)
    expect(out.names).toContain('TaxRate')
    expect(out.width).toBeGreaterThan(20)
    expect(out.hidden9).toBe(true)
  })

  it.skipIf(!hasSoffice)('LibreOffice renders the export with its formats and computed values', async () => {
    const { blob } = await writeXlsx(sample())
    const dir = mkdtempSync(join(tmpdir(), 'xl-'))
    const f = join(dir, 'book.xlsx')
    writeFileSync(f, Buffer.from(await blob.arrayBuffer()))
    // HTML, not CSV: LibreOffice's CSV filter writes raw values, its HTML one what a reader SEES.
    execFileSync('soffice', ['--headless', '--convert-to', 'html', '--outdir', dir, f], { stdio: 'ignore', timeout: 120_000 })
    const html = readFileSync(join(dir, 'book.html'), 'utf8')
    expect(html).toContain('Rent')
    expect(html).toContain('6,950.50 SAR')
    expect(html).toContain('64.7%')
    expect(html).toContain('الملخص')
  }, 150_000)

  it('sheet names are made legal and unique; colours are normalised', () => {
    const used = new Set<string>()
    expect(safeSheetName('A/B:C?', used)).toBe('A B C')
    expect(safeSheetName('a b c', used)).toBe('a b c (2)')
    expect(safeSheetName('x'.repeat(40), used)).toHaveLength(31)
    expect(hex6('#abc')).toBe('AABBCC')
    expect(hex6('rgb(14, 90, 63)')).toBe('0E5A3F')
  })

  it('a chart derives its series from the range', () => {
    expect(chartSeries({ id: 'x', kind: 'line', range: 'A1:C4' }, 'Sheet 1')).toEqual([
      { name: "='Sheet 1'!$B$1", cat: "'Sheet 1'!$A$2:$A$4", val: "'Sheet 1'!$B$2:$B$4" },
      { name: "='Sheet 1'!$C$1", cat: "'Sheet 1'!$A$2:$A$4", val: "'Sheet 1'!$C$2:$C$4" },
    ])
  })

  it('helpers: text escaping and formula cleaning', () => {
    expect(textInput('42')).toBe("'42")
    expect(textInput('hello')).toBe('hello')
    expect(textInput('=x')).toBe("'=x")
    expect(cleanFormula('=_xlfn._xlws.SORT(A1:A3)+_xlfn.XLOOKUP(1,A:A,B:B)')).toBe('SORT(A1:A3)+XLOOKUP(1,A:A,B:B)')
  })

  it('a large workbook writes and reads in reasonable time', async () => {
    const cells: SheetData['cells'] = {}
    for (let r = 0; r < 5000; r++) { cells[cellKey(r, 0)] = { input: String(r) }; cells[cellKey(r, 1)] = { input: `=A${r + 1}*2` }; cells[cellKey(r, 2)] = { input: 'row ' + r } }
    const t0 = performance.now()
    const { blob } = await writeXlsx({ sheets: [{ name: 'Big', cells, rows: 5000, cols: 3 }] })
    const back = await readXlsx(await blob.arrayBuffer())
    expect(Object.keys(back.book.sheets[0].cells)).toHaveLength(15000)
    expect(performance.now() - t0).toBeLessThan(4000)
  }, 20_000)
})
