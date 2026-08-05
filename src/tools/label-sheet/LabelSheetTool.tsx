import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocale } from '../../i18n'
import { DownloadIcon } from '../../components/icons'
import { Button, Input, Select, Textarea, Stack, Seg, SegButton, Check, Panel } from '../../components/ui'
import { STOCKS, perSheet, labelRect, buildLabels, type Stock } from './labels'

const STR = {
  en: {
    stock: 'Label sheet', entries: 'One label per line', placeholder: 'Ahmed Al-Otaibi\n1234 King Fahd Road\nRiyadh 12345',
    mode: 'What to print', list: 'A list', repeat: 'The same label, repeated',
    startAt: 'Start at label', startHint: 'Already used part of a sheet? Set where the first blank label is and the used ones are skipped.',
    size: 'Text size', align: 'Align', alignStart: 'Start', alignCenter: 'Centre',
    outline: 'Show label outlines (do not print these)',
    count: (n: number) => `${n} label${n === 1 ? '' : 's'}`,
    sheets: (n: number) => `${n} sheet${n === 1 ? '' : 's'}`,
    download: 'Download PDF', working: 'Building…',
    preview: 'Sheet layout',
    measured: 'Measurements are the published ones for each stock. Print at 100% — “fit to page” shrinks everything by a few millimetres and the last column misses its labels.',
    empty: 'Type at least one label.',
  },
  ar: {
    stock: 'ورق الملصقات', entries: 'ملصق في كل سطر', placeholder: 'أحمد العتيبي\n١٢٣٤ طريق الملك فهد\nالرياض ١٢٣٤٥',
    mode: 'ماذا تطبع', list: 'قائمة', repeat: 'الملصق نفسه مكرّرًا',
    startAt: 'ابدأ من الملصق رقم', startHint: 'استخدمت جزءًا من الورقة؟ حدّد موضع أول ملصق فارغ وستُتخطّى المستخدمة.',
    size: 'حجم النص', align: 'المحاذاة', alignStart: 'البداية', alignCenter: 'الوسط',
    outline: 'أظهر حدود الملصقات (لا تطبعها)',
    count: (n: number) => `${n.toLocaleString('ar')} ملصقًا`,
    sheets: (n: number) => `${n.toLocaleString('ar')} ورقة`,
    download: 'نزّل PDF', working: 'جارٍ التجهيز…',
    preview: 'تخطيط الورقة',
    measured: 'المقاسات هي المنشورة لكل نوع ورق. اطبع بمقياس ١٠٠٪ — فخيار «ملاءمة الصفحة» يصغّر كل شيء بضعة مليمترات فتفوت الأعمدة الأخيرة ملصقاتها.',
    empty: 'اكتب ملصقًا واحدًا على الأقل.',
  },
}

