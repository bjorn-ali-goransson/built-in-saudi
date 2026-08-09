// Building a word-search grid.
//
// Found by a web sweep of the teacher-tools market, where it is one of the
// handful of utilities every free classroom site ships. We had worksheets,
// bingo cards, quizzes, flashcards, seating charts and a random picker, and no
// word search.
//
// The reason it is worth building rather than copying is Arabic, which every
// incumbent gets wrong or does not attempt. Two things have to be right:
//
// 1. **A grid cell holds an ISOLATED letter.** That is what a canvas draws for
//    a lone Arabic character anyway, and it is correct here — a puzzle grid is
//    exactly the context where letters do not join. (The opposite problem to
//    `arabic-handwriting`, which needs ZWJ to force the joined forms.)
// 2. **The letters a solver's eye matches are the NORMALISED ones.** أ إ آ ا
//    look different and are the same letter to a reader hunting for a word, and
//    ة/ه and ى/ي are the same trap. If the word list is not normalised before
//    placement, a child looking for «استقلال» never finds «إستقلال» in the grid
//    even though it is there. Normalisation is applied to the placed letters,
//    and the clue list shows the word as it was typed.
//
// And a direction decision: for an Arabic puzzle the natural reading direction
// is right-to-left, so a word placed "horizontally" must read RTL. Placing
// Arabic left-to-right produces a grid that is technically solvable and reads
// backwards to everyone using it.

export interface Placed { word: string; row: number; col: number; dr: number; dc: number }

export interface Grid {
  cells: string[][]
  placed: Placed[]
  /** Words that would not fit anywhere, so the caller can say so. */
  rejected: string[]
  size: number
}

/** The eight directions, as [dRow, dCol]. */
const DIRS: [number, number][] = [
  [0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [1, -1], [-1, 1], [-1, -1],
]

const AR_LETTERS = 'ابتثجحخدذرزسشصضطظعغفقكلمنهوي'
const EN_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

/**
 * The same normalisation a reader's eye performs, and no more.
 *
 * Deliberately NOT the full `arabic-normalize` treatment: that tool can also
 * strip tatweel and unify lam-alef ligatures, which change the letter COUNT and
 * would make the grid disagree with the clue. Only same-letter-different-shape
 * substitutions belong here.
 */
export function normaliseLetter(ch: string): string {
  if ('أإآٱ'.includes(ch)) return 'ا'
  if (ch === 'ة') return 'ه'
  if (ch === 'ى') return 'ي'
  if (ch === 'ؤ') return 'و'
  if (ch === 'ئ') return 'ي'
  return ch
}

/** Letters only — spaces and punctuation cannot be placed in a cell. */
export const toLetters = (word: string): string[] =>
  [...word]
    // Harakat are combining marks: they are not letters and a grid cell holding
    // one would be a cell a solver cannot see.
    .filter((c) => !/[ً-ْٰـ\s‌‍]/.test(c))
    .filter((c) => /[\p{L}\p{N}]/u.test(c))
    .map((c) => normaliseLetter(c.toUpperCase()))

export const isArabic = (s: string) => /[؀-ۿ]/.test(s)

/**
 * Place the words, longest first.
 *
 * Longest-first matters: a long word has few legal positions, and placing the
 * short ones first fills the grid so that the long one has none left. The
 * result is the tool reporting "could not fit" for exactly the word the teacher
 * cared most about.
 */
export function buildGrid(words: string[], size: number, dirs: number, rand: () => number): Grid {
  const list = words
    .map((w) => ({ raw: w.trim(), letters: toLetters(w) }))
    .filter((w) => w.letters.length > 1)
    .sort((a, b) => b.letters.length - a.letters.length)

  const cells: (string | null)[][] = Array.from({ length: size }, () => Array<string | null>(size).fill(null))
  const placed: Placed[] = []
  const rejected: string[] = []
  // 2 = forwards only, 4 = + vertical, 8 = + diagonals and reversals.
  const allowed = dirs === 2 ? DIRS.slice(0, 2) : dirs === 4 ? DIRS.slice(0, 4) : DIRS

  for (const w of list) {
    if (w.letters.length > size) { rejected.push(w.raw); continue }
    // Every legal (start, direction) is enumerated and then shuffled, rather
    // than guessed at N times: a random-retry loop reports failure for a word
    // that has exactly one home, which is the common case on a tight grid.
    const spots: { r: number; c: number; d: [number, number] }[] = []
    for (const d of allowed) {
      for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
          const endR = r + d[0] * (w.letters.length - 1)
          const endC = c + d[1] * (w.letters.length - 1)
          if (endR < 0 || endR >= size || endC < 0 || endC >= size) continue
          let ok = true
          for (let i = 0; i < w.letters.length; i++) {
            const cur = cells[r + d[0] * i][c + d[1] * i]
            // A cell may be shared only when the letters agree — that overlap is
            // what makes a word search feel woven rather than a list in a box.
            if (cur !== null && cur !== w.letters[i]) { ok = false; break }
          }
          if (ok) spots.push({ r, c, d })
        }
      }
    }
    if (!spots.length) { rejected.push(w.raw); continue }
    const pick = spots[Math.floor(rand() * spots.length)]
    for (let i = 0; i < w.letters.length; i++) {
      cells[pick.r + pick.d[0] * i][pick.c + pick.d[1] * i] = w.letters[i]
    }
    placed.push({ word: w.raw, row: pick.r, col: pick.c, dr: pick.d[0], dc: pick.d[1] })
  }

  // Fill the gaps from the alphabet the words are in, or an English grid ends
  // up with Arabic filler and every real word is findable at a glance.
  const arabic = list.some((w) => isArabic(w.raw))
  const pool = arabic ? AR_LETTERS : EN_LETTERS
  const full = cells.map((row) => row.map((c) => c ?? pool[Math.floor(rand() * pool.length)]))

  return { cells: full, placed, rejected, size }
}

/** The smallest square that fits the longest word, with room to hide it. */
export const suggestSize = (words: string[]) =>
  Math.min(20, Math.max(8, ...words.map((w) => toLetters(w).length + 2)))
