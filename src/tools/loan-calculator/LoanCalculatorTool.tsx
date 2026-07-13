import { useMemo, useState } from 'react'
import { useLocale } from '../../i18n'
import { Stack, Panel, Input, FieldLabel } from '../../components/ui'

const STR = {
  en: {
    amount: 'Loan amount', rate: 'Annual interest rate (%)', years: 'Term (years)',
    monthly: 'Monthly payment', totalInterest: 'Total interest', totalPaid: 'Total repaid',
    schedule: 'Yearly breakdown', year: 'Year', principalPaid: 'Principal', interestPaid: 'Interest', balance: 'Balance',
    note: 'A neutral calculation, not financial advice.', privacy: 'Computed in your browser — nothing is uploaded.',
  },
  ar: {
    amount: 'مبلغ القرض', rate: 'نسبة الفائدة السنوية (%)', years: 'المدة (سنوات)',
    monthly: 'القسط الشهري', totalInterest: 'إجمالي الفائدة', totalPaid: 'إجمالي المسدَّد',
    schedule: 'التفصيل السنوي', year: 'السنة', principalPaid: 'الأصل', interestPaid: 'الفائدة', balance: 'الرصيد',
    note: 'حساب محايد وليس نصيحة مالية.', privacy: 'يُحسب في متصفحك — لا يُرفع أي شيء.',
  },
}

const money = (n: number, locale: string) => n.toLocaleString(locale === 'ar' ? 'ar-SA' : 'en-US', { maximumFractionDigits: 0 })

export default function LoanCalculatorTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const [amount, setAmount] = useState(500000)
  const [rate, setRate] = useState(5)
  const [years, setYears] = useState(20)

  const calc = useMemo(() => {
    const n = Math.round(years * 12)
    const r = rate / 100 / 12
    if (amount <= 0 || n <= 0) return null
    const monthly = r === 0 ? amount / n : (amount * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1)
    // yearly amortization
    let bal = amount
    const rows: { year: number; principal: number; interest: number; balance: number }[] = []
    let yp = 0, yi = 0
    for (let m = 1; m <= n; m++) {
      const interest = bal * r
      const principal = Math.min(monthly - interest, bal)
      bal -= principal
      yp += principal; yi += interest
      if (m % 12 === 0 || m === n) { rows.push({ year: Math.ceil(m / 12), principal: yp, interest: yi, balance: Math.max(0, bal) }); yp = 0; yi = 0 }
    }
    const totalPaid = monthly * n
    return { monthly, totalInterest: totalPaid - amount, totalPaid, rows }
  }, [amount, rate, years])

  const field = (label: string, value: number, set: (n: number) => void, testid: string, step = 1) => (
    <label className="flex flex-col gap-[0.4rem]"><FieldLabel>{label}</FieldLabel>
      <Input type="number" min={0} step={step} value={value} onChange={(e) => set(Math.max(0, Number(e.target.value) || 0))} className="font-mono" data-testid={testid} /></label>
  )

  return (
    <Stack data-testid="loan-calculator">
      <div className="grid gap-3 sm:grid-cols-3">
        {field(s.amount, amount, setAmount, 'loan-amount', 1000)}
        {field(s.rate, rate, setRate, 'loan-rate', 0.1)}
        {field(s.years, years, setYears, 'loan-years', 1)}
      </div>

      {calc && (
        <>
          <Panel className="!grid-cols-3 grid-cols-1 sm:grid-cols-3 text-center">
            <div><FieldLabel>{s.monthly}</FieldLabel><p className="text-[1.7rem] font-display font-bold text-green-700 leading-tight" data-testid="loan-monthly">{money(calc.monthly, locale)}</p></div>
            <div><FieldLabel>{s.totalInterest}</FieldLabel><p className="text-[1.7rem] font-display font-bold text-ink leading-tight" data-testid="loan-interest">{money(calc.totalInterest, locale)}</p></div>
            <div><FieldLabel>{s.totalPaid}</FieldLabel><p className="text-[1.7rem] font-display font-bold text-ink leading-tight" data-testid="loan-total">{money(calc.totalPaid, locale)}</p></div>
          </Panel>

          <div>
            <FieldLabel>{s.schedule}</FieldLabel>
            <div className="mt-1 overflow-x-auto">
              <table className="w-full text-[0.85rem] border-collapse [&_td]:py-1 [&_th]:py-1 [&_td]:px-2 [&_th]:px-2 [&_th]:text-start [&_td]:text-end [&_th:first-child]:text-start [&_td:first-child]:text-start">
                <thead><tr className="border-b border-[color:var(--line)] text-ink-soft"><th>{s.year}</th><th className="!text-end">{s.principalPaid}</th><th className="!text-end">{s.interestPaid}</th><th className="!text-end">{s.balance}</th></tr></thead>
                <tbody className="font-mono">
                  {calc.rows.map((row) => (
                    <tr key={row.year} className="border-b border-[color:var(--line-soft)]">
                      <td>{row.year}</td><td>{money(row.principal, locale)}</td><td>{money(row.interest, locale)}</td><td>{money(row.balance, locale)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <p className="text-[0.8rem] text-ink-faint">{s.note}</p>
        </>
      )}
      <p className="text-[0.8rem] text-ink-faint flex items-center gap-[0.4rem]"><span aria-hidden="true">🔒</span> {s.privacy}</p>
    </Stack>
  )
}
