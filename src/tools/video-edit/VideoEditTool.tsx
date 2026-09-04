import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocale } from '../../i18n'
import { Button, FileError, Panel, Seg, SegButton, Spinner, Stack, Input, Check } from '../../components/ui'
import { DownloadIcon, UploadIcon, ScissorsIcon } from '../../components/icons'
import { setWorkInProgress } from '../../lib/workInProgress'
import {
  ASPECTS, activeAt, captionAt, cropRect, drawFrame, keptShare, outputSize, timeline, totalDuration,
  type Caption, type ClipInfo, type Crop,
} from './compose'
import type { ProbeInfo, RenderPlan, Req, Res } from './render.worker'

const WIP = 'video-edit'

// Omit over a union has to distribute, or neither variant's fields survive.
type ReqBody = Req extends infer T ? (T extends { id: number } ? Omit<T, 'id'> : never) : never

const STR = {
  en: {
    intro: 'Crop a clip to the shape a platform wants, join a few of them together, and put a caption on top — on your device. Nothing is uploaded.',
    pick: 'Choose a video',
    add: 'Add another clip',
    reading: 'Reading the video…',
    clips: 'Clips',
    joined: (n: number, d: string) => `${n} clip${n === 1 ? '' : 's'} · ${d} in total`,
    remove: 'Remove',
    up: 'Move earlier',
    down: 'Move later',
    shape: 'Shape',
    kept: (pct: number) => `Keeps ${pct}% of the picture`,
    keptWhy: 'A 16:9 recording cropped to 9:16 throws away more than two thirds of the frame, and whatever you were filming is rarely in the middle of what is left. Drag the picture to choose what survives.',
    zoom: 'Zoom',
    frame: 'The whole frame',
    result: 'What gets exported',
    dragHint: 'Drag to move the crop. Arrow keys nudge it.',
    captions: 'Captions',
    addCaption: 'Add a caption',
    text: 'Text',
    from: 'From',
    to: 'To',
    size: 'Size',
    colour: 'Colour',
    band: 'Band behind the text',
    captionWhy: 'The caption is drawn once, here, with this page’s own fonts — and that same picture is laid into every frame. So Arabic joins up and runs right to left the way the browser writes it, and the preview is not an approximation of the export, it is the export.',
    output: 'Output',
    quality: 'Quality',
    qualities: ['Smaller file', 'Normal', 'Sharper'],
    maxHeight: 'Largest side',
    noUpscale: 'Never larger than the source: upscaling adds pixels and no detail.',
    outSize: (w: number, h: number) => `${w}×${h}`,
    keepAudio: 'Keep the sound',
    audioCopied: 'The sound is copied across untouched — it is never re-encoded, so it loses nothing.',
    audioMixed: 'These clips store their sound differently, so it cannot be joined without re-encoding — which this browser cannot do. The export will be silent.',
    audioMissing: 'One of these clips has no sound, so the joined video would have a silent stretch. The export will be silent.',
    audioNone: 'This clip has no sound track.',
    exportBtn: 'Export',
    exporting: 'Encoding…',
    cancel: 'Cancel',
    progress: (d: number, t: number) => `${Math.round((d / Math.max(1, t)) * 100)}%`,
    resultTitle: 'Result',
    download: 'Download',
    outInfo: (mb: string, a: string) => `${mb} · ${a}`,
    withSound: 'with sound',
    silent: 'silent',
    again: 'Start again',
    trimNote: 'Whole clips, in this order. To shorten one first, trim it — that copies the frames instead of re-encoding them, so it costs nothing in quality.',
    trimName: 'Video Trimmer',
    big: 'These clips are large. Every frame is decoded and encoded again here, so this will take a while and use a lot of memory — a phone may run out.',
    unsupportedTitle: 'This browser cannot re-encode video',
    unsupportedBody: 'Cropping, joining and captioning all change what is in the picture, so the frames have to be decoded and encoded again. That needs WebCodecs with H.264, which this browser does not offer. Chrome, Edge and Safari 16.4 or later can; Firefox on Android cannot. Trimming a clip needs none of it and still works here.',
    trimLink: 'Trim a video instead',
    undecodable: 'This browser has no decoder for this clip, so it cannot be re-encoded here.',
    errors: {
      'not-mp4': 'This does not look like an MP4. Only MP4 and MOV files can be edited here — a WebM or MKV uses a different container that this tool cannot read.',
      'no-video': 'No video track was found in this file.',
      'no-tracks': 'No video or audio tracks were found in this file.',
      'no-encoder': 'This browser refused to encode at that size. Try a smaller output.',
      'no-frames': 'Nothing was decoded from these clips.',
      cancelled: 'Export cancelled.',
      generic: 'The video could not be exported.',
    } as Record<string, string>,
  },
  ar: {
    intro: 'اقتصّ المقطع بالشكل الذي تريده المنصّة، وادمج عدة مقاطع، وضع نصًّا فوقها — على جهازك. ولا يُرفع شيء.',
    pick: 'اختر فيديو',
    add: 'أضف مقطعًا آخر',
    reading: 'تُقرأ الفيديو…',
    clips: 'المقاطع',
    joined: (n: number, d: string) => `${n} مقطع · ${d} إجمالًا`,
    remove: 'إزالة',
    up: 'إلى الأمام',
    down: 'إلى الخلف',
    shape: 'الشكل',
    kept: (pct: number) => `يبقى ${pct}٪ من الصورة`,
    keptWhy: 'اقتصاص تسجيل ١٦:٩ إلى ٩:١٦ يرمي أكثر من ثلثي الإطار، وما كنت تصوّره نادرًا ما يكون في وسط ما تبقّى. اسحب الصورة لتختار ما يبقى منها.',
    zoom: 'التقريب',
    frame: 'الإطار كاملًا',
    result: 'ما سيُصدَّر',
    dragHint: 'اسحب لتحريك الاقتصاص. وتحرّكه مفاتيح الأسهم.',
    captions: 'النصوص',
    addCaption: 'أضف نصًّا',
    text: 'النص',
    from: 'من',
    to: 'إلى',
    size: 'الحجم',
    colour: 'اللون',
    band: 'شريط خلف النص',
    captionWhy: 'يُرسم النص مرة واحدة هنا بخطوط هذه الصفحة نفسها، ثم تُوضع الصورة ذاتها في كل إطار. فتتصل الحروف العربية وتجري من اليمين إلى اليسار كما يكتبها المتصفح، والمعاينة ليست تقريبًا للمُخرَج بل هي المُخرَج نفسه.',
    output: 'المُخرَج',
    quality: 'الجودة',
    qualities: ['ملف أصغر', 'عادية', 'أوضح'],
    maxHeight: 'أطول ضلع',
    noUpscale: 'لا يتجاوز المصدر أبدًا: التكبير يضيف بكسلات ولا يضيف تفصيلًا.',
    outSize: (w: number, h: number) => `${w}×${h}`,
    keepAudio: 'أبقِ الصوت',
    audioCopied: 'يُنسخ الصوت كما هو دون إعادة ترميز، فلا يفقد شيئًا.',
    audioMixed: 'تخزّن هذه المقاطع صوتها بصيغ مختلفة، فلا يمكن دمجه دون إعادة ترميز، وهذا ما لا يقدر عليه هذا المتصفح. سيخرج المقطع صامتًا.',
    audioMissing: 'أحد هذه المقاطع بلا صوت، فسيكون في الفيديو المدموج فراغ صامت. سيخرج المقطع صامتًا.',
    audioNone: 'لا يحتوي هذا المقطع على مسار صوت.',
    exportBtn: 'تصدير',
    exporting: 'يجري الترميز…',
    cancel: 'إلغاء',
    progress: (d: number, t: number) => `${Math.round((d / Math.max(1, t)) * 100)}٪`,
    resultTitle: 'النتيجة',
    download: 'تنزيل',
    outInfo: (mb: string, a: string) => `${mb} · ${a}`,
    withSound: 'بالصوت',
    silent: 'صامت',
    again: 'ابدأ من جديد',
    trimNote: 'المقاطع كاملة، بهذا الترتيب. ولتقصير أحدها أولًا اقتطعه — فالاقتطاع ينسخ الإطارات بدل إعادة ترميزها، فلا يكلّف شيئًا من الجودة.',
    trimName: 'قص الفيديو',
    big: 'هذه المقاطع كبيرة. يُفَكّ ترميز كل إطار ويُعاد ترميزه هنا، فسيستغرق ذلك وقتًا ويستهلك ذاكرة كبيرة — وقد تنفد ذاكرة الهاتف.',
    unsupportedTitle: 'هذا المتصفح لا يستطيع إعادة ترميز الفيديو',
    unsupportedBody: 'الاقتصاص والدمج وإضافة النص كلها تغيّر ما في الصورة، فلا بد من فك ترميز الإطارات وإعادة ترميزها. وهذا يحتاج WebCodecs مع H.264، وهو ما لا يوفّره هذا المتصفح. تقدر عليه كروم وإيدج وسفاري ١٦٫٤ فأحدث؛ ولا يقدر عليه فَيرفُكس على أندرويد. أما اقتطاع مقطع فلا يحتاج شيئًا من ذلك ويعمل هنا.',
    trimLink: 'اقتطع فيديو بدل ذلك',
    undecodable: 'لا يملك هذا المتصفح فاكّ ترميز لهذا المقطع، فلا يمكن إعادة ترميزه هنا.',
    errors: {
      'not-mp4': 'لا يبدو هذا ملف MP4. ولا يمكن هنا تحرير سوى ملفات MP4 وMOV — أما WebM أو MKV فحاويةٌ أخرى لا تقرأها هذه الأداة.',
      'no-video': 'لم يُعثر على مسار صورة في هذا الملف.',
      'no-tracks': 'لم يُعثر على مسارات صورة أو صوت في هذا الملف.',
      'no-encoder': 'رفض هذا المتصفح الترميز بهذا المقاس. جرّب مقاسًا أصغر.',
      'no-frames': 'لم يُفَكّ ترميز شيء من هذه المقاطع.',
      cancelled: 'أُلغي التصدير.',
      generic: 'تعذّر تصدير الفيديو.',
    } as Record<string, string>,
  },
} as const

