import { useRef, useState } from 'react'
import { useLocale } from '../../i18n'
import { UploadIcon, DownloadIcon } from '../../components/icons'
import { Button, Field, Stack, Seg, SegButton } from '../../components/ui'

type Size = 'fit' | 'a4' | 'letter'
interface Item { id: string; file: File; url: string }

const STR = {
  en: {
    drop: 'Drop images, or tap to choose (JPG/PNG)', add: 'Add more',
    size: 'Page size', fit: 'Fit to image', margin: 'Margin', pages: 'pages',
    create: 'Create PDF', creating: 'Building PDF…', download: 'Download PDF', clear: 'Clear all',
    up: 'Move up', down: 'Move down', remove: 'Remove',
    privacy: 'Built on your device — your images are never uploaded.', empty: 'Add some images to build a PDF.',
  },
  ar: {
    drop: 'أفلت الصور أو اضغط للاختيار (JPG/PNG)', add: 'إضافة المزيد',
    size: 'حجم الصفحة', fit: 'حسب الصورة', margin: 'الهامش', pages: 'صفحات',
    create: 'إنشاء PDF', creating: 'جارٍ الإنشاء…', download: 'تنزيل PDF', clear: 'مسح الكل',
    up: 'أعلى', down: 'أسفل', remove: 'إزالة',
    privacy: 'يُنشأ على جهازك — لا تُرفع صورك أبدًا.', empty: 'أضف صورًا لإنشاء PDF.',
  },
}

const PAGE: Record<'a4' | 'letter', [number, number]> = { a4: [595.28, 841.89], letter: [612, 792] }
let uid = 0

