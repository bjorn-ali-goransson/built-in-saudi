import { useMemo, useState } from 'react'
import { useLocale } from '../../i18n'
import { ADHKAR, type When } from './data'

const STR = {
  en: {
    morning: 'Morning', evening: 'Evening',
    lede: 'The core morning and evening remembrances from the Qur’an and authentic Sunnah. Tap a card to count your repetitions — your progress is kept for today on this device.',
    times: (n: number) => `×${n}`, done: 'Done', reset: 'Reset',
    translit: 'Transliteration', meaning: 'Meaning',
    note: 'Arabic is the Qur’an/Sunnah text; transliteration and meaning were written for this app — verify before relying on them.',
    progress: (d: number, t: number) => `${d} / ${t}`,
  },
  ar: {
    morning: 'الصباح', evening: 'المساء',
    lede: 'أذكار الصباح والمساء الأساسية من القرآن والسنة الصحيحة. اضغط على البطاقة لعدّ التكرار — يُحفظ تقدّمك لهذا اليوم على جهازك.',
    times: (n: number) => `×${n}`, done: 'تمّ', reset: 'إعادة',
    translit: 'النطق', meaning: 'المعنى (بالإنجليزية)',
    note: 'النص العربي من القرآن والسنة؛ وكُتب النطق والمعنى الإنجليزي لهذا التطبيق — تحقّق قبل الاعتماد عليهما.',
    progress: (d: number, t: number) => `${d} / ${t}`,
  },
}

const todayKey = () => new Date().toISOString().slice(0, 10)
const storeKey = (when: When) => `bis-adhkar-${todayKey()}-${when}`

function loadProgress(when: When): Record<string, number> {
  try { return JSON.parse(localStorage.getItem(storeKey(when)) || '{}') } catch { return {} }
}

export default function AdhkarTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const [when, setWhen] = useState<When>(() => (new Date().getHours() < 12 ? 'morning' : 'evening'))
  const [progress, setProgress] = useState<Record<string, number>>(() => loadProgress(when))

  const list = useMemo(() => ADHKAR.filter((d) => d.when === 'both' || d.when === when), [when])

  function switchWhen(w: When) { setWhen(w); setProgress(loadProgress(w)) }

  function tap(id: string, target: number) {
    setProgress((p) => {
      const cur = p[id] || 0
      const next = cur >= target ? 0 : cur + 1 // tapping a completed dhikr resets it
      const np = { ...p, [id]: next }
      try { localStorage.setItem(storeKey(when), JSON.stringify(np)) } catch { /* ignore */ }
      return np
    })
  }

  function resetAll() {
    setProgress({})
    try { localStorage.removeItem(storeKey(when)) } catch { /* ignore */ }
  }

  return (
    <div className="flex flex-col gap-5 max-w-[46rem] mx-auto" data-testid="adhkar">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="seg" role="group" aria-label="time">
          {(['morning', 'evening'] as ('morning' | 'evening')[]).map((w) => (
            <button key={w} className={`seg__btn ${when === w ? 'is-active' : ''}`} aria-pressed={when === w}
              data-testid={`adhkar-${w}`} onClick={() => switchWhen(w)}>{s[w]}</button>
          ))}
        </div>
        <button className="pill" data-testid="adhkar-reset" onClick={resetAll}>{s.reset}</button>
      </div>

      <p className="text-[0.95rem] text-ink-soft leading-relaxed">{s.lede}</p>

      <ol className="flex flex-col gap-3">
        {list.map((d, i) => {
          const done = (progress[d.id] || 0) >= d.count
          const cur = progress[d.id] || 0
          return (
            <li key={d.id}>
              <button
                onClick={() => tap(d.id, d.count)}
                data-testid={`dhikr-${d.id}`}
                className={`w-full text-start border rounded-md bg-[var(--surface)] p-4 flex flex-col gap-3 transition-[border-color,opacity] duration-150 hover:border-green-500 ${done ? 'border-green-600 opacity-70' : 'border-[color:var(--line-soft)]'}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-mono text-[0.75rem] text-ink-faint">{i + 1}</span>
                  <span className={`inline-flex items-center gap-2 text-[0.8rem] font-semibold ${done ? 'text-green-600' : 'text-ink-soft'}`}>
                    {d.count > 1 && <span className="tabular-nums">{s.progress(cur, d.count)}</span>}
                    <span className="pill pill--accent !cursor-default">{done ? s.done : s.times(d.count)}</span>
                  </span>
                </div>
                <p dir="rtl" lang="ar" className="font-ar text-[1.4rem] leading-[2] text-ink">{d.ar}</p>
                <div className="flex flex-col gap-2">
                  <p className="text-[0.9rem] text-ink-soft italic leading-relaxed">{d.translit}</p>
                  <p className="text-[0.9rem] text-ink leading-relaxed">{d.en}</p>
                  <p className="text-[0.78rem] text-ink-faint">{d.ref}</p>
                </div>
              </button>
            </li>
          )
        })}
      </ol>

      <p className="text-[0.78rem] text-ink-faint">{s.note}</p>
    </div>
  )
}
