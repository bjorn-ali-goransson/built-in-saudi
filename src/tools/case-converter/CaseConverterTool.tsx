import { useMemo, useState } from 'react'
import { useLocale } from '../../i18n'
import { CopyIcon } from '../../components/icons'

const cap = (w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
const words = (s: string) =>
  s.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').split(/\s+/).filter(Boolean)

type CaseId = 'upper' | 'lower' | 'title' | 'sentence' | 'camel' | 'pascal' | 'snake' | 'kebab' | 'constant'

const TRANSFORMS: Record<CaseId, (s: string) => string> = {
  upper: (s) => s.toUpperCase(),
  lower: (s) => s.toLowerCase(),
  title: (s) => words(s).map(cap).join(' '),
  sentence: (s) => s.toLowerCase().replace(/(^\s*\S|[.!?]\s+\S)/g, (c) => c.toUpperCase()),
  camel: (s) => words(s).map((w, i) => (i === 0 ? w.toLowerCase() : cap(w))).join(''),
  pascal: (s) => words(s).map(cap).join(''),
  snake: (s) => words(s).map((w) => w.toLowerCase()).join('_'),
  kebab: (s) => words(s).map((w) => w.toLowerCase()).join('-'),
  constant: (s) => words(s).map((w) => w.toUpperCase()).join('_'),
}

const STR = {
  en: {
    placeholder: 'Type or paste text…',
    labels: { upper: 'UPPERCASE', lower: 'lowercase', title: 'Title Case', sentence: 'Sentence case', camel: 'camelCase', pascal: 'PascalCase', snake: 'snake_case', kebab: 'kebab-case', constant: 'CONSTANT_CASE' } as Record<CaseId, string>,
    copy: 'Copy', copied: 'Copied!',
    stats: (w: number, c: number) => `${w.toLocaleString()} words · ${c.toLocaleString()} chars`,
    empty: 'Enter some text to see every case.',
  },
  ar: {
    placeholder: 'اكتب أو الصق نصًا…',
    labels: { upper: 'أحرف كبيرة', lower: 'أحرف صغيرة', title: 'حرف أول كبير', sentence: 'أول الجملة', camel: 'camelCase', pascal: 'PascalCase', snake: 'snake_case', kebab: 'kebab-case', constant: 'CONSTANT_CASE' } as Record<CaseId, string>,
    copy: 'نسخ', copied: 'تم النسخ!',
    stats: (w: number, c: number) => `${w.toLocaleString('ar')} كلمة · ${c.toLocaleString('ar')} حرف`,
    empty: 'أدخل نصًا لعرض جميع الحالات.',
  },
}

const ORDER: CaseId[] = ['upper', 'lower', 'title', 'sentence', 'camel', 'pascal', 'snake', 'kebab', 'constant']

export default function CaseConverterTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const [text, setText] = useState('')
  const [copied, setCopied] = useState<CaseId | ''>('')

  const results = useMemo(() => ORDER.map((id) => [id, TRANSFORMS[id](text)] as const), [text])
  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0

  async function copy(id: CaseId, value: string) {
    if (!value) return
    try { await navigator.clipboard.writeText(value); setCopied(id); setTimeout(() => setCopied(''), 1500) } catch { /* ignore */ }
  }

  return (
    <div className="stack" data-testid="case-converter">
      <textarea className="input input--area min-h-[6rem]" data-testid="case-input"
        placeholder={s.placeholder} value={text} onChange={(e) => setText(e.target.value)} />
      <p className="text-[0.82rem] text-ink-faint font-mono">{s.stats(wordCount, text.length)}</p>

      {text.trim() ? (
        <div className="flex flex-col gap-2">
          {results.map(([id, val]) => (
            <div key={id} className="flex items-center gap-2 border border-[color:var(--line-soft)] rounded-md bg-[var(--surface)] px-3 py-2">
              <div className="flex flex-col min-w-0 flex-1">
                <span className="font-body text-[0.68rem] uppercase tracking-[0.06em] text-ink-faint">{s.labels[id]}</span>
                <span className="text-ink break-words" data-testid={`case-${id}`}>{val}</span>
              </div>
              <button className="btn flex-none px-3" onClick={() => copy(id, val)} aria-label={s.copy} data-testid={`case-copy-${id}`}>
                <CopyIcon /> {copied === id ? s.copied : s.copy}
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-ink-faint text-[0.95rem]">{s.empty}</p>
      )}
    </div>
  )
}
