import { describe, it, expect } from 'vitest'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { inflateRawSync } from 'node:zlib'
import { writeOds } from './ods-write'
import { readOds } from './ods-read'
import { Workbook } from '../engine/workbook'
import { dateToSerial } from '../engine/dates'
import { parseA1, type WorkbookData } from '../engine/model'

const hasSoffice = existsSync('/usr/bin/soffice')
const hasPy = (() => { try { execFileSync('python3', ['-c', 'import openpyxl'], { stdio: 'ignore' }); return true } catch { return false } })()

const book: WorkbookData = {
  active: 1,
  names: [{ name: 'Rate', ref: "'Omar''s'!$B$1" }],
  sheets: [
    {
      name: 'Data', rows: 100, cols: 26,
      colWidths: { 0: 160 }, rowHeights: { 0: 40 }, hiddenCols: [3], freeze: { rows: 1, cols: 1 },
      merges: ['A6:C6'],
      cells: {
        '0,0': { input: 'Item', fmt: { bold: true, bg: '#0b6e4f', color: '#ffffff', align: 'center' } },
        '0,1': { input: 'Amount', fmt: { bold: true, italic: true, border: true } },
        '1,0': { input: 'نورة', note: 'Paid in cash' },
        '1,1': { input: '1500', fmt: { numFmt: 'currency', currency: 'SAR', decimals: 2 } },
        '2,0': { input: 'Omar', link: 'https://example.com/omar' },
        '2,1': { input: '250.75' },
        '3,1': { input: '=SUM($B$2:B3)', fmt: { numFmt: 'thousands' } },
        '3,2': { input: "=B4*'Omar''s'!B1", fmt: { numFmt: 'percent', decimals: 1 } },
        '4,0': { input: String(dateToSerial(2026, 9, 7)), fmt: { numFmt: 'date' } },
        '4,1': { input: '=IF(B2>1000,"big, really","small")', fmt: { wrap: true, underline: true, strike: true, fontSize: 14 } },
        '5,0': { input: 'Merged across' },
        '6,0': { input: "'0501234567" },
      },
    },
    { name: "Omar's", rows: 100, cols: 26, rtl: true, cells: { '0,0': { input: 'نسبة' }, '0,1': { input: '0.15' } } },
  ],
}
const bytes = async () => new Uint8Array(await (await writeOds(book, { title: 'Budget' })).blob.arrayBuffer())

/** A part of the zip, read with Node's inflate — not with our reader. */
function part(buf: Uint8Array, name: string): string {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
  let eocd = buf.length - 22
  while (eocd >= 0 && dv.getUint32(eocd, true) !== 0x06054b50) eocd--
  let p = dv.getUint32(eocd + 16, true)
  for (let i = 0; i < dv.getUint16(eocd + 10, true); i++) {
    const method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true), nlen = dv.getUint16(p + 28, true), elen = dv.getUint16(p + 30, true), clen = dv.getUint16(p + 32, true), off = dv.getUint32(p + 42, true)
    if (new TextDecoder().decode(buf.subarray(p + 46, p + 46 + nlen)) === name) {
      const start = off + 30 + dv.getUint16(off + 26, true) + dv.getUint16(off + 28, true)
      const data = buf.subarray(start, start + csize)
      return new TextDecoder().decode(method === 8 ? inflateRawSync(data) : data)
    }
    p += 46 + nlen + elen + clen
  }
  return ''
}

