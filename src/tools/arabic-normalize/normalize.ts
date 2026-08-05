// Arabic text normalisation. Every step here exists because the same word can be
// typed several visually-identical ways, which breaks search, deduplication and
// string comparison — "علي" typed with ى instead of ي will never match.

export interface Options {
  tashkeel: boolean   // remove harakāt (fatḥa, ḍamma, kasra, sukūn, shadda, tanwīn)
  tatweel: boolean    // remove the kashida ـ used to stretch words
  alef: boolean       // أ إ آ ٱ → ا
  yaa: boolean        // ى → ي  (alef maqṣūra typed for final yāʼ)
  taa: boolean        // ة → ه
  hamza: boolean      // ؤ ئ → ء
  punctuation: boolean// ، ؛ ؟ → , ; ?
  spaces: boolean     // collapse runs of whitespace, trim lines
  invisible: boolean  // strip zero-width joiners, marks and the BOM
}

export const DEFAULTS: Options = {
  tashkeel: true, tatweel: true, alef: true, yaa: true,
  taa: false, hamza: false, punctuation: false, spaces: true, invisible: true,
}

// U+064B–U+065F harakāt, U+0670 dagger alef, U+06D6–U+06ED Quranic annotation
// marks. Note removing these from a Quranic text destroys it — that is the
// user's call, but it is why tashkeel is a separate toggle rather than implied.
const TASHKEEL = /[ً-ٰٟۖ-ۭ]/g
const TATWEEL = /ـ/g
// Zero-width joiner/non-joiner, LTR/RTL marks and embedding controls, BOM.
const INVISIBLE = /[​-‏‪-‮⁦-⁩﻿]/g

export interface Result { text: string; removed: number }

export function normalize(input: string, o: Options): Result {
  let out = input
  if (o.invisible) out = out.replace(INVISIBLE, '')
  if (o.tashkeel) out = out.replace(TASHKEEL, '')
  if (o.tatweel) out = out.replace(TATWEEL, '')
  if (o.alef) out = out.replace(/[آأإٱ]/g, 'ا')
  if (o.yaa) out = out.replace(/ى/g, 'ي')
  if (o.taa) out = out.replace(/ة/g, 'ه')
  if (o.hamza) out = out.replace(/[ؤئ]/g, 'ء')
  if (o.punctuation) {
    out = out.replace(/،/g, ',').replace(/؛/g, ';').replace(/؟/g, '?')
      .replace(/٪/g, '%').replace(/‐|–|—/g, '-')
  }
  if (o.spaces) {
    out = out.split('\n').map((l) => l.replace(/[ \t ]+/g, ' ').trim()).join('\n')
      .replace(/\n{3,}/g, '\n\n')
  }
  return { text: out, removed: [...input].length - [...out].length }
}

/** Which normalisable features the text actually contains, for the "found" line. */
export function inspect(text: string) {
  return {
    tashkeel: (text.match(TASHKEEL) || []).length,
    tatweel: (text.match(TATWEEL) || []).length,
    alef: (text.match(/[آأإٱ]/g) || []).length,
    yaa: (text.match(/ى/g) || []).length,
    taa: (text.match(/ة/g) || []).length,
    hamza: (text.match(/[ؤئ]/g) || []).length,
    invisible: (text.match(INVISIBLE) || []).length,
  }
}
