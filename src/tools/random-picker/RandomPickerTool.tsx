import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocale } from '../../i18n'
import { Stack, Textarea, Button, FieldLabel } from '../../components/ui'
import { VolumeIcon, MuteIcon } from '../../components/icons'

const STR = {
  en: { input: 'Options (one per line)', spin: 'Spin', spinning: 'Spinning…', winner: 'Winner', need: 'Add at least two options.', privacy: 'Runs in your browser — nothing is uploaded.', soundOn: 'Sound on', soundOff: 'Sound off' },
  ar: { input: 'الخيارات (خيار في كل سطر)', spin: 'أدِر', spinning: 'يدور…', winner: 'الفائز', need: 'أضف خيارين على الأقل.', privacy: 'يعمل في متصفحك — لا يُرفع أي شيء.', soundOn: 'الصوت مفعّل', soundOff: 'الصوت متوقف' },
}

const COLORS = ['#1f3d2b', '#2f6b45', '#c8a24b', '#8a6d2b', '#3a7d5d', '#b07a3c', '#4c8a63', '#9a8548']
const R = 150, C = 160

function slice(i: number, n: number): string {
  const a0 = (i / n) * 2 * Math.PI - Math.PI / 2
  const a1 = ((i + 1) / n) * 2 * Math.PI - Math.PI / 2
  const large = a1 - a0 > Math.PI ? 1 : 0
  return `M ${C} ${C} L ${C + R * Math.cos(a0)} ${C + R * Math.sin(a0)} A ${R} ${R} 0 ${large} 1 ${C + R * Math.cos(a1)} ${C + R * Math.sin(a1)} Z`
}

