import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocale } from '../../i18n'
import { Button, Input, Select, Stack, Check } from '../../components/ui'
import { DownloadIcon } from '../../components/icons'
import { KINDS, SIZES, DEFAULTS, build, toPdf, type Kind, type Options } from './paper'

const INKS: { id: string; en: string; ar: string; rgb: [number, number, number] }[] = [
  { id: 'sage', en: 'Soft green', ar: 'أخضر هادئ', rgb: [0.55, 0.66, 0.6] },
  { id: 'grey', en: 'Grey', ar: 'رمادي', rgb: [0.62, 0.62, 0.62] },
  { id: 'blue', en: 'Blue', ar: 'أزرق', rgb: [0.55, 0.66, 0.82] },
  { id: 'sand', en: 'Sand', ar: 'رملي', rgb: [0.78, 0.7, 0.55] },
  { id: 'black', en: 'Black', ar: 'أسود', rgb: [0.15, 0.15, 0.15] },
]

const STR = {
  en: {
    kind: 'Paper', size: 'Page size', landscape: 'Landscape',
    spacing: 'Spacing (mm)', margin: 'Margin (mm)', ink: 'Ink', pages: 'Pages',
    rtl: 'Right-to-left layout',
    download: 'Download PDF', working: 'Building…',
    preview: 'Preview',
    why: 'It downloads as a PDF, not an image, so the spacing you asked for is the spacing that prints. A PNG is at the mercy of whatever your print dialog decides to scale it by.',
    arabicNote: 'The Arabic guide has four lines per row: the baseline letters sit on, the x-height, the ascender, and a deep descender well — the spacing is not symmetrical the way Latin practice paper is.',
  },
  ar: {
    kind: 'الورق', size: 'مقاس الصفحة', landscape: 'أفقي',
    spacing: 'التباعد (مم)', margin: 'الهامش (مم)', ink: 'اللون', pages: 'الصفحات',
    rtl: 'تخطيط من اليمين لليسار',
    download: 'نزّل PDF', working: 'جارٍ التجهيز…',
    preview: 'معاينة',
    why: 'يُنزَّل بصيغة PDF لا صورة، فالتباعد الذي طلبته هو ما يُطبع فعلًا. أما صورة PNG فتخضع لما يقرّره مربع الطباعة من تحجيم.',
    arabicNote: 'يضم مسطّر العربية أربعة خطوط لكل سطر: خط الأساس الذي تجلس عليه الحروف، وارتفاع الحرف، والصاعد، وبئر نازل عميق — والتباعد ليس متماثلًا كما في مسطّر اللاتينية.',
  },
}

