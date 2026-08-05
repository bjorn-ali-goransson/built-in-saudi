// Shared CSV parsing for the data tools. RFC 4180 quoting, plus the two things
// real files always get wrong: a UTF-8 BOM Excel writes and never mentions, and
// a delimiter that is not a comma (Excel in an Arabic or European locale writes
// semicolons, and nothing warns you).

export type Delimiter = ',' | ';' | '\t' | '|'

/** Guess the delimiter from the first few lines: the one with the most
 *  consistent count per row wins, not simply the most frequent character. */
export function sniffDelimiter(text: string): Delimiter {
  const lines = text.split(/\r?\n/).filter((l) => l.trim()).slice(0, 20)
  if (!lines.length) return ','
  let best: Delimiter = ','
  let bestScore = -1
  for (const d of [',', ';', '\t', '|'] as Delimiter[]) {
    const counts = lines.map((l) => l.split(d).length - 1)
    if (counts.every((c) => c === 0)) continue
    const mean = counts.reduce((a, b) => a + b, 0) / counts.length
    const variance = counts.reduce((a, b) => a + (b - mean) ** 2, 0) / counts.length
    // Reward many fields, punish rows disagreeing about how many there are.
    const score = mean - variance * 2
    if (score > bestScore) { bestScore = score; best = d }
  }
  return best
}

export function parseCsv(text: string, delimiter: Delimiter): string[][] {
  const src = text.replace(/^﻿/, '')
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') { field += '"'; i++ }
        else quoted = false
      } else field += ch
      continue
    }
    if (ch === '"') { quoted = true; continue }
    if (ch === delimiter) { row.push(field); field = ''; continue }
    if (ch === '\r') continue
    if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; continue }
    field += ch
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row) }
  return rows
}

/** Quote only where required, so a clean file stays diff-friendly. */
export function toCsv(rows: string[][], delimiter: Delimiter): string {
  const needsQuote = (v: string) => v.includes(delimiter) || v.includes('"') || /[\n\r]/.test(v)
  return rows
    .map((r) => r.map((v) => (needsQuote(v) ? `"${v.replace(/"/g, '""')}"` : v)).join(delimiter))
    .join('\n')
}

export interface CleanOptions {
  trim: boolean
  dropEmptyRows: boolean
  dropEmptyCols: boolean
  dedupe: boolean
  collapseSpaces: boolean
  hasHeader: boolean
}

export interface CleanResult {
  rows: string[][]
  removedRows: number
  removedCols: number
  duplicates: number
  trimmed: number
  /** Rows whose field count differs from the header's — the usual cause of a
   *  broken import, and invisible until something downstream fails. */
  ragged: number
}

export function clean(input: string[][], o: CleanOptions): CleanResult {
  let rows = input.map((r) => [...r])
  let trimmed = 0
  if (o.trim || o.collapseSpaces) {
    rows = rows.map((r) => r.map((v) => {
      let out = v
      if (o.collapseSpaces) out = out.replace(/\s+/g, ' ')
      if (o.trim) out = out.trim()
      if (out !== v) trimmed++
      return out
    }))
  }

  const header = o.hasHeader && rows.length ? rows[0] : null
  let body = header ? rows.slice(1) : rows

  let removedRows = 0
  if (o.dropEmptyRows) {
    const before = body.length
    body = body.filter((r) => r.some((v) => v.trim() !== ''))
    removedRows = before - body.length
  }

  let duplicates = 0
  if (o.dedupe) {
    const seen = new Set<string>()
    const kept: string[][] = []
    for (const r of body) {
      const key = JSON.stringify(r)
      if (seen.has(key)) { duplicates++; continue }
      seen.add(key)
      kept.push(r)
    }
    body = kept
  }

  rows = header ? [header, ...body] : body

  // Measure raggedness BEFORE the column pass: dropping empty columns rebuilds
  // every row at a uniform width, which would silently pad the short rows and
  // make the warning — the whole point of which is to surface them — never fire.
  const naturalWidth = rows.length
    ? (header ? rows[0].length : Math.max(...rows.map((r) => r.length)))
    : 0
  const ragged = rows.filter((r) => r.length !== naturalWidth).length

  let removedCols = 0
  if (o.dropEmptyCols && rows.length) {
    const width = Math.max(...rows.map((r) => r.length))
    const keep: number[] = []
    for (let c = 0; c < width; c++) {
      // A column counts as empty when every DATA cell is blank — a header alone
      // does not make it worth keeping.
      const dataRows = header ? rows.slice(1) : rows
      if (dataRows.some((r) => (r[c] ?? '').trim() !== '')) keep.push(c)
      else removedCols++
    }
    rows = rows.map((r) => keep.map((c) => r[c] ?? ''))
  }

  return { rows, removedRows, removedCols, duplicates, trimmed, ragged }
}
