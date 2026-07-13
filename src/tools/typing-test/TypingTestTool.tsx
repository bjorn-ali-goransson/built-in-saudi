import { useMemo, useState } from 'react'
import { useLocale } from '../../i18n'
import { Stack, Panel, Button, FieldLabel } from '../../components/ui'

const SAMPLES = {
  en: [
    'The quick brown fox jumps over the lazy dog while the sun sets behind the distant hills.',
    'Good design is honest and useful; it says only what it needs to and never gets in the way.',
    'A journey of a thousand miles begins with a single step, taken with patience and quiet resolve.',
  ],
  ar: [
    'العلم في الصغر كالنقش على الحجر، فاغتنم شبابك قبل هرمك وفراغك قبل شغلك.',
    'من جدَّ وجد، ومن زرع حصد، ومن سار على الدرب وصل مهما طال به الطريق.',
    'الكلمة الطيبة صدقة، والابتسامة في وجه أخيك تفتح القلوب وتزرع المودّة بين الناس.',
  ],
}

const STR = {
  en: { title: 'Type this', restart: 'New passage', wpm: 'WPM', accuracy: 'Accuracy', chars: 'Characters', done: 'Done!', start: 'Start typing to begin the timer.', privacy: 'Runs in your browser — nothing is uploaded.' },
  ar: { title: 'اكتب هذا', restart: 'مقطع جديد', wpm: 'ك/د', accuracy: 'الدقّة', chars: 'الأحرف', done: 'أُنجز!', start: 'ابدأ الكتابة لتشغيل المؤقّت.', privacy: 'يعمل في متصفحك — لا يُرفع أي شيء.' },
}

export default function TypingTestTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const pool = SAMPLES[locale]
  const [idx, setIdx] = useState(0)
  const sample = pool[idx % pool.length]
  const [typed, setTyped] = useState('')
  const [start, setStart] = useState<number | null>(null)
  const [end, setEnd] = useState<number | null>(null)

  function onChange(v: string) {
    if (end) return
    if (start === null && v.length > 0) setStart(Date.now())
    const next = v.slice(0, sample.length)
    setTyped(next)
    if (next.length === sample.length) setEnd(Date.now())
  }
  function restart() { setIdx((i) => i + 1); setTyped(''); setStart(null); setEnd(null) }

  const stats = useMemo(() => {
    const correct = [...typed].filter((c, i) => c === sample[i]).length
    const elapsed = start ? ((end || Date.now()) - start) / 60000 : 0
    const wpm = elapsed > 0 ? Math.round((correct / 5) / elapsed) : 0
    const accuracy = typed.length ? Math.round((correct / typed.length) * 100) : 100
    return { correct, wpm, accuracy }
  }, [typed, sample, start, end])

  return (
    <Stack data-testid="typing-test">
      <div>
        <FieldLabel>{s.title}</FieldLabel>
        <p className="mt-1 text-[1.15rem] leading-relaxed font-mono border border-[color:var(--line-soft)] rounded-md bg-[var(--surface)] p-4 select-none" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
          {[...sample].map((ch, i) => {
            const t = typed[i]
            const cls = t == null ? 'text-ink-faint' : t === ch ? 'text-green-700' : 'bg-[color-mix(in_srgb,var(--danger)_22%,transparent)] text-[color:var(--danger)] rounded-[2px]'
            return <span key={i} className={`${cls} ${i === typed.length ? 'border-b-2 border-green-600' : ''}`}>{ch}</span>
          })}
        </p>
      </div>

      <textarea value={typed} onChange={(e) => onChange(e.target.value)} rows={3} autoFocus dir={locale === 'ar' ? 'rtl' : 'ltr'}
        className="w-full rounded-md border border-[color:var(--line)] bg-[var(--surface)] p-3 font-mono text-[1rem] focus:outline-none focus:border-green-500" data-testid="tt-input" />

      <Panel className="!grid-cols-3 grid-cols-3 text-center">
        <div><FieldLabel>{s.wpm}</FieldLabel><p className="text-[2rem] font-display font-bold text-green-700 leading-none" data-testid="tt-wpm">{stats.wpm}</p></div>
        <div><FieldLabel>{s.accuracy}</FieldLabel><p className="text-[2rem] font-display font-bold text-ink leading-none" data-testid="tt-accuracy">{stats.accuracy}%</p></div>
        <div><FieldLabel>{s.chars}</FieldLabel><p className="text-[2rem] font-display font-bold text-ink leading-none">{typed.length}/{sample.length}</p></div>
      </Panel>

      <div className="flex items-center gap-3">
        <Button onClick={restart} data-testid="tt-restart">{s.restart}</Button>
        {end && <span className="text-green-700 font-semibold">{s.done}</span>}
        {!start && <span className="text-[0.85rem] text-ink-faint">{s.start}</span>}
      </div>
      <p className="text-[0.8rem] text-ink-faint flex items-center gap-[0.4rem]"><span aria-hidden="true">🔒</span> {s.privacy}</p>
    </Stack>
  )
}
