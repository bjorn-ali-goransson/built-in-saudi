import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocale } from '../../i18n'
import { Button, Field, FileError, Input, Seg, SegButton, Select, Spinner, Stack } from '../../components/ui'
import {
  BackIcon, CloseIcon, CogIcon, CropIcon, DownloadIcon, MosaicIcon, TextIcon, TiltIcon, TrashIcon,
} from '../../components/icons'
import { setWorkInProgress } from '../../lib/workInProgress'
import { decodeImage } from '../../lib/decodeImage'
import { whyUnreadable } from '../../lib/imageInput'
import { renderCaption } from '../../lib/captionBitmap'
import {
  ASPECTS, applyCensors, captionRect, cropFromDrag, cropRect, drawFrame, keptShare, SEGMENTS,
  type Caption, type Censor, type CensorMode, type Crop, type Rect,
} from '../../lib/frameCompose'

const WIP = 'image-edit'

/** Arabic-Indic digits. A template literal renders a number in Latin digits
 *  whatever the locale, which this repo has shipped and caught three times. */
const arNum = (n: number) => n.toLocaleString('ar-SA')

/**
 * ONE DEGREE CLOCKWISE, and it is on by default.
 *
 * It was asked for exactly like that, as a joke, and it is here as a real
 * control rather than as a gag in a comment — because a joke that cannot be
 * switched off is a defect, and one that does not actually do anything is a
 * lie about what the tool exports.
 *
 * IT IS APPLIED TO THE SOURCE, NOT TO THE OUTPUT FRAME, and that is the whole
 * correctness of it. It used to be a transform inside `compose`, which draws
 * the OUTPUT — so every view that goes through `compose` was tilted and the one
 * that does not was not. That one is crop mode, which draws the whole picture
 * with the rectangle over it, and crop mode is what you are looking at the
 * moment a picture opens: measured on the fixture, the edge sat at column 200
 * on both the top and the bottom row there and at 203/197 everywhere else. So
 * the opening screen of a tool built entirely on "the preview IS the export"
 * showed a square picture and exported a tilted one.
 *
 * Tilting the SOURCE fixes it everywhere at once and costs no per-view code:
 * crop mode, the censor and caption stages and the export all take their
 * picture from `source` below, so none of them can disagree about it again. It
 * also keeps the crop rectangle honest — the rectangle selects a fraction of
 * the picture you can see, rather than a fraction of a square one you cannot.
 *
 * The cover scale below is the reason it is not simply a `rotate`: turning a
 * rectangle inside its own frame exposes four empty corners, so the picture is
 * scaled up by exactly enough to keep them covered — about 2% at one degree.
 */
const TILT_DEG = 1
const TILT = (TILT_DEG * Math.PI) / 180

/**
 * How far a rotated w×h rectangle must be scaled to still cover an unrotated
 * one of the same shape.
 *
 * Rotating the output rect back through -θ gives a bounding box of
 * (w·cos + h·sin) by (w·sin + h·cos); the drawn rectangle has to contain it on
 * both axes, and the larger of the two demands wins.
 */
function coverScale(w: number, h: number, angle: number): number {
  const c = Math.abs(Math.cos(angle))
  const s = Math.abs(Math.sin(angle))
  return Math.max(c + (h / w) * s, c + (w / h) * s)
}

const STR = {
  en: {
    heroTitle: 'Edit a picture without uploading it',
    heroBody: 'Crop it to the shape a platform wants, hide anything that should not be in it, and put a caption on top — all in your browser, with nothing sent anywhere. The same editor as the video one, for the one frame case. It also tilts every picture one degree clockwise: the only feature here nobody asked for, on by default, with a button to turn it off once the novelty wears thin.',
    pick: 'Choose a picture',
    reading: 'Reading the picture…',
    back: 'Back',
    discardTitle: 'Leave the editor?',
    discardBody: 'Your crop, boxes and captions are only here — nothing has been saved anywhere, because nothing has been uploaded anywhere. Export first if you want to keep them.',
    keepEditing: 'Keep editing',
    discard: 'Discard and leave',
    modeCrop: 'Crop',
    modeCensor: 'Hide something',
    modeText: 'Caption',
    modeMore: 'Output settings',
    free: 'Free',
    addBox: 'Drag on the picture to draw a box.',
    addCaptionBox: 'Drag on the picture to draw a text box.',
    deleteBox: 'Delete this box',
    boxSettings: 'This box',
    close: 'Close',
    text: 'Text',
    colour: 'Colour',
    hideWith: 'Hide with',
    modes: { pixelate: 'Pixelate', solid: 'Solid', blur: 'Blur' },
    solidWhy: 'Solid paints the region out, so there is nothing left in the picture to recover.',
    pixelWhy: 'Pixelating and blurring throw resolution away rather than removing anything, and a single picture gives very little of it back — a pixelated region reconstructed from one frame scores no better than a blank guess. That is NOT true of video, where the same subject is sampled dozens of times on a differently aligned grid; if this picture is a still from a clip somebody else also has, use solid.',
    kept: (pct: string) => `Keeps ${pct} of the picture`,
    outSize: 'Largest side',
    original: 'Original',
    format: 'Format',
    quality: 'Quality',
    lossless: 'PNG is lossless, so there is no quality to choose. It is bigger.',
    tilt: `Tilt it ${TILT_DEG}° clockwise — the only correct amount`,
    exportBtn: 'Export',
    download: 'Download',
    errors: {
      encode: 'The picture could not be exported in that format.',
    },
  },
  ar: {
    heroTitle: 'حرّر الصورة دون رفعها',
    heroBody: 'اقتصّها بالشكل الذي تطلبه المنصّة، واحجب ما لا ينبغي أن يظهر فيها، وضع عليها نصًّا — كل ذلك في متصفّحك دون إرسال شيء إلى أي مكان. هو محرّر الفيديو نفسه، لحالة الإطار الواحد. وهو يُميل كل صورة درجةً واحدة مع عقارب الساعة: الميزة الوحيدة هنا التي لم يطلبها أحد، مفعَّلة تلقائيًّا، ولها زرّ تُطفئها به متى فترت الطرفة.',
    pick: 'اختر صورة',
    reading: 'جارٍ قراءة الصورة…',
    back: 'رجوع',
    discardTitle: 'الخروج من المحرّر؟',
    discardBody: 'الاقتصاص والمربّعات والنصوص موجودة هنا فقط — لم يُحفظ شيء في أي مكان، لأنه لم يُرفع شيء إلى أي مكان. صدّر أولًا إن أردت الاحتفاظ بها.',
    keepEditing: 'متابعة التحرير',
    discard: 'تجاهل واخرج',
    modeCrop: 'اقتصاص',
    modeCensor: 'إخفاء جزء',
    modeText: 'نص',
    modeMore: 'إعدادات المُخرَج',
    free: 'حرّ',
    addBox: 'اسحب على الصورة لترسم مربّعًا.',
    addCaptionBox: 'اسحب على الصورة لترسم مربّع نص.',
    deleteBox: 'احذف هذا المربّع',
    boxSettings: 'هذا المربّع',
    close: 'إغلاق',
    text: 'النص',
    colour: 'اللون',
    hideWith: 'طريقة الإخفاء',
    modes: { pixelate: 'بكسلة', solid: 'حجب كامل', blur: 'تمويه' },
    solidWhy: 'الحجب الكامل يطمس المنطقة تمامًا، فلا يبقى في الصورة ما يمكن استرداده.',
    pixelWhy: 'البكسلة والتمويه يُسقطان الدقّة ولا يزيلان شيئًا، والصورة الواحدة لا تُعيد منها إلا القليل جدًّا — فإعادة بناء منطقة مبكسلة من إطار واحد لا تتفوّق على التخمين. وهذا لا يصحّ في الفيديو، حيث يُلتقط الهدف نفسه عشرات المرات على شبكة مختلفة المحاذاة؛ فإن كانت هذه الصورة لقطةً من مقطع لدى غيرك أيضًا، فاستخدم الحجب الكامل.',
    kept: (pct: string) => `يُبقي ${pct} من الصورة`,
    outSize: 'أطول ضلع',
    original: 'كما هي',
    format: 'الصيغة',
    quality: 'الجودة',
    lossless: 'صيغة PNG بلا فقد، فلا جودة تُختار. وهي أكبر حجمًا.',
    tilt: `أملها ${arNum(TILT_DEG)}° مع عقارب الساعة — المقدار الصحيح الوحيد`,
    exportBtn: 'تصدير',
    download: 'تنزيل',
    errors: {
      encode: 'تعذّر تصدير الصورة بهذه الصيغة.',
    },
  },
} as const

