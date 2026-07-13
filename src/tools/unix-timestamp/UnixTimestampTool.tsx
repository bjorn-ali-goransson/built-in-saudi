import { useEffect, useMemo, useState } from 'react'
import { useLocale } from '../../i18n'
import { Stack, Panel, Input, Button, FieldLabel } from '../../components/ui'

const STR = {
  en: {
    now: 'Current Unix time', useNow: 'Use now', fromTs: 'From timestamp', toTs: 'From date',
    tsLabel: 'Unix timestamp (s or ms)', dateLabel: 'Date & time (local)', local: 'Local', utc: 'UTC', iso: 'ISO 8601', relative: 'Relative',
    invalid: 'Enter a valid number.', invalidDate: 'Enter a valid date.', privacy: 'Computed in your browser — nothing is uploaded.',
    ago: 'ago', ahead: 'from now',
  },
  ar: {
    now: 'وقت يونكس الحالي', useNow: 'استخدم الآن', fromTs: 'من طابع زمني', toTs: 'من تاريخ',
    tsLabel: 'طابع يونكس (ثوانٍ أو مللي)', dateLabel: 'التاريخ والوقت (محلي)', local: 'محلي', utc: 'UTC', iso: 'ISO 8601', relative: 'نسبي',
    invalid: 'أدخل رقمًا صالحًا.', invalidDate: 'أدخل تاريخًا صالحًا.', privacy: 'يُحسب في متصفحك — لا يُرفع أي شيء.',
    ago: 'مضت', ahead: 'من الآن',
  },
}

function relTime(ms: number, s: typeof STR['en']): string {
  const diff = ms - Date.now()
  const abs = Math.abs(diff)
  const units: [number, string][] = [[86400_000, 'd'], [3600_000, 'h'], [60_000, 'm'], [1000, 's']]
  let out = '0s'
  for (const [u, label] of units) { if (abs >= u) { out = `${Math.round(abs / u)}${label}`; break } }
  return diff < 0 ? `${out} ${s.ago}` : `${out} ${s.ahead}`
}

export default function UnixTimestampTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const [nowSec, setNowSec] = useState(() => Math.floor(Date.now() / 1000))
  const [ts, setTs] = useState(String(Math.floor(Date.now() / 1000)))
  const [dateStr, setDateStr] = useState('')

  useEffect(() => {
    const id = setInterval(() => setNowSec(Math.floor(Date.now() / 1000)), 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    // seed the date field from the current local time (yyyy-MM-ddThh:mm)
    const d = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    setDateStr(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`)
  }, [])

  const fromTs = useMemo(() => {
    const raw = ts.trim()
    if (!/^-?\d+$/.test(raw)) return null
    const num = Number(raw)
    const ms = raw.length > 11 ? num : num * 1000 // >11 digits ⇒ already ms
    const d = new Date(ms)
    if (Number.isNaN(d.getTime())) return null
    return { ms, d }
  }, [ts])

  const fromDate = useMemo(() => {
    if (!dateStr) return null
    const d = new Date(dateStr)
    if (Number.isNaN(d.getTime())) return null
    return d
  }, [dateStr])

  return (
    <Stack data-testid="unix-timestamp">
      <Panel>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <FieldLabel>{s.now}</FieldLabel>
            <p className="font-mono text-[1.6rem] text-green-700 leading-tight" data-testid="ts-now">{nowSec}</p>
          </div>
          <Button onClick={() => setTs(String(Math.floor(Date.now() / 1000)))} data-testid="ts-usenow">{s.useNow}</Button>
        </div>
      </Panel>

      <div className="flex flex-col gap-[0.5rem]">
        <FieldLabel>{s.fromTs}</FieldLabel>
        <Input value={ts} onChange={(e) => setTs(e.target.value)} dir="ltr" className="font-mono" aria-label={s.tsLabel} data-testid="ts-input" />
        {fromTs ? (
          <div className="grid gap-1 text-[0.9rem] border border-[color:var(--line-soft)] rounded-md bg-[var(--surface)] p-3" data-testid="ts-out">
            <div className="flex justify-between gap-3"><span className="text-ink-faint">{s.local}</span><span className="font-mono text-ink text-end">{fromTs.d.toLocaleString(locale === 'ar' ? 'ar-SA' : 'en-GB')}</span></div>
            <div className="flex justify-between gap-3"><span className="text-ink-faint">{s.utc}</span><span className="font-mono text-ink text-end">{fromTs.d.toUTCString()}</span></div>
            <div className="flex justify-between gap-3"><span className="text-ink-faint">{s.iso}</span><span className="font-mono text-ink text-end break-all">{fromTs.d.toISOString()}</span></div>
            <div className="flex justify-between gap-3"><span className="text-ink-faint">{s.relative}</span><span className="font-mono text-ink text-end">{relTime(fromTs.ms, s)}</span></div>
          </div>
        ) : <p className="text-[color:var(--danger)] text-[0.85rem]" data-testid="ts-err">{s.invalid}</p>}
      </div>

      <div className="flex flex-col gap-[0.5rem]">
        <FieldLabel>{s.toTs}</FieldLabel>
        <Input type="datetime-local" value={dateStr} onChange={(e) => setDateStr(e.target.value)} className="font-mono" aria-label={s.dateLabel} data-testid="ts-date" />
        {fromDate ? (
          <div className="flex justify-between gap-3 text-[0.9rem] border border-[color:var(--line-soft)] rounded-md bg-[var(--surface)] p-3" data-testid="ts-date-out">
            <span className="text-ink-faint">Unix (s · ms)</span>
            <span className="font-mono text-ink text-end">{Math.floor(fromDate.getTime() / 1000)} · {fromDate.getTime()}</span>
          </div>
        ) : <p className="text-[color:var(--danger)] text-[0.85rem]">{s.invalidDate}</p>}
      </div>

      <p className="text-[0.8rem] text-ink-faint flex items-center gap-[0.4rem]"><span aria-hidden="true">🔒</span> {s.privacy}</p>
    </Stack>
  )
}
