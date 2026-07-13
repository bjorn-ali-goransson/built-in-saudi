import { useEffect, useMemo, useState } from 'react'
import { useLocale } from '../../i18n'
import { Stack, Panel, Input, FieldLabel } from '../../components/ui'

const KEY = 'bis-countdown'
const STR = {
  en: { label: 'Event name', target: 'Target date & time', days: 'Days', hours: 'Hours', minutes: 'Minutes', seconds: 'Seconds', done: 'The moment has arrived!', set: 'Pick a date and time to start the countdown.', privacy: 'Runs on your device — the event stays in this browser.' },
  ar: { label: 'اسم المناسبة', target: 'التاريخ والوقت المستهدف', days: 'أيام', hours: 'ساعات', minutes: 'دقائق', seconds: 'ثوانٍ', done: 'حانت اللحظة!', set: 'اختر تاريخًا ووقتًا لبدء العدّ التنازلي.', privacy: 'يعمل على جهازك — تبقى المناسبة في هذا المتصفح.' },
}

export default function CountdownTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const [saved] = useState(() => { try { return JSON.parse(localStorage.getItem(KEY) || '{}') } catch { return {} } })
  const [name, setName] = useState<string>(saved.name || '')
  const [target, setTarget] = useState<string>(saved.target || '')
  const [now, setNow] = useState(Date.now())

  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id) }, [])
  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify({ name, target })) } catch { /* */ } }, [name, target])

  const parts = useMemo(() => {
    if (!target) return null
    const t = new Date(target).getTime()
    if (Number.isNaN(t)) return null
    let diff = Math.max(0, t - now)
    const days = Math.floor(diff / 86400_000); diff -= days * 86400_000
    const hours = Math.floor(diff / 3600_000); diff -= hours * 3600_000
    const minutes = Math.floor(diff / 60_000); diff -= minutes * 60_000
    const seconds = Math.floor(diff / 1000)
    return { days, hours, minutes, seconds, done: t <= now }
  }, [target, now])

  const nf = (n: number) => n.toLocaleString(locale === 'ar' ? 'ar-SA' : 'en-US')

  return (
    <Stack data-testid="countdown">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-[0.4rem]"><FieldLabel>{s.label}</FieldLabel>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="—" data-testid="cd-name" /></label>
        <label className="flex flex-col gap-[0.4rem]"><FieldLabel>{s.target}</FieldLabel>
          <Input type="datetime-local" value={target} onChange={(e) => setTarget(e.target.value)} className="font-mono" data-testid="cd-input" /></label>
      </div>

      {parts ? (
        <Panel className="text-center gap-3">
          {name && <p className="text-[1.1rem] font-display text-ink">{name}</p>}
          {parts.done ? <p className="text-[1.6rem] font-display font-bold text-green-700">{s.done}</p> : (
            <div className="grid grid-cols-4 gap-2">
              {[[parts.days, s.days, 'cd-days'], [parts.hours, s.hours, 'cd-hours'], [parts.minutes, s.minutes, 'cd-minutes'], [parts.seconds, s.seconds, 'cd-seconds']].map(([v, label, testid]) => (
                <div key={testid as string} className="border border-[color:var(--line-soft)] rounded-md bg-[var(--surface)] py-3">
                  <p className="text-[2rem] font-mono font-bold text-green-700 leading-none tabular-nums" data-testid={testid as string}>{nf(v as number)}</p>
                  <p className="text-[0.75rem] text-ink-faint mt-1">{label as string}</p>
                </div>
              ))}
            </div>
          )}
        </Panel>
      ) : <p className="text-[0.9rem] text-ink-faint">{s.set}</p>}
      <p className="text-[0.8rem] text-ink-faint flex items-center gap-[0.4rem]"><span aria-hidden="true">🔒</span> {s.privacy}</p>
    </Stack>
  )
}
