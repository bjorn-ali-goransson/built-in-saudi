// The languages worth offering, in the order they are worth offering them.
//
// Not alphabetical, and not the browser's order. Arabic and English first
// because that is the site, then the languages actually spoken at work in this
// country — Urdu, Hindi, Bengali, Malayalam, Tamil, Nepali, Sinhala, Amharic,
// Tigrinya, Somali, Pashto, Farsi. A Bengali-speaking driver translating a
// tenancy contract is the person this tool is for; putting Bulgarian above him
// because the alphabet says so would be a small, stupid unkindness.
//
// Which pairs actually work is asked of the browser at runtime (support is per
// pair and it changes), so this list may legitimately contain a language that
// the model refuses today — Filipino did, in August 2026. The UI marks those
// rather than hiding them, because "not supported yet" is information and a
// missing row is not.

export interface Language {
  code: string
  en: string
  ar: string
  /** The name in the language itself — the only label a speaker can scan for. */
  native: string
}

export const LANGUAGES: Language[] = [
  { code: 'ar', en: 'Arabic', ar: 'العربية', native: 'العربية' },
  { code: 'en', en: 'English', ar: 'الإنجليزية', native: 'English' },
  { code: 'ur', en: 'Urdu', ar: 'الأردية', native: 'اردو' },
  { code: 'hi', en: 'Hindi', ar: 'الهندية', native: 'हिन्दी' },
  { code: 'bn', en: 'Bengali', ar: 'البنغالية', native: 'বাংলা' },
  { code: 'ml', en: 'Malayalam', ar: 'المالايالامية', native: 'മലയാളം' },
  { code: 'ta', en: 'Tamil', ar: 'التاميلية', native: 'தமிழ்' },
  { code: 'te', en: 'Telugu', ar: 'التيلوغوية', native: 'తెలుగు' },
  { code: 'ne', en: 'Nepali', ar: 'النيبالية', native: 'नेपाली' },
  { code: 'si', en: 'Sinhala', ar: 'السنهالية', native: 'සිංහල' },
  { code: 'fil', en: 'Filipino', ar: 'الفلبينية', native: 'Filipino' },
  { code: 'id', en: 'Indonesian', ar: 'الإندونيسية', native: 'Bahasa Indonesia' },
  { code: 'ms', en: 'Malay', ar: 'الملايوية', native: 'Bahasa Melayu' },
  { code: 'am', en: 'Amharic', ar: 'الأمهرية', native: 'አማርኛ' },
  { code: 'ti', en: 'Tigrinya', ar: 'التيغرينية', native: 'ትግርኛ' },
  { code: 'so', en: 'Somali', ar: 'الصومالية', native: 'Soomaali' },
  { code: 'sw', en: 'Swahili', ar: 'السواحيلية', native: 'Kiswahili' },
  { code: 'fa', en: 'Persian', ar: 'الفارسية', native: 'فارسی' },
  { code: 'ps', en: 'Pashto', ar: 'البشتوية', native: 'پښتو' },
  { code: 'ku', en: 'Kurdish', ar: 'الكردية', native: 'Kurdî' },
  { code: 'tr', en: 'Turkish', ar: 'التركية', native: 'Türkçe' },
  { code: 'fr', en: 'French', ar: 'الفرنسية', native: 'Français' },
  { code: 'es', en: 'Spanish', ar: 'الإسبانية', native: 'Español' },
  { code: 'de', en: 'German', ar: 'الألمانية', native: 'Deutsch' },
  { code: 'it', en: 'Italian', ar: 'الإيطالية', native: 'Italiano' },
  { code: 'pt', en: 'Portuguese', ar: 'البرتغالية', native: 'Português' },
  { code: 'nl', en: 'Dutch', ar: 'الهولندية', native: 'Nederlands' },
  { code: 'ru', en: 'Russian', ar: 'الروسية', native: 'Русский' },
  { code: 'uk', en: 'Ukrainian', ar: 'الأوكرانية', native: 'Українська' },
  { code: 'pl', en: 'Polish', ar: 'البولندية', native: 'Polski' },
  { code: 'ro', en: 'Romanian', ar: 'الرومانية', native: 'Română' },
  { code: 'el', en: 'Greek', ar: 'اليونانية', native: 'Ελληνικά' },
  { code: 'he', en: 'Hebrew', ar: 'العبرية', native: 'עברית' },
  { code: 'zh', en: 'Chinese', ar: 'الصينية', native: '中文' },
  { code: 'ja', en: 'Japanese', ar: 'اليابانية', native: '日本語' },
  { code: 'ko', en: 'Korean', ar: 'الكورية', native: '한국어' },
  { code: 'vi', en: 'Vietnamese', ar: 'الفيتنامية', native: 'Tiếng Việt' },
  { code: 'th', en: 'Thai', ar: 'التايلندية', native: 'ไทย' },
]

const BY_CODE = new Map(LANGUAGES.map((l) => [l.code, l]))

export const languageName = (code: string, locale: 'en' | 'ar'): string => {
  const l = BY_CODE.get(code)
  if (l) return locale === 'ar' ? l.ar : l.en
  // A code the detector returned that is not on our list: show the code rather
  // than an empty label, so "detected: yue" is at least diagnosable.
  return code
}

export const nativeName = (code: string): string => BY_CODE.get(code)?.native ?? code


/** Right-to-left scripts among the offered languages — the output box needs it. */
const RTL = new Set(['ar', 'ur', 'fa', 'ps', 'he', 'ku'])
export const isRtl = (code: string) => RTL.has(code)
