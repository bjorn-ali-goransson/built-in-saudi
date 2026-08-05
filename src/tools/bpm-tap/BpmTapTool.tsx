import { useEffect, useRef, useState } from 'react'
import { useLocale } from '../../i18n'
import { Button, Stack, Panel, Select } from '../../components/ui'
import { CopyIcon, RefreshIcon, TimerIcon } from '../../components/icons'

// Tap tempo, done properly. The naive version averages every gap since you
// started, which means an unsteady first few taps poison the reading forever and
// a deliberate tempo change never registers. This keeps a sliding window, and
// reports how STEADY you were — because a number with no confidence attached is
// how people end up trusting a bad reading.

const STR = {
  en: {
    tap: 'Tap', tapKey: 'or press space',
    bpm: 'BPM', reset: 'Reset',
    taps: (n: number) => `${n} tap${n === 1 ? '' : 's'}`,
    needMore: 'Keep tapping…',
    steadiness: 'Steadiness', steady: 'Steady', wobbly: 'A bit uneven', rough: 'Uneven — keep going',
    window: 'Average over', lastN: (n: number) => `the last ${n} taps`, all: 'all taps',
    copy: 'Copy', copied: 'Copied!',
    derived: 'Useful values',
    quarter: 'Quarter note', eighth: 'Eighth', dotted: 'Dotted eighth', half: 'Half note',
    bar4: 'One bar (4/4)', delayHint: 'Delay and reverb times in milliseconds, which is what you actually need at a mixing desk.',
    hint: 'Tap along to the music. The reading uses a sliding window rather than everything since you started, so it follows a tempo change instead of averaging it away.',
    metronome: 'Send this to the metronome',
    steadyHint: 'Steadiness is how much your taps varied. A reading from wildly uneven taps is a guess with a decimal point on it.',
  },
  ar: {
    tap: 'انقر', tapKey: 'أو اضغط المسافة',
    bpm: 'نبضة/دقيقة', reset: 'تصفير',
    taps: (n: number) => `${n.toLocaleString('ar')} نقرة`,
    needMore: 'واصل النقر…',
    steadiness: 'الثبات', steady: 'ثابت', wobbly: 'غير منتظم قليلًا', rough: 'غير منتظم — واصل',
    window: 'المتوسط على', lastN: (n: number) => `آخر ${n.toLocaleString('ar')} نقرات`, all: 'كل النقرات',
    copy: 'نسخ', copied: 'تم النسخ!',
    derived: 'قيم مفيدة',
    quarter: 'نغمة ربعية', eighth: 'ثمانية', dotted: 'ثمانية منقوطة', half: 'نصفية',
    bar4: 'مازورة واحدة (٤/٤)', delayHint: 'أزمنة التأخير والصدى بالمللي ثانية، وهي ما تحتاجه فعلًا على طاولة المزج.',
    hint: 'انقر مع الموسيقى. تستخدم القراءة نافذة متحركة بدل كل شيء منذ البداية، فتتابع تغيّر الإيقاع بدل أن تُذيبه في المتوسط.',
    metronome: 'أرسل هذا إلى الميقاتية',
    steadyHint: 'الثبات هو مقدار تفاوت نقراتك. والقراءة من نقرات متفاوتة بشدة تخمينٌ عليه فاصلة عشرية.',
  },
}

