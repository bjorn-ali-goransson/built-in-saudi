import { describe, expect, it } from 'vitest'
import { atParam, parseAt } from './meeting'

describe('meeting start time in the link', () => {
  it('round-trips to the minute, in UTC', () => {
    const d = new Date(Date.UTC(2026, 10, 2, 6, 0, 33))
    expect(atParam(d)).toBe('2026-11-02T06:00Z')
    expect(parseAt(`?code=abc&at=${atParam(d)}`)?.toISOString()).toBe('2026-11-02T06:00:00.000Z')
  })
  it('ignores a missing or malformed time rather than guessing', () => {
    expect(parseAt('?code=abc')).toBeNull()
    expect(parseAt('?at=tomorrow')).toBeNull()
    expect(parseAt('?at=2026-11-02T06:00')).toBeNull() // no zone: which 06:00?
    expect(parseAt('?at=2026-13-40T25:00Z')).toBeNull()
  })
})
