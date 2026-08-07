// Comparing two versions of the same spreadsheet.
//
// The interesting decision is what counts as "the same row". Comparing by
// position only tells you the truth if nobody sorted, inserted or deleted
// anything — which is precisely what happened, or you would not be diffing.
// So the default is to match on a KEY column (an id, an email, an employee
// number) and fall back to position only when asked.
//
// Duplicate keys are the trap. If two rows share a key, "the" row for that key
// does not exist, and quietly taking the first produces a diff that is wrong in
// a way nobody will catch. They are counted and reported instead.
//
// Columns are matched by NAME, not position, for the same reason rows are: a
// column inserted in the middle shifts every later one, and comparing by
// position would then report every cell in the sheet as changed. Only the
// columns the two files SHARE decide whether a row changed — added and removed
// columns are reported on their own. Counting a new column as a change to every
// row is technically true and practically useless: one added column would bury
// the three edits you were looking for.

export type Mode = 'key' | 'position'

export interface DiffOptions {
  keyColumn: number
  mode: Mode
  ignoreCase: boolean
  ignoreWhitespace: boolean
  headerRow: boolean
}

export interface CellChange { column: string; before: string; after: string }

export interface RowDiff {
  key: string
  kind: 'added' | 'removed' | 'changed'
  changes: CellChange[]
  before: string[]
  after: string[]
}

export interface DiffResult {
  columns: string[]
  addedColumns: string[]
  removedColumns: string[]
  rows: RowDiff[]
  same: number
  duplicateKeys: { side: 'before' | 'after'; key: string; count: number }[]
}

const norm = (v: string, o: DiffOptions) => {
  let s = v ?? ''
  if (o.ignoreWhitespace) s = s.trim().replace(/\s+/g, ' ')
  if (o.ignoreCase) s = s.toLowerCase()
  return s
}

function index(rows: string[][], o: DiffOptions, keyAt: number): { map: Map<string, string[]>; dupes: { key: string; count: number }[] } {
  const map = new Map<string, string[]>()
  const counts = new Map<string, number>()
  rows.forEach((r, i) => {
    const key = o.mode === 'key' ? norm(r[keyAt] ?? '', o) : String(i)
    counts.set(key, (counts.get(key) ?? 0) + 1)
    if (!map.has(key)) map.set(key, r)
  })
  return {
    map,
    dupes: [...counts.entries()].filter(([, n]) => n > 1).map(([key, count]) => ({ key, count })),
  }
}

export function diffTables(a: string[][], b: string[][], o: DiffOptions): DiffResult {
  const headA = o.headerRow ? (a[0] ?? []) : []
  const headB = o.headerRow ? (b[0] ?? []) : []
  const bodyA = o.headerRow ? a.slice(1) : a
  const bodyB = o.headerRow ? b.slice(1) : b

  const width = Math.max(headA.length, headB.length, ...bodyA.map((r) => r.length), ...bodyB.map((r) => r.length), 0)
  const columns = Array.from({ length: width }, (_, i) => headB[i] || headA[i] || `#${i + 1}`)
  const addedColumns = headB.filter((h) => h && !headA.includes(h))
  const removedColumns = headA.filter((h) => h && !headB.includes(h))

  // The columns to actually compare, as (indexInA, indexInB, label). With
  // headers that is the shared names; without them, position is all there is.
  const pairs: { ia: number; ib: number; label: string }[] = o.headerRow
    ? headA
      .map((h, ia) => ({ h, ia, ib: headB.indexOf(h) }))
      .filter((x) => x.h && x.ib >= 0)
      .map((x) => ({ ia: x.ia, ib: x.ib, label: x.h }))
    : Array.from({ length: width }, (_, i) => ({ ia: i, ib: i, label: columns[i] }))

  // The key column was chosen against the newer file's headers; find the same
  // column by name in the older one, since it may sit elsewhere.
  const keyName = headB[o.keyColumn] ?? headA[o.keyColumn] ?? ''
  const keyInA = o.headerRow && keyName && headA.includes(keyName) ? headA.indexOf(keyName) : o.keyColumn
  const keyInB = o.headerRow && keyName && headB.includes(keyName) ? headB.indexOf(keyName) : o.keyColumn
  const ia = index(bodyA, o, keyInA)
  const ib = index(bodyB, o, keyInB)

  const rows: RowDiff[] = []
  let same = 0

  for (const [key, before] of ia.map) {
    const after = ib.map.get(key)
    if (!after) {
      rows.push({ key, kind: 'removed', changes: [], before, after: [] })
      continue
    }
    const changes: CellChange[] = []
    for (const p of pairs) {
      const x = before[p.ia] ?? ''
      const y = after[p.ib] ?? ''
      if (norm(x, o) !== norm(y, o)) changes.push({ column: p.label, before: x, after: y })
    }
    if (changes.length) rows.push({ key, kind: 'changed', changes, before, after })
    else same++
  }
  for (const [key, after] of ib.map) {
    if (!ia.map.has(key)) rows.push({ key, kind: 'added', changes: [], before: [], after })
  }

  return {
    columns,
    addedColumns,
    removedColumns,
    rows,
    same,
    duplicateKeys: [
      ...ia.dupes.map((d) => ({ side: 'before' as const, ...d })),
      ...ib.dupes.map((d) => ({ side: 'after' as const, ...d })),
    ],
  }
}

/** The diff as a CSV, so it can go back into a spreadsheet. */
export function diffToCsv(result: DiffResult): string {
  const esc = (s: string) => (/[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s)
  const out = [['change', 'key', 'column', 'before', 'after'].join(',')]
  for (const r of result.rows) {
    if (r.kind === 'changed') {
      for (const c of r.changes) out.push([r.kind, r.key, c.column, c.before, c.after].map(esc).join(','))
    } else {
      out.push([r.kind, r.key, '', r.before.join(' | '), r.after.join(' | ')].map(esc).join(','))
    }
  }
  return out.join('\r\n')
}
