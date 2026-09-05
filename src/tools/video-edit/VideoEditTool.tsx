import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocale } from '../../i18n'
import { Button, Check, Field, FieldLabel, FileError, Input, Panel, Select, Spinner, Stack } from '../../components/ui'
import {
  BackIcon, CloseIcon, CogIcon, CropIcon, DownloadIcon, MosaicIcon, PauseIcon, PlayIcon, TextIcon, TrashIcon,
} from '../../components/icons'
import { setWorkInProgress } from '../../lib/workInProgress'
import {
  ASPECTS, activeAt, applyCensors, captionRect, cropRect, drawFrame, fitRect, outputSize, timeline, totalDuration,
  type Caption, type Censor, type ClipInfo, type Crop,
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
    heroBody: 'Join several clips, crop them, add a caption, and hide anything that should not be in the picture. Everything is done in your browser — no backend involved.',
    pick: 'Choose videos',
    back: 'Back',
    discardTitle: 'Leave the editor?',
    discardBody: 'Your crop, boxes and captions are only here — nothing has been saved anywhere, because nothing has been uploaded anywhere. Export first if you want to keep them.',
    keepEditing: 'Keep editing',
    discard: 'Discard and leave',
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
    free: 'Free',
    addBox: 'Drag on the video to draw a box.',
    deleteBox: 'Delete this box',
    addCaptionBox: 'Drag on the video to draw a text box.',
    close: 'Close',
    text: 'Text',
    from: 'From',
    to: 'To',
    colour: 'Colour',
    diagWhy: 'Nothing here is sent anywhere — it is text on this page. It carries no filename and none of the video, only what the browser reports about itself and about this clip. Copy it into a bug report if the preview keeps failing.',
    diagCopy: 'Copy',
    diagCopied: 'Copied',
    previewFailed: (code: number) => `This browser could not play this clip in the preview (media error ${code}), so there is no picture to aim the crop and the boxes at.`,
    previewStillExports: 'The export uses a different decoder, and this browser says it can decode this file — so exporting may still work. Please tell us the error number above if it does not.',
    censorInfo: 'What pixelating does and does not do',
    censorWhy: 'Pixelating and blurring do not remove anything — they throw away resolution, and resolution comes back out of a VIDEO in a way it does not out of a photo: the mosaic grid stays fixed to the frame while your subject moves through it, so every frame samples the same face on a differently aligned grid. Reconstructing a pixelated number plate from 64 frames — 2.1 seconds — recovers 98.6% of it, against nothing at all from a single frame.',
    quality: 'Quality',
    qualities: ['Smaller file', 'Normal', 'Sharper'],
    maxHeight: 'Largest side',
    noUpscale: 'Never larger than the source: upscaling adds pixels and no detail.',
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
    heroBody: 'ادمج عدة مقاطع، واقتصّها، وأضف نصًّا، واحجب ما لا ينبغي أن يظهر. كل ذلك يجري في متصفّحك — دون أي خادم.',
    pick: 'اختر مقاطع الفيديو',
    back: 'رجوع',
    discardTitle: 'الخروج من المحرّر؟',
    discardBody: 'الاقتصاص والمربّعات والنصوص موجودة هنا فقط — لم يُحفظ شيء في أي مكان، لأنه لم يُرفع شيء إلى أي مكان. صدّر أولًا إن أردت الاحتفاظ بها.',
    keepEditing: 'متابعة التحرير',
    discard: 'تجاهل واخرج',
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
    free: 'حرّ',
    addBox: 'اسحب على الفيديو لترسم مربّعًا.',
    deleteBox: 'احذف هذا المربّع',
    addCaptionBox: 'اسحب على الفيديو لترسم مربّع نص.',
    close: 'إغلاق',
    text: 'النص',
    from: 'من',
    to: 'إلى',
    colour: 'اللون',
    diagWhy: 'لا يُرسَل شيء مما هنا إلى أي مكان — إنما هو نص على هذه الصفحة. ولا يحمل اسم الملف ولا شيئًا من الفيديو، بل ما يذكره المتصفح عن نفسه وعن هذا المقطع فقط. انسخه في تقرير عطل إن استمرت المعاينة في الفشل.',
    diagCopy: 'نسخ',
    diagCopied: 'نُسخ',
    previewFailed: (code: number) => `تعذّر على هذا المتصفح تشغيل المقطع في المعاينة (خطأ وسائط ${code})، فلا صورة يستهدفها الاقتصاص ولا المربّعات.`,
    previewStillExports: 'ويستخدم التصدير فاكّ ترميز آخر، وهذا المتصفح يقول إنه يستطيع فك ترميز هذا الملف — فقد ينجح التصدير رغم ذلك. أخبرنا برقم الخطأ أعلاه إن لم ينجح.',
    censorInfo: 'ما تفعله البكسلة وما لا تفعله',
    censorWhy: 'البكسلة والتمويه لا يزيلان شيئًا — إنما يُسقطان الدقّة، والدقّة تعود من الفيديو بما لا تعود به من الصورة الواحدة: شبكة البكسلة تثبت على الإطار بينما يتحرك من تخفيه خلالها، فيلتقط كل إطار الوجه نفسه على شبكة مختلفة المحاذاة. وإعادة بناء لوحة سيارة مبكسلة من ٦٤ إطارًا — أي ٢٫١ ثانية — تستردّ ٩٨٫٦٪ منها، مقابل لا شيء من إطار واحد.',
    quality: 'الجودة',
    qualities: ['ملف أصغر', 'عادية', 'أوضح'],
    maxHeight: 'أطول ضلع',
    noUpscale: 'لا يتجاوز المصدر أبدًا: التكبير يضيف بكسلات ولا يضيف تفصيلًا.',
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

/**
 * The crop rectangle as NINE SEGMENTS, in reading order.
 *
 * The whole rectangle is the control: the middle cell moves it, an edge cell
 * moves that edge, a corner cell moves both of its edges. There are no handle
 * squares to hit — on a phone a 14px square is smaller than a fingertip, and a
 * third of the rectangle is not.
 *
 * `id` names the edges each cell drags. PHYSICAL, not the logical start/end
 * this repo prefers elsewhere: these sit on a picture, and a picture does not
 * mirror under RTL — a cell that swapped sides in Arabic would drag the
 * opposite edge of the frame from the one under the finger.
 */
const SEGMENTS = [
  { id: 'nw', cursor: 'cursor-nwse-resize' },
  { id: 'n', cursor: 'cursor-ns-resize' },
  { id: 'ne', cursor: 'cursor-nesw-resize' },
  { id: 'w', cursor: 'cursor-ew-resize' },
  { id: 'move', cursor: 'cursor-move' },
  { id: 'e', cursor: 'cursor-ew-resize' },
  { id: 'sw', cursor: 'cursor-nesw-resize' },
  { id: 's', cursor: 'cursor-ns-resize' },
  { id: 'se', cursor: 'cursor-nwse-resize' },
] as const

type Mode = 'crop' | 'censor' | 'text' | 'more'

interface Clip { slot: number; file: File; url: string; info: ProbeInfo }

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
const mb = (b: number) => `${(b / 1048576).toFixed(1)} MB`
const clamp01 = (n: number) => Math.min(1, Math.max(0, n))

/** Arabic decides the text direction, not the UI locale — somebody writing an
 *  English caption on the Arabic side of the site wants a left-to-right line. */
const isRtl = (text: string) => /[؀-ۿݐ-ݿ]/.test(text)

/**
 * Draw one caption to a bitmap THE SIZE OF ITS BOX.
 *
 * Everything about the way this text looks is decided here, once, on the page —
 * so the stage and the encoded frame are literally the same pixels.
 *
 * The box is the contract: the text wraps to its width and is centred in its
 * height, so the rectangle somebody dragged is exactly the area the caption
 * occupies. Wrapping at "90% of the frame" instead, as this did, means the
 * writer sets the middle of something whose extent they cannot see.
 */
async function renderCaption(c: Caption, out: { width: number; height: number }): Promise<ImageBitmap | null> {
  const text = c.text.trim()
  if (!text) return null
  const box = captionRect(c, out)
  const px = Math.max(8, Math.round(c.size * out.height))
  const pad = Math.round(px * 0.3)
  const font = `600 ${px}px "IBM Plex Sans Arabic", "Hanken Grotesk", system-ui, sans-serif`

  const measure = document.createElement('canvas').getContext('2d')
  if (!measure) return null
  measure.font = font

  const maxWidth = Math.max(1, box.w - pad * 2)
  const lines: string[] = []
  let line = ''
  for (const word of text.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word
    if (measure.measureText(next).width > maxWidth && line) { lines.push(line); line = word }
    else line = next
  }
  if (line) lines.push(line)

  const canvas = document.createElement('canvas')
  canvas.width = box.w
  canvas.height = box.h
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
  // Centred in the BOX, top to bottom. A block of lines pinned to the top of a
  // tall rectangle looks like a mistake rather than a choice.
  const lineHeight = Math.round(px * 1.3)
  const top = (canvas.height - lines.length * lineHeight) / 2
  lines.forEach((l, i) => {
    const y = top + i * lineHeight + lineHeight / 2
    if (!c.band) ctx.strokeText(l, canvas.width / 2, y)
    ctx.fillText(l, canvas.width / 2, y)
  })
  return createImageBitmap(canvas)
}

/** What the pointer is doing to the picture right now. */
type Drag =
  /**
   * Dragging one segment of the crop rectangle, which sets a FREE proportion.
   *
   * `id` names which edges follow the pointer; `rect` is where the rectangle
   * started, so the edges that are NOT being dragged stay exactly where they
   * were rather than drifting with the finger.
   */
  | { kind: 'crop-seg'; id: string; px: number; py: number; rect: { x0: number; y0: number; x1: number; y1: number } }
  | { kind: 'draw'; fx: number; fy: number }
  | { kind: 'draw-text'; fx: number; fy: number }
  | { kind: 'move'; id: string; ox: number; oy: number }
  | { kind: 'resize'; id: string }
  /**
   * `was` records that the box was ALREADY selected when the pointer went
   * down, and `moved` that the pointer then travelled. Together they separate
   * a click from a drag on the same target, which is what lets a second click
   * open the editor without taking the ability to move a selected box away.
   */
  | { kind: 'caption'; id: string; ox: number; oy: number; was: boolean; moved: boolean }
  | { kind: 'caption-resize'; id: string }

export default function VideoEditTool() {
  const { locale } = useLocale()
  const s = STR[locale]

  const [supported, setSupported] = useState<boolean | null>(null)
  const [clips, setClips] = useState<Clip[]>([])
  const [sel, setSel] = useState(0)
  const [mode, setMode] = useState<Mode>('crop')
  const [aspectId, setAspectId] = useState('9:16')
  // The proportion a corner drag produced. Held separately from `aspectId` so
  // that going back to a preset and then to Free again returns to the shape
  // that was dragged, rather than to whatever preset was last selected.
  const [freeAspect, setFreeAspect] = useState(0)
  const [zoom, setZoom] = useState(1)
  const [centre, setCentre] = useState({ x: 0.5, y: 0.5 })
  const [captions, setCaptions] = useState<Caption[]>([])
  const [censors, setCensors] = useState<Censor[]>([])
  const [pickedBox, setPickedBox] = useState<string | null>(null)
  const [pickedCaption, setPickedCaption] = useState<string | null>(null)
  /** Is the "what pixelating costs" note open? */
  const [why, setWhy] = useState(false)
  const [quality, setQuality] = useState(1)
  const [maxHeight, setMaxHeight] = useState(1080)
  const [keepAudio, setKeepAudio] = useState(true)
  const [busy, setBusy] = useState<'' | 'read' | 'render'>('')
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [error, setError] = useState('')
  const [previewError, setPreviewError] = useState(0)
  const [settings, setSettings] = useState(false)
  const [confirmBack, setConfirmBack] = useState(false)
  const [copied, setCopied] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [pos, setPos] = useState(0)
  const [out, setOut] = useState<{ url: string; size: number; audio: string } | null>(null)

  /** Is there a clip open? That is what turns this into a full-screen editor. */
  const editing = clips.length > 0

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
  /** The caption box being dragged out, before it is a caption. */
  const drawingTextRef = useRef<{ x: number; y: number; w: number; h: number } | null>(null)
  const [textTick, setTextTick] = useState(0)
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

  // The editor covers the whole viewport, header and footer included, so the
  // page behind it must not scroll — a second scrollbar dragging the site's own
  // chrome around under a full-screen editor is the classic modal-overlay bug.
  useEffect(() => {
    if (!editing) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [editing])

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
    if (aspectId === 'free' && freeAspect) return freeAspect
    const found = ASPECTS.find((a) => a.id === aspectId)
    return found && found.aspect ? found.aspect : sourceAspect
  }, [aspectId, freeAspect, sourceAspect])

  const crop: Crop = useMemo(() => ({ aspect, cx: centre.x, cy: centre.y, zoom }), [aspect, centre, zoom])
  const size = useMemo(() => outputSize(infos, crop, maxHeight), [infos, crop, maxHeight])
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

  // A caption's span is DERIVED now rather than typed, so it has to follow the
  // clip list — removing a clip must not leave a caption claiming seconds that
  // no longer exist. Guarded on the comparison, or setting state from an effect
  // that reads it re-renders forever.
  useEffect(() => {
    setCaptions((list) => (list.some((c) => c.from !== 0 || c.to !== duration)
      ? list.map((c) => ({ ...c, from: 0, to: duration }))
      : list))
  }, [duration])

  /** The time on the JOINED timeline that the stage is currently showing. */
  const spanStart = spans[Math.min(sel, Math.max(0, spans.length - 1))]?.start ?? 0
  const t = spanStart + pos
  const previewTime = useCallback(() => {
    const v = videoRef.current
    const span = spans[Math.min(sel, spans.length - 1)]
    return (span?.start ?? 0) + (v?.currentTime ?? 0)
  }, [spans, sel])

  /**
   * The crop rectangle inside the WHOLE frame, in fractions of it.
   *
   * Crop mode shows the clip uncropped and draws this over it, so the thing
   * being decided — how much is thrown away and which part survives — is
   * visible next to what it is being taken from. Showing the cropped result
   * while cropping hides exactly that: the picture appears to zoom, and there
   * is nothing on screen to say what is outside it.
   */
  const cropBox = useMemo(() => {
    if (!current) return { x: 0, y: 0, w: 1, h: 1 }
    const r = cropRect({ width: current.info.width, height: current.info.height }, crop)
    return {
      x: r.x / current.info.width,
      y: r.y / current.info.height,
      w: r.w / current.info.width,
      h: r.h / current.info.height,
    }
  }, [current, crop])

  const paint = useCallback(() => {
    const v = videoRef.current
    const rc = stageRef.current
    if (!v || !rc || !current || !v.videoWidth) return
    const clip = { width: current.info.width, height: current.info.height }
    const now = previewTime()

    if (mode === 'crop') {
      // The whole picture, at the clip's own shape, with everything outside the
      // crop dimmed rather than gone. The rectangle's own outline is drawn by
      // the DOM overlay, which is also what you drag.
      const fit = Math.min(1, PREVIEW_MAX / Math.max(clip.width, clip.height))
      const shown = {
        width: Math.max(2, Math.round(clip.width * fit)),
        height: Math.max(2, Math.round(clip.height * fit)),
      }
      rc.width = shown.width
      rc.height = shown.height
      const ctx = rc.getContext('2d')
      if (!ctx) return
      ctx.clearRect(0, 0, shown.width, shown.height)
      ctx.drawImage(v, 0, 0, shown.width, shown.height)
      const bx = Math.round(cropBox.x * shown.width)
      const by = Math.round(cropBox.y * shown.height)
      const bw = Math.round(cropBox.w * shown.width)
      const bh = Math.round(cropBox.h * shown.height)
      ctx.fillStyle = 'rgba(0,0,0,0.55)'
      ctx.fillRect(0, 0, shown.width, by)
      ctx.fillRect(0, by + bh, shown.width, shown.height - by - bh)
      ctx.fillRect(0, by, bx, bh)
      ctx.fillRect(bx + bw, by, shown.width - bx - bw, bh)
      return
    }

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
    const inProgress = drawingRef.current
    applyCensors(ctx, inProgress ? [...censors, inProgress] : censors, now, shown)
    for (const c of activeAt(captions, now)) {
      const bmp = bitmaps.current.get(c.id)
      if (!bmp) continue
      const r = captionRect(c, shown)
      ctx.drawImage(bmp, r.x, r.y, r.w, r.h)
    }
  }, [current, crop, cropBox, mode, size, captions, censors, previewTime])

  // Repaint on every displayed frame while playing, and once whenever anything
  // that affects the picture changes.
  useEffect(() => {
    let raf = 0
    const loop = () => { paint(); raf = requestAnimationFrame(loop) }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [paint, bitmapTick])

  /**
   * Take several clips at once, IN THE ORDER THEY WERE CHOSEN.
   *
   * Sequential rather than `Promise.all` on purpose: the probes would otherwise
   * finish in whatever order the files happened to demux in, and the join order
   * is the whole reason somebody picked more than one. It also keeps the memory
   * cost to one file at a time, which is the untested hypothesis behind the
   * intermittent Android failure recorded in CLAUDE.md.
   */
  async function addFiles(files: FileList | File[] | null | undefined) {
    for (const f of Array.from(files ?? [])) {
      // eslint-disable-next-line no-await-in-loop
      await addFile(f)
    }
  }

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

  const setCaption = (id: string, patch: Partial<Caption>) =>
    setCaptions((list) => list.map((c) => (c.id === id ? { ...c, ...patch } : c)))
  const setCensor = (id: string, patch: Partial<Censor>) =>
    setCensors((list) => list.map((c) => (c.id === id ? { ...c, ...patch } : c)))

  /**
   * Pointer position as a fraction of the STAGE.
   *
   * Which frame that is depends on the mode, and deliberately so: crop mode
   * shows the whole clip so a fraction here is a fraction of the SOURCE, while
   * every other mode shows the output so a fraction is of the OUTPUT. Each mode
   * only ever places things in its own space, so the two never meet.
   */
  function at(e: React.PointerEvent) {
    const r = overlayRef.current?.getBoundingClientRect()
    if (!r) return { x: 0.5, y: 0.5 }
    return { x: clamp01((e.clientX - r.left) / r.width), y: clamp01((e.clientY - r.top) / r.height) }
  }

  /** A time span starting where the playhead is, clamped to the clip. */
  const spanNow = () => ({
    from: Math.max(0, Math.round(t * 10) / 10),
    to: Math.min(duration, Math.round((t + 3) * 10) / 10),
  })

  function down(e: React.PointerEvent<HTMLDivElement>) {
    if (e.button !== 0) return
    const p = at(e)
    overlayRef.current?.setPointerCapture(e.pointerId)

    // Censor and caption are the SAME gesture on purpose: drag out a rectangle.
    // A caption used to be a point you dropped and then discovered the extent
    // of, which is the one thing a person cannot judge in advance.
    if (mode === 'censor') {
      dragRef.current = { kind: 'draw', fx: p.x, fy: p.y }
      // ONE WAY OF HIDING: a coarse mosaic. Solid and blur are gone — three
      // modes made the reader choose between things two of which were the same
      // operation, and a black rectangle was read as "pixelation is not
      // implemented here, so you are getting the fallback". What solid bought
      // is not free to lose, so `compose.ts` scales the block to the frame:
      // a small box collapses to one or two averaged squares, which is a solid
      // box in all but name. What the measurement says is still on the page,
      // behind the box's own "i".
      drawingRef.current = { id: `z${Date.now()}`, x: p.x, y: p.y, w: 0, h: 0, ...spanNow() }
      setPickedBox(null)
      return
    }
    if (mode === 'text') {
      dragRef.current = { kind: 'draw-text', fx: p.x, fy: p.y }
      drawingTextRef.current = { x: p.x, y: p.y, w: 0, h: 0 }
      setPickedCaption(null)
      return
    }
    // Crop mode: the rectangle IS the control, and its nine segments start
    // their own drags. A drag that begins OUTSIDE it moves it, which is the
    // gesture people try first on a picture with a frame on it.
    if (mode === 'crop') {
      dragRef.current = {
        kind: 'crop-seg',
        id: 'move',
        px: p.x,
        py: p.y,
        rect: { x0: cropBox.x, y0: cropBox.y, x1: cropBox.x + cropBox.w, y1: cropBox.y + cropBox.h },
      }
    }
  }

  function moveDrag(e: React.PointerEvent<HTMLDivElement>) {
    const d = dragRef.current
    if (!d || !current) return
    const p = at(e)
    if (d.kind === 'crop-seg') {
      // Every segment is the same gesture with a different set of edges
      // following the pointer, so there is one piece of arithmetic rather than
      // nine. The middle cell moves the whole rectangle, which is the drag the
      // stage used to own outright.
      const r = { ...d.rect }
      const px = clamp01(p.x), py = clamp01(p.y)
      if (d.id === 'move') {
        // By the DELTA from where the finger went down, not to where it is.
        // Centring the rectangle on the pointer makes it jump the moment you
        // touch it anywhere but its exact middle.
        const w = r.x1 - r.x0, h = r.y1 - r.y0
        const cx = Math.min(Math.max((r.x0 + r.x1) / 2 + (px - d.px), w / 2), 1 - w / 2)
        const cy = Math.min(Math.max((r.y0 + r.y1) / 2 + (py - d.py), h / 2), 1 - h / 2)
        r.x0 = cx - w / 2; r.x1 = cx + w / 2
        r.y0 = cy - h / 2; r.y1 = cy + h / 2
      } else {
        if (d.id.includes('n')) r.y0 = py
        if (d.id.includes('s')) r.y1 = py
        if (d.id.includes('w')) r.x0 = px
        if (d.id.includes('e')) r.x1 = px
      }
      const x0 = Math.min(r.x0, r.x1), x1 = Math.max(r.x0, r.x1)
      const y0 = Math.min(r.y0, r.y1), y1 = Math.max(r.y0, r.y1)
      const clip = { width: current.info.width, height: current.info.height }
      const fw = Math.max(0.04, x1 - x0) * clip.width
      const fh = Math.max(0.04, y1 - y0) * clip.height
      const a = fw / fh
      const fit = fitRect(clip.width, clip.height, a)
      const z = Math.max(1, fit.w / fw)
      setFreeAspect(a)
      setAspectId('free')
      setZoom(z)
      setCentre({ x: clamp01((x0 + x1) / 2), y: clamp01((y0 + y1) / 2) })
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
    if (d.kind === 'draw-text') {
      const box = drawingTextRef.current
      if (!box) return
      box.x = Math.min(d.fx, p.x)
      box.y = Math.min(d.fy, p.y)
      box.w = Math.abs(p.x - d.fx)
      box.h = Math.abs(p.y - d.fy)
      setTextTick((n) => n + 1)
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
      d.moved = true
      setCaptions((list) => list.map((c) => (c.id === d.id
        ? { ...c, x: clamp01(Math.min(1 - c.w, p.x - d.ox)), y: clamp01(Math.min(1 - c.h, p.y - d.oy)) }
        : c)))
      return
    }
    if (d.kind === 'caption-resize') {
      setCaptions((list) => list.map((c) => {
        if (c.id !== d.id) return c
        const h = Math.max(0.04, Math.min(1 - c.y, p.y - c.y))
        return {
          ...c,
          w: Math.max(0.05, Math.min(1 - c.x, p.x - c.x)),
          h,
          // The box IS the size control. With the slider gone, a rectangle
          // dragged twice as tall whose text stayed put would be a resize that
          // did half of what it looks like it is doing.
          size: Math.max(0.03, Math.min(0.3, h * 0.45)),
        }
      }))
    }
  }

  function up(e: React.PointerEvent<HTMLDivElement>) {
    const d = dragRef.current
    dragRef.current = null
    if (overlayRef.current?.hasPointerCapture(e.pointerId)) overlayRef.current.releasePointerCapture(e.pointerId)

    // A stray click is not a box. Anything under about a fiftieth of the frame
    // is a misclick, and committing it would leave invisible specks that still
    // count as censors.
    if (d?.kind === 'draw') {
      const box = drawingRef.current
      drawingRef.current = null
      if (box && box.w > 0.02 && box.h > 0.02) {
        setCensors((list) => [...list, box])
        setPickedBox(box.id)
      }
      return
    }
    if (d?.kind === 'draw-text') {
      const box = drawingTextRef.current
      drawingTextRef.current = null
      setTextTick((n) => n + 1)
      if (!box || box.w < 0.05 || box.h < 0.04) return
      const id = `c${Date.now()}${captions.length}`
      setCaptions((list) => [...list, {
        id,
        text: '',
        x: box.x,
        y: box.y,
        w: box.w,
        h: box.h,
        // Sized to the box it was drawn in, so the first thing typed already
        // fills it rather than sitting as a speck in a large rectangle.
        size: Math.max(0.03, Math.min(0.18, box.h * 0.45)),
        colour: '#ffffff',
        // No band. There is no control for one now, and a dark bar behind
        // every caption is a lower-third rather than a caption — the outline
        // `renderCaption` strokes when `band` is false is what keeps white
        // text readable on a white shirt.
        band: false,
        // A caption runs the WHOLE video. It was a span you set in two number
        // fields, which is a control most people never touched and everybody
        // had to read past — and a caption that runs out halfway is a defect
        // far more often than it is a choice. Boxes keep their span, because
        // hiding something for part of a clip is the ordinary case there.
        from: 0,
        to: duration,
      }])
      // Selecting it puts the field over it, so the caret is already where
      // the words go — an empty box draws nothing, and a new caption that did
      // not ask for its words is a rectangle with no way in.
      setPickedCaption(id)
    }
  }

  /** Throw the session away and go back to the upload screen. */
  function discard() {
    for (const c of clips) { URL.revokeObjectURL(c.url); void ask({ kind: 'drop', slot: c.slot }) }
    setClips([])
    setCaptions([])
    setCensors([])
    setSel(0)
    setMode('crop')
    setSettings(false)
    setConfirmBack(false)
    setOut((o) => { if (o) URL.revokeObjectURL(o.url); return null })
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
      if (bmp) planCaptions.push({ x: c.x, y: c.y, w: c.w, h: c.h, from: c.from, to: c.to, bitmap: bmp })
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
                <input type="file" multiple className="sr-only" data-testid="ve-file"
                  onChange={(e) => { void addFiles(e.target.files) }} />
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
  const drawingText = textTick >= 0 ? drawingTextRef.current : null

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

  /**
   * The text of a selected caption, typed STRAIGHT ONTO THE PICTURE.
   *
   * A transparent textarea sitting exactly over the box, in the same family,
   * size, colour and alignment the canvas will draw — so what is typed is
   * where it lands. It is not pixel-perfect (the canvas strokes an outline and
   * wraps by its own measurement) and it does not need to be: the point is
   * that the words are composed in place rather than in a dialog somewhere
   * else, which is a picture of the thing next to the thing.
   */
  const captionField = (c: Caption) => (
    <textarea
      data-testid={`ve-caption-text-${captions.indexOf(c)}`}
      value={c.text}
      placeholder={s.text}
      dir="auto"
      spellCheck={false}
      onPointerDown={(e) => e.stopPropagation()}
      onChange={(e) => setCaption(c.id, { text: e.target.value })}
      style={{
        color: c.colour,
        fontSize: `${Math.max(8, c.size * (stageRef.current?.clientHeight || 0))}px`,
        lineHeight: 1.3,
      }}
      className="absolute inset-0 w-full h-full resize-none bg-transparent border-0 outline-none
        text-center p-0 overflow-hidden font-sans font-semibold
        placeholder:text-white/60 [text-shadow:0_0_3px_rgba(0,0,0,0.8)]" />
  )

  /** A box handle on the stage — the same affordance for a censor and a caption. */
  const handle = (
    key: string, testid: string, box: { x: number; y: number; w: number; h: number },
    selected: boolean, dim: boolean,
    onGrab: (e: React.PointerEvent) => void,
    onDelete: () => void, onResize: (e: React.PointerEvent) => void,
    onInfo?: () => void, corner?: React.ReactNode, inside?: React.ReactNode,
  ) => (
    <div key={key} data-testid={testid} onPointerDown={onGrab}
      style={{ left: `${box.x * 100}%`, top: `${box.y * 100}%`, width: `${box.w * 100}%`, height: `${box.h * 100}%` }}
      className={`absolute cursor-move border-2 ${
        selected ? 'border-green-400' : 'border-white/60 border-dashed'}${dim ? ' opacity-40' : ''}`}>
      {inside}
      {selected && (
        <>
          <button type="button" title={s.deleteBox} aria-label={s.deleteBox} data-testid={`${testid}-delete`}
            onPointerDown={(e) => e.stopPropagation()} onClick={onDelete}
            className="absolute -top-3 -end-3 grid place-items-center w-7 h-7 rounded-full bg-black/80 border border-white/40 text-white cursor-pointer">
            <TrashIcon className="w-3.5 h-3.5" />
          </button>
          {/* What a mosaic does NOT do is worth knowing and is not worth
              printing under every working run — a caveat shown to everybody is
              one nobody reads. It sits on the box it is about, next to the
              only other thing you can do to that box. */}
          {onInfo && (
            <button type="button" title={s.censorInfo} aria-label={s.censorInfo} data-testid={`${testid}-info`}
              onPointerDown={(e) => e.stopPropagation()} onClick={onInfo}
              className="absolute -top-3 -end-12 grid place-items-center w-7 h-7 rounded-full bg-black/80 border border-white/40 text-white cursor-pointer font-display italic text-[0.85rem] leading-none">
              i
            </button>
          )}
          {/* A box you can move and not resize is a box you have to delete and
              redraw to make bigger. */}
          <span data-testid={`${testid}-resize`} onPointerDown={onResize}
            className="absolute -bottom-2 -end-2 w-4 h-4 rounded-sm bg-green-400 border border-green-700 cursor-nwse-resize" />
          {corner}
        </>
      )}
    </div>
  )

  // THE EDITOR IS PORTALLED TO `document.body`, and that is load-bearing rather
  // than tidy. `ToolPage`'s wrapper carries `animate-[fadeUp…_both]`, whose fill
  // leaves a `transform` on the element for good — and a transformed ancestor
  // becomes the containing block for `position: fixed`, so `inset-0` resolved
  // against the padded content column instead of the viewport. The editor was
  // therefore NOT full screen, and its own case caught it by measuring against
  // the viewport rather than trusting the class name.
  return (
    <Stack data-testid="video-edit">
      {error && <FileError message={error} />}

      {createPortal(<>
      {/* FULL SCREEN, header and footer included. An editor is a place you are
          IN, not a panel on a page — and on a phone the site's own chrome was
          taking a third of the height above a video that is the entire point.
          It is `fixed` rather than a Layout change because the condition is a
          piece of this tool's state (a clip is open), not a route. */}
      <div className="fixed inset-0 z-40 bg-black flex flex-col" data-testid="ve-fullscreen">
        <div className="relative flex-1 min-h-0 flex items-center justify-center">
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

          {/* The stage takes the shape of whatever is being decided: the WHOLE
              clip while cropping, the finished output otherwise. */}
          {/* CONTAINED, never stretched. This was `aspectRatio` on the wrapper
              with `height: 100%` and `maxWidth: 100%` — and when the width cap
              bit, the height stayed at 100% while the width did not, so the
              wrapper stopped matching the ratio it declared and the canvas,
              sized `w-full h-full`, was squashed to fill it. A canvas carries
              its own intrinsic size, so letting it size itself under two max
              constraints IS "contain", and the wrapper shrink-wraps it — which
              also keeps the overlay exactly over the picture, which is what
              every pointer coordinate in this file depends on. */}
          <div className="relative inline-block max-w-full max-h-full leading-none">
            <canvas ref={stageRef} data-testid="ve-result" className="block max-w-full max-h-full" />

            {/* One overlay for every interaction, so the pointer maths lives in
                one place and a box cannot be dragged in a coordinate space the
                canvas does not share. */}
            <div ref={overlayRef} tabIndex={0} data-testid="ve-stage"
              onPointerDown={down} onPointerMove={moveDrag} onPointerUp={up} onPointerCancel={up}
              onKeyDown={nudge}
              className={`absolute inset-0 touch-none outline-none ${
                mode === 'crop' ? 'cursor-move' : mode === 'censor' || mode === 'text' ? 'cursor-crosshair' : ''}`}>

              {/* The crop rectangle, over the uncropped picture. The canvas dims
                  everything outside it; this is the edge you actually drag. */}
              {mode === 'crop' && (
                <div data-testid="ve-crop-box"
                  style={{ left: `${cropBox.x * 100}%`, top: `${cropBox.y * 100}%`, width: `${cropBox.w * 100}%`, height: `${cropBox.h * 100}%` }}
                  className="absolute border-2 border-green-400 grid grid-cols-3 grid-rows-3">
                  {/* Nine cells, and the lines between them are the rule-of-
                      thirds guides every camera draws — so the thing you use to
                      resize is also the thing you compose against. No handle
                      squares: a 14px square is smaller than a fingertip and a
                      third of the rectangle is not. */}
                  {SEGMENTS.map((seg, i) => (
                    <div key={seg.id} data-testid={`ve-crop-${seg.id}`}
                      className={`${seg.cursor} ${i % 3 !== 2 ? 'border-e' : ''} ${i < 6 ? 'border-b' : ''} border-white/25`}
                      onPointerDown={(e) => {
                        e.stopPropagation()
                        overlayRef.current?.setPointerCapture(e.pointerId)
                        const q = at(e)
                        dragRef.current = {
                          kind: 'crop-seg',
                          id: seg.id,
                          px: q.x,
                          py: q.y,
                          rect: {
                            x0: cropBox.x, y0: cropBox.y,
                            x1: cropBox.x + cropBox.w, y1: cropBox.y + cropBox.h,
                          },
                        }
                      }} />
                  ))}
                </div>
              )}

              {mode === 'censor' && censors.map((c) => handle(
                c.id, `ve-box-${censors.indexOf(c)}`, c, pickedBox === c.id, !isNow(c),
                (e) => {
                  e.stopPropagation()
                  const p = at(e)
                  overlayRef.current?.setPointerCapture(e.pointerId)
                  dragRef.current = { kind: 'move', id: c.id, ox: p.x - c.x, oy: p.y - c.y }
                  setPickedBox(c.id)
                },
                () => { setCensors((l) => l.filter((x) => x.id !== c.id)); setPickedBox(null) },
                (e) => {
                  e.stopPropagation()
                  overlayRef.current?.setPointerCapture(e.pointerId)
                  dragRef.current = { kind: 'resize', id: c.id }
                },
                () => setWhy(true),
              ))}

              {/* A caption is the same rectangle, and clicking one opens its
                  editor — the text is the thing on screen, so it is the thing
                  you should be able to reach for. */}
              {mode === 'text' && captions.map((c) => handle(
                c.id, `ve-caption-box-${captions.indexOf(c)}`, c, pickedCaption === c.id, !isNow(c),
                (e) => {
                  e.stopPropagation()
                  const p = at(e)
                  overlayRef.current?.setPointerCapture(e.pointerId)
                  dragRef.current = {
                    kind: 'caption', id: c.id, ox: p.x - c.x, oy: p.y - c.y,
                    was: pickedCaption === c.id, moved: false,
                  }
                  setPickedCaption(c.id)
                },
                () => { setCaptions((l) => l.filter((x) => x.id !== c.id)); setPickedCaption(null) },
                (e) => {
                  e.stopPropagation()
                  overlayRef.current?.setPointerCapture(e.pointerId)
                  dragRef.current = { kind: 'caption-resize', id: c.id }
                },
                undefined,
                // The colour, in the SW corner opposite the bin — a round well
                // in the same family as the other two controls on the box.
                // Everything a caption has is now ON the caption.
                <label key="colour" data-testid={`ve-caption-colour-${captions.indexOf(c)}`}
                  title={s.colour} aria-label={s.colour}
                  onPointerDown={(e) => e.stopPropagation()}
                  className="absolute -bottom-3 -start-3 grid place-items-center w-7 h-7 rounded-full border border-white/40 cursor-pointer overflow-hidden"
                  style={{ background: c.colour }}>
                  <input type="color" value={c.colour} className="opacity-0 w-full h-full cursor-pointer"
                    onChange={(e) => setCaption(c.id, { colour: e.target.value })} />
                </label>,
                // Selected means EDITABLE. "Click once to select, again to
                // edit" is what a field over the box gives you for free: the
                // first click lands on the box and selects it, the next lands
                // in the field and puts a caret in it. No second gesture to
                // learn, and no dialog.
                pickedCaption === c.id ? captionField(c) : null,
              ))}

              {/* The caption box mid-drag. A censor draws itself on the canvas
                  because it changes the picture; a caption does not exist until
                  it has text, so its outline is all there is to show. */}
              {mode === 'text' && drawingText && drawingText.w > 0 && (
                <div aria-hidden="true"
                  style={{ left: `${drawingText.x * 100}%`, top: `${drawingText.y * 100}%`, width: `${drawingText.w * 100}%`, height: `${drawingText.h * 100}%` }}
                  className="absolute border-2 border-green-400 border-dashed pointer-events-none" />
              )}
            </div>

            {/* Back, over the top-left. There is no site chrome to leave by any
                more, so this is the only way out — and it CONFIRMS, because
                everything in this editor is unsaved by construction and a
                mis-tap would take a crop, some boxes and a caption with it. */}
            <button type="button" data-testid="ve-back" onClick={() => setConfirmBack(true)}
              title={s.back} aria-label={s.back}
              className="absolute top-2 start-2 grid place-items-center w-10 h-10 rounded-md border bg-black/55 border-white/25 text-white cursor-pointer hover:bg-black/70">
              <BackIcon className="w-5 h-5 rtl:-scale-x-100" />
            </button>

            {/* The context buttons, over the top-right of the picture — and the
                DOWNLOAD beside them, because exporting is what you came to do
                and it should not be somewhere you have to scroll to. */}
            <div className="absolute top-2 end-2 flex gap-1.5" data-testid="ve-tools">
              {toolBtn('crop', s.modeCrop, <CropIcon className="w-5 h-5" />)}
              {toolBtn('censor', s.modeCensor, <MosaicIcon className="w-5 h-5" />)}
              {toolBtn('text', s.modeText, <TextIcon className="w-5 h-5" />)}
              <button type="button" title={s.modeMore} aria-label={s.modeMore} data-testid="ve-settings"
                onClick={() => setSettings(true)}
                className="grid place-items-center w-10 h-10 rounded-md border bg-black/55 border-white/25 text-white cursor-pointer hover:bg-black/70">
                <CogIcon className="w-5 h-5" />
              </button>
              {/* GREEN ONLY ONCE THERE IS A FILE. Primary colour is a claim
                  that this is the thing to do next, and before an export there
                  is nothing to download — a button that shouts from the moment
                  the editor opens is one more thing shouting, and when the
                  file really is ready nothing distinguishes it. So export
                  wears the same dark chrome as the tools beside it, and the
                  download that replaces it is the only green on the frame. */}
              {out ? (
                <a href={out.url} download={`edited-${clips[0]?.file.name || 'video.mp4'}`} data-testid="ve-download"
                  title={`${s.download} · ${s.outInfo(mb(out.size), out.audio === 'copied' ? s.withSound : s.silent)}`}
                  aria-label={s.download}
                  className="grid place-items-center w-10 h-10 rounded-md border bg-green-600 border-green-700 text-[color:var(--primary-ink)] cursor-pointer no-underline">
                  <DownloadIcon className="w-5 h-5" />
                </a>
              ) : (
                <button type="button" title={s.exportBtn} aria-label={s.exportBtn} data-testid="ve-export"
                  onClick={doExport} disabled={busy !== ''}
                  className="grid place-items-center w-10 h-10 rounded-md border bg-black/55 border-white/25 text-white cursor-pointer hover:bg-black/70 disabled:opacity-60">
                  {busy === 'render'
                    ? <Spinner />
                    : <DownloadIcon className="w-5 h-5" />}
                </button>
              )}
            </div>

            {/* The crop shapes dock UNDER THE TOOLS, not along the bottom.
                A floating bar there covers the lower third of a crop
                rectangle that starts out filling the frame — measured with
                `elementFromPoint`, which returned the bar where the corner
                segment is — so the segments would not be draggable at all. */}
            {mode === 'crop' && (
              <div className="absolute top-14 inset-x-2 flex justify-center pointer-events-none">
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
                    {/* Free is shown only once a corner drag has made one. It
                        is a RESULT, not a mode to switch into — there is
                        nothing for it to mean before a rectangle exists. */}
                    {freeAspect > 0 && (
                      <button type="button" data-testid="ve-aspect-free" onClick={() => setAspectId('free')}
                        className={`rounded px-2 py-1 text-[0.8rem] border cursor-pointer rtl:font-ar ${
                          aspectId === 'free' ? 'bg-green-600 border-green-700' : 'bg-transparent border-white/25 hover:bg-white/10'}`}>
                        {s.free}
                      </button>
                    )}
                  </div>
                )}
                </div>
              </div>
            )}

            {/* And the controls for whichever tool is active, along the bottom. */}
            <div className="absolute bottom-2 inset-x-2 flex justify-center pointer-events-none">
              <div className="pointer-events-auto max-w-full overflow-x-auto rounded-md bg-black/70 backdrop-blur-sm border border-white/15 text-white px-2 py-1.5">
                {mode === 'censor' && (
                  <div className="flex items-center gap-2 whitespace-nowrap" data-testid="ve-censor-bar">
                    {picked ? (
                      <>
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

                {/* Text mode has no panel — everything a caption has is on the
                    caption. What it still needs is the GESTURE, once, while
                    there is nothing to look at. */}
                {mode === 'text' && captions.length === 0 && (
                  <span className="block text-[0.8rem] opacity-85 rtl:font-ar" data-testid="ve-caption-hint">{s.addCaptionBox}</span>
                )}

              </div>
            </div>

            {/* The export's progress, over the picture, because that is where
                you are looking. There is deliberately no result preview — the
                stage already showed it frame for frame. */}
            {busy === 'render' && (
              <div className="absolute inset-0 grid place-items-center bg-black/60">
                <div className="flex flex-col items-center gap-3 text-white">
                  <span className="text-[1.4rem] font-mono" data-testid="ve-progress">
                    {s.progress(progress.done, progress.total)}
                  </span>
                  <Button className="px-3 py-1" data-testid="ve-cancel"
                    onClick={() => { void ask({ kind: 'cancel' }) }}>{s.cancel}</Button>
                </div>
              </div>
            )}
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
          {/* The joined length lives here now rather than in a row of its own —
              it is the one fact the removed summary carried that the transport
              was already showing. */}
          <span className="text-[0.8rem] font-mono opacity-80" data-testid="ve-total">{fmt(t)} / {fmt(duration)}</span>
        </div>

        {/* The notes that have to stay on screen, on one line under the
            transport rather than a page below it — there is no page below it
            any more. */}
        <div className="wrap pb-2 flex flex-col gap-1 text-sand-100">
          {previewError !== 0 && (
            <p className="text-[0.8rem] text-gold-400 rtl:font-ar" data-testid="ve-preview-error">
              {s.previewFailed(previewError)}
              {current.info.decodable ? ` ${s.previewStillExports}` : ''}
            </p>
          )}
          {audioPlan !== 'copy' && (
            <p className="text-[0.78rem] text-gold-400 rtl:font-ar" data-testid="ve-audio-note">
              {audioPlan === 'mixed' ? s.audioMixed : audioPlan === 'missing' ? s.audioMissing : s.audioNone}
            </p>
          )}
          {out && (
            <p className="text-[0.78rem] opacity-70 font-mono" data-testid="ve-out-info">
              {s.outInfo(mb(out.size), out.audio === 'copied' ? s.withSound : s.silent)}
            </p>
          )}
          {clips.reduce((n, c) => n + c.file.size, 0) > 300 * 1048576 && (
            <p className="text-[0.78rem] text-gold-400 rtl:font-ar" data-testid="ve-big">{s.big}</p>
          )}
        </div>

        {why && (
          <div className="absolute inset-0 z-10 grid place-items-center bg-black/70 p-4" data-testid="ve-censor-why">
            <div className="w-[min(92vw,30rem)] rounded-lg border border-[color:var(--line)] bg-[var(--surface)] p-5 flex flex-col gap-3">
              <p className="font-display rtl:font-ar text-[1.05rem] font-semibold text-ink">{s.censorInfo}</p>
              <p className="text-[0.9rem] text-ink-soft rtl:font-ar">{s.censorWhy}</p>
              <div className="flex justify-end">
                <Button variant="primary" data-testid="ve-censor-why-close" onClick={() => setWhy(false)}>{s.close}</Button>
              </div>
            </div>
          </div>
        )}

        {/* Leaving throws the session away, so it asks. Rendered over the
            editor rather than as a `window.confirm` so it can say what is
            actually lost and read as part of the tool. */}
        {confirmBack && (
          <div className="absolute inset-0 z-10 grid place-items-center bg-black/70 p-4" data-testid="ve-confirm-back">
            <div className="w-[min(92vw,26rem)] rounded-lg border border-[color:var(--line)] bg-[var(--surface)] p-5 flex flex-col gap-3">
              <p className="font-display rtl:font-ar text-[1.05rem] font-semibold text-ink">{s.discardTitle}</p>
              <p className="text-[0.9rem] text-ink-soft rtl:font-ar">{s.discardBody}</p>
              <div className="flex flex-wrap gap-2 justify-end">
                <Button data-testid="ve-back-cancel" onClick={() => setConfirmBack(false)}>{s.keepEditing}</Button>
                <Button variant="primary" data-testid="ve-back-discard" onClick={discard}>{s.discard}</Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Settings are FULL SCREEN, not a pill along the bottom. On a phone that
          row was wider than the viewport — "argest side" was the first thing
          visible of it — so the controls it holds were partly unreachable on
          the device this tool is most used from. */}
      {settings && (
        <div className="fixed inset-0 z-50 bg-[var(--bg)] overflow-y-auto" data-testid="ve-settings-panel">
          <div className="wrap py-6 flex flex-col gap-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-display rtl:font-ar text-[1.3rem] font-semibold text-ink">{s.modeMore}</h2>
              {/* An X, not a "Done" button. Nothing here is submitted — every
                  control takes effect as it is touched — so a word that reads
                  like a commit step describes a transaction that does not
                  happen. This screen is closed, not finished. */}
              <button type="button" data-testid="ve-settings-close" onClick={() => setSettings(false)}
                title={s.close} aria-label={s.close}
                className="grid place-items-center w-9 h-9 rounded-md border border-[color:var(--line)] bg-[var(--surface)] text-ink cursor-pointer hover:bg-[color:var(--bg)]">
                <CloseIcon className="w-4 h-4" />
              </button>
            </div>

            <Field label={s.quality}>
              <Select value={quality} data-testid="ve-quality" onChange={(e) => setQuality(Number(e.target.value))}>
                {s.qualities.map((q, i) => <option key={q} value={i}>{q}</option>)}
              </Select>
            </Field>

            <div className="flex flex-col gap-1">
              <Field label={s.maxHeight}>
                <Select value={maxHeight} data-testid="ve-height" onChange={(e) => setMaxHeight(Number(e.target.value))}>
                  {HEIGHTS.map((h) => <option key={h} value={h}>{h}p</option>)}
                </Select>
              </Field>
              <p className="text-[0.8rem] text-ink-faint rtl:font-ar">
                <span className="font-mono" data-testid="ve-out-size">{size.width}×{size.height}</span>
                {' — '}{s.noUpscale}
              </p>
            </div>

            {audioPlan === 'copy' && (
              <Check>
                <input type="checkbox" checked={keepAudio} data-testid="ve-keep-audio"
                  onChange={(e) => setKeepAudio(e.target.checked)} />
                <span>{s.keepAudio} <span className="text-ink-faint">— {s.audioCopied}</span></span>
              </Check>
            )}

            {/* The clips live HERE now, not on a page under the video — there
                is no page under the video. Adding one mid-edit is gone with it:
                the join order is decided when you pick the files, which is the
                moment somebody actually knows what order they want. */}
            {clips.length > 1 && (
              <div className="flex flex-col gap-1">
                <FieldLabel>{s.joined(clips.length, fmt(duration))}</FieldLabel>
                <ul className="flex flex-col gap-1" data-testid="ve-clips">
                  {clips.map((c, i) => (
                    <li key={c.slot} data-testid={`ve-clip-${i}`}
                      className={`flex flex-wrap items-center gap-2 rounded-md border px-2 py-1 text-[0.85rem] ${i === sel ? 'border-green-700' : 'border-[color:var(--line)]'}`}>
                      <button type="button" className="border-0 bg-transparent p-0 text-start text-ink underline-offset-2 hover:underline cursor-pointer"
                        onClick={() => { setSel(i); setSettings(false) }} data-testid={`ve-select-${i}`}>{c.file.name}</button>
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
              </div>
            )}
          </div>
        </div>
      )}

      {/* Shown ONLY when something has actually gone wrong. It used to sit on a
          toggle beside every working run, which is a permanent invitation to
          read a bug report about a tool that is behaving. */}
      {previewError !== 0 && (
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
      </>, document.body)}
    </Stack>
  )
}
