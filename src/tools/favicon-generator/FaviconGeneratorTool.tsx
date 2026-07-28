import { useEffect, useRef, useState } from 'react'
import { useLocale } from '../../i18n'
import { setWorkInProgress } from '../../lib/workInProgress'
import { UploadIcon, DownloadIcon, CopyIcon } from '../../components/icons'
import { Button, Stack , FileError } from '../../components/ui'
import { whyUnreadable } from '../../lib/imageInput'
import { decodeImage } from '../../lib/decodeImage'

const SIZES = [16, 32, 48, 64, 96, 180, 192, 512]

const STR = {
  en: { drop: 'Drop a square image or logo, or tap to choose', download: 'Download', snippet: 'HTML tags', copy: 'Copy', copied: 'Copied!', change: 'Choose another image', apple: 'Apple touch', privacy: 'Generated on your device — nothing is uploaded.' },
  ar: { drop: 'أفلت صورة مربّعة أو شعارًا، أو اضغط للاختيار', download: 'تنزيل', snippet: 'وسوم HTML', copy: 'نسخ', copied: 'تم النسخ!', change: 'اختر صورة أخرى', apple: 'أيقونة Apple', privacy: 'تُنشأ على جهازك — لا يُرفع أي شيء.' },
}

const SNIPPET = `<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png">
<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16.png">
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">`

export default function FaviconGeneratorTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const fileRef = useRef<HTMLInputElement>(null)
  const [bitmap, setBitmap] = useState<ImageBitmap | null>(null)
  const [err, setErr] = useState('')
  const [icons, setIcons] = useState<{ size: number; url: string }[]>([])
  const [copied, setCopied] = useState(false)


  // Hold off the deploy auto-reload while a file is loaded — it can't be restored
  // afterwards, so the update is offered instead of taken (#228).
  useEffect(() => {
    setWorkInProgress('favicon-generator', !!(bitmap))
    return () => setWorkInProgress('favicon-generator', false)
  }, [bitmap])

  async function onFile(f: File | undefined) {
    if (!f) return
    setErr('')
    const bmp = await decodeImage(f)
    if (!bmp) { setErr(await whyUnreadable(f, locale)); return }
    setBitmap(bmp)
  }

  useEffect(() => {
    if (!bitmap) return
    let cancelled = false
    const urls: { size: number; url: string }[] = []
    ;(async () => {
      for (const size of SIZES) {
        const c = document.createElement('canvas'); c.width = size; c.height = size
        const ctx = c.getContext('2d')!
        ctx.imageSmoothingQuality = 'high'
        // cover-fit into the square
        const scale = Math.max(size / bitmap.width, size / bitmap.height)
        const w = bitmap.width * scale, h = bitmap.height * scale
        ctx.drawImage(bitmap, (size - w) / 2, (size - h) / 2, w, h)
        const blob = await new Promise<Blob | null>((res) => c.toBlob(res, 'image/png'))
        if (blob) urls.push({ size, url: URL.createObjectURL(blob) })
      }
      if (!cancelled) setIcons(urls); else urls.forEach((u) => URL.revokeObjectURL(u.url))
    })()
    return () => { cancelled = true }
  }, [bitmap])

  useEffect(() => () => icons.forEach((i) => URL.revokeObjectURL(i.url)), [icons])
  async function copy() { try { await navigator.clipboard.writeText(SNIPPET); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch { /* */ } }
  const name = (size: number) => (size === 180 ? 'apple-touch-icon.png' : `favicon-${size}.png`)

  return (
    <Stack data-testid="favicon-generator">
      <FileError message={err} />
      {!bitmap ? (
        <button className="relative flex flex-col items-center gap-[0.4rem] py-8 px-4 border-2 border-dashed border-[color:var(--line)] rounded-[var(--r-md)] bg-[var(--surface)] text-center cursor-pointer hover:border-[color:color-mix(in_srgb,var(--green-500)_45%,transparent)]" data-testid="favicon-drop" onClick={() => fileRef.current?.click()}
          onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); onFile(e.dataTransfer.files[0]) }}>
          <UploadIcon /><span>{s.drop}</span>
          <input ref={fileRef} type="file" className="absolute w-px h-px opacity-0" onChange={(e) => onFile(e.target.files?.[0])} />
        </button>
      ) : (
        <>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-3" data-testid="favicon-grid">
            {icons.map(({ size, url }) => (
              <a key={size} href={url} download={name(size)} className="flex flex-col items-center gap-2 p-3 border border-[color:var(--line-soft)] rounded-md bg-[var(--surface)] no-underline text-ink hover:border-green-500/40 group">
                <img src={url} alt={`${size}px`} width={Math.min(64, size)} height={Math.min(64, size)} className="rounded [image-rendering:pixelated]" style={{ imageRendering: size <= 48 ? 'pixelated' : 'auto' }} />
                <span className="font-mono text-[0.8rem] text-ink-soft">{size}×{size}{size === 180 ? ` · ${s.apple}` : ''}</span>
                <span className="inline-flex items-center gap-1 text-[0.75rem] text-green-600 font-semibold"><DownloadIcon className="w-3.5 h-3.5" /> {s.download}</span>
              </a>
            ))}
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between"><span className="text-[0.82rem] font-semibold text-ink-soft">{s.snippet}</span>
              <Button onClick={copy} data-testid="favicon-copy"><CopyIcon /> {copied ? s.copied : s.copy}</Button></div>
            <pre className="bg-[var(--surface)] border border-[color:var(--line-soft)] rounded-md p-3 font-mono text-[0.78rem] overflow-x-auto" dir="ltr">{SNIPPET}</pre>
          </div>
          <Button onClick={() => { setBitmap(null); setIcons([]) }}>{s.change}</Button>
        </>
      )}
      <p className="text-[0.8rem] text-ink-faint flex items-center gap-[0.4rem]"><span aria-hidden="true">🔒</span> {s.privacy}</p>
    </Stack>
  )
}
