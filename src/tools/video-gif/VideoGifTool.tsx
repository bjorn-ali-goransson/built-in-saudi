import { useEffect, useRef, useState } from 'react'
import { useLocale } from '../../i18n'
import { UploadIcon, DownloadIcon, ScissorsIcon } from '../../components/icons'
import { Button, Input, Select, Stack, Spinner, FileError, Panel, Check } from '../../components/ui'
import { setWorkInProgress } from '../../lib/workInProgress'
import { encodeGif } from './gif'

const STR = {
  en: {
    pick: 'Choose a video', another: 'Choose another',
    hint: 'Turn a few seconds of video into a GIF, entirely on your device. Pick the start and how long, and it steps through the video frame by frame.',
    failed: 'Your browser could not play that video, so there are no frames to read.',
    start: 'Start at', duration: 'Length', fps: 'Frames per second', width: 'Width',
    colours: 'Colours', loop: 'Loop forever',
    make: 'Make the GIF', working: 'Reading frames…', encoding: 'Encoding…',
    download: 'Download GIF', size: 'Size', frames: 'frames',
    seconds: 's', px: 'px',
    tooLong: 'GIF has no inter-frame compression worth the name, so every frame is close to a whole image. Past a few seconds the file grows faster than anyone will wait to load it — trim it, drop the frame rate, or use the video.',
    result: 'Result',
    palette: 'All frames share one palette. A per-frame palette looks marginally better on a still and makes the animation flicker as the palette swaps, which is the artefact people blame on cheap converters.',
  },
  ar: {
    pick: 'اختر مقطع فيديو', another: 'اختر مقطعًا آخر',
    hint: 'حوّل بضع ثوانٍ من فيديو إلى صورة متحركة، على جهازك بالكامل. حدّد البداية والمدة وستمرّ الأداة على الفيديو إطارًا إطارًا.',
    failed: 'تعذّر على متصفحك تشغيل هذا الفيديو، فلا توجد إطارات لقراءتها.',
    start: 'يبدأ عند', duration: 'المدة', fps: 'إطار في الثانية', width: 'العرض',
    colours: 'الألوان', loop: 'تكرار دائم',
    make: 'أنشئ الصورة المتحركة', working: 'جارٍ قراءة الإطارات…', encoding: 'جارٍ الترميز…',
    download: 'نزّل GIF', size: 'الحجم', frames: 'إطارًا',
    seconds: 'ث', px: 'بكسل',
    tooLong: 'صيغة GIF لا تضغط بين الإطارات ضغطًا يُذكر، فكل إطار قريب من صورة كاملة. وبعد بضع ثوانٍ ينمو الملف أسرع مما يصبر أحد على تحميله — اقتطع المدة أو أنقص الإطارات أو استخدم الفيديو.',
    result: 'الناتج',
    palette: 'تتشارك كل الإطارات لوحة ألوان واحدة. فاللوحة لكل إطار تبدو أفضل قليلًا في الصورة الثابتة وتجعل الحركة ترتجف مع تبدّل اللوحة، وهو العيب الذي يُنسب إلى المحوّلات الرديئة.',
  },
}

