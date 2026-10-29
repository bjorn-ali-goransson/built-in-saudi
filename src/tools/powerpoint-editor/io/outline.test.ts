import { describe, it, expect } from 'vitest'
import { fromOutline, toOutline } from './outline'
import { slideTitle, type ShapeEl } from '../model'

const md = `# Launch plan
Riyadh, 2026

---

# Why now
- The market **grew** 12%
  - mostly online
- See [the report](https://example.com/r)
> Pause here for questions.

---

# الخطوات التالية
1. التوظيف
2. الإطلاق
`

describe('outline (Markdown) ↔ deck', () => {
  it('one slide per section, a title slide first, bullets nested, notes from quotes', () => {
    const d = fromOutline(md)
    expect(d.slides.map(slideTitle)).toEqual(['Launch plan', 'Why now', 'الخطوات التالية'])
    expect(d.slides[0].layout).toBe('title')
    const body = d.slides[1].elements.find((e): e is ShapeEl => e.kind === 'shape' && e.ph === 'body')!
    expect(body.text!.paras.map((p) => [p.runs.map((r) => r.t).join(''), p.level || 0, p.bullet])).toEqual([['The market grew 12%', 0, 'bullet'], ['mostly online', 1, 'bullet'], ['See the report', 0, 'bullet']])
    expect(body.text!.paras[0].runs[1]).toEqual({ t: 'grew', b: true })
    expect(body.text!.paras[2].runs[1].link).toBe('https://example.com/r')
    expect(d.slides[1].notes).toBe('Pause here for questions.')
    const ar = d.slides[2].elements.find((e): e is ShapeEl => e.kind === 'shape' && e.ph === 'body')!
    expect(ar.text!.paras.map((p) => [p.bullet, p.rtl])).toEqual([['number', true], ['number', true]])
  })
  it('headings alone split slides when there are no rules', () => {
    expect(fromOutline('# One\n- a\n# Two\n- b\n').slides.map(slideTitle)).toEqual(['One', 'Two'])
  })
  it('a round trip keeps titles, bullets and notes', () => {
    const back = fromOutline(toOutline(fromOutline(md)))
    expect(back.slides.map(slideTitle)).toEqual(['Launch plan', 'Why now', 'الخطوات التالية'])
    expect(toOutline(back)).toBe(toOutline(fromOutline(md)))
  })
})
