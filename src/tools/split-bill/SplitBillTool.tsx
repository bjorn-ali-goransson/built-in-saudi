import { useMemo, useState } from 'react'
import { useLocale } from '../../i18n'
import { Stack, Panel, Input, FieldLabel, Button } from '../../components/ui'

const STR = {
  en: {
    bill: 'Bill amount', tip: 'Tip (%)', people: 'People', perPerson: 'Per person', total: 'Total with tip', tipAmount: 'Tip',
    round: 'Round each share up', privacy: 'Computed in your browser — nothing is uploaded.',
  },
  ar: {
    bill: 'مبلغ الفاتورة', tip: 'البقشيش (%)', people: 'الأشخاص', perPerson: 'لكل شخص', total: 'الإجمالي مع البقشيش', tipAmount: 'البقشيش',
    round: 'تقريب نصيب كلٍّ للأعلى', privacy: 'يُحسب في متصفحك — لا يُرفع أي شيء.',
  },
}

const money = (n: number, locale: string) => n.toLocaleString(locale === 'ar' ? 'ar-SA' : 'en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function SplitBillTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const [bill, setBill] = useState(240)
  const [tip, setTip] = useState(0)
  const [people, setPeople] = useState(4)
  const [roundUp, setRoundUp] = useState(false)

  const calc = useMemo(() => {
    const tipAmount = bill * (tip / 100)
    const total = bill + tipAmount
    const n = Math.max(1, Math.floor(people))
    let per = total / n
    if (roundUp) per = Math.ceil(per)
    return { tipAmount, total, per, collected: per * n }
  }, [bill, tip, people, roundUp])

  return (
    <Stack data-testid="split-bill">
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-[0.4rem]"><FieldLabel>{s.bill}</FieldLabel>
          <Input type="number" min={0} step={1} value={bill} onChange={(e) => setBill(Math.max(0, Number(e.target.value) || 0))} className="font-mono" data-testid="sb-bill" /></label>
        <label className="flex flex-col gap-[0.4rem]"><FieldLabel>{s.tip}</FieldLabel>
          <Input type="number" min={0} step={1} value={tip} onChange={(e) => setTip(Math.max(0, Number(e.target.value) || 0))} className="font-mono" data-testid="sb-tip" /></label>
        <label className="flex flex-col gap-[0.4rem]"><FieldLabel>{s.people}</FieldLabel>
          <div className="flex items-center gap-2">
            <Button onClick={() => setPeople((p) => Math.max(1, p - 1))} aria-label="-">−</Button>
            <Input type="number" min={1} step={1} value={people} onChange={(e) => setPeople(Math.max(1, Math.floor(Number(e.target.value) || 1)))} className="font-mono text-center" data-testid="sb-people" />
            <Button onClick={() => setPeople((p) => p + 1)} aria-label="+">+</Button>
          </div></label>
      </div>

      <label className="inline-flex items-center gap-2 text-[0.9rem] text-ink-soft cursor-pointer"><input type="checkbox" checked={roundUp} onChange={(e) => setRoundUp(e.target.checked)} className="accent-green-600" data-testid="sb-round" /> {s.round}</label>

      <Panel className="text-center">
        <div><FieldLabel>{s.perPerson}</FieldLabel><p className="text-[2.6rem] font-display font-bold text-green-700 leading-none" data-testid="sb-per">{money(calc.per, locale)}</p></div>
        <div className="flex justify-center gap-6 text-[0.9rem] text-ink-soft">
          <span>{s.tipAmount}: <b className="text-ink font-mono">{money(calc.tipAmount, locale)}</b></span>
          <span>{s.total}: <b className="text-ink font-mono" data-testid="sb-total">{money(calc.total, locale)}</b></span>
        </div>
      </Panel>
      <p className="text-[0.8rem] text-ink-faint flex items-center gap-[0.4rem]"><span aria-hidden="true">🔒</span> {s.privacy}</p>
    </Stack>
  )
}
