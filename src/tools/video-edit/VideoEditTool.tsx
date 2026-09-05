import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocale } from '../../i18n'
import { Button, FileError, Panel, Spinner, Stack, Input } from '../../components/ui'
import {
  CropIcon, DownloadIcon, EraseIcon, MoreVIcon, PauseIcon, PlayIcon, TextIcon, TrashIcon,
} from '../../components/icons'
import { setWorkInProgress } from '../../lib/workInProgress'
import {
  ASPECTS, activeAt, applyCensors, captionAt, cropRect, drawFrame, keptShare, outputSize, timeline, totalDuration,
  type Caption, type Censor, type CensorMode, type ClipInfo, type Crop,
} from './compose'
import type { ProbeInfo, RenderPlan, Req, Res } from './render.worker'
import { createRecorder, formatReport, heap } from './diagnostics'

const WIP = 'video-edit'

// Omit over a union has to distribute, or neither variant's fields survive.
type ReqBody = Req extends infer T ? (T extends { id: number } ? Omit<T, 'id'> : never) : never

/**
 * Arabic-Indic digits.
 *
 * A template literal renders a number in Latin digits whatever the locale, so
 * an Arabic page interpolating one prints `42٪` — which this repo has now
 * shipped three times and caught three times, always because a test happened to
 * assert on a NUMBER rather than on prose.
 */
const arNum = (n: number) => n.toLocaleString('ar-SA')

