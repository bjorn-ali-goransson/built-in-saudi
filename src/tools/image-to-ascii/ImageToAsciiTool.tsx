import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocale } from '../../i18n'
import { setWorkInProgress } from '../../lib/workInProgress'
import { UploadIcon, DownloadIcon, CopyIcon } from '../../components/icons'
import { Button, Stack, Field, Check , FileError } from '../../components/ui'
import { whyUnreadable } from '../../lib/imageInput'
import { decodeImage } from '../../lib/decodeImage'

const RAMPS = {
  detailed: '@%#*+=-:. ',
  blocks: '█▓▒░ ',
  simple: '#+. ',
}

const STR = {
  en: { drop: 'Drop an image, or tap to choose', width: 'Width (characters)', charset: 'Character set', invert: 'Invert (for dark backgrounds)', copy: 'Copy', copied: 'Copied!', download: 'Download .txt', change: 'Choose another image', privacy: 'Converted on your device — the image is never uploaded.' },
  ar: { drop: 'أفلت صورة أو اضغط للاختيار', width: 'العرض (أحرف)', charset: 'مجموعة الرموز', invert: 'اعكس (للخلفيات الداكنة)', copy: 'نسخ', copied: 'تم النسخ!', download: 'تنزيل .txt', change: 'اختر صورة أخرى', privacy: 'يُحوَّل على جهازك — لا تُرفع الصورة أبدًا.' },
}

export default function ImageToAsciiTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const fileRef = useRef<HTMLInputElement>(null)
  const [bitmap, setBitmap] = useState<ImageBitmap | null>(null)
  const [err, setErr] = useState('')
  const [width, setWidth] = useState(100)
  const [charset, setCharset] = useState<keyof typeof RAMPS>('detailed')
  const [invert, setInvert] = useState(false)
  const [copied, setCopied] = useState(false)


  // Hold off the deploy auto-reload while a file is loaded — it can't be restored
  // afterwards, so the update is offered instead of taken (#228).
  useEffect(() => {
    setWorkInProgress('image-to-ascii', !!(bitmap))
    return () => setWorkInProgress('image-to-ascii', false)
  }, [bitmap])

  async function onFile(f: File | undefined) {
    if (!f) return
    setErr('')
    const bmp = await decodeImage(f)
    if (!bmp) { setErr(await whyUnreadable(f, locale)); return }
    setBitmap(bmp)
  }

  const ascii = useMemo(() => {
    if (!bitmap) return ''
    const ramp = RAMPS[charset]
    const cols = Math.min(300, Math.max(20, width))
    const rows = Math.max(1, Math.round((bitmap.height / bitmap.width) * cols * 0.5))
    const c = document.createElement('canvas'); c.width = cols; c.height = rows
    const ctx = c.getContext('2d', { willReadFrequently: true })!
    ctx.drawImage(bitmap, 0, 0, cols, rows)
    const data = ctx.getImageData(0, 0, cols, rows).data
    let out = ''
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const i = (y * cols + x) * 4
        let lum = (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) / 255
        if (invert) lum = 1 - lum
        out += ramp[Math.min(ramp.length - 1, Math.floor(lum * ramp.length))]
      }
      out += '\n'
    }
    return out
  }, [bitmap, width, charset, invert])

  async function copy() { try { await navigator.clipboard.writeText(ascii); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch { /* */ } }
  const [url, setUrl] = useState('')
  useEffect(() => { if (!ascii) return; const u = URL.createObjectURL(new Blob([ascii], { type: 'text/plain' })); setUrl(u); return () => URL.revokeObjectURL(u) }, [ascii])

  return (
    <Stack data-testid="image-to-ascii">
      <FileError message={err} />
      {!bitmap ? (
        <button className="relative flex flex-col items-center gap-[0.4rem] py-8 px-4 border-2 border-dashed border-[color:var(--line)] rounded-[var(--r-md)] bg-[var(--surface)] text-center cursor-pointer hover:border-[color:color-mix(in_srgb,var(--green-500)_45%,transparent)]" data-testid="ascii-drop" onClick={() => fileRef.current?.click()}
          onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); onFile(e.dataTransfer.files[0]) }}>
          <UploadIcon /><span>{s.drop}</span>
          <input ref={fileRef} type="file" className="absolute w-px h-px opacity-0" onChange={(e) => onFile(e.target.files?.[0])} />
        </button>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Field label={`${s.width} · ${width}`}><input type="range" min={20} max={200} value={width} onChange={(e) => setWidth(+e.target.value)} data-testid="ascii-width" /></Field>
            <Field label={s.charset}>
              <div className="flex gap-1">
                {(Object.keys(RAMPS) as (keyof typeof RAMPS)[]).map((k) => (
                  <button key={k} type="button" onClick={() => setCharset(k)} data-testid={`ascii-${k}`}
                    className={`px-2 py-1.5 rounded-md border text-[0.8rem] cursor-pointer ${charset === k ? 'bg-green-600 text-sand-100 border-green-600' : 'bg-[var(--surface)] border-[color:var(--line)] text-ink-soft'}`}>{k}</button>
                ))}
              </div>
            </Field>
            <Field label=" "><Check><input type="checkbox" checked={invert} onChange={(e) => setInvert(e.target.checked)} data-testid="ascii-invert" /> {s.invert}</Check></Field>
          </div>

          <pre className="overflow-x-auto bg-[#0d0d0d] text-[#e6e6e6] rounded-md p-2 leading-[1] font-mono text-[6px] sm:text-[8px]" dir="ltr" data-testid="ascii-output">{ascii}</pre>

          <div className="flex gap-2 flex-wrap">
            <Button variant="primary" onClick={copy} data-testid="ascii-copy"><CopyIcon /> {copied ? s.copied : s.copy}</Button>
            <Button href={url} download="ascii-art.txt"><DownloadIcon /> {s.download}</Button>
            <Button onClick={() => setBitmap(null)}>{s.change}</Button>
          </div>
        </>
      )}
      <p className="text-[0.8rem] text-ink-faint flex items-center gap-[0.4rem]"><span aria-hidden="true">🔒</span> {s.privacy}</p>
    </Stack>
  )
}
