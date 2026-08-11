// Arabic verb morphology engine (تصريف الأفعال).
//
// Scope: SOUND (صحيح سالم) triliteral verbs across Forms I–X, plus sound
// quadriliteral Forms Q1/Q2. For each it builds the full paradigm — past,
// present (indicative/subjunctive/jussive), imperative, active + passive — over
// the 13 pronouns, the emphatic (energetic) forms, and the derived nouns
// (اسم الفاعل، اسم المفعول، المصدر …). Weak/hamzated/doubled roots follow their
// own phonological rules; those are DETECTED and flagged rather than mis-conjugated.

// Harakāt
const A = 'َ' // fatḥa
const I = 'ِ' // kasra
const U = 'ُ' // ḍamma
const O = 'ْ' // sukūn
const SH = 'ّ' // shadda
const M = 'م'
const N = 'ن'

export type Mood = 'marfu' | 'mansub' | 'majzum'

export const PRONOUNS = [
  'ana', 'nahnu',
  'anta', 'anti', 'antuma', 'antum', 'antunna',
  'huwa', 'hiya', 'huma_m', 'huma_f', 'hum', 'hunna',
] as const
export type Pronoun = (typeof PRONOUNS)[number]

export const PLABEL: Record<Pronoun, string> = {
  ana: 'أنا', nahnu: 'نحن',
  anta: 'أنتَ', anti: 'أنتِ', antuma: 'أنتما', antum: 'أنتم', antunna: 'أنتنّ',
  huwa: 'هو', hiya: 'هي', huma_m: 'هما (مذكّر)', huma_f: 'هما (مؤنّث)', hum: 'هم', hunna: 'هنّ',
}

// Past suffixes: the last radical takes vowel `v`, then the string `s` follows.
const PAST: Record<Pronoun, { v: string; s: string }> = {
  huwa: { v: A, s: '' }, hiya: { v: A, s: 'ت' + O }, huma_m: { v: A, s: 'ا' }, huma_f: { v: A, s: 'ت' + A + 'ا' },
  hum: { v: U, s: 'و' + 'ا' }, hunna: { v: O, s: N + A },
  anta: { v: O, s: 'ت' + A }, anti: { v: O, s: 'ت' + I }, antuma: { v: O, s: 'ت' + U + 'م' + A },
  antum: { v: O, s: 'ت' + U + 'م' + O }, antunna: { v: O, s: 'ت' + U + N + SH + A },
  ana: { v: O, s: 'ت' + U }, nahnu: { v: O, s: N + A },
}

const DUAL: Pronoun[] = ['huma_m', 'huma_f', 'antuma']
const MPL: Pronoun[] = ['hum', 'antum']
const NISWA: Pronoun[] = ['hunna', 'antunna']

// What follows the last radical in the present, per person + mood.
function presentEnd(p: Pronoun, mood: Mood): string {
  if (NISWA.includes(p)) return O + N + A // ـْنَ (invariant, mabni)
  if (DUAL.includes(p)) return mood === 'marfu' ? A + 'ا' + N + I : A + 'ا'
  if (MPL.includes(p)) return mood === 'marfu' ? U + 'و' + N + A : U + 'و' + 'ا'
  if (p === 'anti') return mood === 'marfu' ? I + 'ي' + N + A : I + 'ي'
  return mood === 'marfu' ? U : mood === 'mansub' ? A : O
}

function presPrefix(p: Pronoun, prefixV: string): string {
  const letter = p === 'ana' ? 'أ' : p === 'nahnu' ? N
    : (['huwa', 'huma_m', 'hum', 'hunna'] as Pronoun[]).includes(p) ? 'ي' : 'ت'
  return letter + prefixV
}

function fill(t: string, r: string[]): string {
  return t.replace(/\{1\}/g, r[0] || '').replace(/\{2\}/g, r[1] || '').replace(/\{3\}/g, r[2] || '').replace(/\{4\}/g, r[3] || '')
}

// Per-form configuration. Cores are the letters/vowels BEFORE the last radical;
// the paradigm appends the last radical + its ending. `{1}..{4}` are the radicals.
interface FormCfg {
  id: string
  wazn: string
  quad?: boolean
  needsVowel?: boolean // Form I: user picks the middle-radical vowel
  pastCore: string | ((v: { past: string; pres: string }) => string)
  presPrefixV: string
  presCore: string | ((v: { past: string; pres: string }) => string)
  hasPassive?: boolean
  pastPassiveCore?: string
  presPassiveCore?: string
  imperInitial: string | ((v: { past: string; pres: string }) => string)
  ismFa3il: string
  ismMaf3ul?: string
  masdar?: string | null // null = سماعي (not derivable)
  extras?: Record<string, string>
}

