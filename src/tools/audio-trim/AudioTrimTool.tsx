import { useEffect, useRef, useState } from 'react'
import { useLocale } from '../../i18n'
import { UploadIcon, DownloadIcon, VolumeIcon, MuteIcon } from '../../components/icons'
import { Button, Input, Stack, Spinner, FileError, Waveform, Panel } from '../../components/ui'
import { setWorkInProgress } from '../../lib/workInProgress'
import { decodeAudio, slice, formatTime, wavBytes, formatBytes, type Decoded } from '../../lib/audio'
import { WavEncoder } from '../../lib/wavEncoder'

const STR = {
  en: {
    pick: 'Choose an audio file', another: 'Choose another',
    decoding: 'Decoding…', encoding: 'Preparing the file…',
    hint: 'MP3, M4A, WAV, OGG, FLAC — anything your browser can play. Drag across the waveform to choose the part you want to keep.',
    failed: 'Your browser could not decode that file. If it will not play in a browser tab either, it is not a format available here.',
    start: 'Start', end: 'End', length: 'Length', fade: 'Fade in/out (ms)',
    play: 'Play selection', stop: 'Stop',
    download: 'Download WAV', size: 'About',
    wavNote: 'The export is WAV — lossless, so nothing is degraded a second time, but larger than the file you started with. Re-encoding to MP3 would need a compressor that loses quality again.',
    whole: 'Select everything',
  },
  ar: {
    pick: 'اختر ملفًا صوتيًا', another: 'اختر ملفًا آخر',
    decoding: 'جارٍ فك الترميز…', encoding: 'جارٍ تجهيز الملف…',
    hint: 'MP3 وM4A وWAV وOGG وFLAC — أي صيغة يشغّلها متصفحك. اسحب على الموجة لتحديد الجزء الذي تريد الاحتفاظ به.',
    failed: 'تعذّر على متصفحك فك ترميز هذا الملف. إن كان لا يعمل في تبويب المتصفح أصلًا، فصيغته غير متاحة هنا.',
    start: 'البداية', end: 'النهاية', length: 'المدة', fade: 'تلاشٍ (مللي ثانية)',
    play: 'شغّل المحدد', stop: 'إيقاف',
    download: 'نزّل WAV', size: 'نحو',
    wavNote: 'التصدير بصيغة WAV — بلا فقد، فلا تتدهور الجودة مرة ثانية، لكنه أكبر من الملف الأصلي. إعادة الترميز إلى MP3 تتطلّب ضاغطًا يفقد الجودة من جديد.',
    whole: 'حدّد الكل',
  },
}

