import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocale } from '../../i18n'
import { Button, Stack, Panel, FileError, Spinner } from '../../components/ui'
import { DownloadIcon, ScissorsIcon, UploadIcon } from '../../components/icons'
import { setWorkInProgress } from '../../lib/workInProgress'
import { snapStart, type Parsed } from './mp4'
import type { Req, Res } from './trim.worker'

const WIP = 'video-trim'

type ReqBody = Req extends infer T ? (T extends { id: number } ? Omit<T, 'id'> : never) : never

const STR = {
  en: {
    pick: 'Choose a video', drop: 'or drop one here',
    intro: 'Cut a section out of an MP4 without re-encoding it — the video and audio are copied across untouched, so nothing is re-compressed and a long recording trims in seconds. The file never leaves your device.',
    reading: 'Reading the video…',
    trimming: 'Trimming…',
    start: 'Start', end: 'End', duration: 'Length',
    setStart: 'Set start here', setEnd: 'Set end here',
    play: 'Play selection',
    trim: 'Trim', download: 'Download',
    result: 'Trimmed',
    keyframesLabel: 'Keyframe',
    snapNote: (from: number, to: number) =>
      `Your start mark at ${fmt(from)} moves back to ${fmt(to)} — the nearest keyframe before it.`,
    snapWhy: 'A frame in the middle of a group is stored as the difference from the frames before it, so a copy that started there would open on grey mush. Cutting anywhere else means re-encoding the video, which costs quality and time. The ticks on the bar are the points a start can land on; the end can go anywhere.',
    tracks: (v: string, a: string) => `${v}${a ? ` · ${a}` : ' · no audio'}`,
    noAudio: 'no audio',
    size: (a: number, b: number) => `${mb(a)} → ${mb(b)}`,
    savedTitle: 'Nothing was re-encoded',
    savedBody: 'The output is the same video, frame for frame — identical quality, because the compressed frames were copied rather than decoded and remade.',
    errors: {
      'not-mp4': 'This does not look like an MP4. Only MP4 and MOV files can be trimmed here — a WebM or MKV uses a different container that this tool cannot read.',
      'no-tracks': 'No video or audio tracks were found in this file.',
      'empty-selection': 'That selection contains no frames. Move the marks further apart.',
      'no-file': 'Choose a video first.',
      generic: 'This video could not be read.',
    } as Record<string, string>,
    big: 'That is a large file — the whole video has to fit in memory, so a very long recording may fail on a phone.',
    again: 'Choose another video',
  },
  ar: {
    pick: 'اختر مقطعًا', drop: 'أو أفلته هنا',
    intro: 'اقتطع جزءًا من ملف MP4 دون إعادة ترميزه — إذ تُنسخ الصورة والصوت كما هما، فلا يُعاد ضغط شيء ويُقتطع التسجيل الطويل في ثوانٍ. ولا يغادر الملف جهازك.',
    reading: 'جارٍ قراءة المقطع…',
    trimming: 'جارٍ الاقتطاع…',
    start: 'البداية', end: 'النهاية', duration: 'المدة',
    setStart: 'اجعلها البداية', setEnd: 'اجعلها النهاية',
    play: 'شغّل المحدد',
    trim: 'اقتطع', download: 'نزّل',
    result: 'المقطع المقتطع',
    keyframesLabel: 'إطار مفتاحي',
    snapNote: (from: number, to: number) =>
      `تنتقل بداية التحديد من ${fmt(from)} إلى ${fmt(to)} — أقرب إطار مفتاحي قبلها.`,
    snapWhy: 'الإطار في وسط المجموعة مخزَّن بوصفه فرقًا عن الإطارات التي قبله، فالنسخة التي تبدأ من هناك تفتح على تشويش رمادي. والقطع في غير هذه النقاط يستلزم إعادة ترميز الفيديو، وفي ذلك خسارة في الجودة والوقت. والعلامات على الشريط هي النقاط التي تصلح بداية؛ أما النهاية فتقع حيث شئت.',
    tracks: (v: string, a: string) => `${v}${a ? ` · ${a}` : ' · بلا صوت'}`,
    noAudio: 'بلا صوت',
    size: (a: number, b: number) => `${mb(a)} ← ${mb(b)}`,
    savedTitle: 'لم يُعَد ترميز شيء',
    savedBody: 'الملف الناتج هو المقطع نفسه إطارًا بإطار — بالجودة ذاتها، لأن الإطارات المضغوطة نُسخت ولم تُفكّ وتُعَد صناعتها.',
    errors: {
      'not-mp4': 'لا يبدو هذا ملف MP4. ولا يمكن هنا اقتطاع سوى ملفات MP4 وMOV — أما WebM أو MKV فحاويةٌ أخرى لا تقرأها هذه الأداة.',
      'no-tracks': 'لم يُعثر على مسارات صورة أو صوت في هذا الملف.',
      'empty-selection': 'لا إطارات في هذا التحديد. باعِد بين العلامتين.',
      'no-file': 'اختر مقطعًا أولًا.',
      generic: 'تعذّرت قراءة هذا المقطع.',
    } as Record<string, string>,
    big: 'هذا ملف كبير — إذ يجب أن يتّسع المقطع كاملًا في الذاكرة، وقد يفشل تسجيل طويل جدًا على الهاتف.',
    again: 'اختر مقطعًا آخر',
  },
}

