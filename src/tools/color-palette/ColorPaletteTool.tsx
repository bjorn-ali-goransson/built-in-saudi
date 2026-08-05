import { useEffect, useRef, useState } from 'react'
import { useLocale } from '../../i18n'
import { Button, Input, Stack, Spinner, FileError, Seg, SegButton, CodeOut } from '../../components/ui'
import { UploadIcon, CopyIcon, PaletteIcon } from '../../components/icons'
import { decodeImage } from '../../lib/decodeImage'
import { whyUnreadable } from '../../lib/imageInput'
import { extractPalette, toRgb, toHsl, isDark, asCss, asTailwind, asJson, type Swatch } from './extract'

type Format = 'css' | 'tailwind' | 'json'

const STR = {
  en: {
    pick: 'Choose an image', another: 'Choose another', working: 'Reading the colours…',
    hint: 'Pull the palette out of a photo, a logo or a screenshot — the colours that are actually there, sized by how much of the image each one covers.',
    count: 'Colours', copy: 'Copy', copied: 'Copied!',
    exportAs: 'Export as', share: 'of the image',
    deterministic: 'The same image always gives the same palette. This uses median cut rather than k-means, which needs a random seed and would hand you a slightly different answer each time you pressed the button.',
  },
  ar: {
    pick: 'اختر صورة', another: 'اختر صورة أخرى', working: 'جارٍ قراءة الألوان…',
    hint: 'استخرج لوحة الألوان من صورة أو شعار أو لقطة شاشة — الألوان الموجودة فعلًا، مرتّبة بحسب المساحة التي يغطيها كل لون.',
    count: 'عدد الألوان', copy: 'نسخ', copied: 'تم النسخ!',
    exportAs: 'صدّر بصيغة', share: 'من الصورة',
    deterministic: 'الصورة نفسها تعطي اللوحة نفسها دائمًا. تستخدم الأداة القطع الوسيط لا k-means التي تحتاج بذرة عشوائية وتعطيك نتيجة مختلفة قليلًا في كل ضغطة.',
  },
}

export default function ColorPaletteTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const [swatches, setSwatches] = useState<Swatch[]>([])
  const [preview, setPreview] = useState('')
  const [count, setCount] = useState(6)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [format, setFormat] = useState<Format>('css')
  const [copied, setCopied] = useState('')
  const imgRef = useRef<ImageBitmap | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  async function pick(f: File | undefined) {
    if (!f) return
    setBusy(true); setError('')
    try {
      const bmp = await decodeImage(f)
      if (!bmp) { setError(await whyUnreadable(f, locale)); return }
      imgRef.current = bmp
      setSwatches(extractPalette(bmp, count))
      const canvas = document.createElement('canvas')
      const scale = Math.min(1, 480 / Math.max(bmp.width, bmp.height))
      canvas.width = bmp.width * scale
      canvas.height = bmp.height * scale
      canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height)
      setPreview(canvas.toDataURL('image/jpeg', 0.85))
    } catch {
      setError(await whyUnreadable(f, locale))
    } finally { setBusy(false) }
  }

  // Re-quantise when the requested count changes, without re-decoding the file.
  useEffect(() => {
    if (imgRef.current) setSwatches(extractPalette(imgRef.current, count))
  }, [count])

  const exported = format === 'css' ? asCss(swatches) : format === 'tailwind' ? asTailwind(swatches) : asJson(swatches)

  async function copy(text: string, key: string) {
    try { await navigator.clipboard.writeText(text); setCopied(key); setTimeout(() => setCopied(''), 1500) } catch { /* ignore */ }
  }

  return (
    <Stack data-testid="color-palette">
      <div className="flex flex-wrap items-center gap-2">
        {/* No accept filter — Android's picker hides files it has not indexed. */}
        <input ref={fileRef} type="file" className="hidden" data-testid="cp-file" onChange={(e) => pick(e.target.files?.[0])} />
        <Button onClick={() => fileRef.current?.click()} data-testid="cp-pick">
          <UploadIcon /> {swatches.length ? s.another : s.pick}
        </Button>
        {busy && <Spinner className="size-5" />}
        {busy && <span className="text-[0.9rem] text-ink-faint rtl:font-ar">{s.working}</span>}
      </div>

      {error && <FileError message={error} />}
      {!swatches.length && !busy && !error && <p className="text-ink-faint text-[0.95rem] rtl:font-ar">{s.hint}</p>}

      {swatches.length > 0 && (
        <>
          {preview && <img src={preview} alt="" className="max-h-64 w-auto self-center rounded-md border border-[color:var(--line)]" />}

          <label className="flex items-center gap-2 text-[0.8rem] text-ink-faint">
            {s.count}
            <Input type="range" min={2} max={12} step={1} className="w-40 p-0" data-testid="cp-count"
              value={count} onChange={(e) => setCount(+e.target.value)} />
            <span className="font-mono text-ink w-6">{count}</span>
          </label>

          <div className="flex flex-wrap gap-2" data-testid="cp-swatches">
            {swatches.map((sw, i) => (
              <button key={i} data-testid={`cp-swatch-${i}`} onClick={() => copy(sw.hex, sw.hex)}
                className="flex flex-col justify-end min-w-[7.5rem] flex-1 h-24 rounded-md border border-[color:var(--line)] p-2 text-start"
                style={{ background: sw.hex }}>
                <span className={`font-mono text-[0.85rem] ${isDark(sw) ? 'text-white' : 'text-[#1a1a1a]'}`}>
                  {copied === sw.hex ? s.copied : sw.hex}
                </span>
                <span className={`font-mono text-[0.7rem] ${isDark(sw) ? 'text-white/70' : 'text-black/55'}`}>
                  {Math.round(sw.share * 100)}% {s.share}
                </span>
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-2 text-[0.85rem]" data-testid="cp-values">
            {swatches.map((sw, i) => (
              <div key={i} className="flex flex-wrap items-center gap-3">
                <span className="inline-block size-4 rounded-sm border border-[color:var(--line)]" style={{ background: sw.hex }} />
                <span className="font-mono text-ink w-20">{sw.hex}</span>
                <span className="font-mono text-ink-faint w-40">{toRgb(sw)}</span>
                <span className="font-mono text-ink-faint">{toHsl(sw)}</span>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-body text-[0.68rem] uppercase tracking-[0.06em] text-ink-faint">{s.exportAs}</span>
            <Seg>
              <SegButton active={format === 'css'} data-testid="cp-css" onClick={() => setFormat('css')}>CSS</SegButton>
              <SegButton active={format === 'tailwind'} data-testid="cp-tailwind" onClick={() => setFormat('tailwind')}>Tailwind</SegButton>
              <SegButton active={format === 'json'} data-testid="cp-json" onClick={() => setFormat('json')}>JSON</SegButton>
            </Seg>
            <Button className="px-3 py-1" onClick={() => copy(exported, 'export')} data-testid="cp-copy-export">
              <CopyIcon /> {copied === 'export' ? s.copied : s.copy}
            </Button>
          </div>
          <CodeOut data-testid="cp-export">{exported}</CodeOut>

          <p className="text-[0.85rem] text-ink-faint rtl:font-ar">{s.deterministic}</p>
          <Button to={`/${locale}/apps/color-contrast`} className="self-start">
            <PaletteIcon /> {locale === 'ar' ? 'افحص التباين' : 'Check the contrast'}
          </Button>
        </>
      )}
    </Stack>
  )
}