export default function AudioTrimTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const [audio, setAudio] = useState<Decoded | null>(null)
  const [name, setName] = useState('audio')
  const [busy, setBusy] = useState<'' | 'decode' | 'encode'>('')
  const [error, setError] = useState('')
  const [start, setStart] = useState(0)
  const [end, setEnd] = useState(0)
  const [fade, setFade] = useState(10)
  const [playhead, setPlayhead] = useState<number | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const encoderRef = useRef<WavEncoder | null>(null)
  const ctxRef = useRef<AudioContext | null>(null)
  const srcRef = useRef<AudioBufferSourceNode | null>(null)
  const rafRef = useRef(0)

  useEffect(() => {
    encoderRef.current = new WavEncoder()
    return () => {
      encoderRef.current?.terminate()
      stopPlayback()
      ctxRef.current?.close().catch(() => {})
      setWorkInProgress('audio-trim', false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function pick(f: File | undefined) {
    if (!f) return
    stopPlayback()
    setBusy('decode'); setError(''); setAudio(null)
    setName(f.name.replace(/\.[^.]+$/, '') || 'audio')
    try {
      const d = await decodeAudio(f)
      setAudio(d); setStart(0); setEnd(d.duration)
      setWorkInProgress('audio-trim', true)
    } catch {
      setError(s.failed)
    } finally {
      setBusy('')
    }
  }

  function stopPlayback() {
    cancelAnimationFrame(rafRef.current)
    try { srcRef.current?.stop() } catch { /* not started */ }
    srcRef.current = null
    setPlayhead(null)
  }

  function play() {
    if (!audio) return
    stopPlayback()
    const ctx = ctxRef.current ?? (ctxRef.current = new AudioContext())
    void ctx.resume()
    const cut = slice(audio, start, end, fade)
    const buf = ctx.createBuffer(cut.channels.length, cut.channels[0].length, cut.sampleRate)
    // copyToChannel's typing insists on a plain-ArrayBuffer-backed view.
    cut.channels.forEach((ch, i) => buf.copyToChannel(new Float32Array(ch), i))
    const src = ctx.createBufferSource()
    src.buffer = buf
    src.connect(ctx.destination)
    const t0 = ctx.currentTime
    src.start()
    srcRef.current = src
    src.onended = () => { if (srcRef.current === src) stopPlayback() }
    const step = () => {
      if (srcRef.current !== src) return
      setPlayhead(start + (ctx.currentTime - t0))
      rafRef.current = requestAnimationFrame(step)
    }
    rafRef.current = requestAnimationFrame(step)
  }

  async function download() {
    if (!audio || !encoderRef.current) return
    setBusy('encode')
    try {
      const blob = await encoderRef.current.encode(slice(audio, start, end, fade))
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = `${name}-trimmed.wav`; a.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch {
      setError(s.failed)
    } finally {
      setBusy('')
    }
  }

  const selLength = Math.max(0, end - start)
  const estimated = audio ? wavBytes({ ...audio, channels: audio.channels.map((c) => c.slice(0, Math.floor(selLength * audio.sampleRate))) }) : 0

  return (
    <Stack data-testid="audio-trim">
      <div className="flex flex-wrap items-center gap-2">
        {/* No accept filter — Android's picker hides files it has not indexed. */}
        <input ref={fileRef} type="file" className="hidden" data-testid="at-file" onChange={(e) => pick(e.target.files?.[0])} />
        <Button onClick={() => fileRef.current?.click()} data-testid="at-pick">
          <UploadIcon /> {audio ? s.another : s.pick}
        </Button>
        {busy && <Spinner className="size-5" />}
        {busy && <span className="text-[0.9rem] text-ink-faint rtl:font-ar">{busy === 'decode' ? s.decoding : s.encoding}</span>}
      </div>

      {error && <FileError message={error} />}
      {!audio && !busy && !error && <p className="text-ink-faint text-[0.95rem] rtl:font-ar">{s.hint}</p>}

      {audio && (
        <>
          <Waveform audio={audio} start={start} end={end} playhead={playhead}
            onSelect={(a, b) => { setStart(a); setEnd(b) }} />

          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-[0.8rem] text-ink-faint">
              {s.start}
              <Input dir="ltr" className="w-28 font-mono" data-testid="at-start" value={formatTime(start)} readOnly />
            </label>
            <label className="flex flex-col gap-1 text-[0.8rem] text-ink-faint">
              {s.end}
              <Input dir="ltr" className="w-28 font-mono" data-testid="at-end" value={formatTime(end)} readOnly />
            </label>
            <label className="flex flex-col gap-1 text-[0.8rem] text-ink-faint">
              {s.length}
              <Input dir="ltr" className="w-28 font-mono" data-testid="at-length" value={formatTime(selLength)} readOnly />
            </label>
            <label className="flex flex-col gap-1 text-[0.8rem] text-ink-faint">
              {s.fade}
              <Input type="number" min={0} max={2000} dir="ltr" className="w-24" data-testid="at-fade"
                value={fade} onChange={(e) => setFade(Math.max(0, +e.target.value || 0))} />
            </label>
            <Button onClick={() => { setStart(0); setEnd(audio.duration) }} data-testid="at-all">{s.whole}</Button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {playhead === null
              ? <Button onClick={play} data-testid="at-play"><VolumeIcon /> {s.play}</Button>
              : <Button onClick={stopPlayback} data-testid="at-stop"><MuteIcon /> {s.stop}</Button>}
            <Button variant="primary" onClick={download} disabled={busy !== '' || selLength <= 0} data-testid="at-download">
              <DownloadIcon /> {s.download}
            </Button>
            <span className="text-[0.85rem] text-ink-faint font-mono" data-testid="at-size">{s.size} {formatBytes(estimated)}</span>
          </div>

          <Panel><p className="text-[0.85rem] text-ink-soft rtl:font-ar">{s.wavNote}</p></Panel>
        </>
      )}
    </Stack>
  )
}
