// Spelling an Arabic name in Latin letters.
//
// There is no correct answer, and that is the whole point of the tool. محمد is
// Mohammed, Muhammad, Mohamed, Mohammad and Muhammed on five passports in the
// same family, and every one of them is right. What actually matters is
// matching the document you already hold — a ticket that disagrees with a
// passport is a problem at the gate no matter which spelling is "better".
//
// So this offers OPTIONS and never a verdict. Two sources for them:
//
// 1. A short table of names common enough here that their usual spellings are
//    simply known. This is the part worth having.
// 2. A letter-by-letter fallback for everything else, clearly labelled as
//    generated rather than attested, because a systematic transliteration of a
//    name nobody spells that way is a guess dressed as an answer.

export interface Suggestion {
  text: string
  /** Attested spellings people actually use, or one this tool assembled. */
  source: 'common' | 'generated'
}

/**
 * Names common in the Kingdom, with the spellings that appear on real
 * documents. Ordered roughly by how often each is seen.
 */
export const COMMON: Record<string, string[]> = {
  'محمد': ['Mohammed', 'Muhammad', 'Mohamed', 'Mohammad', 'Muhammed'],
  'أحمد': ['Ahmed', 'Ahmad'],
  'احمد': ['Ahmed', 'Ahmad'],
  'عبدالله': ['Abdullah', 'Abdallah', 'Abd Allah'],
  'عبد الله': ['Abdullah', 'Abdallah', 'Abd Allah'],
  'عبدالعزيز': ['Abdulaziz', 'Abdelaziz', 'Abdul Aziz'],
  'عبدالرحمن': ['Abdulrahman', 'Abdurrahman', 'Abdul Rahman'],
  'خالد': ['Khalid', 'Khaled'],
  'سعد': ['Saad', 'Sa\'ad'],
  'سعود': ['Saud', 'Saoud'],
  'فهد': ['Fahad', 'Fahd'],
  'سلمان': ['Salman'],
  'تركي': ['Turki'],
  'بندر': ['Bandar'],
  'ناصر': ['Nasser', 'Naser', 'Nassir'],
  'فيصل': ['Faisal', 'Faysal'],
  'يوسف': ['Yousef', 'Youssef', 'Yusuf', 'Yousuf'],
  'إبراهيم': ['Ibrahim', 'Ebrahim'],
  'ابراهيم': ['Ibrahim', 'Ebrahim'],
  'عمر': ['Omar', 'Umar'],
  'علي': ['Ali'],
  'حسن': ['Hassan', 'Hasan'],
  'حسين': ['Hussain', 'Hussein', 'Husain'],
  'ماجد': ['Majed', 'Majid'],
  'بدر': ['Bader', 'Badr'],
  'سلطان': ['Sultan'],
  'مشعل': ['Mishal', 'Mishaal', 'Meshal'],
  'زياد': ['Ziyad', 'Ziad'],
  'وليد': ['Waleed', 'Walid'],
  'رائد': ['Raed', 'Raid'],
  'سارة': ['Sarah', 'Sara'],
  'نورة': ['Noura', 'Nora', 'Nourah'],
  'ريم': ['Reem', 'Rim'],
  'لمى': ['Lama'],
  'هند': ['Hind'],
  'مها': ['Maha'],
  'العنود': ['Al Anoud', 'Alanoud'],
  'الجوهرة': ['Al Jawhara', 'Aljohara'],
  'منيرة': ['Munira', 'Muneera', 'Munirah'],
  'حصة': ['Hessa', 'Hissa'],
  'دانة': ['Dana', 'Danah'],
  'شهد': ['Shahad', 'Shahd'],
  'جود': ['Jood', 'Joud'],
  'أريج': ['Areej', 'Arij'],
  'العتيبي': ['Al-Otaibi', 'Alotaibi', 'Al Otaibi'],
  'القحطاني': ['Al-Qahtani', 'Alqahtani'],
  'الغامدي': ['Al-Ghamdi', 'Alghamdi'],
  'الزهراني': ['Al-Zahrani', 'Alzahrani'],
  'الشمري': ['Al-Shammari', 'Alshammari'],
  'الحربي': ['Al-Harbi', 'Alharbi'],
  'الدوسري': ['Al-Dosari', 'Al-Dossari', 'Aldosari'],
  'العنزي': ['Al-Anazi', 'Alanazi', 'Al-Enezi'],
  'المطيري': ['Al-Mutairi', 'Almutairi'],
  'السبيعي': ['Al-Subaie', 'Alsubaie', 'Al-Subaei'],
  'الشهري': ['Al-Shehri', 'Alshehri'],
  'القرني': ['Al-Qarni', 'Alqarni'],
  'الرشيد': ['Al-Rashid', 'Alrashid', 'Al Rasheed'],
  'بن': ['bin', 'ibn'],
  'آل': ['Al'],
}