/**
 * The longest side either preview canvas is drawn at.
 *
 * The previews repaint on every animation frame, so drawing them at the source
 * resolution means compositing a 4K frame sixty times a second on the main
 * thread — for a picture that is a few hundred pixels wide on screen. Scaling
 * costs nothing in fidelity here: the crop rectangle and the caption placement
 * are both proportional, so the preview is the same composition at a smaller
 * size, and the EXPORT is unaffected — it is drawn in the worker at full size.
 */
const PREVIEW_MAX = 540

/** Bits per pixel per second, at each quality. Multiplied by w×h×fps. */
const QUALITY = [0.05, 0.09, 0.15]
const HEIGHTS = [480, 720, 1080, 1440]

interface Clip { slot: number; file: File; url: string; info: ProbeInfo }

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
const mb = (b: number) => `${(b / 1048576).toFixed(1)} MB`

/** Arabic decides the text direction, not the UI locale — somebody writing an
 *  English caption on the Arabic side of the site wants a left-to-right line. */
const isRtl = (text: string) => /[؀-ۿݐ-ݿ]/.test(text)

/**
 * Draw one caption to its own bitmap, at output resolution.
 *
 * Everything about the way this text looks is decided here, once, on the page —
 * so the preview and the encoded frame are literally the same pixels.
 */
