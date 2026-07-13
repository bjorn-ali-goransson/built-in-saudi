import { useEffect, useRef, useState } from 'react'
import { useLocale } from '../../i18n'
import { RecordIcon, DownloadIcon } from '../../components/icons'
import { Button, Stack, Check } from '../../components/ui'

const STR = {
  en: {
    start: 'Start recording', stop: 'Stop', withMic: 'Include microphone', recording: 'Recording…', download: 'Download video',
    again: 'Record again', unsupported: 'Screen recording isn’t supported in this browser.',
    hint: 'You’ll be asked which screen, window or tab to share. Stop sharing (or press Stop) to finish.',
    privacy: 'Captured and saved on your device — nothing is uploaded.',
  },
  ar: {
    start: 'ابدأ التسجيل', stop: 'إيقاف', withMic: 'تضمين المايك', recording: 'يسجّل…', download: 'تنزيل الفيديو',
    again: 'سجّل مجددًا', unsupported: 'تسجيل الشاشة غير مدعوم في هذا المتصفح.',
    hint: 'سيُطلب منك اختيار الشاشة أو النافذة أو التبويب للمشاركة. أوقف المشاركة (أو اضغط إيقاف) للإنهاء.',
    privacy: 'يُلتقط ويُحفظ على جهازك — لا يُرفع أي شيء.',
  },
}

export default function ScreenRecorderTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const supported = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getDisplayMedia
  const [withMic, setWithMic] = useState(false)
  const [state, setState] = useState<'idle' | 'recording' | 'done'>('idle')
  const [url, setUrl] = useState('')
  const recorder = useRef<MediaRecorder | null>(null)
  const chunks = useRef<Blob[]>([])
  const streams = useRef<MediaStream[]>([])

  function cleanup() { streams.current.forEach((st) => st.getTracks().forEach((t) => t.stop())); streams.current = [] }
  useEffect(() => () => cleanup(), [])

  async function start() {
    try {
      const display = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })
      streams.current.push(display)
      const tracks = [...display.getTracks()]
      if (withMic) {
        try { const mic = await navigator.mediaDevices.getUserMedia({ audio: true }); streams.current.push(mic); tracks.push(...mic.getAudioTracks()) } catch { /* no mic */ }
      }
      const combined = new MediaStream(tracks)
      chunks.current = []
      const mr = new MediaRecorder(combined, { mimeType: MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : 'video/webm' })
      mr.ondataavailable = (e) => { if (e.data.size) chunks.current.push(e.data) }
      mr.onstop = () => { cleanup(); const blob = new Blob(chunks.current, { type: 'video/webm' }); setUrl((p) => { if (p) URL.revokeObjectURL(p); return URL.createObjectURL(blob) }); setState('done') }
      display.getVideoTracks()[0].addEventListener('ended', () => { if (mr.state !== 'inactive') mr.stop() })
      mr.start()
      recorder.current = mr
      setState('recording')
    } catch { cleanup(); setState('idle') }
  }
  function stop() { if (recorder.current && recorder.current.state !== 'inactive') recorder.current.stop() }

  if (!supported) return <Stack data-testid="screen-recorder"><p className="text-ink-soft">{s.unsupported}</p></Stack>

  return (
    <Stack data-testid="screen-recorder">
      {state === 'idle' && (
        <>
          <Check><input type="checkbox" checked={withMic} onChange={(e) => setWithMic(e.target.checked)} data-testid="rec-mic" /> {s.withMic}</Check>
          <Button variant="primary" onClick={start} className="self-start" data-testid="rec-start"><RecordIcon className="w-4 h-4" /> {s.start}</Button>
          <p className="text-[0.85rem] text-ink-faint">{s.hint}</p>
        </>
      )}
      {state === 'recording' && (
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-2 text-[color:var(--danger)] font-semibold"><span className="w-3 h-3 rounded-full bg-[var(--danger)] animate-pulse" /> {s.recording}</span>
          <Button variant="primary" onClick={stop} className="!bg-[var(--danger)]" data-testid="rec-stop">{s.stop}</Button>
        </div>
      )}
      {state === 'done' && url && (
        <>
          <video src={url} controls className="w-full rounded-md border border-[color:var(--line-soft)] bg-black" />
          <div className="flex gap-2">
            <Button variant="primary" href={url} download="recording.webm" data-testid="rec-download"><DownloadIcon /> {s.download}</Button>
            <Button onClick={() => setState('idle')}>{s.again}</Button>
          </div>
        </>
      )}
      <p className="text-[0.8rem] text-ink-faint flex items-center gap-[0.4rem]"><span aria-hidden="true">🔒</span> {s.privacy}</p>
    </Stack>
  )
}