export default function ImagesToPdfTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const fileRef = useRef<HTMLInputElement>(null)
  const [items, setItems] = useState<Item[]>([])
  const [size, setSize] = useState<Size>('fit')
  const [margin, setMargin] = useState(24)
  const [busy, setBusy] = useState(false)
  const [pdf, setPdf] = useState<{ url: string; size: number } | null>(null)

  function addFiles(files: FileList | null) {
    if (!files) return
    const next = [...files].filter((f) => f.type.startsWith('image/')).map((f) => ({ id: `i${uid++}`, file: f, url: URL.createObjectURL(f) }))
    if (next.length) { setItems((cur) => [...cur, ...next]); setPdf(null) }
  }
  function move(i: number, d: -1 | 1) {
    setItems((cur) => { const a = [...cur]; const j = i + d; if (j < 0 || j >= a.length) return cur;[a[i], a[j]] = [a[j], a[i]]; return a }); setPdf(null)
  }
  function remove(id: string) { setItems((cur) => cur.filter((x) => x.id !== id)); setPdf(null) }

  async function toPngBytes(file: File): Promise<Uint8Array> {
    const bmp = await createImageBitmap(file)
    const c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height
    c.getContext('2d')!.drawImage(bmp, 0, 0)
    const blob = await new Promise<Blob | null>((r) => c.toBlob(r, 'image/png'))
    return new Uint8Array(await blob!.arrayBuffer())
  }

  async function create() {
    if (!items.length) return
    setBusy(true)
    try {
      const { PDFDocument } = await import('pdf-lib')
      const doc = await PDFDocument.create()
      for (const it of items) {
        const buf = new Uint8Array(await it.file.arrayBuffer())
        const isJpg = buf[0] === 0xff && buf[1] === 0xd8
        const isPng = buf[0] === 0x89 && buf[1] === 0x50
        const img = isJpg ? await doc.embedJpg(buf) : isPng ? await doc.embedPng(buf) : await doc.embedPng(await toPngBytes(it.file))
        if (size === 'fit') {
          const page = doc.addPage([img.width, img.height])
          page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height })
        } else {
          const [bw, bh] = PAGE[size]
          const landscape = img.width > img.height
          const pw = landscape ? bh : bw, ph = landscape ? bw : bh
          const page = doc.addPage([pw, ph])
          const maxW = pw - margin * 2, maxH = ph - margin * 2
          const scale = Math.min(maxW / img.width, maxH / img.height)
          const w = img.width * scale, h = img.height * scale
          page.drawImage(img, { x: (pw - w) / 2, y: (ph - h) / 2, width: w, height: h })
        }
      }
      const bytes = await doc.save()
      const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' })
      setPdf((prev) => { if (prev) URL.revokeObjectURL(prev.url); return { url: URL.createObjectURL(blob), size: blob.size } })
    } finally { setBusy(false) }
  }

  return (
    <Stack data-testid="images-to-pdf">
      <button className="flex flex-col items-center gap-[0.4rem] py-8 px-4 border-2 border-dashed border-[color:var(--line)] rounded-[var(--r-md)] bg-[var(--surface)] text-center cursor-pointer transition-[border-color,background] duration-150 hover:border-[color:color-mix(in_srgb,var(--green-500)_45%,transparent)] hover:bg-[color-mix(in_srgb,var(--green-400)_6%,transparent)] [&_small]:text-[color:var(--ink-faint)] [&_small]:text-[0.82rem]" data-testid="i2p-drop" onClick={() => fileRef.current?.click()}
        onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); addFiles(e.dataTransfer.files) }}>
        <UploadIcon /><span>{items.length ? s.add : s.drop}</span>
        <input ref={fileRef} type="file" accept="image/*" multiple className="absolute w-px h-px opacity-0" onChange={(e) => { addFiles(e.target.files); e.target.value = '' }} />
      </button>

      {items.length > 0 && (
        <>
          <ul className="flex flex-col gap-2" data-testid="i2p-list">
            {items.map((it, i) => (
              <li key={it.id} className="flex items-center gap-3 border border-[color:var(--line-soft)] rounded-md bg-[var(--surface)] p-2" data-testid={`i2p-item-${i}`}>
                <span className="font-mono text-ink-faint text-[0.8rem] w-6 text-center flex-none">{i + 1}</span>
                <img src={it.url} alt="" className="w-12 h-12 object-cover rounded bg-sand-100 flex-none" />
                <span className="flex-1 min-w-0 truncate text-[0.9rem]">{it.file.name}</span>
                <Button className="px-2 min-w-[2rem] justify-center" aria-label={s.up} disabled={i === 0} onClick={() => move(i, -1)}>↑</Button>
                <Button className="px-2 min-w-[2rem] justify-center" aria-label={s.down} disabled={i === items.length - 1} onClick={() => move(i, 1)}>↓</Button>
                <Button className="px-2 min-w-[2rem] justify-center" aria-label={s.remove} data-testid={`i2p-remove-${i}`} onClick={() => remove(it.id)}>✕</Button>
              </li>
            ))}
          </ul>

          <div className="flex flex-wrap gap-3 items-end">
            <Field label={s.size}>
              <Seg role="group">
                {([['fit', s.fit], ['a4', 'A4'], ['letter', 'Letter']] as [Size, string][]).map(([v, l]) => (
                  <SegButton key={v} active={size === v} data-testid={`i2p-size-${v}`} onClick={() => { setSize(v); setPdf(null) }}>{l}</SegButton>
                ))}
              </Seg>
            </Field>
            {size !== 'fit' && (
              <Field label={`${s.margin} · ${margin}pt`}>
                <input type="range" min={0} max={72} step={4} value={margin} onChange={(e) => { setMargin(+e.target.value); setPdf(null) }} /></Field>
            )}
          </div>

          <div className="flex gap-2 items-center">
            {!pdf ? (
              <Button variant="primary" data-testid="i2p-create" disabled={busy} onClick={create}>{busy ? s.creating : `${s.create} · ${items.length} ${s.pages}`}</Button>
            ) : (
              <Button variant="primary" href={pdf.url} download="images.pdf" data-testid="i2p-download"><DownloadIcon /> {s.download} · {(pdf.size / 1024).toFixed(0)} KB</Button>
            )}
            <Button onClick={() => { setItems([]); setPdf(null) }}>{s.clear}</Button>
          </div>
        </>
      )}

      <p className="text-[0.8rem] text-ink-faint flex items-center gap-[0.4rem]"><span aria-hidden="true">🔒</span> {s.privacy}</p>
    </Stack>
  )
}
