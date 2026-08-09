// How long a piece of text takes to read, and to say out loud.
//
// SOURCES — checked 10 August 2026
//   Silent reading, Latin script: Brysbaert (2019), a meta-analysis of 190
//     studies — mean 238 wpm for adult silent reading of non-fiction, with a
//     normal range of 175–300.
//   Silent reading, Arabic: Trauzettel-Klosinski & Dietz (2012), the
//     International Reading Speed Texts (IReST), IOVS 53:5452 — one text at a
//     sixth-grade level translated into 17 languages, 436 participants aged
//     18–35, same font size and viewing distance. English 228 wpm, Arabic
//     **138**, Chinese 158, Hebrew 187, Spanish 218, Dutch 202.
//   Speaking aloud, Latin script: National Center for Voice and Speech, ~150
//     wpm conversational for US English; 100–150 is the usual presentation
//     band and 150–160 the audiobook/podcast one.
//   Speaking aloud, Arabic: two peer-reviewed normative studies, which
//     DISAGREE — see below. Damhoureyeh, Darawsheh, Qa'dan & Natour (JLTR),
//     adult Jordanian speakers: 140.07 w/m reading aloud, 124.51 spontaneous.
//     Marie et al. (JLTR), 65 adult Syrian speakers: 103.8 WPM reading aloud
//     (range 70.4–127.3), 117.6 in conversation.
//
// This module deliberately carries **no beta badge on the tools that use it**,
// and is in `src/lib/` rather than in a tool folder, so the Saudi-rule guard
// does not look at it. That is correct rather than an oversight: these are
// research findings about how people read, not a published rate that steps
// every July. The same reasoning as `due-date` and `ovulation`.
//
// THE FINDING THAT MAKES THIS WORTH HAVING. Every "words to minutes"
// calculator on the web — and there are at least eight sites whose entire
// domain is that one tool — applies an ENGLISH rate to whatever you paste.
// Arabic silent reading is **138 wpm against English's 238**, a 73%
// difference, because an Arabic word packs more in and the short vowels are
// not written, so each word costs more work. Our own word counter did the same
// thing: a hardcoded 200 wpm in both locales, which understated an Arabic
// reading time by about 45%.
//
// **The Arabic speaking figures disagree and are NOT averaged.** 104 against
// 140 w/m is a 35% spread across dialect and method, and the two studies do
// not even agree on the DIRECTION — Jordanian speakers read aloud faster than
// they speak spontaneously, Syrian speakers the other way round. Per the rule
// this repo already follows for the iqama work-permit levy: when sources
// disagree on a number, say so; do not average them into a number that is
// nobody's. So the answer here is a RANGE whose endpoints are the two studies,
// which is also more honest about a thing that genuinely varies by speaker.

export type Script = 'latin' | 'arabic'
export type Mode = 'silent' | 'aloud'

export interface Rate {
  /** Words per minute at the slow end. */
  slow: number
  /** Words per minute at the fast end. Equal to `slow` when only one figure
   *  is published, which the UI reports rather than padding into a range. */
  fast: number
  /**
   * The single published central figure, where one exists — for a caller that
   * has room for one number rather than a range.
   *
   * **Deliberately absent for Arabic spoken aloud**, because the two normative
   * studies disagree (104 against 140) and a midpoint would be the averaged
   * number this module's header refuses to invent. Absent rather than guessed
   * is the whole point of the field being optional.
   */
  mid?: number
}

export const RATES: Record<Script, Record<Mode, Rate>> = {
  latin: {
    silent: { slow: 175, mid: 238, fast: 300 },
    aloud: { slow: 120, mid: 150, fast: 160 },
  },
  arabic: {
    // One standardized figure exists (IReST) and no published spread with it,
    // so this is deliberately a point rather than an invented band.
    silent: { slow: 138, mid: 138, fast: 138 },
    // The two normative studies' means, used as the endpoints. No `mid`.
    aloud: { slow: 104, fast: 140 },
  },
}

/** Whether only a single figure is published for this combination. */
export const isPoint = (r: Rate) => r.slow === r.fast

const ARABIC = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/g

/**
 * Which script the text is mostly in.
 *
 * Decided by counting letters rather than by the UI locale: somebody on the
 * Arabic side of the site pasting an English script wants the English rate,
 * and a rate applied because of a URL prefix would be exactly the mistake this
 * module exists to fix, one level up.
 */
export function detectScript(text: string): Script {
  const arabic = (text.match(ARABIC) || []).length
  const latin = (text.match(/[A-Za-z]/g) || []).length
  return arabic > latin ? 'arabic' : 'latin'
}

/** Whitespace-separated words. Correct for both scripts. */
export function countWords(text: string): number {
  const t = text.trim()
  return t ? t.split(/\s+/).length : 0
}

/** Seconds a given number of words takes at a given words-per-minute rate. */
export const seconds = (words: number, wpm: number) => (words / wpm) * 60

/** How many words fit in a target number of minutes. */
export const wordsInMinutes = (minutes: number, wpm: number) =>
  Math.round(minutes * wpm)