export default function BpmTapTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const [taps, setTaps] = useState<number[]>([])
  const [windowSize, setWindowSize] = useState(8)
  const [copied, setCopied] = useState(false)
  const [flash, setFlash] = useState(false)
  const flashTimer = useRef(0)

  function tap() {
    const now = performance.now()
    setTaps((prev) => {
      // A gap over two seconds is a new attempt, not a 30bpm tempo.
      if (prev.length && now - prev[prev.length - 1] > 2000) return [now]
      return [...prev, now]
    })
    setFlash(true)
    window.clearTimeout(flashTimer.current)
    flashTimer.current = window.setTimeout(() => setFlash(false), 90)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return
      // Don't hijack the spacebar while someone is typing in a field.
      const el = document.activeElement
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) return
      e.preventDefault()
      tap()
    }
    window.addEventListener('keydown', onKey)
    return () => { window.removeEventListener('keydown', onKey); window.clearTimeout(flashTimer.current) }
  }, [])

  const gaps = taps.slice(1).map((t, i) => t - taps[i])
  const used = windowSize === 0 ? gaps : gaps.slice(-windowSize)
  const mean = used.length ? used.reduce((a, b) => a + b, 0) / used.length : 0
  const bpm = mean ? 60000 / mean : 0

  // Coefficient of variation: spread relative to the tempo, so it means the same
  // thing at 60bpm and at 180.
  const sd = used.length > 1
    ? Math.sqrt(used.reduce((a, g) => a + (g - mean) ** 2, 0) / used.length)
    : 0
  const cv = mean ? sd / mean : 0
  const quality = cv < 0.03 ? 'steady' : cv < 0.08 ? 'wobbly' : 'rough'
  const qualityTone = quality === 'steady' ? 'text-green-700' : quality === 'wobbly' ? 'text-ink' : 'text-gold-500'

  const ms = (fraction: number) => (mean ? Math.round(mean * fraction) : 0)

  async function copy() {
    try { await navigator.clipboard.writeText(String(Math.round(bpm))); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch { /* ignore */ }
  }

  return (
    <Stack data-testid="bpm-tap">
      <div className="flex flex-col items-center gap-3">
        <span className="font-display text-[clamp(3.5rem,16vw,6rem)] leading-none text-ink font-mono" data-testid="bt-bpm">
          {used.length >= 2 ? Math.round(bpm) : '—'}
        </span>
        <span className="text-[0.9rem] text-ink-faint rtl:font-ar">{s.bpm}</span>

        <button
          onClick={tap}
          data-testid="bt-tap"
          className={`w-full max-w-[22rem] py-10 rounded-lg border-2 font-display text-[1.6rem] select-none transition-colors ${
            flash ? 'bg-green-600 border-green-600 text-sand-100' : 'bg-[var(--surface)] border-[color:var(--line)] text-ink'
          }`}
        >
          {s.tap}
          <span className="block text-[0.8rem] font-body text-ink-faint mt-1 rtl:font-ar">{s.tapKey}</span>
        </button>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <span className="text-[0.9rem] text-ink-faint" data-testid="bt-count">{s.taps(taps.length)}</span>
          {used.length >= 2 && (
            <span className={`text-[0.9rem] rtl:font-ar ${qualityTone}`} data-testid="bt-quality">
              {s.steadiness}: {s[quality]}
            </span>
          )}
          <Button className="px-3 py-1" onClick={() => setTaps([])} data-testid="bt-reset"><RefreshIcon /> {s.reset}</Button>
          {used.length >= 2 && (
            <Button className="px-3 py-1" onClick={copy} data-testid="bt-copy"><CopyIcon /> {copied ? s.copied : s.copy}</Button>
          )}
        </div>

        {used.length < 2 && <span className="text-[0.9rem] text-ink-faint rtl:font-ar" data-testid="bt-more">{s.needMore}</span>}

        <label className="flex items-center gap-2 text-[0.8rem] text-ink-faint">
          {s.window}
          <Select className="min-w-[10rem]" data-testid="bt-window" value={windowSize} onChange={(e) => setWindowSize(+e.target.value)}>
            {[4, 8, 16].map((n) => <option key={n} value={n}>{s.lastN(n)}</option>)}
            <option value={0}>{s.all}</option>
          </Select>
        </label>
      </div>

      {used.length >= 2 && (
        <section className="flex flex-col gap-2">
          <h2 className="font-body text-[0.68rem] uppercase tracking-[0.06em] text-ink-faint">{s.derived}</h2>
          <div className="grid grid-cols-2 min-[560px]:grid-cols-5 gap-2" data-testid="bt-derived">
            {([
              [s.quarter, 1], [s.eighth, 0.5], [s.dotted, 0.75], [s.half, 2], [s.bar4, 4],
            ] as [string, number][]).map(([label, f]) => (
              <div key={label} className="flex flex-col items-center border border-[color:var(--line)] rounded-md bg-[var(--surface)] py-2">
                <span className="text-[0.72rem] text-ink-faint text-center rtl:font-ar">{label}</span>
                <span className="font-mono text-[1.05rem] text-ink">{ms(f)} ms</span>
              </div>
            ))}
          </div>
          <p className="text-[0.82rem] text-ink-faint rtl:font-ar">{s.delayHint}</p>
          <Button to={`/${locale}/apps/metronome`} className="self-start"><TimerIcon /> {s.metronome}</Button>
        </section>
      )}

      <Panel className="flex flex-col gap-1">
        <p className="text-[0.85rem] text-ink-soft rtl:font-ar">{s.hint}</p>
        <p className="text-[0.85rem] text-ink-faint rtl:font-ar">{s.steadyHint}</p>
      </Panel>
    </Stack>
  )
}
