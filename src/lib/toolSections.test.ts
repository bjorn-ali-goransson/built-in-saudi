import { describe, it, expect } from 'vitest'
import { buildToolSections, demote } from './toolSections'
import { liveTools } from '../tools'
import { VIEWS, MEASURED } from '../tools/popularity'
import { ADDED } from '../tools/added'

const sections = buildToolSections('en')
const shown = sections.flatMap((s) => s.tools.map((t) => t.id))
const demoted = sections.flatMap((s) => (s.more ?? []).map((t) => t.id))

describe('demoting unpopular tools in the catalogue', () => {
  it('hides nothing: every live tool is either shown or behind a section\'s "more"', () => {
    const all = new Set([...shown, ...demoted])
    expect(liveTools.filter((t) => !all.has(t.id)).map((t) => t.id)).toEqual([])
    // ...and none is demoted twice, which would show one tile twice once expanded.
    expect(new Set(demoted).size).toBe(demoted.length)
  })

  it('demotes something — or the measurement is not reaching the catalogue at all', () => {
    expect(demoted.length).toBeGreaterThan(40)
  })

  it('demotes only what was measured, measured fairly, and seen at most twice', () => {
    const until = Date.parse(MEASURED.to)
    for (const id of demoted) {
      expect(VIEWS[id], id).toBeLessThanOrEqual(2)
      expect(until - Date.parse(ADDED[id]), id).toBeGreaterThanOrEqual(30 * 86400000)
    }
  })

  it('never demotes a tool added after the counting, or an essential one', () => {
    for (const id of ['word-editor', 'excel-editor', 'powerpoint-editor', 'messages', 'vat-calculator', 'prayer-timetable', 'pdf-split']) {
      expect(demoted, id).not.toContain(id)
    }
  })

  it('a section keeps at least three tiles up, and leads with what people open', () => {
    for (const s of sections) {
      if (!s.more?.length) continue
      expect(s.tools.length, s.key).toBeGreaterThanOrEqual(3)
      const measured = s.tools.filter((t) => VIEWS[t.id] !== undefined).map((t) => VIEWS[t.id])
      expect(measured, s.key).toEqual([...measured].sort((a, b) => b - a))
    }
  })

  // No section reaches the floor with the counts as they are, so the section
  // case above cannot see it. Five demoted tools in a row of their own can.
  it('the floor holds even when every tool in a section would go', () => {
    const five = liveTools.filter((t) => demoted.includes(t.id)).slice(0, 5)
    const r = demote(five)
    expect(r.tools.length).toBe(3)
    expect(r.more.length).toBe(2)
  })

  it('the curated rows are untouched', () => {
    const rec = sections.find((s) => s.key === '__rec')!
    expect(rec.more).toBeUndefined()
    expect(rec.tools.map((t) => t.id)).toContain('gosi-salary')
  })
})
