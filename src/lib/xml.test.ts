import { describe, it, expect } from 'vitest'
import { parseXml, kids, kid, find, findAll, attr, numAttr, onOff, textOf, x, raw, xmlDoc, decodeEntities, XmlError, stripInvalidXmlChars } from './xml'

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'

describe('parseXml', () => {
  it('resolves namespaces by URI, not by prefix', () => {
    const a = parseXml(`<w:document xmlns:w="${W}"><w:body><w:p/></w:body></w:document>`)
    const b = parseXml(`<doc xmlns="${W}"><body><p/></body></doc>`)
    const c = parseXml(`<q:document xmlns:q="${W}"><q:body><q:p/></q:body></q:document>`)
    for (const root of [a, b, c]) {
      expect(root.ns).toBe(W)
      expect(kids(kid(root, W, 'body'), W, 'p')).toHaveLength(1)
    }
  })

  it('a prefix rebound in a child scope resolves to the inner URI and restores after', () => {
    const r = parseXml('<a:r xmlns:a="u1"><a:x xmlns:a="u2"><a:y/></a:x><a:z/></a:r>')
    expect(find(r, 'u2', 'y')).not.toBeNull()
    expect(kid(r, 'u1', 'z')).not.toBeNull()
    expect(find(r, 'u1', 'y')).toBeNull()
  })

  it('reads namespaced attributes by URI', () => {
    const r = parseXml(`<w:p xmlns:w="${W}" xmlns:r="${R}" w:val="7" r:id="rId3" plain="p"/>`)
    expect(attr(r, 'val', W)).toBe('7')
    expect(attr(r, 'id', R)).toBe('rId3')
    expect(attr(r, 'plain')).toBe('p')
    expect(numAttr(r, 'val', 0, W)).toBe(7)
    expect(numAttr(r, 'missing', 5)).toBe(5)
  })

  it('decodes entities, numeric refs and CDATA, keeps whitespace', () => {
    const r = parseXml('<t>a &amp; b &lt;c&gt; &#1576;&#x627; <![CDATA[<raw & stuff>]]>  end</t>')
    expect(textOf(r)).toBe('a & b <c> با <raw & stuff>  end')
  })

  it('skips comments, PIs, the BOM and a DOCTYPE without expanding it', () => {
    const r = parseXml('﻿<?xml version="1.0"?><!DOCTYPE x [<!ENTITY e SYSTEM "file:///etc/passwd">]><!-- c --><x>&e;</x>')
    expect(r.local).toBe('x')
    expect(textOf(r)).toBe('&e;') // never expanded
  })

  it('handles attribute values containing > and the other quote', () => {
    const r = parseXml(`<a b="x>y" c='he said "hi"'/>`)
    expect(attr(r, 'b')).toBe('x>y')
    expect(attr(r, 'c')).toBe('he said "hi"')
  })

  it('throws on malformed input', () => {
    expect(() => parseXml('<a><b></a>')).toThrow(XmlError)
    expect(() => parseXml('<a>')).toThrow(XmlError)
    expect(() => parseXml('<a b=c/>')).toThrow(XmlError)
    expect(() => parseXml('just text')).toThrow(XmlError)
    expect(() => parseXml('<a><!-- x </a>')).toThrow(XmlError)
  })

  it('findAll walks in document order', () => {
    const r = parseXml('<r><t>1</t><g><t>2</t><t>3</t></g><t>4</t></r>')
    expect(findAll(r, '', 't').map(textOf)).toEqual(['1', '2', '3', '4'])
  })

  it('on/off follows the OOXML convention', () => {
    const r = parseXml(`<w:rPr xmlns:w="${W}"><w:b/><w:i w:val="0"/><w:u w:val="true"/><w:strike w:val="off"/></w:rPr>`)
    expect(onOff(kid(r, W, 'b'), W)).toBe(true)
    expect(onOff(kid(r, W, 'i'), W)).toBe(false)
    expect(onOff(kid(r, W, 'u'), W)).toBe(true)
    expect(onOff(kid(r, W, 'strike'), W)).toBe(false)
    expect(onOff(kid(r, W, 'caps'), W)).toBeUndefined()
  })

  it('parses a large flat document quickly', () => {
    const rows = Array.from({ length: 20000 }, (_, i) => `<row r="${i + 1}"><c r="A${i + 1}"><v>${i}</v></c></row>`).join('')
    const t0 = performance.now()
    const r = parseXml(`<sheetData>${rows}</sheetData>`)
    expect(kids(r, '', 'row')).toHaveLength(20000)
    expect(performance.now() - t0).toBeLessThan(2000)
  })
})

describe('x() builder', () => {
  it('escapes text and attributes, omits empty attrs, self-closes', () => {
    expect(x('a', { b: 'x"<&', c: undefined, d: false, e: true, f: 0 }).s).toBe('<a b="x&quot;&lt;&amp;" e="1" f="0"/>')
    expect(x('t', null, '<script>').s).toBe('<t>&lt;script&gt;</t>')
  })
  it('text that starts with < is never mistaken for markup', () => {
    expect(x('t', null, '<b>bold</b>').s).toBe('<t>&lt;b&gt;bold&lt;/b&gt;</t>')
  })
  it('nests, flattens arrays and drops falsy children', () => {
    expect(x('a', null, x('b'), [x('c'), null, false, 'z'], raw('<d/>')).s).toBe('<a><b/><c/>z<d/></a>')
  })
  it('strips characters XML 1.0 forbids', () => {
    expect(stripInvalidXmlChars('a\u0001b\u000bc\td\n')).toBe('abc\td\n')
    expect(x('t', null, 'bad\u0002').s).toBe('<t>bad</t>')
  })
  it('round-trips through the parser', () => {
    const doc = xmlDoc(x('w:document', { 'xmlns:w': W }, x('w:p', null, x('w:t', { 'xml:space': 'preserve' }, ' a & b '))))
    const r = parseXml(doc)
    expect(textOf(find(r, W, 't'))).toBe(' a & b ')
    expect(attr(find(r, W, 't'), 'space', 'http://www.w3.org/XML/1998/namespace')).toBe('preserve')
  })
  it('decodeEntities leaves unknown and out-of-range refs alone', () => {
    expect(decodeEntities('&nope; &#xFFFFFFF; &#65;')).toBe('&nope; &#xFFFFFFF; A')
  })
})
