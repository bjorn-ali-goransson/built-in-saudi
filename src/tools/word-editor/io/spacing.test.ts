// Spacing as Word lays it: what each paragraph, table and page says, read exactly. Built from
// hand-written parts so each case states the one thing it is about.
import { describe, it, expect } from 'vitest'
import { zipStore } from '../../../lib/zip'
import { REL } from '../../../lib/office/opc'
import { readDocx } from './docx-read'
import { writeDocx } from './docx-write'
import { blockCss } from '../schema'
import type { PMNode } from '../model'

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
const enc = (s: string) => new TextEncoder().encode(s)

async function docx(body: string, opts: { styles?: string; settings?: string | null } = {}): Promise<ArrayBuffer> {
  const rels = [
    opts.styles !== undefined ? `<Relationship Id="rS" Type="${REL.styles}" Target="styles.xml"/>` : '',
    opts.settings !== null ? `<Relationship Id="rT" Type="${REL.settings}" Target="settings.xml"/>` : '',
  ].join('')
  const files = [
    { name: '[Content_Types].xml', bytes: enc(`<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`) },
    { name: '_rels/.rels', bytes: enc(`<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="r1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`) },
    { name: 'word/_rels/document.xml.rels', bytes: enc(`<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels}</Relationships>`) },
    { name: 'word/document.xml', bytes: enc(`<?xml version="1.0"?><w:document xmlns:w="${W}"><w:body>${body}</w:body></w:document>`) },
  ]
  if (opts.styles !== undefined) files.push({ name: 'word/styles.xml', bytes: enc(`<?xml version="1.0"?><w:styles xmlns:w="${W}">${opts.styles}</w:styles>`) })
  if (opts.settings !== null) files.push({ name: 'word/settings.xml', bytes: enc(`<?xml version="1.0"?><w:settings xmlns:w="${W}">${opts.settings ?? ''}</w:settings>`) })
  return zipStore(files).arrayBuffer()
}
const p = (pPr: string, text = 'x', rPr = '') => `<w:p><w:pPr>${pPr}</w:pPr><w:r>${rPr ? `<w:rPr>${rPr}</w:rPr>` : ''}<w:t>${text}</w:t></w:r></w:p>`
const blocks = async (buf: ArrayBuffer) => (await readDocx(buf)).data.doc.content as PMNode[]
const NORMAL = `<w:docDefaults><w:rPrDefault><w:rPr><w:sz w:val="22"/></w:rPr></w:rPrDefault></w:docDefaults>`