export const FORMS: Record<string, FormCfg> = {
  I: {
    id: 'I', wazn: 'فَعَلَ', needsVowel: true,
    pastCore: (v) => `{1}${A}{2}${v.past}`,
    presPrefixV: A, presCore: (v) => `{1}${O}{2}${v.pres}`,
    hasPassive: true, pastPassiveCore: `{1}${U}{2}${I}`, presPassiveCore: `{1}${O}{2}${A}`,
    imperInitial: (v) => 'ا' + (v.pres === U ? U : I),
    ismFa3il: `{1}${A}ا{2}${I}{3}`, ismMaf3ul: `${M}${A}{1}${O}{2}${U}و{3}`, masdar: null,
    extras: {
      mubalagha: `{1}${A}{2}${SH}${A}ا{3}`, // فَعَّال
      makan: `${M}${A}{1}${O}{2}${A}{3}`, // مَفْعَل
      aala: `${M}${I}{1}${O}{2}${A}ا{3}`, // مِفْعَال
    },
  },
  II: {
    id: 'II', wazn: 'فَعَّلَ',
    pastCore: `{1}${A}{2}${SH}${A}`, presPrefixV: U, presCore: `{1}${A}{2}${SH}${I}`,
    hasPassive: true, pastPassiveCore: `{1}${U}{2}${SH}${I}`, presPassiveCore: `{1}${A}{2}${SH}${A}`,
    imperInitial: '', ismFa3il: `${M}${U}{1}${A}{2}${SH}${I}{3}`, ismMaf3ul: `${M}${U}{1}${A}{2}${SH}${A}{3}`,
    masdar: `ت${A}{1}${O}{2}${I}ي{3}`, // تَفْعِيل
  },
  III: {
    id: 'III', wazn: 'فَاعَلَ',
    pastCore: `{1}${A}ا{2}${A}`, presPrefixV: U, presCore: `{1}${A}ا{2}${I}`,
    hasPassive: true, pastPassiveCore: `{1}${U}و{2}${I}`, presPassiveCore: `{1}${A}ا{2}${A}`,
    imperInitial: '', ismFa3il: `${M}${U}{1}${A}ا{2}${I}{3}`, ismMaf3ul: `${M}${U}{1}${A}ا{2}${A}{3}`,
    masdar: `${M}${U}{1}${A}ا{2}${A}{3}${A}ة`, // مُفَاعَلَة
  },
  IV: {
    id: 'IV', wazn: 'أَفْعَلَ',
    pastCore: `أ${A}{1}${O}{2}${A}`, presPrefixV: U, presCore: `{1}${O}{2}${I}`,
    hasPassive: true, pastPassiveCore: `أ${U}{1}${O}{2}${I}`, presPassiveCore: `{1}${O}{2}${A}`,
    imperInitial: `أ${A}`, ismFa3il: `${M}${U}{1}${O}{2}${I}{3}`, ismMaf3ul: `${M}${U}{1}${O}{2}${A}{3}`,
    masdar: `إ${I}{1}${O}{2}${A}ا{3}`, // إِفْعَال
  },
  V: {
    id: 'V', wazn: 'تَفَعَّلَ',
    pastCore: `ت${A}{1}${A}{2}${SH}${A}`, presPrefixV: A, presCore: `ت${A}{1}${A}{2}${SH}${A}`,
    hasPassive: true, pastPassiveCore: `ت${U}{1}${U}{2}${SH}${I}`, presPassiveCore: `ت${A}{1}${A}{2}${SH}${A}`,
    imperInitial: '', ismFa3il: `${M}${U}ت${A}{1}${A}{2}${SH}${I}{3}`, ismMaf3ul: `${M}${U}ت${A}{1}${A}{2}${SH}${A}{3}`,
    masdar: `ت${A}{1}${A}{2}${SH}${U}{3}`, // تَفَعُّل
  },
  VI: {
    id: 'VI', wazn: 'تَفَاعَلَ',
    pastCore: `ت${A}{1}${A}ا{2}${A}`, presPrefixV: A, presCore: `ت${A}{1}${A}ا{2}${A}`,
    hasPassive: true, pastPassiveCore: `ت${U}{1}${U}و{2}${I}`, presPassiveCore: `ت${A}{1}${A}ا{2}${A}`,
    imperInitial: '', ismFa3il: `${M}${U}ت${A}{1}${A}ا{2}${I}{3}`, ismMaf3ul: `${M}${U}ت${A}{1}${A}ا{2}${A}{3}`,
    masdar: `ت${A}{1}${A}ا{2}${U}{3}`, // تَفَاعُل
  },
  VII: {
    id: 'VII', wazn: 'اِنْفَعَلَ',
    pastCore: `ا${I}ن${O}{1}${A}{2}${A}`, presPrefixV: A, presCore: `ن${O}{1}${A}{2}${I}`,
    hasPassive: false,
    imperInitial: `ا${I}`, ismFa3il: `${M}${U}ن${O}{1}${A}{2}${I}{3}`, ismMaf3ul: `${M}${U}ن${O}{1}${A}{2}${A}{3}`,
    masdar: `ا${I}ن${O}{1}${I}{2}${A}ا{3}`, // اِنْفِعَال
  },
  VIII: {
    id: 'VIII', wazn: 'اِفْتَعَلَ',
    pastCore: `ا${I}{1}${O}ت${A}{2}${A}`, presPrefixV: A, presCore: `{1}${O}ت${A}{2}${I}`,
    hasPassive: true, pastPassiveCore: `ا${U}{1}${O}ت${U}{2}${I}`, presPassiveCore: `{1}${O}ت${A}{2}${A}`,
    imperInitial: `ا${I}`, ismFa3il: `${M}${U}{1}${O}ت${A}{2}${I}{3}`, ismMaf3ul: `${M}${U}{1}${O}ت${A}{2}${A}{3}`,
    masdar: `ا${I}{1}${O}ت${I}{2}${A}ا{3}`, // اِفْتِعَال
  },
  X: {
    id: 'X', wazn: 'اِسْتَفْعَلَ',
    pastCore: `ا${I}س${O}ت${A}{1}${O}{2}${A}`, presPrefixV: A, presCore: `س${O}ت${A}{1}${O}{2}${I}`,
    hasPassive: true, pastPassiveCore: `ا${U}س${O}ت${U}{1}${O}{2}${I}`, presPassiveCore: `س${O}ت${A}{1}${O}{2}${A}`,
    imperInitial: `ا${I}`, ismFa3il: `${M}${U}س${O}ت${A}{1}${O}{2}${I}{3}`, ismMaf3ul: `${M}${U}س${O}ت${A}{1}${O}{2}${A}{3}`,
    masdar: `ا${I}س${O}ت${I}{1}${O}{2}${A}ا{3}`, // اِسْتِفْعَال
  },
  Q1: {
    id: 'Q1', wazn: 'فَعْلَلَ', quad: true,
    pastCore: `{1}${A}{2}${O}{3}${A}`, presPrefixV: U, presCore: `{1}${A}{2}${O}{3}${I}`,
    hasPassive: true, pastPassiveCore: `{1}${U}{2}${O}{3}${I}`, presPassiveCore: `{1}${A}{2}${O}{3}${A}`,
    imperInitial: '', ismFa3il: `${M}${U}{1}${A}{2}${O}{3}${I}{4}`, ismMaf3ul: `${M}${U}{1}${A}{2}${O}{3}${A}{4}`,
    masdar: `{1}${A}{2}${O}{3}${A}{4}${A}ة`, // فَعْلَلَة
  },
  Q2: {
    id: 'Q2', wazn: 'تَفَعْلَلَ', quad: true,
    pastCore: `ت${A}{1}${A}{2}${O}{3}${A}`, presPrefixV: A, presCore: `ت${A}{1}${A}{2}${O}{3}${A}`,
    hasPassive: false,
    imperInitial: '', ismFa3il: `${M}${U}ت${A}{1}${A}{2}${O}{3}${I}{4}`, ismMaf3ul: `${M}${U}ت${A}{1}${A}{2}${O}{3}${A}{4}`,
    masdar: `ت${A}{1}${A}{2}${O}{3}${U}{4}`, // تَفَعْلُل
  },
}

