import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocale } from '../../i18n'
import { UploadIcon, ArchiveIcon, DownloadIcon } from '../../components/icons'
import { Button, Input, Select, Stack, Spinner, FileError, Panel, Check } from '../../components/ui'
import { setWorkInProgress } from '../../lib/workInProgress'
import { decodeImage } from '../../lib/decodeImage'
import { whyUnreadable } from '../../lib/imageInput'
import { zipStore } from '../../lib/zip'

// A carousel is N square (or 4:5) slides that read as one continuous picture
// when you swipe. Cutting a wide image into equal parts is the easy half; the
// half people get wrong is that each slide must be the platform's aspect ratio,
// so the cut width follows from the slide height, not from "width ÷ N".

const RATIOS = [
  { id: '1:1', w: 1, h: 1, en: 'Square 1:1', ar: 'مربع ١:١' },
  { id: '4:5', w: 4, h: 5, en: 'Portrait 4:5', ar: 'طولي ٤:٥' },
  { id: '9:16', w: 9, h: 16, en: 'Story 9:16', ar: 'ستوري ٩:١٦' },
]

const STR = {
  en: {
    pick: 'Choose a wide image', another: 'Choose another',
    hint: 'Cut one wide image into slides that line up when someone swipes through them. Each slide comes out at the platform’s aspect ratio, which is what makes the seams meet.',
    slides: 'Slides', ratio: 'Slide shape', height: 'Slide height', overlap: 'Overlap the edges slightly',
    overlapHint: 'A pixel or two of overlap hides the hairline seam some viewers render between slides.',
    needed: 'For these settings the source should be about',
    have: 'yours is',
    tooNarrow: 'Your image is narrower than the slides need, so it will be upscaled and look soft. A wider original gives a sharper carousel.',
    download: 'Download all as .zip', one: 'Download',
    preview: 'Preview', working: 'Preparing…',
    order: 'Slides are numbered so they upload in the right order — most apps sort by filename.',
  },
  ar: {
    pick: 'اختر صورة عريضة', another: 'اختر صورة أخرى',
    hint: 'قسّم صورة عريضة واحدة إلى شرائح تتصل ببعضها عند التمرير. تخرج كل شريحة بنسبة أبعاد المنصة، وهو ما يجعل الحواف تلتقي.',
    slides: 'عدد الشرائح', ratio: 'شكل الشريحة', height: 'ارتفاع الشريحة', overlap: 'تداخل بسيط عند الحواف',
    overlapHint: 'بكسل أو اثنان من التداخل يخفيان الخط الشعري الذي تُظهره بعض العارضات بين الشرائح.',
    needed: 'بهذه الإعدادات ينبغي أن يكون عرض الأصل نحو',
    have: 'وعرض صورتك',
    tooNarrow: 'صورتك أضيق مما تتطلبه الشرائح، لذا ستُكبَّر وتبدو غير حادة. الأصل الأعرض يعطي شرائح أوضح.',
    download: 'نزّل الكل كملف ‎.zip', one: 'تنزيل',
    preview: 'معاينة', working: 'جارٍ التجهيز…',
    order: 'تُرقَّم الشرائح لترفعها بالترتيب الصحيح — إذ ترتّب معظم التطبيقات بحسب اسم الملف.',
  },
}

