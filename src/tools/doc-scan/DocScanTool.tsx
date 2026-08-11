import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocale, localePath } from '../../i18n'
import { Stack, Panel, Field, FileError } from '../../components/ui'
import { decodeImage } from '../../lib/decodeImage'
import { whyUnreadable } from '../../lib/imageInput'
import type { Point } from '../../lib/homography'
import type { ScanReq, ScanRes } from './scan.worker'

const STR = {
  en: {
    intro: 'Turn a photo of a page into something that looks scanned — straightened, cleaned up, and a fraction of the size. It never leaves your browser.',
    pick: 'Photograph or choose a page',
    corners: 'Drag the corners onto the page, or select one and nudge it with the arrow keys',
    clean: 'Clean-up', none: 'off', full: 'full',
    working: 'Straightening…',
    download: 'Download the page',
    before: 'Photo', after: 'Scan', smaller: (n: number) => `${n.toFixed(0)}% smaller`,
    bigger: 'larger than the photo',
    degenerate: 'Those four corners do not make a shape — move them apart.',
    sizeTitle: 'A photo of a page is not a big scan, it is a photograph',
    sizeBody: 'The reason a phone photo of a document is several megabytes is not detail: it is that the paper is not white. Under room light it lands somewhere around mid-grey with a gradient across it and a shadow down one side, and a photographic codec has to store every bit of that. Make the paper white and the ink black and the same page compresses to a fraction — and becomes far easier for OCR, which is looking for letter shapes rather than lighting.',
    perspTitle: 'Straightening a page is not cropping',
    perspBody: 'A camera is never square to the paper, so the page arrives as a quadrilateral: the far edge is shorter than the near one. Cropping cannot fix that, and neither can rotating. It needs a projective transform, which is the only one that can map an arbitrary four-sided shape onto a rectangle — that is what the corners here are for.',
    manualTitle: 'You place the corners, and that is deliberate',
    manualBody: 'Automatic edge detection is what makes a scanner app feel magic and what makes it fail silently on a patterned tablecloth, a dark desk or a page with a photograph on it. Four handles you can see and nudge cannot be wrong without you seeing it.',
    next: 'Several pages into one file: Images to PDF',
    ocr: 'Get the text out: Image to Text (OCR)',
  },
  ar: {
    intro: 'حوّل صورة صفحة إلى ما يشبه المسح الضوئي — معدّلة الميل، منظّفة، وبجزء يسير من الحجم. ولا تغادر متصفحك.',
    pick: 'صوّر صفحة أو اخترها',
    corners: 'اسحب الزوايا إلى أطراف الصفحة، أو حدّد زاوية وحرّكها بمفاتيح الأسهم',
    clean: 'التنظيف', none: 'بدون', full: 'كامل',
    working: 'جارٍ التعديل…',
    download: 'نزّل الصفحة',
    before: 'الصورة', after: 'المسح', smaller: (n: number) => `أصغر بنسبة ${n.toFixed(0)}٪`,
    bigger: 'أكبر من الصورة',
    degenerate: 'هذه الزوايا الأربع لا تكوّن شكلًا — باعد بينها.',
    sizeTitle: 'صورة الصفحة ليست مسحًا كبيرًا، بل صورة فوتوغرافية',
    sizeBody: 'سبب كِبَر صورة المستند بالهاتف ليس التفاصيل، بل أن الورق ليس أبيض. فتحت ضوء الغرفة يقع قريبًا من الرمادي المتوسط بتدرّج عبره وظلّ على أحد جوانبه، وعلى المُرمِّز الفوتوغرافي أن يخزّن ذلك كله. اجعل الورق أبيض والحبر أسود فتنضغط الصفحة نفسها إلى جزء يسير — وتصير أيسر بكثير على التعرّف الضوئي، فهو يبحث عن أشكال الحروف لا عن الإضاءة.',
    perspTitle: 'تعديل ميل الصفحة ليس قصًّا',
    perspBody: 'الكاميرا لا تكون عمودية على الورق أبدًا، فتصل الصفحة رباعيًا: حافتها البعيدة أقصر من القريبة. والقصّ لا يصلح ذلك، ولا التدوير. بل يحتاج تحويلًا إسقاطيًا، وهو الوحيد القادر على مطابقة شكل رباعي أيًّا كان على مستطيل — ولهذا وُجدت الزوايا هنا.',
    manualTitle: 'أنت من يضع الزوايا، وهذا مقصود',
    manualBody: 'الكشف التلقائي للحواف هو ما يجعل تطبيق المسح يبدو سحريًا، وهو ما يجعله يفشل صامتًا على مفرش مزخرف أو مكتب داكن أو صفحة فيها صورة. أما أربع مقابض تراها وتحرّكها فلا يمكن أن تخطئ دون أن ترى.',
    next: 'عدة صفحات في ملف واحد: صور إلى PDF',
    ocr: 'استخرج النص: صورة إلى نص',
  },
}

