import { useMemo, useState } from 'react'
import { useLocale } from '../../i18n'
import { Stack, Textarea } from '../../components/ui'

const STR = {
  en: { placeholder: 'Paste or type some text…', detected: 'Detected language', confidence: 'Confidence', alternatives: 'Other candidates', empty: 'Type at least a few words.', how: 'Script detection for non-Latin text; common-word matching for Latin scripts. All in your browser.' },
  ar: { placeholder: 'الصق أو اكتب نصًا…', detected: 'اللغة المكتشفة', confidence: 'الثقة', alternatives: 'احتمالات أخرى', empty: 'اكتب بضع كلمات على الأقل.', how: 'كشف النظام الكتابي للنصوص غير اللاتينية، ومطابقة الكلمات الشائعة للنصوص اللاتينية. كل ذلك داخل متصفحك.' },
}

// Non-Latin scripts → language (with a few disambiguations).
const SCRIPTS: { name: string; re: RegExp }[] = [
  { name: 'Hebrew', re: /[֐-׿]/g },
  { name: 'Arabic', re: /[؀-ۿݐ-ݿ]/g },
  { name: 'Cyrillic', re: /[Ѐ-ӿ]/g },
  { name: 'Greek', re: /[Ͱ-Ͽ]/g },
  { name: 'Devanagari', re: /[ऀ-ॿ]/g },
  { name: 'Thai', re: /[฀-๿]/g },
  { name: 'Hangul', re: /[가-힯ᄀ-ᇿ]/g },
  { name: 'Kana', re: /[぀-ヿ]/g },
  { name: 'Han', re: /[一-鿿]/g },
]

const WORDS: Record<string, string[]> = {
  English: ['the', 'and', 'of', 'to', 'in', 'is', 'that', 'it', 'for', 'was', 'with', 'as', 'on', 'are', 'you', 'this'],
  French: ['le', 'la', 'les', 'de', 'et', 'un', 'une', 'est', 'que', 'dans', 'pour', 'vous', 'qui', 'pas', 'ce', 'sur', 'des'],
  Spanish: ['el', 'la', 'los', 'de', 'que', 'y', 'en', 'un', 'es', 'por', 'con', 'una', 'para', 'no', 'se', 'su', 'las'],
  German: ['der', 'die', 'das', 'und', 'ist', 'ein', 'den', 'von', 'zu', 'mit', 'nicht', 'sich', 'auf', 'für', 'ich', 'dem', 'eine'],
  Italian: ['il', 'la', 'che', 'di', 'e', 'un', 'per', 'con', 'non', 'sono', 'una', 'le', 'si', 'nel', 'come', 'ma'],
  Portuguese: ['o', 'a', 'de', 'que', 'e', 'do', 'da', 'em', 'um', 'para', 'com', 'não', 'os', 'no', 'uma', 'se', 'por'],
  Dutch: ['de', 'het', 'een', 'en', 'van', 'is', 'dat', 'op', 'te', 'met', 'voor', 'niet', 'zijn', 'aan', 'er', 'ook'],
  Turkish: ['ve', 'bir', 'bu', 'için', 'ile', 'çok', 'daha', 'olan', 'gibi', 'ama', 'ne', 'var', 'değil'],
  'Indonesian / Malay': ['yang', 'dan', 'di', 'itu', 'dengan', 'untuk', 'tidak', 'ini', 'dari', 'dalam', 'akan', 'pada', 'adalah'],
  Swedish: ['och', 'att', 'det', 'som', 'en', 'är', 'på', 'för', 'med', 'inte', 'har', 'den', 'av', 'jag'],
  Polish: ['nie', 'się', 'jest', 'to', 'że', 'na', 'do', 'ale', 'jak', 'czy', 'tak', 'po', 'oraz'],
  Romanian: ['și', 'de', 'la', 'un', 'în', 'este', 'cu', 'nu', 'pe', 'care', 'pentru', 'sau', 'mai'],
  Finnish: ['ja', 'on', 'ei', 'se', 'että', 'oli', 'joka', 'mutta', 'kuin', 'ovat', 'ovat'],
  Vietnamese: ['và', 'của', 'là', 'có', 'không', 'được', 'những', 'người', 'trong', 'cho', 'một'],
}

// Diacritic hints add a small bonus.
const HINTS: [string, RegExp][] = [
  ['Spanish', /[ñ¿¡]/], ['German', /[ß]/], ['Turkish', /[ışğ]/], ['Polish', /[ąęłńśźż]/],
  ['Portuguese', /[ãõ]/], ['French', /[œàèùâêî]/], ['Swedish', /[åäö]/], ['Romanian', /[țș]/],
  ['Vietnamese', /[ơưạảấầẩ]/],
]