export default function RandomPickerTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const [text, setText] = useState('Sara\nOmar\nFahad\nNoura\nKhalid\nLina')
  const [rot, setRot] = useState(0)
  const [spinning, setSpinning] = useState(false)
  const [winner, setWinner] = useState('')
  const timer = useRef<number | undefined>(undefined)
  const [sound, setSound] = useState(() => {
    try { return localStorage.getItem('bis-picker-sound') !== 'off' } catch { return true }
  })
  const soundRef = useRef(sound) // live mirror so ticks fired mid-spin honour a mid-spin toggle
  const audioCtx = useRef<AudioContext | null>(null)
  const raf = useRef(0)
  const wheelRef = useRef<SVGSVGElement | null>(null)

  useEffect(() => {
    soundRef.current = sound
    try { localStorage.setItem('bis-picker-sound', sound ? 'on' : 'off') } catch { /* ignore */ }
  }, [sound])

  useEffect(() => () => {
    window.clearTimeout(timer.current)
    cancelAnimationFrame(raf.current)
    audioCtx.current?.close()
  }, [])

  const options = useMemo(() => text.split('\n').map((l) => l.trim()).filter(Boolean), [text])
  const n = options.length

  function ctx(): AudioContext | null {
    if (!audioCtx.current) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!AC) return null
      audioCtx.current = new AC()
    }
    if (audioCtx.current.state === 'suspended') audioCtx.current.resume()
    return audioCtx.current
  }

  function tick(freq: number, dur: number, gain: number) {
    if (!soundRef.current) return // gate at fire-time so a mid-spin mute goes silent
    const ac = ctx()
    if (!ac) return
    const osc = ac.createOscillator()
    const g = ac.createGain()
    osc.type = 'square'
    osc.frequency.value = freq
    g.gain.setValueAtTime(0, ac.currentTime)
    g.gain.linearRampToValueAtTime(gain, ac.currentTime + 0.004)
    g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + dur)
    osc.connect(g).connect(ac.destination)
    osc.start()
    osc.stop(ac.currentTime + dur)
  }

  /** The wheel's rendered rotation in degrees, read back from the computed transform. */
  function wheelAngle(): number {
    const el = wheelRef.current
    if (!el) return 0
    const m = /matrix\(([^)]+)\)/.exec(getComputedStyle(el).transform)
    if (!m) return 0
    const [a, b] = m[1].split(',').map(Number)
    return (Math.atan2(b, a) * 180) / Math.PI
  }

  // Tick whenever the wheel's rendered rotation sweeps past another slice boundary —
  // following the real animation, so the sound can't drift from the visuals.
  function tickOnSliceCrossings(seg: number, totalDeg: number) {
    cancelAnimationFrame(raf.current)
    let last = wheelAngle()
    let traveled = 0
    const step = () => {
      const a = wheelAngle()
      let d = a - last
      if (d < -180) d += 360 // the computed angle wraps at 360; the wheel only turns forward
      last = a
      if (d > 0) {
        if (Math.floor((traveled + d) / seg) > Math.floor(traveled / seg)) tick(760, 0.05, 0.14)
        traveled += d
      }
      if (traveled < totalDeg - 0.5) raf.current = requestAnimationFrame(step)
    }
    raf.current = requestAnimationFrame(step)
  }

  function spin() {
    if (n < 2 || spinning) return
    setWinner(''); setSpinning(true)
    const idx = crypto.getRandomValues(new Uint32Array(1))[0] % n
    const seg = 360 / n
    // put segment idx centre under the top pointer: target = k*360 - (idx*seg + seg/2)
    const turns = 5
    const target = rot + turns * 360 + (360 - ((rot % 360) + idx * seg + seg / 2)) % 360 + 360
    setRot(target)
    if (sound) ctx() // unlock audio within the click gesture
    tickOnSliceCrossings(seg, target - rot)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      tick(880, 0.12, 0.16); tick(1320, 0.18, 0.12) // winner ding
      setWinner(options[idx]); setSpinning(false)
    }, 3600)
  }

  return (
    <Stack data-testid="random-picker">
      <div className="flex flex-col sm:flex-row gap-6 items-center sm:items-start">
        <div className="relative shrink-0">
          <div className="absolute left-1/2 -translate-x-1/2 -top-1 z-10 text-[1.4rem]" aria-hidden="true">▼</div>
          <svg ref={wheelRef} width={C * 2} height={C * 2} viewBox={`0 0 ${C * 2} ${C * 2}`} className="max-w-[320px] w-full h-auto"
            style={{ transform: `rotate(${rot}deg)`, transition: spinning ? 'transform 3.5s cubic-bezier(0.2,0.8,0.1,1)' : 'none' }}>
            {options.map((opt, i) => {
              const mid = ((i + 0.5) / n) * 2 * Math.PI - Math.PI / 2
              return (
                <g key={i}>
                  <path d={slice(i, n)} fill={COLORS[i % COLORS.length]} stroke="var(--paper)" strokeWidth={1.5} />
                  <text x={C + R * 0.62 * Math.cos(mid)} y={C + R * 0.62 * Math.sin(mid)} fill="#fff" fontSize={13} fontWeight={600}
                    textAnchor="middle" dominantBaseline="middle" transform={`rotate(${(mid * 180) / Math.PI + 90} ${C + R * 0.62 * Math.cos(mid)} ${C + R * 0.62 * Math.sin(mid)})`}>
                    {opt.length > 12 ? opt.slice(0, 11) + '…' : opt}
                  </text>
                </g>
              )
            })}
            <circle cx={C} cy={C} r={16} fill="var(--paper)" stroke="var(--line)" />
          </svg>
        </div>

        <div className="flex flex-col gap-3 w-full">
          <label className="flex flex-col gap-[0.4rem]"><FieldLabel>{s.input}</FieldLabel>
            <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={7} data-testid="rp-input" /></label>
          <div className="flex items-center gap-3">
            <Button variant="primary" onClick={spin} disabled={n < 2 || spinning} data-testid="rp-spin" className="flex-1">{spinning ? s.spinning : s.spin}</Button>
            <button type="button" onClick={() => { if (!sound) ctx(); setSound((v) => !v) }} aria-pressed={sound}
              aria-label={sound ? s.soundOn : s.soundOff} title={sound ? s.soundOn : s.soundOff} data-testid="rp-sound"
              className="shrink-0 self-stretch w-[3rem] grid place-items-center rounded-md border border-line bg-paper text-ink hover:bg-[color-mix(in_srgb,var(--color-green-400)_10%,transparent)] aria-pressed:text-green-700">
              {sound ? <VolumeIcon className="w-5 h-5" /> : <MuteIcon className="w-5 h-5" />}
            </button>
          </div>
          {n < 2 && <p className="text-[0.85rem] text-ink-faint">{s.need}</p>}
          {winner && (
            <div className="border border-green-500 rounded-md bg-[color-mix(in_srgb,var(--color-green-400)_14%,transparent)] p-3 text-center">
              <p className="text-[0.75rem] text-ink-faint">{s.winner}</p>
              <p className="text-[1.6rem] font-display font-bold text-green-700" data-testid="rp-result">{winner}</p>
            </div>
          )}
        </div>
      </div>
      <p className="text-[0.8rem] text-ink-faint flex items-center gap-[0.4rem]"><span aria-hidden="true">🔒</span> {s.privacy}</p>
    </Stack>
  )
}
