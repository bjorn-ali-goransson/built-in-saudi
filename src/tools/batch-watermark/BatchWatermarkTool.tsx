import { useEffect, useRef, useState } from 'react'
import { useLocale } from '../../i18n'
import { UploadIcon, ArchiveIcon, TrashIcon } from '../../components/icons'
import { Button, Input, Select, Stack, Spinner, FileError, Check, Panel } from '../../components/ui'
import { setWorkInProgress } from '../../lib/workInProgress'
import { decodeImage } from '../../lib/decodeImage'
import { whyUnreadable } from '../../lib/imageInput'
import { zipStore } from '../../lib/zip'
import { isArabic } from '../../lib/textImage'

type Position = 'bottom-right' | 'bottom-left' | 'bottom-center' | 'top-right' | 'top-left' | 'center' | 'tile'

const STR = {
  en: {
    pick: 'Choose images', add: 'Add more', clear: 'Remove all',
    hint: 'Watermark a whole folder at once — the same text or logo on every image, sized to each one rather than pasted on at a fixed size.',
    text: 'Watermark text', logo: 'Or a logo image', logoPick: 'Choose a logo',
    position: 'Position', size: 'Size', opacity: 'Opacity', margin: 'Margin',
    colour: 'Colour', shadow: 'Drop shadow (keeps it readable on a light photo)',
    positions: {
      'bottom-right': 'Bottom right', 'bottom-left': 'Bottom left', 'bottom-center': 'Bottom centre',
      'top-right': 'Top right', 'top-left': 'Top left', center: 'Centre', tile: 'Tiled across',
    } as Record<Position, string>,
    files: (n: number) => `${n} image${n === 1 ? '' : 's'}`,
    download: 'Download all as .zip', working: 'Working…',
    preview: 'Preview (first image)',
    relative: 'The watermark is sized as a share of each image, so a 4000px photo and a 800px one come back looking the same — not with a postage stamp on one and a banner on the other.',
    strip: 'Watermarking does not stop anyone taking the picture. It marks provenance and makes casual reuse awkward; it is not protection, and it does not remove the original file’s metadata — use the metadata remover for that.',
    empty: 'Add at least one image.',
  },
  ar: {
    pick: 'اختر صورًا', add: 'أضف المزيد', clear: 'أزل الكل',
    hint: 'ضع علامة مائية على مجلد كامل دفعة واحدة — النص أو الشعار نفسه على كل صورة، بمقاس يناسب كلًّا منها لا بحجم ثابت ملصق عليها.',
    text: 'نص العلامة', logo: 'أو صورة شعار', logoPick: 'اختر شعارًا',
    position: 'الموضع', size: 'الحجم', opacity: 'الشفافية', margin: 'الهامش',
    colour: 'اللون', shadow: 'ظل خفيف (ليبقى مقروءًا على صورة فاتحة)',
    positions: {
      'bottom-right': 'أسفل اليمين', 'bottom-left': 'أسفل اليسار', 'bottom-center': 'أسفل الوسط',
      'top-right': 'أعلى اليمين', 'top-left': 'أعلى اليسار', center: 'الوسط', tile: 'مكرّرة',
    } as Record<Position, string>,
    files: (n: number) => `${n.toLocaleString('ar')} صورة`,
    download: 'نزّل الكل كملف ‎.zip', working: 'جارٍ العمل…',
    preview: 'معاينة (أول صورة)',
    relative: 'يُحسب حجم العلامة كنسبة من كل صورة، فتعود صورة بعرض ٤٠٠٠ بكسل وأخرى بـ٨٠٠ متشابهتين — لا بطابع بريد على إحداهما ولافتة على الأخرى.',
    strip: 'العلامة المائية لا تمنع أحدًا من أخذ الصورة. هي تُثبت المصدر وتجعل إعادة الاستخدام العابر محرجًا؛ وليست حماية، ولا تزيل البيانات الوصفية من الملف الأصلي — استخدم أداة إزالة البيانات لذلك.',
    empty: 'أضف صورة واحدة على الأقل.',
  },
}

interface Item { file: File; bitmap: ImageBitmap }

