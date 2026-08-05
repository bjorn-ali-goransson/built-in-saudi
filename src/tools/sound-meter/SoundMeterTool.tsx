import { useEffect, useRef, useState } from 'react'
import { useLocale } from '../../i18n'
import { Button, Stack, Panel, Disclaimer } from '../../components/ui'
import { MicIcon, MicOffIcon } from '../../components/icons'
import { openMic, levels, closeAudio, type MicStream } from '../../lib/audioEngine'

// A browser cannot measure absolute sound pressure. It has no idea what
// microphone it is behind, what gain the OS applied, or how that mic responds
// across the spectrum — a calibrated meter costs real money precisely because
// those things must be known. What this CAN do honestly is show relative level
// and a rough reference band, and say plainly that it is not decibels-SPL.

interface Band { max: number; en: string; ar: string; tone: string }

const BANDS: Band[] = [
  { max: -50, en: 'Very quiet — a still room', ar: 'هادئ جدًا — غرفة ساكنة', tone: 'text-green-700' },
  { max: -35, en: 'Quiet — soft conversation', ar: 'هادئ — حديث خافت', tone: 'text-green-700' },
  { max: -22, en: 'Moderate — normal speech', ar: 'معتدل — كلام عادي', tone: 'text-ink' },
  { max: -12, en: 'Loud — raised voices, traffic', ar: 'مرتفع — أصوات عالية، حركة مرور', tone: 'text-gold-500' },
  { max: 0, en: 'Very loud — the microphone is close to clipping', ar: 'مرتفع جدًا — يقارب الميكروفون التشبّع', tone: 'text-gold-500' },
]

const STR = {
  en: {
    start: 'Start', stop: 'Stop',
    denied: 'The microphone was not allowed. Nothing is recorded or sent anywhere — the audio never leaves this page — but the meter cannot work without it.',
    unsupported: 'This browser will not give a page microphone access.',
    level: 'Level', peak: 'Peak', average: 'Average', loudest: 'Loudest so far',
    reset: 'Reset the peak',
    clipping: 'Clipping — the signal is hitting the top of the range and detail is being lost.',
    hint: 'A live level meter using your microphone. It shows relative loudness, not calibrated decibels — see below for why that distinction matters.',
    notSpl: 'This is NOT a sound level meter in the regulatory sense and must not be used to judge whether a workplace is safe or a noise complaint is justified. A browser cannot know which microphone it is behind, what gain the operating system applied, or how that microphone responds across the spectrum — and all three are required for an absolute reading. Those numbers come from a calibrated instrument.',
    useful: 'What it is good for: comparing two rooms, finding which appliance is the loud one, checking a microphone is picking you up, or watching a level while you set a gain.',
    dbfs: 'dBFS — relative to the maximum the microphone can capture, so 0 is the ceiling and everything real is negative.',
  },
  ar: {
    start: 'ابدأ', stop: 'أوقف',
    denied: 'لم يُسمح باستخدام الميكروفون. لا يُسجَّل شيء ولا يُرسل إلى أي مكان — فالصوت لا يغادر هذه الصفحة — لكن المقياس لا يعمل بدونه.',
    unsupported: 'هذا المتصفح لا يمنح الصفحات وصولًا إلى الميكروفون.',
    level: 'المستوى', peak: 'الذروة', average: 'المتوسط', loudest: 'الأعلى حتى الآن',
    reset: 'صفّر الذروة',
    clipping: 'تشبّع — تبلغ الإشارة أعلى المدى وتضيع التفاصيل.',
    hint: 'مقياس مستوى حي عبر الميكروفون. يعرض الجهارة النسبية لا الديسيبل المعاير — وأدناه لماذا يهم هذا الفرق.',
    notSpl: 'هذا ليس مقياس شدة صوت بالمعنى النظامي، ولا يجوز استخدامه للحكم على سلامة بيئة عمل أو صحة شكوى ضوضاء. فالمتصفح لا يعرف أي ميكروفون خلفه، ولا الكسب الذي طبّقه نظام التشغيل، ولا استجابة ذلك الميكروفون عبر الطيف — والثلاثة لازمة لأي قراءة مطلقة. تلك الأرقام تأتي من جهاز معاير.',
    useful: 'ما ينفع له: مقارنة غرفتين، ومعرفة أي جهاز هو مصدر الضجيج، والتأكد من أن الميكروفون يلتقطك، ومراقبة المستوى أثناء ضبط الكسب.',
    dbfs: 'dBFS — نسبةً إلى أقصى ما يلتقطه الميكروفون، فالصفر هو السقف وكل ما هو حقيقي سالب.',
  },
}

