import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocale } from '../../i18n'
import { UploadIcon } from '../../components/icons'
import { Button, Stack, Panel, Field, Seg, SegButton, FileError, Spinner } from '../../components/ui'
import { setWorkInProgress } from '../../lib/workInProgress'
import { decodeImage } from '../../lib/decodeImage'
import { whyUnreadable } from '../../lib/imageInput'
import { diffImages, DEFAULT_TOLERANCE, type DiffResult } from './diff'

const WIP = 'image-diff'
type View = 'diff' | 'side' | 'slider'

const STR = {
  en: {
    pickA: 'Before', pickB: 'After', choose: 'Choose an image',
    intro: 'Compare two images pixel by pixel and see exactly what moved. Both are read on your device — nothing is uploaded, which is the difference from every site that wants the screenshots first.',
    view: 'View', diff: 'Differences', side: 'Side by side', slider: 'Slider',
    tolerance: 'Ignore differences smaller than',
    toleranceWhy: 'Two screenshots of the same page on different machines disagree on thousands of pixels by one or two levels — different font rasterisers, different GPU. At zero tolerance every glyph edge lights up and the real change is invisible in the noise. Raise this until the noise goes and the change stays.',
    changed: 'Pixels changed', of: 'of', identical: 'The overlapping pixels are identical at this tolerance.',
    mismatch: 'These images are not the same size',
    mismatchBody: (w: number, h: number, a: number, b: number) =>
      `Only the overlapping ${w} × ${h} is compared, so the percentage means something. ${a.toLocaleString('en')} pixels of the first and ${b.toLocaleString('en')} of the second are outside it and are not counted — scaling one to fit the other would report a difference on every pixel, which is true and useless.`,
    working: 'Comparing…',
    needTwo: 'Choose both images to compare them.',
  },
  ar: {
    pickA: 'قبل', pickB: 'بعد', choose: 'اختر صورة',
    intro: 'قارن صورتين بكسلًا بكسل وشاهد ما تغيّر بالضبط. تُقرأ الصورتان على جهازك — ولا يُرفع شيء، وهذا هو الفرق عن كل موقع يطلب اللقطات أولًا.',
    view: 'العرض', diff: 'الفروق', side: 'جنبًا إلى جنب', slider: 'شريط',
    tolerance: 'تجاهل الفروق الأصغر من',
    toleranceWhy: 'لقطتان للصفحة نفسها من جهازين تختلفان في آلاف البكسلات بدرجة أو درجتين — لاختلاف مُصيِّر الخطوط وكرت الشاشة. وعند التسامح صفرًا تضيء حواف كل حرف فيختفي التغيير الحقيقي في الضجيج. ارفع هذا حتى يزول الضجيج ويبقى التغيير.',
    changed: 'بكسلات متغيّرة', of: 'من', identical: 'البكسلات المشتركة متطابقة عند هذا التسامح.',
    mismatch: 'الصورتان ليستا بالمقاس نفسه',
    mismatchBody: (w: number, h: number, a: number, b: number) =>
      `تُقارَن المنطقة المشتركة ${w} × ${h} فقط ليكون للنسبة معنى. و${a.toLocaleString('ar')} بكسل من الأولى و${b.toLocaleString('ar')} من الثانية خارجها ولا تُحتسب — فتحجيم إحداهما لتطابق الأخرى يبلّغ عن فرق في كل بكسل، وهذا صحيح وعديم الفائدة.`,
    working: 'جارٍ المقارنة…',
    needTwo: 'اختر الصورتين لمقارنتهما.',
  },
}

async function toImageData(file: File): Promise<ImageData> {
  // decodeImage returns null for anything no decoder can open (including the
  // HEIC fallback failing), and the caller turns that into whyUnreadable.
  const bmp = await decodeImage(file)
  if (!bmp) throw new Error('undecodable')
  const c = document.createElement('canvas')
  c.width = bmp.width
  c.height = bmp.height
  const ctx = c.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('no 2d context')
  ctx.drawImage(bmp, 0, 0)
  return ctx.getImageData(0, 0, c.width, c.height)
}

