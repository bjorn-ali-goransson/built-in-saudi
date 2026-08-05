import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocale } from '../../i18n'
import { UploadIcon, DownloadIcon, EraseIcon } from '../../components/icons'
import { Button, Select, Stack, Spinner, FileError, Panel, Check, Input } from '../../components/ui'
import { setWorkInProgress } from '../../lib/workInProgress'
import { decodeImage } from '../../lib/decodeImage'
import { whyUnreadable } from '../../lib/imageInput'
import { SPECS, SHEETS, DPI_CHOICES, pixelSize, tileCount } from './specs'
import { drawPhoto, drawSheet, canvasToBlob, IDENTITY, type Transform } from './render'
import { PhotoStage } from './PhotoStage'

const STR = {
  en: {
    pick: 'Choose a photo', another: 'Choose another', working: 'Reading the photo…',
    hint: 'Take or pick a straight-on photo against a plain wall. Drag to position your face inside the frame and use the guides — the head height is what offices actually check.',
    spec: 'Size', dpi: 'Print quality', bg: 'Background',
    white: 'White', keep: 'Keep the original',
    guides: 'Show the head and eye guides',
    zoom: 'Zoom',
    download: 'Download the photo', sheet: 'Download a print sheet',
    sheetOf: (n: number, name: string) => `${n} copies on ${name}`,
    pixels: 'Pixels', low: 'This photo is smaller than the print needs — it will look soft. Use a larger original if you have one.',
    removeBg: 'Remove the background first',
    disclaimer: 'These are the published dimensions, not legal advice. Requirements change and the office accepting your application has the final say — check theirs before you print.',
    headGuide: 'Fit the top of your head and your chin between the two lines, and your eyes on the dashed line.',
  },
  ar: {
    pick: 'اختر صورة', another: 'اختر صورة أخرى', working: 'جارٍ قراءة الصورة…',
    hint: 'التقط أو اختر صورة أمامية أمام جدار سادة. اسحب لضبط موضع وجهك داخل الإطار واستعن بالخطوط الإرشادية — فارتفاع الرأس هو ما تتحقق منه الجهات فعلًا.',
    spec: 'المقاس', dpi: 'جودة الطباعة', bg: 'الخلفية',
    white: 'بيضاء', keep: 'أبقِ الأصلية',
    guides: 'أظهر خطوط الرأس والعينين',
    zoom: 'التكبير',
    download: 'نزّل الصورة', sheet: 'نزّل ورقة طباعة',
    sheetOf: (n: number, name: string) => `${n.toLocaleString('ar')} نسخة على ${name}`,
    pixels: 'البكسلات', low: 'هذه الصورة أصغر مما تتطلبه الطباعة — ستبدو غير حادة. استخدم أصلًا أكبر إن توفّر.',
    removeBg: 'أزل الخلفية أولًا',
    disclaimer: 'هذه المقاسات المنشورة، وليست استشارة نظامية. تتغيّر المتطلبات والجهة التي تستقبل معاملتك هي صاحبة القرار — راجع متطلباتها قبل الطباعة.',
    headGuide: 'اجعل أعلى رأسك وذقنك بين الخطين، وعينيك على الخط المتقطّع.',
  },
}

