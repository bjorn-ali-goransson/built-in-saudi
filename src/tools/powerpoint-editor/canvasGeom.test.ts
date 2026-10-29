import { describe, it, expect } from 'vitest'
import { resize, rotation, lineEnds, lineBox, snapMove, bounds, type Box } from './canvasGeom'

const corner = (b: Box, sx: -1 | 1, sy: -1 | 1) => {
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2
  const a = ((b.rot || 0) * Math.PI) / 180
  const lx = (sx * b.w) / 2, ly = (sy * b.h) / 2
  return [cx + lx * Math.cos(a) - ly * Math.sin(a), cy + lx * Math.sin(a) + ly * Math.cos(a)]
}

describe('resizing', () => {
  it('east handle widens and keeps the west edge', () => {
    expect(resize({ x: 100, y: 100, w: 200, h: 100 }, 'e', 350, 150)).toMatchObject({ x: 100, y: 100, w: 250, h: 100 })
  })
  it('nw handle on a rotated box keeps the SE corner exactly where it was', () => {
    const b: Box = { x: 100, y: 100, w: 200, h: 100, rot: 30 }
    const se = corner(b, 1, 1)
    const r = resize(b, 'nw', 80, 60)
    const se2 = corner(r, 1, 1)
    expect(se2[0]).toBeCloseTo(se[0], 6)
    expect(se2[1]).toBeCloseTo(se[1], 6)
    expect(r.rot).toBe(30)
  })
  it('never inverts past the minimum size', () => {
    const r = resize({ x: 0, y: 0, w: 100, h: 100 }, 'e', -500, 50)
    expect(r.w).toBe(4)
    expect(r.x).toBe(0)
  })
  it('keeps the aspect ratio when asked', () => {
    const r = resize({ x: 0, y: 0, w: 200, h: 100 }, 'se', 400, 120, { keepAspect: true })
    expect(r.w / r.h).toBeCloseTo(2, 6)
    expect(r).toMatchObject({ x: 0, y: 0 })
  })
})

describe('rotating, lines, snapping', () => {
  it('rotation from the handle above, with detents', () => {
    const b = { x: 0, y: 0, w: 100, h: 100 }
    expect(rotation(b, 50, -100)).toBe(0)
    expect(rotation(b, 200, 50)).toBe(90)
    expect(rotation(b, 52, -100)).toBe(0) // pulled to 0
    expect(rotation(b, 150, -50, true) % 15).toBe(0)
  })
  it('a line round-trips through its box and flips', () => {
    const b = lineBox([300, 50], [100, 200])
    expect(b).toEqual({ x: 100, y: 50, w: 200, h: 150, flipH: true, flipV: undefined })
    expect(lineEnds(b)).toEqual([[300, 50], [100, 200]])
  })
  it('snaps a box to the slide centre and to another box, and says where', () => {
    const r = snapMove({ x: 0, y: 0, w: 100, h: 50 }, 427, 0, [{ x: 600, y: 300, w: 80, h: 80 }], { w: 960, h: 540 }, 6)
    expect(r.dx).toBe(430)
    expect(r.guides).toContainEqual({ axis: 'x', at: 480 })
    const r2 = snapMove({ x: 0, y: 0, w: 100, h: 50 }, 0, 298, [{ x: 600, y: 300, w: 80, h: 80 }], { w: 960, h: 540 }, 6)
    expect(r2.dy).toBe(300)
    const r3 = snapMove({ x: 0, y: 0, w: 100, h: 50 }, 200, 100, [], { w: 960, h: 540 }, 6)
    expect(r3).toEqual({ dx: 200, dy: 100, guides: [] })
  })
  it('bounds of a rotated square', () => {
    const b = bounds({ x: 0, y: 0, w: 100, h: 100, rot: 45 })
    expect(b.w).toBeCloseTo(141.42, 1)
    expect(b.x).toBeCloseTo(-20.71, 1)
  })
})