export default function LabelSheetTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const [stockId, setStockId] = useState(STOCKS[0].id)
  const [raw, setRaw] = useState('')
  const [repeat, setRepeat] = useState(false)
  const [startAt, setStartAt] = useState(1)
  const [fontSize, setFontSize] = useState(11)
  const [align, setAlign] = useState<'start' | 'center'>('start')
  const [outline, setOutline] = useState(true)
  const [busy, setBusy] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const stock = STOCKS.find((x) => x.id === stockId) ?? STOCKS[0]
  const per = perSheet(stock)
  const entries = useMemo(() => raw.split('\n').map((l) => l.trim()).filter(Boolean), [raw])
  const count = repeat ? per - (startAt - 1) : entries.length
  const sheets = Math.max(1, Math.ceil(((startAt - 1) + count) / per))

  // A to-scale plan of the sheet: which slots are skipped, which get printed.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const scale = 260 / stock.page[0]
    const w = stock.page[0] * scale
    const h = stock.page[1] * scale
    const dpr = window.devicePixelRatio || 1
    canvas.width = w * dpr; canvas.height = h * dpr
    canvas.style.width = `${w}px`; canvas.style.height = `${h}px`
    const ctx = canvas.getContext('2d')!
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h)
    ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.strokeRect(0.5, 0.5, w - 1, h - 1)
    const mmToPt = 72 / 25.4
    for (let i = 0; i < per; i++) {
      const r = labelRect(stock, i)
      // labelRect is in points from the bottom; flip for a top-down canvas.
      const x = (r.x / mmToPt) * scale
      const y = h - ((r.y / mmToPt) * scale) - ((r.h / mmToPt) * scale)
      const rw = (r.w / mmToPt) * scale
      const rh = (r.h / mmToPt) * scale
      const used = i < startAt - 1
      const filled = !used && (i - (startAt - 1)) < count
      ctx.fillStyle = used ? 'rgba(0,0,0,0.07)' : filled ? 'rgba(31,92,61,0.18)' : 'transparent'
      if (ctx.fillStyle !== 'transparent') ctx.fillRect(x, y, rw, rh)
      ctx.strokeStyle = 'rgba(0,0,0,0.25)'
      ctx.strokeRect(x, y, rw, rh)
    }
  }, [stock, per, startAt, count])

  async function download() {
    if (!entries.length) return
    setBusy(true)
    try {
      const blob = await buildLabels(entries, { stock, startAt, fontSize, align, repeat, outline })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = `labels-${stock.id}.pdf`; a.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } finally { setBusy(false) }
  }

  return (
    <Stack data-testid="label-sheet">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-[0.8rem] text-ink-faint">
          {s.stock}
          <Select className="min-w-[18rem]" data-testid="ls-stock" value={stockId} onChange={(e) => setStockId(e.target.value)}>
            {STOCKS.map((x: Stock) => <option key={x.id} value={x.id}>{locale === 'ar' ? x.ar : x.en}</option>)}
          </Select>
        </label>
        <div className="flex flex-col gap-1">
          <span className="text-[0.8rem] text-ink-faint">{s.mode}</span>
          <Seg>
            <SegButton active={!repeat} data-testid="ls-mode-list" onClick={() => setRepeat(false)}>{s.list}</SegButton>
            <SegButton active={repeat} data-testid="ls-mode-repeat" onClick={() => setRepeat(true)}>{s.repeat}</SegButton>
          </Seg>
        </div>
      </div>

      <div className="flex flex-col min-[760px]:flex-row gap-5">
        <div className="flex flex-col gap-2 flex-1">
          <label className="text-[0.8rem] text-ink-faint">{s.entries}</label>
          <Textarea className="min-h-[11rem]" dir="auto" data-testid="ls-entries"
            placeholder={s.placeholder} value={raw} onChange={(e) => setRaw(e.target.value)} />
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-[0.8rem] text-ink-faint">
              {s.startAt}
              <Input type="number" min={1} max={per} dir="ltr" className="w-20 font-mono" data-testid="ls-startat"
                value={startAt} onChange={(e) => setStartAt(Math.max(1, Math.min(per, +e.target.value || 1)))} />
            </label>
            <label className="flex items-center gap-2 text-[0.8rem] text-ink-faint">
              {s.size}
              <Input type="range" min={7} max={20} step={1} className="w-24 p-0" data-testid="ls-size"
                value={fontSize} onChange={(e) => setFontSize(+e.target.value)} />
            </label>
            <label className="flex flex-col gap-1 text-[0.8rem] text-ink-faint">
              {s.align}
              <Select className="w-28" data-testid="ls-align" value={align} onChange={(e) => setAlign(e.target.value as 'start' | 'center')}>
                <option value="start">{s.alignStart}</option>
                <option value="center">{s.alignCenter}</option>
              </Select>
            </label>
          </div>
          <span className="text-[0.82rem] text-ink-faint rtl:font-ar">{s.startHint}</span>
          <Check>
            <input type="checkbox" checked={outline} data-testid="ls-outline" onChange={(e) => setOutline(e.target.checked)} /> {s.outline}
          </Check>
        </div>

        <div className="flex flex-col items-center gap-2">
          <span className="font-body text-[0.68rem] uppercase tracking-[0.06em] text-ink-faint self-start">{s.preview}</span>
          <canvas ref={canvasRef} data-testid="ls-preview" className="border border-[color:var(--line)] rounded-sm shadow-[var(--shadow-sm)]" />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <span className="text-[0.9rem] font-semibold text-ink" data-testid="ls-count">{s.count(count)}</span>
        <span className="text-[0.9rem] text-ink-faint" data-testid="ls-sheets">{s.sheets(sheets)}</span>
        <Button variant="primary" onClick={download} disabled={!entries.length || busy} data-testid="ls-download">
          <DownloadIcon /> {busy ? s.working : s.download}
        </Button>
        {!entries.length && <span className="text-[0.85rem] text-ink-faint rtl:font-ar">{s.empty}</span>}
      </div>

      <Panel><p className="text-[0.85rem] text-ink-soft rtl:font-ar">{s.measured}</p></Panel>
    </Stack>
  )
}
