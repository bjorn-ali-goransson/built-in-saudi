import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocale } from '../../i18n'
import { Button, Field, FileError, Panel, Seg, SegButton, Spinner, Stack } from '../../components/ui'
import { DownloadIcon } from '../../components/icons'
import { setWorkInProgress } from '../../lib/workInProgress'
import { even } from '../../lib/mp4Encode'
import {
  accumulate, corrections, drawStabilised, followCorrections, keptFraction, requiredZoom, shakeOf,
  smooth, STILL, subjectSpread, TRACK_LOST,
  type Box, type Estimate, type TrackPoint,
} from './motion'
// TYPES ONLY from the worker. Importing a value out of a `.worker.ts` pulls its
// module body into the page bundle, and its body assigns `self.onmessage` —
// which on the main thread is `window.onmessage`.
import type { ProbeInfo, RenderPlan, Req, Res } from './stabilize.worker'

// Omit over a union has to distribute, or neither variant's fields survive.
type ReqBody = Req extends infer T ? (T extends { id: number } ? Omit<T, 'id'> : never) : never

/** Arabic-Indic digits. `toFixed` returns Latin ones whatever the locale, which
 *  is how an Arabic page ends up printing `1.4` in the middle of a sentence. */
const arNum = (n: number) => n.toLocaleString('ar-SA')

/** m:ss, which is what a clip this length is read in. */
const clamp01 = (v: number) => Math.min(1, Math.max(0, v))