export default function PassportPhotoTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const [image, setImage] = useState<ImageBitmap | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [specId, setSpecId] = useState(SPECS[0].id)
  const [dpi, setDpi] = useState<number>(300)
  const [whiteBg, setWhiteBg] = useState(true)
  const [guides, setGuides] = useState(true)
  const [t, setT] = useState<Transform>(IDENTITY)
  const [sheetId, setSheetId] = useState(SHEETS[0].id)
  const fileRef = useRef<HTMLInputElement>(null)

  const spec = useMemo(() => SPECS.find((x) => x.id === specId) ?? SPECS[0], [specId])
  const sheet = useMemo(() => SHEETS.find((x) => x.id === sheetId) ?? SHEETS[0], [sheetId])
  const px = pixelSize(spec, dpi)
  const tiles = tileCount(sheet, spec, 2)
  const perSheet = tiles.cols * tiles.rows
  const tooSmall = !!image && (image.width < px.w || image.height < px.h)

  useEffect(() => () => setWorkInProgress('passport-photo', false), [])

  async function pick(f: File | undefined) {
    if (!f) return
    setBusy(true); setError('')
    try {
      // decodeImage, not createImageBitmap: iPhone photos are HEIC and only this
      // path decodes them. Verifying at pick time keeps the failure next to the cause.
      const bmp = await decodeImage(f)
      if (!bmp) { setError(await whyUnreadable(f, locale)); return }
      setImage(bmp)
      setT(IDENTITY)
      setWorkInProgress('passport-photo', true)
    } catch {
      setError(await whyUnreadable(f, locale))
    } finally {
      setBusy(false)
    }
  }

  function render(): HTMLCanvasElement | null {
    if (!image) return null
    return drawPhoto(image, spec, dpi, t, whiteBg ? '#ffffff' : 'rgba(0,0,0,0)')
  }

  async function save(kind: 'photo' | 'sheet') {
    const photo = render()
    if (!photo) return
    const canvas = kind === 'sheet' ? drawSheet(photo, spec, sheet, dpi, 2) : photo
    const blob = await canvasToBlob(canvas, 'image/jpeg', 0.95)
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = kind === 'sheet' ? `photo-sheet-${sheet.id}.jpg` : `photo-${spec.id}.jpg`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return (
    <Stack data-testid="passport-photo">
      <div className="flex flex-wrap items-center gap-2">
        {/* No accept filter, and no MIME gate — Android hands over HEIC with an empty type. */}
        <input ref={fileRef} type="file" className="hidden" data-testid="pp-file" onChange={(e) => pick(e.target.files?.[0])} />
        <Button onClick={() => fileRef.current?.click()} data-testid="pp-pick">
          <UploadIcon /> {image ? s.another : s.pick}
        </Button>
        <Button to={`/${locale}/apps/remove-background`} data-testid="pp-removebg"><EraseIcon /> {s.removeBg}</Button>
        {busy && <Spinner className="size-5" />}
      </div>

      {error && <FileError message={error} />}
      {!image && !busy && !error && <p className="text-ink-faint text-[0.95rem] rtl:font-ar">{s.hint}</p>}

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-[0.8rem] text-ink-faint">
          {s.spec}
          <Select className="min-w-[14rem]" data-testid="pp-spec" value={specId} onChange={(e) => setSpecId(e.target.value)}>
            {SPECS.map((x) => <option key={x.id} value={x.id}>{locale === 'ar' ? x.ar : x.en}</option>)}
          </Select>
        </label>
        <label className="flex flex-col gap-1 text-[0.8rem] text-ink-faint">
          {s.dpi}
          <Select className="w-28" data-testid="pp-dpi" value={dpi} onChange={(e) => setDpi(+e.target.value)}>
            {DPI_CHOICES.map((d) => <option key={d} value={d}>{d} DPI</option>)}
          </Select>
        </label>
        <span className="text-[0.85rem] text-ink-faint font-mono pb-2" data-testid="pp-pixels">{px.w} × {px.h} px</span>
      </div>

      {spec.note && <p className="text-[0.85rem] text-ink-faint rtl:font-ar">{spec.note[locale]}</p>}

      {image && (
        <>
          <PhotoStage image={image} spec={spec} transform={t} onTransform={setT} guides={guides} whiteBg={whiteBg} />

          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-[0.85rem] text-ink-faint">
              {s.zoom}
              <Input type="range" min={1} max={4} step={0.01} className="w-40 p-0" data-testid="pp-zoom"
                value={t.zoom} onChange={(e) => setT({ ...t, zoom: +e.target.value })} />
            </label>
            <Check>
              <input type="checkbox" checked={guides} data-testid="pp-guides" onChange={(e) => setGuides(e.target.checked)} /> {s.guides}
            </Check>
            <Check>
              <input type="checkbox" checked={whiteBg} data-testid="pp-white" onChange={(e) => setWhiteBg(e.target.checked)} /> {s.white}
            </Check>
          </div>

          {guides && <p className="text-[0.85rem] text-ink-faint rtl:font-ar">{s.headGuide}</p>}
          {tooSmall && <p className="text-[0.88rem] text-gold-500 rtl:font-ar" data-testid="pp-lowres">{s.low}</p>}

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="primary" onClick={() => save('photo')} data-testid="pp-download"><DownloadIcon /> {s.download}</Button>
            <Select className="w-44" data-testid="pp-sheet" value={sheetId} onChange={(e) => setSheetId(e.target.value)}>
              {SHEETS.map((x) => <option key={x.id} value={x.id}>{locale === 'ar' ? x.ar : x.en}</option>)}
            </Select>
            <Button onClick={() => save('sheet')} disabled={perSheet === 0} data-testid="pp-sheet-download">
              <DownloadIcon /> {s.sheet}
            </Button>
            <span className="text-[0.85rem] text-ink-faint rtl:font-ar" data-testid="pp-percount">
              {s.sheetOf(perSheet, locale === 'ar' ? sheet.ar : sheet.en)}
            </span>
          </div>
        </>
      )}

      <Panel><p className="text-[0.85rem] text-ink-soft rtl:font-ar">{s.disclaimer}</p></Panel>
    </Stack>
  )
}
