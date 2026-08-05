import { useEffect, useRef, useState } from 'react'
import { useLocale } from '../../i18n'
import { UploadIcon, DownloadIcon, ScissorsIcon } from '../../components/icons'
import { Button, Stack, Spinner, FileError, Waveform, Panel } from '../../components/ui'
import { setWorkInProgress } from '../../lib/workInProgress'
import { decodeAudio, formatTime, wavBytes, formatBytes, type Decoded } from '../../lib/audio'
import { WavEncoder } from '../../lib/wavEncoder'

const STR = {
  en: {
    pick: 'Choose a video', another: 'Choose another',
    decoding: 'Pulling out the audio…', encoding: 'Preparing the file…',
    hint: 'MP4, MOV, WebM, MKV — the soundtrack is decoded straight out of the file. Nothing is uploaded and nothing is watched; only the audio is read.',
    failed: 'Your browser could not decode the audio in that file. Some MKV and older codecs are not supported by any browser — if the video plays but this fails, the audio track is in a format the browser cannot open on its own.',
    silent: 'That video has no audio track — there is nothing to extract.',
    duration: 'Length', channels: 'Channels', rate: 'Sample rate', size: 'About',
    mono: 'mono', stereo: 'stereo',
    download: 'Download the audio (WAV)',
    trim: 'Trim it first',
    wavNote: 'The audio comes out as WAV — a straight copy of what was in the video, with nothing re-compressed. That makes it bigger than an MP3 would be, but it loses nothing.',
  },
  ar: {
    pick: 'اختر مقطع فيديو', another: 'اختر ملفًا آخر',
    decoding: 'جارٍ استخراج الصوت…', encoding: 'جارٍ تجهيز الملف…',
    hint: 'MP4 وMOV وWebM وMKV — يُفك ترميز الصوت من الملف مباشرةً. لا يُرفع شيء ولا يُشاهَد شيء؛ لا يُقرأ إلا الصوت.',
    failed: 'تعذّر على متصفحك فك ترميز الصوت في هذا الملف. بعض صيغ MKV والترميزات القديمة لا يدعمها أي متصفح — إن كان الفيديو يعمل وفشلت الأداة، فمسار الصوت بصيغة لا يستطيع المتصفح فتحها وحدها.',
    silent: 'لا يحتوي هذا الفيديو على مسار صوتي — لا شيء لاستخراجه.',
    duration: 'المدة', channels: 'القنوات', rate: 'معدّل العيّنات', size: 'نحو',
    mono: 'أحادي', stereo: 'ثنائي',
    download: 'نزّل الصوت (WAV)',
    trim: 'اقصصه أولًا',
    wavNote: 'يخرج الصوت بصيغة WAV — نسخة مطابقة لما كان في الفيديو دون إعادة ضغط. وهذا يجعله أكبر من MP3، لكنه لا يفقد شيئًا.',
  },
}

export default function VideoAudioTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const [audio, setAudio] = useState<Decoded | null>(null)
  const [name, setName] = useState('audio')
  const [busy, setBusy] = useState<'' | 'decode' | 'encode'>('')
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const encoderRef = useRef<WavEncoder | null>(null)

  useEffect(() => {
    encoderRef.current = new WavEncoder()
    return () => {
      encoderRef.current?.terminate()
      setWorkInProgress('video-audio', false)
    }
  }, [])

  async function pick(f: File | undefined) {
    if (!f) return
    setBusy('decode'); setError(''); setAudio(null)
    setName(f.name.replace(/\.[^.]+$/, '') || 'audio')
    try {
      const d = await decodeAudio(f)
      // A video with no audio track decodes to an empty or silent buffer rather
      // than throwing, so say which of the two failures happened.
      if (!d.channels.length || d.duration === 0) { setError(s.silent); return }
      setAudio(d)
      setWorkInProgress('video-audio', true)
    } catch {
      setError(s.failed)
    } finally {
      setBusy('')
    }
  }

  async function download() {
    if (!audio || !encoderRef.current) return
    setBusy('encode')
    try {
      const blob = await encoderRef.current.encode(audio)
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
    <Stack data-testid="video-audio">
      <div className="flex flex-wrap items-center gap-2">
        {/* No accept filter — Android's picker hides files it has not indexed. */}
        <input ref={fileRef} type="file" className="hidden" data-testid="va-file" onChange={(e) => pick(e.target.files?.[0])} />
        <Button onClick={() => fileRef.current?.click()} data-testid="va-pick">
          <UploadIcon /> {audio ? s.another : s.pick}
        </Button>
        {busy && <Spinner className="size-5" />}
        {busy && <span className="text-[0.9rem] text-ink-faint rtl:font-ar">{busy === 'decode' ? s.decoding : s.encoding}</span>}
      </div>

      {error && <FileError message={error} />}
      {!audio && !busy && !error && <p className="text-ink-faint text-[0.95rem] rtl:font-ar">{s.hint}</p>}

      {audio && (
        <>
          <Waveform audio={audio} start={0} end={audio.duration} />

          <dl className="flex flex-wrap gap-x-6 gap-y-1 text-[0.9rem] [&_dt]:text-ink-faint [&_dd]:text-ink [&_dd]:font-semibold">
            <div className="flex gap-1.5"><dt className="rtl:font-ar">{s.duration}</dt><dd data-testid="va-duration">{formatTime(audio.duration)}</dd></div>
            <div className="flex gap-1.5"><dt className="rtl:font-ar">{s.channels}</dt><dd data-testid="va-channels">{audio.channels.length === 1 ? s.mono : s.stereo}</dd></div>
            <div className="flex gap-1.5"><dt className="rtl:font-ar">{s.rate}</dt><dd>{(audio.sampleRate / 1000).toFixed(1)} kHz</dd></div>
            <div className="flex gap-1.5"><dt className="rtl:font-ar">{s.size}</dt><dd className="!font-normal">{formatBytes(wavBytes(audio))}</dd></div>
          </dl>

          <div className="flex flex-wrap gap-2">
            <Button variant="primary" onClick={download} disabled={busy !== ''} data-testid="va-download">
              <DownloadIcon /> {s.download}
            </Button>
            <Button to={`/${locale}/apps/audio-trim`} data-testid="va-trim"><ScissorsIcon /> {s.trim}</Button>
          </div>

          <Panel><p className="text-[0.85rem] text-ink-soft rtl:font-ar">{s.wavNote}</p></Panel>
        </>
      )}
    </Stack>
  )
}