export default function BatchWatermarkTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const [items, setItems] = useState<Item[]>([])
  const [logo, setLogo] = useState<ImageBitmap | null>(null)
  const [text, setText] = useState('© Built in Saudi')
  const [position, setPosition] = useState<Position>('bottom-right')
  const [size, setSize] = useState(0.05)
  const [opacity, setOpacity] = useState(0.6)
  const [margin, setMargin] = useState(0.03)
  const [colour, setColour] = useState('#ffffff')
  const [shadow, setShadow] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const logoRef = useRef<HTMLInputElement>(null)
  const previewRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => () => setWorkInProgress('batch-watermark', false), [])

  async function pick(files: FileList | null) {
    if (!files?.length) return
    setBusy(true); setError('')
    const added: Item[] = []
    for (const file of Array.from(files)) {
      try {
        const bitmap = await decodeImage(file)
        if (bitmap) added.push({ file, bitmap })
        else setError(await whyUnreadable(file, locale))
      } catch {
        setError(await whyUnreadable(file, locale))
      }
    }
    if (added.length) {
      setItems((p) => [...p, ...added])
      setWorkInProgress('batch-watermark', true)
    }
    setBusy(false)
  }

  async function pickLogo(f: File | undefined) {
    if (!f) return
    try {
      const bmp = await decodeImage(f)
      if (bmp) setLogo(bmp)
    } catch { /* ignore */ }
  }

  /** Paint the watermark onto a copy of one image. */
  function render(item: Item): HTMLCanvasElement {
    const { bitmap } = item
    const canvas = document.createElement('canvas')
    canvas.width = bitmap.width
    canvas.height = bitmap.height
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(bitmap, 0, 0)

    // Everything is a share of the SHORT edge, so portrait and landscape agree.
    const base = Math.min(canvas.width, canvas.height)
    const pad = base * margin
    ctx.globalAlpha = opacity
    if (shadow) {
      ctx.shadowColor = 'rgba(0,0,0,0.55)'
      ctx.shadowBlur = base * 0.008
      ctx.shadowOffsetY = base * 0.003
    }

    if (logo) {
      const w = base * size * 4
      const h = (logo.height / logo.width) * w
      const place = (x: number, y: number) => ctx.drawImage(logo, x, y, w, h)
      if (position === 'tile') {
        ctx.globalAlpha = opacity * 0.5
        for (let x = pad; x < canvas.width; x += w * 2) {
          for (let y = pad; y < canvas.height; y += h * 2) place(x, y)
        }
      } else {
        const [x, y] = anchor(position, canvas.width, canvas.height, w, h, pad)
        place(x, y)
      }
    } else if (text.trim()) {
      const fontPx = base * size
      ctx.font = `600 ${fontPx}px ${isArabic(text) ? '"IBM Plex Sans Arabic", ' : ''}"Hanken Grotesk", system-ui, sans-serif`
      ctx.fillStyle = colour
      ctx.textBaseline = 'top'
      ctx.direction = isArabic(text) ? 'rtl' : 'ltr'
      const m = ctx.measureText(text)
      const w = m.width
      const h = fontPx * 1.2
      if (position === 'tile') {
        ctx.globalAlpha = opacity * 0.45
        ctx.save()
        ctx.translate(canvas.width / 2, canvas.height / 2)
        ctx.rotate(-Math.PI / 6)
        for (let x = -canvas.width; x < canvas.width; x += w * 1.8) {
          for (let y = -canvas.height; y < canvas.height; y += h * 4) ctx.fillText(text, x, y)
        }
        ctx.restore()
      } else {
        const [x, y] = anchor(position, canvas.width, canvas.height, w, h, pad)
        ctx.fillText(text, x, y)
      }
    }
    return canvas
  }

  function anchor(p: Position, cw: number, ch: number, w: number, h: number, pad: number): [number, number] {
    const x = p.endsWith('right') ? cw - w - pad
      : p.endsWith('center') || p === 'center' ? (cw - w) / 2
        : pad
    const y = p.startsWith('top') ? pad
      : p === 'center' ? (ch - h) / 2
        : ch - h - pad
    return [x, y]
  }

  // Live preview of the first image, at display size.
  useEffect(() => {
    const canvas = previewRef.current
    if (!canvas || !items.length) return
    const full = render(items[0])
    const w = Math.min(520, full.width)
    canvas.width = w
    canvas.height = Math.round((w / full.width) * full.height)
    canvas.getContext('2d')!.drawImage(full, 0, 0, canvas.width, canvas.height)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, logo, text, position, size, opacity, margin, colour, shadow])

  async function download() {
    if (!items.length) return
    setBusy(true)
    try {
      const files: { name: string; bytes: Uint8Array }[] = []
      for (const item of items) {
        const canvas = render(item)
        const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.92))
        if (!blob) continue
        files.push({
          name: item.file.name.replace(/\.[^.]+$/, '') + '-watermarked.jpg',
          bytes: new Uint8Array(await blob.arrayBuffer()),
        })
      }
      const url = URL.createObjectURL(zipStore(files))
      const a = document.createElement('a')
      a.href = url; a.download = 'watermarked.zip'; a.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } finally { setBusy(false) }
  }

  return (
    <Stack data-testid="batch-watermark">
      <div className="flex flex-wrap items-center gap-2">
        {/* No accept filter — Android's picker hides files it has not indexed. */}
        <input ref={fileRef} type="file" multiple className="hidden" data-testid="bw-file" onChange={(e) => pick(e.target.files)} />
        <Button onClick={() => fileRef.current?.click()} data-testid="bw-pick">
          <UploadIcon /> {items.length ? s.add : s.pick}
        </Button>
        {items.length > 0 && (
          <>
            <span className="text-[0.9rem] font-semibold text-ink" data-testid="bw-count">{s.files(items.length)}</span>
            <Button className="px-3 py-1" onClick={() => setItems([])} data-testid="bw-clear"><TrashIcon /> {s.clear}</Button>
          </>
        )}
        {busy && <Spinner className="size-5" />}
      </div>

      {error && <FileError message={error} />}
      {!items.length && !busy && !error && <p className="text-ink-faint text-[0.95rem] rtl:font-ar">{s.hint}</p>}

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-[0.8rem] text-ink-faint flex-1 min-w-[12rem]">
          {s.text}
          <Input dir="auto" data-testid="bw-text" value={text} onChange={(e) => setText(e.target.value)} disabled={!!logo} />
        </label>
        <div className="flex flex-col gap-1">
          <span className="text-[0.8rem] text-ink-faint">{s.logo}</span>
          <div className="flex gap-1">
            <input ref={logoRef} type="file" className="hidden" data-testid="bw-logofile" onChange={(e) => pickLogo(e.target.files?.[0])} />
            <Button className="px-3 py-1" onClick={() => logoRef.current?.click()} data-testid="bw-logo">{s.logoPick}</Button>
            {logo && <Button className="px-2 py-1" onClick={() => setLogo(null)} aria-label={s.clear}><TrashIcon /></Button>}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-[0.8rem] text-ink-faint">
          {s.position}
          <Select className="min-w-[10rem]" data-testid="bw-position" value={position} onChange={(e) => setPosition(e.target.value as Position)}>
            {(Object.keys(s.positions) as Position[]).map((p) => <option key={p} value={p}>{s.positions[p]}</option>)}
          </Select>
        </label>
        <label className="flex items-center gap-2 text-[0.8rem] text-ink-faint">
          {s.size}
          <Input type="range" min={0.02} max={0.14} step={0.005} className="w-28 p-0" data-testid="bw-size"
            value={size} onChange={(e) => setSize(+e.target.value)} />
        </label>
        <label className="flex items-center gap-2 text-[0.8rem] text-ink-faint">
          {s.opacity}
          <Input type="range" min={0.1} max={1} step={0.05} className="w-28 p-0" data-testid="bw-opacity"
            value={opacity} onChange={(e) => setOpacity(+e.target.value)} />
        </label>
        <label className="flex items-center gap-2 text-[0.8rem] text-ink-faint">
          {s.margin}
          <Input type="range" min={0} max={0.1} step={0.005} className="w-24 p-0" data-testid="bw-margin"
            value={margin} onChange={(e) => setMargin(+e.target.value)} />
        </label>
        {!logo && (
          <label className="flex flex-col gap-1 text-[0.8rem] text-ink-faint">
            {s.colour}
            <Input type="color" className="w-16 h-9 p-1" data-testid="bw-colour" value={colour} onChange={(e) => setColour(e.target.value)} />
          </label>
        )}
        <Check>
          <input type="checkbox" checked={shadow} data-testid="bw-shadow" onChange={(e) => setShadow(e.target.checked)} /> {s.shadow}
        </Check>
      </div>

      {items.length > 0 && (
        <>
          <span className="font-body text-[0.68rem] uppercase tracking-[0.06em] text-ink-faint">{s.preview}</span>
          <canvas ref={previewRef} data-testid="bw-preview" className="max-w-full h-auto self-center rounded-md border border-[color:var(--line)]" />
          <Button variant="primary" className="self-start" onClick={download} disabled={busy} data-testid="bw-download">
            <ArchiveIcon /> {busy ? s.working : s.download}
          </Button>
        </>
      )}
      {!items.length && <span className="text-[0.85rem] text-ink-faint rtl:font-ar">{s.empty}</span>}

      <Panel className="flex flex-col gap-1">
        <p className="text-[0.85rem] text-ink-soft rtl:font-ar">{s.relative}</p>
        <p className="text-[0.85rem] text-ink-faint rtl:font-ar">{s.strip}</p>
      </Panel>
    </Stack>
  )
}
