import { useMemo, useState } from 'react'
import { useLocale } from '../../i18n'

const STR = {
  en: {
    placeholder: 'Start typing or paste your text…',
    words: 'Words', characters: 'Characters', charactersNoSpaces: 'Characters (no spaces)',
    sentences: 'Sentences', paragraphs: 'Paragraphs', readingTime: 'Reading time',
    min: (n: number) => `${n} min`, label: 'Your text',
  },
  ar: {
    placeholder: 'ابدأ الكتابة أو الصق نصّك…',
    words: 'الكلمات', characters: 'الحروف', charactersNoSpaces: 'الحروف (بدون مسافات)',
    sentences: 'الجُمل', paragraphs: 'الفقرات', readingTime: 'وقت القراءة',
    min: (n: number) => `${n} دقيقة`, label: 'نصّك',
  },
}

interface WordSeg { isWordLike?: boolean }
interface Segmenter { segment(input: string): Iterable<WordSeg> }
type SegmenterCtor = new (locale: string, opts: { granularity: 'word' }) => Segmenter

function countWords(text: string, locale: string): number {
  if (!text.trim()) return 0
  const Ctor = (Intl as unknown as { Segmenter?: SegmenterCtor }).Segmenter
  if (typeof Ctor === 'function') {
    let n = 0
    for (const s of new Ctor(locale, { granularity: 'word' }).segment(text)) {
      if (s.isWordLike) n++
    }
    return n
  }
  return text.trim().split(/\s+/).length
}

export default function WordCounterTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const [text, setText] = useState('')

  const stats = useMemo(() => {
    const words = countWords(text, locale)
    const characters = Array.from(text).length
    const charactersNoSpaces = Array.from(text.replace(/\s/g, '')).length
    const sentences = (text.match(/[^.!?۔؟]+[.!?۔؟]+/g) || []).length || (text.trim() ? 1 : 0)
    const paragraphs = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean).length
    const readingMin = Math.max(text.trim() ? 1 : 0, Math.round(words / 200))
    return { words, characters, charactersNoSpaces, sentences, paragraphs, readingMin }
  }, [text, locale])

  const cards: [string, string | number][] = [
    [s.words, stats.words],
    [s.characters, stats.characters],
    [s.charactersNoSpaces, stats.charactersNoSpaces],
    [s.sentences, stats.sentences],
    [s.paragraphs, stats.paragraphs],
    [s.readingTime, s.min(stats.readingMin)],
  ]

  return (
    <div className="stack" data-testid="word-counter">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(120px,1fr))] gap-[0.8rem]" data-testid="wc-stats">
        {cards.map(([label, val]) => (
          <div className="bg-[var(--surface)] border border-[color:var(--line-soft)] rounded-md px-4 py-[0.9rem] text-center" key={label}>
            <span className="block font-display text-[1.7rem] text-green-700 leading-none rtl:font-ar" data-testid={`wc-${label}`}>{val}</span>
            <span className="block mt-[0.35rem] text-[0.78rem] text-ink-faint">{label}</span>
          </div>
        ))}
      </div>
      <label className="field">
        <span className="field__label">{s.label}</span>
        <textarea className="input input--area" rows={10} placeholder={s.placeholder}
          data-testid="wc-input" aria-label={s.label}
          value={text} onChange={(e) => setText(e.target.value)} />
      </label>
    </div>
  )
}
