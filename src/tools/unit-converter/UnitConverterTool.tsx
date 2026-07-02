import { useMemo, useState } from 'react'
import { useLocale } from '../../i18n'
import { RefreshIcon, CopyIcon } from '../../components/icons'

// Ratio categories: factor = base units per 1 of this unit. Temperature is
// handled separately (offsets, not ratios).
interface Unit { id: string; label: string; factor: number }
interface Cat { id: string; en: string; ar: string; units: Unit[] }

const CATS: Cat[] = [
  { id: 'length', en: 'Length', ar: 'الطول', units: [
    { id: 'm', label: 'm', factor: 1 }, { id: 'km', label: 'km', factor: 1000 }, { id: 'cm', label: 'cm', factor: 0.01 },
    { id: 'mm', label: 'mm', factor: 0.001 }, { id: 'mi', label: 'mile', factor: 1609.344 }, { id: 'yd', label: 'yard', factor: 0.9144 },
    { id: 'ft', label: 'ft', factor: 0.3048 }, { id: 'in', label: 'inch', factor: 0.0254 }, { id: 'nmi', label: 'nautical mi', factor: 1852 },
  ] },
  { id: 'mass', en: 'Mass', ar: 'الكتلة', units: [
    { id: 'kg', label: 'kg', factor: 1 }, { id: 'g', label: 'g', factor: 0.001 }, { id: 'mg', label: 'mg', factor: 1e-6 },
    { id: 't', label: 'tonne', factor: 1000 }, { id: 'lb', label: 'lb', factor: 0.45359237 }, { id: 'oz', label: 'oz', factor: 0.028349523125 },
    { id: 'st', label: 'stone', factor: 6.35029318 },
  ] },
  { id: 'temperature', en: 'Temperature', ar: 'الحرارة', units: [
    { id: 'C', label: '°C', factor: 0 }, { id: 'F', label: '°F', factor: 0 }, { id: 'K', label: 'K', factor: 0 },
  ] },
  { id: 'data', en: 'Data', ar: 'البيانات', units: [
    { id: 'B', label: 'B', factor: 1 }, { id: 'KB', label: 'KB', factor: 1e3 }, { id: 'MB', label: 'MB', factor: 1e6 },
    { id: 'GB', label: 'GB', factor: 1e9 }, { id: 'TB', label: 'TB', factor: 1e12 },
    { id: 'KiB', label: 'KiB', factor: 1024 }, { id: 'MiB', label: 'MiB', factor: 1048576 }, { id: 'GiB', label: 'GiB', factor: 1073741824 },
    { id: 'bit', label: 'bit', factor: 0.125 },
  ] },
  { id: 'area', en: 'Area', ar: 'المساحة', units: [
    { id: 'm2', label: 'm²', factor: 1 }, { id: 'km2', label: 'km²', factor: 1e6 }, { id: 'cm2', label: 'cm²', factor: 1e-4 },
    { id: 'ha', label: 'hectare', factor: 10000 }, { id: 'ft2', label: 'ft²', factor: 0.09290304 }, { id: 'ac', label: 'acre', factor: 4046.8564224 },
    { id: 'mi2', label: 'mi²', factor: 2589988.110336 },
  ] },
  { id: 'volume', en: 'Volume', ar: 'الحجم', units: [
    { id: 'L', label: 'L', factor: 1 }, { id: 'mL', label: 'mL', factor: 0.001 }, { id: 'm3', label: 'm³', factor: 1000 },
    { id: 'galUS', label: 'gal (US)', factor: 3.785411784 }, { id: 'galUK', label: 'gal (UK)', factor: 4.54609 },
    { id: 'qt', label: 'quart', factor: 0.946352946 }, { id: 'cup', label: 'cup', factor: 0.2365882365 }, { id: 'floz', label: 'fl oz', factor: 0.0295735295625 },
  ] },
  { id: 'speed', en: 'Speed', ar: 'السرعة', units: [
    { id: 'mps', label: 'm/s', factor: 1 }, { id: 'kmh', label: 'km/h', factor: 1 / 3.6 }, { id: 'mph', label: 'mph', factor: 0.44704 },
    { id: 'kn', label: 'knot', factor: 0.5144444444 }, { id: 'fps', label: 'ft/s', factor: 0.3048 },
  ] },
  { id: 'time', en: 'Time', ar: 'الزمن', units: [
    { id: 's', label: 'sec', factor: 1 }, { id: 'ms', label: 'ms', factor: 0.001 }, { id: 'min', label: 'min', factor: 60 },
    { id: 'h', label: 'hour', factor: 3600 }, { id: 'd', label: 'day', factor: 86400 }, { id: 'wk', label: 'week', factor: 604800 },
  ] },
]

