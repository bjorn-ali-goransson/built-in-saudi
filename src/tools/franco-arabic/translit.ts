// Franco-Arabic (عربيزي / Arabic chat alphabet) → Arabic.
//
// The convention is real and remarkably consistent: digits stand in for the
// Arabic letters with no Latin lookalike, chosen because the digit resembles the
// letter's shape — 3 for ع, 7 for ح, 9 for ص. Everything else is phonetic.
//
// The hard part is that it is ambiguous by nature: "s" could be س or ص, "t"
// could be ت or ط. We take the common reading and say so, rather than pretending
// to certainty the input does not carry.

interface Rule { from: string; to: string }

// Longest first — "sh" must beat "s", and "3'" must beat "3".
const RULES: Rule[] = [
  // Digit-letters, the part that makes Franco recognisable.
  { from: "2", to: 'ء' },
  { from: "3'", to: 'غ' },
  { from: "3", to: 'ع' },
  { from: "5", to: 'خ' },
  { from: "6'", to: 'ظ' },
  { from: "6", to: 'ط' },
  { from: "7'", to: 'خ' },
  { from: "7", to: 'ح' },
  { from: "8", to: 'ق' },
  { from: "9'", to: 'ض' },
  { from: "9", to: 'ص' },
  // Digraphs.
  { from: 'kh', to: 'خ' },
  { from: 'sh', to: 'ش' },
  { from: 'ch', to: 'تش' },
  { from: 'th', to: 'ث' },
  { from: 'dh', to: 'ذ' },
  { from: 'gh', to: 'غ' },
  { from: 'aa', to: 'ا' },
  { from: 'ee', to: 'ي' },
  { from: 'ii', to: 'ي' },
  { from: 'oo', to: 'و' },
  { from: 'ou', to: 'و' },
  { from: 'uu', to: 'و' },
  // Single letters.
  { from: 'a', to: 'ا' },
  { from: 'b', to: 'ب' },
  { from: 'c', to: 'ك' },
  { from: 'd', to: 'د' },
  { from: 'e', to: 'ي' },
  { from: 'f', to: 'ف' },
  { from: 'g', to: 'ج' },
  { from: 'h', to: 'ه' },
  { from: 'i', to: 'ي' },
  { from: 'j', to: 'ج' },
  { from: 'k', to: 'ك' },
  { from: 'l', to: 'ل' },
  { from: 'm', to: 'م' },
  { from: 'n', to: 'ن' },
  { from: 'o', to: 'و' },
  { from: 'p', to: 'ب' },
  { from: 'q', to: 'ق' },
  { from: 'r', to: 'ر' },
  { from: 's', to: 'س' },
  { from: 't', to: 'ت' },
  { from: 'u', to: 'و' },
  { from: 'v', to: 'ف' },
  { from: 'w', to: 'و' },
  { from: 'x', to: 'كس' },
  { from: 'y', to: 'ي' },
  { from: 'z', to: 'ز' },
]

// Words so common that a letter-by-letter transliteration would be wrong, and
// everyone would notice. These are what makes the output read as Arabic rather
// than as a cipher.
const WORDS: Record<string, string> = {
  el: 'ال', al: 'ال',
  fe: 'في', fi: 'في',
  ana: 'أنا', enta: 'أنت', enti: 'أنتِ', hoa: 'هو', heya: 'هي',
  '3ala': 'على', '3an': 'عن', men: 'من', min: 'من',
  law: 'لو', bas: 'بس', kman: 'كمان',
  eh: 'إيه', esh: 'إيش', shu: 'شو', wesh: 'وش',
  wallah: 'والله', inshallah: 'إن شاء الله', mashallah: 'ما شاء الله',
  alhamdulillah: 'الحمد لله', bismillah: 'بسم الله', salam: 'سلام',
  habibi: 'حبيبي', habibti: 'حبيبتي', yalla: 'يلا', khalas: 'خلاص',
  shukran: 'شكرًا', afwan: 'عفوًا', marhaba: 'مرحبا', ahlan: 'أهلًا',
  akhi: 'أخي', okhti: 'أختي', walid: 'والد',
  '7abibi': 'حبيبي', '7elw': 'حلو', '3afwan': 'عفوًا',
}

