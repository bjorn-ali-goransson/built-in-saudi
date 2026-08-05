import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocale } from '../../i18n'
import { UploadIcon, ArchiveIcon } from '../../components/icons'
import { Button, Select, Stack, Spinner, FileError, Input, Seg, SegButton } from '../../components/ui'
import { setWorkInProgress } from '../../lib/workInProgress'
import { decodeImage } from '../../lib/decodeImage'
import { whyUnreadable } from '../../lib/imageInput'
import { zipStore } from '../../lib/zip'
import { SIZES, GROUPS, renderSize, canvasBytes, type Fit } from './sizes'
import { SizeCard } from './SizeCard'

const STR = {
  en: {
    pick: 'Choose an image', another: 'Choose another',
    hint: 'One image in, every platform size out — pick the ones you need and download them all at once.',
    fit: 'Fit', cover: 'Fill and crop', contain: 'Fit whole image',
    focus: 'Crop from', top: 'Top', centre: 'Centre', bottom: 'Bottom',
    bg: 'Padding colour', format: 'Format',
    all: 'Select all', none: 'Select none',
    selected: (n: number) => `${n} selected`,
    downloadZip: 'Download all as .zip', downloadOne: 'Download',
    working: 'Preparing…',
  },
  ar: {
    pick: 'اختر صورة', another: 'اختر صورة أخرى',
    hint: 'صورة واحدة تدخل، وكل مقاسات المنصات تخرج — اختر ما تحتاجه ونزّلها دفعة واحدة.',
    fit: 'الملاءمة', cover: 'ملء واقتصاص', contain: 'إظهار الصورة كاملة',
    focus: 'اقتصّ من', top: 'الأعلى', centre: 'الوسط', bottom: 'الأسفل',
    bg: 'لون الهامش', format: 'الصيغة',
    all: 'اختر الكل', none: 'ألغِ الكل',
    selected: (n: number) => `${n.toLocaleString('ar')} محدد`,
    downloadZip: 'نزّل الكل كملف ‎.zip', downloadOne: 'تنزيل',
    working: 'جارٍ التجهيز…',
  },
}

const FORMATS = { png: 'image/png', jpeg: 'image/jpeg', webp: 'image/webp' } as const
type Format = keyof typeof FORMATS
const EXT: Record<Format, string> = { png: 'png', jpeg: 'jpg', webp: 'webp' }

