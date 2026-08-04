import { useEffect, useRef, useState } from 'react'
import { useLocale } from '../../i18n'
import { UploadIcon, DownloadIcon, LockIcon } from '../../components/icons'
import { zipStore } from '../../lib/zip'
import { setWorkInProgress } from '../../lib/workInProgress'
import { Button, Field, Input, Select, Stack, Seg, SegButton, Spinner } from '../../components/ui'

// pdf.js is heavy, so it loads only once a PDF is actually picked. Note we do
// NOT wrap this in a Web Worker of our own: pdf.js already runs its parsing and
// display-list work in its own worker, so what remains on this thread is the
// canvas paint plus the browser's own (off-thread) image encode — the
// GPU/drawImage case CLAUDE.md exempts. Nesting a worker would only add a
// second hop and the Safari nested-worker risk.
type Pdfjs = typeof import('pdfjs-dist')
let pdfjsPromise: Promise<Pdfjs> | null = null
async function loadPdfjs(): Promise<Pdfjs> {
  pdfjsPromise ??= (async () => {
    const pdfjs = await import('pdfjs-dist')
    const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl
    return pdfjs
  })()
  return pdfjsPromise
}

// Same reasoning as cv-generator/extract.ts: we always hand pdf.js the whole
// buffer, and its streaming paths lean on `for await (… of ReadableStream)`,
// which some iOS/in-app WebViews don't support.
const PDF_OPTS = { disableStream: true, disableAutoFetch: true } as const

const FORMATS = { png: 'image/png', jpeg: 'image/jpeg', webp: 'image/webp' } as const
type Format = keyof typeof FORMATS
const EXT: Record<Format, string> = { png: 'png', jpeg: 'jpg', webp: 'webp' }
// PDF user-space is 72dpi, so scale = dpi / 72.
const DPIS = [72, 150, 300, 600] as const

const STR = {
  en: {
    drop: 'Drop a PDF, or tap to choose', another: 'Choose another', pages: 'pages', page: 'Page',
    locked: 'This PDF is locked or encrypted, so its pages can’t be read.',
    notPdf: 'That doesn’t look like a PDF.', failed: 'Couldn’t render this PDF.',
    format: 'Format', quality: 'Quality', dpi: 'Resolution', rangeLabel: 'Pages (e.g. 1-3, 5, 8-10 — blank for all)',
    rangeBad: 'Enter a valid range like 1-3,5.',
    convert: 'Convert', converting: 'Converting', dlAll: 'Download all (ZIP)', download: 'Download',
    dlEach: 'Download each', dlEachHint: 'Your browser may ask to allow multiple downloads.',
    screen: 'screen', print: 'print', high: 'high', huge: 'very high',
    privacy: 'Rendered on your device — your PDF is never uploaded.',
    big: 'At this resolution a long PDF can use a lot of memory. Try fewer pages if it stalls.',
    tapPage: 'Tap a page to save it on its own.',
  },
  ar: {
    drop: 'أفلت ملف PDF أو اضغط للاختيار', another: 'اختر آخر', pages: 'صفحة', page: 'صفحة',
    locked: 'هذا الملف مقفل أو مشفّر، لذا لا يمكن قراءة صفحاته.',
    notPdf: 'لا يبدو هذا ملف PDF.', failed: 'تعذّر تحويل هذا الملف.',
    format: 'الصيغة', quality: 'الجودة', dpi: 'الدقة', rangeLabel: 'الصفحات (مثل 1-3، 5 — اتركه فارغًا للكل)',
    rangeBad: 'أدخل نطاقًا صحيحًا مثل 1-3،5.',
    convert: 'تحويل', converting: 'جارٍ التحويل', dlAll: 'تنزيل الكل (ZIP)', download: 'تنزيل',
    dlEach: 'تنزيل كل صفحة', dlEachHint: 'قد يطلب المتصفح السماح بتنزيلات متعددة.',
    screen: 'شاشة', print: 'طباعة', high: 'عالية', huge: 'عالية جدًا',
    privacy: 'يُعالَج على جهازك — لا يُرفع ملفك أبدًا.',
    big: 'عند هذه الدقة قد يستهلك ملف طويل ذاكرة كبيرة. جرّب صفحات أقل إذا تعثّر.',
    tapPage: 'اضغط على صفحة لحفظها منفردة.',
  },
}

/** "1-3, 5" → [1,3,5]; empty means every page; null means the input is malformed. */
function parseRange(str: string, max: number): number[] | null {
  if (!str.trim()) return Array.from({ length: max }, (_, i) => i + 1)
  const set = new Set<number>()
  for (const raw of str.split(/[,،]/)) {
    const p = raw.trim()
    if (!p) continue
    const m = p.match(/^(\d+)\s*-\s*(\d+)$/)
    if (m) {
      let a = +m[1], b = +m[2]
      if (a > b) [a, b] = [b, a]
      for (let i = a; i <= b; i++) if (i >= 1 && i <= max) set.add(i)
    } else if (/^\d+$/.test(p)) {
      const i = +p
      if (i >= 1 && i <= max) set.add(i)
    } else return null
  }
  return [...set].sort((a, b) => a - b)
}

