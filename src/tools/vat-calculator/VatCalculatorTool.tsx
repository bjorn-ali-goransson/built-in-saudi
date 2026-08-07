import { useMemo, useState } from 'react'
import { useLocale } from '../../i18n'
import { CopyIcon } from '../../components/icons'
import { Button, Input, Field, Stack, Seg, SegButton, Disclaimer } from '../../components/ui'

const STR = {
  en: {
    add: 'Add VAT', remove: 'Remove VAT',
    amount: 'Amount', rate: 'VAT rate', net: 'Net', vat: 'VAT', gross: 'Gross (incl. VAT)',
    copy: 'Copy breakdown', copied: 'Copied!',
    addHint: 'Net price → net, VAT and gross.', removeHint: 'Gross price → the net before VAT.',
  },
  ar: {
    add: 'إضافة الضريبة', remove: 'استخراج الضريبة',
    amount: 'المبلغ', rate: 'نسبة الضريبة', net: 'الصافي', vat: 'الضريبة', gross: 'الإجمالي (شامل الضريبة)',
    copy: 'نسخ التفاصيل', copied: 'تم النسخ!',
    addHint: 'السعر الصافي ← الصافي والضريبة والإجمالي.', removeHint: 'السعر الإجمالي ← الصافي قبل الضريبة.',
  },
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

export default function VatCalculatorTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const money = useMemo(() => new Intl.NumberFormat(locale === 'ar' ? 'ar-SA' : 'en-SA', { style: 'currency', currency: 'SAR', minimumFractionDigits: 2 }), [locale])
  const [mode, setMode] = useState<'add' | 'remove'>('add')
  const [amount, setAmount] = useState('100')
  const [rate, setRate] = useState('15')
  const [copied, setCopied] = useState(false)

  const r = Math.max(0, parseFloat(rate) || 0) / 100
  const a = parseFloat(amount) || 0
  const { net, vat, gross } = useMemo(() => {
    if (mode === 'add') { const net = round2(a); const vat = round2(a * r); return { net, vat, gross: round2(net + vat) } }
    const net = round2(a / (1 + r)); return { net, vat: round2(a - net), gross: round2(a) }
  }, [mode, a, r])

  async function copy() {
    const txt = `${s.net}: ${money.format(net)}\n${s.vat} (${rate}%): ${money.format(vat)}\n${s.gross}: ${money.format(gross)}`
    try { await navigator.clipboard.writeText(txt); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch { /* ignore */ }
  }

  const ROWS: [string, number, boolean][] = [[s.net, net, false], [`${s.vat} (${rate || 0}%)`, vat, false], [s.gross, gross, true]]

  return (
    <Stack data-testid="vat-calculator">
      <Seg className="self-start" role="group">
        {(['add', 'remove'] as const).map((m) => (
          <SegButton key={m} active={mode === m} aria-pressed={mode === m}
            data-testid={`vat-mode-${m}`} onClick={() => setMode(m)}>{s[m]}</SegButton>
        ))}
      </Seg>
      <p className="text-[0.9rem] text-ink-faint">{mode === 'add' ? s.addHint : s.removeHint}</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label={s.amount}>
          <Input className="font-mono" type="number" inputMode="decimal" min="0" value={amount} data-testid="vat-amount" onChange={(e) => setAmount(e.target.value)} />
        </Field>
        <Field label={`${s.rate} %`}>
          <div className="flex gap-2">
            <Input className="font-mono min-w-0" type="number" inputMode="decimal" min="0" value={rate} data-testid="vat-rate" onChange={(e) => setRate(e.target.value)} />
            <Seg className="flex-none" role="group">
              {['15', '5', '0'].map((p) => (
                <SegButton key={p} active={rate === p} onClick={() => setRate(p)}>{p}</SegButton>
              ))}
            </Seg>
          </div>
        </Field>
      </div>

      <div className="flex flex-col border border-[color:var(--line-soft)] rounded-md overflow-hidden" data-testid="vat-result">
        {ROWS.map(([label, val, strong], i) => (
          <div key={i} className={`flex items-center justify-between px-4 py-3 ${i < 2 ? 'border-b border-[color:var(--line-soft)]' : ''} ${strong ? 'bg-[color-mix(in_srgb,var(--green-400)_8%,transparent)]' : ''}`}>
            <span className={strong ? 'font-semibold text-green-700' : 'text-ink-soft'}>{label}</span>
            <span className={`font-mono ${strong ? 'font-bold text-[1.15rem] text-green-700' : 'text-ink'}`} data-testid={`vat-${['net', 'vat', 'gross'][i]}`}>{money.format(val)}</span>
          </div>
        ))}
      </div>

      <Button className="self-start" onClick={copy}><CopyIcon /> {copied ? s.copied : s.copy}</Button>

      <Disclaimer kind="financial" locale={locale}>
        {locale === 'ar'
          ? 'النسبة الأساسية 15% تحددها هيئة الزكاة والضريبة والجمارك. وليس كل توريد خاضعًا لها — فبعضها بنسبة صفر وبعضها معفى، وذلك يتوقّف على ما تبيعه لا على الحساب.'
          : 'The 15% standard rate is set by ZATCA. Not every supply is standard-rated — some are zero-rated and some exempt, and which is which turns on what you sell rather than on the arithmetic.'}
      </Disclaimer>
    </Stack>
  )
}
