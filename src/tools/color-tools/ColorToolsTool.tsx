import { useMemo, useState } from 'react'
import { useLocale } from '../../i18n'

function hexToRgb(hex: string) {
  const h = hex.replace('#', '')
  const n = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  const int = parseInt(n, 16)
  return { r: (int >> 16) & 255, g: (int >> 8) & 255, b: int & 255 }
}
const rgbToHex = (r: number, g: number, b: number) => '#' + [r, g, b].map((x) => Math.round(x).toString(16).padStart(2, '0')).join('')
function rgbToHsl(r: number, g: number, b: number) {
  r /= 255; g /= 255; b /= 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  let h = 0, s = 0; const l = (max + min) / 2
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4
    h /= 6
  }
  return { h: h * 360, s: s * 100, l: l * 100 }
}
function hslToHex(h: number, s: number, l: number) {
  h = ((h % 360) + 360) % 360; h /= 360; s /= 100; l /= 100
  const hue = (p: number, q: number, t: number) => {
    if (t < 0) t += 1; if (t > 1) t -= 1
    if (t < 1 / 6) return p + (q - p) * 6 * t
    if (t < 1 / 2) return q
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
    return p
  }
  let r = l, g = l, b = l
  if (s) { const q = l < 0.5 ? l * (1 + s) : l + s - l * s; const p = 2 * l - q; r = hue(p, q, h + 1 / 3); g = hue(p, q, h); b = hue(p, q, h - 1 / 3) }
  return rgbToHex(r * 255, g * 255, b * 255)
}
const STR = {
  en: { label: 'Pick a colour', complementary: 'Complementary', analogous: 'Analogous', triadic: 'Triadic', shades: 'Shades & tints', copied: 'Copied!', copy: 'Click a swatch to copy its HEX.' },
  ar: { label: 'اختر لونًا', complementary: 'مكمّل', analogous: 'متجانس', triadic: 'ثلاثي', shades: 'دراجات وتظليل', copied: 'تم النسخ!', copy: 'اضغط أي لون لنسخ رمز HEX.' },
}

export default function ColorToolsTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const [hex, setHex] = useState('#2f6b4f')
  const [copied, setCopied] = useState('')

  const { rgb, hsl } = useMemo(() => {
    const rgb = hexToRgb(hex)
    return { rgb, hsl: rgbToHsl(rgb.r, rgb.g, rgb.b) }
  }, [hex])

  async function copy(v: string) {
    try { await navigator.clipboard.writeText(v); setCopied(v); setTimeout(() => setCopied(''), 1200) } catch { /* ignore */ }
  }

  const rgbStr = `rgb(${Math.round(rgb.r)}, ${Math.round(rgb.g)}, ${Math.round(rgb.b)})`
  const hslStr = `hsl(${Math.round(hsl.h)}, ${Math.round(hsl.s)}%, ${Math.round(hsl.l)}%)`
  const comp = [hslToHex(hsl.h + 180, hsl.s, hsl.l)]
  const analog = [hslToHex(hsl.h - 30, hsl.s, hsl.l), hex, hslToHex(hsl.h + 30, hsl.s, hsl.l)]
  const triad = [hex, hslToHex(hsl.h + 120, hsl.s, hsl.l), hslToHex(hsl.h + 240, hsl.s, hsl.l)]
  const shades = [90, 75, 60, 45, 30, 18].map((l) => hslToHex(hsl.h, hsl.s, l))

  const Swatch = ({ c }: { c: string }) => (
    <button className="flex flex-col items-stretch rounded-md overflow-hidden border border-[color:var(--line-soft)] group" onClick={() => copy(c)} data-testid={`swatch-${c}`} title={c}>
      <span className="h-14" style={{ background: c }} />
      <span className="font-mono text-[0.72rem] py-1 text-center bg-[var(--surface)] text-ink-soft group-hover:text-green-700">{copied === c ? s.copied : c.toUpperCase()}</span>
    </button>
  )
  const Row = ({ title, cols }: { title: string; cols: string[] }) => (
    <div className="flex flex-col gap-2">
      <span className="font-body text-[0.72rem] uppercase tracking-[0.06em] text-ink-faint">{title}</span>
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">{cols.map((c, i) => <Swatch key={i} c={c} />)}</div>
    </div>
  )

  return (
    <div className="stack" data-testid="color-tools">
      <div className="flex flex-wrap items-end gap-4">
        <label className="field">
          <span className="field__label">{s.label}</span>
          <input type="color" value={hex} data-testid="color-input" onChange={(e) => setHex(e.target.value)} className="w-16 h-12 rounded-md border border-[color:var(--line)] bg-transparent p-0 cursor-pointer" />
        </label>
        <div className="flex flex-col gap-2 flex-1 min-w-[12rem]">
          {([['HEX', hex.toUpperCase(), 'color-hex'], ['RGB', rgbStr, 'color-rgb'], ['HSL', hslStr, 'color-hsl']] as [string, string, string][]).map(([k, v, tid]) => (
            <button key={k} className="flex items-center justify-between gap-3 input font-mono text-[0.9rem] hover:border-green-500" onClick={() => copy(v)} data-testid={tid}>
              <span className="text-ink-faint text-[0.75rem] font-body">{k}</span><span className="truncate">{copied === v ? s.copied : v}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-4" data-testid="color-palette">
        <Row title={s.complementary} cols={comp} />
        <Row title={s.analogous} cols={analog} />
        <Row title={s.triadic} cols={triad} />
        <Row title={s.shades} cols={shades} />
      </div>
      <p className="text-[0.8rem] text-ink-faint">{s.copy}</p>
    </div>
  )
}