/** True where the character can start or continue a Franco word. */
const WORD_CHAR = /[A-Za-z0-9'`]/

export interface Result { text: string; ambiguous: string[] }

// Letters whose Franco form has more than one plausible Arabic reading. Worth
// naming so the user checks them rather than trusting the output blindly.
const AMBIGUOUS: Record<string, string[]> = {
  s: ['س', 'ص'], t: ['ت', 'ط'], d: ['د', 'ض'], h: ['ه', 'ح'],
  a: ['ا', 'أ', 'ع'], e: ['ي', 'ة'], k: ['ك', 'ق'], g: ['ج', 'ق', 'غ'],
}

export function toArabic(input: string): Result {
  const ambiguous = new Set<string>()
  let out = ''
  let i = 0
  while (i < input.length) {
    if (!WORD_CHAR.test(input[i])) { out += input[i]; i++; continue }
    // Take the whole word so the dictionary can match it.
    let j = i
    while (j < input.length && WORD_CHAR.test(input[j])) j++
    const word = input.slice(i, j)
    const key = word.toLowerCase()
    if (WORDS[key]) { out += WORDS[key]; i = j; continue }
    // Definite article prefix: "elbeit" → "البيت".
    let rest = word
    let prefix = ''
    const artMatch = key.match(/^(el|al)(?=[a-z0-9])/)
    if (artMatch) { prefix = 'ال'; rest = word.slice(artMatch[1].length) }
    out += prefix + transliterateWord(rest, ambiguous)
    i = j
  }
  return { text: out, ambiguous: [...ambiguous] }
}

function transliterateWord(word: string, ambiguous: Set<string>): string {
  const lower = word.toLowerCase()
  let out = ''
  let i = 0
  while (i < lower.length) {
    const rule = RULES.find((r) => lower.startsWith(r.from, i))
    if (rule) {
      out += rule.to
      if (AMBIGUOUS[rule.from]) ambiguous.add(rule.from)
      i += rule.from.length
    } else {
      out += lower[i]
      i++
    }
  }
  // A short vowel at the end of a word is usually not written in Arabic, and
  // leaving it in makes every word end in ا or ي, which reads badly.
  return out.replace(/([^ا])ا$/u, '$1').replace(/^ا$/u, 'ا')
}

// ── The other direction ─────────────────────────────────────────────────────
const BACK: Record<string, string> = {
  'ا': 'a', 'أ': 'a', 'إ': 'e', 'آ': 'aa', 'ء': '2', 'ؤ': '2', 'ئ': '2',
  'ب': 'b', 'ت': 't', 'ث': 'th', 'ج': 'j', 'ح': '7', 'خ': '5',
  'د': 'd', 'ذ': 'dh', 'ر': 'r', 'ز': 'z', 'س': 's', 'ش': 'sh',
  'ص': '9', 'ض': "9'", 'ط': '6', 'ظ': "6'", 'ع': '3', 'غ': "3'",
  'ف': 'f', 'ق': '8', 'ك': 'k', 'ل': 'l', 'م': 'm', 'ن': 'n',
  'ه': 'h', 'ة': 'a', 'و': 'w', 'ي': 'y', 'ى': 'a', 'ﻻ': 'la',
}

export function toFranco(input: string): string {
  let out = ''
  for (const ch of input) {
    // Drop the harakāt: Franco has no way to write them and nobody types them.
    if (/[ً-ْٰ]/.test(ch)) continue
    out += BACK[ch] ?? ch
  }
  return out
}

export function looksFranco(text: string): boolean {
  return /[a-z]/i.test(text) && !/[؀-ۿ]/.test(text)
}
