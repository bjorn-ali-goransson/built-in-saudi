import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocale } from '../../i18n'
import { Button, Input, Field, Stack, Panel, FileError, Spinner } from '../../components/ui'
import { DownloadIcon, UploadIcon } from '../../components/icons'
import { setWorkInProgress } from '../../lib/workInProgress'
import { decodeAudio, formatBytes, formatTime, peaks, wavBytes, type Decoded } from '../../lib/audio'
import { WavEncoder } from '../../lib/wavEncoder'
import { DEFAULTS, applyCuts, findSilences, keptRegions, totalCut, type SilenceOptions } from './silence'

const WIP = 'remove-silence'

const STR = {
  en: {
    pick: 'Choose an audio file',
    intro: 'Cut the silence out of a recording — the pauses in a lecture, the gaps in an interview, the dead air at the start. Everything happens on your device; the file is never uploaded.',
    reading: 'Decoding…', working: 'Cutting…',
    threshold: 'Quieter than', minSilence: 'Silences longer than', padding: 'Keep at each edge',
    db: 'dB', sec: 'sec',
    paddingHint: 'A margin left at both ends of every cut, so a breath before a word and the tail of the one before it survive. Cut exactly on the silence and the result sounds chopped — worse than the silence was.',
    found: (n: number, cut: string) => `${n} silence${n === 1 ? '' : 's'} · ${cut} to remove`,
    none: 'No silence found at this threshold. Try a higher one.',
    before: 'Before', after: 'After', saved: 'Saved',
    apply: 'Remove the silence', download: 'Download WAV',
    waveform: 'The parts in gold will be removed',
    wavNote: 'The result is a WAV. Cutting samples means the audio has to be written out again, and WAV is the one format that can be written here without a compression library — so it is bigger than what you put in, and it has lost nothing.',
    errors: {
      decode: 'That file could not be decoded. Anything your browser can play works — MP3, WAV, M4A, OGG — but not a video container or a DRM-protected file.',
    } as Record<string, string>,
    again: 'Choose another file',
  },
  ar: {
    pick: 'اختر ملفًا صوتيًا',
    intro: 'احذف الصمت من تسجيل — سكتات محاضرة، وفجوات مقابلة، والفراغ في البداية. كل شيء يجري على جهازك؛ ولا يُرفع الملف أبدًا.',
    reading: 'جارٍ فك الترميز…', working: 'جارٍ القص…',
    threshold: 'أهدأ من', minSilence: 'السكتات الأطول من', padding: 'أبقِ عند كل طرف',
    db: 'ديسيبل', sec: 'ثانية',
    paddingHint: 'هامش يُترك عند طرفي كل قصّة، لتبقى الشهقة قبل الكلمة وذيل الكلمة التي قبلها. فالقص على حدّ الصمت تمامًا يجعل النتيجة مبتورة — وذلك أسوأ من الصمت نفسه.',
    found: (n: number, cut: string) => `${n} سكتة · ${cut} ستُحذف`,
    none: 'لم يُعثر على صمت عند هذه العتبة. جرّب عتبة أعلى.',
    before: 'قبل', after: 'بعد', saved: 'المحذوف',
    apply: 'احذف الصمت', download: 'نزّل WAV',
    waveform: 'الأجزاء الذهبية ستُحذف',
    wavNote: 'الناتج ملف WAV. فقصّ العيّنات يوجب إعادة كتابة الصوت، وWAV هي الصيغة الوحيدة التي يمكن كتابتها هنا دون مكتبة ضغط — فهي أكبر مما أدخلت، ولم تفقد شيئًا.',
    errors: {
      decode: 'تعذّر فك ترميز هذا الملف. كل ما يشغّله متصفحك يعمل — MP3 وWAV وM4A وOGG — أما حاويات الفيديو والملفات المحمية فلا.',
    } as Record<string, string>,
    again: 'اختر ملفًا آخر',
  },
}