export default function VideoGifTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const [url, setUrl] = useState('')
  const [name, setName] = useState('clip')
  const [meta, setMeta] = useState<{ duration: number; w: number; h: number } | null>(null)
  const [start, setStart] = useState(0)
  const [duration, setDuration] = useState(3)
  const [fps, setFps] = useState(10)
  const [width, setWidth] = useState(480)
  const [colours, setColours] = useState(128)
  const [loop, setLoop] = useState(true)
  const [busy, setBusy] = useState<'' | 'frames' | 'encoding'>('')
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState('')
  const [result, setResult] = useState<{ url: string; bytes: number; frames: number } | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => () => {
    setWorkInProgress('video-gif', false)
    if (url) URL.revokeObjectURL(url)
  }, [url])

  function pick(f: File | undefined) {
    if (!f) return
    setError(''); setResult(null); setMeta(null)
    setName(f.name.replace(/\.[^.]+$/, '') || 'clip')
    setUrl(URL.createObjectURL(f))
    setWorkInProgress('video-gif', true)
  }

  function onLoaded() {
    const v = videoRef.current
    if (!v || !v.videoWidth) { setError(s.failed); return }
    setMeta({ duration: v.duration, w: v.videoWidth, h: v.videoHeight })
    setDuration(Math.min(3, Math.max(0.5, v.duration)))
  }

  /** Seek and wait — the only reliable way to read an exact frame from a video
   *  element, since there is no "give me the frame at t" API without WebCodecs. */
  function seekTo(v: HTMLVideoElement, t: number): Promise<void> {
    return new Promise((resolve) => {
      const done = () => { v.removeEventListener('seeked', done); resolve() }
      v.addEventListener('seeked', done)
      v.currentTime = t
    })
  }

  async function make() {
    const v = videoRef.current
    if (!v || !meta) return
    setBusy('frames'); setProgress(0); setResult(null)
    try {
      const count = Math.max(1, Math.round(duration * fps))
      const w = Math.min(width, meta.w)
      const h = Math.round((w / meta.w) * meta.h)
      const canvas = document.createElement('canvas')
      canvas.width = w; canvas.height = h
      const ctx = canvas.getContext('2d', { willReadFrequently: true })!
      const frames: Uint8ClampedArray[] = []
      for (let i = 0; i < count; i++) {
        const t = Math.min(meta.duration - 0.001, start + (i / fps))
        await seekTo(v, t)
        ctx.drawImage(v, 0, 0, w, h)
        frames.push(ctx.getImageData(0, 0, w, h).data)
        setProgress((i + 1) / count)
      }
      setBusy('encoding')
      // Yield once so the "encoding" label paints before the main thread is
      // taken by LZW — this is the one genuinely slow step.
      await new Promise((r) => setTimeout(r, 16))
      const blob = encodeGif(frames, {
        width: w, height: h, delayCs: Math.max(2, Math.round(100 / fps)), colours, loop,
      })
      setResult({ url: URL.createObjectURL(blob), bytes: blob.size, frames: count })
    } catch {
      setError(s.failed)
    } finally { setBusy(''); setProgress(0) }
  }

  const big = !!result && result.bytes > 5 * 1024 * 1024

  return (
    <Stack data-testid="video-gif">
      <div className="flex flex-wrap items-center gap-2">
        {/* No accept filter — Android's picker hides files it has not indexed. */}
        <input ref={fileRef} type="file" className="hidden" data-testid="vg-file" onChange={(e) => pick(e.target.files?.[0])} />
        <Button onClick={() => fileRef.current?.click()} data-testid="vg-pick">
          <UploadIcon /> {meta ? s.another : s.pick}
        </Button>
        {busy && <Spinner className="size-5" />}
        {busy && (
          <span className="text-[0.9rem] text-ink-faint rtl:font-ar">
            {busy === 'frames' ? `${s.working} ${Math.round(progress * 100)}%` : s.encoding}
          </span>
        )}
      </div>

      {error && <FileError message={error} />}
      {!url && !error && <p className="text-ink-faint text-[0.95rem] rtl:font-ar">{s.hint}</p>}

      {url && (
        <video ref={videoRef} src={url} onLoadedMetadata={onLoaded} onError={() => setError(s.failed)}
          className="max-h-64 w-auto self-center rounded-md border border-[color:var(--line)]"
          muted playsInline preload="auto" data-testid="vg-video" />
      )}

      {meta && (
        <>
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-[0.8rem] text-ink-faint">
              {s.start}
              <Input type="number" min={0} max={Math.floor(meta.duration)} step={0.1} dir="ltr" className="w-24 font-mono"
                data-testid="vg-start" value={start} onChange={(e) => setStart(Math.max(0, Math.min(meta.duration, +e.target.value || 0)))} />
            </label>
            <label className="flex flex-col gap-1 text-[0.8rem] text-ink-faint">
              {s.duration} ({s.seconds})
              <Input type="number" min={0.2} max={15} step={0.1} dir="ltr" className="w-24 font-mono"
                data-testid="vg-duration" value={duration} onChange={(e) => setDuration(Math.max(0.2, Math.min(15, +e.target.value || 1)))} />
            </label>
            <label className="flex flex-col gap-1 text-[0.8rem] text-ink-faint">
              {s.fps}
              <Select className="w-20" data-testid="vg-fps" value={fps} onChange={(e) => setFps(+e.target.value)}>
                {[5, 8, 10, 12, 15, 20].map((f) => <option key={f} value={f}>{f}</option>)}
              </Select>
            </label>
            <label className="flex flex-col gap-1 text-[0.8rem] text-ink-faint">
              {s.width} ({s.px})
              <Select className="w-24" data-testid="vg-width" value={width} onChange={(e) => setWidth(+e.target.value)}>
                {[240, 320, 480, 640].map((w) => <option key={w} value={w}>{w}</option>)}
              </Select>
            </label>
            <label className="flex flex-col gap-1 text-[0.8rem] text-ink-faint">
              {s.colours}
              <Select className="w-24" data-testid="vg-colours" value={colours} onChange={(e) => setColours(+e.target.value)}>
                {[32, 64, 128, 256].map((c) => <option key={c} value={c}>{c}</option>)}
              </Select>
            </label>
            <Check>
              <input type="checkbox" checked={loop} data-testid="vg-loop" onChange={(e) => setLoop(e.target.checked)} /> {s.loop}
            </Check>
          </div>

          <Button variant="primary" className="self-start" onClick={make} disabled={busy !== ''} data-testid="vg-make">
            <ScissorsIcon /> {s.make}
          </Button>
        </>
      )}

      {result && (
        <>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-body text-[0.68rem] uppercase tracking-[0.06em] text-ink-faint flex-1">{s.result}</span>
            <span className="text-[0.85rem] text-ink-faint font-mono" data-testid="vg-size">
              {(result.bytes / 1024 / 1024).toFixed(2)} MB · {result.frames} {s.frames}
            </span>
            <Button variant="primary" href={result.url} download={`${name}.gif`} data-testid="vg-download">
              <DownloadIcon /> {s.download}
            </Button>
          </div>
          <img src={result.url} alt="" className="max-w-full self-center rounded-md border border-[color:var(--line)]" data-testid="vg-result" />
          {big && <p className="text-[0.88rem] text-gold-500 rtl:font-ar" data-testid="vg-toobig">{s.tooLong}</p>}
        </>
      )}

      <Panel><p className="text-[0.85rem] text-ink-soft rtl:font-ar">{s.palette}</p></Panel>
    </Stack>
  )
}
