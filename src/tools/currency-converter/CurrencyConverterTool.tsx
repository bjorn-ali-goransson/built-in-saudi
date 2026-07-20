import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocale } from '../../i18n'
import { Stack, Select } from '../../components/ui'
import { ExchangeIcon, RefreshIcon } from '../../components/icons'
import { CURRENCIES, byCode } from './currencies'
import { getRates } from './rates'

const STR = {
  en: {
    amount: 'Amount', from: 'From', to: 'To', swap: 'Swap currencies', refresh: 'Refresh rates',
    asOf: (d: string) => `Rates as of ${d}`, stale: 'Showing the last saved rates — check your connection.',
    failed: 'Couldn’t load exchange rates. Check your connection and try again.', loading: 'Loading rates…',
    privacy: 'Rates come from a free public feed; your amounts stay in your browser.',
    source: 'Daily reference rates',
  },
  ar: {
    amount: 'المبلغ', from: 'من', to: 'إلى', swap: 'تبديل العملتين', refresh: 'تحديث الأسعار',
    asOf: (d: string) => `الأسعار بتاريخ ${d}`, stale: 'تُعرض آخر أسعار محفوظة — تحقّق من اتصالك.',
    failed: 'تعذّر تحميل أسعار الصرف. تحقّق من اتصالك وحاول مجددًا.', loading: 'جارٍ تحميل الأسعار…',
    privacy: 'تأتي الأسعار من مصدر عام مجاني؛ وتبقى مبالغك في متصفحك.',
    source: 'أسعار مرجعية يومية',
  },
}

const KEY = 'bis-cur'
type Saved = { from: string; to: string; amount: string }
function load(): Saved {
  try { const r = localStorage.getItem(KEY); if (r) return JSON.parse(r) } catch { /* */ }
  return { from: 'USD', to: 'SAR', amount: '100' }
}

function fmt(n: number, locale: string): string {
  if (!Number.isFinite(n)) return '—'
  const dp = n !== 0 && Math.abs(n) < 1 ? 4 : 2
  return new Intl.NumberFormat(locale === 'ar' ? 'ar-SA' : 'en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp }).format(n)
}

export default function CurrencyConverterTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const init = useRef(load())
  const [from, setFrom] = useState(init.current.from)
  const [to, setTo] = useState(init.current.to)
  const [amount, setAmount] = useState(init.current.amount)
  const [rates, setRates] = useState<Record<string, number> | null>(null)
  const [date, setDate] = useState('')
  const [state, setState] = useState<'loading' | 'ok' | 'stale' | 'error'>('loading')
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify({ from, to, amount })) } catch { /* */ }
  }, [from, to, amount])

  // (Re)load rates whenever the base currency changes or the user hits refresh.
  useEffect(() => {
    let alive = true
    setState('loading')
    getRates(from)
      .then((r) => { if (!alive) return; setRates(r.rates); setDate(r.date); setState(r.stale ? 'stale' : 'ok') })
      .catch(() => { if (!alive) return; setRates(null); setState('error') })
    return () => { alive = false }
  }, [from, nonce])

  const num = parseFloat(amount.replace(',', '.'))
  const rate = rates ? rates[to.toLowerCase()] : undefined
  const result = rate != null && Number.isFinite(num) ? num * rate : NaN
  const toCur = byCode(to)
  const oneRate = useMemo(() => (rate != null ? fmt(rate, locale) : '—'), [rate, locale])

  function swap() { setFrom(to); setTo(from) }

  const opts = CURRENCIES.map((c) => (
    <option key={c.code} value={c.code}>{c.code} — {locale === 'ar' ? c.ar : c.en}</option>
  ))

  return (
    <Stack data-testid="currency-converter">
      <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr] items-end">
        {/* From */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[0.8rem] font-medium text-ink-faint ps-0.5">{s.amount}</label>
          <div className="flex flex-col gap-1.5">
            <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.,]/g, ''))}
              data-testid="cur-amount" aria-label={s.amount}
              className="h-12 rounded-md border border-[color:var(--line-soft)] bg-paper px-3 text-[1.1rem] font-mono tabular-nums outline-none focus:border-green-600" />
            <Select value={from} onChange={(e) => setFrom(e.target.value)} data-testid="cur-from" aria-label={s.from}>{opts}</Select>
          </div>
        </div>

        {/* Swap */}
        <div className="flex sm:flex-col justify-center pb-1">
          <button type="button" onClick={swap} title={s.swap} aria-label={s.swap} data-testid="cur-swap"
            className="h-10 w-10 grid place-items-center rounded-md border border-[color:var(--line-soft)] bg-paper text-ink-soft hover:bg-black/5 hover:text-ink cursor-pointer transition-colors [&_svg]:w-5 [&_svg]:h-5 rtl:[&_svg]:-scale-x-100">
            <ExchangeIcon />
          </button>
        </div>

        {/* To */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[0.8rem] font-medium text-ink-faint ps-0.5">{s.to}</label>
          <div className="flex flex-col gap-1.5">
            <div className="h-12 rounded-md border border-green-600/40 bg-green-600/5 px-3 flex items-center text-[1.1rem] font-mono tabular-nums text-green-800 min-w-0" data-testid="cur-result">
              <span className="truncate">{state === 'error' ? '—' : fmt(result, locale)}</span>
              {toCur && <span className="ms-1.5 text-[0.85rem] text-ink-faint shrink-0">{toCur.sym}</span>}
            </div>
            <Select value={to} onChange={(e) => setTo(e.target.value)} data-testid="cur-to" aria-label={s.to}>{opts}</Select>
          </div>
        </div>
      </div>

      {/* Rate line + refresh */}
      <div className="flex items-center gap-2 flex-wrap text-[0.85rem] text-ink-soft">
        {state === 'error' ? (
          <span className="text-[var(--danger)] font-medium" data-testid="cur-error">{s.failed}</span>
        ) : state === 'loading' ? (
          <span data-testid="cur-status">{s.loading}</span>
        ) : (
          <span className="font-mono tabular-nums" data-testid="cur-rate">1 {from} = {oneRate} {to}</span>
        )}
        <button type="button" onClick={() => setNonce((n) => n + 1)} title={s.refresh} aria-label={s.refresh} data-testid="cur-refresh"
          className="h-7 w-7 grid place-items-center rounded-md border border-[color:var(--line-soft)] bg-paper text-ink-faint hover:text-ink hover:bg-black/5 cursor-pointer [&_svg]:w-4 [&_svg]:h-4">
          <RefreshIcon />
        </button>
        <span className="ms-auto text-[0.78rem] text-ink-faint" data-testid="cur-date">
          {state === 'stale' ? s.stale : date ? s.asOf(date) : s.source}
        </span>
      </div>

      <p className="text-[0.78rem] text-ink-faint">{s.privacy}</p>
    </Stack>
  )
}
