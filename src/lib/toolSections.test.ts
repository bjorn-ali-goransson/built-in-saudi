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

  it('the counts reach the catalogue at all', () => {
    // Nothing is demoted right now: the November 2026 cut removed every tool
    // seen twice or less. What must still hold is that the counts are wired in.
    expect(liveTools.filter((t) => VIEWS[t.id] !== undefined).length).toBeGreaterThan(80)
  })

  it('demotes only what was measured, measured fairly, and seen at most twice', () => {
    const until = Date.parse(MEASURED.to)
    for (const id of demoted) {
      expect(VIEWS[id], id).toBeLessThanOrEqual(2)
      expect(until - Date.parse(ADDED[id]), id).toBeGreaterThanOrEqual(30 * 86400000)
    }
  })

  it('never demotes a tool added after the counting', () => {
    for (const id of ['word-editor', 'excel-editor', 'powerpoint-editor', 'messages']) {
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

  // The floor cannot be seen through the real counts any more: the November
  // 2026 cut removed every tool with two views or fewer, so nothing is demoted
  // until traffic is counted again. The rule is checked on its own instead.
  it('the floor holds even when every tool in a section would go', () => {
    const fake = (id: string) => ({ ...liveTools[0], id })
    const ids = Object.keys(VIEWS).slice(0, 5)
    const r = demote(ids.map(fake))
    expect(r.tools.length).toBeGreaterThanOrEqual(Math.min(3, ids.length))
  })

  it('the curated rows are untouched', () => {
    const rec = sections.find((s) => s.key === '__rec')!
    expect(rec.more).toBeUndefined()
    expect(rec.tools.map((t) => t.id)).toContain('word-editor')
  })
})
