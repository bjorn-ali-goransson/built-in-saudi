import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocale } from '../../i18n'
import { Stack, Button, Panel, Seg, SegButton, FieldLabel, Input } from '../../components/ui'

type Phase = 'focus' | 'short' | 'long'
const KEY = 'bis-pomodoro'

const STR = {
  en: {
    focus: 'Focus', short: 'Short break', long: 'Long break', start: 'Start', pause: 'Pause', reset: 'Reset', skip: 'Skip',
    rounds: 'Completed focus rounds', lengths: 'Lengths (minutes)', privacy: 'Runs on your device — settings stay in this browser.',
  },
  ar: {
    focus: 'تركيز', short: 'راحة قصيرة', long: 'راحة طويلة', start: 'ابدأ', pause: 'إيقاف مؤقت', reset: 'تصفير', skip: 'تخطٍّ',
    rounds: 'جولات التركيز المكتملة', lengths: 'المدد (بالدقائق)', privacy: 'يعمل على جهازك — تبقى الإعدادات في هذا المتصفح.',
  },
}

const DEFAULTS = { focus: 25, short: 5, long: 15 }

function chime() {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
    const o = ctx.createOscillator(), g = ctx.createGain()
    o.connect(g); g.connect(ctx.destination)
    o.type = 'sine'; o.frequency.value = 660
    g.gain.setValueAtTime(0.001, ctx.currentTime)
    g.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + 0.02)
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.9)
    o.start(); o.stop(ctx.currentTime + 0.9)
  } catch { /* no audio */ }
}

export default function PomodoroTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const [lengths, setLengths] = useState(() => {
    try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') } } catch { return DEFAULTS }
  })
  const [phase, setPhase] = useState<Phase>('focus')
  const [left, setLeft] = useState(DEFAULTS.focus * 60)
  const [running, setRunning] = useState(false)
  const [rounds, setRounds] = useState(0)
  const startedAt = useRef<number>(0)
  const remainingAt = useRef<number>(DEFAULTS.focus * 60)

  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(lengths)) } catch { /* */ } }, [lengths])

  // When not running, the timer reflects the current phase length.
  useEffect(() => { if (!running) { setLeft(lengths[phase] * 60); remainingAt.current = lengths[phase] * 60 } }, [phase, lengths, running])

  const nextPhase = useCallback(() => {
    chime()
    if (phase === 'focus') {
      const r = rounds + 1
      setRounds(r)
      setPhase(r % 4 === 0 ? 'long' : 'short')
    } else setPhase('focus')
    setRunning(false)
  }, [phase, rounds])

  useEffect(() => {
    if (!running) return
    startedAt.current = Date.now()
    const base = remainingAt.current
    const id = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startedAt.current) / 1000)
      const rem = base - elapsed
      if (rem <= 0) { setLeft(0); nextPhase() } else setLeft(rem)
    }, 250)
    return () => clearInterval(id)
  }, [running, nextPhase])

  function toggle() {
    if (running) { remainingAt.current = left; setRunning(false) }
    else { remainingAt.current = left; setRunning(true) }
  }
  function reset() { setRunning(false); setLeft(lengths[phase] * 60); remainingAt.current = lengths[phase] * 60 }

  const mm = String(Math.floor(left / 60)).padStart(2, '0')
  const ss = String(left % 60).padStart(2, '0')
  const total = lengths[phase] * 60
  const pct = total ? ((total - left) / total) * 100 : 0

  return (
    <Stack data-testid="pomodoro">
      <Seg className="self-center">
        <SegButton active={phase === 'focus'} onClick={() => { setRunning(false); setPhase('focus') }} data-testid="pom-focus">{s.focus}</SegButton>
        <SegButton active={phase === 'short'} onClick={() => { setRunning(false); setPhase('short') }} data-testid="pom-short">{s.short}</SegButton>
        <SegButton active={phase === 'long'} onClick={() => { setRunning(false); setPhase('long') }} data-testid="pom-long">{s.long}</SegButton>
      </Seg>

      <Panel className="items-center text-center gap-4">
        <div className="relative w-52 h-52 mx-auto">
          <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
            <circle cx="50" cy="50" r="45" fill="none" stroke="color-mix(in srgb, var(--ink) 10%, transparent)" strokeWidth="6" />
            <circle cx="50" cy="50" r="45" fill="none" stroke="var(--green-600)" strokeWidth="6" strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 45} strokeDashoffset={(1 - pct / 100) * 2 * Math.PI * 45} />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="font-mono text-[3rem] font-bold text-ink tabular-nums" data-testid="pom-time">{mm}:{ss}</span>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="primary" onClick={toggle} data-testid="pom-toggle">{running ? s.pause : s.start}</Button>
          <Button onClick={reset} data-testid="pom-reset">{s.reset}</Button>
          <Button onClick={nextPhase} data-testid="pom-skip">{s.skip}</Button>
        </div>
        <p className="text-[0.85rem] text-ink-soft">{s.rounds}: <b data-testid="pom-rounds">{rounds}</b></p>
      </Panel>

      <div>
        <FieldLabel>{s.lengths}</FieldLabel>
        <div className="grid gap-3 sm:grid-cols-3 mt-1">
          {(['focus', 'short', 'long'] as Phase[]).map((p) => (
            <label key={p} className="flex items-center gap-2 text-[0.85rem] text-ink-soft">
              <span className="w-24">{s[p]}</span>
              <Input type="number" min={1} max={90} value={lengths[p]} onChange={(e) => setLengths((l: typeof DEFAULTS) => ({ ...l, [p]: Math.min(90, Math.max(1, Number(e.target.value) || 1)) }))} className="font-mono" data-testid={`pom-len-${p}`} />
            </label>
          ))}
        </div>
      </div>
      <p className="text-[0.8rem] text-ink-faint flex items-center gap-[0.4rem]"><span aria-hidden="true">🔒</span> {s.privacy}</p>
    </Stack>
  )
}
