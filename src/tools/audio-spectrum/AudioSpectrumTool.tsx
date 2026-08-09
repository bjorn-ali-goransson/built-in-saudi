import { useEffect, useRef, useState } from 'react'
import { useLocale } from '../../i18n'
import { Stack, Panel, FileError, Spinner } from '../../components/ui'
import { UploadIcon } from '../../components/icons'
import { setWorkInProgress } from '../../lib/workInProgress'
import { decodeAudio, formatTime } from '../../lib/audio'
import { verdict } from './fft'
import type { SpectrumRequest, SpectrumResponse } from './spectrum.worker'

const WIP = 'audio-spectrum'
const COLUMNS = 900

const STR = {
  en: {
    intro: 'See what is actually in an audio file. A lossy encoder throws away everything above a cutoff, and that cutoff is visible — so a file “converted to 320” from a 128 source shows a wall at 16 kHz and is not what it says it is. Decoded in your browser; nothing is uploaded.',
    pick: 'Choose an audio or video file',
    reading: 'Decoding…', analysing: 'Analysing…',
    another: 'Choose another',
    cutoff: 'Content stops at', duration: 'Length', rate: 'Decoded at',
    verdicts: {
      lossless: 'Runs to 20 kHz or beyond — consistent with lossless, or with a high-bitrate encode that kept everything.',
      high: 'A wall around 19 kHz — the signature of a high-bitrate lossy encode, roughly 192–320 kbps.',
      medium: 'A wall around 17–18 kHz — consistent with a middling lossy encode.',
      low: 'A wall below 17 kHz — the signature of a low-bitrate encode. If this file claims a high bitrate, it was re-encoded from a smaller one and the detail is gone for good.',
      unknown: 'No usable signal found.',
    } as Record<string, string>,
    rateNote: 'The browser resamples as it decodes, so “decoded at” is the rate it handed us and not necessarily the file’s — a 22 kHz file reads 44.1 here. The cutoff is unaffected: a 22 kHz source has nothing above 11 kHz to find, and the picture shows exactly that.',
    honest: 'The measurement is exact; the inference is not. A recording with no high-frequency content of its own — speech, a bass line, an old tape — has a low cutoff and was never lossy. What the picture rules out is a file claiming detail it does not contain.',
    axis: 'kHz',
    sampled: (n: number) => `Sampled at ${n} points across the file, not every frame — enough to see the shape, and fast enough to be worth waiting for.`,
    error: 'That file could not be decoded as audio.',
  },
  ar: {
    intro: 'انظر ما في ملفك الصوتي فعلًا. يتخلّص الترميز الضائع من كل شيء فوق حدّ معيّن، وهذا الحدّ مرئي — فالملف «المحوَّل إلى ٣٢٠» من مصدر ١٢٨ يُظهر جدارًا عند ١٦ كيلوهرتز وليس ما يدّعيه. يُفكّ الترميز في متصفحك؛ ولا يُرفع شيء.',
    pick: 'اختر ملفًا صوتيًا أو مرئيًا',
    reading: 'جارٍ فك الترميز…', analysing: 'جارٍ التحليل…',
    another: 'اختر آخر',
    cutoff: 'ينتهي المحتوى عند', duration: 'المدة', rate: 'فُكّ عند',
    verdicts: {
      lossless: 'يمتد إلى ٢٠ كيلوهرتز أو أبعد — وهذا يوافق ملفًا غير ضائع، أو ترميزًا عالي المعدل حفظ كل شيء.',
      high: 'جدار عند نحو ١٩ كيلوهرتز — بصمة ترميز ضائع عالي المعدل، من ١٩٢ إلى ٣٢٠ كيلوبت تقريبًا.',
      medium: 'جدار عند نحو ١٧–١٨ كيلوهرتز — يوافق ترميزًا ضائعًا متوسطًا.',
      low: 'جدار دون ١٧ كيلوهرتز — بصمة ترميز منخفض المعدل. وإن ادّعى هذا الملف معدلًا عاليًا فقد أُعيد ترميزه من ملف أصغر، والتفاصيل ذهبت بلا رجعة.',
      unknown: 'لم يُعثر على إشارة صالحة.',
    } as Record<string, string>,
    rateNote: 'يعيد المتصفح تشكيل العينات أثناء فك الترميز، فـ«فُكّ عند» هو المعدل الذي سلّمنا إياه لا معدل الملف بالضرورة — فملف ٢٢ كيلوهرتز يظهر هنا ٤٤٫١. ولا يتأثر الحدّ بذلك: فمصدر ٢٢ كيلوهرتز لا شيء فوق ١١ كيلوهرتز فيه أصلًا، والصورة تُظهر ذلك تمامًا.',
    honest: 'القياس دقيق، أما الاستنتاج فلا. فالتسجيل الذي لا يحوي ترددات عالية أصلًا — كلام أو خط باص أو شريط قديم — حدّه منخفض ولم يكن ضائعًا قط. وما تنفيه الصورة هو ادّعاء ملفٍ تفاصيلَ لا يحويها.',
    axis: 'كيلوهرتز',
    sampled: (n: number) => `أُخذت العيّنات عند ${n} نقطة عبر الملف لا عند كل إطار — بما يكفي لرؤية الشكل، وبسرعة تستحق الانتظار.`,
    error: 'تعذّر فك ترميز هذا الملف كصوت.',
  },
}

