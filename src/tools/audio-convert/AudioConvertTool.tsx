import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocale } from '../../i18n'
import { UploadIcon, DownloadIcon } from '../../components/icons'
import { Button, Stack, Spinner, FileError, Panel, Field, Seg, SegButton } from '../../components/ui'
import { setWorkInProgress } from '../../lib/workInProgress'
import { decodeAudio, formatTime, formatBytes, type Decoded } from '../../lib/audio'
import { WavEncoder } from '../../lib/wavEncoder'
import { convert, estimate, RATES, type Target } from './convert'

const WIP = 'audio-convert'

const STR = {
  en: {
    pick: 'Choose an audio file', another: 'Choose another',
    decoding: 'Reading the file…', converting: 'Converting…',
    hint: 'MP3, M4A, AAC, OGG, FLAC, WAV, Opus — whatever your browser can play, it can convert. Everything happens on your device; nothing is uploaded.',
    failed: 'Your browser could not decode that file. If it does not play in your browser either, the codec is one no browser opens on its own.',
    empty: 'That file has no audio in it.',
    source: 'What you gave me', out: 'What you will get',
    duration: 'Length', channels: 'Channels', rate: 'Sample rate', size: 'Size',
    mono: 'Mono', stereo: 'Stereo', keep: 'Keep',
    rateLabel: 'Sample rate', chLabel: 'Channels',
    download: 'Download as WAV',
    wavNote: 'The output is WAV: uncompressed and lossless, which is why the size is what it is. Converting to MP3 would need a real encoder shipped to your browser and would throw away quality a second time — so this tool does the conversion everything accepts, and says how big it will be before you commit to it.',
    speechNote: '16 kHz mono is what speech and transcription software expects, and it is roughly a sixth the size of 44.1 kHz stereo. For music, keep the original rate.',
    smaller: (pct: number) => `${pct}% smaller than keeping the original`,
    bigger: (pct: number) => `${pct}% larger than the original file`,
  },
  ar: {
    pick: 'اختر ملفًا صوتيًا', another: 'اختر ملفًا آخر',
    decoding: 'جارٍ قراءة الملف…', converting: 'جارٍ التحويل…',
    hint: 'MP3 وM4A وAAC وOGG وFLAC وWAV وOpus — ما يستطيع متصفحك تشغيله يستطيع تحويله. كل شيء يجري على جهازك ولا يُرفع شيء.',
    failed: 'تعذّر على متصفحك فك ترميز هذا الملف. وإن كان لا يعمل في متصفحك أصلًا فالترميز مما لا يفتحه أي متصفح وحده.',
    empty: 'لا صوت في هذا الملف.',
    source: 'ما أعطيتَه', out: 'ما ستحصل عليه',
    duration: 'المدة', channels: 'القنوات', rate: 'معدّل العيّنات', size: 'الحجم',
    mono: 'أحادي', stereo: 'ثنائي', keep: 'كما هو',
    rateLabel: 'معدّل العيّنات', chLabel: 'القنوات',
    download: 'نزّله بصيغة WAV',
    wavNote: 'الناتج بصيغة WAV: غير مضغوط ولا يفقد شيئًا، ولهذا حجمه ما هو عليه. والتحويل إلى MP3 يحتاج مرمّزًا حقيقيًا يُرسَل إلى متصفحك ويهدر الجودة مرة ثانية — فالأداة تُجري التحويل الذي يقبله كل شيء، وتقول لك الحجم قبل أن تلتزم به.',
    speechNote: '16 كيلوهرتز أحادي هو ما تتوقعه برامج التفريغ والتعرّف على الكلام، وحجمه نحو سدس 44.1 كيلوهرتز ثنائي. أما للموسيقى فأبقِ المعدّل الأصلي.',
    smaller: (pct: number) => `أصغر بنسبة ${pct}٪ من الإبقاء على الأصل`,
    bigger: (pct: number) => `أكبر بنسبة ${pct}٪ من الملف الأصلي`,
  },
}

