import { useMemo, useState } from 'react'
import { useLocale } from '../../i18n'
import { Stack, Panel, Input, FieldLabel } from '../../components/ui'

const STR = {
  en: {
    assets: 'Zakatable assets', cash: 'Cash & bank', gold: 'Gold & silver value', trade: 'Trade goods / inventory', receivable: 'Money owed to you',
    debts: 'Short-term debts (subtract)', nisab: 'Niṣāb threshold', net: 'Net zakatable wealth', due: 'Zakat due (2.5%)',
    belowNisab: 'Below the niṣāb — no zakat is due on this amount.', aboveNisab: 'Above the niṣāb.',
    note: 'Zakat is 2.5% of qualifying wealth once it exceeds the niṣāb (roughly the value of 85g of gold or 595g of silver) and has been held for one lunar year (ḥawl). Set the niṣāb to today’s local value. A helping estimate, not a fatwa — consult a scholar for your situation.',
    privacy: 'Computed in your browser — nothing is uploaded.',
  },
  ar: {
    assets: 'الأموال الزكوية', cash: 'النقد والبنك', gold: 'قيمة الذهب والفضة', trade: 'عروض التجارة / المخزون', receivable: 'ديون مرجوّة لك',
    debts: 'ديون قصيرة الأجل (تُطرح)', nisab: 'حدّ النصاب', net: 'صافي المال الزكوي', due: 'الزكاة الواجبة (2.5%)',
    belowNisab: 'دون النصاب — لا زكاة على هذا المبلغ.', aboveNisab: 'فوق النصاب.',
    note: 'الزكاة 2.5% من المال متى بلغ النصاب (نحو قيمة 85 غرامًا من الذهب أو 595 غرامًا من الفضة) وحال عليه الحول (سنة قمرية). اضبط النصاب على قيمته المحلية اليوم. تقدير مُعين وليس فتوى — راجع أهل العلم لحالتك.',
    privacy: 'يُحسب في متصفحك — لا يُرفع أي شيء.',
  },
}

const money = (n: number, locale: string) => n.toLocaleString(locale === 'ar' ? 'ar-SA' : 'en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function ZakatCalculatorTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const [cash, setCash] = useState(0)
  const [gold, setGold] = useState(0)
  const [trade, setTrade] = useState(0)
  const [receivable, setReceivable] = useState(0)
  const [debts, setDebts] = useState(0)
  const [nisab, setNisab] = useState(4000)

  const { net, due, above } = useMemo(() => {
    const net = Math.max(0, cash + gold + trade + receivable - debts)
    const above = net >= nisab && net > 0
    return { net, due: above ? net * 0.025 : 0, above }
  }, [cash, gold, trade, receivable, debts, nisab])

  const row = (label: string, value: number, set: (n: number) => void, testid: string, subtract = false) => (
    <label className="flex items-center justify-between gap-3 text-[0.9rem]">
      <span className={`text-ink-soft ${subtract ? 'text-[color:var(--danger)]' : ''}`}>{label}</span>
      <Input type="number" min={0} step={100} value={value} onChange={(e) => set(Math.max(0, Number(e.target.value) || 0))} className="font-mono w-40 text-end" data-testid={testid} />
    </label>
  )

  return (
    <Stack data-testid="zakat-calculator">
      <Panel className="!gap-2">
        <FieldLabel>{s.assets}</FieldLabel>
        {row(s.cash, cash, setCash, 'zk-cash')}
        {row(s.gold, gold, setGold, 'zk-gold')}
        {row(s.trade, trade, setTrade, 'zk-trade')}
        {row(s.receivable, receivable, setReceivable, 'zk-recv')}
        <div className="border-t border-[color:var(--line-soft)] pt-2">{row(s.debts, debts, setDebts, 'zk-debts', true)}</div>
      </Panel>

      <label className="flex items-center justify-between gap-3 text-[0.9rem]">
        <span className="text-ink-soft">{s.nisab}</span>
        <Input type="number" min={0} step={100} value={nisab} onChange={(e) => setNisab(Math.max(0, Number(e.target.value) || 0))} className="font-mono w-40 text-end" data-testid="zk-nisab" />
      </label>

      <Panel className="text-center">
        <div className="flex justify-between gap-3 text-[0.9rem] max-w-sm mx-auto w-full"><span className="text-ink-soft">{s.net}</span><span className="font-mono text-ink" data-testid="zk-net">{money(net, locale)}</span></div>
        <div><FieldLabel>{s.due}</FieldLabel><p className="text-[2.6rem] font-display font-bold text-green-700 leading-none" data-testid="zk-due">{money(due, locale)}</p></div>
        <p className="text-[0.85rem] text-ink-faint">{above ? s.aboveNisab : s.belowNisab}</p>
      </Panel>

      <p className="text-[0.78rem] text-ink-faint leading-relaxed">{s.note}</p>
      <p className="text-[0.8rem] text-ink-faint flex items-center gap-[0.4rem]"><span aria-hidden="true">🔒</span> {s.privacy}</p>
    </Stack>
  )
}