export default function AudioSpectrumTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const [busy, setBusy] = useState<'' | 'read' | 'run'>('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState<{ cutoff: number; duration: number; rate: number } | null>(null)
  const [result, setResult] = useState<SpectrumResponse | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const workerRef = useRef<Worker | null>(null)
  const reqRef = useRef(0)

  useEffect(() => {
    const w = new Worker(new URL('./spectrum.worker.ts', import.meta.url), { type: 'module' })
    workerRef.current = w
    return () => { w.terminate() }
  }, [])
  useEffect(() => () => { setWorkInProgress(WIP, false) }, [])

  // Drawn from an EFFECT, not from the worker callback. The canvas only
  // exists once `info` is set, so painting it in the callback found
  // `canvasRef.current` null and returned — the numbers appeared and the
  // picture never did. Caught by a spec that asked whether the canvas had
  // any range in it at all; one that merely checked the canvas existed
  // would have passed.
  useEffect(() => {
    if (!result) return
    const r = result
    const c = canvasRef.current
    if (!c) return
    c.width = r.columns
    c.height = r.bins
    const ctx = c.getContext('2d')
    if (!ctx) return
    const img = ctx.createImageData(r.columns, r.bins)
    for (let x = 0; x < r.columns; x++) {
      for (let y = 0; y < r.bins; y++) {
        // Rows run bottom-up: bin 0 is DC and belongs at the FOOT of the
        // picture, which is how every spectrogram anyone has seen is drawn.
        const db = r.image[x * r.bins + y]
        const t = Math.max(0, Math.min(1, (db + 100) / 100))
        const i = ((r.bins - 1 - y) * r.columns + x) * 4
        // Dark green through brass — the site's own palette rather than the
        // usual rainbow, which is also a poor perceptual ramp.
        img.data[i] = Math.round(20 + t * 215)
        img.data[i + 1] = Math.round(30 + t * 150)
        img.data[i + 2] = Math.round(35 + t * 60)
        img.data[i + 3] = 255
      }
    }
    ctx.putImageData(img, 0, 0)
  }, [result])

  async function pick(f: File | undefined) {
    if (!f) return
    setError(''); setInfo(null); setResult(null); setBusy('read')
    try {
      const d = await decodeAudio(f)
      setWorkInProgress(WIP, true)
      setBusy('run')
      // Downmix: a spectrogram of one channel is a spectrogram of half the file,
      // and a lossy cutoff is the same in both anyway.
      const n = d.channels[0]?.length ?? 0
      const mono = new Float32Array(n)
      for (const data of d.channels) {
        for (let i = 0; i < n; i++) mono[i] += data[i] / d.channels.length
      }
      const w = workerRef.current
      if (!w) return
      const id = ++reqRef.current
      const onMessage = (ev: MessageEvent<SpectrumResponse>) => {
        if (ev.data.id !== reqRef.current) return
        w.removeEventListener('message', onMessage)
        setResult(ev.data)
        setInfo({ cutoff: ev.data.cutoff, duration: d.duration, rate: d.sampleRate })
        setBusy('')
      }
      w.addEventListener('message', onMessage)
      const req: SpectrumRequest = { id, samples: mono, sampleRate: d.sampleRate, columns: COLUMNS }
      w.postMessage(req, [mono.buffer])
    } catch {
      setError(s.error); setBusy('')
    }
  }

  const v = info ? verdict(info.cutoff) : null

  return (
    <Stack data-testid="audio-spectrum">
      <p className="text-[0.95rem] text-ink-soft rtl:font-ar">{s.intro}</p>

      <label className="inline-flex items-center gap-2 self-start px-[1.15rem] py-[0.7rem] rounded-md border border-green-700 bg-green-600 text-[color:var(--primary-ink)] font-semibold text-[0.95rem] cursor-pointer">
        <UploadIcon /> {info ? s.another : s.pick}
        {/* No accept filter — Android's picker hides files it has not indexed. */}
        <input type="file" className="hidden" data-testid="as-file" onChange={(e) => { void pick(e.target.files?.[0]) }} />
      </label>

      {busy && (
        <p className="flex items-center gap-2 text-ink-faint rtl:font-ar" data-testid="as-busy">
          <Spinner /> {busy === 'read' ? s.reading : s.analysing}
        </p>
      )}
      {error && <FileError message={error} />}

      {info && v && (
        <>
          <div className="relative">
            <canvas ref={canvasRef} data-testid="as-canvas"
              className="w-full h-[320px] rounded-md border border-[color:var(--line)] bg-[#141e1a]" />
            {/* The axis is the whole point: a wall means nothing without a
                number beside it. */}
            <div className="pointer-events-none absolute inset-y-0 end-1 flex flex-col justify-between py-1 text-[0.65rem] font-mono text-sand-100/70">
              {[20, 15, 10, 5, 0].map((k) => <span key={k}>{k}</span>)}
            </div>
          </div>

          <Panel className="gap-2">
            <div className="flex flex-wrap gap-x-8 gap-y-3">
              <div>
                <div className="text-[0.7rem] uppercase tracking-[0.05em] text-ink-faint rtl:font-ar">{s.cutoff}</div>
                <div className="font-mono text-[1.6rem] font-semibold text-green-700" data-testid="as-cutoff">
                  {(info.cutoff / 1000).toFixed(1)} {s.axis}
                </div>
              </div>
              <div>
                <div className="text-[0.7rem] uppercase tracking-[0.05em] text-ink-faint rtl:font-ar">{s.duration}</div>
                <div className="font-mono text-[1.2rem] text-ink" data-testid="as-duration">{formatTime(info.duration)}</div>
              </div>
              <div>
                <div className="text-[0.7rem] uppercase tracking-[0.05em] text-ink-faint rtl:font-ar">{s.rate}</div>
                <div className="font-mono text-[1.2rem] text-ink-soft" data-testid="as-rate">{(info.rate / 1000).toFixed(1)} kHz</div>
              </div>
            </div>
            <p className="text-[0.95rem] text-ink rtl:font-ar" data-testid="as-verdict">{s.verdicts[v.key]}</p>
          </Panel>

          <Panel className="gap-2">
            <p className="text-[0.85rem] text-ink-soft rtl:font-ar" data-testid="as-honest">{s.honest}</p>
            <p className="text-[0.85rem] text-ink-soft rtl:font-ar" data-testid="as-rate-note">{s.rateNote}</p>
          </Panel>
          <p className="text-[0.8rem] text-ink-faint rtl:font-ar" data-testid="as-sampled">{s.sampled(COLUMNS)}</p>
        </>
      )}
    </Stack>
  )
}
