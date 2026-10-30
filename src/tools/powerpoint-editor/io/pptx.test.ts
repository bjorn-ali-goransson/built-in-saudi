import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { readPptx } from './pptx-read'
import { writePptx } from './pptx-write'
import { blankDeck, newSlide, body, para, plainText, slideTitle, type DeckData, type ShapeEl, type TableEl, type ImageEl } from '../model'
import { Package } from '../../../lib/office/opc'

const hasPy = (() => { try { execFileSync('python3', ['-c', 'import pptx'], { stdio: 'ignore' }); return true } catch { return false } })()
const hasSoffice = existsSync('/usr/bin/soffice')
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAADCAIAAAA7ljmRAAAAEklEQVR4nGPgk9VGRgykCwlqAwC8PBQBXPqOYQAAAABJRU5ErkJggg=='

const load = (n: string) => { const b = readFileSync(new URL(`./__fixtures__/${n}`, import.meta.url)); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer }
const shapes = (d: DeckData, i: number) => d.slides[i].elements.filter((e): e is ShapeEl => e.kind === 'shape')
const byText = (d: DeckData, i: number, t: string) => shapes(d, i).find((s) => plainText(s.text).includes(t))

describe('reading .pptx from python-pptx', () => {
  it('slides in order, size, theme, notes and the hidden slide', async () => {
    const { data, title, loss } = await readPptx(load('python-pptx.pptx'))
    expect(title).toBe('Product launch')
    expect(data.size.w).toBeCloseTo(960, 0)
    expect(data.size.h).toBeCloseTo(540, 0)
    expect(data.slides.map(slideTitle)).toEqual(['Product launch', 'Agenda', 'Shapes and a table', '', 'Hidden slide'])
    expect(data.slides[0].notes).toBe('Welcome everyone.')
    expect(data.slides[4].hidden).toBe(true)
    expect(data.theme.colors.accent1).toMatch(/^#[0-9a-f]{6}$/)
    expect(data.theme.fonts.major).toBeTruthy()
    expect(loss.map((l) => l.what)).toContain('charts')
  })

  it('placeholders inherit position and text size from the layout and master', async () => {
    const { data } = await readPptx(load('python-pptx.pptx'))
    const t = shapes(data, 0).find((s) => s.ph === 'ctrTitle')!
    // The slide's title says nothing about where it is; the layout does.
    expect(t.w).toBeGreaterThan(400)
    expect(t.y).toBeGreaterThan(50)
    expect(t.text!.defaults?.size).toBeGreaterThanOrEqual(40)
    const body = shapes(data, 1).find((s) => s.ph === 'body')!
    expect(body.text!.paras.map((p) => [p.runs.map((r) => r.t).join(''), p.level || 0, p.bullet])).toEqual([
      ['Where we are', 0, 'bullet'], ['The numbers', 1, 'bullet'], ['Next steps', 0, 'bullet'], ['Our site', 0, 'bullet'],
    ])
    const next = body.text!.paras[2].runs[0]
    expect(next.b).toBe(true)
    expect(next.color).toBe('#c00000')
    expect(body.text!.paras[3].runs[0].link).toBe('https://example.com/')
  })

  it('shapes: geometry, fill, outline, rotation, a group flattened in place', async () => {
    const { data } = await readPptx(load('python-pptx.pptx'))
    const r = byText(data, 2, 'Rounded')!
    expect(r.geom).toBe('roundRect')
    expect(r.fill).toEqual({ type: 'solid', color: '#0b6e4f' })
    expect(r.line).toMatchObject({ color: '#000000', width: 2 })
    expect(r.rot).toBe(15)
    expect(r.x).toBeCloseTo(36, 0)
    expect(shapes(data, 2).some((s) => s.geom === 'rightArrow')).toBe(true)
    const ovals = shapes(data, 2).filter((s) => s.geom === 'ellipse')
    expect(ovals.map((o) => Math.round(o.x))).toEqual([504, 612])
    // A shape with no fill of its own takes its theme style's.
    const arrow = shapes(data, 2).find((s) => s.geom === 'rightArrow')!
    expect(arrow.fill).toEqual({ type: 'solid', color: 'accent1' })
  })

  it('Arabic text, a right-aligned paragraph', async () => {
    const { data } = await readPptx(load('python-pptx.pptx'))
    const ar = byText(data, 2, 'الرياض')!
    expect(ar.text!.paras[0].align).toBe('r')
  })

  it('a table with a merged cell, and a picture', async () => {
    const { data } = await readPptx(load('python-pptx.pptx'))
    const t = data.slides[2].elements.find((e): e is TableEl => e.kind === 'table')!
    expect(t.cols).toHaveLength(3)
    expect(t.rows.map((r) => r.cells.map((c) => (c.merged ? '·' : plainText(c.text))))).toEqual([['Region', 'Q1', 'Q2'], ['Riyadh', '120', '135'], ['Merged', '·', '9']])
    expect(t.rows[2].cells[0].span).toEqual([1, 2])
    expect(t.style?.header).toBe(true)
    const img = data.slides[3].elements.find((e): e is ImageEl => e.kind === 'image')!
    expect(data.media[img.media].mime).toBe('image/png')
    expect(data.media[img.media].data).toMatch(/^data:image\/png;base64,/)
    expect(img.w).toBeCloseTo(288, 0)
  })
})

describe('reading .pptx written by LibreOffice', () => {
  it('the same deck, by a different producer', async () => {
    const { data } = await readPptx(load('libreoffice.pptx'))
    expect(data.slides.length).toBeGreaterThanOrEqual(4)
    expect(data.slides.map(slideTitle).slice(0, 3)).toEqual(['Product launch', 'Agenda', 'Shapes and a table'])
    const body = shapes(data, 1).find((s) => plainText(s.text).includes('Where we are'))!
    expect(body.text!.paras.find((p) => p.runs.map((r) => r.t).join('') === 'The numbers')!.level).toBe(1)
    expect(data.slides[2].elements.some((e) => e.kind === 'table')).toBe(true)
    expect(data.slides.flatMap((s) => s.elements).some((e) => e.kind === 'image')).toBe(true)
  })
})

describe('refusals', () => {
  it('a .docx is not a presentation', async () => {
    const b = readFileSync(new URL('../../word-editor/io/__fixtures__/python-docx.docx', import.meta.url))
    await expect(readPptx(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer)).rejects.toMatchObject({ code: 'not-ooxml' })
  })
  it('a legacy .ppt is named', async () => {
    const buf = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0, 0, 0, 0]).buffer
    await expect(readPptx(buf)).rejects.toMatchObject({ code: 'legacy-binary' })
  })
})

