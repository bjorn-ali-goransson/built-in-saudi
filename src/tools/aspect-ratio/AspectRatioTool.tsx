import { useState } from 'react'
import { useLocale } from '../../i18n'
import { Stack, Panel, Input, FieldLabel } from '../../components/ui'

const STR = {
  en: { ratio: 'Ratio', width: 'Width', height: 'Height', presets: 'Presets', simplified: 'Simplified ratio', privacy: 'Computed in your browser — nothing is uploaded.' },
  ar: { ratio: 'النسبة', width: 'العرض', height: 'الارتفاع', presets: 'قوالب', simplified: 'النسبة المبسّطة', privacy: 'يُحسب في متصفحك — لا يُرفع أي شيء.' },
}

const PRESETS: [number, number][] = [[16, 9], [4, 3], [3, 2], [1, 1], [21, 9], [9, 16], [2, 3]]
const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a)

export default function AspectRatioTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const [rw, setRw] = useState(16), [rh, setRh] = useState(9)
  const [w, setW] = useState(1920), [h, setH] = useState(1080)

  const applyRatio = (nrw: number, nrh: number) => { setRw(nrw); setRh(nrh); if (w > 0) setH(Math.round((w * nrh) / nrw)) }
  const onW = (val: number) => { setW(val); if (rw > 0) setH(Math.round((val * rh) / rw)) }
  const onH = (val: number) => { setH(val); if (rh > 0) setW(Math.round((val * rw) / rh)) }
  const onRw = (val: number) => { setRw(val); if (val > 0) setH(Math.round((w * rh) / val)) }
  const onRh = (val: number) => { setRh(val); if (rw > 0) setH(Math.round((w * val) / rw)) }

  const g = gcd(Math.round(w) || 1, Math.round(h) || 1) || 1
  const simplified = `${Math.round(w / g)} : ${Math.round(h / g)}`

  return (
    <Stack data-testid="aspect-ratio">
      <div>
        <FieldLabel>{s.presets}</FieldLabel>
        <div className="flex flex-wrap gap-2 mt-1">
          {PRESETS.map(([a, b]) => (
            <button key={`${a}:${b}`} type="button" onClick={() => applyRatio(a, b)} data-testid={`ar-preset-${a}x${b}`}
              className={`px-3 py-1 rounded-md border text-[0.85rem] font-mono cursor-pointer ${rw === a && rh === b ? 'bg-green-600 text-sand-100 border-green-600' : 'bg-[var(--surface)] border-[color:var(--line)] text-ink-soft'}`}>{a}:{b}</button>
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-[0.4rem]"><FieldLabel>{s.ratio}</FieldLabel>
          <div className="flex items-center gap-2">
            <Input type="number" min={1} value={rw} onChange={(e) => onRw(Math.max(1, Number(e.target.value) || 1))} className="font-mono text-center" data-testid="ar-rw" />
            <span className="text-ink-faint">:</span>
            <Input type="number" min={1} value={rh} onChange={(e) => onRh(Math.max(1, Number(e.target.value) || 1))} className="font-mono text-center" data-testid="ar-rh" />
          </div></label>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-[0.4rem]"><FieldLabel>{s.width}</FieldLabel>
          <Input type="number" min={0} value={w} onChange={(e) => onW(Math.max(0, Number(e.target.value) || 0))} className="font-mono" data-testid="ar-width" /></label>
        <label className="flex flex-col gap-[0.4rem]"><FieldLabel>{s.height}</FieldLabel>
          <Input type="number" min={0} value={h} onChange={(e) => onH(Math.max(0, Number(e.target.value) || 0))} className="font-mono" data-testid="ar-height" /></label>
      </div>

      <Panel className="items-center text-center">
        <div className="mx-auto bg-[color-mix(in_srgb,var(--color-green-400)_22%,transparent)] border border-green-600 rounded-sm" style={{ width: 220, height: Math.max(20, Math.min(220, (220 * (Math.round(h) || 1)) / (Math.round(w) || 1))) }} aria-hidden="true" />
        <div className="flex items-center justify-center gap-2"><span className="text-ink-soft text-[0.9rem]">{s.simplified}:</span>
          <span className="inline-flex items-center px-[0.8rem] py-[0.32rem] rounded-full border border-[color-mix(in_srgb,var(--color-green-500)_30%,transparent)] bg-[color-mix(in_srgb,var(--color-green-500)_12%,transparent)] text-green-700 text-[0.85rem] font-mono" data-testid="ar-simplified">{simplified}</span></div>
      </Panel>
      <p className="text-[0.8rem] text-ink-faint flex items-center gap-[0.4rem]"><span aria-hidden="true">🔒</span> {s.privacy}</p>
    </Stack>
  )
}
