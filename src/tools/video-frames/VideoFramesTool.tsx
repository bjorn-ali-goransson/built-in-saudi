import { useEffect, useRef, useState } from 'react'
import { useLocale } from '../../i18n'
import { UploadIcon, DownloadIcon } from '../../components/icons'
import { Button, Stack, Spinner, FileError, Panel, Field, Input, Select, Seg, SegButton } from '../../components/ui'
import { setWorkInProgress } from '../../lib/workInProgress'
import { zipStore } from '../../lib/zip'

const WIP = 'video-frames'
const FORMATS = { png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp' } as const
type Fmt = keyof typeof FORMATS

const STR = {
  en: {
    pick: 'Choose a video', another: 'Choose another',
    hint: 'MP4, MOV, WebM, MKV — whatever your browser can play. The video is read on your device and never uploaded, which is the whole difference from the sites that want the file first.',
    failed: 'Your browser could not play that video, so no frame can be taken from it.',
    mode: 'Take', one: 'One frame', every: 'Every few seconds',
    at: 'At', secondsWord: 'seconds', interval: 'One frame every',
    format: 'Save as', quality: 'Quality',
    grab: 'Save this frame', grabAll: 'Save them all as a zip',
    working: 'Reading frames…',
    count: (n: number) => `${n} frames`,
    seekNote: 'A browser seeks to the nearest frame it can decode on its own, not to the exact millisecond — so on a video with widely spaced keyframes the picture you get may be a moment either side of the time you asked for. It is shown above before you save it, so you can nudge it.',
    size: 'Frame size',
  },
  ar: {
    pick: 'اختر مقطع فيديو', another: 'اختر ملفًا آخر',
    hint: 'MP4 وMOV وWebM وMKV — ما يستطيع متصفحك تشغيله. يُقرأ الفيديو على جهازك ولا يُرفع أبدًا، وهذا هو الفرق كله عن المواقع التي تطلب الملف أولًا.',
    failed: 'تعذّر على متصفحك تشغيل هذا الفيديو، فلا يمكن أخذ لقطة منه.',
    mode: 'خُذ', one: 'لقطة واحدة', every: 'كل بضع ثوانٍ',
    at: 'عند', secondsWord: 'ثانية', interval: 'لقطة كل',
    format: 'احفظ بصيغة', quality: 'الجودة',
    grab: 'احفظ هذه اللقطة', grabAll: 'احفظها كلها في ملف مضغوط',
    working: 'جارٍ قراءة اللقطات…',
    count: (n: number) => `${n} لقطة`,
    seekNote: 'يقفز المتصفح إلى أقرب لقطة يستطيع فك ترميزها وحدها، لا إلى الجزء من الثانية بالضبط — ففي فيديو تتباعد فيه اللقطات المفتاحية قد تحصل على صورة قبل الوقت المطلوب أو بعده بلحظة. وهي معروضة أعلاه قبل الحفظ حتى تعدّلها.',
    size: 'مقاس اللقطة',
  },
}

export default function VideoFramesTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const [url, setUrl] = useState('')
  const [name, setName] = useState('video')
  const [meta, setMeta] = useState<{ duration: number; w: number; h: number } | null>(null)
  const [mode, setMode] = useState<'one' | 'every'>('one')
  const [at, setAt] = useState(0)
  const [interval, setIntervalSec] = useState(5)
  const [fmt, setFmt] = useState<Fmt>('png')
  // Fixed rather than exposed: a quality slider on a single still is a control
  // nobody uses and one more thing to explain. PNG ignores it entirely.
  const quality = 0.92
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const videoRef = useRef<HTMLVideoElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => () => { setWorkInProgress(WIP, false) }, [])
  useEffect(() => () => { if (url) URL.revokeObjectURL(url) }, [url])

  function pick(f: File | undefined) {
    if (!f) return
    setError(''); setMeta(null); setAt(0)
    setName(f.name.replace(/\.[^.]+$/, '') || 'video')
    // No accept filter — Android's picker hides files it has not indexed.
    setUrl(URL.createObjectURL(f))
    setWorkInProgress(WIP, true)
  }

  function onLoaded() {
    const v = videoRef.current
    if (!v) return
    setMeta({ duration: v.duration || 0, w: v.videoWidth, h: v.videoHeight })
  }

  /** Seek and wait for the frame to actually be there before drawing it. */
  function seek(v: HTMLVideoElement, t: number): Promise<void> {
    return new Promise((resolve) => {
      // If it is already there, `seeked` never fires again and we would hang.
      if (Math.abs(v.currentTime - t) < 0.001) return resolve()
      const done = () => { v.removeEventListener('seeked', done); resolve() }
      v.addEventListener('seeked', done)
      v.currentTime = t
    })
  }

  async function frameAt(t: number): Promise<Blob | null> {
    const v = videoRef.current
    if (!v) return null
    await seek(v, t)
    const c = document.createElement('canvas')
    c.width = v.videoWidth
    c.height = v.videoHeight
    const ctx = c.getContext('2d')
    if (!ctx) return null
    ctx.drawImage(v, 0, 0)
    return new Promise((resolve) => c.toBlob(resolve, FORMATS[fmt], fmt === 'png' ? undefined : quality))
  }

  function save(blob: Blob, filename: string) {
    const u = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = u; a.download = filename; a.click()
    setTimeout(() => URL.revokeObjectURL(u), 1000)
  }

  const pad = (n: number, w = 3) => String(n).padStart(w, '0')

  async function grabOne() {
    setBusy(true)
    try {
      const blob = await frameAt(at)
      if (blob) save(blob, `${name}-${at.toFixed(1)}s.${fmt}`)
    } catch { setError(s.failed) } finally { setBusy(false) }
  }

  async function grabEvery() {
    if (!meta) return
    setBusy(true)
    try {
      const files: { name: string; bytes: Uint8Array }[] = []
      let i = 1
      for (let t = 0; t < meta.duration; t += interval) {
        const blob = await frameAt(t)
        if (!blob) continue
        files.push({ name: `${name}-${pad(i)}-${t.toFixed(1)}s.${fmt}`, bytes: new Uint8Array(await blob.arrayBuffer()) })
        i += 1
      }
      if (files.length) save(zipStore(files), `${name}-frames.zip`)
    } catch { setError(s.failed) } finally { setBusy(false) }
  }

  const shots = meta && interval > 0 ? Math.max(1, Math.ceil(meta.duration / interval)) : 0

  return (
    <Stack data-testid="video-frames">
      <div className="flex flex-wrap items-center gap-2">
        <input ref={fileRef} type="file" className="hidden" data-testid="vf-file" onChange={(e) => pick(e.target.files?.[0])} />
        <Button onClick={() => fileRef.current?.click()} data-testid="vf-pick">
          <UploadIcon /> {meta ? s.another : s.pick}
        </Button>
        {busy && <Spinner className="size-5" />}
        {busy && <span className="text-[0.9rem] text-ink-faint rtl:font-ar">{s.working}</span>}
      </div>

      {error && <FileError message={error} />}
      {!url && !error && <p className="text-ink-faint text-[0.95rem] rtl:font-ar">{s.hint}</p>}

      {url && (
        <video
          ref={videoRef}
          src={url}
          onLoadedMetadata={onLoaded}
          onError={() => setError(s.failed)}
          muted
          playsInline
          preload="auto"
          className="max-w-full rounded-md border border-[color:var(--line)]"
          data-testid="vf-video"
        />
      )}

      {meta && (
        <>
          <div className="grid gap-3 grid-cols-1 min-[620px]:grid-cols-2">
            <Field label={s.mode}>
              <Seg data-testid="vf-mode">
                <SegButton active={mode === 'one'} onClick={() => setMode('one')} data-testid="vf-mode-one">{s.one}</SegButton>
                <SegButton active={mode === 'every'} onClick={() => setMode('every')} data-testid="vf-mode-every">{s.every}</SegButton>
              </Seg>
            </Field>
            <Field label={s.format}>
              <Select value={fmt} data-testid="vf-format" onChange={(e) => setFmt(e.target.value as Fmt)}>
                <option value="png">PNG</option>
                <option value="jpg">JPG</option>
                <option value="webp">WebP</option>
              </Select>
            </Field>
          </div>

          {mode === 'one' ? (
            <Field label={`${s.at} ${at.toFixed(1)} ${s.secondsWord}`}>
              <input
                type="range"
                min={0}
                max={Math.max(0, meta.duration)}
                step={0.1}
                value={at}
                data-testid="vf-at"
                className="w-full accent-green-600"
                onChange={(e) => { const t = +e.target.value; setAt(t); const v = videoRef.current; if (v) v.currentTime = t }}
              />
            </Field>
          ) : (
            <Field label={s.interval}>
              <Input
                type="number"
                min={0.5}
                step={0.5}
                value={interval}
                data-testid="vf-interval"
                onChange={(e) => setIntervalSec(Math.max(0.5, +e.target.value || 1))}
              />
            </Field>
          )}

          <Panel className="gap-2">
            <div className="flex flex-wrap gap-x-8 gap-y-2">
              <div>
                <div className="text-[0.7rem] uppercase tracking-[0.05em] text-ink-faint">{s.size}</div>
                <div className="font-mono text-[1.15rem] text-ink" data-testid="vf-size">{meta.w} × {meta.h}</div>
              </div>
              {mode === 'every' && (
                <div>
                  <div className="text-[0.7rem] uppercase tracking-[0.05em] text-ink-faint">{s.every}</div>
                  <div className="font-mono text-[1.15rem] text-ink" data-testid="vf-count">{s.count(shots)}</div>
                </div>
              )}
            </div>
            <Button
              variant="primary"
              className="self-start"
              disabled={busy}
              onClick={mode === 'one' ? grabOne : grabEvery}
              data-testid="vf-save"
            >
              <DownloadIcon /> {mode === 'one' ? s.grab : s.grabAll}
            </Button>
          </Panel>

          <Panel><p className="text-[0.85rem] text-ink-soft rtl:font-ar" data-testid="vf-seek-note">{s.seekNote}</p></Panel>
        </>
      )}
    </Stack>
  )
}
