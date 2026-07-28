import { useEffect, useRef, useState } from 'react'
import { useLocale } from '../../i18n'
import { UploadIcon, DownloadIcon } from '../../components/icons'
import { Button, Stack, Field, Input , FileError } from '../../components/ui'
import { whyUnreadable } from '../../lib/imageInput'

const STR = {
  en: { drop: 'Drop an image, or tap to choose', top: 'Top text', bottom: 'Bottom text', size: 'Font size', download: 'Download PNG', change: 'Choose another image', privacy: 'Drawn on your device — the image is never uploaded.' },
  ar: { drop: 'أفلت صورة أو اضغط للاختيار', top: 'النص العلوي', bottom: 'النص السفلي', size: 'حجم الخط', download: 'تنزيل PNG', change: 'اختر صورة أخرى', privacy: 'تُرسم على جهازك — لا تُرفع الصورة أبدًا.' },
}

function drawText(ctx: CanvasRenderingContext2D, text: string, cx: number, y: number, maxW: number, size: number, baseline: 'top' | 'bottom') {
  ctx.font = `900 ${size}px Impact, 'Arial Black', sans-serif`
  ctx.textAlign = 'center'; ctx.textBaseline = baseline
  ctx.lineWidth = Math.max(2, size / 12); ctx.strokeStyle = '#000'; ctx.fillStyle = '#fff'
  ctx.lineJoin = 'round'
  // naive word wrap
  const words = text.toUpperCase().split(/\s+/).filter(Boolean)
  const lines: string[] = []; let line = ''
  for (const w of words) { const test = line ? `${line} ${w}` : w; if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = w } else line = test }
  if (line) lines.push(line)
  const lineH = size * 1.05
  lines.forEach((ln, i) => {
    const yy = baseline === 'top' ? y + i * lineH : y - (lines.length - 1 - i) * lineH
    ctx.strokeText(ln, cx, yy); ctx.fillText(ln, cx, yy)
  })
}

export default function MemeGeneratorTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const fileRef = useRef<HTMLInputElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [bitmap, setBitmap] = useState<ImageBitmap | null>(null)
  const [err, setErr] = useState('')
  const [top, setTop] = useState('')
  const [bottom, setBottom] = useState('')
  const [size, setSize] = useState(48)

  async function onFile(f: File | undefined) {
    if (!f) return
    setErr('')
    try { const bmp = await createImageBitmap(f); setBitmap(bmp); setSize(Math.round(bmp.width / 10)) } catch { setErr(await whyUnreadable(f, locale)) }
  }

  useEffect(() => {
    const c = canvasRef.current; if (!c || !bitmap) return
    c.width = bitmap.width; c.height = bitmap.height
    const ctx = c.getContext('2d')!
    ctx.drawImage(bitmap, 0, 0)
    const pad = bitmap.height * 0.04
    if (top) drawText(ctx, top, c.width / 2, pad, c.width * 0.92, size, 'top')
    if (bottom) drawText(ctx, bottom, c.width / 2, c.height - pad, c.width * 0.92, size, 'bottom')
  }, [bitmap, top, bottom, size])

  function download() {
    const c = canvasRef.current; if (!c) return
    c.toBlob((b) => { if (!b) return; const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'meme.png'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000) }, 'image/png')
  }

  return (
    <Stack data-testid="meme-generator">
      <FileError message={err} />
      {!bitmap ? (
        <button className="relative flex flex-col items-center gap-[0.4rem] py-8 px-4 border-2 border-dashed border-[color:var(--line)] rounded-[var(--r-md)] bg-[var(--surface)] text-center cursor-pointer hover:border-[color:color-mix(in_srgb,var(--green-500)_45%,transparent)]" data-testid="meme-drop" onClick={() => fileRef.current?.click()}
          onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); onFile(e.dataTransfer.files[0]) }}>
          <UploadIcon /><span>{s.drop}</span>
          <input ref={fileRef} type="file" className="absolute w-px h-px opacity-0" onChange={(e) => onFile(e.target.files?.[0])} />
        </button>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label={s.top}><Input value={top} onChange={(e) => setTop(e.target.value)} data-testid="meme-top" /></Field>
            <Field label={s.bottom}><Input value={bottom} onChange={(e) => setBottom(e.target.value)} data-testid="meme-bottom" /></Field>
          </div>
          <Field label={`${s.size} · ${size}px`}><input type="range" min={12} max={140} value={size} onChange={(e) => setSize(+e.target.value)} data-testid="meme-size" /></Field>
          <canvas ref={canvasRef} className="max-w-full h-auto rounded-md border border-[color:var(--line-soft)] mx-auto" data-testid="meme-canvas" />
          <div className="flex gap-2">
            <Button variant="primary" onClick={download} data-testid="meme-download"><DownloadIcon /> {s.download}</Button>
            <Button onClick={() => setBitmap(null)}>{s.change}</Button>
          </div>
        </>
      )}
      <p className="text-[0.8rem] text-ink-faint flex items-center gap-[0.4rem]"><span aria-hidden="true">🔒</span> {s.privacy}</p>
    </Stack>
  )
}
