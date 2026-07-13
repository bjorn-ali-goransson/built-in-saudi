import { useMemo, useState } from 'react'
import { useLocale } from '../../i18n'
import { Stack, Textarea, FieldLabel } from '../../components/ui'

const STR = {
  en: {
    input: 'Your text', ease: 'Reading ease', grade: 'Grade level', words: 'Words', sentences: 'Sentences', syllables: 'Syllables', avg: 'Words / sentence',
    note: 'Flesch scores are designed for English. Higher reading-ease (0–100) is easier; the grade level is the US school grade needed.',
    hint: 'Paste some English text to score it.', privacy: 'Analysed in your browser — nothing is uploaded.',
    bands: ['Very hard', 'Hard', 'Fairly hard', 'Standard', 'Fairly easy', 'Easy', 'Very easy'],
  },
  ar: {
    input: 'نصّك', ease: 'سهولة القراءة', grade: 'المستوى الدراسي', words: 'الكلمات', sentences: 'الجُمل', syllables: 'المقاطع', avg: 'كلمات / جملة',
    note: 'درجات Flesch مصمّمة للإنجليزية. كلما ارتفعت سهولة القراءة (0–100) كان النص أسهل؛ والمستوى هو الصف الدراسي الأمريكي المطلوب.',
    hint: 'الصق نصًّا إنجليزيًا لتقييمه.', privacy: 'يُحلَّل في متصفحك — لا يُرفع أي شيء.',
    bands: ['صعب جدًا', 'صعب', 'صعب نوعًا ما', 'متوسط', 'سهل نوعًا ما', 'سهل', 'سهل جدًا'],
  },
}

function countSyllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, '')
  if (!w) return 0
  if (w.length <= 3) return 1
  const groups = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '').replace(/^y/, '').match(/[aeiouy]{1,2}/g)
  return Math.max(1, groups ? groups.length : 1)
}

export default function ReadabilityTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const [text, setText] = useState('')

  const r = useMemo(() => {
    const words = text.trim().match(/[A-Za-z0-9']+/g) || []
    const sentences = text.split(/[.!?]+/).map((x) => x.trim()).filter(Boolean)
    if (words.length < 3 || sentences.length === 0) return null
    const syllables = words.reduce((a, w) => a + countSyllables(w), 0)
    const wps = words.length / sentences.length
    const spw = syllables / words.length
    const ease = Math.max(0, Math.min(100, 206.835 - 1.015 * wps - 84.6 * spw))
    const grade = Math.max(0, 0.39 * wps + 11.8 * spw - 15.59)
    const band = s.bands[Math.min(6, Math.max(0, Math.floor(ease / 15)))]
    return { ease, grade, words: words.length, sentences: sentences.length, syllables, wps, band }
  }, [text, s])

  const nf = (n: number, d = 0) => n.toLocaleString(locale === 'ar' ? 'ar-SA' : 'en-US', { maximumFractionDigits: d, minimumFractionDigits: d })

  return (
    <Stack data-testid="readability">
      <label className="flex flex-col gap-[0.4rem]"><FieldLabel>{s.input}</FieldLabel>
        <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={7} className="text-[0.95rem]" data-testid="rd-input" /></label>

      {r ? (
        <>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="border border-[color:var(--line-soft)] rounded-md bg-[var(--surface)] p-3 text-center">
              <p className="text-[0.75rem] text-ink-faint">{s.ease}</p>
              <p className="text-[2.2rem] font-display font-bold text-green-700 leading-tight" data-testid="rd-ease">{nf(r.ease)}</p>
              <p className="text-[0.85rem] text-ink-soft">{r.band}</p>
            </div>
            <div className="border border-[color:var(--line-soft)] rounded-md bg-[var(--surface)] p-3 text-center">
              <p className="text-[0.75rem] text-ink-faint">{s.grade}</p>
              <p className="text-[2.2rem] font-display font-bold text-ink leading-tight" data-testid="rd-grade">{nf(r.grade, 1)}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-[0.85rem]">
            {[[s.words, r.words], [s.sentences, r.sentences], [s.syllables, r.syllables], [s.avg, r.wps]].map(([label, val], i) => (
              <div key={i} className="border border-[color:var(--line-soft)] rounded-md p-2"><p className="font-mono font-bold text-ink">{nf(val as number, i === 3 ? 1 : 0)}</p><p className="text-ink-faint text-[0.75rem]">{label as string}</p></div>
            ))}
          </div>
          <p className="text-[0.78rem] text-ink-faint">{s.note}</p>
        </>
      ) : <p className="text-[0.9rem] text-ink-faint">{s.hint}</p>}
      <p className="text-[0.8rem] text-ink-faint flex items-center gap-[0.4rem]"><span aria-hidden="true">🔒</span> {s.privacy}</p>
    </Stack>
  )
}