/** A deck that exercises the writer: every element kind, both directions, notes, a hidden slide, links. */
function sample(): DeckData {
  const d = blankDeck(false)
  const s1 = d.slides[0]
  ;(s1.elements[0] as ShapeEl).text = body([para('Quarterly review')], { ...(s1.elements[0] as ShapeEl).text, paras: [para('Quarterly review')] })
  ;(s1.elements[1] as ShapeEl).text = { ...(s1.elements[1] as ShapeEl).text!, paras: [para('مراجعة الربع الأول', { rtl: true, align: 'ctr' })] }
  s1.notes = 'Say hello first.\nThen the agenda.'
  const s2 = newSlide('titleContent', d)
  ;(s2.elements[0] as ShapeEl).text!.paras = [para('Results')]
  ;(s2.elements[1] as ShapeEl).text!.paras = [
    para('Revenue up', { bullet: 'bullet' }),
    { runs: [{ t: 'twelve ' }, { t: 'percent', b: true, color: '#c00000' }], bullet: 'bullet', level: 1 },
    { runs: [{ t: 'see the site', link: 'https://example.com/' }], bullet: 'number' },
  ]
  s2.transition = { kind: 'push' }
  const s3 = newSlide('blank', d)
  s3.elements = [
    { id: 'r1', kind: 'shape', geom: 'roundRect', x: 40, y: 60, w: 200, h: 100, rot: 15, fill: { type: 'solid', color: 'accent2' }, line: { color: '#000000', width: 2, dash: 'dash' }, text: body([para('Rounded', { align: 'ctr' })], { anchor: 'ctr' }) },
    { id: 'a1', kind: 'shape', geom: 'rightArrow', x: 300, y: 60, w: 160, h: 80, fill: { type: 'grad', angle: 90, stops: [{ pos: 0, color: '#ff0000' }, { pos: 1, color: '#0000ff' }] }, line: null },
    { id: 'l1', kind: 'shape', geom: 'line', x: 40, y: 200, w: 300, h: 0, line: { color: 'accent1', width: 3, tail: 'triangle' } },
    { id: 'i1', kind: 'image', media: 'm1', x: 500, y: 60, w: 200, h: 150, alt: 'A red square', crop: { l: 0.1, t: 0, r: 0, b: 0.1 } },
    { id: 't1', kind: 'table', x: 40, y: 260, w: 600, h: 120, cols: [200, 200, 200], style: { header: true, banded: true, accent: 'accent1' }, rows: [
      { h: 40, cells: [{ text: body([para('Region')]) }, { text: body([para('Q1')]) }, { text: body([para('Q2')]) }] },
      { h: 40, cells: [{ text: body([para('Riyadh')]) }, { text: body([para('120')]) }, { text: body([para('135')]) }] },
      { h: 40, cells: [{ text: body([para('Merged')]), span: [1, 2] }, { text: body([para('')]), merged: true }, { text: body([para('9')]), fill: '#fff2cc' }] },
    ] },
    { id: 'g1', kind: 'shape', geom: 'rect', x: 700, y: 400, w: 200, h: 60, fill: { type: 'none' }, line: null, text: body([{ runs: [{ t: 'back to start', link: `#slide:${s1.id}` }] }]) },
  ]
  s3.hidden = true
  s3.bg = { type: 'solid', color: '#f4f1ea' }
  d.media.m1 = { mime: 'image/png', data: PNG }
  d.slides.push(s2, s3)
  return d
}
async function bytesOf(d: DeckData): Promise<ArrayBuffer> { const { blob } = await writePptx(d, { title: 'Review' }); return blob.arrayBuffer() }