const NATIVE: Record<string, string> = {
  English: 'English', French: 'Français', Spanish: 'Español', German: 'Deutsch', Italian: 'Italiano',
  Portuguese: 'Português', Dutch: 'Nederlands', Turkish: 'Türkçe', 'Indonesian / Malay': 'Bahasa',
  Swedish: 'Svenska', Polish: 'Polski', Romanian: 'Română', Finnish: 'Suomi', Vietnamese: 'Tiếng Việt',
  Arabic: 'العربية', Persian: 'فارسی', Urdu: 'اردو', Hebrew: 'עברית', Russian: 'Русский', Ukrainian: 'Українська',
  Greek: 'Ελληνικά', Hindi: 'हिन्दी', Thai: 'ไทย', Korean: '한국어', Japanese: '日本語', Chinese: '中文',
}

interface Cand { lang: string; score: number }

function detect(text: string): Cand[] {
  const t = text.trim()
  if (t.length < 2) return []

  // 1) Dominant non-Latin script?
  const counts = SCRIPTS.map((s) => ({ s, n: (t.match(s.re) || []).length }))
  const top = counts.sort((a, b) => b.n - a.n)[0]
  if (top && top.n >= 2 && top.n / t.length > 0.2) {
    let lang = top.s.name
    if (lang === 'Arabic') lang = /[پچژگ]/.test(t) ? 'Persian' : /[ٹڈڑ]/.test(t) ? 'Urdu' : 'Arabic'
    else if (lang === 'Cyrillic') lang = /[іїєґ]/.test(t) ? 'Ukrainian' : 'Russian'
    else if (lang === 'Kana') lang = 'Japanese'
    else if (lang === 'Han') lang = /[぀-ヿ]/.test(t) ? 'Japanese' : 'Chinese'
    else if (lang === 'Hangul') lang = 'Korean'
    else if (lang === 'Devanagari') lang = 'Hindi'
    return [{ lang, score: 1 }]
  }

  // 2) Latin: common-word scoring + diacritic hints.
  const tokens = t.toLowerCase().match(/[\p{L}]+/gu) || []
  if (!tokens.length) return []
  const set = new Set(tokens)
  const scores: Cand[] = Object.entries(WORDS).map(([lang, words]) => {
    let hits = 0
    for (const w of words) if (set.has(w)) hits++
    // frequency-weighted: how many tokens are function words of this language
    let freq = 0
    const ws = new Set(words)
    for (const tok of tokens) if (ws.has(tok)) freq++
    let score = hits / words.length + (freq / tokens.length) * 1.5
    for (const [hl, re] of HINTS) if (hl === lang && re.test(t)) score += 0.15
    return { lang, score }
  }).filter((c) => c.score > 0).sort((a, b) => b.score - a.score)
  return scores
}

export default function LanguageDetectTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const [text, setText] = useState('')
  const cands = useMemo(() => detect(text), [text])
  const total = cands.reduce((a, c) => a + c.score, 0) || 1
  const topPct = cands[0] ? Math.min(99, Math.round((cands[0].score / total) * 100)) : 0

  return (
    <Stack data-testid="langdetect">
      <Textarea className="w-full resize-y min-h-[120px] text-[1rem]" data-testid="lang-input" rows={5}
        placeholder={s.placeholder} value={text} onChange={(e) => setText(e.target.value)} dir="auto" />

      {cands.length > 0 ? (
        <div className="flex flex-col gap-[0.5rem] p-[1.1rem] border border-[color:var(--line-soft)] rounded-md bg-[var(--surface)]" data-testid="lang-result">
          <div className="flex items-baseline gap-[0.6rem] flex-wrap">
            <span className="text-[1.6rem] font-bold text-green-700" data-testid="lang-name">{cands[0].lang}</span>
            <span className="text-ink-soft text-[1.1rem]">{NATIVE[cands[0].lang] || ''}</span>
          </div>
          <div className="h-[8px] rounded-full bg-sand-200 overflow-hidden [&_span]:block [&_span]:h-full [&_span]:bg-green-600 [&_span]:rounded-full [&_span]:transition-[width] [&_span]:duration-200"><span style={{ width: `${topPct}%` }} /></div>
          <span className="text-[0.8rem] text-ink-faint font-body">{s.confidence}: {topPct}%</span>
          {cands.length > 1 && (
            <div className="flex flex-wrap gap-[0.4rem] items-center mt-[0.3rem]">
              <span className="text-[0.76rem] text-ink-faint">{s.alternatives}</span>
              {cands.slice(1, 4).map((c) => (
                <span key={c.lang} className="inline-flex items-center gap-[0.3rem] px-[0.8rem] py-[0.32rem] rounded-full border border-[color:var(--line)] bg-[var(--surface)] text-ink-soft text-[0.8rem] font-semibold">{c.lang} · {NATIVE[c.lang] || ''}</span>
              ))}
            </div>
          )}
        </div>
      ) : text.trim() ? (
        <p className="text-center text-[0.76rem] text-ink-faint mt-[0.8rem] font-body tracking-[0.02em] rtl:font-ar rtl:tracking-normal">{s.empty}</p>
      ) : null}

      <p className="text-center text-[0.76rem] text-ink-faint mt-[0.8rem] font-body tracking-[0.02em] rtl:font-ar rtl:tracking-normal">{s.how}</p>
    </Stack>
  )
}
