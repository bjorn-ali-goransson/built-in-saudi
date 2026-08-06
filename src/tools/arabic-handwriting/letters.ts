// Arabic handwriting practice sheets.
//
// Every generic worksheet site gets this wrong in the same way: they emit the
// letters as isolated glyphs in visual order, so a child practises shapes that
// never occur in a word. Getting it right needs two things we already have —
// a canvas, which does the shaping and the bidi, and the zero-width joiner.
//
// A letter's four forms are not four characters. You produce them by telling the
// font what the letter is joined TO, using U+200D ZERO WIDTH JOINER as a stand-in
// for a neighbour: ZWJ before it makes it look joined on the right (a final
// form), ZWJ after it makes it joined on the left (an initial form), both makes
// a medial. This is the correct way and it works in any shaping engine; the
// alternative — hard-coding the Arabic Presentation Forms block — is deprecated
// and does not exist for every letter.

export const ZWJ = '‍'

export interface Letter {
  /** The letter itself, isolated. */
  ch: string
  /** Its name, as a child would be taught it. */
  name: string
  /** Letters that never join to what follows them, so they have no initial or medial form. */
  nonJoining?: boolean
}

export const LETTERS: Letter[] = [
  { ch: 'ا', name: 'ألف', nonJoining: true },
  { ch: 'ب', name: 'باء' },
  { ch: 'ت', name: 'تاء' },
  { ch: 'ث', name: 'ثاء' },
  { ch: 'ج', name: 'جيم' },
  { ch: 'ح', name: 'حاء' },
  { ch: 'خ', name: 'خاء' },
  { ch: 'د', name: 'دال', nonJoining: true },
  { ch: 'ذ', name: 'ذال', nonJoining: true },
  { ch: 'ر', name: 'راء', nonJoining: true },
  { ch: 'ز', name: 'زاي', nonJoining: true },
  { ch: 'س', name: 'سين' },
  { ch: 'ش', name: 'شين' },
  { ch: 'ص', name: 'صاد' },
  { ch: 'ض', name: 'ضاد' },
  { ch: 'ط', name: 'طاء' },
  { ch: 'ظ', name: 'ظاء' },
  { ch: 'ع', name: 'عين' },
  { ch: 'غ', name: 'غين' },
  { ch: 'ف', name: 'فاء' },
  { ch: 'ق', name: 'قاف' },
  { ch: 'ك', name: 'كاف' },
  { ch: 'ل', name: 'لام' },
  { ch: 'م', name: 'ميم' },
  { ch: 'ن', name: 'نون' },
  { ch: 'ه', name: 'هاء' },
  { ch: 'و', name: 'واو', nonJoining: true },
  { ch: 'ي', name: 'ياء' },
]

export type Form = 'isolated' | 'initial' | 'medial' | 'final'

export const FORMS: Form[] = ['isolated', 'initial', 'medial', 'final']

/**
 * The letter as it appears in that position, expressed with joiners so the font
 * does the shaping. A non-joining letter genuinely has no initial or medial
 * form — returning the isolated shape there would teach a lie, so it returns
 * null and the sheet leaves the cell out.
 */
export function shaped(letter: Letter, form: Form): string | null {
  if (letter.nonJoining && (form === 'initial' || form === 'medial')) return null
  switch (form) {
    case 'isolated': return letter.ch
    case 'initial': return letter.ch + ZWJ
    case 'medial': return ZWJ + letter.ch + ZWJ
    case 'final': return ZWJ + letter.ch
  }
}

export const findLetter = (ch: string): Letter | undefined => LETTERS.find((l) => l.ch === ch)
