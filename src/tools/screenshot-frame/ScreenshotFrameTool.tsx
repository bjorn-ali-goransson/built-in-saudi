import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocale } from '../../i18n'
import { UploadIcon, DownloadIcon, CopyIcon } from '../../components/icons'
import { Button, Select, Stack, Spinner, FileError, Input } from '../../components/ui'
import { setWorkInProgress } from '../../lib/workInProgress'
import { decodeImage } from '../../lib/decodeImage'
import { whyUnreadable } from '../../lib/imageInput'
import { BACKDROPS, RATIOS, renderFrame, frameSize, type FrameOptions } from './backdrops'

const STR = {
  en: {
    pick: 'Choose a screenshot', another: 'Choose another', paste: 'or press Ctrl+V to paste one',
    hint: 'Drop in a screenshot and it comes out looking deliberate — padded, rounded, and sitting on a backdrop instead of floating on white.',
    backdrop: 'Backdrop', padding: 'Padding', radius: 'Corners', shadow: 'Shadow', ratio: 'Shape', scale: 'Export size',
    download: 'Download PNG', copy: 'Copy image', copied: 'Copied!',
    size: 'Output',
    copyFail: 'Your browser would not let the image be copied — download it instead.',
  },
  ar: {
    pick: 'اختر لقطة شاشة', another: 'اختر لقطة أخرى', paste: 'أو اضغط Ctrl+V للصق واحدة',
    hint: 'ألقِ لقطة شاشة لتخرج بمظهر مقصود — بهوامش وحواف دائرية وخلفية بدل أن تطفو على بياض.',
    backdrop: 'الخلفية', padding: 'الهامش', radius: 'الحواف', shadow: 'الظل', ratio: 'الشكل', scale: 'حجم التصدير',
    download: 'نزّل PNG', copy: 'انسخ الصورة', copied: 'تم النسخ!',
    size: 'الناتج',
    copyFail: 'لم يسمح متصفحك بنسخ الصورة — نزّلها بدلًا من ذلك.',
  },
}

