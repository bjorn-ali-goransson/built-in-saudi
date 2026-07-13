import { useEffect, useRef, useState } from 'react'
import { useLocale } from '../../i18n'
import { CameraIcon, DownloadIcon } from '../../components/icons'
import { Button, Stack, Check } from '../../components/ui'

const FILTERS: Record<string, string> = {
  none: 'none', grayscale: 'grayscale(1)', sepia: 'sepia(0.8)', invert: 'invert(1)', warm: 'saturate(1.4) contrast(1.1) hue-rotate(-10deg)', cool: 'saturate(1.2) hue-rotate(20deg)',
}

const STR = {
  en: { start: 'Start camera', stop: 'Stop camera', capture: 'Take photo', mirror: 'Mirror', filter: 'Filter', photos: 'Photos', download: 'Download', denied: 'Camera permission is needed to use the photo booth.', off: 'The camera is off. Start it to take photos.', privacy: 'The camera runs on your device — photos are never uploaded.' },
  ar: { start: 'تشغيل الكاميرا', stop: 'إيقاف الكاميرا', capture: 'التقط صورة', mirror: 'عكس', filter: 'مرشّح', photos: 'الصور', download: 'تنزيل', denied: 'يلزم إذن الكاميرا لاستخدام كشك التصوير.', off: 'الكاميرا مطفأة. شغّلها لالتقاط الصور.', privacy: 'تعمل الكاميرا على جهازك — لا تُرفع الصور أبدًا.' },
}

export default function PhotoBoothTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [on, setOn] = useState(false)
  const [error, setError] = useState('')
  const [mirror, setMirror] = useState(true)
  const [filter, setFilter] = useState('none')
  const [photos, setPhotos] = useState<string[]>([])

  function stop() { streamRef.current?.getTracks().forEach((t) => t.stop()); streamRef.current = null; setOn(false) }
  useEffect(() => () => stop(), [])

  async function start() {
    setError('')
    try {
      const st = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 }, audio: false })
      streamRef.current = st
      if (videoRef.current) { videoRef.current.srcObject = st; await videoRef.current.play().catch(() => {}) }
      setOn(true)
    } catch { setError(s.denied) }
  }

  function capture() {
    const v = videoRef.current; if (!v || !on) return
    const c = document.createElement('canvas'); c.width = v.videoWidth; c.height = v.videoHeight
    const ctx = c.getContext('2d')!
    ctx.filter = FILTERS[filter]
    if (mirror) { ctx.translate(c.width, 0); ctx.scale(-1, 1) }
    ctx.drawImage(v, 0, 0)
    setPhotos((p) => [c.toDataURL('image/png'), ...p])
  }

  return (
    <Stack data-testid="photo-booth">
      <div className="relative bg-black rounded-md overflow-hidden aspect-video flex items-center justify-center">
        <video ref={videoRef} playsInline muted className={`w-full h-full object-cover ${mirror ? '-scale-x-100' : ''}`} style={{ filter: FILTERS[filter], display: on ? 'block' : 'none' }} />
        {!on && <p className="text-sand-100/70 text-[0.9rem] px-4 text-center">{s.off}</p>}
      </div>

      {error && <p className="text-[color:var(--danger)] text-[0.9rem]" data-testid="pb-error">{error}</p>}

      <div className="flex flex-wrap items-center gap-3">
        {!on
          ? <Button variant="primary" onClick={start} data-testid="pb-start"><CameraIcon className="w-4 h-4" /> {s.start}</Button>
          : <>
              <Button variant="primary" onClick={capture} data-testid="pb-capture">{s.capture}</Button>
              <Button onClick={stop} data-testid="pb-stop">{s.stop}</Button>
              <Check><input type="checkbox" checked={mirror} onChange={(e) => setMirror(e.target.checked)} /> {s.mirror}</Check>
              <label className="flex items-center gap-2 text-[0.85rem] text-ink-soft">{s.filter}
                <select value={filter} onChange={(e) => setFilter(e.target.value)} className="rounded-md border border-[color:var(--line)] bg-[var(--surface)] px-2 py-1 text-[0.85rem]" data-testid="pb-filter">
                  {Object.keys(FILTERS).map((f) => <option key={f} value={f}>{f}</option>)}
                </select>
              </label>
            </>}
      </div>

      {photos.length > 0 && (
        <div>
          <p className="text-[0.82rem] font-semibold text-ink-soft mb-1">{s.photos} · {photos.length}</p>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-2">
            {photos.map((src, i) => (
              <a key={i} href={src} download={`photo-${photos.length - i}.png`} className="group relative block rounded-md overflow-hidden border border-[color:var(--line-soft)]">
                <img src={src} alt="" className="w-full aspect-video object-cover" />
                <span className="absolute bottom-1 right-1 bg-black/60 text-white rounded p-1 opacity-0 group-hover:opacity-100 transition"><DownloadIcon className="w-3.5 h-3.5" /></span>
              </a>
            ))}
          </div>
        </div>
      )}
      <p className="text-[0.8rem] text-ink-faint flex items-center gap-[0.4rem]"><span aria-hidden="true">🔒</span> {s.privacy}</p>
    </Stack>
  )
}