describe('line spacing', () => {
  it('reads exact, at-least and multiple line rules', async () => {
    const [ex, min, mult, bare] = await blocks(await docx(
      p('<w:spacing w:line="300" w:lineRule="exact"/>') + p('<w:spacing w:line="320" w:lineRule="atLeast"/>') + p('<w:spacing w:line="360" w:lineRule="auto"/>') + p('<w:spacing w:lineRule="auto"/>'),
      { styles: NORMAL }))
    expect(ex.attrs).toMatchObject({ lineExact: 15 })
    expect(min.attrs).toMatchObject({ lineMin: 16 })
    expect(mult.attrs).toMatchObject({ lineHeight: 1.5 })
    // A rule with no value is single, not the document's last value.
    expect(bare.attrs?.lineExact ?? null).toBeNull()
    expect(blockCss(ex.attrs!).join(';')).toContain('line-height:15pt')
    expect(blockCss(min.attrs!).join(';')).toMatch(/line-height:max\(16pt,/)
  })

  it('writes the line rules back as Word reads them', async () => {
    const r = await readDocx(await docx(p('<w:spacing w:line="300" w:lineRule="exact"/>') + p('<w:spacing w:line="320" w:lineRule="atLeast"/>'), { styles: NORMAL }))
    const again = (await readDocx(await (await writeDocx(r.data)).blob.arrayBuffer())).data.doc.content as PMNode[]
    expect(again[0].attrs).toMatchObject({ lineExact: 15 })
    expect(again[1].attrs).toMatchObject({ lineMin: 16 })
  })
})

describe('space between paragraphs', () => {
  it('contextual spacing drops the space between paragraphs of one style', async () => {
    const styles = NORMAL + `<w:style w:type="paragraph" w:styleId="L"><w:name w:val="L"/><w:pPr><w:spacing w:before="120" w:after="120"/><w:contextualSpacing/></w:pPr></w:style>`
    const bs = await blocks(await docx(p('<w:pStyle w:val="L"/>') + p('<w:pStyle w:val="L"/>') + p(''), { styles }))
    expect(bs[0].attrs).toMatchObject({ spaceAfter: 0 })
    expect(bs[1].attrs).toMatchObject({ spaceBefore: 0 })
  })

  it('a paragraph with no style takes the default paragraph style', async () => {
    const styles = NORMAL + `<w:style w:type="paragraph" w:default="1" w:styleId="N"><w:name w:val="Normal"/><w:pPr><w:spacing w:after="200"/></w:pPr></w:style>`
    const [b] = await blocks(await docx(p(''), { styles }))
    expect(b.attrs).toMatchObject({ spaceAfter: 10 })
  })

  it('spacing adds only under the compat flag or with no settings part', async () => {
    const plain = (await readDocx(await docx(p(''), { styles: NORMAL, settings: '' }))).data
    const flag = (await readDocx(await docx(p(''), { styles: NORMAL, settings: '<w:compat><w:doNotUseHTMLParagraphAutoSpacing/></w:compat>' }))).data
    const none = (await readDocx(await docx(p(''), { styles: NORMAL, settings: null }))).data
    expect(plain.spaceSum).toBeFalsy()
    expect(flag.spaceSum).toBe(true)
    expect(none.spaceSum).toBe(true)
  })
})

describe('the document face and size', () => {
  it('come from the defaults and the theme; Calibri with no styles part, Times with one that names none', async () => {
    const named = (await readDocx(await docx(p(''), { styles: `<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Georgia"/><w:sz w:val="21"/></w:rPr></w:rPrDefault></w:docDefaults>` }))).data
    expect(named).toMatchObject({ font: 'Georgia', size: 10.5 })
    expect((await readDocx(await docx(p('')))).data.font).toBe('Calibri')
    expect((await readDocx(await docx(p(''), { styles: '' }))).data.font).toBe('Times New Roman')
  })

  it('a paragraph whose every run is smaller than the document carries that size itself', async () => {
    // Otherwise the paragraph's own (larger) size sets a minimum line height its text never reaches.
    const [b] = await blocks(await docx(p('', 'small', '<w:sz w:val="16"/>'), { styles: NORMAL }))
    expect(b.attrs).toMatchObject({ paraSize: 8 })
  })
})

describe('tables and the page', () => {
  it('a table pads its cells as it says, else with Word\'s 0 / 5.4pt, and a cell may override it', async () => {
    const tbl = (tblPr: string, tcPr = '') => `<w:tbl><w:tblPr>${tblPr}</w:tblPr><w:tblGrid><w:gridCol w:w="2000"/></w:tblGrid><w:tr><w:tc><w:tcPr>${tcPr}</w:tcPr><w:p/></w:tc></w:tr></w:tbl>`
    const bs = await blocks(await docx(
      tbl('') + tbl('<w:tblCellMar><w:top w:w="40" w:type="dxa"/><w:left w:w="100" w:type="dxa"/></w:tblCellMar>') +
      tbl('', '<w:tcMar><w:bottom w:w="60" w:type="dxa"/></w:tcMar>'),
      { styles: NORMAL }))
    const tables = bs.filter((b) => b.type === 'table')
    expect(tables[0].attrs?.pad).toBe('0 5.4 0 5.4')
    expect(tables[1].attrs?.pad).toBe('2 5.4 0 5')
    expect(tables[2].content![0].content![0].attrs?.pad).toBe('0 5.4 3 5.4')
    // And back out, read by the same reader.
    const r = await readDocx(await docx(tbl('<w:tblCellMar><w:top w:w="40" w:type="dxa"/></w:tblCellMar>', '<w:tcMar><w:left w:w="200" w:type="dxa"/></w:tcMar>'), { styles: NORMAL }))
    const again = ((await readDocx(await (await writeDocx(r.data)).blob.arrayBuffer())).data.doc.content as PMNode[]).find((b) => b.type === 'table')!
    expect(again.attrs?.pad).toBe('2 5.4 0 5.4')
    expect(again.content![0].content![0].attrs?.pad).toBe('2 5.4 0 10')
  })

  it('reads the header and footer distances and adds the gutter to the left margin', async () => {
    const sect = `<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="567" w:footer="851" w:gutter="567"/></w:sectPr>`
    const { page } = (await readDocx(await docx(p('') + sect, { styles: NORMAL }))).data
    expect(page.headerAt).toBeCloseTo(10, 0)
    expect(page.footerAt).toBeCloseTo(15, 0)
    expect(page.margins.left).toBeCloseTo(35.4, 0)
  })
})
