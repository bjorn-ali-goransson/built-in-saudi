import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { inflateRawSync } from 'node:zlib'
import { readDocx } from './docx-read'
import { writeDocx, splitBidi, hex, imageSize } from './docx-write'
import { schema } from '../schema'
import { plainText, emptyDoc, type PMNode, type WordData } from '../model'

const FIX = new URL('./__fixtures__/', import.meta.url)
const load = (n: string) => { const b = readFileSync(new URL(n, FIX)); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer }

/** Every node of a type, depth first. */
function all(n: PMNode, type: string, out: PMNode[] = []): PMNode[] { if (n.type === type) out.push(n); for (const c of n.content || []) all(c, type, out); return out }
const valid = (d: PMNode) => { const node = schema.nodeFromJSON(d); node.check(); return node }

/** A part of a zip, read with Node's own inflate — not with our reader. */
function zipPart(buf: Uint8Array, name: string): string {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
  let eocd = buf.length - 22
  while (eocd >= 0 && dv.getUint32(eocd, true) !== 0x06054b50) eocd--
  const count = dv.getUint16(eocd + 10, true)
  let p = dv.getUint32(eocd + 16, true)
  for (let i = 0; i < count; i++) {
    const method = dv.getUint16(p + 10, true)
    const csize = dv.getUint32(p + 20, true)
    const nlen = dv.getUint16(p + 28, true)
    const elen = dv.getUint16(p + 30, true)
    const clen = dv.getUint16(p + 32, true)
    const off = dv.getUint32(p + 42, true)
    const nm = new TextDecoder().decode(buf.subarray(p + 46, p + 46 + nlen))
    if (nm === name) {
      const lnl = dv.getUint16(off + 26, true)
      const lel = dv.getUint16(off + 28, true)
      const data = buf.subarray(off + 30 + lnl + lel, off + 30 + lnl + lel + csize)
      return new TextDecoder().decode(method === 8 ? inflateRawSync(data) : data)
    }
    p += 46 + nlen + elen + clen
  }
  return ''
}
async function bytesOf(d: WordData): Promise<Uint8Array> { return new Uint8Array(await (await writeDocx(d, { title: 'T' })).blob.arrayBuffer()) }

describe('reading .docx from python-docx', () => {
  it('headings, runs with formatting, lists, alignment, Arabic, a merged table, a picture and a page break', async () => {
    const r = await readDocx(load('python-docx.docx'))
    const d = r.data.doc
    valid(d)
    expect(r.title).toBe('Quarterly report')
    const heads = all(d, 'heading')
    expect(heads.map((h) => [h.attrs!.level, plainText(h)])).toEqual([[1, 'Quarterly report'], [2, 'Highlights']])
    const para = d.content!.find((n) => plainText(n).startsWith('Revenue'))!
    const run = (t: string) => para.content!.find((c) => c.text === t)!
    expect(run('twelve percent').marks).toEqual([{ type: 'bold' }])
    expect(run('Riyadh').marks).toEqual([{ type: 'italic' }, { type: 'textStyle', attrs: { color: '#c00000', highlight: null, font: null, size: null } }])
    expect(run('Jeddah').marks!.map((m) => m.type)).toEqual(['underline', 'textStyle'])
    expect(run('Jeddah').marks![1].attrs!.size).toBe(14)
    const bullets = all(d, 'bullet_list')
    const ordered = all(d, 'ordered_list')
    expect(bullets).toHaveLength(1)
    expect(bullets[0].content!.map((li) => plainText(li))).toEqual(['First point', 'Second point'])
    expect(ordered[0].content!.map((li) => plainText(li))).toEqual(['Step one', 'Step two', 'Step three'])
    expect(ordered[0].attrs!.order).toBe(1)
    expect(d.content!.find((n) => plainText(n) === 'Centred line')!.attrs!.align).toBe('center')
    const ar = d.content!.find((n) => plainText(n).startsWith('نمت'))!
    expect(ar.attrs!.dir).toBe('rtl')
    const table = all(d, 'table')[0]
    const rows = table.content!
    expect(rows[0].content![0].attrs).toMatchObject({ colspan: 2, rowspan: 1 })
    expect(rows[1].content![2].attrs).toMatchObject({ rowspan: 2 })
    expect(rows[2].content!).toHaveLength(2)
    const img = all(d, 'image')[0]
    expect(String(img.attrs!.src)).toMatch(/^data:image\/png;base64,/)
    expect(img.attrs!.width).toBe(96)
    expect(all(d, 'page_break')).toHaveLength(1)
    expect(r.data.header).toBe('Confidential')
    expect(r.data.page.width).toBeCloseTo(215.9, 0)
  })
})

