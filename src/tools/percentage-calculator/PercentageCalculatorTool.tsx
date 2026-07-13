import { useState } from 'react'
import { useLocale } from '../../i18n'
import { Stack, Panel, Input, FieldLabel } from '../../components/ui'

const STR = {
  en: {
    q1: 'What is X% of Y?', q1a: '% ', q1b: 'of', q1r: 'result',
    q2: 'X is what percent of Y?', q2a: 'is what % of',
    q3: 'Percentage change from X to Y', q3a: 'from', q3b: 'to', increase: 'increase', decrease: 'decrease',
    privacy: 'Computed in your browser — nothing is uploaded.',
  },
  ar: {
    q1: 'كم يساوي X% من Y؟', q1a: '% ', q1b: 'من', q1r: 'الناتج',
    q2: 'X يمثّل أي نسبة من Y؟', q2a: 'يمثّل أي % من',
    q3: 'نسبة التغيّر من X إلى Y', q3a: 'من', q3b: 'إلى', increase: 'زيادة', decrease: 'نقص',
    privacy: 'يُحسب في متصفحك — لا يُرفع أي شيء.',
  },
}

const fmt = (n: number, locale: string) => Number.isFinite(n) ? n.toLocaleString(locale === 'ar' ? 'ar-SA' : 'en-US', { maximumFractionDigits: 2 }) : '—'

export default function PercentageCalculatorTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const [p, setP] = useState('15'), [of, setOf] = useState('200')
  const [x, setX] = useState('30'), [y, setY] = useState('120')
  const [from, setFrom] = useState('80'), [to, setTo] = useState('100')

  const num = (v: string) => (v.trim() === '' ? NaN : Number(v))
  const r1 = (num(p) / 100) * num(of)
  const r2 = (num(x) / num(y)) * 100
  const change = ((num(to) - num(from)) / Math.abs(num(from))) * 100

  const NumIn = (v: string, set: (s: string) => void, testid: string) => (
    <Input value={v} onChange={(e) => set(e.target.value)} inputMode="decimal" dir="ltr" className="font-mono w-24 text-center" data-testid={testid} />
  )

  return (
    <Stack data-testid="percentage-calculator">
      <Panel>
        <FieldLabel>{s.q1}</FieldLabel>
        <div className="flex items-center gap-2 flex-wrap text-[0.95rem]">
          {NumIn(p, setP, 'pc-q1-p')} <span>{s.q1a}{s.q1b}</span> {NumIn(of, setOf, 'pc-q1-of')} <span>=</span>
          <span className="font-mono font-bold text-green-700 text-[1.2rem]" data-testid="pc-q1-result">{fmt(r1, locale)}</span>
        </div>
      </Panel>
      <Panel>
        <FieldLabel>{s.q2}</FieldLabel>
        <div className="flex items-center gap-2 flex-wrap text-[0.95rem]">
          {NumIn(x, setX, 'pc-q2-x')} <span>{s.q2a}</span> {NumIn(y, setY, 'pc-q2-y')} <span>=</span>
          <span className="font-mono font-bold text-green-700 text-[1.2rem]" data-testid="pc-q2-result">{fmt(r2, locale)}%</span>
        </div>
      </Panel>
      <Panel>
        <FieldLabel>{s.q3}</FieldLabel>
        <div className="flex items-center gap-2 flex-wrap text-[0.95rem]">
          <span>{s.q3a}</span> {NumIn(from, setFrom, 'pc-q3-from')} <span>{s.q3b}</span> {NumIn(to, setTo, 'pc-q3-to')} <span>=</span>
          <span className={`font-mono font-bold text-[1.2rem] ${change >= 0 ? 'text-green-700' : 'text-[color:var(--danger)]'}`} data-testid="pc-q3-result">
            {Number.isFinite(change) ? `${change >= 0 ? '+' : ''}${fmt(change, locale)}%` : '—'}
          </span>
          {Number.isFinite(change) && <span className="text-ink-faint text-[0.85rem]">{change >= 0 ? s.increase : s.decrease}</span>}
        </div>
      </Panel>
      <p className="text-[0.8rem] text-ink-faint flex items-center gap-[0.4rem]"><span aria-hidden="true">🔒</span> {s.privacy}</p>
    </Stack>
  )
}
