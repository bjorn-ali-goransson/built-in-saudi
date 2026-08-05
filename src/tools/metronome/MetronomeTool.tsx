import { useEffect, useRef, useState } from 'react'
import { useLocale } from '../../i18n'
import { Button, Input, Select, Stack, Panel, Check } from '../../components/ui'
import { VolumeIcon, MuteIcon } from '../../components/icons'
import { Scheduler, click, audioContext, closeAudio } from '../../lib/audioEngine'
import { acquireWake, releaseWake } from '../../lib/wakeLock'

const TEMPO_NAMES: [number, string, string][] = [
  [40, 'Largo', 'لارغو'], [60, 'Larghetto', 'لارغيتو'], [66, 'Adagio', 'أداجيو'],
  [76, 'Andante', 'أندانتي'], [108, 'Moderato', 'موديراتو'], [120, 'Allegro', 'أليغرو'],
  [168, 'Presto', 'بريستو'], [200, 'Prestissimo', 'بريستيسيمو'],
]

const STR = {
  en: {
    bpm: 'Tempo', beats: 'Beats per bar', subdivide: 'Subdivide',
    start: 'Start', stop: 'Stop', volume: 'Volume',
    accent: 'Accent the first beat',
    tap: 'Tap tempo', tapHint: 'Tap four or more times in rhythm.',
    sub: { 1: 'Quarter notes', 2: 'Eighths', 3: 'Triplets', 4: 'Sixteenths' } as Record<number, string>,
    bar: 'Bar', beat: 'Beat',
    drift: 'Beats are scheduled on the audio clock, not a JavaScript timer. A timer drifts by tens of milliseconds under load and stops altogether in a background tab — audible within a few bars.',
    screen: 'The screen is kept awake while it runs.',
  },
  ar: {
    bpm: 'الإيقاع', beats: 'النبضات في المازورة', subdivide: 'التقسيم',
    start: 'ابدأ', stop: 'أوقف', volume: 'الصوت',
    accent: 'شدّد النبضة الأولى',
    tap: 'انقر الإيقاع', tapHint: 'انقر أربع مرات أو أكثر على الإيقاع.',
    sub: { 1: 'نغمات ربعية', 2: 'ثمانية', 3: 'ثلاثية', 4: 'سداسية عشرة' } as Record<number, string>,
    bar: 'مازورة', beat: 'نبضة',
    drift: 'تُجدوَل النبضات على ساعة الصوت لا على مؤقّت جافاسكربت. فالمؤقّت ينحرف بعشرات الأجزاء من الثانية تحت الحمل ويتوقّف تمامًا في تبويب خلفي — وهو انحراف مسموع خلال مازورات قليلة.',
    screen: 'تبقى الشاشة مضاءة أثناء التشغيل.',
  },
}

