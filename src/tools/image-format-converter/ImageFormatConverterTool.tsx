import { useEffect, useRef, useState } from 'react'
import { useLocale } from '../../i18n'
import { UploadIcon, DownloadIcon } from '../../components/icons'
import { Button, Field, Stack, Seg, SegButton } from '../../components/ui'
import { ImageEncoder } from '../../lib/imageEncoder'

type Fmt = 'image/png' | 'image/jpeg' | 'image/webp'

const STR = {
  en: {
    drop: 'Drop an image, or tap to choose', another: 'Choose another',
    to: 'Convert to', quality: 'Quality', bg: 'Background (for JPG)',
    from: 'From', download: 'Download', working: 'Converting…',
    privacy: 'Converted on your device — the image is never uploaded.',
    bgHint: 'JPG has no transparency, so transparent areas are filled with this colour.',
  },
  ar: {
    drop: 'أفلت صورة أو اضغط للاختيار', another: 'اختر صورة أخرى',
    to: 'التحويل إلى', quality: 'الجودة', bg: 'الخلفية (لصيغة JPG)',
    from: 'من', download: 'تنزيل', working: 'جارٍ التحويل…',
    privacy: 'يُحوَّل على جهازك — لا تُرفع الصورة أبدًا.',
    bgHint: 'صيغة JPG لا تدعم الشفافية، لذا تُملأ المناطق الشفافة بهذا اللون.',
  },
}

const LABEL: Record<Fmt, string> = { 'image/png': 'PNG', 'image/jpeg': 'JPG', 'image/webp': 'WebP' }
const EXT: Record<Fmt, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' }
const fmtBytes = (n: number) => n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(2)} MB`

export default function ImageFormatConverterTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const fileRef = useRef<HTMLInputElement>(null)
  const [src, setSrc] = useState<{ name: string; size: number; type: string } | null>(null)
  const [target, setTarget] = useState<Fmt>('image/jpeg')
  const [quality, setQuality] = useState(0.92)
  const [bg, setBg] = useState('#ffffff')
  const [busy, setBusy] = useState(false)
  const [out, setOut] = useState<{ url: string; size: number } | null>(null)
  const encRef = useRef<ImageEncoder | null>(null)

  useEffect(() => () => encRef.current?.dispose(), [])

  async function onFile(f: File | undefined) {
    if (!f || !f.type.startsWith('image/')) return
    encRef.current ??= new ImageEncoder()
    const dim = await encRef.current.load(f)
    if (!dim) return
    setSrc({ name: f.name.replace(/\.[^.]+$/, ''), size: f.size, type: f.type })
    setTarget(f.type === 'image/jpeg' ? 'image/png' : 'image/jpeg')
  }

  // Conversion runs in the worker (#154) so full-size re-encodes never jank the UI.
  useEffect(() => {
    if (!src) return
    let cancelled = false
    setBusy(true)
    encRef.current!.encode({ format: target, quality: target === 'image/png' ? undefined : quality, bg: target === 'image/jpeg' ? bg : undefined }).then((blob) => {
      if (cancelled) return
      setBusy(false)
      if (!blob) return
      setOut((prev) => { if (prev) URL.revokeObjectURL(prev.url); return { url: URL.createObjectURL(blob), size: blob.size } })
    })
    return () => { cancelled = true }
  }, [src, target, quality, bg])

  return (
    <Stack data-testid="image-format-converter">
      {!src ? (
        <button className="flex flex-col items-center gap-[0.4rem] py-8 px-4 border-2 border-dashed border-[color:var(--line)] rounded-[var(--r-md)] bg-[var(--surface)] text-center cursor-pointer transition-[border-color,background] duration-150 hover:border-[color:color-mix(in_srgb,var(--green-500)_45%,transparent)] hover:bg-[color-mix(in_srgb,var(--green-400)_6%,transparent)] [&_small]:text-[color:var(--ink-faint)] [&_small]:text-[0.82rem]" data-testid="ifc-drop" onClick={() => fileRef.current?.click()}
          onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); onFile(e.dataTransfer.files[0]) }}>
          <UploadIcon /><span>{s.drop}</span>
          <input ref={fileRef} type="file" accept="image/*" className="absolute w-px h-px opacity-0" onChange={(e) => onFile(e.target.files?.[0])} />
        </button>
      ) : (
        <>
          <Field label={s.to}>
            <Seg className="self-start" role="group">
              {(['image/png', 'image/jpeg', 'image/webp'] as Fmt[]).map((f) => (
                <SegButton key={f} active={target === f} data-testid={`ifc-fmt-${LABEL[f]}`} onClick={() => setTarget(f)}>{LABEL[f]}</SegButton>
              ))}
            </Seg>
          </Field>

          {target !== 'image/png' && (
            <Field label={`${s.quality} · ${Math.round(quality * 100)}%`}>
              <input type="range" min={0.1} max={1} step={0.02} value={quality} data-testid="ifc-quality" onChange={(e) => setQuality(+e.target.value)} />
            </Field>
          )}
          {target === 'image/jpeg' && (
            <Field label={s.bg}>
              <div className="flex items-center gap-2">
                <input type="color" value={bg} data-testid="ifc-bg" onChange={(e) => setBg(e.target.value)} className="w-10 h-9 rounded border border-[color:var(--line)] bg-transparent p-0" />
                <span className="text-[0.8rem] text-ink-faint">{s.bgHint}</span>
              </div>
            </Field>
          )}

          {out && (
            <div className="flex items-center gap-4 border border-[color:var(--line-soft)] rounded-md bg-[var(--surface)] p-4" data-testid="ifc-result">
              <img src={out.url} alt="" className="w-24 h-24 object-contain rounded bg-sand-100 flex-none" style={{ backgroundImage: 'repeating-conic-gradient(#0001 0% 25%, transparent 0% 50%)', backgroundSize: '16px 16px' }} />
              <div className="flex flex-col gap-1 min-w-0">
                <span className="text-ink-soft text-[0.9rem]">{s.from}: <span className="font-mono uppercase">{(src.type.split('/')[1] || '').toUpperCase()}</span> · <span className="font-mono">{fmtBytes(src.size)}</span></span>
                <span className="text-ink text-[0.95rem] font-semibold">{LABEL[target]} · <span className="font-mono">{fmtBytes(out.size)}</span></span>
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <Button variant="primary" href={out?.url ?? ''} download={`${src.name}.${EXT[target]}`} data-testid="ifc-download"><DownloadIcon /> {s.download}</Button>
            <Button onClick={() => { setSrc(null); setOut(null) }}>{s.another}</Button>
          </div>
          {busy && <p className="text-ink-faint text-[0.9rem]">{s.working}</p>}
        </>
      )}

      <p className="text-[0.8rem] text-ink-faint flex items-center gap-[0.4rem]"><span aria-hidden="true">🔒</span> {s.privacy}</p>
    </Stack>
  )
}
