import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocale } from '../../i18n'
import { Button, Field, Input, Stack, Panel, Seg, SegButton } from '../../components/ui'
import { elapsed, format, splits, durationMs, type Running } from './time'

const STR = {
  en: {
    intro: 'A stopwatch that counts up and a timer that counts down. Both keep time from the clock rather than by counting ticks, so switching tabs or locking the phone does not lose the minutes in between — which is what usually goes wrong with a timer in a browser.',
    mode: 'Mode', up: 'Stopwatch', down: 'Timer',
    start: 'Start', stop: 'Stop', resume: 'Resume', reset: 'Reset', lap: 'Lap',
    minutes: 'Minutes', seconds: 'Seconds',
    laps: 'Laps', lapNo: 'Lap', split: 'Split', total: 'Total',
    done: 'Time is up', dismiss: 'Dismiss',
    hint: 'It keeps running while the tab is in the background.',
  },
  ar: {
    intro: 'ساعة إيقاف تعدّ تصاعديًا ومؤقّت يعدّ تنازليًا. وكلاهما يقيس الوقت من الساعة نفسها لا بعدّ النبضات، فلا تضيع الدقائق حين تنتقل بين التبويبات أو تُقفل الهاتف — وهذا ما يفسد المؤقّتات في المتصفح عادةً.',
    mode: 'الوضع', up: 'ساعة إيقاف', down: 'مؤقّت',
    start: 'ابدأ', stop: 'أوقف', resume: 'تابع', reset: 'صفّر', lap: 'لفة',
    minutes: 'دقائق', seconds: 'ثوانٍ',
    laps: 'اللفّات', lapNo: 'لفة', split: 'الفارق', total: 'الإجمالي',
    done: 'انتهى الوقت', dismiss: 'إغلاق',
    hint: 'يستمر العمل والتبويب في الخلفية.',
  },
}

/** A short beep, so the timer can be heard without shipping an audio file. */
function beep() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new Ctx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.frequency.value = 880
    gain.gain.setValueAtTime(0.0001, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.6)
    osc.connect(gain).connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.62)
    osc.onended = () => ctx.close()
  } catch { /* no audio permission, or none available — the screen still says so */ }
}

export default function StopwatchTool() {
  const { locale } = useLocale()
  const s = STR[locale]

  const [mode, setMode] = useState<'up' | 'down'>('up')
  const [running, setRunning] = useState<Running | null>(null)
  const [banked, setBanked] = useState(0)
  const [now, setNow] = useState(0)
  const [marks, setMarks] = useState<number[]>([])
  const [mins, setMins] = useState('5')
  const [secs, setSecs] = useState('0')
  const [rang, setRang] = useState(false)
  const frame = useRef<number>(0)

  // Repaint on every frame while running; the VALUE comes from the clock, so a
  // dropped or throttled frame costs nothing but smoothness.
  useEffect(() => {
    if (!running) return
    const tick = () => { setNow(performance.now()); frame.current = requestAnimationFrame(tick) }
    frame.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame.current)
  }, [running])

  const ms = elapsed(running, banked, now)
  const target = durationMs(Number(mins), Number(secs))
  const shown = mode === 'up' ? ms : Math.max(0, target - ms)
  const finished = mode === 'down' && running !== null && ms >= target

  // Sound and stop exactly once, at the moment it lands on zero.
  useEffect(() => {
    if (!finished || rang) return
    setRang(true)
    setBanked(target)
    setRunning(null)
    beep()
  }, [finished, rang, target])

  const start = useCallback(() => {
    setRang(false)
    setNow(performance.now())
    setRunning({ since: performance.now(), banked })
  }, [banked])

  const stop = useCallback(() => {
    setBanked(elapsed(running, banked, performance.now()))
    setRunning(null)
  }, [running, banked])

  const reset = useCallback(() => {
    setRunning(null); setBanked(0); setMarks([]); setRang(false)
  }, [])

  const rows = splits(marks)

  return (
    <Stack data-testid="stopwatch">
      <p className="text-[0.95rem] text-ink-soft rtl:font-ar">{s.intro}</p>

      <Field label={s.mode}>
        <Seg data-testid="sw-mode">
          <SegButton active={mode === 'up'} data-testid="sw-up" onClick={() => { setMode('up'); reset() }}>{s.up}</SegButton>
          <SegButton active={mode === 'down'} data-testid="sw-down" onClick={() => { setMode('down'); reset() }}>{s.down}</SegButton>
        </Seg>
      </Field>

      {mode === 'down' && (
        <div className="grid gap-3 grid-cols-2 min-[620px]:grid-cols-4">
          <Field label={s.minutes}>
            <Input type="number" inputMode="numeric" min="0" value={mins} data-testid="sw-minutes"
              onChange={(e) => { setMins(e.target.value); reset() }} />
          </Field>
          <Field label={s.seconds}>
            <Input type="number" inputMode="numeric" min="0" max="59" value={secs} data-testid="sw-seconds"
              onChange={(e) => { setSecs(e.target.value); reset() }} />
          </Field>
        </div>
      )}

      <Panel className="gap-3 items-center">
        <div className={`font-mono tabular-nums text-[clamp(2.6rem,12vw,4.5rem)] leading-none ${finished || (mode === 'down' && shown === 0 && banked > 0) ? 'text-gold-500' : 'text-ink'}`}
          data-testid="sw-display" role="timer" aria-live="off">
          {format(shown)}
        </div>
        {rang && (
          <div className="flex items-center gap-3">
            <span className="text-[1rem] text-gold-500 rtl:font-ar" data-testid="sw-done">{s.done}</span>
            <Button className="px-3 py-1" data-testid="sw-dismiss" onClick={reset}>{s.dismiss}</Button>
          </div>
        )}
        <div className="flex flex-wrap items-center justify-center gap-2">
          {running
            ? <Button variant="primary" data-testid="sw-stop" onClick={stop}>{s.stop}</Button>
            : <Button variant="primary" data-testid="sw-start" onClick={start}>{banked > 0 ? s.resume : s.start}</Button>}
          {mode === 'up' && (
            <Button data-testid="sw-lap" disabled={!running}
              onClick={() => setMarks((m) => [...m, elapsed(running, banked, performance.now())])}>{s.lap}</Button>
          )}
          <Button data-testid="sw-reset" disabled={!running && banked === 0 && marks.length === 0} onClick={reset}>{s.reset}</Button>
        </div>
        <p className="text-[0.8rem] text-ink-faint rtl:font-ar">{s.hint}</p>
      </Panel>

      {rows.length > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className="font-body text-[0.68rem] uppercase tracking-[0.06em] text-ink-faint">{s.laps}</h2>
          <div className="overflow-x-auto">
            <table className="border-collapse text-[0.85rem] font-mono" data-testid="sw-laps">
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} data-testid={`sw-lap-${i}`}>
                    <td className="border border-[color:var(--line)] px-3 py-1 text-ink-faint">{s.lapNo} {i + 1}</td>
                    <td className="border border-[color:var(--line)] px-3 py-1 text-ink">{format(r.lap)}</td>
                    <td className="border border-[color:var(--line)] px-3 py-1 text-ink-soft">{format(r.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Stack>
  )
}
