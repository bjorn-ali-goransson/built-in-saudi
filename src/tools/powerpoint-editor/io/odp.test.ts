import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { readOdp, len } from './odp-read'
import { readPptx } from './pptx-read'
import { plainText, slideTitle, type DeckData, type ShapeEl, type TableEl, type ImageEl } from '../model'

// The fixture is the same five-slide deck as python-pptx.pptx, saved by
// LibreOffice Impress as .odp — so the numbers here can be held against what
// the .pptx reader gets from the original, which is the strongest check a
// second reader of the same deck can have.
const load = (n: string) => { const b = readFileSync(new URL(`./__fixtures__/${n}`, import.meta.url)); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer }
const shapes = (d: DeckData, i: number) => d.slides[i].elements.filter((e): e is ShapeEl => e.kind === 'shape')
const byText = (d: DeckData, i: number, t: string) => shapes(d, i).find((s) => plainText(s.text).includes(t))
const lines = (s: ShapeEl | undefined) => (s?.text?.paras || []).map((p) => [p.runs.map((r) => r.t).join(''), p.level || 0, p.bullet ?? null])

describe('reading .odp written by LibreOffice', () => {
  it('slides in order, the slide size, notes and the hidden slide', async () => {
    const { data, title } = await readOdp(load('libreoffice.odp'))
    expect(data.slides.map(slideTitle)).toEqual(['Product launch', 'Agenda', 'Shapes and a table', '', 'Hidden slide'])
    expect(title).toBe('Product launch')
    expect(data.size.w).toBeCloseTo(960, 0)
    expect(data.size.h).toBeCloseTo(540, 0)
    expect(data.slides[0].notes).toBe('Welcome everyone.')
    expect(data.slides[4].hidden).toBe(true)
    expect(data.slides.slice(0, 4).every((s) => !s.hidden)).toBe(true)
    expect(data.slides.map((s) => s.layout)).toEqual(['title', 'titleContent', 'titleOnly', 'blank', 'titleContent'])
  })

  it('placeholders keep their kind; an empty one stays an empty prompt', async () => {
    const { data } = await readOdp(load('libreoffice.odp'))
    expect(shapes(data, 0).map((s) => s.ph)).toEqual(['title', 'subTitle'])
    expect(plainText(shapes(data, 0)[1].text)).toBe('Riyadh, 2026')
    const empty = shapes(data, 4).find((s) => s.ph === 'body')!
    expect(plainText(empty.text)).toBe('')
  })

  it('bullets with their levels, and a link', async () => {
    const { data } = await readOdp(load('libreoffice.odp'))
    const body = shapes(data, 1).find((s) => s.ph === 'body')
    expect(lines(body)).toEqual([['Where we are', 0, 'bullet'], ['The numbers', 1, 'bullet'], ['Next steps', 0, 'bullet'], ['Our site', 0, 'bullet']])
    expect(body!.text!.paras[3].runs[0].link).toBe('https://example.com/')
    expect(body!.text!.paras.map((p) => p.runs[0].size)).toEqual([32, 28, 32, 32])
  })

  it('a rotated shape lands where the .pptx reader puts it: a transform, turned into a centre and an angle', async () => {
    const { data } = await readOdp(load('libreoffice.odp'))
    const { data: orig } = await readPptx(load('python-pptx.pptx'))
    const r = byText(data, 2, 'Rounded')!
    const o = shapes(orig, 2).find((s) => plainText(s.text).includes('Rounded'))!
    expect(r.geom).toBe('roundRect')
    expect(r.rot).toBe(15)
    expect(r.x).toBeCloseTo(o.x, 0)
    expect(r.y).toBeCloseTo(o.y, 0)
    expect(r.w).toBeCloseTo(o.w, 0)
    expect(r.fill).toEqual({ type: 'solid', color: '#0b6e4f' })
    expect(r.line).toMatchObject({ color: '#000000', width: 2 })
    expect(r.shadow).toBe(true)
    expect(r.text!.paras[0].runs[0]).toMatchObject({ t: 'Rounded', color: '#ffffff' })
  })

  it('a group flattens in place, a gradient fill survives, the Arabic box sits on the right', async () => {
    const { data } = await readOdp(load('libreoffice.odp'))
    const ovals = shapes(data, 2).filter((s) => s.geom === 'ellipse')
    expect(ovals.map((o) => Math.round(o.x))).toEqual([504, 612])
    expect(ovals[0].fill).toMatchObject({ type: 'grad', stops: [{ pos: 0, color: '#3e7fcc' }, { pos: 1, color: '#a4c1ff' }] })
    expect(shapes(data, 2).some((s) => s.geom === 'rightArrow')).toBe(true)
    const ar = byText(data, 2, 'الرياض')!
    // Written as a left-to-right paragraph aligned to its END — the right edge,
    // which is what the .pptx reader gets for the same box.
    expect(ar.text!.paras[0].align).toBe('r')
  })

  it('a table: column widths, cell fills, and a merge that keeps the row aligned', async () => {
    const { data } = await readOdp(load('libreoffice.odp'))
    const t = data.slides[2].elements.find((e): e is TableEl => e.kind === 'table')!
    expect(t.cols).toHaveLength(3)
    expect(t.cols[0]).toBeCloseTo(120, 0)
    expect(t.rows.map((r) => r.cells.map((c) => (c.merged ? '·' : plainText(c.text))))).toEqual([['Region', 'Q1', 'Q2'], ['Riyadh', '120', '135'], ['Merged', '·', '9']])
    expect(t.rows[2].cells[0].span).toEqual([1, 2])
    expect(t.rows[0].cells[0].fill).toBe('#4f81bd')
  })

  it('a picture is embedded; a chart is named in the loss list rather than dropped silently', async () => {
    const { data, loss } = await readOdp(load('libreoffice.odp'))
    const img = data.slides[3].elements.find((e): e is ImageEl => e.kind === 'image')!
    expect(data.media[img.media].mime).toBe('image/png')
    expect(img.w).toBeCloseTo(288, 0)
    expect(img.alt).toBe('image.png')
    expect(loss.map((l) => l.what)).toContain('charts')
    // The table's own preview picture (an .svm) is NOT a second element.
    expect(data.slides[2].elements.filter((e) => e.kind === 'image')).toHaveLength(0)
  })
})

describe('odp refusals and units', () => {
  it('a text document is not a presentation; a legacy .ppt is named', async () => {
    await expect(readOdp(load('../../../word-editor/io/__fixtures__/libreoffice.odt'))).rejects.toMatchObject({ code: 'not-ooxml' })
    const ole = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0, 0, 0, 0])
    await expect(readOdp(ole.buffer)).rejects.toMatchObject({ code: 'legacy-binary' })
  })
  it('lengths in every ODF unit, as points', () => {
    expect(len('2.54cm')).toBeCloseTo(72, 1)
    expect(len('1in')).toBe(72)
    expect(len('10mm')).toBeCloseTo(28.35, 1)
    expect(len('12pt')).toBe(12)
    expect(len('nonsense')).toBeUndefined()
  })
})
