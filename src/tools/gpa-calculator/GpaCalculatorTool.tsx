import { useMemo, useState } from 'react'
import { useLocale } from '../../i18n'
import { Button, Stack, Panel, Field, Input, Select, Seg, SegButton, Check, Disclaimer } from '../../components/ui'
import { TrashIcon } from '../../components/icons'
import { calcGpa, classify, LETTERS, POINTS, RANGES, type Course, type Letter } from './gpa'

const STR = {
  en: {
    intro: 'Work out a GPA on the Saudi 5.00 scale or the 4.00 one, course by course, and convert between them properly. Nothing is sent anywhere — your marks stay in your browser.',
    scale: 'Scale', five: 'Out of 5.00', four: 'Out of 4.00',
    course: 'Course', credits: 'Credits', grade: 'Grade', remove: 'Remove', add: 'Add a course',
    gpa: 'GPA', classification: 'Classification', totalCredits: 'Credit hours', points: 'Points',
    grades: { excellent: 'Excellent', veryGood: 'Very good', good: 'Good', pass: 'Pass', below: 'Below the pass line' } as Record<string, string>,
    cumulative: 'I already have a GPA',
    priorGpa: 'Previous GPA', priorCredits: 'Credits behind it',
    priorNote: 'A cumulative GPA adds the previous points back in — it is not the average of two averages. A 4.00 over 100 credits and a 3.00 over 3 credits is not 3.50.',
    convertTitle: 'On the other scale',
    convertedIs: 'Grade by grade',
    linearIs: 'The usual formula',
    convertWhy: (a: number, b: number) =>
      `Every GPA site converts with (GPA ÷ 5) × 4, which would give ${b.toFixed(2)}. Converting grade by grade gives ${a.toFixed(2)}. They differ because F is worth 1.00 on the 5-point scale and 0.00 on the 4-point one, so the two scales are not the same ruler stretched — the shortcut flatters a weak record. Which one a university or an evaluator uses is theirs to decide; this shows you both.`,
    convertSame: 'On these grades both methods agree.',
    priorCaveat: 'The previous GPA has no letter grades behind it, so it can only be carried across the scales with the usual formula. Only the courses you typed convert exactly.',
    table: 'What each letter is worth',
    letter: 'Letter', pct: 'Mark',
    caveat: 'Points and classification bands follow the Ministry of Education’s unified regulations, and most public universities use them — but your own university publishes its rules, and some use a 4.00 scale or their own honours thresholds. Check your registrar before acting on this.',
  },
  ar: {
    intro: 'احسب معدلك التراكمي على مقياس ٥٫٠٠ السعودي أو مقياس ٤٫٠٠، مقررًا مقررًا، وحوّل بينهما كما ينبغي. ولا يُرسل شيء إلى أي مكان — تبقى درجاتك في متصفحك.',
    scale: 'المقياس', five: 'من ٥٫٠٠', four: 'من ٤٫٠٠',
    course: 'المقرر', credits: 'الساعات', grade: 'التقدير', remove: 'حذف', add: 'أضف مقررًا',
    gpa: 'المعدل', classification: 'التقدير العام', totalCredits: 'الساعات المعتمدة', points: 'النقاط',
    grades: { excellent: 'ممتاز', veryGood: 'جيد جدًا', good: 'جيد', pass: 'مقبول', below: 'دون حد النجاح' } as Record<string, string>,
    cumulative: 'لديّ معدل سابق',
    priorGpa: 'المعدل السابق', priorCredits: 'ساعاته',
    priorNote: 'المعدل التراكمي يُعيد جمع النقاط السابقة — وليس متوسط متوسطين. فمعدل ٤٫٠٠ في ١٠٠ ساعة مع ٣٫٠٠ في ٣ ساعات ليس ٣٫٥٠.',
    convertTitle: 'على المقياس الآخر',
    convertedIs: 'تقديرًا بتقدير',
    linearIs: 'المعادلة الشائعة',
    convertWhy: (a: number, b: number) =>
      `تحوّل كل المواقع بالمعادلة (المعدل ÷ ٥) × ٤، وتعطي ${b.toFixed(2)}. أما التحويل تقديرًا بتقدير فيعطي ${a.toFixed(2)}. والفرق أن الراسب يساوي ١٫٠٠ في مقياس الخمسة و٠٫٠٠ في مقياس الأربعة، فليس المقياسان مسطرة واحدة ممدودة — والاختصار يُجمّل السجل الضعيف. وأيّهما تعتمد الجامعة أو جهة المعادلة أمرٌ يخصّها؛ وهنا كلاهما.`,
    convertSame: 'على هذه التقديرات تتفق الطريقتان.',
    priorCaveat: 'المعدل السابق ليست خلفه تقديرات بالحروف، فلا يمكن نقله بين المقياسين إلا بالمعادلة الشائعة. والمقررات التي أدخلتها وحدها تُحوَّل بدقة.',
    table: 'قيمة كل تقدير',
    letter: 'التقدير', pct: 'الدرجة',
    caveat: 'النقاط وحدود التقدير العام تتبع اللائحة الموحدة لوزارة التعليم، وتعتمدها أكثر الجامعات الحكومية — لكن جامعتك تنشر لائحتها، وبعضها يستخدم مقياس ٤٫٠٠ أو حدودًا خاصة لمراتب الشرف. راجع عمادة القبول والتسجيل قبل التصرّف بناءً على هذا.',
  },
}