/**
 * The longest side the stage canvas is drawn at.
 *
 * It repaints whenever anything moves, so drawing a 48-megapixel photo at full
 * size on every pointer event is compositing work nobody can see. Everything on
 * top is proportional, so this is the same composition at a smaller size, and
 * the EXPORT is untouched — that one is drawn at the real output size.
 */
const PREVIEW_MAX = 1200

const FORMATS = [
  { id: 'image/png', label: 'PNG', ext: 'png' },
  { id: 'image/jpeg', label: 'JPEG', ext: 'jpg' },
  { id: 'image/webp', label: 'WebP', ext: 'webp' },
] as const

/** 0 means "as big as the crop is" — never upscale, the honesty `print-size`
 *  applies to paper and `video-edit` to frames. */
const SIDES = [0, 4096, 2048, 1600, 1080, 720]

type Mode = 'crop' | 'censor' | 'text'

const clamp01 = (n: number) => Math.min(1, Math.max(0, n))
const mb = (b: number) => (b < 1048576 ? `${Math.round(b / 1024)} KB` : `${(b / 1048576).toFixed(1)} MB`)

/** What the pointer is doing to the picture right now — the same vocabulary as
 *  the video editor, because they are the same gestures on the same stage. */
type Drag =
  | { kind: 'crop-seg'; id: string; px: number; py: number; rect: { x0: number; y0: number; x1: number; y1: number } }
  | { kind: 'draw'; fx: number; fy: number }
  | { kind: 'draw-text'; fx: number; fy: number }
  | { kind: 'move'; id: string; ox: number; oy: number }
  | { kind: 'resize'; id: string }
  | { kind: 'caption'; id: string; ox: number; oy: number }
  | { kind: 'caption-resize'; id: string }

/**
 * The image editor — the video editor's screen, for the one-frame case.
 *
 * IT IS A SEPARATE APP AND SHARES THE HALF THAT IS GEOMETRY. `lib/frameCompose`
 * holds the crop arithmetic, the snapping, the censor drawing and the caption
 * placement; `lib/captionBitmap` holds the text engine. Everything this file
 * adds is the part a still picture genuinely does not share with a clip: there
 * is no timeline, so a censor does not move and has no keyframes; there is no
 * decoder, so the source is an `ImageBitmap` and the export is one `toBlob`;
 * and there is no encoder to be unavailable, so it works in every browser the
 * site runs in at all.
 *
 * The one rule it keeps unchanged is the one the whole family rests on: THE
 * PREVIEW IS THE EXPORT. `compose` below is called with the stage canvas and
 * with the export canvas, and the only difference between the two calls is the
 * size of the destination.
 */
