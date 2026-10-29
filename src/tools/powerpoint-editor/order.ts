// Fractional order keys: the position of a slide in the deck, or of an element
// in a slide's stacking order, as a string that sorts between its neighbours.
//
// Why not indices or "after X": a guest applies its own edits at once and
// re-applies the still-pending ones whenever the owner's commits land first.
// That reproduces the owner's result only if every op is a last-writer-wins
// write to ONE field of ONE object. "Move to index 3" and "move after X" are
// not — their effect depends on where everything else currently is — and were
// measured to diverge in the convergence fuzz. A key between two neighbours is
// just a field: moving is setting it, and sorting by it gives the same order on
// every peer whatever order the writes arrived in.
//
// Keys are base-36 fractions (the string is the digits after "0."), compared as
// plain strings, never ending in '0' so no two strings denote the same number.
const D = '0123456789abcdefghijklmnopqrstuvwxyz'
const B = D.length

/** A key strictly between `a` and `b` (null = the open end). */
export function between(a: string | null, b: string | null): string {
  const lo = a || ''
  const hi = b
  if (hi !== null && lo >= hi) throw new Error(`order: ${lo} >= ${hi}`)
  let out = ''
  for (let i = 0; ; i++) {
    const da = i < lo.length ? D.indexOf(lo[i]) : 0
    const db = hi === null ? B : i < hi.length ? D.indexOf(hi[i]) : 0
    if (hi !== null && i >= hi.length && i >= lo.length) {
      // lo is a prefix of hi with nothing after: go half way to hi's next digit.
      return out + D[Math.max(1, Math.floor(da / 2))]
    }
    if (da === db) { out += D[da]; continue }
    const m = Math.floor((da + db) / 2)
    if (m > da) return out + D[m]
    // Adjacent digits: keep lo's, then anything above the rest of lo is below hi.
    out += D[da]
    return out + between(lo.slice(i + 1), null)
  }
}

/** n keys, evenly spread — for numbering a list that arrives without any (an import). */
export function spread(n: number): string[] {
  const out: string[] = []
  const width = Math.max(1, Math.ceil(Math.log(n + 2) / Math.log(B)) + 1)
  for (let i = 0; i < n; i++) {
    let v = Math.round(((i + 1) / (n + 1)) * Math.pow(B, width))
    let s = ''
    for (let k = 0; k < width; k++) { s = D[v % B] + s; v = Math.floor(v / B) }
    out.push(s.replace(/0+$/, '') || D[1])
  }
  return out
}

export interface Ordered { id: string; ord?: string }
export const byOrd = (a: Ordered, b: Ordered) => ((a.ord || '') < (b.ord || '') ? -1 : (a.ord || '') > (b.ord || '') ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0)

/**
 * A key between two others, made UNIQUE with a random tail. Two peers inserting
 * at the same spot at the same moment would otherwise compute the same key, and
 * a later insert between two equal keys has nowhere to go. The tail keeps the
 * order strict: `between` never returns a prefix of its upper bound, so
 * anything appended still sorts below it.
 */
export function keyBetween(a: string | null, b: string | null): string {
  const t = Array.from({ length: 3 }, () => D[1 + Math.floor(Math.random() * (B - 1))]).join('')
  return between(a, b) + t
}

/** The key that puts something right after `id` (null = at the very start) in an ordered list. */
export function ordAfter(list: Ordered[], id: string | null, skip?: string): string {
  const l = list.filter((x) => x.id !== skip)
  const lo = id === null ? null : l.find((x) => x.id === id)?.ord ?? (l.length ? l[l.length - 1].ord ?? null : null)
  // The next key strictly above lo — two items can share a key after a collision.
  const hi = lo === null ? l[0]?.ord ?? null : l.find((x) => (x.ord || '') > lo)?.ord ?? null
  return keyBetween(lo, hi)
}
export const ordEnd = (list: Ordered[]) => keyBetween(list[list.length - 1]?.ord ?? null, null)

/** Give every item a key if any are missing or out of order — an import, an old document. */
export function ensureOrd<T extends Ordered>(list: T[]): T[] {
  let ok = true
  for (let i = 0; i < list.length; i++) if (!list[i].ord || (i && byOrd(list[i - 1], list[i]) >= 0)) { ok = false; break }
  if (ok) return list
  const keys = spread(list.length)
  list.forEach((x, i) => (x.ord = keys[i]))
  return list
}
