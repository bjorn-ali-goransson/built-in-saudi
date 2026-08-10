// Making text easier to read — and the one piece of standard advice that is
// wrong for Arabic.
//
// Every dyslexia and low-vision guide says the same three things: bigger text,
// more space between lines, and **more space between letters**. The first two
// are script-neutral. The third is Latin advice, and applying it to Arabic
// damages the text.
//
// WHY. Arabic is cursive: letters JOIN, and the join is part of the letterform
// rather than a decoration between letters. Adding tracking pushes the glyphs
// apart and the connecting stroke either stretches into a bar or breaks, so a
// word stops looking like a word. This repo already knew it in practice without
// writing it down — **16 places in `src/` carry `rtl:tracking-normal`**,
// resetting the tracking that the Latin design applies.
//
// There is a second, independent reason to be careful with tracking, measured
// elsewhere in this repo: above **0.10em** a PDF text extractor reads the glyph
// gaps as SPACES, so `EXPERIENCE` comes back as `E X P E R I E N C E`. That
// cost 168 of 175 headings across 32 CVs before it was found. So tracking hurts
// machines at the same setting it is supposed to help humans — worth saying to
// anybody formatting a document they will send somewhere.
//
// WHAT DOES HELP ARABIC INSTEAD: vertical room. Arabic sits on a baseline with
// marks above and below, so a line height that is comfortable for Latin is
// tight for Arabic — the defaults below differ for that reason and no other.

import { detectScript, type Script } from '../../lib/readingRate'

export type { Script }
export { detectScript }

export interface Settings {
  /** Point size of the body text. */
  size: number
  /** Multiplier, not a length — it has to scale with the size. */
  lineHeight: number
  /** em. Latin only; forced to 0 for Arabic and the UI says why. */
  letterSpacing: number
  /** em. Safe for both scripts: it separates WORDS, not letters. */
  wordSpacing: number
  /** Characters per line — the typographic "measure". */
  measure: number
  theme: 'paper' | 'cream' | 'dark'
  /** A moving band that dims everything but the line being read. */
  ruler: boolean
  /** Bold the opening of each word to pull the eye along. */
  emphasis: boolean
}

/**
 * Defaults per script.
 *
 * The only differences are the two the script actually forces: no tracking for
 * Arabic, and more line height for it. Everything else is deliberately the same
 * so that the comparison between them means something.
 */
export const DEFAULTS: Record<Script, Settings> = {
  latin: {
    size: 20, lineHeight: 1.7, letterSpacing: 0.03, wordSpacing: 0.16,
    measure: 66, theme: 'cream', ruler: false, emphasis: false,
  },
  arabic: {
    size: 22, lineHeight: 2.0, letterSpacing: 0, wordSpacing: 0.16,
    measure: 60, theme: 'cream', ruler: false, emphasis: false,
  },
}

/** Above this, a PDF text extractor starts reading the gaps as spaces. */
export const MACHINE_SAFE_TRACKING = 0.10

/**
 * The tracking actually applied.
 *
 * Arabic is clamped to zero rather than merely defaulted to it, because the
 * control stays on screen and a slider that visibly does nothing is worse than
 * one that is explained.
 */
export const trackingFor = (script: Script, wanted: number): number =>
  script === 'arabic' ? 0 : wanted

/**
 * Split a word for the "bold the opening" style.
 *
 * Roughly the first 40% of the letters, at least one and never the whole word —
 * an entirely bold word is emphasis that emphasises nothing. Works for Arabic
 * as well: weight is a property of the glyph, so bolding a prefix does not
 * disturb the joining the way spacing does.
 */
export function splitEmphasis(word: string): [string, string] {
  const chars = [...word]
  if (chars.length < 2) return [word, '']
  const n = Math.max(1, Math.min(chars.length - 1, Math.round(chars.length * 0.4)))
  return [chars.slice(0, n).join(''), chars.slice(n).join('')]
}

/** The recommended range for line length, in characters. */
export const MEASURE_RANGE = [45, 75] as const

/** Is this line length within the range typography has settled on? */
export const measureOk = (n: number) => n >= MEASURE_RANGE[0] && n <= MEASURE_RANGE[1]