export default function ImageEditTool() {
  const { locale } = useLocale()
  const s = STR[locale]

  const [img, setImg] = useState<ImageBitmap | null>(null)
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState<'' | 'read' | 'export'>('')
  const [mode, setMode] = useState<Mode>('crop')
  const [settings, setSettings] = useState(false)
  const [confirmBack, setConfirmBack] = useState(false)

  const [aspectId, setAspectId] = useState('source')
  const [freeAspect, setFreeAspect] = useState(0)
  const snappedRef = useRef(false)
  const [zoom, setZoom] = useState(1)
  const [centre, setCentre] = useState({ x: 0.5, y: 0.5 })

  const [censors, setCensors] = useState<Censor[]>([])
  const [captions, setCaptions] = useState<Caption[]>([])
  const [pickedBox, setPickedBox] = useState<string | null>(null)
  const [pickedCaption, setPickedCaption] = useState<string | null>(null)
  const [boxPanel, setBoxPanel] = useState(false)

  const [format, setFormat] = useState<string>('image/png')
  const [quality, setQuality] = useState(0.9)
  const [maxSide, setMaxSide] = useState(0)
  /** The joke, and it is ON. See `TILT` above for why it is a real control. */
  const [tilt, setTilt] = useState(true)

  const [out, setOut] = useState<{ url: string; size: number } | null>(null)

  const stageRef = useRef<HTMLCanvasElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<Drag | null>(null)
  const drawingRef = useRef<{ id: string; mode: CensorMode; x: number; y: number; w: number; h: number } | null>(null)
  const drawingTextRef = useRef<{ x: number; y: number; w: number; h: number } | null>(null)
  const bitmaps = useRef<Map<string, { bitmap: ImageBitmap; rect: Rect }>>(new Map())
  const [tick, setTick] = useState(0)
  const repaint = useCallback(() => setTick((n) => n + 1), [])

  const editing = !!img

  useEffect(() => () => { setWorkInProgress(WIP, false) }, [])
  useEffect(() => { setWorkInProgress(WIP, !!img) }, [img])

  // The editor covers the whole viewport, so the page behind it must not
  // scroll — the classic modal-overlay bug, and the same fix `video-edit` uses.
  useEffect(() => {
    if (!editing) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [editing])

  const dim = useMemo(() => ({ width: img?.width ?? 1, height: img?.height ?? 1 }), [img])

  /**
   * THE PICTURE EVERY VIEW DRAWS FROM — the decoded bitmap, or a tilted copy of
   * it at the same size.
   *
   * Same size is what makes it a drop-in: `dim`, the crop arithmetic and every
   * coordinate downstream are untouched, and nothing but this line knows the
   * tilt exists. The alternative was a transform in each of the two draw paths,
   * which is exactly how they came to disagree in the first place — and the
   * export path could not express it anyway, because `drawFrame` samples a
   * sub-rectangle of its source and a rotated picture is not one until it has
   * been drawn.
   *
   * It costs one canvas the size of the image, which for a phone photo is real
   * and is the price of `drawFrame` staying the single implementation of the
   * crop. Rebuilt only when the picture or the switch changes, never per frame.
   */
  const source = useMemo<CanvasImageSource | null>(() => {
    if (!img) return null
    if (!tilt) return img
    const c = document.createElement('canvas')
    c.width = dim.width
    c.height = dim.height
    const ctx = c.getContext('2d')
    if (!ctx) return img
    const k = coverScale(dim.width, dim.height, TILT)
    ctx.translate(dim.width / 2, dim.height / 2)
    ctx.rotate(TILT)
    ctx.scale(k, k)
    ctx.translate(-dim.width / 2, -dim.height / 2)
    ctx.drawImage(img, 0, 0, dim.width, dim.height)
    return c
  }, [img, tilt, dim])
  const sourceAspect = dim.width / dim.height
  const aspect = useMemo(() => {
    if (aspectId === 'free' && freeAspect) return freeAspect
    const found = ASPECTS.find((a) => a.id === aspectId)
    return found && found.aspect ? found.aspect : sourceAspect
  }, [aspectId, freeAspect, sourceAspect])
  const formats = useMemo(
    () => ASPECTS.map((a) => ({ id: a.id, aspect: a.aspect || sourceAspect })),
    [sourceAspect],
  )

  const crop: Crop = useMemo(() => ({ aspect, cx: centre.x, cy: centre.y, zoom }), [aspect, centre, zoom])

  /** The output, in pixels. Capped, never upscaled. */
  const size = useMemo(() => {
    const r = cropRect(dim, crop)
    const k = maxSide > 0 ? Math.min(1, maxSide / Math.max(r.w, r.h)) : 1
    return { width: Math.max(1, Math.round(r.w * k)), height: Math.max(1, Math.round(r.h * k)) }
  }, [dim, crop, maxSide])

  /**
   * What the crop throws away — the number this family exists to put on screen.
   *
   * `keptShare` rather than the same two lines again: it was written for the
   * video editor, which stopped printing the figure on its own bar (the
   * rectangle over the whole picture already SHOWS it there), and a second copy
   * of one formula is how the two screens end up quoting different numbers for
   * the same decision.
   */
  const keptPct = useMemo(() => keptShare(dim, crop), [dim, crop])

  /**
   * The crop rectangle inside the WHOLE picture, in fractions of it.
   *
   * Crop mode shows the picture uncropped with this over it, for the reason
   * `video-edit` records: showing the cropped result while cropping hides the
   * thing being decided, because there is nothing on screen to say what is
   * outside the rectangle.
   */
  const cropBox = useMemo(() => {
    const r = cropRect(dim, crop)
    return { x: r.x / dim.width, y: r.y / dim.height, w: r.w / dim.width, h: r.h / dim.height }
  }, [dim, crop])

  // Caption bitmaps, rebuilt when what they say or how big the frame is
  // changes. They are the thing composited on the stage AND in the export, so
  // there is exactly one per caption.
  useEffect(() => {
    let live = true
    const build = async () => {
      const next = new Map<string, { bitmap: ImageBitmap; rect: Rect }>()
      for (const c of captions) {
        // eslint-disable-next-line no-await-in-loop
        const drawn = await renderCaption(c, size)
        if (drawn) next.set(c.id, drawn)
      }
      if (!live) { next.forEach((b) => b.bitmap.close()); return }
      bitmaps.current.forEach((b) => b.bitmap.close())
      bitmaps.current = next
      repaint()
    }
    // At once with whatever face is loaded, and again when the web fonts
    // settle: awaiting `document.fonts.ready` first makes a caption invisible
    // until every font on the page has resolved.
    void build()
    void document.fonts?.ready.then(() => { if (live) void build() })
    return () => { live = false }
  }, [captions, size.width, size.height, repaint])

  /**
   * A DOWNLOAD THAT IS NOT WHAT IS ON SCREEN IS THE ONE LIE THIS TOOL REFUSES.
   *
   * The export button turns into a green download, which is a claim that the
   * file behind it is the picture in front of you. Touch the crop, a box, a
   * caption or the output settings afterwards and it stops being — so the file
   * goes, and the button goes back to offering to make a new one. Keeping it
   * would hand somebody the previous version of their own picture, which is
   * precisely the failure the preview-is-the-export arrangement exists to make
   * impossible everywhere else.
   */
  useEffect(() => {
    setOut((o) => { if (o) URL.revokeObjectURL(o.url); return null })
  }, [crop, censors, captions, tilt, format, quality, maxSide])

  /**
   * Draw the output. THE ONE FUNCTION, called for the stage and for the export.
   *
   * `skip` is the caption whose editing field is currently over the picture: the
   * textarea sits exactly on its box in the same colour and size, so drawing
   * the bitmap underneath shows the words twice, offset by however far the two
   * disagree about wrapping.
   */
  const compose = useCallback((
    ctx: CanvasRenderingContext2D,
    o: { width: number; height: number },
    skip?: string | null,
  ) => {
    if (!source) return
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, o.width, o.height)
    drawFrame(ctx, source, dim, crop, o)
    // Boxes and captions are placed on the OUTPUT frame, and `source` is
    // already the tilted picture — so somebody aiming a censor is aiming it at
    // exactly what they can see, and the box does not turn with the picture.
    const d = drawingRef.current
    const inProgress: Censor | null = d
      ? { id: d.id, mode: d.mode, keys: [{ t: 0, x: d.x, y: d.y, w: d.w, h: d.h }], from: 0, to: 1 }
      : null
    applyCensors(ctx, inProgress ? [...censors, inProgress] : censors, 0, o)
    for (const c of captions) {
      if (c.id === skip) continue
      const drawn = bitmaps.current.get(c.id)
      if (!drawn) continue
      const r = captionRect(drawn.rect, o)
      ctx.drawImage(drawn.bitmap, r.x, r.y, r.w, r.h)
    }
  }, [source, dim, crop, censors, captions])

  /**
   * Draw the stage — from an ANIMATION FRAME, not from an effect on the state
   * that feeds it.
   *
   * That is the same arrangement `video-edit` uses, and it is load-bearing here
   * for the same reason: the box being dragged out lives in a REF, so a drag
   * needs a repaint without a render, and a canvas that is resized on every
   * commit of a gesture that commits sixty times a second is layout work in the
   * middle of the input handler rather than after it. The state-driven version
   * of this WEDGED the page on the second crop drag — the handler returned and
   * the commit never finished — and the frame loop makes the two independent:
   * React renders when it likes, and the picture is redrawn when the browser is
   * ready to show one.
   */
  const draw = useCallback(() => {
    const rc = stageRef.current
    if (!rc || !source) return
    if (mode === 'crop') {
      // The whole picture, at its own shape, with everything outside the crop
      // dimmed rather than gone. The rectangle's outline is the DOM overlay,
      // which is also what you drag.
      const fit = Math.min(1, PREVIEW_MAX / Math.max(dim.width, dim.height))
      const shown = {
        width: Math.max(2, Math.round(dim.width * fit)),
        height: Math.max(2, Math.round(dim.height * fit)),
      }
      rc.width = shown.width
      rc.height = shown.height
      const ctx = rc.getContext('2d')
      if (!ctx) return
      ctx.clearRect(0, 0, shown.width, shown.height)
      // `source`, not `img` — this is the branch that used to miss the tilt,
      // and the rectangle below is dragged over whatever is drawn here.
      ctx.drawImage(source, 0, 0, shown.width, shown.height)
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
    const shown = {
      width: Math.max(2, Math.round(size.width * k)),
      height: Math.max(2, Math.round(size.height * k)),
    }
    rc.width = shown.width
    rc.height = shown.height
    const ctx = rc.getContext('2d')
    if (!ctx) return
    compose(ctx, shown, mode === 'text' ? pickedCaption : null)
  }, [source, mode, dim, cropBox, size, compose, pickedCaption])

  useEffect(() => {
    let raf = 0
    const loop = () => { draw(); raf = requestAnimationFrame(loop) }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [draw, tick])

  async function pick(list: FileList | null) {
    const f = list?.[0]
    if (!f) return
    setError('')
    setBusy('read')
    setOut(null)
    // No `accept` on the input and no MIME gate here (#225): Android hands over
    // HEIC with an EMPTY type, so a guard on `f.type` silently discards real
    // photos. `decodeImage` decides, and says nothing if it cannot (#226).
    const bitmap = await decodeImage(f)
    setBusy('')
    if (!bitmap) {
      // A bad pick must say WHY. A bare return turns "wrong file" into a dead
      // UI, which is the failure this site refuses for every image intake.
      setError(await whyUnreadable(f, locale))
      return
    }
    setImg((old) => { old?.close(); return bitmap })
    setName(f.name)
    setAspectId('source')
    setFreeAspect(0)
    setZoom(1)
    setCentre({ x: 0.5, y: 0.5 })
    setCensors([])
    setCaptions([])
    setMode('crop')
  }

  function discard() {
    setImg((old) => { old?.close(); return null })
    setCensors([])
    setCaptions([])
    setPickedBox(null)
    setPickedCaption(null)
    setSettings(false)
    setConfirmBack(false)
    setMode('crop')
    setOut((o) => { if (o) URL.revokeObjectURL(o.url); return null })
  }

  async function doExport() {
    if (!img) return
    setBusy('export')
    setError('')
    const canvas = document.createElement('canvas')
    canvas.width = size.width
    canvas.height = size.height
    const ctx = canvas.getContext('2d')
    if (!ctx) { setBusy(''); setError(s.errors.encode); return }
    // THE SAME FUNCTION the stage just ran, at a different size. There is no
    // second renderer to disagree with what is on screen.
    compose(ctx, size)
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, format, format === 'image/png' ? undefined : quality)
    })
    setBusy('')
    if (!blob) { setError(s.errors.encode); return }
    setOut((o) => {
      if (o) URL.revokeObjectURL(o.url)
      return { url: URL.createObjectURL(blob), size: blob.size }
    })
  }

  // ------------------------------------------------------------- pointers ---
  // Unclamped, for the reason `video-edit` reads it unclamped: the stage is
  // letterboxed and a thumb crosses the black long before the screen ends, so
  // clamping here would stop a delta drag at the picture's border.
  function atRaw(e: React.PointerEvent) {
    const r = overlayRef.current?.getBoundingClientRect()
    if (!r) return { x: 0.5, y: 0.5 }
    return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height }
  }
  function at(e: React.PointerEvent) {
    const p = atRaw(e)
    return { x: clamp01(p.x), y: clamp01(p.y) }
  }

  function down(e: React.PointerEvent<HTMLDivElement>) {
    if (e.button !== 0) return
    const p = at(e)
    e.currentTarget.setPointerCapture(e.pointerId)
    if (mode === 'censor') {
      dragRef.current = { kind: 'draw', fx: p.x, fy: p.y }
      // Pixelate by default, solid one tap away behind the box's cog — the
      // measured decision `frameCompose` records, and the reason for it (a
      // black rectangle reads as "pixelation is not implemented here") is
      // about what a mode COMMUNICATES rather than what it removes.
      drawingRef.current = { id: `z${Date.now()}`, mode: 'pixelate', x: p.x, y: p.y, w: 0, h: 0 }
      setPickedBox(null)
      return
    }
    if (mode === 'text') {
      dragRef.current = { kind: 'draw-text', fx: p.x, fy: p.y }
      drawingTextRef.current = { x: p.x, y: p.y, w: 0, h: 0 }
      setPickedCaption(null)
      return
    }
    const raw = atRaw(e)
    dragRef.current = {
      kind: 'crop-seg',
      id: 'move',
      px: raw.x,
      py: raw.y,
      rect: { x0: cropBox.x, y0: cropBox.y, x1: cropBox.x + cropBox.w, y1: cropBox.y + cropBox.h },
    }
  }

  function moveDrag(e: React.PointerEvent<HTMLDivElement>) {
    const d = dragRef.current
    if (!d || !img) return
    const p = at(e)
    const pr = atRaw(e)
    if (d.kind === 'crop-seg') {
      // Every segment moves by the DELTA from where the finger went down, never
      // to where it is: a segment is a THIRD of the rectangle, so a delta keeps
      // whatever offset it was grabbed at and the edge arrives while the finger
      // is still inside the picture.
      const r = { ...d.rect }
      const dx = pr.x - d.px
      const dy = pr.y - d.py
      if (d.id === 'move') {
        const w = r.x1 - r.x0
        const h = r.y1 - r.y0
        const cx = Math.min(Math.max((r.x0 + r.x1) / 2 + dx, w / 2), 1 - w / 2)
        const cy = Math.min(Math.max((r.y0 + r.y1) / 2 + dy, h / 2), 1 - h / 2)
        r.x0 = cx - w / 2; r.x1 = cx + w / 2
        r.y0 = cy - h / 2; r.y1 = cy + h / 2
        setCentre({ x: clamp01((r.x0 + r.x1) / 2), y: clamp01((r.y0 + r.y1) / 2) })
        return
      }
      // Clamped on the RESULT rather than on the pointer: the rectangle may not
      // leave the picture, and the finger may.
      if (d.id.includes('n')) r.y0 = clamp01(d.rect.y0 + dy)
      if (d.id.includes('s')) r.y1 = clamp01(d.rect.y1 + dy)
      if (d.id.includes('w')) r.x0 = clamp01(d.rect.x0 + dx)
      if (d.id.includes('e')) r.x1 = clamp01(d.rect.x1 + dx)
      const next = cropFromDrag(r, d.id, formats, dim)
      snappedRef.current = !!next.format
      if (next.format) setAspectId(next.format.id)
      else { setFreeAspect(next.aspect); setAspectId('free') }
      setZoom(next.zoom)
      setCentre({ x: next.cx, y: next.cy })
      return
    }
    if (d.kind === 'draw') {
      const box = drawingRef.current
      if (!box) return
      box.x = Math.min(d.fx, p.x)
      box.y = Math.min(d.fy, p.y)
      box.w = Math.abs(p.x - d.fx)
      box.h = Math.abs(p.y - d.fy)
      repaint()
      return
    }
    if (d.kind === 'draw-text') {
      const box = drawingTextRef.current
      if (!box) return
      box.x = Math.min(d.fx, p.x)
      box.y = Math.min(d.fy, p.y)
      box.w = Math.abs(p.x - d.fx)
      box.h = Math.abs(p.y - d.fy)
      repaint()
      return
    }
    if (d.kind === 'move') {
      setCensors((list) => list.map((c) => {
        if (c.id !== d.id) return c
        const b = c.keys[0]
        return {
          ...c,
          keys: [{
            t: 0,
            x: clamp01(Math.min(1 - b.w, p.x - d.ox)),
            y: clamp01(Math.min(1 - b.h, p.y - d.oy)),
            w: b.w,
            h: b.h,
          }],
        }
      }))
      return
    }
    if (d.kind === 'resize') {
      setCensors((list) => list.map((c) => {
        if (c.id !== d.id) return c
        const b = c.keys[0]
        return {
          ...c,
          keys: [{
            t: 0,
            x: b.x,
            y: b.y,
            w: Math.max(0.02, Math.min(1 - b.x, p.x - b.x)),
            h: Math.max(0.02, Math.min(1 - b.y, p.y - b.y)),
          }],
        }
      }))
      return
    }
    if (d.kind === 'caption') {
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
          // The box IS the size control: a rectangle dragged twice as tall
          // whose text stayed put would be a resize doing half of what it looks
          // like it is doing.
          size: Math.max(0.03, Math.min(0.3, h * 0.45)),
        }
      }))
    }
  }

  function up(e: React.PointerEvent<HTMLDivElement>) {
    const d = dragRef.current
    dragRef.current = null
    if (overlayRef.current?.hasPointerCapture(e.pointerId)) overlayRef.current.releasePointerCapture(e.pointerId)

    // A drag that ENDED on a format leaves no free shape behind: any drag
    // between two formats crosses the ground between them, so the Free chip
    // would otherwise stay on the bar offering a proportion nobody chose.
    if (d?.kind === 'crop-seg' && snappedRef.current) setFreeAspect(0)

    if (d?.kind === 'draw') {
      const box = drawingRef.current
      drawingRef.current = null
      // A stray click is not a box. Anything under about a fiftieth of the
      // frame is a misclick, and committing it leaves invisible specks that
      // still count as censors.
      if (box && box.w > 0.02 && box.h > 0.02) {
        setCensors((list) => [...list, {
          id: box.id,
          mode: box.mode,
          keys: [{ t: 0, x: box.x, y: box.y, w: box.w, h: box.h }],
          from: 0,
          to: 1,
        }])
        setPickedBox(box.id)
      }
      repaint()
      return
    }
    if (d?.kind === 'draw-text') {
      const box = drawingTextRef.current
      drawingTextRef.current = null
      repaint()
      if (!box || box.w < 0.05 || box.h < 0.04) return
      const id = `c${Date.now()}${captions.length}`
      setCaptions((list) => [...list, {
        id,
        text: '',
        x: box.x,
        y: box.y,
        w: box.w,
        h: box.h,
        size: Math.max(0.03, Math.min(0.18, box.h * 0.45)),
        colour: '#ffffff',
        band: false,
        from: 0,
        to: 1,
      }])
      // Selecting it puts the field over it, so the caret is already where the
      // words go — an empty box draws nothing, and a new caption that did not
      // ask for its words is a rectangle with no way in.
      setPickedCaption(id)
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

  const setCensor = (id: string, patch: Partial<Censor>) =>
    setCensors((list) => list.map((c) => (c.id === id ? { ...c, ...patch } : c)))
  const setCaption = (id: string, patch: Partial<Caption>) =>
    setCaptions((list) => list.map((c) => (c.id === id ? { ...c, ...patch } : c)))

  // ---------------------------------------------------------------- intake ---
  if (!img) {
    return (
      <Stack data-testid="image-edit">
        <div className="mx-[calc(50%-50vw)] w-screen max-w-[100vw] bg-green-600 text-sand-100">
          <div className="wrap py-[clamp(1.6rem,4.5vw,2.4rem)] flex flex-col gap-3">
            <h1 className="font-display rtl:font-ar text-[clamp(1.5rem,4.5vw,2.1rem)] font-bold leading-tight" style={{ color: 'var(--sand-100)' }}>
              {s.heroTitle}
            </h1>
            <p className="text-[0.98rem] leading-relaxed opacity-90 max-w-[46rem] rtl:font-ar">{s.heroBody}</p>
            <div className="flex flex-wrap items-center gap-3 mt-1">
              <label className="inline-flex self-start">
                {/* No `accept` (#225): an image accept string sends Chrome on
                    Android to the gallery picker, which lists only
                    MediaStore-indexed media — a photo in Downloads is never
                    offered, whatever the accept string says. */}
                <input type="file" className="sr-only" data-testid="ie-file"
                  onChange={(e) => { void pick(e.target.files) }} />
                <span className="cursor-pointer inline-flex items-center gap-2 rounded-md bg-white text-green-700 px-4 py-2 text-[0.9rem] font-semibold hover:bg-sand-100 rtl:font-ar">
                  {s.pick}
                </span>
              </label>
              {busy === 'read' && (
                <span className="inline-flex items-center gap-2 text-[0.9rem] opacity-90 rtl:font-ar" data-testid="ie-reading">
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
  const picked = censors.find((c) => c.id === pickedBox) ?? null
  const drawingText = tick >= 0 ? drawingTextRef.current : null
  const pct = (n: number) => (locale === 'ar' ? `${arNum(Math.round(n * 100))}٪` : `${Math.round(n * 100)}%`)

  const toolBtn = (m: Mode, label: string, icon: React.ReactNode) => (
    <button type="button" title={label} aria-label={label} aria-pressed={mode === m}
      data-testid={`ie-mode-${m}`} onClick={() => setMode(m)}
      className={`grid place-items-center w-10 h-10 rounded-md border cursor-pointer transition-colors ${
        mode === m
          ? 'bg-green-600 border-green-700 text-[color:var(--primary-ink)]'
          : 'bg-black/55 border-white/25 text-white hover:bg-black/70'}`}>
      {icon}
    </button>
  )

  /** A caption is typed ONTO the picture — the field IS the caption while it is
   *  open, which is what makes "click once to select, again to edit" cost no
   *  rule at all. */
  const captionField = (c: Caption) => (
    <textarea
      data-testid={`ie-caption-text-${captions.indexOf(c)}`}
      value={c.text}
      placeholder={s.text}
      dir="auto"
      spellCheck={false}
      onPointerDown={(e) => e.stopPropagation()}
      onChange={(e) => setCaption(c.id, { text: e.target.value })}
      // IT GROWS, IT DOES NOT SCROLL. A textarea clips its content, so a
      // caption one line taller than its box is cut off while being typed and
      // whole in the file — the field disagreeing with the picture it is
      // producing.
      ref={(el) => {
        if (!el) return
        el.style.paddingTop = '0px'
        el.style.height = 'auto'
        const content = el.scrollHeight
        const box = el.parentElement?.clientHeight ?? 0
        el.style.paddingTop = `${Math.max(0, (box - content) / 2)}px`
        el.style.height = `${Math.max(box, content)}px`
      }}
      style={{
        boxSizing: 'border-box',
        color: c.colour,
        fontSize: `${Math.max(8, c.size * (stageRef.current?.clientHeight || 0))}px`,
        lineHeight: 1.3,
      }}
      className="absolute start-0 top-1/2 -translate-y-1/2 w-full resize-none bg-transparent border-0 outline-none
        text-center p-0 overflow-hidden font-sans font-semibold
        placeholder:text-white/60 [text-shadow:0_0_3px_rgba(0,0,0,0.8)]" />
  )

  /** A box handle on the stage — the same affordance for a censor and a caption. */
  const handle = (
    key: string, testid: string, box: { x: number; y: number; w: number; h: number },
    selected: boolean,
    onGrab: (e: React.PointerEvent) => void,
    onDelete: () => void, onResize: (e: React.PointerEvent) => void,
    onInfo?: () => void, corner?: React.ReactNode, inside?: React.ReactNode,
  ) => (
    <div key={key} data-testid={testid} onPointerDown={onGrab}
      style={{ left: `${box.x * 100}%`, top: `${box.y * 100}%`, width: `${box.w * 100}%`, height: `${box.h * 100}%` }}
      className={`absolute cursor-move border-2 ${selected ? 'border-green-400' : 'border-white/60 border-dashed'}`}>
      {inside}
      {selected && (
        <>
          <button type="button" title={s.deleteBox} aria-label={s.deleteBox} data-testid={`${testid}-delete`}
            onPointerDown={(e) => e.stopPropagation()} onClick={onDelete}
            className="absolute -top-3 -end-3 grid place-items-center w-7 h-7 rounded-full bg-black/80 border border-white/40 text-white cursor-pointer">
            <TrashIcon className="w-3.5 h-3.5" />
          </button>
          {onInfo && (
            <button type="button" title={s.boxSettings} aria-label={s.boxSettings} data-testid={`${testid}-settings`}
              onPointerDown={(e) => e.stopPropagation()} onClick={onInfo}
              className="absolute -top-3 -end-12 grid place-items-center w-7 h-7 rounded-full bg-black/80 border border-white/40 text-white cursor-pointer">
              <CogIcon className="w-3.5 h-3.5" />
            </button>
          )}
          <span data-testid={`${testid}-resize`} onPointerDown={onResize}
            className="absolute -bottom-2 -end-2 w-4 h-4 rounded-sm bg-green-400 border border-green-700 cursor-nwse-resize" />
          {corner}
        </>
      )}
    </div>
  )

  // PORTALLED TO `document.body`, which is load-bearing rather than tidy:
  // `ToolPage`'s wrapper carries an animation whose fill leaves a `transform`
  // on the element for good, and a transformed ancestor becomes the containing
  // block for `position: fixed` — so `inset-0` would resolve against the padded
  // content column instead of the viewport. `video-edit` records the same trap.
  return (
    <Stack data-testid="image-edit">
      {error && <FileError message={error} />}

      {createPortal(<>
      <div className="fixed inset-0 z-40 bg-black flex flex-col" data-testid="ie-fullscreen">
        <div className="relative flex-1 min-h-0 flex items-center justify-center">
          {/* CONTAINED, never stretched: a canvas carries its own intrinsic
              size, so two max constraints and nothing else IS "contain" — and
              the wrapper shrink-wraps it, which is what keeps the overlay
              exactly over the picture every pointer coordinate depends on. */}
          <div className="relative inline-block max-w-full max-h-full leading-none">
            <canvas ref={stageRef} data-testid="ie-result" className="block max-w-full max-h-full" />

            <div ref={overlayRef} tabIndex={0} data-testid="ie-stage"
              onPointerDown={down} onPointerMove={moveDrag} onPointerUp={up} onPointerCancel={up}
              onKeyDown={nudge}
              className={`absolute inset-0 touch-none outline-none ${mode === 'crop' ? '' : 'cursor-crosshair'}`}>

              {mode === 'crop' && (
                // `dir="ltr"`, because A PICTURE DOES NOT MIRROR. The ids are
                // physical — `nw` drags the north-west corner — and a CSS grid
                // flows its columns right to left under RTL, so without this
                // every cell drags the opposite edge from the one under the
                // finger on the Arabic side.
                //
                // AND CAPTURE ON THE ELEMENT THE POINTERDOWN REACHED, never on
                // the overlay from a child's handler. That is not a style
                // preference: capturing on a DIFFERENT element wedged the page
                // on the SECOND crop drag of a session — the first gesture
                // worked, the second one's first `pointermove` never came back
                // and the editor froze mid-drag. Moves and ups reach `moveDrag`
                // and `up` either way, because they bubble from the child up to
                // this overlay; what changes is that the browser's own implicit
                // release at pointerup now applies to the element that took the
                // capture.
                <div data-testid="ie-crop-box" dir="ltr"
                  style={{ left: `${cropBox.x * 100}%`, top: `${cropBox.y * 100}%`, width: `${cropBox.w * 100}%`, height: `${cropBox.h * 100}%` }}
                  className="absolute border-2 border-green-400 grid grid-cols-3 grid-rows-3">
                  {SEGMENTS.map((seg, i) => (
                    <div key={seg.id} data-testid={`ie-crop-${seg.id}`}
                      className={`${seg.cursor} ${i % 3 !== 2 ? 'border-e' : ''} ${i < 6 ? 'border-b' : ''} border-white/25`}
                      onPointerDown={(e) => {
                        e.stopPropagation()
                        e.currentTarget.setPointerCapture(e.pointerId)
                        const q = atRaw(e)
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

              {mode === 'censor' && censors.map((c, i) => handle(
                c.id, `ie-box-${i}`, c.keys[0], pickedBox === c.id,
                (e) => {
                  e.stopPropagation()
                  const p = at(e)
                  e.currentTarget.setPointerCapture(e.pointerId)
                  dragRef.current = { kind: 'move', id: c.id, ox: p.x - c.keys[0].x, oy: p.y - c.keys[0].y }
                  setPickedBox(c.id)
                },
                () => { setCensors((l) => l.filter((x) => x.id !== c.id)); setPickedBox(null) },
                (e) => {
                  e.stopPropagation()
                  e.currentTarget.setPointerCapture(e.pointerId)
                  dragRef.current = { kind: 'resize', id: c.id }
                },
                () => setBoxPanel(true),
              ))}

              {mode === 'text' && captions.map((c, i) => handle(
                c.id, `ie-caption-box-${i}`, c, pickedCaption === c.id,
                (e) => {
                  e.stopPropagation()
                  const p = at(e)
                  e.currentTarget.setPointerCapture(e.pointerId)
                  dragRef.current = { kind: 'caption', id: c.id, ox: p.x - c.x, oy: p.y - c.y }
                  setPickedCaption(c.id)
                },
                () => { setCaptions((l) => l.filter((x) => x.id !== c.id)); setPickedCaption(null) },
                (e) => {
                  e.stopPropagation()
                  e.currentTarget.setPointerCapture(e.pointerId)
                  dragRef.current = { kind: 'caption-resize', id: c.id }
                },
                undefined,
                <label key="colour" data-testid={`ie-caption-colour-${i}`}
                  title={s.colour} aria-label={s.colour}
                  onPointerDown={(e) => e.stopPropagation()}
                  className="absolute -bottom-3 -start-3 grid place-items-center w-7 h-7 rounded-full border border-white/40 cursor-pointer overflow-hidden"
                  style={{ background: c.colour }}>
                  <input type="color" value={c.colour} className="opacity-0 w-full h-full cursor-pointer"
                    onChange={(e) => setCaption(c.id, { colour: e.target.value })} />
                </label>,
                pickedCaption === c.id ? captionField(c) : null,
              ))}

              {mode === 'text' && drawingText && drawingText.w > 0 && (
                <div aria-hidden="true"
                  style={{ left: `${drawingText.x * 100}%`, top: `${drawingText.y * 100}%`, width: `${drawingText.w * 100}%`, height: `${drawingText.h * 100}%` }}
                  className="absolute border-2 border-green-400 border-dashed pointer-events-none" />
              )}
            </div>

            {/* Back, over the top-left. There is no site chrome to leave by, so
                this is the only way out — and it CONFIRMS, because everything
                here is unsaved by construction. */}
            <button type="button" data-testid="ie-back" onClick={() => setConfirmBack(true)}
              title={s.back} aria-label={s.back}
              className="absolute top-2 start-2 grid place-items-center w-10 h-10 rounded-md border bg-black/55 border-white/25 text-white cursor-pointer hover:bg-black/70">
              <BackIcon className="w-5 h-5 rtl:-scale-x-100" />
            </button>

            <div className="absolute top-2 end-2 flex gap-1.5" data-testid="ie-tools">
              {toolBtn('crop', s.modeCrop, <CropIcon className="w-5 h-5" />)}
              {toolBtn('censor', s.modeCensor, <MosaicIcon className="w-5 h-5" />)}
              {toolBtn('text', s.modeText, <TextIcon className="w-5 h-5" />)}
              {/* THE JOKE, AS A REAL CONTROL, and on the frame rather than three
                  taps down in the settings. It changes what every pixel of the
                  picture behind it looks like, so it belongs with the other
                  things that do, and it needs no sentence explaining it: the
                  picture is visibly off true, which is the entire feature.
                  `aria-pressed` is the testable contract, since asserting a
                  background class would be testing Tailwind. */}
              <button type="button" title={s.tilt} aria-label={s.tilt} aria-pressed={tilt}
                data-testid="ie-tilt" onClick={() => setTilt((v) => !v)}
                className={`grid place-items-center w-10 h-10 rounded-md border cursor-pointer transition-colors ${
                  tilt
                    ? 'bg-green-600 border-green-700 text-[color:var(--primary-ink)]'
                    : 'bg-black/55 border-white/25 text-white hover:bg-black/70'}`}>
                <TiltIcon className="w-5 h-5" />
              </button>
              <button type="button" title={s.modeMore} aria-label={s.modeMore} data-testid="ie-settings"
                onClick={() => setSettings(true)}
                className="grid place-items-center w-10 h-10 rounded-md border bg-black/55 border-white/25 text-white cursor-pointer hover:bg-black/70">
                <CogIcon className="w-5 h-5" />
              </button>
              {/* GREEN ONLY ONCE THERE IS A FILE. Primary colour is a claim
                  that this is the thing to do next, and before an export there
                  is nothing to download. */}
              {out ? (
                <a href={out.url} data-testid="ie-download"
                  download={`edited-${name.replace(/\.[^.]+$/, '')}.${FORMATS.find((f) => f.id === format)?.ext ?? 'png'}`}
                  title={`${s.download} · ${mb(out.size)}`} aria-label={s.download}
                  className="grid place-items-center w-10 h-10 rounded-md border bg-green-600 border-green-700 text-[color:var(--primary-ink)] cursor-pointer no-underline">
                  <DownloadIcon className="w-5 h-5" />
                </a>
              ) : (
                <button type="button" title={s.exportBtn} aria-label={s.exportBtn} data-testid="ie-export"
                  onClick={() => { void doExport() }} disabled={busy !== ''}
                  className="grid place-items-center w-10 h-10 rounded-md border bg-black/55 border-white/25 text-white cursor-pointer hover:bg-black/70 disabled:opacity-60">
                  {busy === 'export' ? <Spinner /> : <DownloadIcon className="w-5 h-5" />}
                </button>
              )}
            </div>

            {/* The crop shapes dock UNDER the tools, not along the bottom: a
                floating bar there covers the lower third of a crop rectangle
                that starts out filling the frame, so its corner segment would
                not be draggable at all. */}
            {mode === 'crop' && (
              <div className="absolute top-14 inset-x-2 flex justify-center pointer-events-none">
                <div className="pointer-events-auto max-w-full overflow-x-auto rounded-md bg-black/70 backdrop-blur-sm border border-white/15 text-white px-2 py-1.5">
                  <div className="flex items-center gap-2 whitespace-nowrap" data-testid="ie-crop-bar">
                    {ASPECTS.map((a) => (
                      <button key={a.id} type="button" data-testid={`ie-aspect-${a.id}`}
                        aria-pressed={aspectId === a.id}
                        onClick={() => setAspectId(a.id)}
                        className={`rounded px-2 py-1 text-[0.8rem] border cursor-pointer rtl:font-ar ${
                          aspectId === a.id ? 'bg-green-600 border-green-700' : 'bg-transparent border-white/25 hover:bg-white/10'}`}>
                        {locale === 'ar' ? a.labelAr : a.label}
                      </button>
                    ))}
                    {/* Free is shown only once a drag has made one. It is a
                        RESULT, not a mode to switch into. */}
                    {freeAspect > 0 && (
                      <button type="button" data-testid="ie-aspect-free"
                        aria-pressed={aspectId === 'free'} onClick={() => setAspectId('free')}
                        className={`rounded px-2 py-1 text-[0.8rem] border cursor-pointer rtl:font-ar ${
                          aspectId === 'free' ? 'bg-green-600 border-green-700' : 'bg-transparent border-white/25 hover:bg-white/10'}`}>
                        {s.free}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="absolute bottom-2 inset-x-2 flex justify-center pointer-events-none">
              <div className="pointer-events-auto max-w-full overflow-x-auto rounded-md bg-black/70 backdrop-blur-sm border border-white/15 text-white px-2 py-1.5">
                {mode === 'censor' && !picked && (
                  <span className="block text-[0.8rem] opacity-85 rtl:font-ar" data-testid="ie-censor-hint">{s.addBox}</span>
                )}
                {mode === 'text' && captions.length === 0 && (
                  <span className="block text-[0.8rem] opacity-85 rtl:font-ar" data-testid="ie-caption-hint">{s.addCaptionBox}</span>
                )}
                {/* What the crop costs, where the crop is being decided — the
                    rectangle over the whole picture already SHOWS it, and this
                    is the one number that shape cannot say by itself. */}
                {mode === 'crop' && (
                  <span className="block text-[0.8rem] opacity-85 font-mono" data-testid="ie-kept">
                    {s.kept(pct(keptPct))} · {size.width}×{size.height}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* One sheet for everything a box is. Small on purpose — a settings
            screen over a picture is a settings screen you cannot see it
            through. */}
        {boxPanel && picked && (
          <div className="absolute inset-0 z-10 grid place-items-center bg-black/70 p-4" data-testid="ie-box-panel">
            <div className="w-[min(92vw,30rem)] rounded-lg border border-[color:var(--line)] bg-[var(--surface)] p-5 flex flex-col gap-4">
              <p className="font-display rtl:font-ar text-[1.05rem] font-semibold text-ink">{s.boxSettings}</p>
              <Field label={s.hideWith}>
                <Seg>
                  {(['pixelate', 'solid', 'blur'] as const).map((m) => (
                    <SegButton key={m} active={picked.mode === m} data-testid={`ie-box-mode-${m}`}
                      onClick={() => setCensor(picked.id, { mode: m })}>{s.modes[m]}</SegButton>
                  ))}
                </Seg>
              </Field>
              {/* The cost is stated where the choice is made and CHANGES with
                  it. And it is a DIFFERENT claim from the video editor's, which
                  is the point: `evals/pixelleak.mjs` measured what many
                  differently-aligned frames give back, and one frame gave back
                  nothing. Repeating the video figure here would be claiming
                  more than was measured. */}
              <p className={`text-[0.85rem] rtl:font-ar ${picked.mode === 'solid' ? 'text-ink-soft' : 'text-gold-700'}`}
                data-testid="ie-box-why">
                {picked.mode === 'solid' ? s.solidWhy : s.pixelWhy}
              </p>
              <div className="flex justify-end">
                <Button variant="primary" data-testid="ie-box-panel-close" onClick={() => setBoxPanel(false)}>{s.close}</Button>
              </div>
            </div>
          </div>
        )}

        {confirmBack && (
          <div className="absolute inset-0 z-10 grid place-items-center bg-black/70 p-4" data-testid="ie-confirm-back">
            <div className="w-[min(92vw,26rem)] rounded-lg border border-[color:var(--line)] bg-[var(--surface)] p-5 flex flex-col gap-3">
              <p className="font-display rtl:font-ar text-[1.05rem] font-semibold text-ink">{s.discardTitle}</p>
              <p className="text-[0.9rem] text-ink-soft rtl:font-ar">{s.discardBody}</p>
              <div className="flex flex-wrap gap-2 justify-end">
                <Button data-testid="ie-back-cancel" onClick={() => setConfirmBack(false)}>{s.keepEditing}</Button>
                <Button variant="primary" data-testid="ie-back-discard" onClick={discard}>{s.discard}</Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Settings are FULL SCREEN, not a pill along the bottom: on a phone that
          row is wider than the viewport, so the controls at its end would be
          partly unreachable on the device this tool is most used from. */}
      {settings && (
        <div className="fixed inset-0 z-50 bg-[var(--bg)] overflow-y-auto" data-testid="ie-settings-panel">
          <div className="wrap py-6 flex flex-col gap-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-display rtl:font-ar text-[1.3rem] font-semibold text-ink">{s.modeMore}</h2>
              {/* An X, not a "Done": nothing here is submitted — every control
                  takes effect as it is touched. */}
              <button type="button" data-testid="ie-settings-close" onClick={() => setSettings(false)}
                title={s.close} aria-label={s.close}
                className="grid place-items-center w-9 h-9 rounded-md border border-[color:var(--line)] bg-[var(--surface)] text-ink cursor-pointer hover:bg-[color:var(--bg)]">
                <CloseIcon className="w-4 h-4" />
              </button>
            </div>

            <Field label={s.format}>
              <Select value={format} data-testid="ie-format" onChange={(e) => setFormat(e.target.value)}>
                {FORMATS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
              </Select>
            </Field>

            {format === 'image/png' ? (
              <p className="text-[0.8rem] text-ink-faint rtl:font-ar" data-testid="ie-lossless">{s.lossless}</p>
            ) : (
              <Field label={s.quality}>
                <Input type="range" min={0.3} max={1} step={0.05} value={quality} data-testid="ie-quality"
                  onChange={(e) => setQuality(Number(e.target.value))} />
              </Field>
            )}

            <div className="flex flex-col gap-1">
              <Field label={s.outSize}>
                <Select value={maxSide} data-testid="ie-side" onChange={(e) => setMaxSide(Number(e.target.value))}>
                  {SIDES.map((h) => <option key={h} value={h}>{h === 0 ? s.original : `${h}px`}</option>)}
                </Select>
              </Field>
              <p className="text-[0.8rem] text-ink-faint">
                <span className="font-mono" data-testid="ie-out-size">{size.width}×{size.height}</span>
              </p>
            </div>

          </div>
        </div>
      )}
      </>, document.body)}
    </Stack>
  )
}