type Out = { name: string; url: string; page: number; bytes: Uint8Array }

export default function PdfToImagesTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const fileRef = useRef<HTMLInputElement>(null)
  const [src, setSrc] = useState<{ name: string; file: File; pages: number } | null>(null)
  const [format, setFormat] = useState<Format>('png')
  const [quality, setQuality] = useState(92)
  const [dpi, setDpi] = useState<number>(150)
  const [range, setRange] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(0)
  const [outs, setOuts] = useState<Out[]>([])
  const [zipUrl, setZipUrl] = useState('')
  // Bumped on every new file/convert so an in-flight render abandons quietly.
  const runRef = useRef(0)

  // Holding a decoded PDF and its rendered pages is work in progress — a deploy
  // must offer the update rather than reload over it (#228).
  useEffect(() => {
    setWorkInProgress('pdf-to-images', !!src)
    return () => setWorkInProgress('pdf-to-images', false)
  }, [src])

  useEffect(() => () => { runRef.current++ }, [])

  function clearOuts() {
    setOuts((prev) => { prev.forEach((o) => URL.revokeObjectURL(o.url)); return [] })
    setZipUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return '' })
    setDone(0)
  }

  async function onFile(f: File | undefined) {
    if (!f) return
    setErr(''); clearOuts()
    if (!/\.pdf$/i.test(f.name) && f.type !== 'application/pdf') { setSrc(null); setErr(s.notPdf); return }
    const run = ++runRef.current
    try {
      const pdfjs = await loadPdfjs()
      // Keep the loading task: PDFDocumentProxy has no destroy(), the task does.
      const task = pdfjs.getDocument({ data: await f.arrayBuffer(), ...PDF_OPTS })
      const doc = await task.promise
      if (run !== runRef.current) return
      setSrc({ name: f.name.replace(/\.pdf$/i, ''), file: f, pages: doc.numPages })
      await task.destroy()
    } catch {
      if (run !== runRef.current) return
      setSrc(null); setErr(s.locked)
    }
  }

  async function convert() {
    if (!src || busy) return
    const wanted = parseRange(range, src.pages)
    if (!wanted || !wanted.length) { setErr(s.rangeBad); return }
    setErr(''); clearOuts(); setBusy(true)
    const run = ++runRef.current
    const made: Out[] = []
    try {
      const pdfjs = await loadPdfjs()
      const task = pdfjs.getDocument({ data: await src.file.arrayBuffer(), ...PDF_OPTS })
      const doc = await task.promise
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('no 2d context')
      const type = FORMATS[format]
      const q = format === 'png' ? undefined : quality / 100

      for (const n of wanted) {
        if (run !== runRef.current) return
        const page = await doc.getPage(n)
        const viewport = page.getViewport({ scale: dpi / 72 })
        canvas.width = Math.max(1, Math.ceil(viewport.width))
        canvas.height = Math.max(1, Math.ceil(viewport.height))
        // A transparent PNG of a PDF page reads as a blank image in most
        // viewers, and JPEG has no alpha at all — paint the page white first.
        ctx.setTransform(1, 0, 0, 1, 0, 0)
        ctx.fillStyle = '#fff'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        await page.render({ canvas, canvasContext: ctx, viewport }).promise
        page.cleanup()

        const blob: Blob | null = await new Promise((res) => canvas.toBlob(res, type, q))
        if (!blob) continue
        const name = `${src.name}-p${String(n).padStart(String(src.pages).length, '0')}.${EXT[format]}`
        made.push({ name, page: n, url: URL.createObjectURL(blob), bytes: new Uint8Array(await blob.arrayBuffer()) })
        if (run !== runRef.current) return
        setDone(made.length)
        setOuts([...made])
      }
      await task.destroy()
      if (run !== runRef.current) return
      setZipUrl(URL.createObjectURL(zipStore(made.map((m) => ({ name: m.name, bytes: m.bytes })))))
    } catch {
      if (run === runRef.current) setErr(s.failed)
    } finally {
      if (run === runRef.current) setBusy(false)
    }
  }

  // "Download each" — one file per page, no archive. Browsers rate-limit
  // programmatic downloads and Chrome prompts once for "multiple automatic
  // downloads", so they go out spaced rather than in a burst (a burst gets
  // silently dropped after the first few).
  async function downloadEach() {
    for (const o of outs) {
      const a = document.createElement('a')
      a.href = o.url
      a.download = o.name
      document.body.appendChild(a)
      a.click()
      a.remove()
      await new Promise((r) => setTimeout(r, 250))
    }
  }

  const total = parseRange(range, src?.pages ?? 0)?.length ?? 0

  return (
    <Stack data-testid="pdf-to-images">
      {!src ? (
        <button className="flex flex-col items-center gap-[0.4rem] py-8 px-4 border-2 border-dashed border-[color:var(--line)] rounded-[var(--r-md)] bg-[var(--surface)] text-center cursor-pointer transition-[border-color,background] duration-150 hover:border-[color:color-mix(in_srgb,var(--green-500)_45%,transparent)] hover:bg-[color-mix(in_srgb,var(--green-400)_6%,transparent)] [&_small]:text-[color:var(--ink-faint)] [&_small]:text-[0.82rem]" data-testid="p2i-drop" onClick={() => fileRef.current?.click()}
          onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); onFile(e.dataTransfer.files[0]) }}>
          <UploadIcon /><span>{s.drop}</span>
          <input ref={fileRef} type="file" accept="application/pdf" className="absolute w-px h-px opacity-0" onChange={(e) => onFile(e.target.files?.[0])} />
        </button>
      ) : (
        <>
          <p className="text-ink-soft" data-testid="p2i-count"><span className="font-semibold">{src.name}</span> · {src.pages} {s.pages}</p>

          <Seg className="self-start" role="group">
            {(Object.keys(FORMATS) as Format[]).map((f) => (
              <SegButton key={f} active={format === f} data-testid={`p2i-format-${f}`}
                onClick={() => { setFormat(f); clearOuts() }}>{f.toUpperCase()}</SegButton>
            ))}
          </Seg>

          <div className="flex flex-wrap gap-3 items-end">
            <Field label={s.dpi} className="w-[11rem]">
              <Select data-testid="p2i-dpi" value={dpi} onChange={(e) => { setDpi(+e.target.value); clearOuts() }}>
                {DPIS.map((d) => (
                  <option key={d} value={d}>{d} DPI · {d === 72 ? s.screen : d === 150 ? s.print : d === 300 ? s.high : s.huge}</option>
                ))}
              </Select>
            </Field>
            {format !== 'png' && (
              <Field label={`${s.quality} · ${quality}%`} className="w-[11rem]">
                <Input type="range" min={40} max={100} step={1} value={quality} data-testid="p2i-quality"
                  onChange={(e) => { setQuality(+e.target.value); clearOuts() }} />
              </Field>
            )}
            <Field label={s.rangeLabel} className="min-w-[15rem] flex-1">
              <Input className="font-mono" data-testid="p2i-range" placeholder="1-3, 5"
                value={range} onChange={(e) => { setRange(e.target.value); setErr(''); clearOuts() }} />
            </Field>
          </div>

          <div className="flex gap-2 items-center flex-wrap">
            <Button variant="primary" data-testid="p2i-convert" disabled={busy} onClick={convert}>
              {busy ? <><Spinner className="size-4" /> {s.converting} {done}/{total}</> : `${s.convert}${total ? ` · ${total} ${s.pages}` : ''}`}
            </Button>
            {outs.length > 0 && !busy && (
              <Button data-testid="p2i-each" onClick={downloadEach}><DownloadIcon /> {s.dlEach} · {outs.length}</Button>
            )}
            {zipUrl && (
              <Button href={zipUrl} download={`${src.name}-images.zip`} data-testid="p2i-zip"><DownloadIcon /> {s.dlAll}</Button>
            )}
            <Button onClick={() => { runRef.current++; setSrc(null); clearOuts(); setErr(''); setBusy(false) }}>{s.another}</Button>
          </div>

          {outs.length > 0 && !busy && <p className="text-[0.8rem] text-ink-faint">{s.tapPage} {s.dlEachHint}</p>}
          {dpi >= 300 && src.pages > 20 && <p className="text-[0.8rem] text-ink-faint">{s.big}</p>}

          {outs.length > 0 && (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(9rem,1fr))] gap-3" data-testid="p2i-results">
              {outs.map((o) => (
                <a key={o.page} href={o.url} download={o.name} data-testid={`p2i-page-${o.page}`}
                  className="group flex flex-col gap-1 no-underline border border-[color:var(--line-soft)] rounded-[var(--r-md)] bg-[var(--surface)] p-2 transition-[border-color] hover:border-[color:var(--green-500)]">
                  <img src={o.url} alt={`${s.page} ${o.page}`} loading="lazy"
                    className="w-full h-auto bg-white rounded-[var(--r-sm)] border border-[color:var(--line-soft)]" />
                  <span className="text-[0.8rem] text-ink-faint flex items-center gap-1 justify-center">
                    <DownloadIcon className="w-3.5 h-3.5" /> {s.page} {o.page}
                  </span>
                </a>
              ))}
            </div>
          )}
        </>
      )}

      {err && <p className="text-[color:var(--danger)] text-[0.9rem]" data-testid="p2i-error">{err}</p>}
      <p className="text-[0.8rem] text-ink-faint flex items-center gap-[0.4rem]"><LockIcon className="w-3.5 h-3.5 flex-none" /> {s.privacy}</p>
    </Stack>
  )
}