function fmt(sec: number): string {
  if (!isFinite(sec) || sec < 0) sec = 0
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  const cs = Math.floor((sec % 1) * 100)
  return `${m}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`
}
const mb = (b: number) => `${(b / 1048576).toFixed(1)} MB`

export default function VideoTrimTool() {
  const { locale } = useLocale()
  const s = STR[locale]

  const [file, setFile] = useState<File | null>(null)
  const [url, setUrl] = useState('')
  const [parsed, setParsed] = useState<Parsed | null>(null)
  const [busy, setBusy] = useState<'' | 'parse' | 'trim'>('')
  const [error, setError] = useState('')
  const [start, setStart] = useState(0)
  const [end, setEnd] = useState(0)
  const [out, setOut] = useState<{ url: string; size: number; from: number; to: number } | null>(null)

  const workerRef = useRef<Worker | null>(null)
  const reqId = useRef(0)
  const pending = useRef(new Map<number, (r: Res) => void>())
  const videoRef = useRef<HTMLVideoElement>(null)
  const barRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const w = new Worker(new URL('./trim.worker.ts', import.meta.url), { type: 'module' })
    w.onmessage = (e: MessageEvent<Res>) => {
      // Stale replies are dropped: a second file picked mid-parse must not have
      // the first one's answer land on top of it.
      const fn = pending.current.get(e.data.id)
      if (fn) { pending.current.delete(e.data.id); fn(e.data) }
    }
    workerRef.current = w
    return () => { w.terminate() }
  }, [])

  useEffect(() => () => { setWorkInProgress(WIP, false) }, [])
  useEffect(() => { setWorkInProgress(WIP, !!file) }, [file])

  // Omit over a union has to distribute, or neither variant's fields survive.
  const ask = useCallback((req: ReqBody) => new Promise<Res>((resolve) => {
    const id = ++reqId.current
    pending.current.set(id, resolve)
    workerRef.current?.postMessage({ ...req, id } as Req)
  }), [])

  async function pickFile(f: File | undefined | null) {
    if (!f) return
    setError('')
    setParsed(null)
    setOut(null)
    setFile(f)
    setUrl((u) => { if (u) URL.revokeObjectURL(u); return URL.createObjectURL(f) })
    setBusy('parse')
    const res = await ask({ kind: 'parse', file: f })
    setBusy('')
    if (res.kind === 'error') {
      // mp4box fails in a lot of ways on a non-MP4; they all mean the same thing
      // to whoever picked the file.
      setError(s.errors[res.message] ?? (res.message.includes('no-tracks') ? s.errors['no-tracks'] : s.errors['not-mp4']))
      setFile(null)
      return
    }
    if (res.kind !== 'parsed') return
    setParsed(res.parsed)
    setStart(0)
    setEnd(res.parsed.durationSec)
  }

  const snapped = useMemo(
    () => (parsed?.keyframes.length ? snapStart(parsed.keyframes, start) : start),
    [parsed, start],
  )

  async function doTrim() {
    if (!parsed) return
    setBusy('trim')
    setError('')
    const res = await ask({ kind: 'trim', start, end })
    setBusy('')
    if (res.kind === 'error') { setError(s.errors[res.message] ?? s.errors.generic); return }
    if (res.kind !== 'trimmed') return
    setOut((o) => {
      if (o) URL.revokeObjectURL(o.url)
      return { url: URL.createObjectURL(res.blob), size: res.blob.size, from: res.originSec, to: res.endSec }
    })
  }

  // Clicking the bar moves whichever mark is nearer — no mode to remember.
  function scrub(e: React.MouseEvent<HTMLDivElement>) {
    if (!parsed || !barRef.current) return
    const r = barRef.current.getBoundingClientRect()
    const ratio = locale === 'ar'
      ? (r.right - e.clientX) / r.width
      : (e.clientX - r.left) / r.width
    const t = Math.max(0, Math.min(parsed.durationSec, ratio * parsed.durationSec))
    if (Math.abs(t - start) <= Math.abs(t - end)) setStart(Math.min(t, end - 0.05))
    else setEnd(Math.max(t, start + 0.05))
    if (videoRef.current) videoRef.current.currentTime = t
  }

  const pct = (t: number) => (parsed?.durationSec ? (t / parsed.durationSec) * 100 : 0)
  const videoTrack = parsed?.tracks.find((t) => t.type === 'video')
  const audioTrack = parsed?.tracks.find((t) => t.type === 'audio')

  return (
    <Stack data-testid="video-trim">
      {!file && (
        <Panel className="gap-3">
          <p className="text-[0.95rem] text-ink-soft rtl:font-ar">{s.intro}</p>
          <label className="inline-flex items-center gap-2 self-start px-[1.15rem] py-[0.7rem] rounded-md border border-green-700 bg-green-600 text-[color:var(--primary-ink)] font-semibold text-[0.95rem] cursor-pointer">
            <UploadIcon /> {s.pick}
            <input type="file" className="hidden" data-testid="vt-file"
              onChange={(e) => { void pickFile(e.target.files?.[0]) }} />
          </label>
        </Panel>
      )}

      {/* FileError carries its own data-testid ("file-error") on purpose, so
          eight dropzones cannot drift into eight different-looking warnings. */}
      {error && <FileError message={error} />}

      {busy === 'parse' && (
        <p className="flex items-center gap-2 text-ink-faint rtl:font-ar" data-testid="vt-reading"><Spinner /> {s.reading}</p>
      )}

      {file && file.size > 400 * 1048576 && (
        <p className="text-[0.85rem] text-gold-500 rtl:font-ar" data-testid="vt-big">{s.big}</p>
      )}

      {url && parsed && (
        <>
          <video ref={videoRef} src={url} controls playsInline data-testid="vt-video"
            className="w-full max-h-[60vh] rounded-md bg-black" />

          <div className="flex flex-col gap-2">
            {/* The bar: selection in green, keyframe ticks underneath. */}
            <div ref={barRef} onClick={scrub} data-testid="vt-bar"
              className="relative h-10 rounded-md bg-[var(--surface)] border border-[color:var(--line)] cursor-pointer overflow-hidden">
              <div className="absolute inset-y-0 bg-[color-mix(in_srgb,var(--color-green-400)_26%,transparent)]"
                style={{ insetInlineStart: `${pct(snapped)}%`, width: `${Math.max(0, pct(end) - pct(snapped))}%` }} />
              <div className="absolute inset-y-0 w-[2px] bg-green-700" style={{ insetInlineStart: `${pct(snapped)}%` }} data-testid="vt-start-mark" />
              <div className="absolute inset-y-0 w-[2px] bg-green-700" style={{ insetInlineStart: `${pct(end)}%` }} data-testid="vt-end-mark" />
              {/* Ticks are capped: a long video has thousands and the browser
                  should not be asked to lay them all out. */}
              {parsed.keyframes.length <= 600 && parsed.keyframes.map((k, i) => (
                <div key={i} title={`${s.keyframesLabel} ${fmt(k)}`}
                  className="absolute bottom-0 h-2 w-px bg-[color:var(--line)]"
                  style={{ insetInlineStart: `${pct(k)}%` }} />
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[0.85rem]">
              <span className="text-ink-faint">{s.start} <b className="font-mono text-ink" data-testid="vt-start">{fmt(snapped)}</b></span>
              <span className="text-ink-faint">{s.end} <b className="font-mono text-ink" data-testid="vt-end">{fmt(end)}</b></span>
              <span className="text-ink-faint">{s.duration} <b className="font-mono text-ink" data-testid="vt-duration">{fmt(Math.max(0, end - snapped))}</b></span>
              <span className="text-ink-faint ms-auto" data-testid="vt-tracks">
                {s.tracks(
                  videoTrack ? `${videoTrack.width}×${videoTrack.height} ${videoTrack.codec}` : '—',
                  audioTrack ? audioTrack.codec : '',
                )}
              </span>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button className="px-3 py-1" data-testid="vt-set-start"
                onClick={() => { const t = videoRef.current?.currentTime ?? 0; setStart(Math.min(t, end - 0.05)) }}>
                {s.setStart}
              </Button>
              <Button className="px-3 py-1" data-testid="vt-set-end"
                onClick={() => { const t = videoRef.current?.currentTime ?? 0; setEnd(Math.max(t, start + 0.05)) }}>
                {s.setEnd}
              </Button>
              <Button className="px-3 py-1" data-testid="vt-play"
                onClick={() => { if (videoRef.current) { videoRef.current.currentTime = snapped; void videoRef.current.play() } }}>
                {s.play}
              </Button>
            </div>

            {Math.abs(snapped - start) > 0.02 && (
              <p className="text-[0.85rem] text-gold-500 rtl:font-ar" data-testid="vt-snapped">{s.snapNote(start, snapped)}</p>
            )}
          </div>

          <Button variant="primary" className="self-start" onClick={doTrim} disabled={busy !== '' || end - snapped < 0.05} data-testid="vt-trim">
            <ScissorsIcon /> {busy === 'trim' ? s.trimming : s.trim}
          </Button>
        </>
      )}

      {out && (
        <section className="flex flex-col gap-2" data-testid="vt-result">
          <h2 className="font-body text-[0.68rem] uppercase tracking-[0.06em] text-ink-faint">{s.result}</h2>
          <video src={out.url} controls playsInline className="w-full max-h-[50vh] rounded-md bg-black" data-testid="vt-out-video" />
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="primary" href={out.url} download={`trimmed-${file?.name || 'video.mp4'}`} data-testid="vt-download">
              <DownloadIcon /> {s.download}
            </Button>
            <span className="text-[0.85rem] text-ink-faint font-mono">{s.size(file?.size ?? 0, out.size)}</span>
            <span className="text-[0.85rem] text-ink-faint font-mono">{fmt(out.from)} – {fmt(out.to)}</span>
          </div>
        </section>
      )}

      {parsed && (
        <Panel className="gap-1">
          <p className="text-[0.85rem] text-ink rtl:font-ar"><b>{s.savedTitle}</b></p>
          <p className="text-[0.85rem] text-ink-soft rtl:font-ar">{s.savedBody}</p>
          <p className="text-[0.85rem] text-ink-faint rtl:font-ar">{s.snapWhy}</p>
        </Panel>
      )}

      {file && (
        <label className="self-start text-[0.85rem] text-green-700 underline cursor-pointer">
          {s.again}
          <input type="file" className="hidden" data-testid="vt-file-again"
            onChange={(e) => { void pickFile(e.target.files?.[0]) }} />
        </label>
      )}
    </Stack>
  )
}
