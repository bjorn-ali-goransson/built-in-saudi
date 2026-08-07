import { useMemo, useState } from 'react'
import { useLocale } from '../../i18n'
import { Button, Input, Textarea, Field, Check, Stack, Panel, Seg, SegButton } from '../../components/ui'
import { DownloadIcon } from '../../components/icons'
import { DEFAULTS, buildSheetPdf, columnsFor, type Mode, type SheetOptions } from './attendance'

const SAMPLE = {
  en: 'Ahmed Al-Otaibi\nSara Al-Harbi\nYousef Al-Qahtani\nNoura Al-Dossari\nKhalid Al-Shammari\nLama Al-Zahrani\nFaisal Al-Ghamdi\nReem Al-Anazi',
  ar: 'أحمد العتيبي\nسارة الحربي\nيوسف القحطاني\nنورة الدوسري\nخالد الشمري\nلمى الزهراني\nفيصل الغامدي\nريم العنزي',
}

const DAYS = {
  en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  ar: ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'],
}

const STR = {
  en: {
    names: 'Class list — one name per line', sample: 'Load a sample class',
    mode: 'Columns are', modes: { dates: 'School days', sessions: 'Numbered', custom: 'My own headings' } as Record<Mode, string>,
    start: 'Starting', columns: 'How many',
    weekend: 'Weekend', weekendNote: 'Weekend days are skipped, so the sheet only has columns for days you actually teach. Defaulted to Friday and Saturday — a register built on a Saturday-Sunday weekend prints two columns nobody ticks and misses two teaching days.',
    headings: 'Headings', headingsPh: 'Quiz 1, Quiz 2, Project, Final',
    total: 'Total column', hijri: 'Hijri dates', landscape: 'Landscape',
    title: 'Title', titlePh: 'Class 4B — Attendance',
    download: 'Download PDF', working: 'Building…',
    preview: 'Preview', size: (r: number, c: number) => `${r} students × ${c} columns`,
    pages: (n: number) => `${n} page${n === 1 ? '' : 's'}`,
    empty: 'Add some names.',
    labelTitle: 'Attendance', labelName: 'Name', labelNo: 'No.', labelTotal: 'Total', labelTeacher: 'Teacher',
  },
  ar: {
    names: 'قائمة الفصل — اسم في كل سطر', sample: 'حمّل فصلًا تجريبيًا',
    mode: 'الأعمدة', modes: { dates: 'أيام الدراسة', sessions: 'مرقّمة', custom: 'عناوين من عندي' } as Record<Mode, string>,
    start: 'تبدأ من', columns: 'العدد',
    weekend: 'العطلة', weekendNote: 'تُتخطّى أيام العطلة، فلا تكون في الورقة إلا أعمدة الأيام التي تدرّس فيها فعلًا. والافتراضي الجمعة والسبت — فالسجل المبني على عطلة السبت والأحد يطبع عمودين لا يعلّم فيهما أحد ويسقط يومَي تدريس.',
    headings: 'العناوين', headingsPh: 'اختبار ١، اختبار ٢، مشروع، النهائي',
    total: 'عمود المجموع', hijri: 'تواريخ هجرية', landscape: 'عرضية',
    title: 'العنوان', titlePh: 'الصف الرابع ب — الحضور',
    download: 'نزّل PDF', working: 'جارٍ التجهيز…',
    preview: 'معاينة', size: (r: number, c: number) => `${r} طالبًا × ${c} عمودًا`,
    pages: (n: number) => `${n} صفحة`,
    empty: 'أضف أسماء.',
    labelTitle: 'كشف الحضور', labelName: 'الاسم', labelNo: 'م', labelTotal: 'المجموع', labelTeacher: 'المعلّم',
  },
}

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export default function AttendanceSheetTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const [raw, setRaw] = useState('')
  const [o, setO] = useState<SheetOptions>({ ...DEFAULTS, start: iso(new Date()) })
  const [busy, setBusy] = useState(false)

  const set = <K extends keyof SheetOptions>(k: K, v: SheetOptions[K]) => setO((p) => ({ ...p, [k]: v }))
  const names = useMemo(() => raw.split('\n').map((x) => x.trim()).filter(Boolean), [raw])
  const cols = useMemo(() => columnsFor(o, locale), [o, locale])
  const pageCount = Math.max(1, Math.ceil(names.length / (o.landscape ? 22 : 34)))

  async function download() {
    setBusy(true)
    try {
      const blob = await buildSheetPdf(names, cols, o, {
        title: s.labelTitle, name: s.labelName, no: s.labelNo, total: s.labelTotal, teacher: s.labelTeacher,
      }, locale)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'attendance-sheet.pdf'
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 4000)
    } finally { setBusy(false) }
  }

  return (
    <Stack data-testid="attendance-sheet">
      <Panel>
        <Field label={s.names}>
          <Textarea rows={5} value={raw} data-testid="as-names" onChange={(e) => setRaw(e.target.value)} />
        </Field>
        <div className="flex flex-wrap items-center gap-3">
          <Button className="px-3 py-1" onClick={() => setRaw(SAMPLE[locale])} data-testid="as-sample">{s.sample}</Button>
          <span className="text-[0.85rem] text-ink-faint" data-testid="as-size">{s.size(names.length, cols.length)}</span>
          <span className="text-[0.85rem] text-ink-faint" data-testid="as-pages">{s.pages(pageCount)}</span>
        </div>

        <div className="grid gap-3 grid-cols-2 min-[620px]:grid-cols-4">
          <Field label={s.mode}>
            <Seg data-testid="as-mode">
              {(['dates', 'sessions', 'custom'] as Mode[]).map((m) => (
                <SegButton key={m} active={o.mode === m} onClick={() => set('mode', m)} data-testid={`as-mode-${m}`}>{s.modes[m]}</SegButton>
              ))}
            </Seg>
          </Field>
          {o.mode === 'dates' && (
            <Field label={s.start}>
              <Input type="date" value={o.start} data-testid="as-start" onChange={(e) => set('start', e.target.value)} />
            </Field>
          )}
          {o.mode !== 'custom' && (
            <Field label={s.columns}>
              <Input type="number" min={1} max={40} value={o.columns} data-testid="as-columns"
                onChange={(e) => set('columns', Math.min(40, Math.max(1, Number(e.target.value) || 1)))} />
            </Field>
          )}
          <Field label={s.title}>
            <Input value={o.title} placeholder={s.titlePh} data-testid="as-title" onChange={(e) => set('title', e.target.value)} />
          </Field>
        </div>

        {o.mode === 'custom' && (
          <Field label={s.headings}>
            <Textarea rows={2} value={o.customHeadings} placeholder={s.headingsPh} data-testid="as-headings"
              onChange={(e) => set('customHeadings', e.target.value)} />
          </Field>
        )}

        {o.mode === 'dates' && (
          <div className="flex flex-col gap-2">
            <span className="text-[0.82rem] font-semibold text-ink-soft">{s.weekend}</span>
            <div className="flex flex-wrap gap-1" data-testid="as-weekend">
              {DAYS[locale].map((d, i) => (
                <button key={i} data-testid={`as-day-${i}`} aria-pressed={o.weekend.includes(i)}
                  onClick={() => set('weekend', o.weekend.includes(i) ? o.weekend.filter((x) => x !== i) : [...o.weekend, i])}
                  className={`px-2.5 py-1 rounded-md border text-[0.82rem] ${o.weekend.includes(i)
                    ? 'border-gold-500 bg-[color-mix(in_srgb,var(--color-gold-400)_18%,transparent)] text-ink'
                    : 'border-[color:var(--line)] bg-[var(--surface)] text-ink-soft'}`}>
                  {d}
                </button>
              ))}
            </div>
            <span className="text-[0.8rem] text-ink-faint rtl:font-ar">{s.weekendNote}</span>
          </div>
        )}

        <div className="flex flex-wrap gap-4">
          <Check><input type="checkbox" checked={o.total} data-testid="as-total" onChange={(e) => set('total', e.target.checked)} /> {s.total}</Check>
          {o.mode === 'dates' && (
            <Check><input type="checkbox" checked={o.hijri} data-testid="as-hijri" onChange={(e) => set('hijri', e.target.checked)} /> {s.hijri}</Check>
          )}
          <Check><input type="checkbox" checked={o.landscape} data-testid="as-landscape" onChange={(e) => set('landscape', e.target.checked)} /> {s.landscape}</Check>
        </div>

        <Button variant="primary" className="self-start" onClick={download} disabled={busy || !names.length || !cols.length} data-testid="as-download">
          <DownloadIcon /> {busy ? s.working : s.download}
        </Button>
      </Panel>

      {names.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="font-body text-[0.68rem] uppercase tracking-[0.06em] text-ink-faint">{s.preview}</h2>
          <div className="overflow-x-auto border border-[color:var(--line)] rounded-md bg-[var(--surface)]">
            <table className="text-[0.78rem] border-collapse" data-testid="as-preview">
              <thead>
                <tr>
                  <th className="px-2 py-1 text-start font-body text-[0.68rem] uppercase text-ink-faint border-b border-[color:var(--line)]">{s.labelName}</th>
                  {cols.map((c, i) => (
                    <th key={i} data-testid={`as-col-${i}`}
                      className="px-1 py-1 text-center font-mono text-[0.7rem] text-ink-soft border-b border-s border-[color:var(--line)] min-w-[2.2rem]">
                      {c.label}{c.sub && <span className="block text-[0.6rem] text-ink-faint">{c.sub}</span>}
                    </th>
                  ))}
                  {o.total && <th className="px-2 py-1 text-center font-body text-[0.68rem] uppercase text-ink-faint border-b border-s border-[color:var(--line)]">{s.labelTotal}</th>}
                </tr>
              </thead>
              <tbody>
                {names.slice(0, 10).map((n, r) => (
                  <tr key={r} data-testid={`as-row-${r}`}>
                    <td className="px-2 py-1 whitespace-nowrap text-ink border-b border-[color:var(--line-soft)]">{n}</td>
                    {cols.map((_, i) => <td key={i} className="border-b border-s border-[color:var(--line-soft)]" />)}
                    {o.total && <td className="border-b border-s border-[color:var(--line-soft)]" />}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        <p className="text-ink-faint rtl:font-ar" data-testid="as-empty">{s.empty}</p>
      )}
    </Stack>
  )
}