async function renderCaption(c: Caption, out: { width: number; height: number }): Promise<ImageBitmap | null> {
  const text = c.text.trim()
  if (!text) return null
  const px = Math.max(8, Math.round(c.size * out.height))
  const pad = Math.round(px * 0.4)
  const font = `600 ${px}px "IBM Plex Sans Arabic", "Hanken Grotesk", system-ui, sans-serif`

  const measure = document.createElement('canvas').getContext('2d')
  if (!measure) return null
  measure.font = font

  // Wrapped at 90% of the frame, because a caption that runs off the side is
  // the single commonest way one of these is ruined.
  const maxWidth = out.width * 0.9 - pad * 2
  const lines: string[] = []
  let line = ''
  for (const word of text.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word
    if (measure.measureText(next).width > maxWidth && line) { lines.push(line); line = word }
    else line = next
  }
  if (line) lines.push(line)

  const lineHeight = Math.round(px * 1.3)
  const width = Math.min(out.width, Math.ceil(Math.max(...lines.map((l) => measure.measureText(l).width)) + pad * 2))
  const height = lines.length * lineHeight + pad * 2

  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, width)
  canvas.height = Math.max(1, height)
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  if (c.band) {
    ctx.fillStyle = 'rgba(0,0,0,0.55)'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }
  ctx.font = font
  ctx.fillStyle = c.colour
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.direction = isRtl(text) ? 'rtl' : 'ltr'
  if (!c.band) {
    // A white caption on a white shirt is invisible; a thin dark outline is what
    // every broadcaster does instead of demanding a band.
    ctx.lineWidth = Math.max(2, px * 0.09)
    ctx.strokeStyle = 'rgba(0,0,0,0.75)'
    ctx.lineJoin = 'round'
  }
  lines.forEach((l, i) => {
    const y = pad + i * lineHeight + lineHeight / 2
    if (!c.band) ctx.strokeText(l, canvas.width / 2, y)
    ctx.fillText(l, canvas.width / 2, y)
  })
  return createImageBitmap(canvas)
}