// The systematic fallback. Where a letter genuinely has two common renderings,
// both are produced — that is where most of the variation comes from.
const MAP: Record<string, string[]> = {
  'ا': ['a'], 'أ': ['a'], 'إ': ['i'], 'آ': ['aa'], 'ء': [''], 'ؤ': ['u'], 'ئ': ['i'],
  'ب': ['b'], 'ت': ['t'], 'ث': ['th'], 'ج': ['j'], 'ح': ['h'], 'خ': ['kh'],
  'د': ['d'], 'ذ': ['dh', 'th'], 'ر': ['r'], 'ز': ['z'], 'س': ['s'], 'ش': ['sh'],
  'ص': ['s'], 'ض': ['d'], 'ط': ['t'], 'ظ': ['z'], 'ع': ['a'], 'غ': ['gh'],
  'ف': ['f'], 'ق': ['q', 'g'], 'ك': ['k'], 'ل': ['l'], 'م': ['m'], 'ن': ['n'],
  'ه': ['h'], 'و': ['w', 'u'], 'ي': ['y', 'i'], 'ى': ['a'], 'ة': ['ah', 'a'],
  'ّ': [''], 'َ': ['a'], 'ُ': ['u'], 'ِ': ['i'], 'ْ': [''], 'ً': ['an'], 'ٌ': ['un'], 'ٍ': ['in'],
}

const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s)

/** Every combination the letter map allows, capped so it stays a list. */
function generate(word: string): string[] {
  let forms: string[] = ['']
  for (const ch of word) {
    const options = MAP[ch]
    if (!options) {
      // A character with no mapping — a digit, a Latin letter, punctuation —
      // passes through rather than being silently dropped.
      forms = forms.map((f) => f + ch)
      continue
    }
    const next: string[] = []
    for (const f of forms) for (const o of options) next.push(f + o)
    forms = next.slice(0, 8)
  }
  return [...new Set(forms.map((f) => cap(f)))].filter(Boolean).slice(0, 6)
}

export function suggestionsFor(word: string): Suggestion[] {
  const key = word.trim()
  if (!key) return []
  const common = COMMON[key] ?? COMMON[key.replace(/[أإآ]/g, 'ا')]
  const out: Suggestion[] = (common ?? []).map((text) => ({ text, source: 'common' as const }))
  const seen = new Set(out.map((s) => s.text.toLowerCase()))
  for (const g of generate(key)) {
    if (!seen.has(g.toLowerCase())) { out.push({ text: g, source: 'generated' }); seen.add(g.toLowerCase()) }
  }
  return out.slice(0, 8)
}

export interface WordResult { arabic: string; suggestions: Suggestion[] }

/** Split a full name and suggest each part separately. */
export function analyseName(input: string): WordResult[] {
  return input
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((arabic) => ({ arabic, suggestions: suggestionsFor(arabic) }))
}

/** One assembled full name from the chosen spelling of each part. */
export const joinChoices = (choices: string[]) => choices.filter(Boolean).join(' ')