describe('writing .ods', () => {
  it('is a package a reader can identify: mimetype first, stored, then the parts', async () => {
    const b = await bytes()
    const dv = new DataView(b.buffer, b.byteOffset, b.byteLength)
    expect(dv.getUint32(0, true)).toBe(0x04034b50)
    expect(dv.getUint16(8, true)).toBe(0) // method 0: stored
    expect(new TextDecoder().decode(b.subarray(30, 38))).toBe('mimetype')
    expect(new TextDecoder().decode(b.subarray(38, 38 + 46))).toBe('application/vnd.oasis.opendocument.spreadsheet')
    expect(part(b, 'META-INF/manifest.xml')).toContain('manifest:full-path="content.xml"')
    expect(part(b, 'meta.xml')).toContain('<dc:title>Budget</dc:title>')
  })

  it('formulas in OpenFormula, each with its computed value; types by attribute', async () => {
    const c = part(await bytes(), 'content.xml')
    expect(c).toMatch(/table:formula="of:=SUM\(\[\.\$B\$2:\.B3\]\)" office:value-type="float" office:value="1750.75"/)
    expect(c).toContain("table:formula=\"of:=[.B4]*[$'Omar''s'.B1]\"")
    expect(c).toMatch(/office:value-type="date" office:date-value="2026-09-07"/)
    expect(c).toMatch(/office:value-type="percentage" office:value="262.6125"/)
    // A formula's string result carries its value too, and a string's separators are left alone.
    expect(c).toContain('of:=IF([.B2]&gt;1000;&quot;big, really&quot;;&quot;small&quot;)')
    // A leading-zero phone number stays text.
    expect(c).toMatch(/office:value-type="string"[^>]*>(?:<[^>]+>)*0501234567/)
  })

  it('a merge writes covered cells, so the cells after it stay in their columns', async () => {
    const c = part(await bytes(), 'content.xml')
    expect(c).toMatch(/table:number-columns-spanned="3"[^>]*>.*?Merged across.*?<\/table:table-cell><table:covered-table-cell\/><table:covered-table-cell\/>/)
  })

  it('reads back through our reader with values, formulas, look, notes, links, panes and names', async () => {
    const b = await bytes()
    const { book: back, loss } = await readOds(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer)
    expect(loss).toEqual([])
    expect(back.sheets.map((s) => s.name)).toEqual(['Data', "Omar's"])
    const d = back.sheets[0]
    for (const k of Object.keys(book.sheets[0].cells)) expect(d.cells[k]?.input, k).toBe(book.sheets[0].cells[k].input === String(dateToSerial(2026, 9, 7)) ? String(dateToSerial(2026, 9, 7)) : book.sheets[0].cells[k].input)
    expect(d.cells['0,0'].fmt).toMatchObject({ bold: true, bg: '#0b6e4f', color: '#ffffff', align: 'center' })
    expect(d.cells['0,1'].fmt).toMatchObject({ bold: true, italic: true, border: true })
    expect(d.cells['4,1'].fmt).toMatchObject({ wrap: true, underline: true, strike: true, fontSize: 14 })
    expect(d.cells['1,1'].fmt).toMatchObject({ numFmt: 'currency', currency: 'SAR', decimals: 2 })
    expect(d.cells['3,2'].fmt).toMatchObject({ numFmt: 'percent', decimals: 1 })
    expect(d.cells['4,0'].fmt).toMatchObject({ numFmt: 'date' })
    expect(d.cells['1,0'].note).toBe('Paid in cash')
    expect(d.cells['2,0'].link).toBe('https://example.com/omar')
    expect(d.merges).toEqual(['A6:C6'])
    expect(d.colWidths?.[0]).toBe(160)
    expect(d.rowHeights?.[0]).toBe(40)
    expect(d.hiddenCols).toEqual([3])
    expect(d.freeze).toEqual({ rows: 1, cols: 1 })
    expect(back.sheets[1].rtl).toBe(true)
    expect(back.active).toBe(1)
    expect(back.names).toEqual([{ name: 'Rate', ref: "'Omar''s'!$B$1" }])
    const wb = new Workbook(back.sheets, back.names)
    expect(wb.value('Data', parseA1('C4')!)).toBeCloseTo(262.6125, 6)
  })

  it('says what an .ods from here does not carry', async () => {
    const r = await writeOds({ sheets: [{ name: 'S', rows: 10, cols: 5, cells: { '0,0': { input: '1' } }, charts: [{ id: 'c', kind: 'bar', range: 'A1:A1' }], conds: [{ op: '>', value: 1, bg: '#f00' }] }] })
    expect(r.loss.map((l) => l.what)).toEqual(expect.arrayContaining(['charts', 'conditional formatting']))
  })

  // Somebody else's reader is the evidence. LibreOffice opens our file and
  // converts it, and openpyxl — a second program again — reads the result.
  it.skipIf(!hasSoffice || !hasPy)('LibreOffice opens it: the formulas, its own recalculation, bold, fills, merges and the note survive', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'ods-'))
    const f = join(dir, 'budget.ods')
    writeFileSync(f, await bytes())
    execFileSync('soffice', ['--headless', '--convert-to', 'xlsx', '--outdir', dir, f], { stdio: 'ignore', timeout: 150_000 })
    const py = [
      'import openpyxl, json, sys',
      'wb = openpyxl.load_workbook(sys.argv[1]); v = openpyxl.load_workbook(sys.argv[1], data_only=True)',
      's = wb["Data"]; sv = v["Data"]',
      'print(json.dumps({"sheets": wb.sheetnames, "f": s["B4"].value, "f2": s["C4"].value, "v": sv["B4"].value, "v2": sv["B5"].value,',
      ' "bold": s["A1"].font.b, "fill": s["A1"].fill.fgColor.rgb, "merged": [str(m) for m in s.merged_cells.ranges], "note": s["A2"].comment.text if s["A2"].comment else None,',
      ' "link": s["A3"].hyperlink.target if s["A3"].hyperlink else None, "phone": sv["A7"].value}))',
    ].join('\n')
    const out = JSON.parse(execFileSync('python3', ['-c', py, join(dir, 'budget.xlsx')]).toString())
    expect(out.sheets).toEqual(['Data', "Omar's"])
    expect(out.f).toBe('=SUM($B$2:B3)')
    expect(out.f2).toBe("=B4*'Omar''s'!B1")
    expect(out.v).toBe(1750.75)
    expect(out.v2).toBe('big, really')
    expect(out.bold).toBe(true)
    expect(String(out.fill).toLowerCase()).toContain('0b6e4f')
    expect(out.merged).toEqual(['A6:C6'])
    expect(out.note).toContain('Paid in cash')
    expect(out.link).toBe('https://example.com/omar')
    expect(out.phone).toBe('0501234567')
    // Frozen panes are NOT asserted here, and not because they fail: headless
    // LibreOffice has no view, and an .ods keeps panes in view settings — its own
    // headless .ods export writes no view settings at all. Our round trip above
    // checks them; whether a windowed Calc honours ours is unconfirmed.
  }, 180_000)
})
