import { useMemo, useState } from 'react'
import { useLocale } from '../../i18n'
import { Stack, Button, FieldLabel, Seg, SegButton } from '../../components/ui'
import { CopyIcon, TrashIcon } from '../../components/icons'

const STR = {
  en: { type: 'Type', linear: 'Linear', radial: 'Radial', angle: 'Angle', stops: 'Colour stops', add: 'Add stop', value: 'CSS', copy: 'Copy', copied: 'Copied!', privacy: 'Runs in your browser — nothing is uploaded.' },
  ar: { type: 'النوع', linear: 'خطّي', radial: 'شعاعي', angle: 'الزاوية', stops: 'محطّات الألوان', add: 'إضافة محطّة', value: 'CSS', copy: 'نسخ', copied: 'تم النسخ!', privacy: 'يعمل في متصفحك — لا يُرفع أي شيء.' },
}

type Stop = { color: string; pos: number }

export default function GradientGeneratorTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const [type, setType] = useState<'linear' | 'radial'>('linear')
  const [angle, setAngle] = useState(90)
  const [stops, setStops] = useState<Stop[]>([{ color: '#1f3d2b', pos: 0 }, { color: '#c8a24b', pos: 100 }])
  const [copied, setCopied] = useState(false)

  const css = useMemo(() => {
    const sorted = [...stops].sort((a, b) => a.pos - b.pos)
    const list = sorted.map((st) => `${st.color} ${st.pos}%`).join(', ')
    return type === 'linear' ? `linear-gradient(${angle}deg, ${list})` : `radial-gradient(circle, ${list})`
  }, [type, angle, stops])

  const setStop = (i: number, patch: Partial<Stop>) => setStops((cur) => cur.map((st, j) => (j === i ? { ...st, ...patch } : st)))
  async function copy() { try { await navigator.clipboard.writeText(`background: ${css};`); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch { /* */ } }

  return (
    <Stack data-testid="gradient-generator">
      <div className="h-40 rounded-lg border border-[color:var(--line-soft)]" style={{ background: css }} data-testid="gg-preview" />

      <div className="flex flex-wrap items-center gap-4">
        <div className="flex flex-col gap-1"><FieldLabel>{s.type}</FieldLabel>
          <Seg><SegButton active={type === 'linear'} onClick={() => setType('linear')} data-testid="gg-linear">{s.linear}</SegButton>
            <SegButton active={type === 'radial'} onClick={() => setType('radial')} data-testid="gg-radial">{s.radial}</SegButton></Seg></div>
        {type === 'linear' && (
          <label className="flex flex-col gap-1 flex-1 min-w-[160px]"><span className="text-[0.8rem] font-semibold text-ink-soft flex justify-between">{s.angle} <span className="font-mono font-normal text-ink-faint">{angle}°</span></span>
            <input type="range" min={0} max={360} value={angle} onChange={(e) => setAngle(Number(e.target.value))} data-testid="gg-angle" /></label>
        )}
      </div>

      <div>
        <FieldLabel>{s.stops}</FieldLabel>
        <div className="flex flex-col gap-2 mt-1">
          {stops.map((st, i) => (
            <div key={i} className="flex items-center gap-2">
              <input type="color" value={st.color} onChange={(e) => setStop(i, { color: e.target.value })} className="w-9 h-9 rounded-md border border-[color:var(--line)] p-0.5 cursor-pointer bg-transparent" data-testid={`gg-color-${i}`} />
              <input type="range" min={0} max={100} value={st.pos} onChange={(e) => setStop(i, { pos: Number(e.target.value) })} className="flex-1" data-testid={`gg-pos-${i}`} />
              <span className="font-mono text-[0.8rem] text-ink-faint w-10 text-end">{st.pos}%</span>
              {stops.length > 2 && <Button onClick={() => setStops((cur) => cur.filter((_, j) => j !== i))} aria-label="remove"><TrashIcon className="w-4 h-4" /></Button>}
            </div>
          ))}
        </div>
        <Button className="mt-2" onClick={() => setStops((cur) => [...cur, { color: '#ffffff', pos: 50 }])} data-testid="gg-add">+ {s.add}</Button>
      </div>

      <label className="flex flex-col gap-[0.4rem]"><FieldLabel>{s.value}</FieldLabel>
        <div className="flex items-center gap-2">
          <code className="flex-1 font-mono text-[0.9rem] bg-[var(--surface)] border border-[color:var(--line-soft)] rounded-md px-3 py-2 break-all" dir="ltr" data-testid="gg-output">background: {css};</code>
          <Button onClick={copy} data-testid="gg-copy"><CopyIcon /> {copied ? s.copied : s.copy}</Button>
        </div></label>
      <p className="text-[0.8rem] text-ink-faint flex items-center gap-[0.4rem]"><span aria-hidden="true">🔒</span> {s.privacy}</p>
    </Stack>
  )
}
