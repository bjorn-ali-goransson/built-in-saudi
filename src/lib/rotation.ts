/** The element's current on-screen rotation in degrees (0–360), read from its rendered CSS transform. */
export function rotationOf(el: Element): number {
  const { a, b } = new DOMMatrix(getComputedStyle(el).transform)
  return (Math.atan2(b, a) * 180) / Math.PI
}

/**
 * How far an element turned between two angle readings, in degrees.
 * The reported angle jumps back to 0 after passing 360; for something that only
 * rotates forward, a "backwards" reading just means we crossed that seam.
 */
export function degreesMovedForward(previous: number, current: number): number {
  const moved = current - previous
  return moved < -180 ? moved + 360 : Math.max(0, moved)
}
