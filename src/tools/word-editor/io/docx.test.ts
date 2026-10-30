import { describe, it, expect } from 'vitest'
import { readFileSync, writeFileSync, mkdtempSync, existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { inflateRawSync } from 'node:zlib'
import { readDocx } from './docx-read'
import { readOdt } from './odt-read'
import { writeDocx, splitBidi, hex, imageSize } from './docx-write'
import { schema } from '../schema'
import { plainText, emptyDoc, type PMNode, type WordData } from '../model'

const hasPy = (() => { try { execFileSync('python3', ['-c', 'import docx'], { stdio: 'ignore' }); return true } catch { return false } })()
/** A 4×3 green PNG. */
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAQAAAADCAIAAAA7ljmRAAAAEElEQVR4nGPgi7KHIwacHACWgQfVRVGdUQAAAABJRU5ErkJggg=='
const hasSoffice = existsSync('/usr/bin/soffice')
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

describe('floating pictures and text boxes', () => {
  // floating.docx and floating.odt are LibreOffice's own output (see
  // scripts/make-office-fixtures.py); floating-vml.docx is the same document
  // with the DrawingML branch removed, which is how Word 2007 wrote it.
  const text = (n: PMNode) => plainText(n)
  // VML carries no alt text for a picture, so only DrawingML can bring it.
  const expectPlaced = (r: { data: WordData; loss: { what: string }[] }, alt: string | null = 'Company logo') => {
    const d = r.data.doc
    valid(d)
    const img = all(d, 'image')[0]
    expect(img.attrs!.float).toBe('right')
    if (alt) expect(img.attrs!.alt).toBe(alt)
    const box = all(d, 'text_box')
    expect(box).toHaveLength(1)
    expect(box[0].attrs!.float).toBe('left')
    // Its own paragraphs — not words spilled into the sentence beside it.
    expect(box[0].content!.map(text)).toEqual(['Key figure', 'Revenue rose twelve percent.'])
    const beside = d.content!.find((n) => plainText(n).startsWith('This paragraph sits beside'))!
    expect(plainText(beside)).not.toContain('Key figure')
    // The box comes BEFORE the paragraph it was anchored in, so it floats beside it.
    expect(d.content!.indexOf(box[0])).toBe(d.content!.indexOf(beside) - 1)
    expect(r.loss.map((l) => l.what).filter((w) => /float|text box|shape|behind/.test(w))).toEqual([])
  }
  it('from LibreOffice .docx (DrawingML)', async () => { expectPlaced(await readDocx(load('floating.docx'))) })
  it('from a VML-only .docx (Word 2007)', async () => { expectPlaced(await readDocx(load('floating-vml.docx')), null) })
  it('from LibreOffice .odt', async () => { expectPlaced(await readOdt(load('floating.odt'))) })

  const doc = (): WordData => ({ ...emptyDoc(), doc: { type: 'doc', content: [
    P('Intro'),
    { type: 'text_box', attrs: { width: 200, float: 'left', fill: '#fff2cc', border: true }, content: [P('Key figure'), P('Revenue rose.')] },
    { type: 'paragraph', content: [
      { type: 'image', attrs: { src: 'data:image/png;base64,' + PNG, alt: 'Logo', width: 40, height: 30, float: 'right' } },
      { type: 'text', text: 'Beside the box.' }] },
  ] } })

  it('are written as an anchor and a text box, and come back the same', async () => {
    const b = await bytesOf(doc())
    const x = zipPart(b, 'word/document.xml')
    expect(x).toContain('<wp:anchor')
    expect(x).toMatch(/<wp:positionH relativeFrom="column"><wp:align>right<\/wp:align>/)
    expect(x).toContain('<wp:wrapSquare wrapText="bothSides"/>')
    expect(x).toContain('<mc:Choice Requires="wps">')
    // Anchored in the paragraph after it, not in an empty one of its own.
    expect(x).toMatch(/<w:p>(<w:pPr>.*?<\/w:pPr>)?<w:r><mc:AlternateContent>.*?<\/mc:AlternateContent><\/w:r><w:r><w:drawing>/)
    const back = await readDocx(b.buffer as ArrayBuffer)
    valid(back.data.doc)
    const box = all(back.data.doc, 'text_box')[0]
    expect(box.attrs).toMatchObject({ float: 'left', fill: '#fff2cc', border: true })
    expect(box.content!.map(text)).toEqual(['Key figure', 'Revenue rose.'])
    expect(all(back.data.doc, 'image')[0].attrs!.float).toBe('right')
    expect(back.data.doc.content!.map(text)).toEqual(['Intro', 'Key figure\nRevenue rose.', 'Beside the box.'])
  })

  it.skipIf(!hasPy)('open in python-docx, with the box text inside a txbxContent', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'wd-'))
    const f = join(dir, 'float.docx')
    writeFileSync(f, await bytesOf(doc()))
    // lxml, not our reader: an undeclared prefix or a malformed part fails here.
    const py = `import sys, docx, json
from lxml import etree
d = docx.Document(sys.argv[1])
b = d.element.body
ns = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main', 'wp': 'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing'}
q = lambda e: etree.XPath(e, namespaces=ns)(b)
print(json.dumps({'box': ''.join(q('.//w:txbxContent//w:t/text()')), 'align': q('.//wp:anchor/wp:positionH/wp:align/text()'), 'paras': [p.text for p in d.paragraphs]}))`
    const out = JSON.parse(execFileSync('python3', ['-c', py, f]).toString())
    expect(out.box).toBe('Key figureRevenue rose.')
    expect(out.align).toEqual(['left', 'right'])
    expect(out.paras).toEqual(['Intro', 'Beside the box.'])
  })

  it.skipIf(!hasSoffice)('LibreOffice reads them as a frame and a floating picture', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'wd-'))
    const f = join(dir, 'float.docx')
    writeFileSync(f, await bytesOf(doc()))
    execFileSync('soffice', [`-env:UserInstallation=file://${dir}/lo-profile`, '--headless', '--convert-to', 'fodt', '--outdir', dir, f], { stdio: 'ignore', timeout: 150_000 })
    const fodt = readFileSync(join(dir, 'float.fodt'), 'utf8')
    // LibreOffice opens a DrawingML text box as a shape carrying its paragraphs.
    expect(fodt).toMatch(/<draw:(custom-shape|frame)[^>]*>(?:(?!<\/draw:(custom-shape|frame)>).)*Key figure(?:(?!<\/draw:(custom-shape|frame)>).)*Revenue rose\./s)
    expect(fodt).toMatch(/style:horizontal-pos="right"/)
    expect(fodt).toMatch(/style:wrap="(parallel|dynamic)"/)
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

  // Somebody else's reader is the evidence — ours agreeing with our writer proves little.
  it.skipIf(!hasPy)('python-docx reads the export: headings by style name, the table, bold and Arabic', async () => {
    const f = join(mkdtempSync(join(tmpdir(), 'wd-')), 'out.docx')
    writeFileSync(f, await bytesOf(rich))
    const py = [
      'import docx, json, sys',
      'd = docx.Document(sys.argv[1])',
      'paras = [(p.style.name, p.text, any(r.bold for r in p.runs)) for p in d.paragraphs]',
      't = d.tables[0]',
      'print(json.dumps({"paras": paras, "cells": [c.text for c in t.rows[2].cells], "rows": len(t.rows)}))',
    ].join('\n')
    const out = JSON.parse(execFileSync('python3', ['-c', py, f]).toString()) as { paras: [string, string, boolean][]; cells: string[]; rows: number }
    expect(out.paras.find((p) => p[1] === 'Section')![0]).toBe('Heading 2')
    expect(out.paras.find((p) => p[1] === 'bold and plain')![2]).toBe(true)
    expect(out.paras.some((p) => p[1] === 'مرحبا Riyadh')).toBe(true)
    expect(out.rows).toBe(3)
    // A two-column merge is ONE cell that python-docx reports in both grid positions.
    expect(out.cells).toEqual(['wide', 'wide'])
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