const toC: Record<string, (v: number) => number> = { C: (v) => v, F: (v) => (v - 32) * 5 / 9, K: (v) => v - 273.15 }
const fromC: Record<string, (v: number) => number> = { C: (v) => v, F: (v) => v * 9 / 5 + 32, K: (v) => v + 273.15 }

function convert(cat: Cat, from: string, to: string, v: number): number {
  if (cat.id === 'temperature') return fromC[to](toC[from](v))
  const f = cat.units.find((u) => u.id === from)!.factor
  const t = cat.units.find((u) => u.id === to)!.factor
  return (v * f) / t
}

const fmt = (n: number) => {
  if (!isFinite(n)) return '—'
  const r = Number(n.toPrecision(8))
  return r.toLocaleString(undefined, { maximumFractionDigits: 8 })
}

const STR = {
  en: { value: 'Value', from: 'From', to: 'To', swap: 'Swap', copy: 'Copy', copied: 'Copied!' },
  ar: { value: 'القيمة', from: 'من', to: 'إلى', swap: 'تبديل', copy: 'نسخ', copied: 'تم النسخ!' },
}

export default function UnitConverterTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const [catId, setCatId] = useState('length')
  const cat = useMemo(() => CATS.find((c) => c.id === catId)!, [catId])
  const [from, setFrom] = useState('m')
  const [to, setTo] = useState('ft')
  const [value, setValue] = useState('1')
  const [copied, setCopied] = useState(false)

  function pickCat(id: string) {
    const c = CATS.find((x) => x.id === id)!
    setCatId(id); setFrom(c.units[0].id); setTo(c.units[1].id)
  }

  const result = useMemo(() => {
    const v = parseFloat(value)
    if (isNaN(v)) return ''
    return fmt(convert(cat, from, to, v))
  }, [cat, from, to, value])

  async function copy() {
    if (!result) return
    try { await navigator.clipboard.writeText(result); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch { /* ignore */ }
  }

  return (
    <div className="stack" data-testid="unit-converter">
      <label className="field">
        <span className="field__label">{locale === 'ar' ? 'الفئة' : 'Category'}</span>
        <select className="input" value={catId} data-testid="unit-category" onChange={(e) => pickCat(e.target.value)}>
          {CATS.map((c) => <option key={c.id} value={c.id}>{locale === 'ar' ? c.ar : c.en}</option>)}
        </select>
      </label>

      <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] gap-3 items-end">
        <label className="field">
          <span className="field__label">{s.from}</span>
          <input className="input font-mono" type="number" inputMode="decimal" value={value} data-testid="unit-value" onChange={(e) => setValue(e.target.value)} />
          <select className="input mt-2" value={from} data-testid="unit-from" onChange={(e) => setFrom(e.target.value)}>
            {cat.units.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}
          </select>
        </label>

        <button className="btn self-center sm:mb-[0.1rem] px-3" data-testid="unit-swap" aria-label={s.swap} title={s.swap}
          onClick={() => { setFrom(to); setTo(from) }}><RefreshIcon /></button>

        <label className="field">
          <span className="field__label">{s.to}</span>
          <div className="input font-mono flex items-center justify-between gap-2" data-testid="unit-result">
            <span className="break-all">{result || '—'}</span>
          </div>
          <select className="input mt-2" value={to} data-testid="unit-to" onChange={(e) => setTo(e.target.value)}>
            {cat.units.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}
          </select>
        </label>
      </div>

      <button className="btn self-start" onClick={copy}><CopyIcon /> {copied ? s.copied : s.copy}</button>
    </div>
  )
}