describe('reading .docx from LibreOffice', () => {
  it('a list that starts at 3, nesting, a numbered list that restarts, footnotes, links, rowspan and colspan', async () => {
    const r = await readDocx(load('libreoffice.docx'))
    const d = r.data.doc
    valid(d)
    const ordered = all(d, 'ordered_list')
    expect(ordered[0].attrs!.order).toBe(3)
    expect(ordered[0].content!.map((li) => plainText(li.content![0]))).toEqual(['Third', 'Fourth'])
    const nested = all(ordered[0], 'bullet_list')
    expect(nested).toHaveLength(1)
    expect(plainText(nested[0])).toBe('Nested bullet')
    expect(ordered[1].attrs!.order).toBe(1)
    const notes = all(d, 'footnote')
    expect(notes).toHaveLength(1)
    expect(notes[0].attrs!.text).toBe('The footnote text.')
    const link = all(d, 'text').find((t) => t.text === 'a link')!
    expect(link.marks!.find((m) => m.type === 'link')!.attrs!.href).toBe('https://built-in-saudi.com/')
    const t = all(d, 'table')[0]
    expect(t.content![0].content![0].attrs!.rowspan).toBe(2)
    expect(t.content![2].content![0].attrs!.colspan).toBe(2)
    expect(all(d, 'paragraph').find((p) => plainText(p).startsWith('فقرة'))!.attrs!.dir).toBe('rtl')
  })
})

describe('refusing what is not a Word document', () => {
  it('names a legacy .doc and a non-zip', async () => {
    const ole = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0, 0, 0, 0, 0, 0, 0, 0])
    await expect(readDocx(ole.buffer)).rejects.toMatchObject({ code: 'legacy-binary' })
    await expect(readDocx(new TextEncoder().encode('hello').buffer as ArrayBuffer)).rejects.toMatchObject({ code: 'not-zip' })
  })
  it('a spreadsheet is not a Word document', async () => {
    const b = readFileSync(new URL('../../excel-editor/io/__fixtures__/openpyxl-rich.xlsx', import.meta.url))
    await expect(readDocx(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer)).rejects.toMatchObject({ code: 'not-ooxml' })
  })
})

const P = (text: string, marks?: PMNode['marks'], attrs?: Record<string, unknown>): PMNode => ({ type: 'paragraph', attrs, content: [{ type: 'text', text, ...(marks ? { marks } : {}) }] })

