import { useEffect, useRef, useState } from 'react'
import { useLocale } from '../../i18n'
import { Button, Input, Select, Stack, Panel } from '../../components/ui'
import { MicIcon, MicOffIcon } from '../../components/icons'
import { openMic, detectPitch, toNote, noteFrequency, closeAudio, audioContext, type MicStream } from '../../lib/audioEngine'

// Common tunings, because "what note is this" is rarely the real question —
// "is my third string right" is.
const TUNINGS: { id: string; en: string; ar: string; notes: number[] }[] = [
  { id: 'chromatic', en: 'Chromatic (any note)', ar: 'كروماتي (أي نغمة)', notes: [] },
  { id: 'guitar', en: 'Guitar — E A D G B E', ar: 'جيتار — E A D G B E', notes: [40, 45, 50, 55, 59, 64] },
  { id: 'bass', en: 'Bass — E A D G', ar: 'باص — E A D G', notes: [28, 33, 38, 43] },
  { id: 'ukulele', en: 'Ukulele — G C E A', ar: 'يوكوليلي — G C E A', notes: [67, 60, 64, 69] },
  { id: 'oud', en: 'Oud — C F A D G C', ar: 'عود — دو فا لا ري صول دو', notes: [48, 53, 57, 62, 67, 72] },
  { id: 'violin', en: 'Violin — G D A E', ar: 'كمان — G D A E', notes: [55, 62, 69, 76] },
]

const STR = {
  en: {
    start: 'Start listening', stop: 'Stop', listening: 'Listening…',
    denied: 'The microphone was not allowed. Nothing is recorded or sent anywhere — the audio never leaves this page — but the tuner cannot work without it.',
    unsupported: 'This browser will not give a page microphone access.',
    quiet: 'Play a note.',
    tuning: 'Tuning', reference: 'Reference pitch',
    flat: 'flat', sharp: 'sharp', inTune: 'In tune',
    cents: 'cents', target: 'Target',
    hint: 'Point your instrument at the microphone. The audio is analysed in this page and never leaves it — there is no recording and no upload.',
    method: 'Pitch is found by autocorrelation rather than by picking the loudest peak in a spectrum. On a guitar or an oud the loudest partial is often the second harmonic, so a peak-picking tuner reads the low E an octave high.',
    a4: 'A4',
    a4hint: 'Not every ensemble tunes to 440 Hz — some orchestras use 442, and older instruments lower still.',
  },
  ar: {
    start: 'ابدأ الاستماع', stop: 'أوقف', listening: 'ينصت…',
    denied: 'لم يُسمح باستخدام الميكروفون. لا يُسجَّل شيء ولا يُرسل إلى أي مكان — فالصوت لا يغادر هذه الصفحة — لكن الموالف لا يعمل بدونه.',
    unsupported: 'هذا المتصفح لا يمنح الصفحات وصولًا إلى الميكروفون.',
    quiet: 'اعزف نغمة.',
    tuning: 'الدوزان', reference: 'النغمة المرجعية',
    flat: 'منخفضة', sharp: 'مرتفعة', inTune: 'مضبوطة',
    cents: 'سنت', target: 'الهدف',
    hint: 'وجّه آلتك نحو الميكروفون. يُحلَّل الصوت داخل هذه الصفحة ولا يغادرها — لا تسجيل ولا رفع.',
    method: 'تُستخرج النغمة بالارتباط الذاتي لا باختيار أعلى قمة في الطيف. ففي الجيتار أو العود يكون أعلى تردد جزئي هو التوافقي الثاني غالبًا، فيقرأ الموالف القائم على القمم وتر E المنخفض أوكتافًا أعلى.',
    a4: 'لا٤',
    a4hint: 'ليست كل الفرق تضبط على ٤٤٠ هرتز — فبعض الأوركسترات تستخدم ٤٤٢، والآلات القديمة أقل.',
  },
}