describe('writing .pptx', () => {
  it('reads back what was written: text, levels, formatting, links, notes, transitions', async () => {
    const { data, title } = await readPptx(await bytesOf(sample()))
    expect(title).toBe('Review')
    expect(data.slides.map(slideTitle)).toEqual(['Quarterly review', 'Results', ''])
    expect(data.slides[0].notes).toBe('Say hello first.\nThen the agenda.')
    const sub = shapes(data, 0).find((s) => s.ph === 'subTitle')!
    expect(sub.text!.paras[0]).toMatchObject({ rtl: true, align: 'ctr' })
    const b = shapes(data, 1).find((s) => s.ph === 'body')!
    expect(b.text!.paras.map((p) => [p.runs.map((r) => r.t).join(''), p.level || 0, p.bullet])).toEqual([['Revenue up', 0, 'bullet'], ['twelve percent', 1, 'bullet'], ['see the site', 0, 'number']])
    expect(b.text!.paras[1].runs[1]).toMatchObject({ t: 'percent', b: true, color: '#c00000' })
    expect(b.text!.paras[2].runs[0].link).toBe('https://example.com/')
    expect(data.slides[1].transition?.kind).toBe('push')
    expect(data.slides[2].hidden).toBe(true)
    expect(data.slides[2].bg).toEqual({ type: 'solid', color: '#f4f1ea' })
    // The text size every run ends up at is the one the editor showed.
    expect(b.text!.paras[0].runs[0].size ?? b.text!.defaults?.size).toBe(24)
  })

  it('shapes, a line with an arrow, a cropped picture and a merged, banded table survive', async () => {
    const { data } = await readPptx(await bytesOf(sample()))
    const els = data.slides[2].elements
    const r = els.find((e): e is ShapeEl => e.kind === 'shape' && e.geom === 'roundRect')!
    expect(r).toMatchObject({ x: 40, y: 60, w: 200, h: 100, rot: 15, fill: { type: 'solid', color: 'accent2' } })
    expect(r.line).toMatchObject({ color: '#000000', width: 2, dash: 'dash' })
    expect(r.text!.anchor).toBe('ctr')
    const a = els.find((e): e is ShapeEl => e.kind === 'shape' && e.geom === 'rightArrow')!
    expect(a.fill).toMatchObject({ type: 'grad', angle: 90 })
    expect(a.line).toBe(null)
    const l = els.find((e): e is ShapeEl => e.kind === 'shape' && e.geom === 'line')!
    expect(l.line).toMatchObject({ color: 'accent1', width: 3, tail: 'triangle' })
    const img = els.find((e): e is ImageEl => e.kind === 'image')!
    expect(img.crop).toEqual({ l: 0.1, t: 0, r: 0, b: 0.1 })
    expect(img.alt).toBe('A red square')
    expect(data.media[img.media].data).toBe(PNG)
    const t = els.find((e): e is TableEl => e.kind === 'table')!
    expect(t.rows.map((row) => row.cells.map((c) => (c.merged ? '·' : plainText(c.text))))).toEqual([['Region', 'Q1', 'Q2'], ['Riyadh', '120', '135'], ['Merged', '·', '9']])
    expect(t.rows[2].cells[0].span).toEqual([1, 2])
    expect(t.rows[2].cells[2].fill).toBe('#fff2cc')
    const link = els.find((e): e is ShapeEl => e.kind === 'shape' && plainText(e.text) === 'back to start')!
    expect(link.text!.paras[0].runs[0].link).toBe(`#slide:${data.slides[0].id}`)
  })

  it('Arabic is written the way Office reads it: rtl paragraph, Arabic language, complex-script font', async () => {
    const pkg = await Package.open(await bytesOf(sample()))
    const xml = await pkg.text('ppt/slides/slide1.xml')
    expect(xml).toMatch(/<a:pPr[^>]*rtl="1"/)
    expect(xml).toMatch(/lang="ar-SA"[^>]*>[\s\S]*?<a:cs typeface="[^"]+"\/>[\s\S]*?مراجعة/)
  })

  it('a reimport of a reimport is stable — nothing drifts per round trip', async () => {
    const once = (await readPptx(await bytesOf(sample()))).data
    const twice = (await readPptx(await bytesOf(once))).data
    const strip = (d: DeckData) => JSON.stringify(d.slides.map((s) => ({ ...s, id: '', master: undefined, elements: s.elements.map((e) => ({ ...e, id: '', ord: '', ...(e.kind === 'image' ? { media: '' } : {}) })) })))
    expect(strip(twice)).toBe(strip(once))
  })

  it('an imported deck survives export with its layout backdrop kept shared', async () => {
    const { data } = await readPptx(load('python-pptx.pptx'))
    const back = (await readPptx(await bytesOf(data))).data
    expect(back.slides.map(slideTitle)).toEqual(data.slides.map(slideTitle))
    expect(back.slides[1].elements.filter((e) => e.kind === 'shape' && e.ph).length).toBe(2)
    expect(back.slides[2].elements.some((e) => e.kind === 'table')).toBe(true)
  })

  it.skipIf(!hasPy)('python-pptx reads the export', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'pp-'))
    const f = join(dir, 'deck.pptx')
    writeFileSync(f, Buffer.from(await bytesOf(sample())))
    const py = `
import sys, json
from pptx import Presentation
p = Presentation(sys.argv[1])
out = {'n': len(p.slides), 'w': p.slide_width, 'texts': [], 'notes': None, 'table': None, 'pics': 0, 'hidden': p.slides[2]._element.get('show')}
for s in p.slides:
  for sh in s.shapes:
    if sh.has_text_frame and sh.text_frame.text.strip(): out['texts'].append(sh.text_frame.text)
    if sh.has_table: out['table'] = [[c.text for c in r.cells] for r in sh.table.rows]
    if sh.shape_type == 13: out['pics'] += 1
out['notes'] = p.slides[0].notes_slide.notes_text_frame.text if p.slides[0].has_notes_slide else None
print(json.dumps(out))`
    const out = JSON.parse(execFileSync('python3', ['-c', py, f]).toString())
    expect(out.n).toBe(3)
    expect(out.w).toBe(12192000)
    expect(out.texts).toEqual(expect.arrayContaining(['Quarterly review', 'مراجعة الربع الأول', 'Results', 'Rounded']))
    expect(out.table[0]).toEqual(['Region', 'Q1', 'Q2'])
    expect(out.table[2][0]).toBe('Merged')
    expect(out.pics).toBe(1)
    expect(out.notes).toContain('Say hello first.')
    expect(out.hidden).toBe('0')
  })

  it.skipIf(!hasSoffice)('LibreOffice opens the export and keeps the text', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'pp-'))
    const f = join(dir, 'deck.pptx')
    writeFileSync(f, Buffer.from(await bytesOf(sample())))
    execFileSync('soffice', [`-env:UserInstallation=file://${dir}/lo-profile`, '--headless', '--convert-to', 'odp', '--outdir', dir, f], { stdio: 'ignore', timeout: 150_000 })
    const odp = readFileSync(join(dir, 'deck.odp'))
    const pkg = await Package.open(odp.buffer.slice(odp.byteOffset, odp.byteOffset + odp.byteLength) as ArrayBuffer).catch(() => null)
    // An .odp is a zip without [Content_Types].xml; read content.xml straight off it.
    const content = pkg ? '' : execFileSync('python3', ['-c', 'import zipfile,sys;print(zipfile.ZipFile(sys.argv[1]).read("content.xml").decode())', join(dir, 'deck.odp')]).toString()
    expect(content).toContain('Quarterly review')
    expect(content).toContain('مراجعة الربع الأول')
    expect(content).toContain('Rounded')
    expect(content).toContain('Riyadh')
    expect((content.match(/<draw:page /g) || []).length).toBe(3)
  }, 180_000)
})

