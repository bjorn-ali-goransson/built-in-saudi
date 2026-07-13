import { useMemo, useState } from 'react'
import { useLocale } from '../../i18n'
import { Stack, Button, FieldLabel, Check } from '../../components/ui'
import { CopyIcon } from '../../components/icons'

const STR = {
  en: { x: 'Offset X', y: 'Offset Y', blur: 'Blur', spread: 'Spread', color: 'Colour', opacity: 'Opacity', inset: 'Inset', value: 'CSS', copy: 'Copy', copied: 'Copied!', privacy: 'Runs in your browser — nothing is uploaded.' },
  ar: { x: 'إزاحة أفقية', y: 'إزاحة رأسية', blur: 'تمويه', spread: 'انتشار', color: 'اللون', opacity: 'الشفافية', inset: 'ظل داخلي', value: 'CSS', copy: 'نسخ', copied: 'تم النسخ!', privacy: 'يعمل في متصفحك — لا يُرفع أي شيء.' },
}

const hexToRgba = (hex: string, a: number) => {
  const m = hex.replace('#', '')
  const f = m.length === 3 ? m.split('').map((c) => c + c).join('') : m
  const r = parseInt(f.slice(0, 2), 16) || 0, g = parseInt(f.slice(2, 4), 16) || 0, b = parseInt(f.slice(4, 6), 16) || 0
  return `rgba(${r}, ${g}, ${b}, ${a})`
}

export default function BoxShadowTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const [x, setX] = useState(0), [y, setY] = useState(10), [blur, setBlur] = useState(25), [spread, setSpread] = useState(-5)
  const [color, setColor] = useState('#1f3d2b'), [opacity, setOpacity] = useState(0.25), [inset, setInset] = useState(false)
  const [copied, setCopied] = useState(false)

  const css = useMemo(() => `${inset ? 'inset ' : ''}${x}px ${y}px ${blur}px ${spread}px ${hexToRgba(color, opacity)}`, [x, y, blur, spread, color, opacity, inset])
  async function copy() { try { await navigator.clipboard.writeText(`box-shadow: ${css};`); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch { /* */ } }

  const slider = (label: string, val: number, set: (n: number) => void, min: number, max: number, testid: string, step = 1) => (
    <label className="flex flex-col gap-1"><span className="text-[0.8rem] font-semibold text-ink-soft flex justify-between">{label} <span className="text-ink-faint font-mono font-normal">{val}</span></span>
      <input type="range" min={min} max={max} step={step} value={val} onChange={(e) => set(Number(e.target.value))} data-testid={testid} /></label>
  )

  return (
    <Stack data-testid="box-shadow">
      <div className="flex flex-col sm:flex-row gap-6">
        <div className="flex-1 grid gap-3">
          {slider(s.x, x, setX, -50, 50, 'bs-x')}
          {slider(s.y, y, setY, -50, 50, 'bs-y')}
          {slider(s.blur, blur, setBlur, 0, 100, 'bs-blur')}
          {slider(s.spread, spread, setSpread, -50, 50, 'bs-spread')}
          {slider(s.opacity, opacity, (n) => setOpacity(n), 0, 1, 'bs-opacity', 0.01)}
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-[0.85rem] text-ink-soft">{s.color}
              <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="w-9 h-9 rounded-md border border-[color:var(--line)] p-0.5 cursor-pointer bg-transparent" data-testid="bs-color" /></label>
            <Check><input type="checkbox" checked={inset} onChange={(e) => setInset(e.target.checked)} data-testid="bs-inset" /> {s.inset}</Check>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center bg-[color-mix(in_srgb,var(--ink)_4%,var(--surface))] rounded-lg min-h-[220px]">
          <div className="w-32 h-32 rounded-xl bg-sand-100 border border-[color:var(--line-soft)]" style={{ boxShadow: css }} data-testid="bs-preview" />
        </div>
      </div>

      <label className="flex flex-col gap-[0.4rem]"><FieldLabel>{s.value}</FieldLabel>
        <div className="flex items-center gap-2">
          <code className="flex-1 font-mono text-[0.9rem] bg-[var(--surface)] border border-[color:var(--line-soft)] rounded-md px-3 py-2 break-all" dir="ltr" data-testid="bs-output">box-shadow: {css};</code>
          <Button onClick={copy} data-testid="bs-copy"><CopyIcon /> {copied ? s.copied : s.copy}</Button>
        </div></label>
      <p className="text-[0.8rem] text-ink-faint flex items-center gap-[0.4rem]"><span aria-hidden="true">🔒</span> {s.privacy}</p>
    </Stack>
  )
}
