import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { readOdt } from './odt-read'
import { fromMarkdown, fromText, toMarkdown, toText, toHtml, safeHref } from './text-formats'
import { schema } from '../schema'
import { plainText, emptyDoc, wordCount, isRtlText, type PMNode } from '../model'

const load = (n: string) => { const b = readFileSync(new URL('./__fixtures__/' + n, import.meta.url)); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer }
function all(n: PMNode, type: string, out: PMNode[] = []): PMNode[] { if (n.type === type) out.push(n); for (const c of n.content || []) all(c, type, out); return out }
const valid = (d: PMNode) => schema.nodeFromJSON(d).check()

describe('reading .odt from LibreOffice', () => {
  it('heading, formatting, link, footnote, list start and nesting, merged cells, Arabic', async () => {
    const r = await readOdt(load('libreoffice.odt'))
    const d = r.data.doc
    valid(d)
    expect(all(d, 'heading').map((h) => plainText(h))).toEqual(['Annual plan'])
    const texts = all(d, 'text')
    expect(texts.find((t) => t.text === 'bold')!.marks).toEqual([{ type: 'bold' }])
    expect(texts.find((t) => t.text === 'italic')!.marks).toEqual([{ type: 'italic' }])
    expect(texts.find((t) => t.text === 'a link')!.marks![0].attrs!.href).toBe('https://built-in-saudi.com/')
    expect(all(d, 'footnote')[0].attrs!.text).toBe('The footnote text.')
    const ol = all(d, 'ordered_list')
    expect(ol[0].attrs!.order).toBe(3)
    expect(plainText(all(ol[0], 'bullet_list')[0])).toBe('Nested bullet')
    expect(ol[1].attrs!.order).toBe(1)
    const t = all(d, 'table')[0]
    expect(t.content![0].content![0].attrs!.rowspan).toBe(2)
    expect(t.content![1].content!).toHaveLength(1)
    expect(t.content![2].content![0].attrs!.colspan).toBe(2)
    expect(all(d, 'paragraph').find((p) => plainText(p).startsWith('فقرة'))!.attrs!.dir).toBe('rtl')
  })
  it('refuses a spreadsheet and a non-zip', async () => {
    await expect(readOdt(load('../../../excel-editor/io/__fixtures__/libreoffice.ods'))).rejects.toMatchObject({ code: 'not-ooxml' })
    await expect(readOdt(new TextEncoder().encode('plain').buffer as ArrayBuffer)).rejects.toMatchObject({ code: 'not-zip' })
  })
})

describe('Markdown', () => {
  const md = `# Title

Some **bold**, *italic* and [a link](https://example.com).

- one
- two
  - nested
- [x] done

1. first
2. second

> quoted

\`\`\`
code here
\`\`\`

| A | B |
| --- | --- |
| 1 | 2 |

---

مرحبا بكم
`
  it('reads into valid structure', () => {
    const d = fromMarkdown(md).doc
    valid(d)
    expect(all(d, 'heading')[0].attrs!.level).toBe(1)
    expect(all(d, 'bullet_list')[0].content!).toHaveLength(3)
    expect(plainText(all(all(d, 'bullet_list')[0], 'bullet_list')[1])).toBe('nested')
    expect(all(d, 'ordered_list')[0].content!).toHaveLength(2)
    expect(all(d, 'code_block')[0].content![0].text).toBe('code here')
    expect(all(d, 'table')[0].content![0].content![0].type).toBe('table_header')
    expect(all(d, 'paragraph').slice(-1)[0].attrs!.dir).toBe('rtl')
  })
  it('round-trips through Markdown text', () => {
    const d = fromMarkdown(md).doc
    const out = toMarkdown(d)
    expect(out).toContain('# Title')
    expect(out).toContain('**bold**')
    expect(out).toContain('[a link](https://example.com)')
    expect(out).toContain('   - nested')
    expect(out).toContain('| A | B |')
    expect(out).toContain('```\ncode here\n```')
    const again = fromMarkdown(out).doc
    expect(all(again, 'heading').length).toBe(1)
    expect(all(again, 'table').length).toBe(1)
  })
  it('emphasis never hugs spaces, and Markdown characters in text are escaped', () => {
    const out = toMarkdown({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'a ' }, { type: 'text', text: ' b ', marks: [{ type: 'bold' }] }, { type: 'text', text: '*star*' }] }] })
    expect(out.trim()).toBe('a  **b** \\*star\\*')
  })
})

describe('plain text', () => {
  it('blank lines separate paragraphs; single newlines are line breaks', () => {
    const d = fromText('one\ntwo\n\nthree').doc
    expect(d.content).toHaveLength(2)
    expect(all(d, 'hard_break')).toHaveLength(1)
  })
  it('writes lists, tables and quotes readably', () => {
    const out = toText({ type: 'doc', content: [
      { type: 'ordered_list', attrs: { order: 3 }, content: [{ type: 'list_item', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'x' }] }] }] },
      { type: 'table', content: [{ type: 'table_row', content: [{ type: 'table_cell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'a' }] }] }, { type: 'table_cell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'b' }] }] }] }] },
    ] })
    expect(out).toBe('3. x\na\tb\n')
  })
})

describe('HTML', () => {
  it('escapes text, drops dangerous links and keeps their label', () => {
    const html = toHtml({ ...emptyDoc(), doc: { type: 'doc', content: [{ type: 'paragraph', content: [
      { type: 'text', text: '<script>alert(1)</script>' },
      { type: 'text', text: 'bad', marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }] },
      { type: 'text', text: 'good', marks: [{ type: 'link', attrs: { href: 'https://example.com' } }] },
    ] }] } }, 'T')
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
    expect(html).not.toContain('javascript:')
    expect(html).toContain('bad')
    expect(html).toContain('<a href="https://example.com">good</a>')
    expect(safeHref('data:text/html,x')).toBeNull()
  })
  it('sets dir and lang together for an Arabic document, and lists footnotes', () => {
    const html = toHtml({ ...emptyDoc(true), doc: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'نص' }, { type: 'footnote', attrs: { text: 'حاشية' } }] }] } }, 'عنوان')
    expect(html).toMatch(/<html lang="ar-SA" dir="rtl">/)
    expect(html).toContain('<li id="fn1">حاشية')
  })
})

describe('model helpers', () => {
  it('counts Arabic and Latin words alike', () => {
    expect(wordCount('Hello, world — مرحبا بالعالم')).toBe(4)
    expect(wordCount("it's 2026")).toBe(2)
    expect(wordCount('   ')).toBe(0)
  })
  it('direction follows the first strong letter', () => {
    expect(isRtlText('123 مرحبا')).toBe(true)
    expect(isRtlText('Hello مرحبا')).toBe(false)
    expect(isRtlText('123')).toBe(false)
  })
})