export default function RemoveSilenceTool() {
  const { locale } = useLocale()
  const s = STR[locale]

  const [decoded, setDecoded] = useState<Decoded | null>(null)
  const [name, setName] = useState('')
  const [o, setO] = useState<SilenceOptions>(DEFAULTS)
  const [busy, setBusy] = useState<'' | 'decode' | 'apply'>('')
  const [error, setError] = useState('')
  const [out, setOut] = useState<{ url: string; size: number; duration: number } | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const encoderRef = useRef<WavEncoder | null>(null)

  useEffect(() => {
    encoderRef.current = new WavEncoder()
    return () => { encoderRef.current?.terminate() }
  }, [])
  useEffect(() => () => { setWorkInProgress(WIP, false) }, [])

  const set = <K extends keyof SilenceOptions>(k: K, v: SilenceOptions[K]) => setO((p) => ({ ...p, [k]: v }))

  const cuts = useMemo(() => (decoded ? findSilences(decoded, o) : []), [decoded, o])
  const kept = useMemo(() => (decoded ? keptRegions(decoded.duration, cuts) : []), [decoded, cuts])
  const removed = useMemo(() => totalCut(cuts), [cuts])

  // The waveform, with the doomed stretches shaded.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !decoded) return
    const dpr = window.devicePixelRatio || 1
    const w = canvas.clientWidth || 600
    const h = 110
    canvas.width = w * dpr; canvas.height = h * dpr
    const ctx = canvas.getContext('2d')!
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, w, h)
    const pk = peaks(decoded, w)
    ctx.fillStyle = 'rgba(31,92,61,0.75)'
    pk.forEach((p, x) => {
      const top = h / 2 - Math.max(0.5, p.max * (h / 2))
      const bottom = h / 2 - Math.min(-0.5, p.min * (h / 2))
      ctx.fillRect(x, top, 1, bottom - top)
    })
    ctx.fillStyle = 'rgba(197,150,55,0.30)'
    for (const c of cuts) {
      const x = (c.start / decoded.duration) * w
      ctx.fillRect(x, 0, Math.max(1, ((c.end - c.start) / decoded.duration) * w), h)
    }
  }, [decoded, cuts])

  async function pick(file: File | undefined | null) {
    if (!file) return
    setError('')
    setOut(null)
    setBusy('decode')
    try {
      const d = await decodeAudio(file)
      setDecoded(d)
      setName(file.name.replace(/\.[^.]+$/, ''))
      setWorkInProgress(WIP, true)
    } catch {
      setError(s.errors.decode)
      setDecoded(null)
    } finally { setBusy('') }
  }

  async function apply() {
    if (!decoded || !encoderRef.current) return
    setBusy('apply')
    try {
      const trimmed = applyCuts(decoded, kept)
      const blob = await encoderRef.current.encode(trimmed)
      setOut((prev) => {
        if (prev) URL.revokeObjectURL(prev.url)
        return { url: URL.createObjectURL(blob), size: blob.size, duration: trimmed.duration }
      })
    } finally { setBusy('') }
  }

  return (
    <Stack data-testid="remove-silence">
      {!decoded && (
        <Panel className="gap-3">
          <p className="text-[0.95rem] text-ink-soft rtl:font-ar">{s.intro}</p>
          <label className="inline-flex items-center gap-2 self-start px-[1.15rem] py-[0.7rem] rounded-md border border-green-700 bg-green-600 text-[color:var(--primary-ink)] font-semibold text-[0.95rem] cursor-pointer">
            <UploadIcon /> {s.pick}
            <input type="file" className="hidden" data-testid="rs-file" onChange={(e) => { void pick(e.target.files?.[0]) }} />
          </label>
        </Panel>
      )}

      {busy === 'decode' && <p className="flex items-center gap-2 text-ink-faint rtl:font-ar" data-testid="rs-reading"><Spinner /> {s.reading}</p>}
      {error && <FileError message={error} />}

      {decoded && (
        <>
          <canvas ref={canvasRef} data-testid="rs-waveform"
            className="w-full h-[110px] rounded-md border border-[color:var(--line)] bg-[var(--surface)]" />
          <p className="text-[0.82rem] text-ink-faint rtl:font-ar">{s.waveform}</p>

          <Panel>
            <div className="grid gap-3 grid-cols-1 min-[620px]:grid-cols-3">
              <Field label={`${s.threshold} (${s.db})`}>
                <Input type="number" min={-90} max={-10} step={1} value={o.thresholdDb} data-testid="rs-threshold"
                  onChange={(e) => set('thresholdDb', Math.min(-10, Math.max(-90, Number(e.target.value) || -45)))} />
              </Field>
              <Field label={`${s.minSilence} (${s.sec})`}>
                <Input type="number" min={0.1} max={10} step={0.1} value={o.minSilence} data-testid="rs-min"
                  onChange={(e) => set('minSilence', Math.min(10, Math.max(0.1, Number(e.target.value) || 0.5)))} />
              </Field>
              <Field label={`${s.padding} (${s.sec})`}>
                <Input type="number" min={0} max={2} step={0.01} value={o.padding} data-testid="rs-padding"
                  onChange={(e) => set('padding', Math.min(2, Math.max(0, Number(e.target.value) || 0)))} />
              </Field>
            </div>
            <p className="text-[0.8rem] text-ink-faint rtl:font-ar">{s.paddingHint}</p>

            <div className="flex flex-wrap items-center gap-4">
              <span className="text-[0.9rem] text-ink" data-testid="rs-found">
                {cuts.length ? s.found(cuts.length, formatTime(removed)) : s.none}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <span className="text-[0.85rem] text-ink-faint">{s.before} <b className="font-mono text-ink" data-testid="rs-before">{formatTime(decoded.duration)}</b></span>
              <span className="text-[0.85rem] text-ink-faint">{s.after} <b className="font-mono text-ink" data-testid="rs-after">{formatTime(Math.max(0, decoded.duration - removed))}</b></span>
              <span className="text-[0.85rem] text-ink-faint">{s.saved} <b className="font-mono text-green-700" data-testid="rs-saved">{formatTime(removed)}</b></span>
            </div>

            <Button variant="primary" className="self-start" onClick={apply} disabled={busy !== '' || !cuts.length} data-testid="rs-apply">
              {busy === 'apply' ? s.working : s.apply}
            </Button>
          </Panel>

          {out && (
            <section className="flex flex-col gap-2" data-testid="rs-result">
              <audio src={out.url} controls className="w-full" data-testid="rs-audio" />
              <div className="flex flex-wrap items-center gap-3">
                <Button variant="primary" href={out.url} download={`${name || 'audio'}-trimmed.wav`} data-testid="rs-download">
                  <DownloadIcon /> {s.download}
                </Button>
                <span className="text-[0.85rem] text-ink-faint font-mono" data-testid="rs-out-info">
                  {formatTime(out.duration)} · {formatBytes(out.size)}
                </span>
              </div>
            </section>
          )}

          <Panel><p className="text-[0.85rem] text-ink-soft rtl:font-ar">{s.wavNote}</p></Panel>

          <label className="self-start text-[0.85rem] text-green-700 underline cursor-pointer">
            {s.again}
            <input type="file" className="hidden" data-testid="rs-file-again" onChange={(e) => { void pick(e.target.files?.[0]) }} />
          </label>
        </>
      )}
      {decoded && <span className="hidden" data-testid="rs-wav-size">{wavBytes(decoded)}</span>}
    </Stack>
  )
}