export default function PaperGeneratorTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const [kind, setKind] = useState<Kind>('graph')
  const [sizeId, setSizeId] = useState('a4')
  const [landscape, setLandscape] = useState(false)
  const [spacing, setSpacing] = useState(5)
  const [margin, setMargin] = useState(10)
  const [inkId, setInkId] = useState('sage')
  const [pages, setPages] = useState(1)
  const [rtl, setRtl] = useState(locale === 'ar')
  const [busy, setBusy] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const options: Options = useMemo(() => ({
    ...DEFAULTS, kind, landscape, spacing, margin, pages, rtl,
    size: SIZES.find((x) => x.id === sizeId) ?? SIZES[0],
    ink: INKS.find((x) => x.id === inkId)?.rgb ?? DEFAULTS.ink,
  }), [kind, sizeId, landscape, spacing, margin, inkId, pages, rtl])

  // The preview draws the same geometry the PDF does, so they cannot disagree.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const d = build(options)
    const cssW = Math.min(canvas.parentElement?.clientWidth ?? 360, 420)
    const scale = cssW / d.width
    const cssH = d.height * scale
    const dpr = window.devicePixelRatio || 1
    canvas.width = Math.round(cssW * dpr)
    canvas.height = Math.round(cssH * dpr)
    canvas.style.width = `${cssW}px`
    canvas.style.height = `${cssH}px`
    const ctx = canvas.getContext('2d')!
    ctx.setTransform(dpr * scale, 0, 0, -dpr * scale, 0, dpr * cssH) // flip: PDF origin is bottom-left
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, d.width, d.height)
    const [r, g, b] = options.ink
    const css = `rgb(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)})`
    for (const l of d.lines) {
      ctx.globalAlpha = l.alpha ?? 1
      ctx.strokeStyle = css
      ctx.lineWidth = l.width ?? options.lineWidth
      ctx.beginPath(); ctx.moveTo(l.x1, l.y1); ctx.lineTo(l.x2, l.y2); ctx.stroke()
    }
    ctx.globalAlpha = 1
    ctx.fillStyle = css
    for (const dot of d.dots) { ctx.beginPath(); ctx.arc(dot.x, dot.y, dot.r, 0, Math.PI * 2); ctx.fill() }
  }, [options])

  async function download() {
    setBusy(true)
    try {
      const blob = await toPdf(options)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = `${kind}-${sizeId}.pdf`; a.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } finally { setBusy(false) }
  }

  const hasSpacing = kind !== 'blank' && kind !== 'cornell'

  return (
    <Stack data-testid="paper-generator">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-[0.8rem] text-ink-faint">
          {s.kind}
          <Select className="min-w-[14rem]" data-testid="pg-kind" value={kind} onChange={(e) => setKind(e.target.value as Kind)}>
            {KINDS.map((k) => <option key={k.id} value={k.id}>{locale === 'ar' ? k.ar : k.en}</option>)}
          </Select>
        </label>
        <label className="flex flex-col gap-1 text-[0.8rem] text-ink-faint">
          {s.size}
          <Select className="w-28" data-testid="pg-size" value={sizeId} onChange={(e) => setSizeId(e.target.value)}>
            {SIZES.map((x) => <option key={x.id} value={x.id}>{locale === 'ar' ? x.ar : x.en}</option>)}
          </Select>
        </label>
        <label className="flex flex-col gap-1 text-[0.8rem] text-ink-faint">
          {s.ink}
          <Select className="w-32" data-testid="pg-ink" value={inkId} onChange={(e) => setInkId(e.target.value)}>
            {INKS.map((x) => <option key={x.id} value={x.id}>{locale === 'ar' ? x.ar : x.en}</option>)}
          </Select>
        </label>
        <label className="flex flex-col gap-1 text-[0.8rem] text-ink-faint">
          {s.pages}
          <Input type="number" min={1} max={50} dir="ltr" className="w-20 font-mono" data-testid="pg-pages"
            value={pages} onChange={(e) => setPages(Math.max(1, Math.min(50, +e.target.value || 1)))} />
        </label>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        {hasSpacing && (
          <label className="flex items-center gap-2 text-[0.8rem] text-ink-faint">
            {s.spacing}
            <Input type="range" min={2} max={20} step={0.5} className="w-32 p-0" data-testid="pg-spacing"
              value={spacing} onChange={(e) => setSpacing(+e.target.value)} />
            <span className="font-mono text-ink w-8">{spacing}</span>
          </label>
        )}
        <label className="flex items-center gap-2 text-[0.8rem] text-ink-faint">
          {s.margin}
          <Input type="range" min={0} max={30} step={1} className="w-28 p-0" data-testid="pg-margin"
            value={margin} onChange={(e) => setMargin(+e.target.value)} />
          <span className="font-mono text-ink w-8">{margin}</span>
        </label>
        <Check>
          <input type="checkbox" checked={landscape} data-testid="pg-landscape" onChange={(e) => setLandscape(e.target.checked)} /> {s.landscape}
        </Check>
        {(kind === 'cornell' || kind === 'arabic') && (
          <Check>
            <input type="checkbox" checked={rtl} data-testid="pg-rtl" onChange={(e) => setRtl(e.target.checked)} /> {s.rtl}
          </Check>
        )}
      </div>

      {kind === 'arabic' && <p className="text-[0.85rem] text-ink-faint rtl:font-ar">{s.arabicNote}</p>}

      <div className="flex flex-col items-center gap-2">
        <span className="font-body text-[0.68rem] uppercase tracking-[0.06em] text-ink-faint self-start">{s.preview}</span>
        <div className="w-full flex justify-center">
          <canvas ref={canvasRef} data-testid="pg-preview" className="border border-[color:var(--line)] rounded-md shadow-[var(--shadow-sm)]" />
        </div>
      </div>

      <Button variant="primary" className="self-start" onClick={download} disabled={busy} data-testid="pg-download">
        <DownloadIcon /> {busy ? s.working : s.download}
      </Button>
      <p className="text-[0.85rem] text-ink-faint rtl:font-ar">{s.why}</p>
    </Stack>
  )
}
