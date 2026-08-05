import { useEffect, useMemo, useState } from 'react'
import { useLocale } from '../../i18n'
import { Button, Disclaimer, Input, Panel, Select, Stack } from '../../components/ui'
import { TrashIcon, CalendarIcon } from '../../components/icons'
import { HIJRI_MONTHS } from '../prayer-times/islamic'
import {
  load, save, daysLeft, status, STATUS_TONE, KINDS, KIND_LABEL, LEAD_DAYS,
  hijriInputToIso, isoToHijri, bothCalendars, newId,
  type Doc, type DocKind, type Calendar,
} from './docs'

const STR = {
  en: {
    add: 'Add a document', kind: 'Type', label: 'Label (optional)', labelPh: 'e.g. mine, my son’s',
    calendar: 'Date is', gregorian: 'Gregorian', hijri: 'Hijri',
    expiry: 'Expiry date', year: 'Year', month: 'Month', day: 'Day',
    save: 'Add', remove: 'Remove', empty: 'Nothing tracked yet. Add a document and it stays on this device.',
    left: (n: number) => `${n} day${n === 1 ? '' : 's'} left`,
    ago: (n: number) => `Expired ${n} day${n === 1 ? '' : 's'} ago`,
    todayMsg: 'Expires today',
    renewFrom: (n: number) => `Worth renewing from ${n} days out`,
    privacy: 'Everything here is stored in this browser only. Nothing is uploaded, and there is no account.',
    notAdvice: 'A late renewal can carry a fine, and the official record is the one that counts — check Absher or Muqeem, not this.',
    heading: 'What you are tracking',
  },
  ar: {
    add: 'أضف مستندًا', kind: 'النوع', label: 'وسم (اختياري)', labelPh: 'مثال: خاصتي، ابني',
    calendar: 'التاريخ', gregorian: 'ميلادي', hijri: 'هجري',
    expiry: 'تاريخ الانتهاء', year: 'السنة', month: 'الشهر', day: 'اليوم',
    save: 'أضف', remove: 'حذف', empty: 'لا شيء متابَع بعد. أضف مستندًا وسيبقى على هذا الجهاز.',
    left: (n: number) => `بقي ${n.toLocaleString('ar')} يومًا`,
    ago: (n: number) => `انتهى قبل ${n.toLocaleString('ar')} يومًا`,
    todayMsg: 'ينتهي اليوم',
    renewFrom: (n: number) => `يُستحسن التجديد قبل ${n.toLocaleString('ar')} يومًا`,
    privacy: 'كل ما هنا محفوظ في هذا المتصفح فقط. لا يُرفع شيء، ولا يوجد حساب.',
    notAdvice: 'قد يترتّب على التأخير في التجديد غرامة، والسجل الرسمي هو المعتبر — تحقّق من أبشر أو مقيم لا من هذه الأداة.',
    heading: 'ما تتابعه',
  },
}

