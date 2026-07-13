import { useMemo, useState } from 'react'
import { useLocale } from '../../i18n'
import { Stack, Input, FieldLabel } from '../../components/ui'

const STR = {
  en: {
    input: 'Cron expression', desc: 'In plain words', next: 'Next runs', invalid: 'Invalid cron — expected 5 fields (minute hour day month weekday).',
    fields: 'minute · hour · day-of-month · month · day-of-week', privacy: 'Parsed in your browser — nothing is uploaded.', none: 'No upcoming runs within a year.',
  },
  ar: {
    input: 'تعبير Cron', desc: 'بكلمات واضحة', next: 'التشغيلات القادمة', invalid: 'تعبير غير صالح — يُتوقَّع 5 حقول (دقيقة ساعة يوم شهر يوم-الأسبوع).',
    fields: 'دقيقة · ساعة · يوم-الشهر · شهر · يوم-الأسبوع', privacy: 'يُحلَّل في متصفحك — لا يُرفع أي شيء.', none: 'لا تشغيلات قادمة خلال عام.',
  },
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const DOW = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function parseField(spec: string, min: number, max: number): number[] {
  const out = new Set<number>()
  for (const part of spec.split(',')) {
    const [range, stepS] = part.split('/')
    const step = stepS ? parseInt(stepS, 10) : 1
    if (!step || step < 1) throw new Error('bad step')
    let lo = min, hi = max
    if (range !== '*' && range !== '') {
      const [a, b] = range.split('-')
      lo = parseInt(a, 10)
      hi = b !== undefined ? parseInt(b, 10) : (stepS ? max : lo)
      if (Number.isNaN(lo) || Number.isNaN(hi)) throw new Error('bad range')
    }
    if (lo < min || hi > max || lo > hi) throw new Error('out of range')
    for (let v = lo; v <= hi; v += step) out.add(v)
  }
  return [...out].sort((a, b) => a - b)
}

const listWords = (nums: number[], names: string[]) => nums.map((n) => names[n]).join(', ')

export default function CronExplainerTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const [expr, setExpr] = useState('30 9 * * 1-5')

  const parsed = useMemo(() => {
    const f = expr.trim().split(/\s+/)
    if (f.length !== 5) return { error: true as const }
    try {
      const minute = parseField(f[0], 0, 59)
      const hour = parseField(f[1], 0, 23)
      const dom = parseField(f[2], 1, 31)
      const month = parseField(f[3], 1, 12)
      const dowRaw = parseField(f[4].replace(/7/g, '0'), 0, 6)
      const domRestricted = f[2] !== '*'
      const dowRestricted = f[4] !== '*'
      return { error: false as const, minute, hour, dom, month, dowRaw, domRestricted, dowRestricted, f }
    } catch { return { error: true as const } }
  }, [expr])

  const description = useMemo(() => {
    if (!parsed || parsed.error) return ''
    const { minute, hour, month, dowRaw, domRestricted, dowRestricted, f } = parsed
    const at = (() => {
      if (f[0] === '*' && f[1] === '*') return 'every minute'
      if (minute.length === 1 && hour.length === 1) return `at ${String(hour[0]).padStart(2, '0')}:${String(minute[0]).padStart(2, '0')}`
      if (f[1] === '*') return minute.length === 1 ? `at minute ${minute[0]} of every hour` : `at minutes ${minute.join(', ')} past every hour`
      if (f[0].startsWith('*/')) return `every ${f[0].slice(2)} minutes during hours ${hour.join(', ')}`
      return `at ${hour.map((h) => minute.map((m) => `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`).join(', ')).join(', ')}`
    })()
    const on = dowRestricted ? `on ${listWords(dowRaw, DOW)}` : ''
    const dm = domRestricted ? `on day ${parsed.dom.join(', ')} of the month` : ''
    const mo = f[3] !== '*' ? `in ${listWords(month.map((m) => m - 1), MONTHS)}` : ''
    return [at, [dm, on].filter(Boolean).join(dm && on ? ' and ' : ''), mo].filter(Boolean).join(' ')
  }, [parsed])

  const nextRuns = useMemo(() => {
    if (!parsed || parsed.error) return []
    const { minute, hour, dom, month, dowRaw, domRestricted, dowRestricted } = parsed
    const ms = new Set(minute), hs = new Set(hour), doms = new Set(dom), mos = new Set(month), dows = new Set(dowRaw)
    const out: Date[] = []
    const d = new Date()
    d.setSeconds(0, 0)
    d.setMinutes(d.getMinutes() + 1)
    const limit = new Date(d.getTime() + 366 * 86400_000)
    while (d < limit && out.length < 6) {
      const domOk = doms.has(d.getDate())
      const dowOk = dows.has(d.getDay())
      const dayOk = domRestricted && dowRestricted ? (domOk || dowOk) : (domOk && dowOk)
      if (ms.has(d.getMinutes()) && hs.has(d.getHours()) && mos.has(d.getMonth() + 1) && dayOk) out.push(new Date(d))
      d.setMinutes(d.getMinutes() + 1)
    }
    return out
  }, [parsed])

  const fmt = new Intl.DateTimeFormat(locale === 'ar' ? 'ar-SA' : 'en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

  return (
    <Stack data-testid="cron-explainer">
      <label className="flex flex-col gap-[0.4rem]"><FieldLabel>{s.input}</FieldLabel>
        <Input value={expr} onChange={(e) => setExpr(e.target.value)} dir="ltr" className="font-mono text-[1.05rem]" data-testid="cron-input" />
        <span className="text-[0.75rem] text-ink-faint font-mono">{s.fields}</span></label>

      {parsed?.error
        ? <p className="text-[color:var(--danger)] text-[0.9rem]" data-testid="cron-error">{s.invalid}</p>
        : (
          <>
            <div className="border-s-[3px] border-green-500 ps-3">
              <FieldLabel>{s.desc}</FieldLabel>
              <p className="text-[1.05rem] text-ink mt-1 first-letter:uppercase" data-testid="cron-desc">{description}</p>
            </div>
            <div>
              <FieldLabel>{s.next}</FieldLabel>
              <ul className="mt-1 flex flex-col gap-1 font-mono text-[0.9rem] text-ink-soft" data-testid="cron-next">
                {nextRuns.length ? nextRuns.map((d, i) => <li key={i}>{fmt.format(d)}</li>) : <li className="text-ink-faint">{s.none}</li>}
              </ul>
            </div>
          </>
        )}

      <p className="text-[0.8rem] text-ink-faint flex items-center gap-[0.4rem]"><span aria-hidden="true">🔒</span> {s.privacy}</p>
    </Stack>
  )
}
