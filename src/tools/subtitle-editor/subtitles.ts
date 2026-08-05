// SRT and WebVTT are the same idea with different punctuation: SRT numbers its
// cues and writes times as 00:00:01,500; VTT drops the numbers, uses a dot, and
// carries a WEBVTT header. Parsing both into one shape means every operation
// (shift, scale, convert) is written once.

export interface Cue {
  start: number // seconds
  end: number
  text: string
}

export type Format = 'srt' | 'vtt'

const TIME = /(\d{1,3}):(\d{2}):(\d{2})[.,](\d{1,3})|(\d{1,3}):(\d{2})[.,](\d{1,3})/

export function parseTime(s: string): number | null {
  const m = s.trim().match(TIME)
  if (!m) return null
  if (m[1] !== undefined) {
    return +m[1] * 3600 + +m[2] * 60 + +m[3] + +m[4].padEnd(3, '0') / 1000
  }
  // mm:ss.mmm — VTT allows the hours to be omitted.
  return +m[5] * 60 + +m[6] + +m[7].padEnd(3, '0') / 1000
}

export function formatTime(sec: number, fmt: Format): string {
  const clamped = Math.max(0, sec)
  const ms = Math.round(clamped * 1000)
  const h = Math.floor(ms / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  const s = Math.floor((ms % 60000) / 1000)
  const f = ms % 1000
  const p = (n: number, w = 2) => String(n).padStart(w, '0')
  return `${p(h)}:${p(m)}:${p(s)}${fmt === 'srt' ? ',' : '.'}${p(f, 3)}`
}

export function detectFormat(text: string): Format {
  return /^﻿?WEBVTT/.test(text.trimStart()) ? 'vtt' : 'srt'
}

export interface ParseResult { cues: Cue[]; format: Format; skipped: number }

export function parse(input: string): ParseResult {
  const format = detectFormat(input)
  const text = input.replace(/^﻿/, '').replace(/\r\n?/g, '\n')
  // Blocks are separated by a blank line in both formats.
  const blocks = text.split(/\n{2,}/)
  const cues: Cue[] = []
  let skipped = 0
  for (const block of blocks) {
    const lines = block.split('\n').filter((l) => l.trim() !== '')
    if (lines.length === 0) continue
    // Drop the WEBVTT header and any NOTE/STYLE/REGION block.
    if (/^﻿?WEBVTT/.test(lines[0]) || /^(NOTE|STYLE|REGION)\b/.test(lines[0])) continue
    let i = 0
    // SRT's cue number, or a VTT cue identifier, sits above the timing line.
    if (!lines[i].includes('-->')) i++
    if (i >= lines.length || !lines[i].includes('-->')) { skipped++; continue }
    const [rawStart, rawEnd] = lines[i].split('-->')
    const start = parseTime(rawStart)
    const end = parseTime(rawEnd ?? '')
    if (start === null || end === null) { skipped++; continue }
    const body = lines.slice(i + 1).join('\n')
    cues.push({ start, end, text: body })
  }
  return { cues, format, skipped }
}

export function serialize(cues: Cue[], fmt: Format): string {
  const body = cues.map((c, i) => {
    const timing = `${formatTime(c.start, fmt)} --> ${formatTime(c.end, fmt)}`
    return fmt === 'srt' ? `${i + 1}\n${timing}\n${c.text}` : `${timing}\n${c.text}`
  }).join('\n\n')
  return fmt === 'vtt' ? `WEBVTT\n\n${body}\n` : `${body}\n`
}

/** Move every cue by `seconds` (negative pulls earlier). Never goes below zero. */
export function shift(cues: Cue[], seconds: number): Cue[] {
  return cues.map((c) => ({ ...c, start: Math.max(0, c.start + seconds), end: Math.max(0, c.end + seconds) }))
}

/**
 * Multiply every timestamp — the fix for subtitles that drift further out the
 * longer the film runs, which happens when the file was cut for a different
 * frame rate (23.976 vs 25 is the classic 4% error).
 */
export function scale(cues: Cue[], factor: number): Cue[] {
  return cues.map((c) => ({ ...c, start: c.start * factor, end: c.end * factor }))
}

export const FRAME_RATES = [23.976, 24, 25, 29.97, 30] as const

export function totalDuration(cues: Cue[]): number {
  return cues.reduce((max, c) => Math.max(max, c.end), 0)
}

/** Cues whose timings are broken — the things that make a player misbehave. */
export function problems(cues: Cue[]): { index: number; kind: 'reversed' | 'overlap' | 'empty' }[] {
  const out: { index: number; kind: 'reversed' | 'overlap' | 'empty' }[] = []
  cues.forEach((c, i) => {
    if (c.end <= c.start) out.push({ index: i, kind: 'reversed' })
    if (c.text.trim() === '') out.push({ index: i, kind: 'empty' })
    if (i > 0 && c.start < cues[i - 1].end) out.push({ index: i, kind: 'overlap' })
  })
  return out
}
