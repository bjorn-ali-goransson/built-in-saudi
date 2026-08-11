// Turning two texts into the rows the tool renders.
//
// The ROW unit stays a line, deliberately — `lib/wordDiff.ts` records the
// reason: you pasted the lines, so a line is a thing you recognise. What was
// missing is one level down. Within a row the whole line was painted as
// changed, and measured over realistic edits (`node evals/diffgrain.mjs`) that
// is **4.6x** as many words as actually changed — **9–12x** on the commonest
// edit of all, one figure or one name inside a sentence:
//
//     The tenant shall pay an annual rent of thirty thousand riyals.
//     The tenant shall pay an annual rent of sixty  thousand riyals.
//
// Eleven words highlighted to report that one of them moved.
//
// The line pass itself now uses the shared `lcs` rather than the byte-identical
// copy this tool carried since it was written.

import { diffWords, lcs, sharedShare, WORD_DIFF_FLOOR, type Chunk } from '../../lib/wordDiff'

export type RowKind = 'add' | 'del' | 'eq'

/** A rendered part of a row: the text, and whether it is what changed. */
export interface Part { text: string; changed: boolean }

export interface Row {
  t: RowKind
  text: string
  /** The row split into changed and unchanged runs, where a partner row made
   *  that decidable. A single unchanged part means "the whole row". */
  parts: Part[]
}

const whole = (t: RowKind, text: string): Row => ({ t, text, parts: [{ text, changed: true }] })

/** LCS over lines — the row structure. */
function lineRows(a: string[], b: string[]): Row[] {
  const [ia, ib] = lcs(a, b, (x, y) => x === y)
  const rows: Row[] = []
  let i = 0
  let j = 0
  let k = 0
  while (i < a.length || j < b.length) {
    if (k < ia.length && i === ia[k] && j === ib[k]) {
      rows.push({ t: 'eq', text: a[i], parts: [{ text: a[i], changed: false }] })
      i++; j++; k++
      continue
    }
    const nextA = k < ia.length ? ia[k] : a.length
    const nextB = k < ib.length ? ib[k] : b.length
    while (i < nextA) rows.push(whole('del', a[i++]))
    while (j < nextB) rows.push(whole('add', b[j++]))
  }
  return rows
}

/** The chunks of one side of a word diff, in order, as parts. */
const sideParts = (chunks: Chunk[], mine: 'add' | 'del'): Part[] =>
  chunks
    .filter((c) => c.op === 'same' || c.op === mine)
    .map((c) => ({ text: c.text, changed: c.op !== 'same' }))

/**
 * Pair each removed row with the added row that replaced it and mark the words
 * that differ.
 *
 * Only within one changed run, and only where the pair is similar enough to be
 * two versions of one line — see `WORD_DIFF_FLOOR`. A deletion with no partner,
 * or a partner that shares almost nothing, keeps the whole-row highlight, which
 * is the honest answer for an inserted or rewritten line.
 */
function markWords(rows: Row[]): Row[] {
  for (let i = 0; i < rows.length; i++) {
    if (rows[i].t !== 'del') continue
    // The run of deletions, then the run of additions immediately after it.
    let d = i
    while (d < rows.length && rows[d].t === 'del') d++
    let a = d
    while (a < rows.length && rows[a].t === 'add') a++
    const dels = rows.slice(i, d)
    const adds = rows.slice(d, a)

    for (let n = 0; n < Math.min(dels.length, adds.length); n++) {
      const chunks = diffWords(dels[n].text, adds[n].text)
      if (sharedShare(chunks) < WORD_DIFF_FLOOR) continue
      dels[n].parts = sideParts(chunks, 'del')
      adds[n].parts = sideParts(chunks, 'add')
    }
    i = a - 1
  }
  return rows
}

/** The rows the tool renders, for two pasted texts. */
export function diffRows(a: string, b: string, ignoreWs: boolean): Row[] {
  const prep = (t: string) => t.split('\n').map((l) => (ignoreWs ? l.trim() : l))
  return markWords(lineRows(prep(a), prep(b)))
}

/** Words actually marked as changed — what the tool reports, and what
 *  `evals/diffgrain.mjs` measures against the whole-line answer. */
export function changedWords(rows: Row[]): number {
  let n = 0
  for (const r of rows) {
    if (r.t === 'eq') continue
    for (const p of r.parts) if (p.changed) n += p.text.split(/\s+/).filter(Boolean).length
  }
  return n
}