const STR = {
  en: {
    heroTitle: 'Edit a video without uploading it',
    heroBody: 'Crop a clip to the shape a platform wants, join a few together, add a caption, and hide anything that should not be in the picture. Every frame is decoded and encoded again on your device — the file never leaves it.',
    pick: 'Choose a video',
    privacy: 'MP4 and MOV. Nothing is uploaded, and nothing is sent anywhere.',
    add: 'Add another clip',
    reading: 'Reading the video…',
    joined: (n: number, d: string) => `${n} clip${n === 1 ? '' : 's'} · ${d}`,
    remove: 'Remove',
    up: 'Move earlier',
    down: 'Move later',
    // The three modes, named on their buttons for a screen reader.
    modeCrop: 'Crop',
    modeCensor: 'Hide something',
    modeText: 'Caption',
    modeMore: 'Output settings',
    play: 'Play',
    pause: 'Pause',
    kept: (pct: number) => `Keeps ${pct}%`,
    keptWhy: 'A 16:9 recording cropped to 9:16 throws away more than two thirds of the frame, and whatever you were filming is rarely in the middle of what is left. Drag the picture to choose what survives; the arrow keys nudge it.',
    zoom: 'Zoom',
    addBox: 'Drag on the video to draw a box.',
    deleteBox: 'Delete this box',
    captions: 'Captions',
    addCaption: 'Add a caption',
    noCaption: 'Add a caption, then drag it where you want it.',
    text: 'Text',
    from: 'From',
    to: 'To',
    size: 'Size',
    colour: 'Colour',
    band: 'Band behind the text',
    captionWhy: 'The caption is drawn once, here, with this page’s own fonts — and that same picture is laid into every frame. So Arabic joins up and runs right to left the way the browser writes it, and what you see is what is encoded.',
    diagShow: 'Diagnostics',
    diagHide: 'Hide diagnostics',
    diagWhy: 'Nothing here is sent anywhere — it is text on this page. It carries no filename and none of the video, only what the browser reports about itself and about this clip. Copy it into a bug report if the preview keeps failing.',
    diagCopy: 'Copy',
    diagCopied: 'Copied',
    previewFailed: (code: number) => `This browser could not play this clip in the preview (media error ${code}), so there is no picture to aim the crop and the boxes at.`,
    previewStillExports: 'The export uses a different decoder, and this browser says it can decode this file — so exporting may still work. Please tell us the error number above if it does not.',
    modeBlock: 'Solid',
    modePixelate: 'Pixelate',
    modeBlur: 'Blur',
    censorWhy: 'A solid box is the default because it is the only one that removes anything. Pixelating and blurring both work by throwing away resolution — and resolution comes back out of a video in a way it does not out of a photo: the mosaic grid is fixed to the frame while your subject moves through it, so every frame samples the same face on a different grid. Reconstructing a pixelated number plate from 64 frames — 2.1 seconds — recovers 98.6% of it, against nothing at all from a single frame.',
    censorMoves: 'If what you are hiding moves, make the box big enough for the whole path, or add a second box for the later part. A box that is right for one second and wrong for the next has published the thing you were hiding.',
    censorAudio: 'This hides the picture and not the sound. The audio is copied across untouched, so a name that is spoken is still spoken.',
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
    heroTitle: 'حرّر الفيديو دون رفعه',
    heroBody: 'اقتصّ المقطع بالشكل الذي تريده المنصّة، وادمج عدة مقاطع، وأضف نصًّا، واحجب ما لا ينبغي أن يظهر. يُفَكّ ترميز كل إطار ويُعاد ترميزه على جهازك — ولا يغادر الملفُ جهازك أبدًا.',
    pick: 'اختر فيديو',
    privacy: 'صيغتا MP4 وMOV. لا يُرفع شيء، ولا يُرسل شيء إلى أي مكان.',
    add: 'أضف مقطعًا آخر',
    reading: 'جارٍ قراءة الفيديو…',
    joined: (n: number, d: string) => `${n} مقطع · ${d}`,
    remove: 'إزالة',
    up: 'إلى الأمام',
    down: 'إلى الخلف',
    modeCrop: 'اقتصاص',
    modeCensor: 'إخفاء جزء',
    modeText: 'نص',
    modeMore: 'إعدادات المُخرَج',
    play: 'تشغيل',
    pause: 'إيقاف',
    kept: (pct: number) => `يبقى ${arNum(pct)}٪`,
    keptWhy: 'اقتصاص تسجيل ١٦:٩ إلى ٩:١٦ يرمي أكثر من ثلثي الإطار، وما كنت تصوّره نادرًا ما يكون في وسط ما تبقّى. اسحب الصورة لتختار ما يبقى منها، وتحرّكها مفاتيح الأسهم.',
    zoom: 'التقريب',
    addBox: 'اسحب على الفيديو لترسم مربّعًا.',
    deleteBox: 'احذف هذا المربّع',
    captions: 'النصوص',
    addCaption: 'أضف نصًّا',
    noCaption: 'أضف نصًّا ثم اسحبه إلى حيث تريد.',
    text: 'النص',
    from: 'من',
    to: 'إلى',
    size: 'الحجم',
    colour: 'اللون',
    band: 'شريط خلف النص',
    captionWhy: 'يُرسم النص مرة واحدة هنا بخطوط هذه الصفحة نفسها، ثم تُوضع الصورة ذاتها في كل إطار. فتتصل الحروف العربية وتجري من اليمين إلى اليسار كما يكتبها المتصفح، وما تراه هو ما يُرمَّز.',
    diagShow: 'تشخيص',
    diagHide: 'إخفاء التشخيص',
    diagWhy: 'لا يُرسَل شيء مما هنا إلى أي مكان — إنما هو نص على هذه الصفحة. ولا يحمل اسم الملف ولا شيئًا من الفيديو، بل ما يذكره المتصفح عن نفسه وعن هذا المقطع فقط. انسخه في تقرير عطل إن استمرت المعاينة في الفشل.',
    diagCopy: 'نسخ',
    diagCopied: 'نُسخ',
    previewFailed: (code: number) => `تعذّر على هذا المتصفح تشغيل المقطع في المعاينة (خطأ وسائط ${code})، فلا صورة يستهدفها الاقتصاص ولا المربّعات.`,
    previewStillExports: 'ويستخدم التصدير فاكّ ترميز آخر، وهذا المتصفح يقول إنه يستطيع فك ترميز هذا الملف — فقد ينجح التصدير رغم ذلك. أخبرنا برقم الخطأ أعلاه إن لم ينجح.',
    modeBlock: 'حجب كامل',
    modePixelate: 'بكسلة',
    modeBlur: 'تمويه',
    censorWhy: 'الحجب الكامل هو الأصل لأنه الوحيد الذي يزيل شيئًا فعلًا. أما البكسلة والتمويه فيعملان بإسقاط الدقّة، والدقّة تعود من الفيديو بما لا تعود به من الصورة الواحدة: شبكة البكسلة ثابتة على الإطار بينما يتحرك من تخفيه خلالها، فيلتقط كل إطار الوجه نفسه على شبكة مختلفة. وإعادة بناء لوحة سيارة مبكسلة من ٦٤ إطارًا — أي ٢٫١ ثانية — تستردّ ٩٨٫٦٪ منها، مقابل لا شيء من إطار واحد.',
    censorMoves: 'إن كان ما تخفيه يتحرك، فوسّع المربّع ليغطي مساره كله، أو أضف مربّعًا ثانيًا للجزء التالي. فمربّعٌ يصيب في ثانية ويخطئ في التي تليها قد نشر ما كنت تخفيه.',
    censorAudio: 'هذا يخفي الصورة لا الصوت. فالصوت يُنسخ كما هو، والاسم المنطوق يبقى منطوقًا.',
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
    progress: (d: number, t: number) => `${arNum(Math.round((d / Math.max(1, t)) * 100))}٪`,
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
 * The longest side the stage canvas is drawn at.
 *
 * It repaints on every animation frame, so drawing at the source resolution
 * means compositing a 4K frame sixty times a second on the main thread for a
 * picture a few hundred pixels wide on screen. Scaling costs nothing in
 * fidelity: the crop, the boxes and the captions are all proportional, so this
 * is the same composition at a smaller size, and the EXPORT is untouched — the
 * worker draws it at full size.
 */
const PREVIEW_MAX = 720

/** Bits per pixel per second, at each quality. Multiplied by w×h×fps. */
const QUALITY = [0.05, 0.09, 0.15]
const HEIGHTS = [480, 720, 1080, 1440]

type Mode = 'crop' | 'censor' | 'text' | 'more'

interface Clip { slot: number; file: File; url: string; info: ProbeInfo }

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
const mb = (b: number) => `${(b / 1048576).toFixed(1)} MB`
const clamp01 = (n: number) => Math.min(1, Math.max(0, n))

/** Arabic decides the text direction, not the UI locale — somebody writing an
 *  English caption on the Arabic side of the site wants a left-to-right line. */
const isRtl = (text: string) => /[؀-ۿݐ-ݿ]/.test(text)

/**
 * Draw one caption to its own bitmap, at output resolution.
 *
 * Everything about the way this text looks is decided here, once, on the page —
 * so the stage and the encoded frame are literally the same pixels.
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

/** What the pointer is doing to the picture right now. */
type Drag =
  | { kind: 'pan'; px: number; py: number; cx: number; cy: number }
  | { kind: 'draw'; fx: number; fy: number }
  | { kind: 'move'; id: string; ox: number; oy: number }
  | { kind: 'resize'; id: string }
  | { kind: 'caption'; id: string; ox: number; oy: number }

export default function VideoEditTool() {
  const { locale } = useLocale()
  const s = STR[locale]

  const [supported, setSupported] = useState<boolean | null>(null)
  const [clips, setClips] = useState<Clip[]>([])
  const [sel, setSel] = useState(0)
  const [mode, setMode] = useState<Mode>('crop')
  const [aspectId, setAspectId] = useState('9:16')
  const [zoom, setZoom] = useState(1)
  const [centre, setCentre] = useState({ x: 0.5, y: 0.5 })
  const [captions, setCaptions] = useState<Caption[]>([])
  const [censors, setCensors] = useState<Censor[]>([])
  const [pickedBox, setPickedBox] = useState<string | null>(null)
  const [pickedCaption, setPickedCaption] = useState<string | null>(null)
  const [quality, setQuality] = useState(1)
  const [maxHeight, setMaxHeight] = useState(1080)
  const [keepAudio, setKeepAudio] = useState(true)
  const [busy, setBusy] = useState<'' | 'read' | 'render'>('')
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [error, setError] = useState('')
  const [previewError, setPreviewError] = useState(0)
  const [showDiag, setShowDiag] = useState(false)
  const [copied, setCopied] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [pos, setPos] = useState(0)
  const [out, setOut] = useState<{ url: string; size: number; audio: string } | null>(null)

  const workerRef = useRef<Worker | null>(null)
  const reqId = useRef(0)
  const slotId = useRef(0)
  const pending = useRef(new Map<number, (r: Res) => void>())
  const videoRef = useRef<HTMLVideoElement>(null)
  const stageRef = useRef<HTMLCanvasElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const bitmaps = useRef<Map<string, ImageBitmap>>(new Map())
  // The box being drawn lives in a REF, not in state, and `paint` reads it on
  // the next animation frame — the rAF loop is already repainting, so a drag
  // needs no render of its own and this way it does not cause one per
  // `pointermove`.
  const drawingRef = useRef<Censor | null>(null)
  const dragRef = useRef<Drag | null>(null)
  const [bitmapTick, setBitmapTick] = useState(0)
  const diag = useRef(createRecorder())
  const heapAtPick = useRef<ReturnType<typeof heap>>(null)
  const wasHidden = useRef(false)

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

  // Chrome on Android drops media resources when a tab goes to the background,
  // and a long upload is exactly when somebody switches away — so whether that
  // happened is a fact the report has to carry rather than leave to memory.
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'hidden') wasHidden.current = true
      diag.current.mark(`tab ${document.visibilityState}`)
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
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
  // changes. They are the thing that gets composited, on the stage and in the
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
    // have settled. Awaiting `document.fonts.ready` before the first draw makes
    // a caption invisible until every font on the page has resolved — tens of
    // seconds on a slow connection, or one where the font host is unreachable.
    void build()
    void document.fonts?.ready.then(() => { if (live) void build() })
    return () => { live = false }
  }, [captions, size.width, size.height])

  /** The time on the JOINED timeline that the stage is currently showing. */
  const spanStart = spans[Math.min(sel, Math.max(0, spans.length - 1))]?.start ?? 0
  const t = spanStart + pos
  const previewTime = useCallback(() => {
    const v = videoRef.current
    const span = spans[Math.min(sel, spans.length - 1)]
    return (span?.start ?? 0) + (v?.currentTime ?? 0)
  }, [spans, sel])

  const paint = useCallback(() => {
    const v = videoRef.current
    const rc = stageRef.current
    if (!v || !rc || !current || !v.videoWidth) return
    const clip = { width: current.info.width, height: current.info.height }
    const k = Math.min(1, PREVIEW_MAX / Math.max(size.width, size.height))
    const shown = { width: Math.max(2, Math.round(size.width * k)), height: Math.max(2, Math.round(size.height * k)) }
    rc.width = shown.width
    rc.height = shown.height
    const ctx = rc.getContext('2d')
    if (!ctx) return
    // The SAME functions the worker calls, with the same crop and the same
    // boxes. Only the destination size differs, and everything on top is placed
    // by the same ratio — so the stage IS the export at stage size, not a
    // second opinion about what the export will look like. THIS IS THE ONLY
    // VIEW: there is no separate result preview to disagree with it.
    drawFrame(ctx, v, clip, crop, shown)
    const now = previewTime()
    const inProgress = drawingRef.current
    applyCensors(ctx, inProgress ? [...censors, inProgress] : censors, now, shown)
    for (const c of activeAt(captions, now)) {
      const bmp = bitmaps.current.get(c.id)
      if (!bmp) continue
      const w = bmp.width * k
      const h = bmp.height * k
      const at = captionAt(c, { width: w, height: h }, shown)
      ctx.drawImage(bmp, at.x, at.y, w, h)
    }
  }, [current, crop, size, captions, censors, previewTime])

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
    setPreviewError(0)
    if (!clips.length) diag.current.reset()
    heapAtPick.current = heap()
    diag.current.mark(`pick (${(f.size / 1048576).toFixed(1)} MB)`)
    const slot = ++slotId.current
    // Minted BEFORE the probe, not after. The worker reads the whole file to
    // demux it, which on a phone is seconds and a second copy of it in memory;
    // handing the URL over first lets the browser start decoding the picture
    // from the file directly instead of queueing behind that. It is also a side
    // effect, so it stays out of the state updater — the fix `removeClip` carries.
    const url = URL.createObjectURL(f)
    diag.current.mark('preview url created, probe sent')
    const res = await ask({ kind: 'probe', slot, file: f })
    diag.current.mark(res.kind === 'probed'
      ? `probe done (${(res.info.retainedBytes / 1048576).toFixed(1)} MB retained)`
      : `probe failed (${res.kind === 'error' ? res.message : res.kind})`)
    setBusy('')
    if (res.kind === 'error') {
      URL.revokeObjectURL(url)
      setError(s.errors[res.message] ?? s.errors['not-mp4'])
      return
    }
    if (res.kind !== 'probed') { URL.revokeObjectURL(url); return }
    setClips((list) => [...list, { slot, file: f, url, info: res.info }])
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
    const id = `c${Date.now()}${captions.length}`
    setCaptions((list) => [...list, {
      id,
      text: '',
      x: 0.5,
      y: 0.82,
      size: 0.07,
      colour: '#ffffff',
      band: true,
      from: Math.max(0, Math.round(t * 10) / 10),
      to: Math.min(duration, Math.round((t + 3) * 10) / 10),
    }])
    setPickedCaption(id)
  }

  const setCaption = (id: string, patch: Partial<Caption>) =>
    setCaptions((list) => list.map((c) => (c.id === id ? { ...c, ...patch } : c)))
  const setCensor = (id: string, patch: Partial<Censor>) =>
    setCensors((list) => list.map((c) => (c.id === id ? { ...c, ...patch } : c)))

  /** Pointer position as a fraction of the OUTPUT frame. */
  function at(e: React.PointerEvent) {
    const r = overlayRef.current?.getBoundingClientRect()
    if (!r) return { x: 0.5, y: 0.5 }
    return { x: clamp01((e.clientX - r.left) / r.width), y: clamp01((e.clientY - r.top) / r.height) }
  }

  function down(e: React.PointerEvent<HTMLDivElement>) {
    if (e.button !== 0) return
    const p = at(e)
    overlayRef.current?.setPointerCapture(e.pointerId)
    if (mode === 'censor') {
      dragRef.current = { kind: 'draw', fx: p.x, fy: p.y }
      drawingRef.current = {
        id: `z${Date.now()}`, x: p.x, y: p.y, w: 0, h: 0, mode: 'block',
        from: Math.max(0, Math.round(t * 10) / 10),
        to: Math.min(duration, Math.round((t + 3) * 10) / 10),
      }
      setPickedBox(null)
      return
    }
    // Crop mode pans the PICTURE, not a rectangle: the frame stays where it is
    // and the image slides under it. That is the model every phone gallery uses,
    // and it is the only one that keeps the stage showing nothing but output.
    if (mode === 'crop') dragRef.current = { kind: 'pan', px: p.x, py: p.y, cx: centre.x, cy: centre.y }
  }

  function moveDrag(e: React.PointerEvent<HTMLDivElement>) {
    const d = dragRef.current
    if (!d || !current) return
    const p = at(e)
    if (d.kind === 'pan') {
      // A drag of one output width moves the crop by one crop width, so the
      // picture tracks the finger exactly.
      const r = cropRect({ width: current.info.width, height: current.info.height }, crop)
      const dx = (p.x - d.px) * (r.w / current.info.width)
      const dy = (p.y - d.py) * (r.h / current.info.height)
      setCentre({ x: clamp01(d.cx - dx), y: clamp01(d.cy - dy) })
      return
    }
    if (d.kind === 'draw') {
      const box = drawingRef.current
      if (!box) return
      box.x = Math.min(d.fx, p.x)
      box.y = Math.min(d.fy, p.y)
      box.w = Math.abs(p.x - d.fx)
      box.h = Math.abs(p.y - d.fy)
      return
    }
    if (d.kind === 'move') {
      setCensors((list) => list.map((c) => (c.id === d.id
        ? { ...c, x: clamp01(Math.min(1 - c.w, p.x - d.ox)), y: clamp01(Math.min(1 - c.h, p.y - d.oy)) }
        : c)))
      return
    }
    if (d.kind === 'resize') {
      setCensors((list) => list.map((c) => (c.id === d.id
        ? { ...c, w: Math.max(0.02, Math.min(1 - c.x, p.x - c.x)), h: Math.max(0.02, Math.min(1 - c.y, p.y - c.y)) }
        : c)))
      return
    }
    if (d.kind === 'caption') {
      setCaption(d.id, { x: clamp01(p.x - d.ox), y: clamp01(p.y - d.oy) })
    }
  }

  function up(e: React.PointerEvent<HTMLDivElement>) {
    const d = dragRef.current
    dragRef.current = null
    if (overlayRef.current?.hasPointerCapture(e.pointerId)) overlayRef.current.releasePointerCapture(e.pointerId)
    if (d?.kind !== 'draw') return
    const box = drawingRef.current
    drawingRef.current = null
    // A stray click is not a box. Anything under about a fiftieth of the frame
    // is a misclick, and committing it would leave invisible specks that still
    // count as censors.
    if (box && box.w > 0.02 && box.h > 0.02) {
      setCensors((list) => [...list, box])
      setPickedBox(box.id)
    }
  }

  function nudge(e: React.KeyboardEvent<HTMLDivElement>) {
    if (mode !== 'crop') return
    const step = e.shiftKey ? 0.05 : 0.01
    const by: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step],
    }
    const d = by[e.key]
    if (!d) return
    e.preventDefault()
    setCentre((c) => ({ x: clamp01(c.x + d[0]), y: clamp01(c.y + d[1]) }))
  }

  /** The diagnostics block. Built on render so it is current when it is read. */
  function report(): string {
    const v = videoRef.current
    const c = clips[Math.min(sel, clips.length - 1)]
    const name = c?.file.name ?? ''
    const dot = name.lastIndexOf('.')
    return formatReport({
      marks: diag.current.marks(),
      // The EXTENSION only. The report that prompted all this was called
      // `Screen_Recording_…_WhatsApp.mp4`, and this block exists to be pasted
      // somewhere else.
      extension: dot > 0 ? name.slice(dot + 1).toLowerCase().slice(0, 8) : 'unknown',
      fileBytes: c?.file.size ?? 0,
      clipCount: clips.length,
      width: c?.info.width ?? 0,
      height: c?.info.height ?? 0,
      durationSec: c?.info.durationSec ?? 0,
      codec: c?.info.videoCodec ?? 'unknown',
      decodable: !!c?.info.decodable,
      sampleCount: c?.info.sampleCount ?? 0,
      retainedBytes: c?.info.retainedBytes ?? 0,
      errorCode: previewError,
      errorMessage: v?.error?.message ?? '',
      readyState: v?.readyState ?? -1,
      networkState: v?.networkState ?? -1,
      wasHidden: wasHidden.current,
      heapAtPick: heapAtPick.current,
      heapNow: heap(),
    })
  }

  async function doExport() {
    if (!clips.length) return
    setBusy('render')
    setError('')
    setProgress({ done: 0, total: 0 })
    diag.current.mark(`export started (${size.width}×${size.height})`)
    // Fresh bitmaps: an ImageBitmap handed to a worker in the transfer list is
    // gone from this side, and the stage still needs its copies.
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
      censors,
    }
    const res = await ask({ kind: 'render', plan }, planCaptions.map((c) => c.bitmap))
    // Whether the export works while the preview does not is exactly what
    // separates "only `<video>` is affected" from "the whole media stack is".
    diag.current.mark(res.kind === 'rendered'
      ? `export done (${(res.blob.size / 1048576).toFixed(1)} MB, audio ${res.audio})`
      : `export failed (${res.kind === 'error' ? res.message : res.kind})`)
    setBusy('')
    if (res.kind === 'error') { setError(s.errors[res.message] ?? s.errors.generic); return }
    if (res.kind !== 'rendered') return
    setOut((o) => {
      if (o) URL.revokeObjectURL(o.url)
      return { url: URL.createObjectURL(res.blob), size: res.blob.size, audio: res.audio }
    })
  }

  function togglePlay() {
    const v = videoRef.current
    if (!v) return
    if (v.paused) void v.play()
    else v.pause()
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

  // ---------------------------------------------------------------- intake ---
  // Full-bleed green intro, the shape the CV optimizer uses: one sentence about
  // what this is and one button, rather than a panel of controls nobody can act
  // on until a file exists.
  //
  // It does NOT carry the CV tool's negative top margin. That cancels the
  // page's top padding to dock the band flush to the navbar, which works there
  // because that tool is `stable` and `ToolPage` renders nothing above it. This
  // one is `beta`, so the badge — the thing that says the answer can go stale
  // without the code changing — sits in exactly that space, and pulling a green
  // band over it would hide the one line on the page that qualifies everything
  // below it.
  if (!clips.length) {
    return (
      <Stack data-testid="video-edit">
        <div className="mx-[calc(50%-50vw)] w-screen max-w-[100vw] bg-green-600 text-sand-100">
          <div className="wrap py-[clamp(1.6rem,4.5vw,2.4rem)] flex flex-col gap-3">
            <h1 className="font-display rtl:font-ar text-[clamp(1.5rem,4.5vw,2.1rem)] font-bold leading-tight" style={{ color: 'var(--sand-100)' }}>
              {s.heroTitle}
            </h1>
            <p className="text-[0.98rem] leading-relaxed opacity-90 max-w-[46rem] rtl:font-ar">{s.heroBody}</p>
            <div className="flex flex-wrap items-center gap-3 mt-1">
              <label className="inline-flex self-start">
                {/* No `accept`: an image accept string sends Chrome on Android to
                    the gallery picker, and the same trap applies to video. */}
                <input type="file" className="sr-only" data-testid="ve-file"
                  onChange={(e) => { void addFile(e.target.files?.[0]) }} />
                <span className="cursor-pointer inline-flex items-center gap-2 rounded-md bg-white text-green-700 px-4 py-2 text-[0.9rem] font-semibold hover:bg-sand-100 rtl:font-ar">
                  {s.pick}
                </span>
              </label>
              {busy === 'read' && (
                <span className="inline-flex items-center gap-2 text-[0.9rem] opacity-90 rtl:font-ar" data-testid="ve-reading">
                  <Spinner /> {s.reading}
                </span>
              )}
            </div>
            <p className="text-[0.82rem] opacity-80 rtl:font-ar">{s.privacy}</p>
          </div>
        </div>
        {error && <FileError message={error} />}
      </Stack>
    )
  }

  // ------------------------------------------------------------------ edit ---
  // EVERY box gets a handle, not only the ones showing at this instant. Drawing
  // just the active ones looks tidier and traps you: scrub past a box's span
  // and the only way to reach it again — to widen the span that put it out of
  // reach — is to guess where it was. The inactive ones are drawn faintly, so
  // "showing now" is still legible.
  const isNow = (c: { from: number; to: number }) => activeAt([c], t).length > 0
  const picked = censors.find((c) => c.id === pickedBox) ?? null
  const caption = captions.find((c) => c.id === pickedCaption) ?? null

  const toolBtn = (m: Mode, label: string, icon: React.ReactNode) => (
    <button type="button" title={label} aria-label={label} aria-pressed={mode === m}
      data-testid={`ve-mode-${m}`} onClick={() => setMode(m)}
      className={`grid place-items-center w-10 h-10 rounded-md border cursor-pointer transition-colors ${
        mode === m
          ? 'bg-green-600 border-green-700 text-[color:var(--primary-ink)]'
          : 'bg-black/55 border-white/25 text-white hover:bg-black/70'}`}>
      {icon}
    </button>
  )

  return (
    <Stack data-testid="video-edit">
      {error && <FileError message={error} />}

      <div className="mx-[calc(50%-50vw)] w-screen max-w-[100vw] bg-black">
        <div className="relative h-[min(68vh,760px)] min-h-[300px] flex items-center justify-center">
          {/* The source. It is not the preview — it is what `drawFrame` reads —
              so it is invisible but must stay laid out and decoding. */}
          <video ref={videoRef} src={current.url} playsInline data-testid="ve-video"
            onLoadStart={() => diag.current.mark('video loadstart')}
            onError={() => {
              diag.current.mark(`video error ${videoRef.current?.error?.code ?? -1}`)
              setPreviewError(videoRef.current?.error?.code ?? -1)
            }}
            onLoadedMetadata={() => {
              diag.current.mark('video loadedmetadata — the preview is working')
              setPreviewError(0)
            }}
            onTimeUpdate={() => setPos(videoRef.current?.currentTime ?? 0)}
            onSeeked={() => setPos(videoRef.current?.currentTime ?? 0)}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            className="absolute w-px h-px opacity-0 pointer-events-none" />

          <div className="relative" style={{ aspectRatio: `${size.width} / ${size.height}`, height: '100%', maxWidth: '100%' }}>
            <canvas ref={stageRef} data-testid="ve-result" className="block w-full h-full" />

            {/* One overlay for every interaction, so the pointer maths lives in
                one place and a box cannot be dragged in a coordinate space the
                canvas does not share. */}
            <div ref={overlayRef} tabIndex={0} data-testid="ve-stage"
              onPointerDown={down} onPointerMove={moveDrag} onPointerUp={up} onPointerCancel={up}
              onKeyDown={nudge}
              className={`absolute inset-0 touch-none outline-none ${mode === 'crop' ? 'cursor-move' : mode === 'censor' ? 'cursor-crosshair' : ''}`}>

              {mode === 'censor' && censors.map((c) => (
                <div key={c.id} data-testid={`ve-box-${censors.indexOf(c)}`}
                  onPointerDown={(e) => {
                    e.stopPropagation()
                    const p = at(e)
                    overlayRef.current?.setPointerCapture(e.pointerId)
                    dragRef.current = { kind: 'move', id: c.id, ox: p.x - c.x, oy: p.y - c.y }
                    setPickedBox(c.id)
                  }}
                  style={{ left: `${c.x * 100}%`, top: `${c.y * 100}%`, width: `${c.w * 100}%`, height: `${c.h * 100}%` }}
                  className={`absolute cursor-move border-2 ${pickedBox === c.id ? 'border-green-400' : 'border-white/60 border-dashed'}${isNow(c) ? '' : ' opacity-40'}`}>
                  {pickedBox === c.id && (
                    <>
                      <button type="button" title={s.deleteBox} aria-label={s.deleteBox}
                        data-testid={`ve-box-delete-${censors.indexOf(c)}`}
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={() => { setCensors((l) => l.filter((x) => x.id !== c.id)); setPickedBox(null) }}
                        className="absolute -top-3 -end-3 grid place-items-center w-7 h-7 rounded-full bg-black/80 border border-white/40 text-white cursor-pointer">
                        <TrashIcon className="w-3.5 h-3.5" />
                      </button>
                      {/* The resize grip. A box you can move and not resize is a
                          box you have to delete and redraw to make bigger. */}
                      <span data-testid={`ve-box-resize-${censors.indexOf(c)}`}
                        onPointerDown={(e) => {
                          e.stopPropagation()
                          overlayRef.current?.setPointerCapture(e.pointerId)
                          dragRef.current = { kind: 'resize', id: c.id }
                        }}
                        className="absolute -bottom-2 -end-2 w-4 h-4 rounded-sm bg-green-400 border border-green-700 cursor-nwse-resize" />
                    </>
                  )}
                </div>
              ))}

              {mode === 'text' && captions.map((c) => {
                const bmp = bitmaps.current.get(c.id)
                const w = bmp ? bmp.width / size.width : 0.3
                const h = bmp ? bmp.height / size.height : 0.08
                return (
                  <div key={c.id} data-testid={`ve-caption-box-${captions.indexOf(c)}`}
                    onPointerDown={(e) => {
                      e.stopPropagation()
                      const p = at(e)
                      overlayRef.current?.setPointerCapture(e.pointerId)
                      dragRef.current = { kind: 'caption', id: c.id, ox: p.x - c.x, oy: p.y - c.y }
                      setPickedCaption(c.id)
                    }}
                    style={{ left: `${(c.x - w / 2) * 100}%`, top: `${(c.y - h / 2) * 100}%`, width: `${w * 100}%`, height: `${h * 100}%` }}
                    className={`absolute cursor-move border-2 ${pickedCaption === c.id ? 'border-green-400' : 'border-white/50 border-dashed'}${isNow(c) ? '' : ' opacity-40'}`} />
                )
              })}
            </div>

            {/* The context buttons, over the top-right of the picture. */}
            <div className="absolute top-2 end-2 flex gap-1.5" data-testid="ve-tools">
              {toolBtn('crop', s.modeCrop, <CropIcon className="w-5 h-5" />)}
              {toolBtn('censor', s.modeCensor, <EraseIcon className="w-5 h-5" />)}
              {toolBtn('text', s.modeText, <TextIcon className="w-5 h-5" />)}
              {toolBtn('more', s.modeMore, <MoreVIcon className="w-5 h-5" />)}
            </div>

            {/* And the controls for whichever is active, along the bottom. */}
            <div className="absolute bottom-2 inset-x-2 flex justify-center pointer-events-none">
              <div className="pointer-events-auto max-w-full overflow-x-auto rounded-md bg-black/70 backdrop-blur-sm border border-white/15 text-white px-2 py-1.5">
                {mode === 'crop' && (
                  <div className="flex items-center gap-2 whitespace-nowrap" data-testid="ve-crop-bar">
                    {ASPECTS.map((a) => (
                      <button key={a.id} type="button" data-testid={`ve-aspect-${a.id}`}
                        onClick={() => setAspectId(a.id)}
                        className={`rounded px-2 py-1 text-[0.8rem] border cursor-pointer rtl:font-ar ${
                          aspectId === a.id ? 'bg-green-600 border-green-700' : 'bg-transparent border-white/25 hover:bg-white/10'}`}>
                        {locale === 'ar' ? a.labelAr : a.label}
                      </button>
                    ))}
                    <span className="text-[0.78rem] opacity-80 ps-1 rtl:font-ar" data-testid="ve-kept">{s.kept(kept)}</span>
                    <span className="text-[0.78rem] opacity-80 font-mono" data-testid="ve-out-size">{s.outSize(size.width, size.height)}</span>
                    <label className="flex items-center gap-1 text-[0.78rem] opacity-80 rtl:font-ar">
                      {s.zoom}
                      <input type="range" min={1} max={3} step={0.05} value={zoom} data-testid="ve-zoom"
                        className="w-20" onChange={(e) => setZoom(Number(e.target.value))} />
                    </label>
                  </div>
                )}

                {mode === 'censor' && (
                  <div className="flex items-center gap-2 whitespace-nowrap" data-testid="ve-censor-bar">
                    {picked ? (
                      <>
                        {(['block', 'pixelate', 'blur'] as CensorMode[]).map((m) => (
                          <button key={m} type="button" data-testid={`ve-censor-${m}`}
                            onClick={() => setCensor(picked.id, { mode: m })}
                            className={`rounded px-2 py-1 text-[0.8rem] border cursor-pointer rtl:font-ar ${
                              picked.mode === m ? 'bg-green-600 border-green-700' : 'bg-transparent border-white/25 hover:bg-white/10'}`}>
                            {m === 'block' ? s.modeBlock : m === 'pixelate' ? s.modePixelate : s.modeBlur}
                          </button>
                        ))}
                        <label className="flex items-center gap-1 text-[0.78rem] opacity-80 rtl:font-ar">{s.from}
                          <Input type="number" min={0} max={duration} step={0.1} value={picked.from} className="w-16 !py-0.5 !text-[0.78rem]"
                            data-testid="ve-censor-from"
                            onChange={(e) => setCensor(picked.id, { from: Number(e.target.value) })} />
                        </label>
                        <label className="flex items-center gap-1 text-[0.78rem] opacity-80 rtl:font-ar">{s.to}
                          <Input type="number" min={0} max={duration} step={0.1} value={picked.to} className="w-16 !py-0.5 !text-[0.78rem]"
                            data-testid="ve-censor-to"
                            onChange={(e) => setCensor(picked.id, { to: Number(e.target.value) })} />
                        </label>
                      </>
                    ) : (
                      <span className="text-[0.8rem] opacity-85 rtl:font-ar" data-testid="ve-censor-hint">{s.addBox}</span>
                    )}
                  </div>
                )}

                {mode === 'text' && (
                  <div className="flex items-center gap-2 whitespace-nowrap" data-testid="ve-text-bar">
                    {caption ? (
                      <>
                        <Input value={caption.text} placeholder={s.text} data-testid="ve-caption-text"
                          className="w-40 !py-0.5 !text-[0.8rem]"
                          onChange={(e) => setCaption(caption.id, { text: e.target.value })} />
                        <label className="flex items-center gap-1 text-[0.78rem] opacity-80 rtl:font-ar">{s.from}
                          <Input type="number" min={0} max={duration} step={0.1} value={caption.from} className="w-16 !py-0.5 !text-[0.78rem]"
                            data-testid="ve-caption-from"
                            onChange={(e) => setCaption(caption.id, { from: Number(e.target.value) })} />
                        </label>
                        <label className="flex items-center gap-1 text-[0.78rem] opacity-80 rtl:font-ar">{s.to}
                          <Input type="number" min={0} max={duration} step={0.1} value={caption.to} className="w-16 !py-0.5 !text-[0.78rem]"
                            data-testid="ve-caption-to"
                            onChange={(e) => setCaption(caption.id, { to: Number(e.target.value) })} />
                        </label>
                        <input type="range" min={0.03} max={0.18} step={0.005} value={caption.size} title={s.size}
                          data-testid="ve-caption-size" className="w-16"
                          onChange={(e) => setCaption(caption.id, { size: Number(e.target.value) })} />
                        <input type="color" value={caption.colour} title={s.colour} data-testid="ve-caption-colour"
                          className="w-7 h-7 bg-transparent border-0 p-0 cursor-pointer"
                          onChange={(e) => setCaption(caption.id, { colour: e.target.value })} />
                        <label className="flex items-center gap-1 text-[0.78rem] opacity-80 rtl:font-ar">
                          <input type="checkbox" checked={caption.band} data-testid="ve-caption-band"
                            onChange={(e) => setCaption(caption.id, { band: e.target.checked })} />
                          {s.band}
                        </label>
                        <button type="button" data-testid="ve-caption-remove" title={s.remove} aria-label={s.remove}
                          onClick={() => { setCaptions((l) => l.filter((x) => x.id !== caption.id)); setPickedCaption(null) }}
                          className="grid place-items-center w-7 h-7 rounded border border-white/25 bg-transparent text-white cursor-pointer hover:bg-white/10">
                          <TrashIcon className="w-3.5 h-3.5" />
                        </button>
                      </>
                    ) : (
                      <span className="text-[0.8rem] opacity-85 rtl:font-ar">{s.noCaption}</span>
                    )}
                    <button type="button" data-testid="ve-caption-add" onClick={addCaption}
                      className="rounded px-2 py-1 text-[0.8rem] border border-white/25 bg-transparent cursor-pointer hover:bg-white/10 rtl:font-ar">
                      + {s.addCaption}
                    </button>
                  </div>
                )}

                {mode === 'more' && (
                  <div className="flex items-center gap-3 whitespace-nowrap text-[0.78rem]" data-testid="ve-more-bar">
                    <label className="flex items-center gap-1 opacity-85 rtl:font-ar">{s.quality}
                      <select value={quality} data-testid="ve-quality"
                        className="rounded border border-white/25 bg-black/40 px-1 py-0.5 text-white"
                        onChange={(e) => setQuality(Number(e.target.value))}>
                        {s.qualities.map((q, i) => <option key={q} value={i} className="text-ink">{q}</option>)}
                      </select>
                    </label>
                    <label className="flex items-center gap-1 opacity-85 rtl:font-ar">{s.maxHeight}
                      <select value={maxHeight} data-testid="ve-height"
                        className="rounded border border-white/25 bg-black/40 px-1 py-0.5 text-white"
                        onChange={(e) => setMaxHeight(Number(e.target.value))}>
                        {HEIGHTS.map((h) => <option key={h} value={h} className="text-ink">{h}p</option>)}
                      </select>
                    </label>
                    {audioPlan === 'copy' && (
                      <label className="flex items-center gap-1 opacity-85 rtl:font-ar">
                        <input type="checkbox" checked={keepAudio} data-testid="ve-keep-audio"
                          onChange={(e) => setKeepAudio(e.target.checked)} />
                        {s.keepAudio}
                      </label>
                    )}
                    <label className="inline-flex items-center gap-1 cursor-pointer opacity-85 rtl:font-ar">
                      <input type="file" className="sr-only" data-testid="ve-add"
                        onChange={(e) => { void addFile(e.target.files?.[0]); e.target.value = '' }} />
                      + {s.add}
                    </label>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Transport. The native controls are gone with the visible video, and a
            clip you cannot scrub is a clip you cannot aim a caption at. */}
        <div className="wrap py-2 flex items-center gap-3 text-sand-100">
          <button type="button" onClick={togglePlay} data-testid="ve-play"
            title={playing ? s.pause : s.play} aria-label={playing ? s.pause : s.play}
            className="grid place-items-center w-9 h-9 rounded-full border border-white/25 bg-white/10 text-white cursor-pointer hover:bg-white/20">
            {playing ? <PauseIcon className="w-4 h-4" /> : <PlayIcon className="w-4 h-4" />}
          </button>
          <input type="range" min={0} max={Math.max(0.1, current.info.durationSec)} step={0.05} value={pos}
            data-testid="ve-seek" className="flex-1 accent-green-500"
            onChange={(e) => {
              const v = videoRef.current
              if (v) v.currentTime = Number(e.target.value)
              setPos(Number(e.target.value))
            }} />
          <span className="text-[0.8rem] font-mono opacity-80">{fmt(t)} / {fmt(duration)}</span>
        </div>
      </div>

      {previewError !== 0 && (
        <p className="text-[0.85rem] text-gold-500 rtl:font-ar" data-testid="ve-preview-error">
          {s.previewFailed(previewError)}
          {current.info.decodable ? ` ${s.previewStillExports}` : ''}
        </p>
      )}

      {/* The generate step, on the same stage: a button, a percentage, then the
          download. There is deliberately NO preview of the result — the stage
          above already showed it frame for frame, and a second player would be
          a second opinion about what was encoded. */}
      <div className="flex flex-wrap items-center gap-3">
        {!out && (
          <Button variant="primary" onClick={doExport} disabled={busy !== ''} data-testid="ve-export">
            <DownloadIcon /> {busy === 'render' ? s.exporting : s.exportBtn}
          </Button>
        )}
        {busy === 'render' && (
          <>
            <span className="text-[0.85rem] text-ink-faint font-mono" data-testid="ve-progress">
              {s.progress(progress.done, progress.total)}
            </span>
            <Button className="px-3 py-1" data-testid="ve-cancel"
              onClick={() => { void ask({ kind: 'cancel' }) }}>{s.cancel}</Button>
          </>
        )}
        {out && (
          <>
            <Button variant="primary" href={out.url} download={`edited-${clips[0]?.file.name || 'video.mp4'}`} data-testid="ve-download">
              <DownloadIcon /> {s.download}
            </Button>
            <span className="text-[0.85rem] text-ink-faint font-mono" data-testid="ve-out-info">
              {s.outInfo(mb(out.size), out.audio === 'copied' ? s.withSound : s.silent)}
            </span>
            <Button className="px-3 py-1" data-testid="ve-export-again" onClick={() => setOut(null)}>{s.exportBtn}</Button>
          </>
        )}
        <span className="text-[0.85rem] text-ink-faint ms-auto" data-testid="ve-total">
          {s.joined(clips.length, fmt(duration))}
        </span>
      </div>

      {clips.length > 1 && (
        <ul className="flex flex-col gap-1" data-testid="ve-clips">
          {clips.map((c, i) => (
            <li key={c.slot} data-testid={`ve-clip-${i}`}
              className={`flex flex-wrap items-center gap-2 rounded-md border px-2 py-1 text-[0.85rem] ${i === sel ? 'border-green-700' : 'border-[color:var(--line)]'}`}>
              <button type="button" className="border-0 bg-transparent p-0 text-start text-ink underline-offset-2 hover:underline cursor-pointer"
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
      )}

      {clips.reduce((n, c) => n + c.file.size, 0) > 300 * 1048576 && (
        <p className="text-[0.85rem] text-gold-500 rtl:font-ar" data-testid="ve-big">{s.big}</p>
      )}

      {/* The honesty notes, under the stage rather than over the picture: they
          are worth reading once, not worth covering the video with. */}
      <Panel className="gap-1.5">
        {mode === 'crop' && <p className="text-[0.85rem] text-ink-soft rtl:font-ar">{s.keptWhy}</p>}
        {mode === 'text' && <p className="text-[0.85rem] text-ink-soft rtl:font-ar">{s.captionWhy}</p>}
        {mode === 'censor' && (
          <>
            <p className="text-[0.85rem] text-ink-soft rtl:font-ar">{s.censorMoves}</p>
            <p className="text-[0.85rem] text-ink-soft rtl:font-ar" data-testid="ve-censor-audio">{s.censorAudio}</p>
          </>
        )}
        {censors.some((c) => c.mode !== 'block') && (
          <p className="text-[0.85rem] text-gold-500 rtl:font-ar" data-testid="ve-censor-warning">{s.censorWhy}</p>
        )}
        <p className="text-[0.85rem] text-ink-soft rtl:font-ar" data-testid="ve-audio-note">
          {audioPlan === 'copy' ? s.audioCopied
            : audioPlan === 'mixed' ? s.audioMixed
            : audioPlan === 'missing' ? s.audioMissing
            : s.audioNone}
        </p>
        <p className="text-[0.8rem] text-ink-faint rtl:font-ar">{s.noUpscale}</p>
        <p className="text-[0.85rem] text-ink-soft rtl:font-ar">
          {s.trimNote}{' '}
          <a className="text-green-700 underline" href={`/${locale}/apps/video-trim`}>{s.trimName}</a>
        </p>
      </Panel>

      <div className="flex flex-wrap items-center gap-4">
        <button type="button" data-testid="ve-diag-toggle"
          className="border-0 bg-transparent p-0 text-[0.8rem] text-ink-faint underline cursor-pointer rtl:font-ar"
          onClick={() => setShowDiag((v) => !v)}>
          {showDiag ? s.diagHide : s.diagShow}
        </button>
        <button type="button" data-testid="ve-again"
          className="border-0 bg-transparent p-0 text-[0.85rem] text-green-700 underline cursor-pointer rtl:font-ar"
          onClick={() => {
            for (const c of clips) { URL.revokeObjectURL(c.url); void ask({ kind: 'drop', slot: c.slot }) }
            setClips([]); setCaptions([]); setCensors([]); setSel(0); setMode('crop')
            setOut((o) => { if (o) URL.revokeObjectURL(o.url); return null })
          }}>
          {s.again}
        </button>
      </div>

      {/* Shown on failure without being asked, because somebody whose preview
          just broke should not have to find a toggle — and available on a toggle
          otherwise, so a WORKING run can be reported for comparison, which is
          what an intermittent fault needs. */}
      {(showDiag || previewError !== 0) && (
        <div className="flex flex-col gap-2" data-testid="ve-diagnostics">
          <p className="text-[0.8rem] text-ink-faint rtl:font-ar">{s.diagWhy}</p>
          <pre className="overflow-x-auto rounded-md border border-[color:var(--line)] bg-[var(--surface)] p-2 text-[0.72rem] font-mono text-ink"
            data-testid="ve-diag-text">{report()}</pre>
          <Button className="self-start px-3 py-1" data-testid="ve-diag-copy"
            onClick={() => {
              void navigator.clipboard?.writeText(report()).then(() => {
                setCopied(true)
                setTimeout(() => setCopied(false), 2000)
              }).catch(() => {})
            }}>
            {copied ? s.diagCopied : s.diagCopy}
          </Button>
        </div>
      )}
    </Stack>
  )
}
