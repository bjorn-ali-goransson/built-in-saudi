// Structural JSON diff. A line diff on two JSON documents is close to useless:
// reformatting or reordering keys makes every line look changed while the data
// is identical, and a real change deep in a nested object is buried in noise.
// This compares VALUES by path.

export type ChangeKind = 'added' | 'removed' | 'changed' | 'type'

export interface Change {
  path: string
  kind: ChangeKind
  before?: unknown
  after?: unknown
}

type Json = unknown

function typeOf(v: Json): string {
  if (v === null) return 'null'
  if (Array.isArray(v)) return 'array'
  return typeof v
}

function isObject(v: Json): v is Record<string, Json> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

export interface Options {
  /** Treat arrays as sets, so a reordered list is not reported as changed. */
  ignoreArrayOrder: boolean
}

function joinPath(base: string, key: string | number): string {
  return typeof key === 'number' ? `${base}[${key}]` : base ? `${base}.${key}` : key
}

export function diff(a: Json, b: Json, o: Options, path = ''): Change[] {
  if (Object.is(a, b)) return []

  const ta = typeOf(a), tb = typeOf(b)
  if (ta !== tb) return [{ path: path || '(root)', kind: 'type', before: a, after: b }]

  if (isObject(a) && isObject(b)) {
    const out: Change[] = []
    // Union of keys, in a stable order, so the report reads the same every run.
    const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort()
    for (const k of keys) {
      const inA = Object.prototype.hasOwnProperty.call(a, k)
      const inB = Object.prototype.hasOwnProperty.call(b, k)
      if (!inA) { out.push({ path: joinPath(path, k), kind: 'added', after: b[k] }); continue }
      if (!inB) { out.push({ path: joinPath(path, k), kind: 'removed', before: a[k] }); continue }
      out.push(...diff(a[k], b[k], o, joinPath(path, k)))
    }
    return out
  }

  if (Array.isArray(a) && Array.isArray(b)) {
    if (o.ignoreArrayOrder) {
      // Compare as multisets of serialised elements. Order-insensitive, which is
      // what you want for a list of tags and wrong for a list of steps — hence
      // the toggle rather than a guess.
      const key = (v: Json) => JSON.stringify(v)
      const countA = new Map<string, number>()
      const countB = new Map<string, number>()
      for (const v of a) countA.set(key(v), (countA.get(key(v)) ?? 0) + 1)
      for (const v of b) countB.set(key(v), (countB.get(key(v)) ?? 0) + 1)
      const out: Change[] = []
      for (const [k, n] of countA) {
        const m = countB.get(k) ?? 0
        for (let i = 0; i < n - m; i++) out.push({ path, kind: 'removed', before: JSON.parse(k) })
      }
      for (const [k, n] of countB) {
        const m = countA.get(k) ?? 0
        for (let i = 0; i < n - m; i++) out.push({ path, kind: 'added', after: JSON.parse(k) })
      }
      return out
    }
    const out: Change[] = []
    const len = Math.max(a.length, b.length)
    for (let i = 0; i < len; i++) {
      if (i >= a.length) { out.push({ path: joinPath(path, i), kind: 'added', after: b[i] }); continue }
      if (i >= b.length) { out.push({ path: joinPath(path, i), kind: 'removed', before: a[i] }); continue }
      out.push(...diff(a[i], b[i], o, joinPath(path, i)))
    }
    return out
  }

  return [{ path: path || '(root)', kind: 'changed', before: a, after: b }]
}

export function preview(v: unknown): string {
  if (v === undefined) return '—'
  const text = typeof v === 'string' ? `"${v}"` : JSON.stringify(v)
  return text && text.length > 80 ? `${text.slice(0, 77)}…` : text ?? 'undefined'
}

export function parseJson(text: string): { value: unknown; error: string } {
  if (!text.trim()) return { value: undefined, error: '' }
  try { return { value: JSON.parse(text), error: '' } } catch (e) {
    return { value: undefined, error: (e as Error).message }
  }
}