const NEW: Course = { name: '', credits: 3, grade: 'A' }

export default function GpaCalculatorTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const [scale, setScale] = useState<'five' | 'four'>('five')
  const [courses, setCourses] = useState<Course[]>([
    { name: '', credits: 3, grade: 'A+' },
    { name: '', credits: 3, grade: 'B+' },
    { name: '', credits: 4, grade: 'A' },
  ])
  const [useCumulative, setUseCumulative] = useState(false)
  const [priorGpa, setPriorGpa] = useState('')
  const [priorCredits, setPriorCredits] = useState('')

  const prior = useCumulative && Number(priorGpa) > 0 && Number(priorCredits) > 0
    ? { gpa: Number(priorGpa), credits: Number(priorCredits) }
    : undefined

  const r = useMemo(() => calcGpa(courses, scale, prior), [courses, scale, prior])
  const grade = classify(r.gpa, scale)
  const num = (n: number, d = 2) => n.toLocaleString(locale === 'ar' ? 'ar-SA' : 'en-US', { minimumFractionDigits: d, maximumFractionDigits: d })

  const set = (i: number, patch: Partial<Course>) =>
    setCourses((p) => p.map((c, k) => (k === i ? { ...c, ...patch } : c)))

  const differs = Math.abs(r.converted - r.linear) >= 0.01

  return (
    <Stack data-testid="gpa-calculator">
      <p className="text-[0.95rem] text-ink-soft rtl:font-ar">{s.intro}</p>

      <Field label={s.scale}>
        <Seg data-testid="gpa-scale">
          <SegButton active={scale === 'five'} onClick={() => setScale('five')} data-testid="gpa-scale-5">{s.five}</SegButton>
          <SegButton active={scale === 'four'} onClick={() => setScale('four')} data-testid="gpa-scale-4">{s.four}</SegButton>
        </Seg>
      </Field>

      <div className="flex flex-col gap-2" data-testid="gpa-courses">
        {courses.map((c, i) => (
          <div key={i} className="flex flex-wrap items-end gap-2" data-testid={`gpa-row-${i}`}>
            <Input className="flex-1 min-w-[9rem]" placeholder={s.course} value={c.name} data-testid={`gpa-name-${i}`} onChange={(e) => set(i, { name: e.target.value })} />
            <Input type="number" min={0} max={12} className="w-[5.5rem]" value={c.credits} data-testid={`gpa-credits-${i}`} onChange={(e) => set(i, { credits: Number(e.target.value) })} />
            <Select className="w-[6rem]" value={c.grade} data-testid={`gpa-grade-${i}`} onChange={(e) => set(i, { grade: e.target.value as Letter })}>
              {LETTERS.map((l) => <option key={l} value={l}>{l}</option>)}
            </Select>
            <Button className="px-2 py-1" aria-label={s.remove} data-testid={`gpa-remove-${i}`}
              onClick={() => setCourses((p) => (p.length > 1 ? p.filter((_, k) => k !== i) : p))}><TrashIcon /></Button>
          </div>
        ))}
      </div>
      <Button className="self-start px-3 py-1" data-testid="gpa-add" onClick={() => setCourses((p) => [...p, { ...NEW }])}>{s.add}</Button>

      <Panel className="gap-2">
        <Check><input type="checkbox" checked={useCumulative} data-testid="gpa-cumulative" onChange={(e) => setUseCumulative(e.target.checked)} /> {s.cumulative}</Check>
        {useCumulative && (
          <>
            <div className="flex flex-wrap gap-3">
              <Field label={s.priorGpa}>
                <Input type="number" step="0.01" className="w-[7rem]" value={priorGpa} data-testid="gpa-prior" onChange={(e) => setPriorGpa(e.target.value)} />
              </Field>
              <Field label={s.priorCredits}>
                <Input type="number" className="w-[7rem]" value={priorCredits} data-testid="gpa-prior-credits" onChange={(e) => setPriorCredits(e.target.value)} />
              </Field>
            </div>
            <p className="text-[0.85rem] text-ink-soft rtl:font-ar" data-testid="gpa-prior-note">{s.priorNote}</p>
          </>
        )}
      </Panel>

      <Panel className="gap-1">
        <div className="flex flex-wrap gap-x-8 gap-y-3">
          <div>
            <div className="text-[0.7rem] uppercase tracking-[0.05em] text-ink-faint rtl:font-ar">{s.gpa}</div>
            <div className="font-mono text-[1.8rem] font-semibold text-green-700" data-testid="gpa-value">{num(r.gpa)}</div>
          </div>
          <div>
            <div className="text-[0.7rem] uppercase tracking-[0.05em] text-ink-faint rtl:font-ar">{s.classification}</div>
            <div className="font-display text-[1.2rem] text-ink rtl:font-ar" data-testid="gpa-class">{s.grades[grade]}</div>
          </div>
          <div>
            <div className="text-[0.7rem] uppercase tracking-[0.05em] text-ink-faint rtl:font-ar">{s.totalCredits}</div>
            <div className="font-mono text-[1.2rem] text-ink" data-testid="gpa-credits">{r.credits}</div>
          </div>
          <div>
            <div className="text-[0.7rem] uppercase tracking-[0.05em] text-ink-faint rtl:font-ar">{s.points}</div>
            <div className="font-mono text-[1.2rem] text-ink-soft" data-testid="gpa-points">{num(r.points)}</div>
          </div>
        </div>
      </Panel>

      <Panel className="gap-2">
        <div role="heading" aria-level={2} className="text-[0.7rem] uppercase tracking-[0.05em] text-ink-faint rtl:font-ar">{s.convertTitle}</div>
        <div className="flex flex-wrap gap-x-8 gap-y-2">
          <div>
            <div className="text-[0.7rem] text-ink-faint rtl:font-ar">{s.convertedIs}</div>
            <div className="font-mono text-[1.4rem] text-green-700" data-testid="gpa-converted">{num(r.converted)}</div>
          </div>
          <div>
            <div className="text-[0.7rem] text-ink-faint rtl:font-ar">{s.linearIs}</div>
            <div className="font-mono text-[1.4rem] text-ink-faint" data-testid="gpa-linear">{num(r.linear)}</div>
          </div>
        </div>
        <p className="text-[0.85rem] text-ink-soft rtl:font-ar" data-testid="gpa-convert-why">
          {differs ? s.convertWhy(r.converted, r.linear) : s.convertSame}
        </p>
        {prior && <p className="text-[0.85rem] text-gold-500 rtl:font-ar" data-testid="gpa-prior-caveat">{s.priorCaveat}</p>}
      </Panel>

      <Panel className="gap-2">
        <div role="heading" aria-level={2} className="text-[0.7rem] uppercase tracking-[0.05em] text-ink-faint rtl:font-ar">{s.table}</div>
        <table className="text-[0.88rem]" data-testid="gpa-table">
          <thead>
            <tr className="text-[0.7rem] uppercase tracking-[0.05em] text-ink-faint">
              <th className="text-start font-medium pe-6 rtl:font-ar">{s.letter}</th>
              <th className="text-start font-medium pe-6 rtl:font-ar">{s.pct}</th>
              <th className="text-start font-medium pe-6 font-mono">5.00</th>
              <th className="text-start font-medium font-mono">4.00</th>
            </tr>
          </thead>
          <tbody>
            {LETTERS.map((l) => (
              <tr key={l} className="border-t border-[color:var(--line-soft)]" data-testid={`gpa-letter-${l.replace('+', 'plus')}`}>
                <td className="py-[0.25rem] pe-6 font-mono text-ink">{l}</td>
                <td className="py-[0.25rem] pe-6 text-ink-soft font-mono">{RANGES[l]}</td>
                <td className="py-[0.25rem] pe-6 font-mono text-ink-soft">{POINTS.five[l].toFixed(2)}</td>
                <td className="py-[0.25rem] font-mono text-ink-soft">{POINTS.four[l].toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>

      <Disclaimer kind="official" locale={locale}>{s.caveat}</Disclaimer>
    </Stack>
  )
}