describe('drawings: freeforms, connectors, hidden and group-filled groups', () => {
  const named = (d: DeckData, n: string) => d.slides[0].elements.find((e) => e.name === n) as ShapeEl | undefined

  it('a freeform keeps its own path, with guide names resolved against the shape size', async () => {
    const { data, loss } = await readPptx(load('drawn.pptx'))
    const f = named(data, 'Freeform')!
    expect(f.cust).toHaveLength(1)
    // x1 = w/2, y1 = h: a triangle from the bottom-left to the top middle to the bottom-right.
    expect(f.cust![0]).toMatchObject({ w: 635000, h: 635000, d: 'M 0 635000 L 317500 0 L 635000 635000 Z' })
    expect(loss.map((l) => l.what).join()).not.toMatch(/freeform/)
  })

  it('an arcTo becomes an absolute arc that ends where DrawingML says, and an unfilled path stays unfilled', async () => {
    const { data } = await readPptx(load('drawn.pptx'))
    const a = named(data, 'Arc')!.cust![0]
    expect(a.fill).toBe(false)
    // From the left end of a 200×100 ellipse, half a turn clockwise lands on its right end.
    expect(a.d).toBe('M 0 50 A 100 50 0 0 1 200 50')
  })

  it('an elbow connector is read as one, and written back as one', async () => {
    const { data } = await readPptx(load('drawn.pptx'))
    const c = named(data, 'Elbow')!
    expect(c.geom).toBe('bentConnector3')
    expect(c.adj).toEqual([25000])
    const back = await readPptx(await (await writePptx(data, { title: 'x' })).blob.arrayBuffer())
    const c2 = back.data.slides[0].elements.find((e) => e.kind === 'shape' && e.geom === 'bentConnector3') as ShapeEl
    expect(c2.adj).toEqual([25000])
  })

  it('a hidden group draws nothing; a grpFill piece takes its group fill; an empty outline is no outline', async () => {
    const { data } = await readPptx(load('drawn.pptx'))
    expect(named(data, 'Grid column')).toBeUndefined()
    expect(named(data, 'Icon piece')!.fill).toEqual({ type: 'solid', color: '#0070c0' })
    expect(named(data, 'Label')!.line).toBeNull()
  })

  it.skipIf(!hasPy)('a freeform written by us is a freeform to python-pptx, with the same points', async () => {
    const { data } = await readPptx(load('drawn.pptx'))
    const back = await readPptx(await (await writePptx(data, { title: 'x' })).blob.arrayBuffer())
    const f = back.data.slides[0].elements.find((e) => e.kind === 'shape' && e.cust && /Z/.test(e.cust[0].d)) as ShapeEl
    expect(f.cust![0].d).toBe('M 0 635000 L 317500 0 L 635000 635000 Z')
    const arc = back.data.slides[0].elements.find((e) => e.kind === 'shape' && e.cust?.[0].d.includes('A')) as ShapeEl
    expect(arc.cust![0].d).toBe('M 0 50 A 100 50 0 0 1 200 50')
    const dir = mkdtempSync(join(tmpdir(), 'pp-'))
    const file = join(dir, 'deck.pptx')
    writeFileSync(file, Buffer.from(await (await writePptx(data, { title: 'x' })).blob.arrayBuffer()))
    const py = `
import sys
from pptx import Presentation
from pptx.enum.shapes import MSO_SHAPE_TYPE
p = Presentation(sys.argv[1])
print(sum(1 for s in p.slides[0].shapes if s.shape_type == MSO_SHAPE_TYPE.FREEFORM))`
    expect(Number(execFileSync('python3', ['-c', py, file]).toString().trim())).toBe(2)
  })
})

describe('spaced capitals: letter spacing and caps are properties, not spaces', () => {
  it('are written as spc and cap, and read back on the run', async () => {
    const d = blankDeck(false)
    const s = d.slides[0]
    s.elements.push({ id: 'sp', kind: 'shape', geom: 'rect', x: 10, y: 10, w: 300, h: 40, fill: { type: 'none' }, line: null, text: body([para('', { runs: [{ t: 'What we do', spc: 3, caps: 'all' }] })]) } as ShapeEl)
    const back = await readPptx(await bytesOf(d))
    const run = back.data.slides[0].elements.flatMap((e) => (e.kind === 'shape' ? e.text?.paras || [] : [])).flatMap((p) => p.runs).find((r) => r.t === 'What we do')!
    expect(run).toMatchObject({ spc: 3, caps: 'all' })
  })
})