export interface Cell { p: Pronoun; label: string; word: string }
export interface Conjugation {
  wazn: string
  past: Cell[]
  present: { marfu: Cell[]; mansub: Cell[]; majzum: Cell[] }
  imperative: Cell[]
  passivePast?: Cell[]
  passivePresent?: Cell[]
  emphaticPresent: Cell[]
  emphaticImperative: Cell[]
  derived: { key: string; word: string }[]
}

const IMP_PERSONS: Pronoun[] = ['anta', 'anti', 'antuma', 'antum', 'antunna']
function imperEnd(p: Pronoun): string {
  switch (p) {
    case 'anti': return I + 'ي'
    case 'antuma': return A + 'ا'
    case 'antum': return U + 'و' + 'ا'
    case 'antunna': return O + N + A
    default: return O // anta
  }
}
const EMPH = A + N + SH + A // ـَنَّ (نون التوكيد الثقيلة)
const EMPH_PERSONS: Pronoun[] = ['huwa', 'hiya', 'ana', 'nahnu', 'anta']

export function conjugate(root: string[], formId: string, vowels: { past: string; pres: string }): Conjugation {
  const F = FORMS[formId]
  const last = F.quad ? '{4}' : '{3}'
  const pastCore = typeof F.pastCore === 'function' ? F.pastCore(vowels) : F.pastCore
  const presCore = typeof F.presCore === 'function' ? F.presCore(vowels) : F.presCore
  const imperInitial = typeof F.imperInitial === 'function' ? F.imperInitial(vowels) : F.imperInitial

  const past = PRONOUNS.map<Cell>((p) => ({ p, label: PLABEL[p], word: fill(pastCore + last, root) + PAST[p].v + PAST[p].s }))

  const present = (mood: Mood): Cell[] =>
    PRONOUNS.map<Cell>((p) => ({ p, label: PLABEL[p], word: presPrefix(p, F.presPrefixV) + fill(presCore + last, root) + presentEnd(p, mood) }))

  const imperative = IMP_PERSONS.map<Cell>((p) => ({ p, label: PLABEL[p], word: imperInitial + fill(presCore + last, root) + imperEnd(p) }))

  const out: Conjugation = {
    wazn: F.wazn,
    past,
    present: { marfu: present('marfu'), mansub: present('mansub'), majzum: present('majzum') },
    imperative,
    emphaticPresent: EMPH_PERSONS.map<Cell>((p) => ({ p, label: PLABEL[p], word: presPrefix(p, F.presPrefixV) + fill(presCore + last, root) + EMPH })),
    emphaticImperative: [{ p: 'anta', label: PLABEL.anta, word: imperInitial + fill(presCore + last, root) + EMPH }],
    derived: [],
  }

  if (F.hasPassive && F.pastPassiveCore && F.presPassiveCore) {
    out.passivePast = PRONOUNS.map<Cell>((p) => ({ p, label: PLABEL[p], word: fill(F.pastPassiveCore! + last, root) + PAST[p].v + PAST[p].s }))
    out.passivePresent = PRONOUNS.map<Cell>((p) => ({ p, label: PLABEL[p], word: presPrefix(p, U) + fill(F.presPassiveCore! + last, root) + presentEnd(p, 'marfu') }))
  }

  out.derived.push({ key: 'ismFa3il', word: fill(F.ismFa3il, root) })
  if (F.ismMaf3ul) out.derived.push({ key: 'ismMaf3ul', word: fill(F.ismMaf3ul, root) })
  out.derived.push({ key: 'masdar', word: F.masdar === null ? '' : fill(F.masdar!, root) })
  if (F.extras) for (const [k, t] of Object.entries(F.extras)) out.derived.push({ key: k, word: fill(t, root) })
  return out
}