export default function ScreenshotFrameTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const [img, setImg] = useState<ImageBitmap | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [backdropId, setBackdropId] = useState('dusk')
  const [padding, setPadding] = useState(0.08)
  const [radius, setRadius] = useState(12)
  const [shadow, setShadow] = useState(0.6)
  const [ratio, setRatio] = useState<string>('auto')
  const [scale, setScale] = useState(1)
  const [copied, setCopied] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const previewRef = useRef<HTMLDivElement>(null)

  const options: FrameOptions = useMemo(() => ({
    padding, radius, shadow, ratio, scale,
    backdrop: BACKDROPS.find((b) => b.id === backdropId) ?? BACKDROPS[0],
  }), [padding, radius, shadow, ratio, scale, backdropId])

  useEffect(() => () => setWorkInProgress('screenshot-frame', false), [])

  async function accept(f: File | undefined) {
    if (!f) return
    setBusy(true); setError('')
    try {
      const bmp = await decodeImage(f)
      if (!bmp) { setError(await whyUnreadable(f, locale)); return }
      setImg(bmp)
      setWorkInProgress('screenshot-frame', true)
    } catch {
      setError(await whyUnreadable(f, locale))
    } finally { setBusy(false) }
  }

  // Pasting is how people actually get a screenshot out of the OS clipboard —
  // asking them to save a file first defeats the point of the tool.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const item = [...(e.clipboardData?.items ?? [])].find((i) => i.type.startsWith('image/'))
      const file = item?.getAsFile()
      if (file) { e.preventDefault(); void accept(file) }
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale])

  // Redraw into the live preview whenever anything changes.
  useEffect(() => {
    const host = previewRef.current
    if (!host) return
    host.replaceChildren()
    if (!img) return
    const canvas = renderFrame(img, { ...options, scale: 1 })
    canvas.className = 'max-w-full h-auto rounded-md'
    canvas.setAttribute('data-testid', 'sf-preview')
    host.appendChild(canvas)
  }, [img, options])

  function exportCanvas(): HTMLCanvasElement | null {
    return img ? renderFrame(img, options) : null
  }

  function download() {
    const canvas = exportCanvas()
    if (!canvas) return
    canvas.toBlob((blob) => {
      if (!blob) return
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = 'framed.png'; a.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    }, 'image/png')
  }

  async function copy() {
    const canvas = exportCanvas()
    if (!canvas) return
    try {
      const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/png'))
      if (!blob) throw new Error('encode')
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
      setCopied(true); setTimeout(() => setCopied(false), 1500)
    } catch {
      setError(s.copyFail)
    }
  }

  const out = img ? frameSize(img.width, img.height, options) : null

  return (
    <Stack data-testid="screenshot-frame">
      <div className="flex flex-wrap items-center gap-2">
        {/* No accept filter — Android's picker hides files it has not indexed. */}
        <input ref={fileRef} type="file" className="hidden" data-testid="sf-file" onChange={(e) => accept(e.target.files?.[0])} />
        <Button onClick={() => fileRef.current?.click()} data-testid="sf-pick">
          <UploadIcon /> {img ? s.another : s.pick}
        </Button>
        <span className="text-[0.85rem] text-ink-faint rtl:font-ar">{s.paste}</span>
        {busy && <Spinner className="size-5" />}
      </div>

      {error && <FileError message={error} />}
      {!img && !busy && !error && <p className="text-ink-faint text-[0.95rem] rtl:font-ar">{s.hint}</p>}

      {img && (
        <>
          <div ref={previewRef} className="flex justify-center" />

          <div className="flex flex-wrap items-end gap-4">
            <label className="flex flex-col gap-1 text-[0.8rem] text-ink-faint">
              {s.backdrop}
              <Select className="w-36" data-testid="sf-backdrop" value={backdropId} onChange={(e) => setBackdropId(e.target.value)}>
                {BACKDROPS.map((b) => <option key={b.id} value={b.id}>{locale === 'ar' ? b.ar : b.en}</option>)}
              </Select>
            </label>
            <label className="flex flex-col gap-1 text-[0.8rem] text-ink-faint">
              {s.ratio}
              <Select className="w-28" data-testid="sf-ratio" value={ratio} onChange={(e) => setRatio(e.target.value)}>
                {RATIOS.map((r) => <option key={r} value={r}>{r}</option>)}
              </Select>
            </label>
            <label className="flex flex-col gap-1 text-[0.8rem] text-ink-faint">
              {s.padding}
              <Input type="range" min={0} max={0.3} step={0.01} className="w-32 p-0" data-testid="sf-padding"
                value={padding} onChange={(e) => setPadding(+e.target.value)} />
            </label>
            <label className="flex flex-col gap-1 text-[0.8rem] text-ink-faint">
              {s.radius}
              <Input type="range" min={0} max={48} step={1} className="w-32 p-0" data-testid="sf-radius"
                value={radius} onChange={(e) => setRadius(+e.target.value)} />
            </label>
            <label className="flex flex-col gap-1 text-[0.8rem] text-ink-faint">
              {s.shadow}
              <Input type="range" min={0} max={1} step={0.05} className="w-32 p-0" data-testid="sf-shadow"
                value={shadow} onChange={(e) => setShadow(+e.target.value)} />
            </label>
            <label className="flex flex-col gap-1 text-[0.8rem] text-ink-faint">
              {s.scale}
              <Select className="w-24" data-testid="sf-scale" value={scale} onChange={(e) => setScale(+e.target.value)}>
                <option value={1}>1×</option><option value={2}>2×</option><option value={3}>3×</option>
              </Select>
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="primary" onClick={download} data-testid="sf-download"><DownloadIcon /> {s.download}</Button>
            <Button onClick={copy} data-testid="sf-copy"><CopyIcon /> {copied ? s.copied : s.copy}</Button>
            {out && <span className="text-[0.85rem] text-ink-faint font-mono" data-testid="sf-size">{s.size} {out.w} × {out.h}</span>}
          </div>
        </>
      )}
    </Stack>
  )
}
