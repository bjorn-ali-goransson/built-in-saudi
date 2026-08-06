import { useEffect, useMemo, useState } from 'react'
import { useLocale } from '../../i18n'
import { Button, Input, Field, Check, Stack, Panel, Seg, SegButton } from '../../components/ui'
import { DownloadIcon } from '../../components/icons'
import { formatHijri } from '../prayer-times/islamic'
import { TOTAL_PAGES, buildPlan, buildPlanPdf, nextRamadanStart, type Unit } from './khatma'

const STORE = 'bis-khatma'

const STR = {
  en: {
    start: 'Start', days: 'Days', unit: 'Divide by',
    pages: 'Pages', juz: 'Juz',
    ramadan: 'Ramadan', month: '30 days', week: '7 days',
    fridays: 'Rest on Fridays',
    perDay: (n: number) => `${n} pages a day`,
    perDayRange: (a: number, b: number) => `${a}–${b} pages a day`,
    download: 'Download the plan', working: 'Building…',
    plan: 'Your plan', done: 'Done', reset: 'Clear progress',
    progress: (a: number, b: number) => `${a} of ${b} days`,
    dayCol: 'Day', dateCol: 'Date', pagesCol: 'Pages', juzCol: 'Juz',
    title: 'Khatma plan',
    note: 'Page numbers follow the Madani mushaf (604 pages).',
    mushafNote: 'The page numbers are for the standard Madani mushaf — the 604-page King Fahd Complex printing, the one most people own. Another edition will not line up, so check the first day against your own copy before trusting the rest.',
    scopeNote: 'Divided by page count, not by meaning. Where a day ends is arithmetic, so end at the nearest natural stopping place rather than mid-passage.',
    ramadanIs: (d: string) => `Ramadan begins around ${d}`,
  },
  ar: {
    start: 'البداية', days: 'الأيام', unit: 'التقسيم',
    pages: 'الصفحات', juz: 'الأجزاء',
    ramadan: 'رمضان', month: '٣٠ يومًا', week: '٧ أيام',
    fridays: 'راحة يوم الجمعة',
    perDay: (n: number) => `${n} صفحة يوميًا`,
    perDayRange: (a: number, b: number) => `${a}–${b} صفحة يوميًا`,
    download: 'نزّل الخطة', working: 'جارٍ التجهيز…',
    plan: 'خطتك', done: 'تم', reset: 'امسح التقدّم',
    progress: (a: number, b: number) => `${a} من ${b} يومًا`,
    dayCol: 'اليوم', dateCol: 'التاريخ', pagesCol: 'الصفحات', juzCol: 'الجزء',
    title: 'خطة الختمة',
    note: 'أرقام الصفحات بحسب مصحف المدينة (٦٠٤ صفحات).',
    mushafNote: 'أرقام الصفحات لمصحف المدينة المنوّرة — طبعة مجمع الملك فهد ذات الـ٦٠٤ صفحات، وهي الأشهر بين الناس. ولن تنطبق على طبعة أخرى، فقابِل اليوم الأول بنسختك قبل أن تعتمد بقية الخطة.',
    scopeNote: 'التقسيم بعدد الصفحات لا بالمعنى. فموضع انتهاء اليوم حسابٌ محض، فقف عند أقرب موضع مناسب بدل الوقوف في وسط السياق.',
    ramadanIs: (d: string) => `يبدأ رمضان قرابة ${d}`,
  },
}

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export default function KhatmaTool() {
  const { locale } = useLocale()
  const s = STR[locale]

  const today = useMemo(() => { const d = new Date(); d.setHours(12, 0, 0, 0); return d }, [])
  const [start, setStart] = useState(() => iso(today))
  const [days, setDays] = useState(30)
  const [unit, setUnit] = useState<Unit>('pages')
  const [restFridays, setRestFridays] = useState(false)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<Record<number, boolean>>(() => {
    try { return JSON.parse(localStorage.getItem(STORE) || '{}') } catch { return {} }
  })

  useEffect(() => { try { localStorage.setItem(STORE, JSON.stringify(done)) } catch { /* ignore */ } }, [done])

  const plan = useMemo(() => {
    const d = new Date(`${start}T12:00:00`)
    if (isNaN(d.getTime())) return []
    return buildPlan({ start: d, days, unit, restFridays })
  }, [start, days, unit, restFridays])

  const doneCount = plan.filter((d) => done[d.index]).length
  const perDay = plan.length ? [Math.min(...plan.map((d) => d.pages)), Math.max(...plan.map((d) => d.pages))] : [0, 0]
  const ramadan = useMemo(() => nextRamadanStart(today), [today])

  async function download() {
    setBusy(true)
    try {
      const blob = await buildPlanPdf(plan, locale, {
        title: s.title, day: s.dayCol, date: s.dateCol, pages: s.pagesCol, juz: s.juzCol,
        done: s.done, note: s.note,
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'khatma-plan.pdf'
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 4000)
    } finally { setBusy(false) }
  }

  return (
    <Stack data-testid="khatma">
      <Panel>
        <div className="grid gap-3 grid-cols-2 min-[620px]:grid-cols-4">
          <Field label={s.start}>
            <Input type="date" value={start} data-testid="kh-start" onChange={(e) => setStart(e.target.value)} />
          </Field>
          <Field label={s.days}>
            <Input type="number" min={1} max={400} value={days} data-testid="kh-days"
              onChange={(e) => setDays(Math.min(400, Math.max(1, Number(e.target.value) || 1)))} />
          </Field>
          <Field label={s.unit}>
            <Seg data-testid="kh-unit">
              <SegButton active={unit === 'pages'} onClick={() => setUnit('pages')} data-testid="kh-unit-pages">{s.pages}</SegButton>
              <SegButton active={unit === 'juz'} onClick={() => setUnit('juz')} data-testid="kh-unit-juz">{s.juz}</SegButton>
            </Seg>
          </Field>
          <div className="flex items-end">
            <Check><input type="checkbox" checked={restFridays} data-testid="kh-fridays"
              onChange={(e) => setRestFridays(e.target.checked)} /> {s.fridays}</Check>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button className="px-3 py-1" data-testid="kh-preset-ramadan"
            onClick={() => { setStart(iso(ramadan)); setDays(30) }}>{s.ramadan}</Button>
          <Button className="px-3 py-1" data-testid="kh-preset-30" onClick={() => setDays(30)}>{s.month}</Button>
          <Button className="px-3 py-1" data-testid="kh-preset-7" onClick={() => setDays(7)}>{s.week}</Button>
          <span className="text-[0.82rem] text-ink-faint rtl:font-ar" data-testid="kh-ramadan">
            {s.ramadanIs(`${ramadan.toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`)}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button variant="primary" onClick={download} disabled={busy || !plan.length} data-testid="kh-download">
            <DownloadIcon /> {busy ? s.working : s.download}
          </Button>
          <span className="text-[0.9rem] text-ink font-mono" data-testid="kh-rate">
            {perDay[0] === perDay[1] ? s.perDay(perDay[0]) : s.perDayRange(perDay[0], perDay[1])}
          </span>
          <span className="text-[0.85rem] text-ink-faint" data-testid="kh-progress">{s.progress(doneCount, plan.length)}</span>
          {doneCount > 0 && (
            <Button className="px-3 py-1" onClick={() => setDone({})} data-testid="kh-reset">{s.reset}</Button>
          )}
        </div>
      </Panel>

      {plan.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="font-body text-[0.68rem] uppercase tracking-[0.06em] text-ink-faint">{s.plan}</h2>
          <div className="overflow-x-auto border border-[color:var(--line)] rounded-md bg-[var(--surface)]">
            <table className="w-full text-[0.85rem] border-collapse" data-testid="kh-plan">
              <thead>
                <tr className="text-ink-faint text-[0.72rem] uppercase tracking-[0.05em]">
                  <th className="text-start px-3 py-2 font-body">{s.dayCol}</th>
                  <th className="text-start px-3 py-2 font-body">{s.dateCol}</th>
                  <th className="text-start px-3 py-2 font-body">{s.pagesCol}</th>
                  <th className="text-start px-3 py-2 font-body">{s.juzCol}</th>
                  <th className="text-start px-3 py-2 font-body">{s.done}</th>
                </tr>
              </thead>
              <tbody>
                {plan.map((d) => (
                  <tr key={d.index} data-testid={`kh-day-${d.index}`}
                    className={`border-t border-[color:var(--line-soft)] ${done[d.index] ? 'text-ink-faint line-through' : 'text-ink'}`}>
                    <td className="px-3 py-1.5 font-mono">{d.index}</td>
                    <td className="px-3 py-1.5 whitespace-nowrap">
                      {d.date.toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en-GB', { day: '2-digit', month: 'short' })}
                      <span className="text-ink-faint"> · {formatHijri(d.date, locale)}</span>
                    </td>
                    <td className="px-3 py-1.5 font-mono whitespace-nowrap">{d.fromPage}–{d.toPage}</td>
                    <td className="px-3 py-1.5 font-mono">{d.juz.length > 1 ? `${d.juz[0]}–${d.juz[d.juz.length - 1]}` : d.juz[0]}</td>
                    <td className="px-3 py-1.5">
                      <input type="checkbox" className="size-[1.05rem] accent-green-600" checked={!!done[d.index]}
                        data-testid={`kh-done-${d.index}`}
                        onChange={(e) => setDone((p) => ({ ...p, [d.index]: e.target.checked }))} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <Panel className="gap-1">
        <p className="text-[0.85rem] text-ink-soft rtl:font-ar" data-testid="kh-mushaf-note">{s.mushafNote}</p>
        <p className="text-[0.85rem] text-ink-faint rtl:font-ar">{s.scopeNote}</p>
        <p className="text-[0.85rem] text-ink-faint font-mono">{TOTAL_PAGES} pages · 30 juz</p>
      </Panel>
    </Stack>
  )
}
