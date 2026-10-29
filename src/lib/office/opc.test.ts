import { describe, it, expect } from 'vitest'
import { Package, PackageWriter, OpcError, REL, NS, resolvePart, relsPathOf, sniffImage, toBase64, fromBase64, parseDataUrl, dataUrl, writeDocProps, readTitle, relIs } from './opc'
import { zipStore } from '../zip'
import { kids, attr } from '../xml'

const buf = async (b: Blob) => await b.arrayBuffer()

describe('part paths', () => {
  it('resolves relative targets against the owning part', () => {
    expect(resolvePart('ppt/slides/slide3.xml', '../media/image1.png')).toBe('ppt/media/image1.png')
    expect(resolvePart('word/document.xml', 'media/a.png')).toBe('word/media/a.png')
    expect(resolvePart('word/document.xml', '/word/x.xml')).toBe('word/x.xml')
    expect(resolvePart('', 'word/document.xml')).toBe('word/document.xml')
    expect(resolvePart('a/b/c.xml', './d.xml')).toBe('a/b/d.xml')
  })
  it('finds the rels part of a part', () => {
    expect(relsPathOf('word/document.xml')).toBe('word/_rels/document.xml.rels')
    expect(relsPathOf('')).toBe('_rels/.rels')
  })
  it('makes relative targets the inverse of resolvePart', () => {
    for (const [from, to] of [['word/document.xml', 'word/media/i.png'], ['ppt/slides/slide1.xml', 'ppt/slideLayouts/slideLayout1.xml'], ['xl/worksheets/sheet1.xml', 'xl/drawings/drawing1.xml']]) {
      expect(resolvePart(from, PackageWriter.relTarget(from, to))).toBe(to)
    }
  })
  it('compares strict and transitional relationship types', () => {
    expect(relIs('http://purl.oclc.org/ooxml/officeDocument/relationships/officeDocument', REL.officeDocument)).toBe(true)
    expect(relIs(REL.image, REL.styles)).toBe(false)
  })
})

describe('PackageWriter -> Package', () => {
  it('round-trips parts, content types and relationships', async () => {
    const w = new PackageWriter()
    w.add('word/document.xml', '<w:document xmlns:w="' + NS.w + '"/>', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml')
    w.add('word/media/image1.png', new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]))
    w.rel('', { type: REL.officeDocument, target: 'word/document.xml' })
    const img = w.rel('word/document.xml', { type: REL.image, target: 'word/media/image1.png' })
    const link = w.rel('word/document.xml', { type: REL.hyperlink, target: 'https://example.com/?a=1&b=2', external: true })
    expect(w.rel('word/document.xml', { type: REL.image, target: 'word/media/image1.png' })).toBe(img) // deduped
    writeDocProps(w, { title: 'تقرير & Report', app: 'Test' })
    const pkg = await Package.open(await buf(await w.toBlob('application/zip')))
    expect(await pkg.mainPart()).toBe('word/document.xml')
    expect(pkg.contentType('word/document.xml')).toContain('wordprocessingml.document.main')
    expect(pkg.contentType('word/media/image1.png')).toBe('image/png')
    const rels = await pkg.rels('word/document.xml')
    expect(rels.find((r) => r.id === img)?.target).toBe('word/media/image1.png')
    expect(rels.find((r) => r.id === link)).toMatchObject({ external: true, target: 'https://example.com/?a=1&b=2' })
    expect((await pkg.bytes('word/media/image1.png'))[0]).toBe(0x89)
    expect(await readTitle(pkg)).toBe('تقرير & Report')
    expect(pkg.names()).toContain('[Content_Types].xml')
  })

  it('looks parts up case-insensitively, as OPC requires', async () => {
    const z = zipStore([
      { name: '[Content_Types].xml', bytes: new TextEncoder().encode(`<Types xmlns="${NS.ct}"><Default Extension="xml" ContentType="application/xml"/></Types>`) },
      { name: 'Word/Document.XML', bytes: new TextEncoder().encode('<a/>') },
    ])
    const pkg = await Package.open(await buf(z))
    expect(pkg.has('word/document.xml')).toBe(true)
    expect((await pkg.xml('word/document.xml')).local).toBe('a')
  })

  it('refuses a non-zip, a zip that is not OOXML, a legacy binary and an encrypted file by name', async () => {
    await expect(Package.open(new TextEncoder().encode('hello world, not a zip at all').buffer)).rejects.toMatchObject({ code: 'not-zip' })
    const z = zipStore([{ name: 'a.txt', bytes: new Uint8Array([1]) }])
    await expect(Package.open(await buf(z))).rejects.toMatchObject({ code: 'not-ooxml' })
    const ole = new Uint8Array(1024); ole.set([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])
    await expect(Package.open(ole.buffer)).rejects.toMatchObject({ code: 'legacy-binary' })
    const enc = new Uint8Array(2048); enc.set([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])
    const label = new Uint8Array([...new TextEncoder().encode('EncryptedPackage')].flatMap((b) => [b, 0]))
    enc.set(label, 600)
    await expect(Package.open(enc.buffer)).rejects.toBeInstanceOf(OpcError)
    await expect(Package.open(enc.buffer)).rejects.toMatchObject({ code: 'encrypted' })
  })

  it('a missing part is a named error, and tryXml swallows it', async () => {
    const w = new PackageWriter()
    w.add('a.xml', '<a/>')
    const pkg = await Package.open(await buf(await w.toBlob('application/zip')))
    await expect(pkg.bytes('nope.xml')).rejects.toMatchObject({ code: 'missing-part' })
    expect(await pkg.tryXml('nope.xml')).toBeNull()
    expect(await pkg.tryXml(undefined)).toBeNull()
  })

  it('writes every non-default type as an Override', async () => {
    const w = new PackageWriter()
    w.add('x/custom.bin', new Uint8Array([1]), 'application/x-thing')
    const pkg = await Package.open(await buf(await w.toBlob('application/zip')))
    const ct = await pkg.xml('[Content_Types].xml')
    expect(kids(ct, NS.ct, 'Override').map((o) => attr(o, 'PartName'))).toContain('/x/custom.bin')
  })
})

describe('images and base64', () => {
  it('sniffs image types from bytes', () => {
    expect(sniffImage(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))?.mime).toBe('image/png')
    expect(sniffImage(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))?.ext).toBe('jpeg')
    expect(sniffImage(new Uint8Array([0x47, 0x49, 0x46, 0x38]))?.ext).toBe('gif')
    expect(sniffImage(new TextEncoder().encode('<svg xmlns="x"/>'))?.mime).toBe('image/svg+xml')
    expect(sniffImage(new Uint8Array([1, 2, 3]))).toBeNull()
  })
  it('round-trips base64 and data URLs, including large buffers', () => {
    const big = new Uint8Array(200000).map((_, i) => i * 7)
    expect(fromBase64(toBase64(big))).toEqual(big)
    const u = dataUrl(new Uint8Array([1, 2, 3]), 'image/png')
    expect(parseDataUrl(u)).toEqual({ mime: 'image/png', bytes: new Uint8Array([1, 2, 3]) })
    expect(parseDataUrl('data:image/svg+xml,%3Csvg%2F%3E')?.bytes).toEqual(new TextEncoder().encode('<svg/>'))
    expect(parseDataUrl('nope')).toBeNull()
  })
})