const clock = (sec: number) => {
  const t = Math.max(0, Math.floor(sec))
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`
}

/**
 * How far the smoothing looks, IN SECONDS rather than in frames.
 *
 * Frames are the wrong unit: the same window is a third of a second at 60fps
 * and two thirds at 24, so a radius in frames means a different tool depending
 * on what the phone recorded at. What a person is choosing is how long a wobble
 * has to last before it counts as where the camera is going.
 */
/**
 * How much of the camera path to smooth, in SECONDS, as the ends of one slider.
 *
 * It was three named levels, and a slider is the better control here for a
 * measured reason rather than a stylistic one: this tool's whole pitch is that
 * the cost of steadying is a live figure derived from YOUR clip, and three
 * buttons quantise a continuous trade into three samples of it. The clip is
 * analysed once, so any value on the bar re-prices in three array passes — the
 * property that made the levels instant in the first place is what makes a
 * slider affordable now.
 */
const MIN_SMOOTH = 0.1
const MAX_SMOOTH = 1.5

/** Below this there is nothing worth taking out, and saying so is more useful
 *  than charging somebody 15% of their picture for it. Source pixels, RMS. */
const NEGLIGIBLE = 0.6

const STR = {
  en: {
    heroTitle: 'Steady a shaky clip',
    heroBody: 'Handheld video wobbles. This measures how the camera actually moved, smooths that path, and slides each frame back under it — in your browser, with nothing uploaded. Steadying always costs picture, because the edges slide out of the frame, and this works out how much from your clip rather than making you guess.',
    pick: 'Choose a video',
    reading: 'Reading the file…',
    analysing: 'Measuring the movement…',
    exporting: 'Writing the video…',
    frames: (a: number, b: number) => `${a} of ${b} frames`,
    mode: 'What to hold still',
    modeCamera: 'The camera',
    modeSubject: 'A subject',
    drawBox: 'Drag a box around what to follow.',
    redraw: 'Draw a different box',
    tracking: 'Following the subject…',
    lost: (at: string) => `The subject was lost at ${at}. From there the frame holds where it last saw it — draw a box around something with more texture in it, or on a moment when it is clearer.`,
    noSubject: 'There is not enough texture in that box to follow. A wall, the sky or a blown-out window has nothing to match from one frame to the next — draw the box around something with detail in it.',
    strays: (px: string) => `The subject stays within ${px} px of the middle.`,
    tightness: 'How tightly to follow',
    looser: 'Looser',
    tighter: 'Tighter',
    subjectCost: 'Following a subject costs far more picture than steadying a camera, because the frame has to cover everywhere it goes. The figure below is for this clip and this box.',
    smoothing: 'How much to steady',
    seconds: (v: string) => `${v}s of camera path smoothed`,
    lessSteady: 'Less',
    moreSteady: 'More',
    cost: (kept: string, w: number, h: number) => `Keeps ${kept} of the picture · ${w}×${h}`,
    removed: (px: string, deg: string) => `Takes out ${px} px and ${deg}° of wobble, on average, per frame.`,
    steady: 'There is almost no camera shake in this clip — steadying it would cost picture and change nothing you can see. It is offered anyway, in case you disagree with the measurement.',
    tooMuch: 'The shake in this clip is bigger than the margin a crop can buy back, so some frames will still drift. Gentle costs the least picture and gets the most of it.',
    position: 'Position in the clip',
    ghost: 'Ghost the original over it',
    ghostHint: 'Both at once, half and half. What you are looking at is the gap between them — where the frame had to move to hold the picture still.',
    measuring: 'Measuring the movement — the picture is playing meanwhile.',
    play: 'Play',
    pause: 'Pause',
    keepAudio: 'Keep the sound',
    noAudio: 'This clip has no sound track.',
    export: 'Make the video',
    download: 'Download',
    again: 'Start again',
    out: (mb: string) => `${mb} MB`,
    unsupportedTitle: 'This browser cannot re-encode video',
    unsupportedBody: 'Steadying a clip means decoding every frame, redrawing it and encoding it again, which needs WebCodecs with an H.264 encoder behind it. This browser does not have one. Chrome, Edge and Safari 16.4 and later do; Firefox on Android does not.',
    trimLink: 'Trim a video without re-encoding',
    errors: {
      'not-mp4': 'That does not look like an MP4. This tool reads .mp4 and .mov files.',
      'no-video': 'That file has no video track in it.',
      'no-encoder': 'This browser refused to encode a video that size.',
      'no-frames': 'No frames could be decoded from that file.',
      'no-subject': 'There is not enough texture in that box to follow.',
      generic: 'That video could not be read.',
    } as Record<string, string>,
  },
  ar: {
    heroTitle: 'ثبّت مقطعًا مهتزًّا',
    heroBody: 'الفيديو المصوَّر باليد يهتزّ. تقيس هذه الأداة حركة الكاميرا فعليًّا، وتنعّم مسارها، وتزحزح كل إطار ليعود تحته — داخل متصفحك دون رفع شيء. والتثبيت يكلّف صورةً دائمًا، لأن الأطراف تخرج من الإطار، وهنا يُحسب المقدار من مقطعك أنت لا بالتخمين.',
    pick: 'اختر فيديو',
    reading: 'جارٍ قراءة الملف…',
    analysing: 'جارٍ قياس الحركة…',
    exporting: 'جارٍ كتابة الفيديو…',
    frames: (a: number, b: number) => `${arNum(a)} من ${arNum(b)} إطارًا`,
    mode: 'ما الذي يُثبَّت',
    modeCamera: 'الكاميرا',
    modeSubject: 'هدف متحرك',
    drawBox: 'ارسم مربّعًا حول ما تريد تتبّعه.',
    redraw: 'ارسم مربّعًا آخر',
    tracking: 'جارٍ تتبّع الهدف…',
    lost: (at: string) => `فُقد الهدف عند ${at}. ومن هناك يثبت الإطار على آخر موضع رآه فيه — ارسم المربّع حول شيء أوضح تفصيلًا، أو عند لحظة يظهر فيها أبين.`,
    noSubject: 'لا توجد تفاصيل كافية في هذا المربّع للتتبّع. فالجدار أو السماء أو نافذة محترقة الضوء لا شيء فيها يُطابَق من إطار لآخر — ارسم المربّع حول شيء له تفاصيل.',
    strays: (px: string) => `يبقى الهدف على بعد ${px} بكسل من المنتصف.`,
    tightness: 'شدّة الالتصاق بالهدف',
    looser: 'أوسع',
    tighter: 'أضيق',
    subjectCost: 'تتبّع هدف متحرك يكلّف من الصورة أكثر بكثير من تثبيت الكاميرا، لأن الإطار يجب أن يغطي كل ما يمر به. والرقم أدناه محسوب لهذا المقطع ولهذا المربّع.',
    smoothing: 'مقدار التثبيت',
    seconds: (v: string) => `تنعيم ${v} ثانية من مسار الكاميرا`,
    lessSteady: 'أقل',
    moreSteady: 'أكثر',
    cost: (kept: string, w: number, h: number) => `يُبقي ${kept} من الصورة · ${arNum(w)}×${arNum(h)}`,
    removed: (px: string, deg: string) => `يزيل ${px} بكسل و${deg}° من الاهتزاز في المتوسط لكل إطار.`,
    steady: 'لا يكاد يوجد اهتزاز في هذا المقطع — وتثبيته سيكلّف صورةً دون تغيير تراه. والخيار متاح على أي حال إن كنت ترى غير ما قِيس.',
    tooMuch: 'الاهتزاز في هذا المقطع أكبر من الهامش الذي يشتريه الاقتصاص، فستبقى بعض الإطارات منزاحة. والخيار الخفيف أقلّها كلفةً في الصورة وأكثرها إبقاءً لها.',
    position: 'الموضع في المقطع',
    ghost: 'اعرض الأصل شفّافًا فوقه',
    ghostHint: 'الاثنان معًا، نصفًا بنصف. وما تراه هو الفرق بينهما — أي كم تحرّك الإطار ليبقى المنظر ثابتًا.',
    measuring: 'جارٍ قياس الحركة — والصورة تعمل في أثناء ذلك.',
    play: 'تشغيل',
    pause: 'إيقاف',
    keepAudio: 'أبقِ الصوت',
    noAudio: 'لا يحتوي هذا المقطع على مسار صوتي.',
    export: 'أنشئ الفيديو',
    download: 'تنزيل',
    again: 'ابدأ من جديد',
    out: (mb: string) => `${mb} ميجابايت`,
    unsupportedTitle: 'هذا المتصفح لا يستطيع إعادة ترميز الفيديو',
    unsupportedBody: 'تثبيت المقطع يعني فكّ ترميز كل إطار وإعادة رسمه وترميزه من جديد، وهذا يحتاج WebCodecs ومعه مرمّز H.264. وهذا المتصفح لا يملكه. كروم وإيدج وسفاري ١٦٫٤ فأحدث تملكه، وفَيَرفُكس على أندرويد لا يملكه.',
    trimLink: 'قصّ فيديو دون إعادة ترميز',
    errors: {
      'not-mp4': 'لا يبدو هذا ملف MP4. تقرأ هذه الأداة ملفات ‎.mp4‎ و‎.mov‎.',
      'no-video': 'لا يحتوي هذا الملف على مسار فيديو.',
      'no-encoder': 'رفض المتصفح ترميز فيديو بهذا المقاس.',
      'no-frames': 'تعذّر فكّ ترميز أي إطار من هذا الملف.',
      'no-subject': 'لا توجد تفاصيل كافية في هذا المربّع للتتبّع.',
      generic: 'تعذّرت قراءة هذا الفيديو.',
    } as Record<string, string>,
  },
}

export default function VideoStabilizeTool() {
  const { locale } = useLocale()
  const s = locale === 'ar' ? STR.ar : STR.en
  const isRtl = locale === 'ar'

  const [supported, setSupported] = useState<boolean | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [url, setUrl] = useState('')
  const [probed, setProbed] = useState<ProbeInfo | null>(null)
  /**
   * What the ELEMENT says it will show, which is the authority on the picture's
   * shape — see the note on the metadata handler below.
   *
   * Held separately and applied on the way OUT rather than written back into
   * the probe, because the two arrive in either order: the element has metadata
   * long before a large file has been demuxed, so a correction written at that
   * moment is overwritten by the probe that follows it. That race is exactly
   * what the first version did, and it looked like the fix not working at all.
   */
  const [elShape, setElShape] = useState<{ width: number; height: number } | null>(null)
  const info = useMemo(() => (probed && elShape && elShape.width && elShape.height
    ? { ...probed, width: elShape.width, height: elShape.height }
    : probed), [probed, elShape])
  const [steps, setSteps] = useState<Estimate[] | null>(null)
  const [mode, setMode] = useState<'camera' | 'subject'>('camera')
  /** The tracked subject, in source pixels relative to the frame centre. */
  const [points, setPoints] = useState<TrackPoint[] | null>(null)
  /** The box being dragged out, in fractions of the stage. */
  const [drawing, setDrawing] = useState<Box | null>(null)
  const [smoothSec, setSmoothSec] = useState(0.5)
  /** How tightly the framing chases the subject, in SECONDS of easing. 0 nails
   *  it to the middle and pays for every step it takes in crop. */
  const [followSec, setFollowSec] = useState(0.35)
  const [keepAudio, setKeepAudio] = useState(true)
  const [busy, setBusy] = useState<'' | 'read' | 'analyse' | 'track' | 'export'>('')
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [error, setError] = useState('')
  const [ghost, setGhost] = useState(false)
  const [pos, setPos] = useState(0)
  /** The element's own duration, which arrives before the probe's does. */
  const [elDur, setElDur] = useState(0)
  const boxRef = useRef<HTMLDivElement | null>(null)
  const dragRef = useRef<{ x: number; y: number } | null>(null)
  const [playing, setPlaying] = useState(false)
  const [out, setOut] = useState<{ url: string; size: number; audio: string } | null>(null)

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const workerRef = useRef<Worker | null>(null)
  const pending = useRef(new Map<number, (r: Res) => void>())
  const nextId = useRef(1)

  // ASKED, not assumed. A Chromium built without proprietary codecs exposes the
  // whole WebCodecs API with no H.264 behind it and answers `supported: false`
  // for every avc1 configuration — so the gate has to come from the answer
  // rather than from the constructor existing.
  useEffect(() => {
    let live = true
    void (async () => {
      if (typeof VideoEncoder === 'undefined' || typeof VideoDecoder === 'undefined') {
        if (live) setSupported(false)
        return
      }
      try {
        const r = await VideoEncoder.isConfigSupported({
          codec: 'avc1.42001f', width: 640, height: 360, bitrate: 1_000_000, avc: { format: 'avc' },
        })
        if (live) setSupported(!!r.supported)
      } catch { if (live) setSupported(false) }
    })()
    return () => { live = false }
  }, [])

  const worker = useCallback(() => {
    if (!workerRef.current) {
      const w = new Worker(new URL('./stabilize.worker.ts', import.meta.url), { type: 'module' })
      w.onmessage = (e: MessageEvent<Res>) => {
        const r = e.data
        if (r.kind === 'progress') { setProgress({ done: r.done, total: r.total }); return }
        const resolve = pending.current.get(r.id)
        if (resolve) { pending.current.delete(r.id); resolve(r) }
      }
      workerRef.current = w
    }
    return workerRef.current
  }, [])

  const ask = useCallback((req: ReqBody): Promise<Res> => {
    const id = nextId.current++
    return new Promise((resolve) => {
      pending.current.set(id, resolve)
      worker().postMessage({ ...req, id } as Req)
    })
  }, [worker])

  // TWO effects, and keeping them apart is not tidiness. Terminating the worker
  // in a cleanup keyed on `url` kills it the moment a file is PICKED — the old
  // render's cleanup runs when the url changes, which is between the probe and
  // the analysis — and the next request then goes to a terminated worker and is
  // never answered. The page sat on "measuring" for ever with nothing to
  // report. A cleanup keyed on a value that changes runs while the thing it is
  // cleaning up is still in use.
  useEffect(() => () => { workerRef.current?.terminate() }, [])
  useEffect(() => () => { if (url) URL.revokeObjectURL(url) }, [url])

  // A picked clip is work in progress by construction — a File cannot be
  // serialised, so there is no honest way to restore it after a reload (#228).
  useEffect(() => {
    setWorkInProgress('video-stabilize', !!file)
    return () => setWorkInProgress('video-stabilize', false)
  }, [file])

  async function pickFile(list: FileList | null) {
    const f = list?.[0]
    if (!f) return
    setError('')
    setSteps(null)
    setOut(null)
    setBusy('read')
    // The object URL is minted OUTSIDE the state updater and BEFORE the probe,
    // so the browser starts on the picture rather than queueing behind a full
    // demux — the fix `video-edit` records having left undone six lines away.
    const next = URL.createObjectURL(f)
    // THE PICTURE COMES UP FIRST, before the probe and long before the
    // analysis. Demuxing a phone recording and measuring every frame takes
    // seconds, and a blank rectangle for those seconds is indistinguishable
    // from a tool that did not accept the file — which is the dead-UI failure
    // this repo already refuses for image picks. The `<video>` needs nothing
    // from us but a URL, so there is no reason to make anybody wait for it.
    if (url) URL.revokeObjectURL(url)
    setFile(f)
    setUrl(next)
    setProbed(null); setElShape(null)
    setPos(0)
    const res = await ask({ kind: 'probe', file: f })
    if (res.kind !== 'probed') {
      URL.revokeObjectURL(next)
      setFile(null)
      setUrl('')
      setBusy('')
      setError(s.errors[res.kind === 'error' ? res.message : 'generic'] ?? s.errors.generic)
      return
    }
    setProbed(res.info)
    setKeepAudio(res.info.hasAudio)

    setBusy('analyse')
    setProgress({ done: 0, total: res.info.frames })
    const a = await ask({ kind: 'analyse' })
    setBusy('')
    if (a.kind !== 'analysed') {
      setError(s.errors[a.kind === 'error' ? a.message : 'generic'] ?? s.errors.generic)
      return
    }
    setSteps(a.steps)
  }

  // Everything below is derived from ONE analysis. Changing how hard to smooth
  // re-runs three array passes over three numbers a frame and nothing else — no
  // second decode — which is why the trade can be shown as a live figure rather
  // than as a setting you commit to and wait for.
  const path = useMemo(() => (steps ? accumulate(steps) : null), [steps])
  const plan = useMemo(() => {
    if (!path || !info) return null
    const radius = Math.max(1, Math.round(smoothSec * info.fps))
    const cam = corrections(path, smooth(path, radius))
    // FOLLOWING IS COMPOSED ON TOP OF STEADYING, never instead of it. The
    // subject's position is read in the already-steady frame, so the shake
    // comes out at full strength whatever the tightness says and the second
    // slider means exactly one thing.
    const following = mode === 'subject' && points
    const cs = following
      ? followCorrections(points, cam, Math.max(0, Math.round(followSec * info.fps)))
      : cam
    const zoom = requiredZoom(cs, info.width, info.height)
    // NEVER LARGER THAN WHAT SURVIVED. The output is the cropped rectangle at
    // its own size, so every pixel in the file is a pixel that was recorded;
    // scaling it back up to the source dimensions would add pixels and no
    // detail, which is the honesty `print-size` and `video-edit` both apply.
    const outW = even(info.width / zoom)
    const outH = even(info.height / zoom)
    return {
      cs,
      zoom,
      shake: shakeOf(cs, steps ?? []),
      out: { width: outW, height: outH },
      following,
      strays: following ? subjectSpread(points, cs) : 0,
      // Where the tracker stopped being sure, in seconds — the one thing a
      // follow can get wrong that looks fine on the frame you are looking at.
      lostAt: following
        ? (() => {
          const i = points.findIndex((p) => p.score < TRACK_LOST)
          return i > 0 ? i / info.fps : 0
        })()
        : 0,
    }
  }, [path, info, smoothSec, steps, mode, points, followSec])

  /**
   * The preview and the export go through ONE function.
   *
   * `drawStabilised` is called here with a `<video>` element and in the worker
   * with a decoded `VideoFrame`, and both are a `CanvasImageSource`. A preview
   * that computed the transform its own way is a preview that can lie, and you
   * would only find out after the encode — which is the property `video-edit`
   * is built on and the reason there is no second renderer here either.
   */
  useEffect(() => {
    let raf = 0
    const paint = () => {
      raf = requestAnimationFrame(paint)
      const v = videoRef.current
      const c = canvasRef.current
      if (!v || !c || !v.videoWidth || v.readyState < 2) return
      const ctx = c.getContext('2d')
      if (!ctx) return
      const src = { width: v.videoWidth, height: v.videoHeight }
      const out = { width: c.width, height: c.height }
      // BEFORE THE ANALYSIS THERE IS NOTHING TO CORRECT, and the clip is shown
      // anyway. Identity motion at zoom 1 is the frame as recorded, drawn by
      // the same function everything else here goes through.
      //
      // AND WHILE A SUBJECT IS BEING CHOSEN, for a different reason that lands
      // in the same branch: the box is matched against the frame AS RECORDED,
      // so it has to be drawn on that. A box dragged over an already-cropped,
      // already-corrected picture is in the wrong coordinates by exactly the
      // correction — the `video-edit` crop rule, which shows the whole clip
      // while the rectangle is being decided for the same reason.
      if (!plan || !info || (mode === 'subject' && !points)) {
        drawStabilised(ctx, v, src, STILL, 1, out)
        return
      }
      // Frame index from the clock. A browser gives no frame number, so this is
      // right to within one frame — and the correction for adjacent frames
      // differs by a fraction of a pixel, which is why that is good enough here
      // and not good enough for the export, where the index is the arrival
      // order of the decoded frames themselves.
      const i = Math.min(plan.cs.length - 1, Math.max(0, Math.round(v.currentTime * info.fps)))
      const clip = { width: info.width, height: info.height }
      if (ghost) {
        // The original UNDERNEATH at the same zoom, so the two are the same
        // framing and the only difference on screen is the correction itself.
        // Comparing a full frame against a cropped one would show the crop,
        // which is the other thing this tool measures and not this one.
        drawStabilised(ctx, v, clip, STILL, plan.zoom, out)
        ctx.globalAlpha = 0.5
        drawStabilised(ctx, v, clip, plan.cs[i], plan.zoom, out, false)
        ctx.globalAlpha = 1
        return
      }
      drawStabilised(ctx, v, clip, plan.cs[i], plan.zoom, out)
    }
    raf = requestAnimationFrame(paint)
    return () => cancelAnimationFrame(raf)
  }, [plan, info, ghost, mode, points])

  async function run() {
    if (!plan || !info) return
    setError('')
    setBusy('export')
    setProgress({ done: 0, total: info.frames })
    const req: RenderPlan = {
      corrections: plan.cs,
      zoom: plan.zoom,
      out: plan.out,
      // A rate that scales with the picture and the frame rate, clamped so a
      // tiny clip is not starved and a 4K one does not produce a file nobody
      // can send.
      bitrate: Math.round(Math.min(16e6, Math.max(8e5, plan.out.width * plan.out.height * info.fps * 0.1))),
      keepAudio: keepAudio && info.hasAudio,
    }
    const res = await ask({ kind: 'render', plan: req })
    setBusy('')
    if (res.kind !== 'rendered') {
      setError(s.errors[res.kind === 'error' ? res.message : 'generic'] ?? s.errors.generic)
      return
    }
    setOut((o) => {
      if (o) URL.revokeObjectURL(o.url)
      return { url: URL.createObjectURL(res.blob), size: res.blob.size, audio: res.audio }
    })
  }

  /**
   * Follow whatever is inside `box` across the whole clip.
   *
   * A SECOND decode, and it says so while it runs. The alternative is holding
   * every frame's pyramid through the first pass on the chance that a box
   * arrives — which is the memory this tool is arranged to avoid, on the
   * device it is most used from.
   */
  async function runTrack(box: Box) {
    if (!steps || !info) return
    setError('')
    setOut(null)
    setBusy('track')
    setProgress({ done: 0, total: info.frames })
    const res = await ask({ kind: 'track', box, steps })
    setBusy('')
    if (res.kind !== 'tracked') {
      setPoints(null)
      setError(res.kind === 'error' && res.message === 'no-subject'
        ? s.noSubject
        : s.errors[res.kind === 'error' ? res.message : 'generic'] ?? s.errors.generic)
      return
    }
    setPoints(res.points)
  }

  /** Pointer position as a fraction of the stage, unclamped for the same reason
   *  `video-edit` reads it unclamped: the stage is letterboxed and a thumb
   *  crosses the black long before the screen ends. */
  function at(e: React.PointerEvent) {
    const r = boxRef.current?.getBoundingClientRect()
    if (!r) return { x: 0.5, y: 0.5 }
    return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height }
  }

  function boxDown(e: React.PointerEvent<HTMLDivElement>) {
    if (e.button !== 0 || mode !== 'subject' || !steps) return
    boxRef.current?.setPointerCapture(e.pointerId)
    const p = at(e)
    dragRef.current = p
    setPoints(null)
    setDrawing({ x: p.x, y: p.y, w: 0, h: 0 })
  }

  function boxMove(e: React.PointerEvent<HTMLDivElement>) {
    const from = dragRef.current
    if (!from) return
    const p = at(e)
    setDrawing({
      x: Math.min(from.x, p.x),
      y: Math.min(from.y, p.y),
      w: Math.abs(p.x - from.x),
      h: Math.abs(p.y - from.y),
    })
  }

  function boxUp(e: React.PointerEvent<HTMLDivElement>) {
    const from = dragRef.current
    dragRef.current = null
    if (boxRef.current?.hasPointerCapture(e.pointerId)) boxRef.current.releasePointerCapture(e.pointerId)
    if (!from) return
    const p = at(e)
    const box = {
      x: clamp01(Math.min(from.x, p.x)),
      y: clamp01(Math.min(from.y, p.y)),
      w: Math.abs(p.x - from.x),
      h: Math.abs(p.y - from.y),
    }
    // A stray tap is not a box. Anything under a twentieth of the frame across
    // is a misclick, and a box that small has nothing in it to match anyway.
    if (box.w < 0.05 || box.h < 0.05) { setDrawing(null); return }
    box.w = Math.min(box.w, 1 - box.x)
    box.h = Math.min(box.h, 1 - box.y)
    setDrawing(box)
    void runTrack(box)
  }

  function reset() {
    void ask({ kind: 'drop' })
    if (url) URL.revokeObjectURL(url)
    if (out) URL.revokeObjectURL(out.url)
    setFile(null); setUrl(''); setProbed(null); setElShape(null); setSteps(null); setOut(null); setError('')
    setGhost(false); setPos(0); setElDur(0); setPoints(null); setDrawing(null); setMode('camera')
  }

  function togglePlay() {
    const v = videoRef.current
    if (!v) return
    if (v.paused) void v.play()
    else v.pause()
  }

  if (supported === false) {
    return (
      <Stack data-testid="video-stabilize">
        <Panel className="gap-2" data-testid="vs-unsupported">
          <p className="text-[0.95rem] font-semibold text-ink rtl:font-ar">{s.unsupportedTitle}</p>
          <p className="text-[0.9rem] text-ink-soft rtl:font-ar">{s.unsupportedBody}</p>
          <a className="text-[0.9rem] text-green-700 underline rtl:font-ar" href={`/${locale}/apps/video-trim`}>{s.trimLink}</a>
        </Panel>
      </Stack>
    )
  }

  // ---------------------------------------------------------------- intake ---
  if (!file) {
    return (
      <Stack data-testid="video-stabilize">
        <div className="mx-[calc(50%-50vw)] w-screen max-w-[100vw] bg-green-600 text-sand-100">
          <div className="wrap py-[clamp(1.6rem,4.5vw,2.4rem)] flex flex-col gap-3">
            <h1 className="font-display rtl:font-ar text-[clamp(1.5rem,4.5vw,2.1rem)] font-bold leading-tight" style={{ color: 'var(--sand-100)' }}>
              {s.heroTitle}
            </h1>
            <p className="text-[0.98rem] leading-relaxed opacity-90 max-w-[46rem] rtl:font-ar">{s.heroBody}</p>
            <div className="flex flex-wrap items-center gap-3 mt-1">
              <label className="inline-flex self-start">
                {/* No `accept`: an accept string sends Chrome on Android to the
                    gallery picker, which lists only MediaStore-indexed media —
                    a clip sitting in Downloads is never offered (#225). */}
                <input type="file" className="sr-only" data-testid="vs-file"
                  onChange={(e) => { void pickFile(e.target.files) }} />
                <span className="cursor-pointer inline-flex items-center gap-2 rounded-md bg-white text-green-700 px-4 py-2 text-[0.9rem] font-semibold hover:bg-sand-100 rtl:font-ar">
                  {s.pick}
                </span>
              </label>
              {busy && (
                <span className="inline-flex items-center gap-2 text-[0.9rem] opacity-90 rtl:font-ar" data-testid="vs-busy">
                  <Spinner /> {busy === 'read' ? s.reading : s.analysing}
                </span>
              )}
            </div>
          </div>
        </div>
        {error && <FileError message={error} />}
      </Stack>
    )
  }

  // From the ELEMENT rather than from the probe, so the scrubber works before
  // the analysis has said anything about the file.
  const clipSeconds = info?.durationSec || elDur
  const kept = plan ? `${(keptFraction(plan.zoom) * 100).toFixed(0)}%` : ''
  const keptLabel = isRtl && plan ? `${arNum(Math.round(keptFraction(plan.zoom) * 100))}٪` : kept

  return (
    <Stack data-testid="video-stabilize">
      {/* The source element is what `drawStabilised` reads, and it is never the
          picture: ONE canvas is the answer, and the original appears only
          ghosted through it, in the same framing, where the gap between the
          two is the thing being shown. A second player beside it would be a
          second opinion about what the export contains. It still has to be
          laid out and decoding, so it is a 1px transparent element rather than
          `display: none`, which would stop it painting. */}
      <video ref={videoRef} src={url} playsInline muted loop data-testid="vs-video"
        onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)}
        onLoadedMetadata={() => {
          const v = videoRef.current
          setElDur(v?.duration ?? 0)
          // THE ELEMENT IS THE AUTHORITY ON THE PICTURE'S SHAPE. A demuxer reads
          // the frame size out of the file; this reports what will actually be
          // shown — that size after the rotation matrix and after the pixel
          // aspect ratio the bitstream asks for, which no container field
          // settles (measured: Chromium reports 320×240 for a file whose track
          // header claims 426×240). Sizing the stage from the probe and drawing
          // this frame into it is what stretches a picture, so the probe's
          // dimensions are corrected the moment the real ones arrive.
          if (v?.videoWidth && v.videoHeight) setElShape({ width: v.videoWidth, height: v.videoHeight })
        }}
        onTimeUpdate={() => setPos(videoRef.current?.currentTime ?? 0)}
        onSeeked={() => setPos(videoRef.current?.currentTime ?? 0)}
        className="absolute w-px h-px opacity-0 pointer-events-none" />

      <div className="grid place-items-center bg-black rounded-md overflow-hidden p-1">
        {/* The overlay is exactly the canvas, so a box drawn on it is a box in
            fractions of the PICTURE rather than of some padded container — the
            same thing the worker matches against. */}
        <div ref={boxRef} className="relative" data-testid="vs-frame"
          onPointerDown={boxDown} onPointerMove={boxMove} onPointerUp={boxUp}
          style={{ touchAction: mode === 'subject' ? 'none' : undefined }}>
          <canvas ref={canvasRef} data-testid="vs-stage"
            width={(mode === 'subject' && !points ? info?.width : plan?.out.width) ?? info?.width ?? 320}
            height={(mode === 'subject' && !points ? info?.height : plan?.out.height) ?? info?.height ?? 180}
            className="block max-w-full max-h-[60vh]" />
          {mode === 'subject' && drawing && (
            <div data-testid="vs-box" className="absolute border-2 border-green-400 pointer-events-none"
              style={{
                left: `${drawing.x * 100}%`, top: `${drawing.y * 100}%`,
                width: `${drawing.w * 100}%`, height: `${drawing.h * 100}%`,
              }} />
          )}
          {mode === 'subject' && !drawing && (
            <span data-testid="vs-draw-hint"
              className="absolute inset-x-0 bottom-2 text-center text-[0.8rem] text-white
                [text-shadow:0_0_4px_rgba(0,0,0,0.9)] rtl:font-ar pointer-events-none">
              {s.drawBox}
            </span>
          )}
        </div>
      </div>

      {/* A CLIP YOU CANNOT SCRUB IS A CLIP YOU CANNOT JUDGE. Shake is not
          uniform along a recording — the bad two seconds are what somebody
          wants to look at, and playing from the top every time to reach them
          is the difference between checking the result and hoping. */}
      <div className="flex items-center gap-3">
        <Button data-testid="vs-play" onClick={togglePlay}>{playing ? s.pause : s.play}</Button>
        <input type="range" className="flex-1 min-w-0 accent-green-600" data-testid="vs-scrub"
          aria-label={s.position}
          min={0} max={Math.max(0.1, clipSeconds)} step={0.01} value={Math.min(pos, clipSeconds)}
          onChange={(e) => {
            const v = videoRef.current
            if (!v) return
            v.currentTime = Number(e.target.value)
            setPos(Number(e.target.value))
          }} />
        <span className="text-[0.8rem] font-mono opacity-70 tabular-nums" data-testid="vs-time">
          {clock(Math.min(pos, clipSeconds))} / {clock(clipSeconds)}
        </span>
      </div>

      {busy === 'track' && (
        <p className="text-[0.9rem] text-ink-soft rtl:font-ar inline-flex items-center gap-2" data-testid="vs-tracking">
          <Spinner /> {s.tracking} {s.frames(progress.done, progress.total)}
        </p>
      )}
      {busy === 'analyse' && (
        <p className="text-[0.9rem] text-ink-soft rtl:font-ar inline-flex items-center gap-2" data-testid="vs-busy">
          <Spinner /> {s.analysing} {s.frames(progress.done, progress.total)}
        </p>
      )}
      {busy && !plan && (
        <p className="text-[0.85rem] text-ink-soft rtl:font-ar" data-testid="vs-measuring">{s.measuring}</p>
      )}

      {plan && info && (
        <Panel className="gap-3" data-testid="vs-panel">
          {/* WHAT to hold still, which is a different question from how hard.
              Steadying and following share every part of the pipeline — the
              same estimate, the same zoom arithmetic, the same renderer — so
              they are one tool with a choice rather than two apps. */}
          <Field label={s.mode}>
            <Seg>
              <SegButton active={mode === 'camera'} data-testid="vs-mode-camera"
                onClick={() => { setMode('camera'); setOut(null) }}>{s.modeCamera}</SegButton>
              <SegButton active={mode === 'subject'} data-testid="vs-mode-subject"
                onClick={() => {
                  setMode('subject')
                  setOut(null)
                  // BACK TO THE START, because the track begins at the first
                  // frame — so the picture the box is drawn on is the picture
                  // the tracker is given. Drawing it on frame 300 and matching
                  // from frame 0 is a box around whatever was there instead.
                  const v = videoRef.current
                  if (v) { v.pause(); v.currentTime = 0; setPos(0) }
                }}>{s.modeSubject}</SegButton>
            </Seg>
          </Field>

          {mode === 'subject' && (
            <>
              {/* Said BEFORE the box is drawn, not after the number appears.
                  Following a subject routinely costs half the picture, and
                  finding that out only once you have committed to a crop is
                  the thing this tool exists not to do. */}
              <p className="text-[0.85rem] text-ink-soft rtl:font-ar" data-testid="vs-subject-cost">{s.subjectCost}</p>
              {points && (
                <>
                  <div className="flex items-center gap-3">
                    <Button data-testid="vs-redraw" onClick={() => { setPoints(null); setDrawing(null); setOut(null) }}>
                      {s.redraw}
                    </Button>
                  </div>
                  <Field label={s.tightness}>
                    <div className="flex items-center gap-3">
                      <span className="text-[0.75rem] text-ink-faint rtl:font-ar">{s.looser}</span>
                      <input type="range" className="flex-1 min-w-0 accent-green-600" data-testid="vs-tightness"
                        aria-label={s.tightness}
                        min={0} max={1.5} step={0.05} value={followSec}
                        onChange={(e) => { setFollowSec(Number(e.target.value)); setOut(null) }} />
                      <span className="text-[0.75rem] text-ink-faint rtl:font-ar">{s.tighter}</span>
                    </div>
                  </Field>
                  <p className="text-[0.85rem] text-ink-soft rtl:font-ar" data-testid="vs-strays">
                    {s.strays(isRtl ? arNum(Number(plan?.strays.toFixed(0) ?? 0)) : (plan?.strays ?? 0).toFixed(0))}
                  </p>
                  {!!plan?.lostAt && (
                    <p className="text-[0.85rem] text-gold-700 rtl:font-ar" data-testid="vs-lost">
                      {s.lost(isRtl ? `${arNum(Number(plan.lostAt.toFixed(1)))} ث` : `${plan.lostAt.toFixed(1)}s`)}
                    </p>
                  )}
                </>
              )}
            </>
          )}

          {/* A SLIDER, not three buttons. The cost below re-prices as it moves,
              because the clip is analysed once and a new value is three array
              passes over three numbers a frame — so the trade is continuous
              here, and quantising it into three samples was throwing away the
              one thing this tool has that the incumbents do not. */}
          <Field label={s.smoothing}>
            <div className="flex items-center gap-3">
              <span className="text-[0.75rem] text-ink-faint rtl:font-ar">{s.lessSteady}</span>
              <input type="range" className="flex-1 min-w-0 accent-green-600" data-testid="vs-smooth"
                aria-label={s.smoothing}
                min={MIN_SMOOTH} max={MAX_SMOOTH} step={0.05} value={smoothSec}
                onChange={(e) => { setSmoothSec(Number(e.target.value)); setOut(null) }} />
              <span className="text-[0.75rem] text-ink-faint rtl:font-ar">{s.moreSteady}</span>
            </div>
          </Field>
          <p className="text-[0.8rem] font-mono opacity-70" data-testid="vs-smooth-value">
            {s.seconds(isRtl ? arNum(smoothSec) : smoothSec.toFixed(2))}
          </p>

          {/* Both at once rather than a hold-to-compare, which showed one or
              the other and left the reader to remember the first. The offset
              between the two IS the correction, so the thing being judged is
              on screen at the same moment as the thing it is judged against. */}
          <label className="inline-flex items-center gap-2 text-[0.9rem] text-ink-soft rtl:font-ar">
            <input type="checkbox" checked={ghost} data-testid="vs-ghost"
              onChange={(e) => setGhost(e.target.checked)} />
            {s.ghost}
          </label>
          {ghost && <p className="text-[0.8rem] text-ink-faint rtl:font-ar" data-testid="vs-ghost-hint">{s.ghostHint}</p>}

          {/* THE PRICE, and it is the reason this tool is worth building rather
              than copying: every stabiliser crops and almost none of them says
              by how much, or lets you see the number move as you choose. */}
          <p className="text-[0.9rem] font-semibold text-ink rtl:font-ar" data-testid="vs-cost">
            {s.cost(keptLabel, plan.out.width, plan.out.height)}
          </p>
          <p className="text-[0.85rem] text-ink-soft rtl:font-ar" data-testid="vs-removed">
            {s.removed(
              isRtl ? arNum(Number(plan.shake.pixels.toFixed(1))) : plan.shake.pixels.toFixed(1),
              isRtl ? arNum(Number(plan.shake.degrees.toFixed(2))) : plan.shake.degrees.toFixed(2),
            )}
          </p>

          {plan.shake.pixels < NEGLIGIBLE && (
            <p className="text-[0.85rem] text-ink-soft rtl:font-ar" data-testid="vs-steady">{s.steady}</p>
          )}
          {plan.zoom >= 2 && (
            <p className="text-[0.85rem] text-gold-700 rtl:font-ar" data-testid="vs-too-much">{s.tooMuch}</p>
          )}

          {info.hasAudio ? (
            <label className="inline-flex items-center gap-2 text-[0.9rem] text-ink-soft rtl:font-ar">
              <input type="checkbox" checked={keepAudio} data-testid="vs-audio"
                onChange={(e) => setKeepAudio(e.target.checked)} />
              {s.keepAudio}
            </label>
          ) : (
            <p className="text-[0.85rem] text-ink-faint rtl:font-ar" data-testid="vs-no-audio">{s.noAudio}</p>
          )}

          <div className="flex flex-wrap items-center gap-3">
            {out ? (
              <a className="inline-flex items-center gap-2 rounded-md bg-green-600 text-[color:var(--primary-ink)] px-4 py-2 text-[0.9rem] font-semibold rtl:font-ar"
                href={out.url} download={`steady-${file.name.replace(/\.[^.]+$/, '')}.mp4`} data-testid="vs-download">
                <DownloadIcon className="w-4 h-4" /> {s.download}
              </a>
            ) : (
              <Button variant="primary" data-testid="vs-export" disabled={busy === 'export'} onClick={() => void run()}>
                {s.export}
              </Button>
            )}
            {busy === 'export' && (
              <span className="inline-flex items-center gap-2 text-[0.85rem] text-ink-soft rtl:font-ar" data-testid="vs-exporting">
                <Spinner /> {s.exporting} {s.frames(progress.done, progress.total)}
              </span>
            )}
            {out && (
              <span className="text-[0.8rem] font-mono opacity-70" data-testid="vs-out-size">
                {s.out((out.size / 1048576).toFixed(1))}
              </span>
            )}
            <Button data-testid="vs-again" onClick={reset}>{s.again}</Button>
          </div>
        </Panel>
      )}

      {error && <FileError message={error} />}
    </Stack>
  )
}
