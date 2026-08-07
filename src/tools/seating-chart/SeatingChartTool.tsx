import { useMemo, useState } from 'react'
import { useLocale } from '../../i18n'
import { Button, Input, Textarea, Field, Stack, Panel, Seg, SegButton } from '../../components/ui'
import { DownloadIcon, RefreshIcon, TrashIcon } from '../../components/icons'
import { newSeed } from '../../lib/printPdf'
import { DEFAULTS, buildChartPdf, forView, makePlan, type SeatOptions } from './seating'

const SAMPLE = {
  en: 'Ahmed\nSara\nYousef\nNoura\nKhalid\nLama\nFaisal\nReem\nOmar\nHessa\nSalman\nMaha\nTurki\nDana\nBader\nJood\nNasser\nShahad\nMajed\nAreej',
  ar: 'أحمد\nسارة\nيوسف\nنورة\nخالد\nلمى\nفيصل\nريم\nعمر\nحصة\nسلمان\nمها\nتركي\nدانة\nبدر\nجود\nناصر\nشهد\nماجد\nأريج',
}

const STR = {
  en: {
    names: 'Class list — one name per line', sample: 'Load a sample class',
    rows: 'Rows', cols: 'Desks per row',
    seats: (n: number, cap: number) => `${n} students · ${cap} desks`,
    tooMany: (n: number) => `${n} more students than desks — add rows or desks.`,
    apart: 'Keep apart', apartHint: 'Two names who must not sit next to each other.',
    addApart: 'Add pair', pickTwo: 'Pick two different names.',
    view: 'Drawn as seen by', teacher: 'The teacher', classView: 'The class',
    viewNote: 'A chart drawn from where you stand is mirrored from where they sit. Say which view it is, or the front row ends up at the back.',
    seed: 'Chart code', regenerate: 'New arrangement',
    seedWhy: 'The same code always seats the same people in the same desks, so a reprint matches the chart already on your desk.',
    title: 'Title', titlePh: 'Class 4B',
    download: 'Download PDF', working: 'Building…',
    front: 'FRONT OF THE ROOM',
    plan: 'Seating', empty: 'Add some names.',
    unsatisfied: (n: number) => `${n} keep-apart pair${n === 1 ? '' : 's'} could not be separated — the room is too full, or the rules conflict. They are listed below so you can decide, rather than being quietly ignored.`,
    labelTitle: 'Seating chart',
    viewLabelTeacher: 'As the teacher sees the room', viewLabelClass: 'As the class sees the room',
  },
  ar: {
    names: 'قائمة الفصل — اسم في كل سطر', sample: 'حمّل فصلًا تجريبيًا',
    rows: 'الصفوف', cols: 'المقاعد في الصف',
    seats: (n: number, cap: number) => `${n} طالبًا · ${cap} مقعدًا`,
    tooMany: (n: number) => `${n} طالبًا زيادة على المقاعد — أضف صفوفًا أو مقاعد.`,
    apart: 'لا يجلسان معًا', apartHint: 'اسمان يجب ألا يتجاورا.',
    addApart: 'أضف زوجًا', pickTwo: 'اختر اسمين مختلفين.',
    view: 'مرسومة كما يراها', teacher: 'المعلّم', classView: 'الفصل',
    viewNote: 'المخطط المرسوم من حيث تقف معكوسٌ من حيث يجلسون. فبيّن أي رؤية هي، وإلا صار الصف الأول في الخلف.',
    seed: 'رمز المخطط', regenerate: 'توزيع جديد',
    seedWhy: 'الرمز نفسه يُجلس الطلاب أنفسهم في المقاعد نفسها دائمًا، فتطابق إعادةُ الطباعة المخططَ الذي على مكتبك.',
    title: 'العنوان', titlePh: 'الصف الرابع ب',
    download: 'نزّل PDF', working: 'جارٍ التجهيز…',
    front: 'مقدمة الفصل',
    plan: 'التوزيع', empty: 'أضف أسماء.',
    unsatisfied: (n: number) => `تعذّر الفصل بين ${n} زوجًا — فالقاعة ممتلئة أو القواعد متعارضة. وهي مذكورة أدناه لتقرّر بشأنها، لا مُهمَلة في صمت.`,
    labelTitle: 'مخطط الجلوس',
    viewLabelTeacher: 'كما يرى المعلّم القاعة', viewLabelClass: 'كما يرى الفصل القاعة',
  },
}