export default function TunerTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const [on, setOn] = useState(false)
  const [error, setError] = useState('')
  const [freq, setFreq] = useState<number | null>(null)
  const [tuning, setTuning] = useState('guitar')
  const [a4, setA4] = useState(440)
  const mic = useRef<MicStream | null>(null)
  const raf = useRef(0)
  const a4Ref = useRef(a4)
  a4Ref.current = a4

  useEffect(() => () => { stop() }, [])

  function stop() {
    cancelAnimationFrame(raf.current)
    mic.current?.stop()
    mic.current = null
    closeAudio()
    setOn(false)
    setFreq(null)
  }

  async function start() {
    setError('')
    if (!navigator.mediaDevices?.getUserMedia) { setError(s.unsupported); return }
    try {
      const stream = await openMic(2048)
      mic.current = stream
      setOn(true)
      const buf = new Float32Array(stream.analyser.fftSize)
      const loop = () => {
        stream.analyser.getFloatTimeDomainData(buf)
        setFreq(detectPitch(buf, audioContext().sampleRate))
        raf.current = requestAnimationFrame(loop)
      }
      loop()
    } catch {
      setError(s.denied)
    }
  }

  const note = freq ? toNote(freq, a4) : null
  const strings = TUNINGS.find((t) => t.id === tuning)?.notes ?? []
  // With a tuning selected, snap to the nearest STRING rather than the nearest
  // semitone — that is the question being asked, and it stops a badly flat
  // string reading as its neighbour.
  const targetMidi = note && strings.length
    ? strings.reduce((best, m) => (Math.abs(m - note.midi) < Math.abs(best - note.midi) ? m : best), strings[0])
    : note?.midi ?? null
  const cents = freq && targetMidi !== null
    ? Math.round(1200 * Math.log2(freq / noteFrequency(targetMidi, a4)))
    : null
  const display = targetMidi !== null ? toNote(noteFrequency(targetMidi, a4), a4) : null
  const inTune = cents !== null && Math.abs(cents) <= 5

  return (
    <Stack data-testid="tuner">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-[0.8rem] text-ink-faint">
          {s.tuning}
          <Select className="min-w-[14rem]" data-testid="tu-tuning" value={tuning} onChange={(e) => setTuning(e.target.value)}>
            {TUNINGS.map((t) => <option key={t.id} value={t.id}>{locale === 'ar' ? t.ar : t.en}</option>)}
          </Select>
        </label>
        <label className="flex flex-col gap-1 text-[0.8rem] text-ink-faint">
          {s.reference} ({s.a4})
          <Input type="number" min={415} max={466} dir="ltr" className="w-24 font-mono" data-testid="tu-a4"
            value={a4} onChange={(e) => setA4(Math.max(415, Math.min(466, +e.target.value || 440)))} />
        </label>
        <Button variant={on ? 'default' : 'primary'} onClick={on ? stop : start} data-testid="tu-toggle">
          {on ? <><MicOffIcon /> {s.stop}</> : <><MicIcon /> {s.start}</>}
        </Button>
      </div>

      {error && <p className="text-[0.95rem] text-gold-500 rtl:font-ar" data-testid="tu-error">{error}</p>}
      {!on && !error && <p className="text-ink-faint text-[0.95rem] rtl:font-ar">{s.hint}</p>}

      {on && (
        <div className="flex flex-col items-center gap-4 py-4">
          {!note ? (
            <span className="text-[1.1rem] text-ink-faint rtl:font-ar" data-testid="tu-quiet">{s.quiet}</span>
          ) : (
            <>
              <span className={`font-display text-[clamp(3.5rem,16vw,6rem)] leading-none ${inTune ? 'text-green-700' : 'text-ink'}`}
                data-testid="tu-note">
                {display!.name}<span className="text-[0.35em] text-ink-faint">{display!.octave}</span>
              </span>
              <span className="font-mono text-[0.95rem] text-ink-faint" data-testid="tu-freq">
                {freq!.toFixed(1)} Hz · {s.target} {noteFrequency(targetMidi!, a4).toFixed(1)} Hz
              </span>

              {/* A needle rather than a number: you tune by watching it centre. */}
              <div className="relative w-full max-w-[26rem] h-14" data-testid="tu-meter">
                <div className="absolute inset-x-0 top-1/2 h-[2px] bg-[color:var(--line)]" />
                <div className="absolute left-1/2 top-2 bottom-2 w-[2px] -translate-x-1/2 bg-green-600" />
                {[-50, -25, 25, 50].map((c) => (
                  <div key={c} className="absolute top-4 bottom-4 w-px bg-[color:var(--line)]"
                    style={{ left: `${50 + c}%` }} />
                ))}
                <div
                  className={`absolute top-0 bottom-0 w-1 rounded-full transition-[left] duration-75 ${inTune ? 'bg-green-600' : 'bg-gold-500'}`}
                  style={{ left: `calc(${50 + Math.max(-50, Math.min(50, cents ?? 0))}% - 2px)` }}
                />
              </div>

              <span className={`text-[1.1rem] font-semibold rtl:font-ar ${inTune ? 'text-green-700' : 'text-gold-500'}`}
                data-testid="tu-cents">
                {inTune ? s.inTune : `${Math.abs(cents!)} ${s.cents} ${cents! < 0 ? s.flat : s.sharp}`}
              </span>
            </>
          )}
        </div>
      )}

      <Panel className="flex flex-col gap-1">
        <p className="text-[0.85rem] text-ink-soft rtl:font-ar">{s.method}</p>
        <p className="text-[0.85rem] text-ink-faint rtl:font-ar">{s.a4hint}</p>
      </Panel>
    </Stack>
  )
}
