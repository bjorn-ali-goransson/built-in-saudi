import { useMemo, useRef, useState } from 'react'
import { useLocale } from '../../i18n'
import { Stack, Textarea, Button, FieldLabel } from '../../components/ui'
import { VolumeIcon, MuteIcon } from '../../components/icons'
import { useSpinSound } from './spinSound'

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
  const wheelRef = useRef<SVGSVGElement | null>(null)
  const { snd, sound, toggle: toggleSound } = useSpinSound()

  const options = useMemo(() => text.split('\n').map((l) => l.trim()).filter(Boolean), [text])
  const n = options.length

  function spin() {
    if (n < 2 || spinning) return
    setWinner(''); setSpinning(true)
    const idx = crypto.getRandomValues(new Uint32Array(1))[0] % n
    const seg = 360 / n
    // put segment idx centre under the top pointer: target = k*360 - (idx*seg + seg/2)
    const turns = 5
    const target = rot + turns * 360 + (360 - ((rot % 360) + idx * seg + seg / 2)) % 360 + 360
    setRot(target)
    snd.unlock() // unlock audio within the click gesture
    snd.followSpin(wheelRef.current, seg, target - rot)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => { snd.ding(); setWinner(options[idx]); setSpinning(false) }, 3600)
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
            <button type="button" onClick={toggleSound} aria-pressed={sound}
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