describe('writing .docx', () => {
  const rich: WordData = {
    ...emptyDoc(),
    header: 'Page {page} of {pages}',
    doc: {
      type: 'doc', content: [
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Section' }] },
        P('bold and plain', [{ type: 'bold' }]),
        { type: 'paragraph', content: [{ type: 'text', text: 'a  b' }, { type: 'text', text: 'link', marks: [{ type: 'link', attrs: { href: 'https://example.com' } }] }, { type: 'footnote', attrs: { text: 'A note' } }] },
        { type: 'ordered_list', attrs: { order: 1, kind: 'decimal' }, content: [{ type: 'list_item', content: [P('one')] }, { type: 'list_item', content: [P('two'), { type: 'bullet_list', content: [{ type: 'list_item', content: [P('nested')] }] }] }] },
        { type: 'ordered_list', attrs: { order: 1, kind: 'lower-roman' }, content: [{ type: 'list_item', content: [P('again one')] }] },
        { type: 'code_block', content: [{ type: 'text', text: 'line 1\nline 2' }] },
        { type: 'table', content: [
          { type: 'table_row', content: [{ type: 'table_header', attrs: { colspan: 1, rowspan: 2 }, content: [P('tall')] }, { type: 'table_header', attrs: { colspan: 1, rowspan: 1 }, content: [P('h2')] }] },
          { type: 'table_row', content: [{ type: 'table_cell', attrs: { colspan: 1, rowspan: 1, background: '#fff2cc' }, content: [P('x')] }] },
          { type: 'table_row', content: [{ type: 'table_cell', attrs: { colspan: 2, rowspan: 1 }, content: [P('wide')] }] },
        ] },
        P('مرحبا Riyadh', [{ type: 'bold' }], { dir: 'rtl', align: 'center' }),
        { type: 'page_break' },
        P('end'),
      ],
    },
  }

  it('is a valid package whose XML says what the document says', async () => {
    const b = await bytesOf(rich)
    const doc = zipPart(b, 'word/document.xml')
    expect(doc).toContain('<w:pStyle w:val="Heading2"/>')
    expect(zipPart(b, 'word/styles.xml')).toMatch(/w:styleId="Heading2"><w:name w:val="heading 2"\/>/)
    expect(doc).toContain('<w:b/><w:bCs/>')
    expect(doc).toContain('<w:t xml:space="preserve">a  b</w:t>')
    expect(doc).toMatch(/<w:hyperlink r:id="rId\d+">/)
    expect(zipPart(b, 'word/_rels/document.xml.rels')).toContain('Target="https://example.com" TargetMode="External"')
    expect(zipPart(b, 'word/footnotes.xml')).toContain('A note')
    expect(doc).toContain('<w:br w:type="page"/>')
    // A code block is a paragraph per line.
    expect(doc.match(/<w:pStyle w:val="SourceCode"\/>/g)).toHaveLength(2)
    // Merged cells: a restart, then a continuation placeholder below it.
    expect(doc).toContain('<w:vMerge w:val="restart"/>')
    expect(doc).toMatch(/<w:vMerge\/>/)
    expect(doc).toContain('<w:gridSpan w:val="2"/>')
    expect(doc).toContain('<w:tblHeader/>')
    expect(doc).toContain('w:fill="FFF2CC"')
    // Arabic: bidi paragraph, rtl run with the complex-script twins and an Arabic language.
    expect(doc).toMatch(/<w:bidi\/>.*<w:jc w:val="center"\/>/)
    const arabic = doc.slice(doc.indexOf('مرحبا') - 200, doc.indexOf('مرحبا'))
    expect(arabic).toMatch(/<w:b\/><w:bCs\/><w:rtl\/><w:lang w:bidi="ar-SA"\/><\/w:rPr><w:t xml:space="preserve">$/)
    // …and the Latin word after it in the same paragraph is NOT marked right to left.
    expect(doc.slice(doc.indexOf('Riyadh') - 120, doc.indexOf('Riyadh'))).not.toContain('<w:rtl/>')
    expect(zipPart(b, 'word/header1.xml')).toContain('PAGE')
    expect(zipPart(b, 'word/header1.xml')).toContain('NUMPAGES')
  })

  it('gives every list its own numbering instance, so the second does not continue the first', async () => {
    const num = zipPart(await bytesOf(rich), 'word/numbering.xml')
    expect(num.match(/<w:num w:numId=/g)).toHaveLength(2)
    expect(num.match(/<w:startOverride w:val="1"\/>/g)).toHaveLength(2)
    expect(num).toContain('w:val="lowerRoman"')
  })

  it('round-trips through our reader with the structure intact', async () => {
    const b = await bytesOf(rich)
    const back = await readDocx(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer)
    const d = back.data.doc
    valid(d)
    expect(all(d, 'heading')[0].attrs!.level).toBe(2)
    expect(all(d, 'ordered_list')).toHaveLength(2)
    expect(all(d, 'ordered_list')[1].attrs!.kind).toBe('lower-roman')
    expect(all(d, 'bullet_list')).toHaveLength(1)
    expect(all(d, 'footnote')[0].attrs!.text).toBe('A note')
    expect(all(d, 'code_block').map((c) => plainText(c))).toEqual(['line 1', 'line 2'])
    const t = all(d, 'table')[0]
    expect(t.content![0].content![0].attrs!.rowspan).toBe(2)
    expect(t.content![0].content![0].type).toBe('table_header')
    expect(t.content![2].content![0].attrs!.colspan).toBe(2)
    expect(t.content![1].content![0].attrs!.background).toBe('#fff2cc')
    const ar = all(d, 'paragraph').find((p) => plainText(p).startsWith('مرحبا'))!
    expect(ar.attrs).toMatchObject({ dir: 'rtl', align: 'center' })
    expect(ar.content!.every((c) => c.marks?.some((m) => m.type === 'bold'))).toBe(true)
    expect(back.data.header).toBe('Page {page} of {pages}')
    expect(all(d, 'page_break')).toHaveLength(1)
  })

  it('an empty document still opens', async () => {
    const b = await bytesOf(emptyDoc())
    expect(zipPart(b, 'word/document.xml')).toContain('<w:body><w:p/>')
  })

  it('a checklist is written as box characters, and says so', async () => {
    const r = await writeDocx({ ...emptyDoc(), doc: { type: 'doc', content: [{ type: 'bullet_list', attrs: { checklist: true }, content: [{ type: 'list_item', attrs: { checked: true }, content: [P('done')] }, { type: 'list_item', attrs: { checked: false }, content: [P('todo')] }] }] } })
    const doc = zipPart(new Uint8Array(await r.blob.arrayBuffer()), 'word/document.xml')
    expect(doc).toContain('☑ ')
    expect(doc).toContain('☐ ')
    expect(r.loss.map((l) => l.what)).toContain('checklist boxes (written as ☐ and ☑)')
    const back = await readDocx(await r.blob.arrayBuffer())
    const list = all(back.data.doc, 'bullet_list')[0]
    expect(list.attrs!.checklist).toBe(true)
    expect(list.content!.map((li) => [li.attrs!.checked, plainText(li)])).toEqual([[true, 'done'], [false, 'todo']])
  })
})

describe('helpers', () => {
  it('splits text where its direction changes', () => {
    expect(splitBidi('Hello مرحبا world')).toEqual([{ text: 'Hello ', rtl: false }, { text: 'مرحبا ', rtl: true }, { text: 'world', rtl: false }])
    expect(splitBidi('«مرحبا»')).toEqual([{ text: '«مرحبا»', rtl: true }])
    expect(splitBidi('123 abc')).toEqual([{ text: '123 abc', rtl: false }])
    expect(splitBidi('')).toEqual([])
  })
  it('colours from any CSS form', () => {
    expect(hex('#abc')).toBe('AABBCC')
    expect(hex('rgb(255, 0, 16)')).toBe('FF0010')
    expect(hex('#0B6E4F')).toBe('0B6E4F')
  })
  it('reads picture sizes from headers', () => {
    const png = new Uint8Array(24)
    png.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, 0, 0, 1, 44, 0, 0, 0, 200])
    expect(imageSize(png)).toEqual({ w: 300, h: 200 })
    expect(imageSize(new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 10, 0, 20, 0]))).toEqual({ w: 10, h: 20 })
    expect(imageSize(new Uint8Array([1, 2, 3]))).toBeNull()
  })
})