export default function AudioConvertTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const fmt = (n: number) => n.toLocaleString(locale === 'ar' ? 'ar-SA' : 'en-US')

  const [audio, setAudio] = useState<Decoded | null>(null)
  const [sourceBytes, setSourceBytes] = useState(0)
  const [name, setName] = useState('audio')
  const [busy, setBusy] = useState<'' | 'decode' | 'encode'>('')
  const [error, setError] = useState('')
  const [target, setTarget] = useState<Target>({ sampleRate: null, channels: null })
  const fileRef = useRef<HTMLInputElement>(null)
  const encoderRef = useRef<WavEncoder | null>(null)

  useEffect(() => {
    encoderRef.current = new WavEncoder()
    return () => {
      encoderRef.current?.terminate()
      setWorkInProgress(WIP, false)
    }
  }, [])

  async function pick(f: File | undefined) {
    if (!f) return
    setBusy('decode'); setError(''); setAudio(null)
    setName(f.name.replace(/\.[^.]+$/, '') || 'audio')
    setSourceBytes(f.size)
    try {
      const d = await decodeAudio(f)
      if (!d.channels.length || d.duration === 0) { setError(s.empty); return }
      setAudio(d)
      setTarget({ sampleRate: null, channels: null })
      setWorkInProgress(WIP, true)
    } catch {
      setError(s.failed)
    } finally {
      setBusy('')
    }
  }

  const outBytes = useMemo(() => (audio ? estimate(audio, target) : 0), [audio, target])
  const keepBytes = useMemo(
    () => (audio ? estimate(audio, { sampleRate: null, channels: null }) : 0),
    [audio],
  )
  const outRate = audio ? target.sampleRate ?? audio.sampleRate : 0
  const outCh = audio ? target.channels ?? Math.min(2, audio.channels.length) : 0
  const delta = keepBytes ? Math.round((1 - outBytes / keepBytes) * 100) : 0

  async function download() {
    if (!audio || !encoderRef.current) return
    setBusy('encode')
    try {
      const out = await convert(audio, target)
      const blob = await encoderRef.current.encode(out)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = `${name}.wav`; a.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch {
      setError(s.failed)
    } finally {
      setBusy('')
    }
  }

  return (
    <Stack data-testid="audio-convert">
      <div className="flex flex-wrap items-center gap-2">
        {/* No accept filter — Android's picker hides files it has not indexed. */}
        <input ref={fileRef} type="file" className="hidden" data-testid="ac-file" onChange={(e) => pick(e.target.files?.[0])} />
        <Button onClick={() => fileRef.current?.click()} data-testid="ac-pick">
          <UploadIcon /> {audio ? s.another : s.pick}
        </Button>
        {busy && <Spinner className="size-5" />}
        {busy && <span className="text-[0.9rem] text-ink-faint rtl:font-ar">{busy === 'decode' ? s.decoding : s.converting}</span>}
      </div>

      {error && <FileError message={error} />}
      {!audio && !busy && !error && <p className="text-ink-faint text-[0.95rem] rtl:font-ar">{s.hint}</p>}

      {audio && (
        <>
          <dl className="flex flex-wrap gap-x-6 gap-y-1 text-[0.9rem] [&_dt]:text-ink-faint [&_dd]:text-ink [&_dd]:font-semibold">
            <div className="flex gap-1.5"><dt className="rtl:font-ar">{s.source}</dt><dd data-testid="ac-source">{(audio.sampleRate / 1000).toFixed(1)} kHz · {audio.channels.length === 1 ? s.mono : s.stereo} · {formatTime(audio.duration)}</dd></div>
            <div className="flex gap-1.5"><dt className="rtl:font-ar">{s.size}</dt><dd className="!font-normal">{formatBytes(sourceBytes)}</dd></div>
          </dl>

          <div className="grid gap-3 grid-cols-1 min-[620px]:grid-cols-2">
            <Field label={s.rateLabel}>
              <Seg data-testid="ac-rate">
                <SegButton active={target.sampleRate === null} onClick={() => setTarget((t) => ({ ...t, sampleRate: null }))} data-testid="ac-rate-keep">{s.keep}</SegButton>
                {RATES.map((r) => (
                  <SegButton key={r} active={target.sampleRate === r} onClick={() => setTarget((t) => ({ ...t, sampleRate: r }))} data-testid={`ac-rate-${r}`}>
                    {r / 1000} kHz
                  </SegButton>
                ))}
              </Seg>
            </Field>
            <Field label={s.chLabel}>
              <Seg data-testid="ac-channels">
                <SegButton active={target.channels === null} onClick={() => setTarget((t) => ({ ...t, channels: null }))} data-testid="ac-ch-keep">{s.keep}</SegButton>
                <SegButton active={target.channels === 1} onClick={() => setTarget((t) => ({ ...t, channels: 1 }))} data-testid="ac-ch-1">{s.mono}</SegButton>
                <SegButton active={target.channels === 2} onClick={() => setTarget((t) => ({ ...t, channels: 2 }))} data-testid="ac-ch-2">{s.stereo}</SegButton>
              </Seg>
            </Field>
          </div>

          <Panel className="gap-2">
            <div className="flex flex-wrap gap-x-8 gap-y-2">
              <div>
                <div className="text-[0.7rem] uppercase tracking-[0.05em] text-ink-faint">{s.out}</div>
                <div className="font-mono text-[1.15rem] text-ink" data-testid="ac-out">
                  {fmt(outRate / 1000)} kHz · {outCh === 1 ? s.mono : s.stereo}
                </div>
              </div>
              <div>
                <div className="text-[0.7rem] uppercase tracking-[0.05em] text-ink-faint">{s.size}</div>
                <div className="font-mono text-[1.5rem] font-semibold text-green-700" data-testid="ac-size">{formatBytes(outBytes)}</div>
              </div>
            </div>
            {delta !== 0 && (
              <p className="text-[0.85rem] text-ink-soft rtl:font-ar" data-testid="ac-delta">
                {delta > 0 ? s.smaller(delta) : s.bigger(-delta)}
              </p>
            )}
          </Panel>

          <Button variant="primary" onClick={download} disabled={busy !== ''} data-testid="ac-download">
            <DownloadIcon /> {s.download}
          </Button>

          <Panel><p className="text-[0.85rem] text-ink-soft rtl:font-ar" data-testid="ac-wav-note">{s.wavNote}</p></Panel>
          <Panel><p className="text-[0.85rem] text-ink-soft rtl:font-ar" data-testid="ac-speech-note">{s.speechNote}</p></Panel>
        </>
      )}
    </Stack>
  )
}