export default function MetronomeTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const [bpm, setBpm] = useState(100)
  const [beats, setBeats] = useState(4)
  const [subdivide, setSubdivide] = useState(1)
  const [accent, setAccent] = useState(true)
  const [volume, setVolume] = useState(0.5)
  const [running, setRunning] = useState(false)
  const [current, setCurrent] = useState(0)
  const taps = useRef<number[]>([])
  const scheduler = useRef<Scheduler | null>(null)
  // Live values the scheduler reads — it runs outside React's render cycle, so
  // reading state directly would freeze it at whatever it was when started.
  const live = useRef({ bpm, beats, subdivide, accent, volume })
  live.current = { bpm, beats, subdivide, accent, volume }

  useEffect(() => () => { scheduler.current?.stop(); releaseWake(); closeAudio() }, [])

  function toggle() {
    if (running) {
      scheduler.current?.stop()
      setRunning(false)
      setCurrent(0)
      releaseWake()
      return
    }
    // Constructed here, inside the click handler, so the autoplay policy lets it run.
    audioContext()
    const sched = new Scheduler({
      interval: () => 60 / live.current.bpm / live.current.subdivide,
      onNote: (at, i) => {
        const { beats: b, subdivide: sub, accent: acc, volume: vol } = live.current
        const beatInBar = Math.floor(i / sub) % b
        const isDownbeat = beatInBar === 0 && i % sub === 0
        const isBeat = i % sub === 0
        click(at, acc && isDownbeat, isBeat ? vol : vol * 0.45)
        // The visual follows the audio clock rather than the timer, so the dot
        // and the sound stay together.
        const delay = Math.max(0, (at - audioContext().currentTime) * 1000)
        window.setTimeout(() => setCurrent(beatInBar), delay)
      },
    })
    scheduler.current = sched
    sched.start()
    setRunning(true)
    acquireWake()
  }

  function tap() {
    const now = performance.now()
    // A long gap means a new attempt, not a very slow tempo.
    if (taps.current.length && now - taps.current[taps.current.length - 1] > 2000) taps.current = []
    taps.current.push(now)
    if (taps.current.length > 6) taps.current.shift()
    if (taps.current.length >= 4) {
      const gaps = taps.current.slice(1).map((t, i) => t - taps.current[i])
      const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length
      const next = Math.round(60000 / mean)
      if (next >= 30 && next <= 300) setBpm(next)
    }
  }

  const tempoName = [...TEMPO_NAMES].reverse().find(([t]) => bpm >= t)

  return (
    <Stack data-testid="metronome">
      <div className="flex flex-col items-center gap-3">
        <span className="font-display text-[clamp(3rem,14vw,5rem)] leading-none text-ink font-mono" data-testid="mt-bpm">{bpm}</span>
        <span className="text-[0.9rem] text-ink-faint rtl:font-ar" data-testid="mt-name">
          {s.bpm} · {tempoName ? (locale === 'ar' ? tempoName[2] : tempoName[1]) : ''}
        </span>
        <Input type="range" min={30} max={300} step={1} className="w-full max-w-[28rem] p-0" data-testid="mt-slider"
          value={bpm} onChange={(e) => setBpm(+e.target.value)} />
        <div className="flex flex-wrap items-center justify-center gap-2">
          {[-5, -1, 1, 5].map((d) => (
            <Button key={d} className="px-3 py-1 font-mono" data-testid={`mt-adj-${d}`}
              onClick={() => setBpm((b) => Math.max(30, Math.min(300, b + d)))}>
              {d > 0 ? `+${d}` : d}
            </Button>
          ))}
          <Button className="px-3 py-1" onClick={tap} data-testid="mt-tap">{s.tap}</Button>
        </div>
        <span className="text-[0.8rem] text-ink-faint rtl:font-ar">{s.tapHint}</span>
      </div>

      <div className="flex justify-center gap-2" data-testid="mt-beats">
        {Array.from({ length: beats }, (_, i) => (
          <span key={i} data-testid={`mt-dot-${i}`}
            className={`size-4 rounded-full border-2 transition-colors ${
              running && current === i
                ? (i === 0 && accent ? 'bg-gold-500 border-gold-500' : 'bg-green-600 border-green-600')
                : 'border-[color:var(--line)]'
            }`} />
        ))}
      </div>

      <div className="flex flex-wrap items-end justify-center gap-3">
        <label className="flex flex-col gap-1 text-[0.8rem] text-ink-faint">
          {s.beats}
          <Select className="w-20" data-testid="mt-meter" value={beats} onChange={(e) => setBeats(+e.target.value)}>
            {[2, 3, 4, 5, 6, 7, 8, 9, 12].map((n) => <option key={n} value={n}>{n}</option>)}
          </Select>
        </label>
        <label className="flex flex-col gap-1 text-[0.8rem] text-ink-faint">
          {s.subdivide}
          <Select className="min-w-[10rem]" data-testid="mt-sub" value={subdivide} onChange={(e) => setSubdivide(+e.target.value)}>
            {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{s.sub[n]}</option>)}
          </Select>
        </label>
        <label className="flex items-center gap-2 text-[0.8rem] text-ink-faint">
          {s.volume}
          <Input type="range" min={0} max={1} step={0.05} className="w-28 p-0" data-testid="mt-volume"
            value={volume} onChange={(e) => setVolume(+e.target.value)} />
        </label>
        <Check>
          <input type="checkbox" checked={accent} data-testid="mt-accent" onChange={(e) => setAccent(e.target.checked)} /> {s.accent}
        </Check>
      </div>

      <Button variant="primary" className="self-center px-8" onClick={toggle} data-testid="mt-toggle">
        {running ? <><MuteIcon /> {s.stop}</> : <><VolumeIcon /> {s.start}</>}
      </Button>

      <Panel className="flex flex-col gap-1">
        <p className="text-[0.85rem] text-ink-soft rtl:font-ar">{s.drift}</p>
        <p className="text-[0.85rem] text-ink-faint rtl:font-ar">{s.screen}</p>
      </Panel>
    </Stack>
  )
}