export default function CarouselSplitTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const [img, setImg] = useState<ImageBitmap | null>(null)
  const [slides, setSlides] = useState(3)
  const [ratioId, setRatioId] = useState('1:1')
  const [height, setHeight] = useState(1350)
  const [overlap, setOverlap] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const hostRef = useRef<HTMLDivElement>(null)

  const ratio = RATIOS.find((r) => r.id === ratioId) ?? RATIOS[0]
  const slideW = Math.round((height * ratio.w) / ratio.h)
  const neededW = slideW * slides

  useEffect(() => () => setWorkInProgress('carousel-split', false), [])

  async function pick(f: File | undefined) {
    if (!f) return
    setBusy(true); setError('')
    try {
      const bmp = await decodeImage(f)
      if (!bmp) { setError(await whyUnreadable(f, locale)); return }
      setImg(bmp)
      setWorkInProgress('carousel-split', true)
    } catch {
      setError(await whyUnreadable(f, locale))
    } finally { setBusy(false) }
  }

  /** Render slide `i`. The source is scaled so its HEIGHT fills the slide, then
   *  the horizontal window moves across it — which is what keeps the seams aligned. */
  function renderSlide(i: number): HTMLCanvasElement | null {
    if (!img) return null
    const canvas = document.createElement('canvas')
    canvas.width = slideW
    canvas.height = height
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, slideW, height)
    const scale = height / img.height
    const scaledW = img.width * scale
    // Centre the whole picture across the strip of slides.
    const totalW = neededW
    const offsetX = (totalW - scaledW) / 2
    const bleed = overlap && i > 0 ? 1 : 0
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(img, offsetX - i * slideW - bleed, 0, scaledW, height)
    return canvas
  }

  const previews = useMemo(() => {
    void img; void slides; void ratioId; void height; void overlap
    return Array.from({ length: slides }, (_, i) => i)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [img, slides, ratioId, height, overlap])

  // Draw previews imperatively — a canvas per slide, at display size.
  useEffect(() => {
    const host = hostRef.current
    if (!host || !img) return
    host.replaceChildren()
    for (const i of previews) {
      const full = renderSlide(i)
      if (!full) continue
      const thumb = document.createElement('canvas')
      const tw = 180
      thumb.width = tw
      thumb.height = Math.round((tw / slideW) * height)
      thumb.getContext('2d')!.drawImage(full, 0, 0, thumb.width, thumb.height)
      thumb.className = 'rounded-sm border border-[color:var(--line)]'
      thumb.setAttribute('data-testid', `cs-slide-${i + 1}`)
      const wrap = document.createElement('div')
      wrap.className = 'flex flex-col items-center gap-1'
      const label = document.createElement('span')
      label.className = 'font-mono text-[0.72rem] text-ink-faint'
      label.textContent = String(i + 1)
      wrap.append(thumb, label)
      host.appendChild(wrap)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previews, slideW, height])

  async function downloadZip() {
    if (!img) return
    setBusy(true)
    try {
      const files: { name: string; bytes: Uint8Array }[] = []
      for (let i = 0; i < slides; i++) {
        const canvas = renderSlide(i)
        if (!canvas) continue
        const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.92))
        if (!blob) continue
        files.push({
          // Zero-padded so a filename sort is the slide order.
          name: `slide-${String(i + 1).padStart(2, '0')}.jpg`,
          bytes: new Uint8Array(await blob.arrayBuffer()),
        })
      }
      const url = URL.createObjectURL(zipStore(files))
      const a = document.createElement('a')
      a.href = url; a.download = 'carousel.zip'; a.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } finally { setBusy(false) }
  }

  const tooNarrow = !!img && img.width * (height / img.height) < neededW * 0.95

  return (
    <Stack data-testid="carousel-split">
      <div className="flex flex-wrap items-center gap-2">
        {/* No accept filter — Android's picker hides files it has not indexed. */}
        <input ref={fileRef} type="file" className="hidden" data-testid="cs-file" onChange={(e) => pick(e.target.files?.[0])} />
        <Button onClick={() => fileRef.current?.click()} data-testid="cs-pick">
          <UploadIcon /> {img ? s.another : s.pick}
        </Button>
        {busy && <Spinner className="size-5" />}
        {busy && <span className="text-[0.9rem] text-ink-faint rtl:font-ar">{s.working}</span>}
      </div>

      {error && <FileError message={error} />}
      {!img && !busy && !error && <p className="text-ink-faint text-[0.95rem] rtl:font-ar">{s.hint}</p>}

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-[0.8rem] text-ink-faint">
          {s.slides}
          <Input type="number" min={2} max={10} dir="ltr" className="w-20 font-mono" data-testid="cs-slides"
            value={slides} onChange={(e) => setSlides(Math.max(2, Math.min(10, +e.target.value || 2)))} />
        </label>
        <label className="flex flex-col gap-1 text-[0.8rem] text-ink-faint">
          {s.ratio}
          <Select className="w-36" data-testid="cs-ratio" value={ratioId} onChange={(e) => setRatioId(e.target.value)}>
            {RATIOS.map((r) => <option key={r.id} value={r.id}>{locale === 'ar' ? r.ar : r.en}</option>)}
          </Select>
        </label>
        <label className="flex flex-col gap-1 text-[0.8rem] text-ink-faint">
          {s.height}
          <Select className="w-28" data-testid="cs-height" value={height} onChange={(e) => setHeight(+e.target.value)}>
            {[1080, 1350, 1440, 1920].map((h) => <option key={h} value={h}>{h}</option>)}
          </Select>
        </label>
        <Check>
          <input type="checkbox" checked={overlap} data-testid="cs-overlap" onChange={(e) => setOverlap(e.target.checked)} /> {s.overlap}
        </Check>
      </div>

      <p className="text-[0.85rem] text-ink-faint font-mono" data-testid="cs-needed">
        {s.needed} {neededW} × {height} px{img ? ` — ${s.have} ${img.width} × ${img.height}` : ''}
      </p>
      {tooNarrow && <p className="text-[0.88rem] text-gold-500 rtl:font-ar" data-testid="cs-narrow">{s.tooNarrow}</p>}

      {img && (
        <>
          <span className="font-body text-[0.68rem] uppercase tracking-[0.06em] text-ink-faint">{s.preview}</span>
          <div ref={hostRef} className="flex gap-1 overflow-x-auto pb-2" data-testid="cs-previews" />
          <Button variant="primary" className="self-start" onClick={downloadZip} disabled={busy} data-testid="cs-zip">
            <ArchiveIcon /> {s.download}
          </Button>
          <p className="text-[0.85rem] text-ink-faint rtl:font-ar flex items-center gap-2">
            <DownloadIcon className="flex-none" /> {s.order}
          </p>
        </>
      )}

      <Panel><p className="text-[0.85rem] text-ink-soft rtl:font-ar">{s.overlapHint}</p></Panel>
    </Stack>
  )
}
