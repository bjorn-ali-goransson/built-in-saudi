import { toCsv, type Delimiter } from '../../lib/csv'

// Splitting one big CSV into several small ones.
//
// The mistake that makes a split useless is dropping the header from every part
// after the first. Part 2 then opens as a file whose first row of data is being
// read as its column names — so a row goes missing AND every column is
// mislabelled, in a way that looks fine until someone sums the wrong column.
//
// The other one is Arabic. Excel reads a UTF-8 CSV as the local codepage unless
// the file starts with a byte-order mark, so a perfectly good split of Arabic
// names opens as ØªØ¬Ø±ÙŠØ¨ÙŠ. The BOM is a checkbox here, defaulted on,
// because the people most likely to split a CSV in this country are the ones
// most likely to hit that.

export type Mode = 'rows' | 'size' | 'column'

export interface SplitOptions {
  mode: Mode
  rowsPerFile: number
  /** Target size per file, in MB. */
  megabytes: number
  column: number
  headerRow: boolean
  bom: boolean
  delimiter: Delimiter
  baseName: string
}

export const DEFAULTS: SplitOptions = {
  mode: 'rows', rowsPerFile: 1000, megabytes: 5, column: 0,
  headerRow: true, bom: true, delimiter: ',', baseName: 'part',
}

export interface Part {
  name: string
  rows: string[][]
  /** Data rows, not counting the repeated header. */
  count: number
  bytes: number
}

const BOM = '﻿'

/** Safe for a filename on every platform, and still recognisable. */
export function safeName(value: string): string {
  const cleaned = value.trim().replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, '-')
  return cleaned.slice(0, 60) || 'blank'
}

export function csvText(part: Part, o: SplitOptions): string {
  return (o.bom ? BOM : '') + toCsv(part.rows, o.delimiter)
}

export function splitTable(rows: string[][], o: SplitOptions): Part[] {
  if (!rows.length) return []
  const header = o.headerRow ? rows[0] : null
  const body = o.headerRow ? rows.slice(1) : rows
  if (!body.length) return []

  // Every part carries the header. Costing a few bytes per file is nothing
  // beside a part that cannot be opened correctly.
  const make = (name: string, data: string[][]): Part => {
    const all = header ? [header, ...data] : data
    return { name, rows: all, count: data.length, bytes: new TextEncoder().encode(toCsv(all, o.delimiter)).length }
  }

  if (o.mode === 'column') {
    const groups = new Map<string, string[][]>()
    for (const r of body) {
      const key = (r[o.column] ?? '').trim()
      const list = groups.get(key) ?? []
      list.push(r)
      groups.set(key, list)
    }
    return [...groups.entries()].map(([key, data]) => make(`${safeName(key)}.csv`, data))
  }

  if (o.mode === 'size') {
    const limit = Math.max(0.01, o.megabytes) * 1048576
    const headerBytes = header ? new TextEncoder().encode(toCsv([header], o.delimiter)).length : 0
    const parts: Part[] = []
    let current: string[][] = []
    let bytes = headerBytes
    for (const r of body) {
      const rowBytes = new TextEncoder().encode(toCsv([r], o.delimiter)).length + 2
      // A single row larger than the limit still has to go somewhere, so it
      // becomes its own part rather than an infinite loop or a lost row.
      if (current.length && bytes + rowBytes > limit) {
        parts.push(make(`${o.baseName}-${parts.length + 1}.csv`, current))
        current = []
        bytes = headerBytes
      }
      current.push(r)
      bytes += rowBytes
    }
    if (current.length) parts.push(make(`${o.baseName}-${parts.length + 1}.csv`, current))
    return parts
  }

  const per = Math.max(1, Math.floor(o.rowsPerFile))
  const parts: Part[] = []
  for (let i = 0; i < body.length; i += per) {
    parts.push(make(`${o.baseName}-${parts.length + 1}.csv`, body.slice(i, i + per)))
  }
  return parts
}