export default function ImageDiffTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const [a, setA] = useState<{ data: ImageData; url: string } | null>(null)
  const [b, setB] = useState<{ data: ImageData; url: string } | null>(null)
  const [tolerance, setTolerance] = useState(DEFAULT_TOLERANCE)
  const [view, setView] = useState<View>('diff')
  const [slider, setSlider] = useState(50)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const aRef = useRef<HTMLInputElement>(null)
  const bRef = useRef<HTMLInputElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => () => { setWorkInProgress(WIP, false) }, [])

  async function pick(which: 'a' | 'b', f: File | undefined) {
    if (!f) return
    setError(''); setBusy(true)
    try {
      // Verified at pick time, not later in the comparison — otherwise the
      // failure surfaces far from its cause (#225/#226).
      const data = await toImageData(f)
      const entry = { data, url: URL.createObjectURL(f) }
      if (which === 'a') setA(entry); else setB(entry)
      setWorkInProgress(WIP, true)
    } catch {
      setError(await whyUnreadable(f, locale))
    } finally { setBusy(false) }
  }

  const result: DiffResult | null = useMemo(
    () => (a && b ? diffImages(a.data, b.data, tolerance) : null),
    [a, b, tolerance],
  )

  useEffect(() => {
    const c = canvasRef.current
    if (!c || !result || view !== 'diff') return
    c.width = result.width
    c.height = result.height
    const ctx = c.getContext('2d')
    if (!ctx) return
    ctx.putImageData(result.mask, 0, 0)
  }, [result, view])

  const pct = result ? (result.ratio * 100) : 0

  return (
    <Stack data-testid="image-diff">
      <p className="text-[0.95rem] text-ink-soft rtl:font-ar">{s.intro}</p>

      <div className="grid gap-3 grid-cols-1 min-[620px]:grid-cols-2">
        {(['a', 'b'] as const).map((which) => (
          <Field key={which} label={which === 'a' ? s.pickA : s.pickB}>
            {/* No accept filter — Android's picker hides files it has not indexed. */}
            <input
              ref={which === 'a' ? aRef : bRef}
              type="file"
              className="hidden"
              data-testid={`idf-file-${which}`}
              onChange={(e) => void pick(which, e.target.files?.[0])}
            />
            <Button onClick={() => (which === 'a' ? aRef : bRef).current?.click()} data-testid={`idf-pick-${which}`}>
              <UploadIcon /> {s.choose}
            </Button>
          </Field>
        ))}
      </div>

      {busy && <div className="flex items-center gap-2"><Spinner className="size-5" /><span className="text-[0.9rem] text-ink-faint rtl:font-ar">{s.working}</span></div>}
      {error && <FileError message={error} />}
      {!result && !error && <p className="text-[0.9rem] text-ink-faint rtl:font-ar" data-testid="idf-need-two">{s.needTwo}</p>}

      {result && (
        <>
          {result.mismatched && (
            <Panel className="gap-1 border-gold-500" data-testid="idf-mismatch">
              <p className="font-display text-[1.1rem] text-gold-500 rtl:font-ar">{s.mismatch}</p>
              <p className="text-[0.9rem] text-ink-soft rtl:font-ar">
                {s.mismatchBody(result.width, result.height, result.outsideA, result.outsideB)}
              </p>
            </Panel>
          )}

          <Panel className="gap-2">
            <div className="flex flex-wrap gap-x-8 gap-y-2">
              <div>
                <div className="text-[0.7rem] uppercase tracking-[0.05em] text-ink-faint">{s.changed}</div>
                <div className="font-mono text-[1.5rem] font-semibold text-green-700" data-testid="idf-pct">{pct.toFixed(2)}%</div>
              </div>
              <div>
                <div className="text-[0.7rem] uppercase tracking-[0.05em] text-ink-faint">&nbsp;</div>
                <div className="font-mono text-[1.05rem] text-ink" data-testid="idf-counts">
                  {result.changed.toLocaleString(locale === 'ar' ? 'ar-SA' : 'en-US')} {s.of} {result.compared.toLocaleString(locale === 'ar' ? 'ar-SA' : 'en-US')}
                </div>
              </div>
            </div>
            {result.changed === 0 && <p className="text-[0.9rem] text-green-700 rtl:font-ar" data-testid="idf-identical">{s.identical}</p>}
          </Panel>

          <Field label={`${s.tolerance} ${(tolerance * 100).toFixed(0)}%`}>
            <input
              type="range"
              min={0}
              max={30}
              step={1}
              value={Math.round(tolerance * 100)}
              data-testid="idf-tolerance"
              className="w-full accent-green-600"
              onChange={(e) => setTolerance(Number(e.target.value) / 100)}
            />
          </Field>
          <Panel><p className="text-[0.85rem] text-ink-soft rtl:font-ar" data-testid="idf-tolerance-why">{s.toleranceWhy}</p></Panel>

          <Field label={s.view}>
            <Seg data-testid="idf-view">
              <SegButton active={view === 'diff'} onClick={() => setView('diff')} data-testid="idf-view-diff">{s.diff}</SegButton>
              <SegButton active={view === 'side'} onClick={() => setView('side')} data-testid="idf-view-side">{s.side}</SegButton>
              <SegButton active={view === 'slider'} onClick={() => setView('slider')} data-testid="idf-view-slider">{s.slider}</SegButton>
            </Seg>
          </Field>

          {view === 'diff' && (
            <canvas ref={canvasRef} className="max-w-full border border-[color:var(--line)] rounded-md bg-[var(--surface)]" data-testid="idf-canvas" />
          )}
          {view === 'side' && a && b && (
            <div className="grid gap-2 grid-cols-2" data-testid="idf-side">
              <img src={a.url} alt="" className="max-w-full border border-[color:var(--line)] rounded-md" />
              <img src={b.url} alt="" className="max-w-full border border-[color:var(--line)] rounded-md" />
            </div>
          )}
          {view === 'slider' && a && b && (
            <div className="flex flex-col gap-2" data-testid="idf-slider">
              <div className="relative max-w-full overflow-hidden border border-[color:var(--line)] rounded-md">
                <img src={a.url} alt="" className="block max-w-full" />
                <div className="absolute inset-0 overflow-hidden" style={{ width: `${slider}%` }}>
                  <img src={b.url} alt="" className="block max-w-none" style={{ width: `${(100 / slider) * 100}%` }} />
                </div>
              </div>
              <input
                type="range" min={0} max={100} value={slider}
                data-testid="idf-slider-pos" className="w-full accent-green-600"
                onChange={(e) => setSlider(Number(e.target.value))}
              />
            </div>
          )}
        </>
      )}
    </Stack>
  )
}