const CORNER_KEYS = ['tl', 'tr', 'br', 'bl'] as const

export default function DocScanTool() {
  const { locale } = useLocale()
  const l = locale === 'ar' ? 'ar' : 'en'
  const s = STR[l]

  const [bitmap, setBitmap] = useState<ImageBitmap | null>(null)
  const [srcSize, setSrcSize] = useState(0)
  const [corners, setCorners] = useState<Point[]>([])
  const [clean, setClean] = useState(1)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [out, setOut] = useState<{ url: string; bytes: number } | null>(null)
  const [active, setActive] = useState(0)

  const workerRef = useRef<Worker | null>(null)
  const reqRef = useRef(0)
  const boxRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const w = new Worker(new URL('./scan.worker.ts', import.meta.url), { type: 'module' })
    workerRef.current = w
    return () => { w.terminate() }
  }, [])

  async function onPick(f: File | undefined) {
    if (!f) return
    setError(''); setOut(null)
    try {
      const bm = await decodeImage(f)
      // `decodeImage` returns null rather than throwing when nothing can read
      // the bytes, so a bare try/catch would leave the UI silently dead — the
      // failure this repo documents for image intake (#225).
      if (!bm) { setError(await whyUnreadable(f, l)); return }
      setBitmap(bm)
      setSrcSize(f.size)
      // Inset by a tenth: a page photographed on a desk almost never fills the
      // frame, and starting at the very edge means every corner must be moved.
      const ix = bm.width * 0.1
      const iy = bm.height * 0.1
      setCorners([
        { x: ix, y: iy }, { x: bm.width - ix, y: iy },
        { x: bm.width - ix, y: bm.height - iy }, { x: ix, y: bm.height - iy },
      ])
    } catch {
      setError(await whyUnreadable(f, l))
    }
  }

  useEffect(() => {
    const w = workerRef.current
    if (!w || !bitmap || corners.length !== 4) return
    const id = ++reqRef.current
    setBusy(true)
    const onMsg = (ev: MessageEvent<ScanRes>) => {
      if (ev.data.id !== reqRef.current) return
      w.removeEventListener('message', onMsg)
      setBusy(false)
      if (ev.data.error) { setError(s.degenerate); return }
      if (ev.data.blob) {
        setError('')
        setOut({ url: URL.createObjectURL(ev.data.blob), bytes: ev.data.blob.size })
      }
    }
    w.addEventListener('message', onMsg)
    const t = window.setTimeout(() => {
      const req: ScanReq = { id, bitmap, corners, clean }
      w.postMessage(req)
    }, 120)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bitmap, corners, clean])

  const saved = out && srcSize ? (1 - out.bytes / srcSize) * 100 : 0
  const nf = useMemo(() => new Intl.NumberFormat(l === 'ar' ? 'ar-SA' : 'en-GB'), [l])

  function nudge(i: number, dx: number, dy: number) {
    if (!bitmap) return
    setCorners((c) => c.map((p, j) => j === i
      ? { x: Math.max(0, Math.min(bitmap.width, p.x + dx)), y: Math.max(0, Math.min(bitmap.height, p.y + dy)) }
      : p))
  }

  return (
    <Stack data-testid="doc-scan">
      <p className="text-ink-faint">{s.intro}</p>

      <Field label={s.pick}>
        <input type="file" onChange={(e) => onPick(e.target.files?.[0])} data-testid="ds-file" />
      </Field>

      {error ? <FileError message={error} /> : null}

      {bitmap ? (
        <>
          <p className="text-ink-faint text-sm" data-testid="ds-corner-help">{s.corners}</p>
          <div ref={boxRef} className="relative inline-block max-w-full" data-testid="ds-stage">
            <div className="relative border border-line rounded-md overflow-hidden"
              style={{ width: 320, height: Math.round(320 * (bitmap.height / bitmap.width)) }}>
              {CORNER_KEYS.map((k, i) => {
                const p = corners[i]
                if (!p) return null
                const left = (p.x / bitmap.width) * 320
                const top = (p.y / bitmap.height) * Math.round(320 * (bitmap.height / bitmap.width))
                return (
                  <button
                    key={k} type="button" data-testid={`ds-corner-${k}`}
                    aria-label={k} onFocus={() => setActive(i)}
                    onKeyDown={(e) => {
                      const step = e.shiftKey ? 40 : 8
                      if (e.key === 'ArrowLeft') { nudge(i, -step, 0); e.preventDefault() }
                      if (e.key === 'ArrowRight') { nudge(i, step, 0); e.preventDefault() }
                      if (e.key === 'ArrowUp') { nudge(i, 0, -step); e.preventDefault() }
                      if (e.key === 'ArrowDown') { nudge(i, 0, step); e.preventDefault() }
                    }}
                    className={`absolute w-5 h-5 -ms-2.5 -mt-2.5 rounded-full border-2 bg-paper cursor-move ${active === i ? 'border-green-600' : 'border-gold-500'}`}
                    style={{ left, top }}
                  />
                )
              })}
            </div>
          </div>

          <Field label={`${s.clean}: ${clean === 0 ? s.none : clean === 1 ? s.full : clean.toFixed(1)}`}>
            <input type="range" min={0} max={10} value={clean * 10} data-testid="ds-clean"
              onChange={(e) => setClean(Number(e.target.value) / 10)} className="w-full max-w-xs" />
          </Field>

          {busy ? <p data-testid="ds-busy">{s.working}</p> : null}

          {out ? (
            <Panel>
              <img src={out.url} alt="" className="max-w-full rounded-md border border-line"
                style={{ maxHeight: 420 }} data-testid="ds-preview" />
              <p data-testid="ds-size">
                {nf.format(Math.round(srcSize / 1024))} KB → {nf.format(Math.round(out.bytes / 1024))} KB
                {' · '}
                {saved > 0 ? s.smaller(saved) : s.bigger}
              </p>
              <a href={out.url} download="scan.jpg" data-testid="ds-download"
                className="inline-flex items-center gap-2 rounded-md border border-green-600 bg-green-600 text-paper px-4 py-2 no-underline w-fit">
                {s.download}
              </a>
            </Panel>
          ) : null}
        </>
      ) : null}

      <Panel>
        <h3 className="font-display text-lg">{s.sizeTitle}</h3>
        <p className="text-ink-faint text-sm" data-testid="ds-size-why">{s.sizeBody}</p>
      </Panel>

      <Panel>
        <h3 className="font-display text-lg">{s.perspTitle}</h3>
        <p className="text-ink-faint text-sm" data-testid="ds-persp">{s.perspBody}</p>
      </Panel>

      <Panel>
        <h3 className="font-display text-lg">{s.manualTitle}</h3>
        <p className="text-ink-faint text-sm" data-testid="ds-manual">{s.manualBody}</p>
      </Panel>

      <p className="text-sm flex flex-wrap gap-4">
        <a href={localePath(locale, '/apps/images-to-pdf')}>{s.next}</a>
        <a href={localePath(locale, '/apps/image-to-text')}>{s.ocr}</a>
      </p>
    </Stack>
  )
}