export default function VideoEditTool() {
  const { locale } = useLocale()
  const s = STR[locale]

  const [supported, setSupported] = useState<boolean | null>(null)
  const [clips, setClips] = useState<Clip[]>([])
  const [sel, setSel] = useState(0)
  const [aspectId, setAspectId] = useState('9:16')
  const [zoom, setZoom] = useState(1)
  const [centre, setCentre] = useState({ x: 0.5, y: 0.5 })
  const [captions, setCaptions] = useState<Caption[]>([])
  const [quality, setQuality] = useState(1)
  const [maxHeight, setMaxHeight] = useState(1080)
  const [keepAudio, setKeepAudio] = useState(true)
  const [busy, setBusy] = useState<'' | 'read' | 'render'>('')
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [error, setError] = useState('')
  const [out, setOut] = useState<{ url: string; size: number; audio: string } | null>(null)

  const workerRef = useRef<Worker | null>(null)
  const reqId = useRef(0)
  const slotId = useRef(0)
  const pending = useRef(new Map<number, (r: Res) => void>())
  const videoRef = useRef<HTMLVideoElement>(null)
  const frameRef = useRef<HTMLCanvasElement>(null)
  const resultRef = useRef<HTMLCanvasElement>(null)
  const bitmaps = useRef<Map<string, ImageBitmap>>(new Map())
  const [bitmapTick, setBitmapTick] = useState(0)

  useEffect(() => {
    const w = new Worker(new URL('./render.worker.ts', import.meta.url), { type: 'module' })
    w.onmessage = (e: MessageEvent<Res>) => {
      if (e.data.kind === 'progress') { setProgress({ done: e.data.done, total: e.data.total }); return }
      const fn = pending.current.get(e.data.id)
      if (fn) { pending.current.delete(e.data.id); fn(e.data) }
    }
    workerRef.current = w
    return () => { w.terminate() }
  }, [])

  // Whether this browser can do the job at all is a question with an answer, so
  // it is asked once rather than discovered at export time.
  useEffect(() => {
    let live = true
    void (async () => {
      const ok = typeof VideoEncoder !== 'undefined' && typeof VideoDecoder !== 'undefined'
      if (!ok) { if (live) setSupported(false); return }
      try {
        const probe = await VideoEncoder.isConfigSupported({
          codec: 'avc1.42001f', width: 640, height: 360, bitrate: 1_000_000, avc: { format: 'avc' },
        })
        if (live) setSupported(!!probe.supported)
      } catch { if (live) setSupported(false) }
    })()
    return () => { live = false }
  }, [])

  useEffect(() => () => { setWorkInProgress(WIP, false) }, [])
  useEffect(() => { setWorkInProgress(WIP, clips.length > 0) }, [clips.length])

  const ask = useCallback((req: ReqBody, transfer: Transferable[] = []) => new Promise<Res>((resolve) => {
    const id = ++reqId.current
    pending.current.set(id, resolve)
    workerRef.current?.postMessage({ ...req, id } as Req, transfer)
  }), [])

  const infos: ClipInfo[] = useMemo(
    () => clips.map((c) => ({ name: c.file.name, durationSec: c.info.durationSec, width: c.info.width, height: c.info.height })),
    [clips],
  )
  const current = clips[Math.min(sel, clips.length - 1)]
  const sourceAspect = current ? current.info.width / current.info.height : 9 / 16
  const aspect = useMemo(() => {
    const found = ASPECTS.find((a) => a.id === aspectId)
    return found && found.aspect ? found.aspect : sourceAspect
  }, [aspectId, sourceAspect])

  const crop: Crop = useMemo(() => ({ aspect, cx: centre.x, cy: centre.y, zoom }), [aspect, centre, zoom])
  const size = useMemo(() => outputSize(infos, crop, maxHeight), [infos, crop, maxHeight])
  const kept = current ? Math.round(keptShare({ width: current.info.width, height: current.info.height }, crop) * 100) : 100
  const spans = useMemo(() => timeline(infos), [infos])
  const duration = useMemo(() => totalDuration(infos), [infos])

  const fps = current ? Math.max(1, Math.min(60, current.info.fps || 30)) : 30
  const bitrate = Math.round(size.width * size.height * fps * QUALITY[quality])

  /** Which of the three audio outcomes this set of clips is heading for. */
  const audioPlan = useMemo(() => {
    if (!clips.length) return 'none' as const
    if (clips.some((c) => !c.info.audio)) return clips.every((c) => !c.info.audio) ? 'none' as const : 'missing' as const
    const prints = new Set(clips.map((c) => c.info.audio?.fingerprint))
    return prints.size === 1 ? 'copy' as const : 'mixed' as const
  }, [clips])

  // Caption bitmaps are rebuilt whenever what they say, or how big the frame is,
  // changes. They are the thing that gets composited, in the preview and in the
  // export alike, so there is exactly one of them per caption.
  useEffect(() => {
    let live = true
    const build = async () => {
      const next = new Map<string, ImageBitmap>()
      for (const c of captions) {
        const bmp = await renderCaption(c, size)
        if (bmp) next.set(c.id, bmp)
      }
      if (!live) { next.forEach((b) => b.close()); return }
      bitmaps.current.forEach((b) => b.close())
      bitmaps.current = next
      setBitmapTick((n) => n + 1)
    }
    // Drawn AT ONCE with whatever face is loaded, and again once the web fonts
    // have settled. Awaiting `document.fonts.ready` before the first draw is
    // the obvious code and it makes the caption invisible until every font on
    // the page has resolved — which on a slow connection, or one where the font
    // host is simply unreachable, is tens of seconds of a preview that appears
    // to have ignored what was typed.
    void build()
    void document.fonts?.ready.then(() => { if (live) void build() })
    return () => { live = false }
  }, [captions, size.width, size.height])

  /** The time on the JOINED timeline that the preview is currently showing. */
  const previewTime = useCallback(() => {
    const v = videoRef.current
    const span = spans[Math.min(sel, spans.length - 1)]
    return (span?.start ?? 0) + (v?.currentTime ?? 0)
  }, [spans, sel])

  const paint = useCallback(() => {
    const v = videoRef.current
    if (!v || !current || !v.videoWidth) return
    const clip = { width: current.info.width, height: current.info.height }
    const rect = cropRect(clip, crop)

    // The whole frame, with everything outside the crop dimmed. Showing only
    // the result would hide the decision the tool is asking you to make.
    const fc = frameRef.current
    if (fc) {
      const k = Math.min(1, PREVIEW_MAX / Math.max(clip.width, clip.height))
      fc.width = Math.round(clip.width * k)
      fc.height = Math.round(clip.height * k)
      const ctx = fc.getContext('2d')
      if (ctx) {
        const x = rect.x * k, y = rect.y * k, w = rect.w * k, h = rect.h * k
        ctx.drawImage(v, 0, 0, fc.width, fc.height)
        ctx.fillStyle = 'rgba(0,0,0,0.55)'
        ctx.fillRect(0, 0, fc.width, y)
        ctx.fillRect(0, y + h, fc.width, fc.height - y - h)
        ctx.fillRect(0, y, x, h)
        ctx.fillRect(x + w, y, fc.width - x - w, h)
        ctx.strokeStyle = 'rgba(255,255,255,0.9)'
        ctx.lineWidth = 2
        ctx.strokeRect(x, y, w, h)
      }
    }

    const rc = resultRef.current
    if (rc) {
      const k = Math.min(1, PREVIEW_MAX / Math.max(size.width, size.height))
      const shown = { width: Math.max(2, Math.round(size.width * k)), height: Math.max(2, Math.round(size.height * k)) }
      rc.width = shown.width
      rc.height = shown.height
      const ctx = rc.getContext('2d')
      if (ctx) {
        // The SAME function the worker calls, with the same crop. Only the
        // destination size differs, and every caption is placed and scaled by
        // the same ratio — so this is the export, at preview size, rather than
        // a second opinion about what the export will look like.
        drawFrame(ctx, v, clip, crop, shown)
        const t = previewTime()
        for (const c of activeAt(captions, t)) {
          const bmp = bitmaps.current.get(c.id)
          if (!bmp) continue
          const w = bmp.width * k
          const h = bmp.height * k
          const at = captionAt(c, { width: w, height: h }, shown)
          ctx.drawImage(bmp, at.x, at.y, w, h)
        }
      }
    }
  }, [current, crop, size, captions, previewTime])

  // Repaint on every displayed frame while playing, and once whenever anything
  // that affects the picture changes.
  useEffect(() => {
    let raf = 0
    const loop = () => { paint(); raf = requestAnimationFrame(loop) }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [paint, bitmapTick])

  async function addFile(f: File | undefined | null) {
    if (!f) return
    setError('')
    setOut(null)
    setBusy('read')
    const slot = ++slotId.current
    const res = await ask({ kind: 'probe', slot, file: f })
    setBusy('')
    if (res.kind === 'error') {
      setError(s.errors[res.message] ?? s.errors['not-mp4'])
      return
    }
    if (res.kind !== 'probed') return
    setClips((list) => [...list, { slot, file: f, url: URL.createObjectURL(f), info: res.info }])
  }

  function removeClip(i: number) {
    // Outside the updater on purpose: React may run a state updater twice, and
    // revoking a URL or dropping a worker session twice is a side effect, not a
    // recomputation.
    const gone = clips[i]
    if (!gone) return
    URL.revokeObjectURL(gone.url)
    void ask({ kind: 'drop', slot: gone.slot })
    setClips((list) => list.filter((_, n) => n !== i))
    setSel(0)
    setOut(null)
  }

  function move(i: number, by: number) {
    setClips((list) => {
      const to = i + by
      if (to < 0 || to >= list.length) return list
      const next = [...list]
      const [item] = next.splice(i, 1)
      next.splice(to, 0, item)
      return next
    })
    setOut(null)
  }

  function addCaption() {
    const at = previewTime()
    setCaptions((list) => [...list, {
      id: `c${Date.now()}${list.length}`,
      text: '',
      x: 0.5,
      y: 0.82,
      size: 0.07,
      colour: '#ffffff',
      band: true,
      from: Math.max(0, Math.round(at * 10) / 10),
      to: Math.min(duration, Math.round((at + 3) * 10) / 10),
    }])
  }

  const setCaption = (id: string, patch: Partial<Caption>) =>
    setCaptions((list) => list.map((c) => (c.id === id ? { ...c, ...patch } : c)))

  function dragCrop(e: React.PointerEvent<HTMLCanvasElement>) {
    if (e.buttons !== 1 || !frameRef.current) return
    const r = frameRef.current.getBoundingClientRect()
    setCentre({
      x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)),
      y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)),
    })
  }

  function nudge(e: React.KeyboardEvent<HTMLCanvasElement>) {
    const step = e.shiftKey ? 0.05 : 0.01
    const by: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step],
    }
    const d = by[e.key]
    if (!d) return
    e.preventDefault()
    setCentre((c) => ({ x: Math.min(1, Math.max(0, c.x + d[0])), y: Math.min(1, Math.max(0, c.y + d[1])) }))
  }

  async function doExport() {
    if (!clips.length) return
    setBusy('render')
    setError('')
    setProgress({ done: 0, total: 0 })
    // Fresh bitmaps: an ImageBitmap handed to a worker in the transfer list is
    // gone from this side, and the preview still needs its copies.
    const planCaptions: RenderPlan['captions'] = []
    for (const c of captions) {
      const bmp = await renderCaption(c, size)
      if (bmp) planCaptions.push({ x: c.x, y: c.y, from: c.from, to: c.to, bitmap: bmp })
    }
    const plan: RenderPlan = {
      slots: clips.map((c) => c.slot),
      crop,
      out: size,
      bitrate,
      keepAudio: keepAudio && audioPlan === 'copy',
      captions: planCaptions,
    }
    const res = await ask({ kind: 'render', plan }, planCaptions.map((c) => c.bitmap))
    setBusy('')
    if (res.kind === 'error') { setError(s.errors[res.message] ?? s.errors.generic); return }
    if (res.kind !== 'rendered') return
    setOut((o) => {
      if (o) URL.revokeObjectURL(o.url)
      return { url: URL.createObjectURL(res.blob), size: res.blob.size, audio: res.audio }
    })
  }

  if (supported === false) {
    return (
      <Stack data-testid="video-edit">
        <Panel className="gap-2" data-testid="ve-unsupported">
          <p className="text-[0.95rem] font-semibold text-ink rtl:font-ar">{s.unsupportedTitle}</p>
          <p className="text-[0.9rem] text-ink-soft rtl:font-ar">{s.unsupportedBody}</p>
          <a className="text-[0.9rem] text-green-700 underline rtl:font-ar" href={`/${locale}/apps/video-trim`}>{s.trimLink}</a>
        </Panel>
      </Stack>
    )
  }

  return (
    <Stack data-testid="video-edit">
      {!clips.length && (
        <Panel className="gap-3">
          <p className="text-[0.95rem] text-ink-soft rtl:font-ar">{s.intro}</p>
          <label className="inline-flex items-center gap-2 self-start px-[1.15rem] py-[0.7rem] rounded-md border border-green-700 bg-green-600 text-[color:var(--primary-ink)] font-semibold text-[0.95rem] cursor-pointer">
            <UploadIcon /> {s.pick}
            {/* No `accept`: an image accept string sends Chrome on Android to the
                gallery picker, and the same trap applies to video. */}
            <input type="file" className="hidden" data-testid="ve-file"
              onChange={(e) => { void addFile(e.target.files?.[0]) }} />
          </label>
        </Panel>
      )}

      {error && <FileError message={error} />}

      {clips.reduce((n, c) => n + c.file.size, 0) > 300 * 1048576 && (
        <p className="text-[0.85rem] text-gold-500 rtl:font-ar" data-testid="ve-big">{s.big}</p>
      )}

      {busy === 'read' && (
        <p className="flex items-center gap-2 text-ink-faint rtl:font-ar" data-testid="ve-reading"><Spinner /> {s.reading}</p>
      )}

      {!!clips.length && current && (
        <>
          <section className="flex flex-col gap-2">
            <h2 className="font-body text-[0.68rem] uppercase tracking-[0.06em] text-ink-faint">{s.clips}</h2>
            <p className="text-[0.85rem] text-ink-faint" data-testid="ve-total">{s.joined(clips.length, fmt(duration))}</p>
            <ul className="flex flex-col gap-1">
              {clips.map((c, i) => (
                <li key={c.slot} data-testid={`ve-clip-${i}`}
                  className={`flex flex-wrap items-center gap-2 rounded-md border px-2 py-1 text-[0.85rem] ${i === sel ? 'border-green-700' : 'border-[color:var(--line)]'}`}>
                  <button type="button" className="border-0 bg-transparent p-0 text-start text-ink underline-offset-2 hover:underline"
                    onClick={() => setSel(i)} data-testid={`ve-select-${i}`}>{c.file.name}</button>
                  <span className="text-ink-faint font-mono">{c.info.width}×{c.info.height} · {fmt(c.info.durationSec)}</span>
                  {!c.info.decodable && <span className="text-gold-500 rtl:font-ar" data-testid={`ve-undecodable-${i}`}>{s.undecodable}</span>}
                  <span className="ms-auto flex gap-1">
                    <Button className="px-2 py-0.5" onClick={() => move(i, -1)} disabled={i === 0} data-testid={`ve-up-${i}`}>↑<span className="sr-only">{s.up}</span></Button>
                    <Button className="px-2 py-0.5" onClick={() => move(i, 1)} disabled={i === clips.length - 1} data-testid={`ve-down-${i}`}>↓<span className="sr-only">{s.down}</span></Button>
                    <Button className="px-2 py-0.5" onClick={() => removeClip(i)} data-testid={`ve-remove-${i}`}>×<span className="sr-only">{s.remove}</span></Button>
                  </span>
                </li>
              ))}
            </ul>
            <p className="text-[0.85rem] text-ink-soft rtl:font-ar" data-testid="ve-trim-note">
              {s.trimNote}{' '}
              <a className="text-green-700 underline" href={`/${locale}/apps/video-trim`}>{s.trimName}</a>
            </p>
            <label className="self-start text-[0.85rem] text-green-700 underline cursor-pointer rtl:font-ar">
              {s.add}
              <input type="file" className="hidden" data-testid="ve-add"
                onChange={(e) => { void addFile(e.target.files?.[0]); e.target.value = '' }} />
            </label>
          </section>

          <video ref={videoRef} src={current.url} controls playsInline data-testid="ve-video"
            className="w-full max-h-[34vh] rounded-md bg-black" />

          <div className="grid gap-3 min-[860px]:grid-cols-[1.4fr_1fr]">
            <div className="flex flex-col gap-1">
              <span className="font-body text-[0.68rem] uppercase tracking-[0.06em] text-ink-faint">{s.frame}</span>
              <canvas ref={frameRef} data-testid="ve-frame" tabIndex={0}
                onPointerDown={dragCrop} onPointerMove={dragCrop} onKeyDown={nudge}
                className="w-full rounded-md bg-black cursor-move touch-none" />
              <span className="text-[0.8rem] text-ink-faint rtl:font-ar">{s.dragHint}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="font-body text-[0.68rem] uppercase tracking-[0.06em] text-ink-faint">{s.result}</span>
              <canvas ref={resultRef} data-testid="ve-result"
                className="w-full max-h-[46vh] object-contain rounded-md bg-black" />
            </div>
          </div>

          <section className="flex flex-col gap-2">
            <h2 className="font-body text-[0.68rem] uppercase tracking-[0.06em] text-ink-faint">{s.shape}</h2>
            <Seg>
              {ASPECTS.map((a) => (
                <SegButton key={a.id} active={aspectId === a.id} onClick={() => setAspectId(a.id)} data-testid={`ve-aspect-${a.id}`}>
                  {locale === 'ar' ? a.labelAr : a.label}
                </SegButton>
              ))}
            </Seg>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.85rem]">
              <span className="text-ink-faint rtl:font-ar" data-testid="ve-kept">{s.kept(kept)}</span>
              <span className="text-ink-faint font-mono" data-testid="ve-out-size">{s.outSize(size.width, size.height)}</span>
              <label className="flex items-center gap-2 text-ink-faint ms-auto rtl:font-ar">
                {s.zoom}
                <input type="range" min={1} max={3} step={0.05} value={zoom} data-testid="ve-zoom"
                  onChange={(e) => setZoom(Number(e.target.value))} />
              </label>
            </div>
            <p className="text-[0.85rem] text-ink-soft rtl:font-ar">{s.keptWhy}</p>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="font-body text-[0.68rem] uppercase tracking-[0.06em] text-ink-faint">{s.captions}</h2>
            {captions.map((c, i) => (
              <div key={c.id} className="flex flex-col gap-2 rounded-md border border-[color:var(--line)] p-2" data-testid={`ve-caption-${i}`}>
                <Input value={c.text} placeholder={s.text} data-testid={`ve-caption-text-${i}`}
                  onChange={(e) => setCaption(c.id, { text: e.target.value })} />
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-[0.85rem]">
                  <label className="flex items-center gap-1 text-ink-faint rtl:font-ar">{s.from}
                    <Input type="number" min={0} max={duration} step={0.1} value={c.from} className="w-20"
                      data-testid={`ve-caption-from-${i}`}
                      onChange={(e) => setCaption(c.id, { from: Number(e.target.value) })} />
                  </label>
                  <label className="flex items-center gap-1 text-ink-faint rtl:font-ar">{s.to}
                    <Input type="number" min={0} max={duration} step={0.1} value={c.to} className="w-20"
                      data-testid={`ve-caption-to-${i}`}
                      onChange={(e) => setCaption(c.id, { to: Number(e.target.value) })} />
                  </label>
                  <label className="flex items-center gap-1 text-ink-faint rtl:font-ar">{s.size}
                    <input type="range" min={0.03} max={0.18} step={0.005} value={c.size} data-testid={`ve-caption-size-${i}`}
                      onChange={(e) => setCaption(c.id, { size: Number(e.target.value) })} />
                  </label>
                  <label className="flex items-center gap-1 text-ink-faint rtl:font-ar">{s.colour}
                    <input type="color" value={c.colour} data-testid={`ve-caption-colour-${i}`}
                      onChange={(e) => setCaption(c.id, { colour: e.target.value })} />
                  </label>
                  <Check>
                    <input type="checkbox" checked={c.band} data-testid={`ve-caption-band-${i}`}
                      onChange={(e) => setCaption(c.id, { band: e.target.checked })} />
                    <span className="rtl:font-ar">{s.band}</span>
                  </Check>
                  <Button className="px-2 py-0.5 ms-auto" data-testid={`ve-caption-remove-${i}`}
                    onClick={() => setCaptions((list) => list.filter((x) => x.id !== c.id))}>×</Button>
                </div>
              </div>
            ))}
            <Button className="self-start px-3 py-1" onClick={addCaption} data-testid="ve-caption-add">{s.addCaption}</Button>
            <p className="text-[0.85rem] text-ink-soft rtl:font-ar">{s.captionWhy}</p>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="font-body text-[0.68rem] uppercase tracking-[0.06em] text-ink-faint">{s.output}</h2>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[0.85rem]">
              <label className="flex items-center gap-2 text-ink-faint rtl:font-ar">{s.quality}
                <select className="rounded-md border border-[color:var(--line)] bg-[var(--surface)] px-2 py-1 text-ink"
                  value={quality} data-testid="ve-quality" onChange={(e) => setQuality(Number(e.target.value))}>
                  {s.qualities.map((q, i) => <option key={q} value={i}>{q}</option>)}
                </select>
              </label>
              <label className="flex items-center gap-2 text-ink-faint rtl:font-ar">{s.maxHeight}
                <select className="rounded-md border border-[color:var(--line)] bg-[var(--surface)] px-2 py-1 text-ink"
                  value={maxHeight} data-testid="ve-height" onChange={(e) => setMaxHeight(Number(e.target.value))}>
                  {HEIGHTS.map((h) => <option key={h} value={h}>{h}p</option>)}
                </select>
              </label>
              {audioPlan === 'copy' && (
                <Check>
                  <input type="checkbox" checked={keepAudio} data-testid="ve-keep-audio"
                    onChange={(e) => setKeepAudio(e.target.checked)} />
                  <span className="rtl:font-ar">{s.keepAudio}</span>
                </Check>
              )}
            </div>
            <p className="text-[0.8rem] text-ink-faint rtl:font-ar">{s.noUpscale}</p>
            <p className="text-[0.85rem] text-ink-soft rtl:font-ar" data-testid="ve-audio-note">
              {audioPlan === 'copy' ? s.audioCopied
                : audioPlan === 'mixed' ? s.audioMixed
                : audioPlan === 'missing' ? s.audioMissing
                : s.audioNone}
            </p>
          </section>

          <div className="flex flex-wrap items-center gap-3">
            <Button variant="primary" onClick={doExport} disabled={busy !== ''} data-testid="ve-export">
              <ScissorsIcon /> {busy === 'render' ? s.exporting : s.exportBtn}
            </Button>
            {busy === 'render' && (
              <>
                <span className="text-[0.85rem] text-ink-faint font-mono" data-testid="ve-progress">
                  {s.progress(progress.done, progress.total)}
                </span>
                <Button className="px-3 py-1" data-testid="ve-cancel"
                  onClick={() => { void ask({ kind: 'cancel' }) }}>{s.cancel}</Button>
              </>
            )}
          </div>
        </>
      )}

      {out && (
        <section className="flex flex-col gap-2" data-testid="ve-result-panel">
          <h2 className="font-body text-[0.68rem] uppercase tracking-[0.06em] text-ink-faint">{s.resultTitle}</h2>
          <video src={out.url} controls playsInline className="w-full max-h-[50vh] rounded-md bg-black" data-testid="ve-out-video" />
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="primary" href={out.url} download={`edited-${clips[0]?.file.name || 'video.mp4'}`} data-testid="ve-download">
              <DownloadIcon /> {s.download}
            </Button>
            <span className="text-[0.85rem] text-ink-faint font-mono" data-testid="ve-out-info">
              {s.outInfo(mb(out.size), out.audio === 'copied' ? s.withSound : s.silent)}
            </span>
          </div>
        </section>
      )}

      {!!clips.length && (
        <button type="button" className="self-start border-0 bg-transparent p-0 text-[0.85rem] text-green-700 underline cursor-pointer rtl:font-ar"
          data-testid="ve-again"
          onClick={() => {
            for (const c of clips) { URL.revokeObjectURL(c.url); void ask({ kind: 'drop', slot: c.slot }) }
            setClips([]); setCaptions([]); setSel(0)
            setOut((o) => { if (o) URL.revokeObjectURL(o.url); return null })
          }}>
          {s.again}
        </button>
      )}
    </Stack>
  )
}