export default function SocialResizeTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const [img, setImg] = useState<ImageBitmap | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [picked, setPicked] = useState<string[]>(['ig-square', 'ig-story', 'x-post', 'og'])
  const [fit, setFit] = useState<Fit>('cover')
  const [focusY, setFocusY] = useState(0.5)
  const [bg, setBg] = useState('#ffffff')
  const [format, setFormat] = useState<Format>('png')
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => () => setWorkInProgress('social-resize', false), [])

  const chosen = useMemo(() => SIZES.filter((x) => picked.includes(x.id)), [picked])

  async function pick(f: File | undefined) {
    if (!f) return
    setBusy(true); setError('')
    try {
      const bmp = await decodeImage(f)
      if (!bmp) { setError(await whyUnreadable(f, locale)); return }
      setImg(bmp)
      setWorkInProgress('social-resize', true)
    } catch {
      setError(await whyUnreadable(f, locale))
    } finally { setBusy(false) }
  }

  function toggle(id: string) {
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))
  }

  async function downloadOne(id: string) {
    const size = SIZES.find((x) => x.id === id)
    if (!size || !img) return
    const canvas = renderSize(img, size, fit, format === 'png' ? 'transparent' : bg, focusY)
    canvas.toBlob((blob) => {
      if (!blob) return
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = `${size.id}-${size.w}x${size.h}.${EXT[format]}`; a.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    }, FORMATS[format], 0.92)
  }

  async function downloadZip() {
    if (!img || chosen.length === 0) return
    setBusy(true)
    try {
      const files = []
      for (const size of chosen) {
        const canvas = renderSize(img, size, fit, format === 'png' ? 'transparent' : bg, focusY)
        files.push({
          name: `${size.id}-${size.w}x${size.h}.${EXT[format]}`,
          bytes: await canvasBytes(canvas, FORMATS[format], 0.92),
        })
      }
      const url = URL.createObjectURL(zipStore(files))
      const a = document.createElement('a')
      a.href = url; a.download = 'social-sizes.zip'; a.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } finally { setBusy(false) }
  }

  return (
    <Stack data-testid="social-resize">
      <div className="flex flex-wrap items-center gap-2">
        {/* No accept filter — Android's picker hides files it has not indexed. */}
        <input ref={fileRef} type="file" className="hidden" data-testid="sr-file" onChange={(e) => pick(e.target.files?.[0])} />
        <Button onClick={() => fileRef.current?.click()} data-testid="sr-pick">
          <UploadIcon /> {img ? s.another : s.pick}
        </Button>
        {busy && <Spinner className="size-5" />}
        {busy && <span className="text-[0.9rem] text-ink-faint rtl:font-ar">{s.working}</span>}
      </div>

      {error && <FileError message={error} />}
      {!img && !busy && !error && <p className="text-ink-faint text-[0.95rem] rtl:font-ar">{s.hint}</p>}

      {img && (
        <>
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex flex-col gap-1">
              <span className="text-[0.8rem] text-ink-faint">{s.fit}</span>
              <Seg>
                <SegButton active={fit === 'cover'} data-testid="sr-cover" onClick={() => setFit('cover')}>{s.cover}</SegButton>
                <SegButton active={fit === 'contain'} data-testid="sr-contain" onClick={() => setFit('contain')}>{s.contain}</SegButton>
              </Seg>
            </div>
            {fit === 'cover' && (
              <label className="flex flex-col gap-1 text-[0.8rem] text-ink-faint">
                {s.focus}
                <Select className="w-28" data-testid="sr-focus" value={focusY} onChange={(e) => setFocusY(+e.target.value)}>
                  <option value={0}>{s.top}</option>
                  <option value={0.5}>{s.centre}</option>
                  <option value={1}>{s.bottom}</option>
                </Select>
              </label>
            )}
            <label className="flex flex-col gap-1 text-[0.8rem] text-ink-faint">
              {s.format}
              <Select className="w-24" data-testid="sr-format" value={format} onChange={(e) => setFormat(e.target.value as Format)}>
                <option value="png">PNG</option><option value="jpeg">JPG</option><option value="webp">WebP</option>
              </Select>
            </label>
            {fit === 'contain' && format !== 'png' && (
              <label className="flex flex-col gap-1 text-[0.8rem] text-ink-faint">
                {s.bg}
                <Input type="color" className="w-16 h-9 p-1" data-testid="sr-bg" value={bg} onChange={(e) => setBg(e.target.value)} />
              </label>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[0.9rem] font-semibold text-ink" data-testid="sr-count">{s.selected(chosen.length)}</span>
            <Button className="px-3 py-1" onClick={() => setPicked(SIZES.map((x) => x.id))} data-testid="sr-all">{s.all}</Button>
            <Button className="px-3 py-1" onClick={() => setPicked([])} data-testid="sr-none">{s.none}</Button>
            <Button variant="primary" onClick={downloadZip} disabled={chosen.length === 0 || busy} data-testid="sr-zip">
              <ArchiveIcon /> {s.downloadZip}
            </Button>
          </div>

          {GROUPS.map((group) => (
            <section key={group} className="flex flex-col gap-2">
              <h2 className="font-body text-[0.68rem] uppercase tracking-[0.06em] text-ink-faint">{group}</h2>
              <div className="grid gap-3 grid-cols-2 min-[560px]:grid-cols-3 min-[860px]:grid-cols-4">
                {SIZES.filter((x) => x.group === group).map((size) => (
                  <SizeCard key={size.id} size={size} image={img} fit={fit} focusY={focusY}
                    background={format === 'png' ? 'transparent' : bg}
                    checked={picked.includes(size.id)} label={locale === 'ar' ? size.ar : size.en}
                    downloadLabel={s.downloadOne}
                    onToggle={() => toggle(size.id)} onDownload={() => downloadOne(size.id)} />
                ))}
              </div>
            </section>
          ))}
        </>
      )}
    </Stack>
  )
}
