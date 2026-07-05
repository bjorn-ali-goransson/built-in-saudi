import { useEffect, useRef, useState } from 'react'
import { useLocale } from '../../i18n'
import { UploadIcon, DownloadIcon } from '../../components/icons'
import { Button, Input, Field, Stack, Seg, SegButton } from '../../components/ui'

type Fmt = 'image/jpeg' | 'image/webp' | 'image/png'

const STR = {
  en: {
    drop: 'Drop an image, or tap to choose', privacy: 'Compressed on your device — the image is never uploaded.',
    quality: 'Quality', format: 'Format', maxW: 'Max width (px, optional)',
    original: 'Original', compressed: 'Compressed', saved: 'saved', download: 'Download',
    working: 'Compressing…', bigger: 'Already smaller than a re-encode — keeping the original.',
  },
  ar: {
    drop: 'أفلت صورة أو اضغط للاختيار', privacy: 'تُضغط على جهازك — لا تُرفع الصورة أبدًا.',
    quality: 'الجودة', format: 'الصيغة', maxW: 'أقصى عرض (بكسل، اختياري)',
    original: 'الأصل', compressed: 'المضغوطة', saved: 'توفير', download: 'تنزيل',
    working: 'جارٍ الضغط…', bigger: 'الأصل أصغر من إعادة الترميز — نُبقيه.',
  },
}

const fmtBytes = (n: number) => n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(2)} MB`

export default function ImageCompressorTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const fileRef = useRef<HTMLInputElement>(null)
  const [src, setSrc] = useState<{ name: string; size: number; bitmap: ImageBitmap } | null>(null)
  const [quality, setQuality] = useState(0.8)
  const [format, setFormat] = useState<Fmt>('image/jpeg')
  const [maxW, setMaxW] = useState('')
  const [busy, setBusy] = useState(false)
  const [out, setOut] = useState<{ url: string; size: number } | null>(null)

  async function onFile(f: File | undefined) {
    if (!f || !f.type.startsWith('image/')) return
    try { const bitmap = await createImageBitmap(f); setSrc({ name: f.name.replace(/\.[^.]+$/, ''), size: f.size, bitmap }) } catch { /* ignore */ }
  }

  useEffect(() => {
    if (!src) return
    let cancelled = false
    setBusy(true)
    const scale = maxW && src.bitmap.width > +maxW ? +maxW / src.bitmap.width : 1
    const w = Math.round(src.bitmap.width * scale), h = Math.round(src.bitmap.height * scale)
    const c = document.createElement('canvas'); c.width = w; c.height = h
    c.getContext('2d')!.drawImage(src.bitmap, 0, 0, w, h)
    c.toBlob((blob) => {
      if (cancelled || !blob) { setBusy(false); return }
      setOut((prev) => { if (prev) URL.revokeObjectURL(prev.url); return { url: URL.createObjectURL(blob), size: blob.size } })
      setBusy(false)
    }, format, format === 'image/png' ? undefined : quality)
    return () => { cancelled = true }
  }, [src, quality, format, maxW])

  const ext = format === 'image/jpeg' ? 'jpg' : format === 'image/webp' ? 'webp' : 'png'
  const savedPct = src && out ? Math.round((1 - out.size / src.size) * 100) : 0

  return (
    <Stack data-testid="image-compressor">
      {!src ? (
        <button className="flex flex-col items-center gap-[0.4rem] py-8 px-4 border-2 border-dashed border-[color:var(--line)] rounded-[var(--r-md)] bg-[var(--surface)] text-center cursor-pointer transition-[border-color,background] duration-150 hover:border-[color:color-mix(in_srgb,var(--green-500)_45%,transparent)] hover:bg-[color-mix(in_srgb,var(--green-400)_6%,transparent)] [&_small]:text-[color:var(--ink-faint)] [&_small]:text-[0.82rem]" data-testid="imgcomp-drop" onClick={() => fileRef.current?.click()}
          onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); onFile(e.dataTransfer.files[0]) }}>
          <UploadIcon /><span>{s.drop}</span>
          <input ref={fileRef} type="file" accept="image/*" className="absolute w-px h-px opacity-0" onChange={(e) => onFile(e.target.files?.[0])} />
        </button>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Field label={s.format}>
              <Seg role="group">
                {([['image/jpeg', 'JPEG'], ['image/webp', 'WebP'], ['image/png', 'PNG']] as [Fmt, string][]).map(([f, l]) => (
                  <SegButton key={f} active={format === f} data-testid={`imgcomp-fmt-${l}`} onClick={() => setFormat(f)}>{l}</SegButton>
                ))}
              </Seg>
            </Field>
            <Field label={`${s.quality} · ${Math.round(quality * 100)}%`}>
              <input type="range" min={0.1} max={1} step={0.05} value={quality} data-testid="imgcomp-quality"
                disabled={format === 'image/png'} onChange={(e) => setQuality(+e.target.value)} />
            </Field>
            <Field label={s.maxW}>
              <Input className="font-mono" type="number" min={1} placeholder={String(src.bitmap.width)} value={maxW} data-testid="imgcomp-maxw" onChange={(e) => setMaxW(e.target.value)} />
            </Field>
          </div>

          {out && (
            <div className="flex items-center gap-4 border border-[color:var(--line-soft)] rounded-md bg-[var(--surface)] p-4" data-testid="imgcomp-result">
              <img src={out.url} alt="" className="w-24 h-24 object-contain rounded bg-sand-100 flex-none" />
              <div className="flex flex-col gap-1 min-w-0">
                <span className="text-ink-soft text-[0.9rem]">{s.original}: <span className="font-mono">{fmtBytes(src.size)}</span></span>
                <span className="text-ink text-[0.95rem] font-semibold">{s.compressed}: <span className="font-mono">{fmtBytes(out.size)}</span></span>
                <span className={`text-[0.85rem] font-semibold ${savedPct > 0 ? 'text-green-600' : 'text-ink-faint'}`}>{savedPct > 0 ? `${savedPct}% ${s.saved}` : s.bigger}</span>
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <Button variant="primary" href={out?.url ?? ''} download={`${src.name}-compressed.${ext}`} data-testid="imgcomp-download"><DownloadIcon /> {s.download}</Button>
            <Button onClick={() => { setSrc(null); setOut(null) }}>{s.drop}</Button>
          </div>
          {busy && <p className="text-ink-faint text-[0.9rem]">{s.working}</p>}
        </>
      )}

      <p className="text-[0.8rem] text-ink-faint flex items-center gap-[0.4rem]"><span aria-hidden="true">🔒</span> {s.privacy}</p>
    </Stack>
  )
}
