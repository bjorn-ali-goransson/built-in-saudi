import { useEffect, useMemo, useState } from 'react'
import { useLocale, localePath } from '../../i18n'
import { Stack, Panel, Field, Input, Check } from '../../components/ui'
import {
  DAY_LABEL, SCHOOL_WEEK, WEEK, columnOrder, emptyTimetable, isEmpty,
  type DayKey, type Timetable,
} from './timetable'

const KEY = 'bis-timetable'

const STR = {
  en: {
    intro: 'A weekly timetable you can fill in and print. It stays in your browser.',
    title: 'Title', weekend: 'Include Friday and Saturday',
    rows: 'Rows', addRow: 'Add a row', download: 'Download the PDF',
    empty: 'Type into the grid and it will print what you see.',
    sundayTitle: 'The week starts on Sunday, and that is not a preference',
    sundayBody: 'Friday and Saturday are the weekend here, so a Monday-first grid puts the weekend in the middle of the sheet and the school week broken across it. Every generic timetable maker starts on Monday, which is right where those tools were written and wrong here.',
    rtlTitle: 'In Arabic the COLUMNS reverse, not just the labels',
    rtlBody: 'A tool that supports Arabic by translating the day names and leaving the grid alone prints the week backwards: Sunday ends up on the far left, where an Arabic reader finishes rather than starts. Reversing the column order is the whole of the fix, and the printed sheet has to do it too — a canvas has no reading direction to inherit, so a grid that looked right on screen would still print the wrong way round.',
    related: 'Seating plans and attendance: Seating Chart',
  },
  ar: {
    intro: 'جدول أسبوعي تملؤه وتطبعه. ويبقى داخل متصفحك.',
    title: 'العنوان', weekend: 'أضف الجمعة والسبت',
    rows: 'الصفوف', addRow: 'أضف صفًا', download: 'نزّل ملف PDF',
    empty: 'اكتب في الجدول وسيُطبع كما تراه.',
    sundayTitle: 'الأسبوع يبدأ الأحد، وليست هذه مسألة تفضيل',
    sundayBody: 'الجمعة والسبت عطلة هنا، فالجدول الذي يبدأ الاثنين يضع العطلة في وسط الورقة ويقطع الأسبوع الدراسي عليها. وكل صانعي الجداول العامّين يبدؤون بالاثنين، وهو صحيح حيث كُتبت تلك الأدوات وخطأ هنا.',
    rtlTitle: 'في العربية تنعكس الأعمدة لا المسمّيات وحدها',
    rtlBody: 'الأداة التي «تدعم العربية» بترجمة أسماء الأيام وترك الشبكة كما هي تطبع الأسبوع معكوسًا: فيقع الأحد أقصى اليسار، حيث ينتهي القارئ العربي لا حيث يبدأ. وعكس ترتيب الأعمدة هو الحل كله، وعلى الورقة المطبوعة أن تفعله أيضًا — فلوحة الرسم لا ترث اتجاه قراءة، ولولا ذلك لطُبع الجدول مقلوبًا وإن بدا صحيحًا على الشاشة.',
    related: 'مخططات الجلوس والحضور: مخطط الجلوس',
  },
}

export default function TimetableTool() {
  const { locale } = useLocale()
  const l = locale === 'ar' ? 'ar' : 'en'
  const s = STR[l]
  const rtl = l === 'ar'

  const [t, setT] = useState<Timetable>(() => {
    try {
      const raw = localStorage.getItem(KEY)
      if (raw) return JSON.parse(raw) as Timetable
    } catch { /* ignore */ }
    return emptyTimetable(l)
  })
  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(t)) } catch { /* ignore */ }
  }, [t])

  const [busy, setBusy] = useState(false)
  const cols = useMemo(() => columnOrder(t.days, rtl), [t.days, rtl])

  const setCell = (row: number, day: DayKey, v: string) =>
    setT((x) => ({
      ...x,
      slots: x.slots.map((sl, i) => (i === row ? { ...sl, cells: { ...sl.cells, [day]: v } } : sl)),
    }))

  const setLabel = (row: number, v: string) =>
    setT((x) => ({ ...x, slots: x.slots.map((sl, i) => (i === row ? { ...sl, label: v } : sl)) }))

  const toggleWeekend = (on: boolean) =>
    setT((x) => ({ ...x, days: on ? [...WEEK] : [...SCHOOL_WEEK] }))

  async function download() {
    setBusy(true)
    try {
      const { timetablePdf } = await import('./draw')
      const blob = await timetablePdf(t, l)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'timetable.pdf'
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } finally { setBusy(false) }
  }

  return (
    <Stack data-testid="timetable">
      <p className="text-ink-faint">{s.intro}</p>

      <div className="flex flex-wrap items-end gap-4">
        <Field label={s.title}>
          <Input value={t.title} onChange={(e) => setT((x) => ({ ...x, title: e.target.value }))}
            data-testid="tt-title" />
        </Field>
        <Check>
          <input type="checkbox" checked={t.days.length === 7} data-testid="tt-weekend"
            onChange={(e) => toggleWeekend(e.target.checked)} />
          {s.weekend}
        </Check>
      </div>

      <div className="overflow-x-auto">
        <table className="border-collapse w-full min-w-[36rem]" data-testid="tt-grid">
          <thead>
            <tr>
              <th className="border border-line bg-sand-100/50 p-1 text-[0.78rem]" />
              {cols.map((d) => (
                <th key={d} data-testid={`tt-head-${d}`}
                  className="border border-line bg-sand-100/50 p-1 text-[0.78rem] font-semibold rtl:font-ar">
                  {DAY_LABEL[d][l]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {t.slots.map((slot, r) => (
              <tr key={r}>
                <td className="border border-line p-0">
                  <input value={slot.label} onChange={(e) => setLabel(r, e.target.value)}
                    data-testid={`tt-label-${r}`}
                    className="w-full bg-transparent border-0 p-1 text-[0.78rem] text-ink-faint rtl:font-ar" />
                </td>
                {cols.map((d) => (
                  <td key={d} className="border border-line p-0">
                    <input value={slot.cells[d] ?? ''} onChange={(e) => setCell(r, d, e.target.value)}
                      data-testid={`tt-cell-${r}-${d}`}
                      className="w-full bg-transparent border-0 p-1 text-[0.85rem] rtl:font-ar" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap gap-3">
        <button type="button" data-testid="tt-add"
          onClick={() => setT((x) => ({ ...x, slots: [...x.slots, { label: '', cells: {} }] }))}
          className="rounded-md border border-line bg-surface px-3 py-2 text-ink cursor-pointer">
          {s.addRow}
        </button>
        <button type="button" onClick={download} disabled={busy} data-testid="tt-download"
          className="rounded-md border border-green-600 bg-green-600 text-paper px-4 py-2 cursor-pointer disabled:opacity-50">
          {s.download}
        </button>
      </div>
      {isEmpty(t) ? <p className="text-ink-faint text-sm" data-testid="tt-empty">{s.empty}</p> : null}

      <Panel>
        <h3 className="font-display text-lg">{s.sundayTitle}</h3>
        <p className="text-ink-faint text-sm" data-testid="tt-sunday">{s.sundayBody}</p>
      </Panel>

      <Panel>
        <h3 className="font-display text-lg">{s.rtlTitle}</h3>
        <p className="text-ink-faint text-sm" data-testid="tt-rtl">{s.rtlBody}</p>
      </Panel>

      <p className="text-sm">
        <a href={localePath(locale, '/apps/seating-chart')}>{s.related}</a>
      </p>
    </Stack>
  )
}