export default function SeatingChartTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const [raw, setRaw] = useState('')
  const [o, setO] = useState<SeatOptions>({ ...DEFAULTS, seed: 'ABC123' })
  const [a, setA] = useState('')
  const [b, setB] = useState('')
  const [busy, setBusy] = useState(false)

  const set = <K extends keyof SeatOptions>(k: K, v: SeatOptions[K]) => setO((p) => ({ ...p, [k]: v }))
  const names = useMemo(() => raw.split('\n').map((x) => x.trim()).filter(Boolean), [raw])
  const opts = useMemo(() => ({ ...o, names }), [o, names])
  const plan = useMemo(() => makePlan(opts), [opts])
  const shown = useMemo(() => forView(plan, o.view), [plan, o.view])
  const capacity = o.rows * o.cols
  const over = Math.max(0, names.length - capacity)

  async function download() {
    setBusy(true)
    try {
      const blob = await buildChartPdf(plan, opts, {
        front: s.front,
        title: s.labelTitle,
        view: o.view === 'teacher' ? s.viewLabelTeacher : s.viewLabelClass,
      })
      const url = URL.createObjectURL(blob)
      const el = document.createElement('a')
      el.href = url
      el.download = `seating-${o.seed}.pdf`
      el.click()
      setTimeout(() => URL.revokeObjectURL(url), 4000)
    } finally { setBusy(false) }
  }

  return (
    <Stack data-testid="seating-chart">
      <Panel>
        <Field label={s.names}>
          <Textarea rows={5} value={raw} data-testid="sc-names" onChange={(e) => setRaw(e.target.value)} />
        </Field>
        <div className="flex flex-wrap items-center gap-3">
          <Button className="px-3 py-1" onClick={() => setRaw(SAMPLE[locale])} data-testid="sc-sample">{s.sample}</Button>
          <span className="text-[0.85rem] text-ink-faint" data-testid="sc-count">{s.seats(names.length, capacity)}</span>
          {over > 0 && <span className="text-[0.85rem] text-gold-500 rtl:font-ar" data-testid="sc-over">{s.tooMany(over)}</span>}
        </div>

        <div className="grid gap-3 grid-cols-2 min-[620px]:grid-cols-4">
          <Field label={s.rows}>
            <Input type="number" min={1} max={12} value={o.rows} data-testid="sc-rows"
              onChange={(e) => set('rows', Math.min(12, Math.max(1, Number(e.target.value) || 1)))} />
          </Field>
          <Field label={s.cols}>
            <Input type="number" min={1} max={12} value={o.cols} data-testid="sc-cols"
              onChange={(e) => set('cols', Math.min(12, Math.max(1, Number(e.target.value) || 1)))} />
          </Field>
          <Field label={s.view}>
            <Seg data-testid="sc-view">
              <SegButton active={o.view === 'teacher'} onClick={() => set('view', 'teacher')} data-testid="sc-view-teacher">{s.teacher}</SegButton>
              <SegButton active={o.view === 'class'} onClick={() => set('view', 'class')} data-testid="sc-view-class">{s.classView}</SegButton>
            </Seg>
          </Field>
          <Field label={s.title}>
            <Input value={o.title} placeholder={s.titlePh} data-testid="sc-title" onChange={(e) => set('title', e.target.value)} />
          </Field>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-[0.82rem] font-semibold text-ink-soft">{s.apart}</span>
          <div className="flex flex-wrap items-center gap-2">
            <select className="rounded-md border border-[color:var(--line)] bg-[var(--surface)] px-2 py-1.5 text-[0.9rem] text-ink"
              value={a} data-testid="sc-apart-a" onChange={(e) => setA(e.target.value)}>
              <option value="">—</option>
              {names.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
            <select className="rounded-md border border-[color:var(--line)] bg-[var(--surface)] px-2 py-1.5 text-[0.9rem] text-ink"
              value={b} data-testid="sc-apart-b" onChange={(e) => setB(e.target.value)}>
              <option value="">—</option>
              {names.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
            <Button className="px-3 py-1" data-testid="sc-apart-add"
              onClick={() => { if (a && b && a !== b) { set('apart', [...o.apart, [a, b]]); setA(''); setB('') } }}>
              {s.addApart}
            </Button>
          </div>
          {o.apart.length > 0 && (
            <div className="flex flex-wrap gap-2" data-testid="sc-apart-list">
              {o.apart.map(([x, y], i) => (
                <span key={`${x}-${y}-${i}`} className="inline-flex items-center gap-1 text-[0.82rem] px-2 py-1 rounded-sm border border-[color:var(--line)] bg-[var(--surface)] text-ink">
                  {x} ↮ {y}
                  <button aria-label="remove" data-testid={`sc-apart-remove-${i}`} className="border-0 bg-transparent cursor-pointer p-0 text-ink-faint"
                    onClick={() => set('apart', o.apart.filter((_, k) => k !== i))}><TrashIcon /></button>
                </span>
              ))}
            </div>
          )}
          <span className="text-[0.8rem] text-ink-faint rtl:font-ar">{s.apartHint}</span>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <Field label={s.seed} className="w-[9rem]">
            <Input value={o.seed} className="font-mono" data-testid="sc-seed" onChange={(e) => set('seed', e.target.value.toUpperCase())} />
          </Field>
          <Button onClick={() => set('seed', newSeed())} data-testid="sc-regenerate"><RefreshIcon /> {s.regenerate}</Button>
          <Button variant="primary" onClick={download} disabled={busy || !names.length} data-testid="sc-download">
            <DownloadIcon /> {busy ? s.working : s.download}
          </Button>
        </div>
        <p className="text-[0.82rem] text-ink-faint rtl:font-ar">{s.seedWhy}</p>
      </Panel>

      {plan.unsatisfied.length > 0 && (
        <p className="text-[0.9rem] text-gold-500 rtl:font-ar" data-testid="sc-unsatisfied">
          {s.unsatisfied(plan.unsatisfied.length)} {plan.unsatisfied.map(([x, y]) => `${x} ↮ ${y}`).join(' · ')}
        </p>
      )}

      {names.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="font-body text-[0.68rem] uppercase tracking-[0.06em] text-ink-faint">{s.plan}</h2>
          <div className="rounded-md bg-[color-mix(in_srgb,var(--color-green-400)_14%,transparent)] text-green-700 text-[0.72rem] font-semibold tracking-[0.08em] text-center py-1.5">
            {s.front}
          </div>
          <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${o.cols}, minmax(0, 1fr))` }} data-testid="sc-grid">
            {shown.map((n, i) => (
              <div key={i} data-testid={`sc-seat-${i}`}
                className={`min-h-[3rem] flex items-center justify-center text-center px-1 text-[0.8rem] rounded-sm border ${n ? 'border-[color:var(--line)] bg-[var(--surface)] text-ink' : 'border-dashed border-[color:var(--line-soft)] text-transparent'}`}>
                {n ?? '·'}
              </div>
            ))}
          </div>
          <p className="text-[0.82rem] text-ink-faint rtl:font-ar">{s.viewNote}</p>
        </section>
      ) : (
        <p className="text-ink-faint rtl:font-ar" data-testid="sc-empty">{s.empty}</p>
      )}
    </Stack>
  )
}
