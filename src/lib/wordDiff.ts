// Diffing two documents at the granularity that answers the question.
//
// `text-diff` compares pasted text LINE by line, which is right for its job:
// you pasted the lines, so a line is a thing you recognise. A PDF has no lines
// you chose — the extractor gives you whatever the typesetter's line breaks
// happened to be — and the change people care about is a WORD: «thirty» became
// «sixty», a name changed, a clause number moved. A line-level answer to that
// highlights the whole clause and tells you nothing.
//
// So this is two levels, which is how real diff tools bound the cost:
//
//   1. **LCS over LINES**, hashed. A contract has thousands of words and
//      hundreds of lines, and full dynamic programming over words would be
//      millions of cells for a document anybody actually compares.
//   2. **LCS over WORDS**, but only inside a region the line pass already
//      marked as changed — which is small by construction.
//
// A common prefix and suffix are trimmed before either, because two versions of
// the same document usually share most of themselves and the interesting part
// is in the middle.

export type Op = 'same' | 'add' | 'del'

export interface Chunk {
  op: Op
  text: string
  /** 1-based page the chunk starts on, where the caller supplied pages. */
  page?: number
}

/** A line, and the page it came from. */
export interface SourceLine { text: string; page: number }

/** Longest common subsequence over any comparable items, as a pair of index
 *  lists. Plain DP — the callers keep the inputs small enough. */
function lcs<T>(a: T[], b: T[], eq: (x: T, y: T) => boolean): [number[], number[]] {
  const n = a.length
  const m = b.length
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0))
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = eq(a[i], b[j]) ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1])
    }
  }
  const ia: number[] = []
  const ib: number[] = []
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (eq(a[i], b[j])) { ia.push(i); ib.push(j); i++; j++ }
    else if (dp[i + 1][j] >= dp[i][j + 1]) i++
    else j++
  }
  return [ia, ib]
}

/** Words, keeping the whitespace out — it is not what changed. */
const words = (s: string) => s.split(/\s+/).filter(Boolean)

/** Compare a run of words and emit chunks. */
function diffWordRun(a: string[], b: string[], page: number, out: Chunk[]) {
  if (!a.length && !b.length) return
  if (!a.length) { out.push({ op: 'add', text: b.join(' '), page }); return }
  if (!b.length) { out.push({ op: 'del', text: a.join(' '), page }); return }

  const [ia, ib] = lcs(a, b, (x, y) => x === y)
  let i = 0
  let j = 0
  let k = 0
  const push = (op: Op, text: string) => {
    if (!text) return
    const last = out[out.length - 1]
    // Runs of the same kind read as one change, which is what a person sees.
    if (last && last.op === op && last.page === page) last.text += ' ' + text
    else out.push({ op, text, page })
  }
  while (i < a.length || j < b.length) {
    if (k < ia.length && i === ia[k] && j === ib[k]) {
      push('same', a[i]); i++; j++; k++
      continue
    }
    const nextA = k < ia.length ? ia[k] : a.length
    const nextB = k < ib.length ? ib[k] : b.length
    if (i < nextA) { push('del', a.slice(i, nextA).join(' ')); i = nextA }
    if (j < nextB) { push('add', b.slice(j, nextB).join(' ')); j = nextB }
  }
}

/**
 * Compare two documents given as lines with page numbers.
 *
 * Returns chunks in reading order. `same` chunks are included so a caller can
 * show context; a caller wanting only the changes can filter.
 */
export function diffDocuments(a: SourceLine[], b: SourceLine[]): Chunk[] {
  // Trim what the two versions share at each end. Two drafts of one contract
  // are mostly identical, and this is what keeps the DP small.
  let start = 0
  while (start < a.length && start < b.length && a[start].text === b[start].text) start++
  let endA = a.length
  let endB = b.length
  while (endA > start && endB > start && a[endA - 1].text === b[endB - 1].text) { endA--; endB-- }

  const out: Chunk[] = []
  const head = a.slice(0, start)
  if (head.length) out.push({ op: 'same', text: head.map((l) => l.text).join('\n'), page: head[0].page })

  const midA = a.slice(start, endA)
  const midB = b.slice(start, endB)
  if (midA.length || midB.length) {
    const [ia, ib] = lcs(midA, midB, (x, y) => x.text === y.text)
    let i = 0
    let j = 0
    let k = 0
    while (i < midA.length || j < midB.length) {
      if (k < ia.length && i === ia[k] && j === ib[k]) {
        out.push({ op: 'same', text: midA[i].text, page: midA[i].page })
        i++; j++; k++
        continue
      }
      const nextA = k < ia.length ? ia[k] : midA.length
      const nextB = k < ib.length ? ib[k] : midB.length
      const runA = midA.slice(i, nextA)
      const runB = midB.slice(j, nextB)
      const page = (runA[0] ?? runB[0])?.page ?? 1
      // Only here — inside a region the line pass already called changed — is
      // it worth looking at individual words.
      diffWordRun(runA.flatMap((l) => words(l.text)), runB.flatMap((l) => words(l.text)), page, out)
      i = nextA
      j = nextB
    }
  }

  const tail = a.slice(endA)
  if (tail.length) out.push({ op: 'same', text: tail.map((l) => l.text).join('\n'), page: tail[0].page })
  return out
}

/** Lines with their page number, from a per-page extraction. */
export function linesFromPages(pages: string[]): SourceLine[] {
  const out: SourceLine[] = []
  pages.forEach((text, p) => {
    for (const line of text.split('\n')) {
      const t = line.trim()
      if (t) out.push({ text: t, page: p + 1 })
    }
  })
  return out
}

/** How much changed, as a share of the longer document's words. */
export function changeShare(chunks: Chunk[]): number {
  let same = 0
  let changed = 0
  for (const c of chunks) {
    const n = words(c.text).length
    if (c.op === 'same') same += n
    else changed += n
  }
  const total = same + changed
  return total ? (changed / total) * 100 : 0
}