export default function SoundMeterTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const [on, setOn] = useState(false)
  const [error, setError] = useState('')
  const [rms, setRms] = useState(-Infinity)
  const [peak, setPeak] = useState(-Infinity)
  const [maxSeen, setMaxSeen] = useState(-Infinity)
  const mic = useRef<MicStream | null>(null)
  const raf = useRef(0)
  const history = useRef<number[]>([])
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => () => { stop() }, [])

  function stop() {
    cancelAnimationFrame(raf.current)
    mic.current?.stop()
    mic.current = null
    closeAudio()
    setOn(false)
  }

  async function start() {
    setError('')
    if (!navigator.mediaDevices?.getUserMedia) { setError(s.unsupported); return }
    try {
      const stream = await openMic(2048)
      mic.current = stream
      setOn(true)
      history.current = []
      const buf = new Float32Array(stream.analyser.fftSize)
      const loop = () => {
        stream.analyser.getFloatTimeDomainData(buf)
        const l = levels(buf)
        setRms(l.rms)
        setPeak(l.peak)
        setMaxSeen((m) => Math.max(m, l.peak))
        history.current.push(l.rms)
        if (history.current.length > 240) history.current.shift()
        draw()
        raf.current = requestAnimationFrame(loop)
      }
      loop()
    } catch {
      setError(s.denied)
    }
  }

  function draw() {
    const canvas = canvasRef.current
    if (!canvas) return
    const w = canvas.clientWidth
    const h = 90
    const dpr = window.devicePixelRatio || 1
    canvas.width = w * dpr
    canvas.height = h * dpr
    const ctx = canvas.getContext('2d')!
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, w, h)
    const styles = getComputedStyle(canvas)
    const accent = styles.getPropertyValue('--primary').trim() || '#1f5c3d'
    // -70 dBFS at the floor, 0 at the ceiling.
    const y = (db: number) => h - ((Math.max(-70, Math.min(0, db)) + 70) / 70) * h
    ctx.strokeStyle = accent
    ctx.lineWidth = 1.5
    ctx.beginPath()
    history.current.forEach((db, i) => {
      const x = (i / 240) * w
      if (i === 0) ctx.moveTo(x, y(db)); else ctx.lineTo(x, y(db))
    })
    ctx.stroke()
  }

  const band = BANDS.find((b) => rms <= b.max) ?? BANDS[BANDS.length - 1]
  const clipping = peak > -0.5
  const fmt = (db: number) => (Number.isFinite(db) ? db.toFixed(1) : '—')
  // Map -70…0 onto a 0…100 bar, which is what a level meter reads like.
  const pct = Number.isFinite(rms) ? Math.max(0, Math.min(100, ((rms + 70) / 70) * 100)) : 0

  return (
    <Stack data-testid="sound-meter">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant={on ? 'default' : 'primary'} onClick={on ? stop : start} data-testid="sm-toggle">
          {on ? <><MicOffIcon /> {s.stop}</> : <><MicIcon /> {s.start}</>}
        </Button>
        {on && <Button className="px-3 py-1" onClick={() => setMaxSeen(-Infinity)} data-testid="sm-reset">{s.reset}</Button>}
      </div>

      {error && <p className="text-[0.95rem] text-gold-500 rtl:font-ar" data-testid="sm-error">{error}</p>}
      {!on && !error && <p className="text-ink-faint text-[0.95rem] rtl:font-ar">{s.hint}</p>}

      {on && (
        <>
          <div className="flex flex-col items-center gap-2">
            <span className="font-display text-[clamp(2.5rem,12vw,4rem)] leading-none text-ink font-mono" data-testid="sm-rms">
              {fmt(rms)}
            </span>
            <span className="text-[0.8rem] text-ink-faint font-mono">dBFS</span>
            <span className={`text-[1rem] rtl:font-ar ${band.tone}`} data-testid="sm-band">
              {locale === 'ar' ? band.ar : band.en}
            </span>
          </div>

          <div className="w-full h-4 rounded-full bg-[color-mix(in_srgb,var(--color-ink)_10%,transparent)] overflow-hidden" data-testid="sm-bar">
            <div className={`h-full transition-[width] duration-75 ${clipping ? 'bg-gold-500' : 'bg-green-600'}`}
              style={{ width: `${pct}%` }} />
          </div>

          <canvas ref={canvasRef} data-testid="sm-graph" className="w-full h-[90px] border border-[color:var(--line)] rounded-md bg-[var(--surface)]" />

          <dl className="flex flex-wrap gap-x-8 gap-y-1 text-[0.9rem] [&_dt]:text-ink-faint [&_dd]:text-ink [&_dd]:font-mono">
            <div className="flex gap-2"><dt className="rtl:font-ar">{s.peak}</dt><dd data-testid="sm-peak">{fmt(peak)}</dd></div>
            <div className="flex gap-2"><dt className="rtl:font-ar">{s.loudest}</dt><dd data-testid="sm-max">{fmt(maxSeen)}</dd></div>
          </dl>

          {clipping && <p className="text-[0.9rem] text-gold-500 rtl:font-ar" data-testid="sm-clipping">{s.clipping}</p>}
          <p className="text-[0.82rem] text-ink-faint rtl:font-ar">{s.dbfs}</p>
        </>
      )}

      <Disclaimer kind="official" locale={locale}>{s.notSpl}</Disclaimer>
      <Panel><p className="text-[0.85rem] text-ink-soft rtl:font-ar">{s.useful}</p></Panel>
    </Stack>
  )
}
