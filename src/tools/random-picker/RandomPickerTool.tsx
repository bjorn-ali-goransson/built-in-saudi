import { useEffect, useMemo, useState } from 'react'
import { useLocale } from '../../i18n'
import { Stack, Textarea, Button, FieldLabel } from '../../components/ui'
import { VolumeIcon, MuteIcon } from '../../components/icons'
import { SpinSound } from './audio'
import { useSpinWheel } from './useSpinWheel'
import { Wheel } from './Wheel'

const STR = {
  en: { input: 'Options (one per line)', spin: 'Spin', spinning: 'Spinning…', winner: 'Winner', need: 'Add at least two options.', privacy: 'Runs in your browser — nothing is uploaded.', sound: 'Sound', soundOn: 'Sound on', soundOff: 'Sound off' },
  ar: { input: 'الخيارات (خيار في كل سطر)', spin: 'أدِر', spinning: 'يدور…', winner: 'الفائز', need: 'أضف خيارين على الأقل.', privacy: 'يعمل في متصفحك — لا يُرفع أي شيء.', sound: 'الصوت', soundOn: 'الصوت مفعّل', soundOff: 'الصوت متوقف' },
}

export default function RandomPickerTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const [text, setText] = useState('Sara\nOmar\nFahad\nNoura\nKhalid\nLina')
  const [snd] = useState(() => new SpinSound())
  const [sound, setSound] = useState(() => {
    try { return localStorage.getItem('bis-picker-sound') !== 'off' } catch { return true }
  })
  const options = useMemo(() => text.split('\n').map((l) => l.trim()).filter(Boolean), [text])
  const n = options.length
  const { rot, spinning, winner, wheelRef, spin } = useSpinWheel(options, snd)

  useEffect(() => {
    snd.enabled = sound
    try { localStorage.setItem('bis-picker-sound', sound ? 'on' : 'off') } catch { /* ignore */ }
  }, [snd, sound])
  useEffect(() => () => snd.close(), [snd])

  function toggleSound() {
    const next = !sound
    snd.enabled = next // before the effect runs — a mid-spin tick may fire first
    if (next) snd.prime() // create/resume inside the click gesture
    setSound(next)
  }

  return (
    <Stack data-testid="random-picker">
      <div className="flex flex-col sm:flex-row gap-6 items-center sm:items-start">
        <Wheel options={options} rot={rot} spinning={spinning} svgRef={wheelRef} />

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