// ---- weak-root detection --------------------------------------------------
export function weakness(root: string[]): { weak: boolean; note?: string } {
  const r = root.filter(Boolean)
  const hamza = r.some((c) => 'ءأإؤئآ'.includes(c))
  const w = r.some((c) => c === 'و' || c === 'ي' || c === 'ى')
  const doubled = r.length >= 2 && r[r.length - 1] === r[r.length - 2]
  if (!hamza && !w && !doubled) return { weak: false }
  const kinds: string[] = []
  if (r[0] === 'و' || r[0] === 'ي') kinds.push('مثال')
  if (r.length === 3 && (r[1] === 'و' || r[1] === 'ي')) kinds.push('أجوف')
  if (r.length >= 3 && (r[r.length - 1] === 'و' || r[r.length - 1] === 'ي' || r[r.length - 1] === 'ى')) kinds.push('ناقص')
  if (doubled) kinds.push('مضعّف')
  if (hamza) kinds.push('مهموز')
  return { weak: true, note: kinds.join('، ') || 'معتلّ' }
}

// ---- common irregular verbs (surfaced when the root is entered) ------------
export interface Irregular { root: string; past: string; present: string; note: string; noteEn: string }
export const IRREGULARS: Irregular[] = [
  { root: 'وصل', past: 'وَصَلَ', present: 'يَصِلُ', note: 'مثال واوي — تُحذف الواو في المضارع.', noteEn: 'Assimilated: the و drops in the present.' },
  { root: 'وجد', past: 'وَجَدَ', present: 'يَجِدُ', note: 'مثال واوي — تُحذف الواو في المضارع.', noteEn: 'Assimilated: و drops in the present.' },
  { root: 'وضع', past: 'وَضَعَ', present: 'يَضَعُ', note: 'مثال واوي — تُحذف الواو في المضارع.', noteEn: 'Assimilated: و drops in the present.' },
  { root: 'وعد', past: 'وَعَدَ', present: 'يَعِدُ', note: 'مثال واوي — تُحذف الواو في المضارع.', noteEn: 'Assimilated: و drops in the present.' },
  { root: 'وقف', past: 'وَقَفَ', present: 'يَقِفُ', note: 'مثال واوي — تُحذف الواو في المضارع.', noteEn: 'Assimilated: و drops in the present.' },
  { root: 'وجل', past: 'وَجِلَ', present: 'يَوْجَلُ', note: 'مثال واوي شاذّ — تبقى الواو في المضارع (خلاف وصل ⇐ يصل).', noteEn: 'Assimilated but irregular: the و is KEPT (unlike وصل → يصل).' },
  { root: 'يسر', past: 'يَسَرَ', present: 'يَيْسِرُ', note: 'مثال يائي — تبقى الياء غالبًا.', noteEn: 'Y-assimilated: the ي is usually kept.' },
  { root: 'قول', past: 'قَالَ', present: 'يَقُولُ', note: 'أجوف واوي — الألف أصلها واو.', noteEn: 'Hollow (و): the alif is an underlying و.' },
  { root: 'بيع', past: 'بَاعَ', present: 'يَبِيعُ', note: 'أجوف يائي — الألف أصلها ياء.', noteEn: 'Hollow (ي): the alif is an underlying ي.' },
  { root: 'نوم', past: 'نَامَ', present: 'يَنَامُ', note: 'أجوف — عينه تُقلب ألفًا.', noteEn: 'Hollow: middle radical becomes alif.' },
  { root: 'رمي', past: 'رَمَى', present: 'يَرْمِي', note: 'ناقص يائي.', noteEn: 'Defective (ي final).' },
  { root: 'دعو', past: 'دَعَا', present: 'يَدْعُو', note: 'ناقص واوي.', noteEn: 'Defective (و final).' },
  { root: 'مشي', past: 'مَشَى', present: 'يَمْشِي', note: 'ناقص يائي.', noteEn: 'Defective (ي final).' },
  { root: 'أكل', past: 'أَكَلَ', present: 'يَأْكُلُ', note: 'مهموز الفاء — الأمر: كُلْ (تُحذف الهمزة).', noteEn: 'Hamza-initial: imperative is كُلْ.' },
  { root: 'أخذ', past: 'أَخَذَ', present: 'يَأْخُذُ', note: 'مهموز الفاء — الأمر: خُذْ.', noteEn: 'Hamza-initial: imperative is خُذْ.' },
  { root: 'رأي', past: 'رَأَى', present: 'يَرَى', note: 'تُحذف الهمزة في المضارع والأمر (رَ).', noteEn: 'The hamza drops in the present and imperative (رَ).' },
  { root: 'كون', past: 'كَانَ', present: 'يَكُونُ', note: 'أجوف واوي — من الأفعال الناسخة.', noteEn: 'Hollow (و); one of the “kāna” copulas.' },
  { root: 'جيء', past: 'جَاءَ', present: 'يَجِيءُ', note: 'أجوف مهموز اللام.', noteEn: 'Hollow + final hamza.' },
  { root: 'ظنن', past: 'ظَنَّ', present: 'يَظُنُّ', note: 'مضعّف — يُدغم المِثلان.', noteEn: 'Doubled: the two identical radicals merge.' },
  { root: 'مدد', past: 'مَدَّ', present: 'يَمُدُّ', note: 'مضعّف — يُدغم المِثلان.', noteEn: 'Doubled: identical radicals merge.' },
  { root: 'ردد', past: 'رَدَّ', present: 'يَرُدُّ', note: 'مضعّف — يُدغم المِثلان.', noteEn: 'Doubled: identical radicals merge.' },
]

const stripHarakat = (s: string) => s.replace(/[ً-ْ]/g, '')
export function findIrregular(root: string[]): Irregular | undefined {
  const key = stripHarakat(root.join(''))
  return IRREGULARS.find((v) => v.root === key)
}
