import { useMemo, useState } from 'react'
import { useLocale } from '../../i18n'
import { Stack, Input, FieldLabel } from '../../components/ui'

const STR = {
  en: {
    text: 'Text colour', bg: 'Background colour', ratio: 'Contrast ratio', swap: 'Swap',
    normal: 'Normal text', large: 'Large text (18pt+/14pt bold)', pass: 'Pass', fail: 'Fail',
    preview: 'The quick brown fox jumps over the lazy dog',
    privacy: 'Computed in your browser — nothing is uploaded.',
  },
  ar: {
    text: 'لون النص', bg: 'لون الخلفية', ratio: 'نسبة التباين', swap: 'تبديل',
    normal: 'نص عادي', large: 'نص كبير (18pt+/14pt عريض)', pass: 'ناجح', fail: 'راسب',
    preview: 'نصٌّ تجريبيٌّ لمعاينة التباين بين اللونين',
    privacy: 'يُحسب في متصفحك — لا يُرفع أي شيء.',
  },
}

function hexToRgb(hex: string): [number, number, number] | null {
  const m = hex.trim().replace(/^#/, '')
  const full = m.length === 3 ? m.split('').map((c) => c + c).join('') : m
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null
  return [parseInt(full.slice(0, 2), 16), parseInt(full.slice(2, 4), 16), parseInt(full.slice(4, 6), 16)]
}
const lum = ([r, g, b]: [number, number, number]) => {
  const f = (c: number) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4) }
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}

function Badge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[0.8rem] font-semibold ${ok ? 'bg-[color-mix(in_srgb,var(--color-green-400)_20%,transparent)] text-green-700' : 'bg-[color-mix(in_srgb,var(--danger)_14%,transparent)] text-[color:var(--danger)]'}`}>
      {label} {ok ? '✓' : '✕'}
    </span>
  )
}

export default function ColorContrastTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const [text, setText] = useState('#1f3d2b')
  const [bg, setBg] = useState('#f4ede2')

  const ratio = useMemo(() => {
    const a = hexToRgb(text), b = hexToRgb(bg)
    if (!a || !b) return null
    const l1 = lum(a), l2 = lum(b)
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)
  }, [text, bg])

  const r = ratio ?? 0
  const swap = () => { setText(bg); setBg(text) }

  return (
    <Stack data-testid="color-contrast">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-[0.4rem]"><FieldLabel>{s.text}</FieldLabel>
          <div className="flex gap-2 items-center">
            <input type="color" value={hexToRgb(text) ? (text.startsWith('#') ? text : `#${text}`) : '#000000'} onChange={(e) => setText(e.target.value)} className="w-11 h-11 rounded-md border border-[color:var(--line)] bg-transparent p-0.5 cursor-pointer" aria-label={s.text} />
            <Input value={text} onChange={(e) => setText(e.target.value)} dir="ltr" className="font-mono flex-1" data-testid="cc-text" />
          </div></label>
        <label className="flex flex-col gap-[0.4rem]"><FieldLabel>{s.bg}</FieldLabel>
          <div className="flex gap-2 items-center">
            <input type="color" value={hexToRgb(bg) ? (bg.startsWith('#') ? bg : `#${bg}`) : '#ffffff'} onChange={(e) => setBg(e.target.value)} className="w-11 h-11 rounded-md border border-[color:var(--line)] bg-transparent p-0.5 cursor-pointer" aria-label={s.bg} />
            <Input value={bg} onChange={(e) => setBg(e.target.value)} dir="ltr" className="font-mono flex-1" data-testid="cc-bg" />
          </div></label>
      </div>

      <button type="button" onClick={swap} className="self-start text-[0.85rem] text-green-700 underline underline-offset-2 bg-transparent border-0 cursor-pointer">↕ {s.swap}</button>

      <div className="rounded-lg border border-[color:var(--line)] p-6 flex items-center justify-center text-center" style={{ background: hexToRgb(bg) ? bg : '#fff', color: hexToRgb(text) ? text : '#000' }} data-testid="cc-preview">
        <span className="text-[1.35rem] font-semibold">{s.preview}</span>
      </div>

      <div className="flex items-baseline gap-2">
        <span className="text-[2.4rem] font-display font-bold text-ink leading-none" data-testid="cc-ratio">{ratio ? r.toFixed(2) : '—'}</span>
        <span className="text-ink-faint">: 1 · {s.ratio}</span>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <div className="flex items-center gap-2 flex-wrap"><span className="text-[0.85rem] text-ink-soft w-full sm:w-auto">{s.normal}:</span>
          <Badge ok={r >= 4.5} label={`AA ${r >= 4.5 ? s.pass : s.fail}`} /><Badge ok={r >= 7} label={`AAA ${r >= 7 ? s.pass : s.fail}`} /></div>
        <div className="flex items-center gap-2 flex-wrap"><span className="text-[0.85rem] text-ink-soft w-full sm:w-auto">{s.large}:</span>
          <Badge ok={r >= 3} label={`AA ${r >= 3 ? s.pass : s.fail}`} /><Badge ok={r >= 4.5} label={`AAA ${r >= 4.5 ? s.pass : s.fail}`} /></div>
      </div>

      <p className="text-[0.8rem] text-ink-faint flex items-center gap-[0.4rem]"><span aria-hidden="true">🔒</span> {s.privacy}</p>
    </Stack>
  )
}
