import { describe, it, expect } from 'vitest'
import { EditorState, TextSelection } from 'prosemirror-state'
import { toPM, fromPM, setTs, tsAt, toggle, markOn, shiftLevel, setPara, patchRuns, patchParas, allRuns, firstRun } from './textEdit'
import type { TextBody } from './model'

const body: TextBody = {
  anchor: 'ctr', autofit: 'shrink', defaults: { size: 24, color: 'dk1' },
  paras: [
    { runs: [{ t: 'Hello ' }, { t: 'bold', b: true, color: '#c00000' }, { t: '\n' }, { t: 'next line', link: 'https://a.example/' }], align: 'ctr' },
    { runs: [{ t: 'مرحبا', font: 'Amiri', size: 30 }], rtl: true, level: 1, bullet: 'bullet' },
    { runs: [], size: 18 },
  ],
}

describe('slide text ↔ ProseMirror', () => {
  it('round-trips a body exactly, keeping its box properties', () => {
    expect(fromPM(toPM(body), body)).toEqual(body)
  })
  it('merges adjacent runs that look the same', () => {
    const b = fromPM(toPM({ paras: [{ runs: [{ t: 'a', b: true }, { t: 'b', b: true }, { t: 'c' }] }] }), undefined)
    expect(b.paras[0].runs).toEqual([{ t: 'ab', b: true }, { t: 'c' }])
  })
  it('a newline inside a pasted run becomes a line break', () => {
    const b = fromPM(toPM({ paras: [{ runs: [{ t: 'one\ntwo' }] }] }), undefined)
    expect(b.paras[0].runs).toEqual([{ t: 'one' }, { t: '\n' }, { t: 'two' }])
  })
  it('selection commands: size keeps colour, bold toggles, level shifts, alignment', () => {
    const doc = toPM(body)
    let st = EditorState.create({ doc, selection: TextSelection.create(doc, 7, 11) }) // "bold"
    const run = (c: (s: EditorState, d?: (tr: import('prosemirror-state').Transaction) => void) => boolean) => { c(st, (tr) => { st = st.apply(tr) }) }
    run(setTs({ size: 40 }))
    expect(tsAt(st)).toMatchObject({ size: 40, color: '#c00000' })
    expect(markOn(st, 'b')).toBe(true)
    run(toggle('b'))
    expect(markOn(st, 'b')).toBe(false)
    run(shiftLevel(1))
    run(setPara('align', 'r'))
    const out = fromPM(st.doc, body)
    expect(out.paras[0]).toMatchObject({ level: 1, align: 'r' })
    expect(out.paras[0].runs.find((r) => r.t === 'bold')).toEqual({ t: 'bold', color: '#c00000', size: 40 })
  })
})

describe('formatting a whole selected box', () => {
  it('patches every run, and empty paragraphs take the size', () => {
    const b = patchRuns(body, { size: 12, b: true })
    expect(b.paras.flatMap((p) => p.runs.map((r) => r.size))).toEqual([12, 12, 12, 12, 12])
    expect(b.paras[2].size).toBe(12)
    expect(allRuns(b, 'b')).toBe(true)
    expect(allRuns(patchRuns(b, { b: undefined }), 'b')).toBe(false)
  })
  it('patches paragraphs and reads the first run', () => {
    const b = patchParas(body, { align: 'just', bullet: null })
    expect(b.paras.map((p) => [p.align, p.bullet])).toEqual([['just', undefined], ['just', undefined], ['just', undefined]])
    expect(firstRun(body)).toEqual({ t: 'Hello ' })
  })
})