const todayIso = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function IdExpiryTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const [docs, setDocs] = useState<Doc[]>([])
  const [kind, setKind] = useState<DocKind>('iqama')
  const [label, setLabel] = useState('')
  const [calendar, setCalendar] = useState<Calendar>('gregorian')
  const [greg, setGreg] = useState(todayIso())
  const [h, setH] = useState(() => isoToHijri(todayIso()))

  useEffect(() => { setDocs(load()) }, [])
  useEffect(() => { save(docs) }, [docs])

  const sorted = useMemo(
    () => [...docs].sort((a, b) => daysLeft(a.expiry) - daysLeft(b.expiry)),
    [docs],
  )

  function add() {
    const expiry = calendar === 'hijri' ? hijriInputToIso(h.y, h.m, h.d) : greg
    if (!expiry) return
    setDocs((d) => [...d, { id: newId(), kind, label: label.trim(), expiry, calendar }])
    setLabel('')
  }

  return (
    <Stack data-testid="id-expiry">
      <Panel className="flex flex-col gap-3" data-testid="exp-form">
        <span className="font-body text-[0.68rem] uppercase tracking-[0.06em] text-ink-faint">{s.add}</span>
        <div className="flex flex-wrap gap-3 items-end">
          <label className="flex flex-col gap-1 text-[0.8rem] text-ink-faint">
            {s.kind}
            <Select className="min-w-[13rem]" data-testid="exp-kind" value={kind} onChange={(e) => setKind(e.target.value as DocKind)}>
              {KINDS.map((k) => <option key={k} value={k}>{KIND_LABEL[k][locale]}</option>)}
            </Select>
          </label>
          <label className="flex flex-col gap-1 text-[0.8rem] text-ink-faint">
            {s.label}
            <Input className="w-40" data-testid="exp-label" placeholder={s.labelPh} value={label} onChange={(e) => setLabel(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-[0.8rem] text-ink-faint">
            {s.calendar}
            <Select className="w-32" data-testid="exp-calendar" value={calendar} onChange={(e) => setCalendar(e.target.value as Calendar)}>
              <option value="gregorian">{s.gregorian}</option>
              <option value="hijri">{s.hijri}</option>
            </Select>
          </label>
        </div>

        {calendar === 'gregorian' ? (
          <label className="flex flex-col gap-1 text-[0.8rem] text-ink-faint w-fit">
            {s.expiry}
            <Input type="date" className="w-48" data-testid="exp-date" value={greg} onChange={(e) => setGreg(e.target.value)} />
          </label>
        ) : (
          <div className="flex flex-wrap gap-2 items-end">
            <label className="flex flex-col gap-1 text-[0.8rem] text-ink-faint">
              {s.day}
              <Input type="number" min={1} max={30} className="w-20" data-testid="exp-h-day"
                value={h.d} onChange={(e) => setH({ ...h, d: +e.target.value })} />
            </label>
            <label className="flex flex-col gap-1 text-[0.8rem] text-ink-faint">
              {s.month}
              <Select className="min-w-[9rem]" data-testid="exp-h-month" value={h.m} onChange={(e) => setH({ ...h, m: +e.target.value })}>
                {HIJRI_MONTHS[locale].map((name: string, i: number) => <option key={i} value={i + 1}>{name}</option>)}
              </Select>
            </label>
            <label className="flex flex-col gap-1 text-[0.8rem] text-ink-faint">
              {s.year}
              <Input type="number" min={1300} max={1600} className="w-24" data-testid="exp-h-year"
                value={h.y} onChange={(e) => setH({ ...h, y: +e.target.value })} />
            </label>
          </div>
        )}

        <Button variant="primary" className="self-start" onClick={add} data-testid="exp-add"><CalendarIcon /> {s.save}</Button>
      </Panel>

      {sorted.length === 0 ? (
        <p className="text-ink-faint text-[0.95rem] rtl:font-ar" data-testid="exp-empty">{s.empty}</p>
      ) : (
        <section className="flex flex-col gap-2">
          <h2 className="font-body text-[0.68rem] uppercase tracking-[0.06em] text-ink-faint">{s.heading}</h2>
          <div className="flex flex-col gap-2" data-testid="exp-list">
            {sorted.map((d) => {
              const n = daysLeft(d.expiry)
              const st = status(d)
              const both = bothCalendars(d.expiry, locale)
              return (
                <div key={d.id} data-testid={`exp-item-${d.kind}`}
                  className={`flex flex-wrap items-center gap-x-4 gap-y-1 border rounded-md bg-[var(--surface)] px-3 py-2.5 ${STATUS_TONE[st]}`}>
                  <div className="flex flex-col flex-1 min-w-[10rem]">
                    <span className="text-[0.95rem] font-semibold text-ink rtl:font-ar">
                      {KIND_LABEL[d.kind][locale]}{d.label ? ` · ${d.label}` : ''}
                    </span>
                    <span className="font-mono text-[0.78rem] text-ink-faint">{both.greg}</span>
                    <span className="text-[0.78rem] text-ink-faint rtl:font-ar">{both.hijri}</span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className={`font-display text-[1.15rem] ${st === 'expired' || st === 'urgent' ? 'text-gold-500' : 'text-ink'}`}
                      data-testid="exp-days">
                      {n < 0 ? s.ago(-n) : n === 0 ? s.todayMsg : s.left(n)}
                    </span>
                    {st === 'soon' && <span className="text-[0.76rem] text-ink-faint rtl:font-ar">{s.renewFrom(LEAD_DAYS[d.kind])}</span>}
                  </div>
                  <Button className="px-2 py-1 flex-none" aria-label={s.remove} data-testid="exp-remove"
                    onClick={() => setDocs((all) => all.filter((x) => x.id !== d.id))}>
                    <TrashIcon />
                  </Button>
                </div>
              )
            })}
          </div>
        </section>
      )}

      <p className="text-[0.85rem] text-ink-faint rtl:font-ar">{s.privacy}</p>
      <Disclaimer kind="official" locale={locale}>{s.notAdvice}</Disclaimer>
    </Stack>
  )
}
