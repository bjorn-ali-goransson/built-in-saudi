import { useMemo, useState } from 'react'
import { useLocale } from '../../i18n'
import { Button, Disclaimer, Input, Panel, Seg, SegButton, Select, Stack } from '../../components/ui'
import { CalcIcon } from '../../components/icons'

// Mifflin-St Jeor for BMR — the equation that measures best against indirect
// calorimetry for the general population, and the one clinical guidance uses.
// Harris-Benedict is older and overestimates; we use the better one and say so.
type Sex = 'male' | 'female'

const ACTIVITY = [
  { id: 1.2, en: 'Desk job, little exercise', ar: 'عمل مكتبي، بلا رياضة تقريبًا' },
  { id: 1.375, en: 'Light exercise, 1–3 days a week', ar: 'رياضة خفيفة، ١–٣ أيام أسبوعيًا' },
  { id: 1.55, en: 'Moderate exercise, 3–5 days', ar: 'رياضة معتدلة، ٣–٥ أيام' },
  { id: 1.725, en: 'Hard exercise, 6–7 days', ar: 'رياضة شاقة، ٦–٧ أيام' },
  { id: 1.9, en: 'Physical job or twice-daily training', ar: 'عمل بدني أو تدريب مرتين يوميًا' },
]

const GOALS = [
  { id: -0.2, en: 'Lose weight', ar: 'إنقاص الوزن' },
  { id: 0, en: 'Stay the same', ar: 'المحافظة على الوزن' },
  { id: 0.15, en: 'Build muscle', ar: 'بناء العضلات' },
]

const STR = {
  en: {
    sex: 'Sex', male: 'Male', female: 'Female',
    age: 'Age', height: 'Height (cm)', weight: 'Weight (kg)',
    activity: 'How active are you?', goal: 'Goal',
    bmr: 'Resting burn (BMR)', tdee: 'Daily burn (TDEE)', target: 'Your target',
    perDay: 'kcal a day',
    macros: 'A reasonable split', protein: 'Protein', carbs: 'Carbs', fat: 'Fat',
    bmi: 'BMI', bmiRange: 'Healthy weight for your height',
    bmiBands: ['Underweight', 'Healthy', 'Overweight', 'Obese'],
    rate: 'At this deficit you would lose roughly',
    perWeek: 'kg a week',
    method: 'BMR uses the Mifflin-St Jeor equation, which measures closest to reality for most people — older calculators still use Harris-Benedict and read high. The activity multiplier is the rough part of any such estimate: it is a self-report, and most people overestimate it.',
    notAdvice: 'This is an estimate, not medical or dietary advice. If you have a health condition, are pregnant, or are treating an eating disorder, talk to a doctor or dietitian rather than a calculator.',
  },
  ar: {
    sex: 'الجنس', male: 'ذكر', female: 'أنثى',
    age: 'العمر', height: 'الطول (سم)', weight: 'الوزن (كجم)',
    activity: 'ما مستوى نشاطك؟', goal: 'الهدف',
    bmr: 'الحرق في الراحة (BMR)', tdee: 'الحرق اليومي (TDEE)', target: 'هدفك',
    perDay: 'سعرة يوميًا',
    macros: 'توزيع معقول', protein: 'بروتين', carbs: 'كربوهيدرات', fat: 'دهون',
    bmi: 'مؤشر الكتلة', bmiRange: 'الوزن الصحي لطولك',
    bmiBands: ['نحافة', 'صحي', 'زيادة وزن', 'سمنة'],
    rate: 'بهذا العجز ستفقد تقريبًا',
    perWeek: 'كجم أسبوعيًا',
    method: 'يُحسب الأيض الأساسي بمعادلة ميفلين-سانت جيور، وهي الأقرب للواقع لدى معظم الناس — بينما لا تزال حاسبات قديمة تستخدم هاريس-بنديكت فتعطي أرقامًا مرتفعة. ومُعامل النشاط هو الجزء التقريبي في أي تقدير كهذا: فهو تقدير ذاتي، ومعظم الناس يبالغون فيه.',
    notAdvice: 'هذا تقدير، وليس استشارة طبية أو غذائية. إن كانت لديك حالة صحية أو كنتِ حاملًا أو كنت تعالج اضطراب أكل، فراجع طبيبًا أو أخصائي تغذية بدل حاسبة.',
  },
}

export default function CalorieNeedsTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const [sex, setSex] = useState<Sex>('male')
  const [age, setAge] = useState(30)
  const [height, setHeight] = useState(175)
  const [weight, setWeight] = useState(78)
  const [activity, setActivity] = useState(1.375)
  const [goal, setGoal] = useState(0)

  const r = useMemo(() => {
    const bmr = 10 * weight + 6.25 * height - 5 * age + (sex === 'male' ? 5 : -161)
    const tdee = bmr * activity
    const target = tdee * (1 + goal)
    const bmi = weight / (height / 100) ** 2
    const band = bmi < 18.5 ? 0 : bmi < 25 ? 1 : bmi < 30 ? 2 : 3
    const healthyLow = 18.5 * (height / 100) ** 2
    const healthyHigh = 24.9 * (height / 100) ** 2
    // 1 kg of body fat is ~7700 kcal.
    const kgPerWeek = ((tdee - target) * 7) / 7700
    // Protein at 1.8 g/kg (the useful range for someone training), fat at 25% of
    // intake, carbs take the remainder.
    const protein = Math.round(weight * 1.8)
    const fat = Math.round((target * 0.25) / 9)
    const carbs = Math.max(0, Math.round((target - protein * 4 - fat * 9) / 4))
    return { bmr, tdee, target, bmi, band, healthyLow, healthyHigh, kgPerWeek, protein, fat, carbs }
  }, [sex, age, height, weight, activity, goal])

  const n = (v: number) => Math.round(v).toLocaleString(locale === 'ar' ? 'ar' : 'en')

  return (
    <Stack data-testid="calorie-needs">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <span className="text-[0.8rem] text-ink-faint">{s.sex}</span>
          <Seg>
            <SegButton active={sex === 'male'} data-testid="cn-male" onClick={() => setSex('male')}>{s.male}</SegButton>
            <SegButton active={sex === 'female'} data-testid="cn-female" onClick={() => setSex('female')}>{s.female}</SegButton>
          </Seg>
        </div>
        <label className="flex flex-col gap-1 text-[0.8rem] text-ink-faint">
          {s.age}
          <Input type="number" min={12} max={100} dir="ltr" className="w-20 font-mono" data-testid="cn-age"
            value={age} onChange={(e) => setAge(Math.max(12, Math.min(100, +e.target.value || 0)))} />
        </label>
        <label className="flex flex-col gap-1 text-[0.8rem] text-ink-faint">
          {s.height}
          <Input type="number" min={100} max={230} dir="ltr" className="w-24 font-mono" data-testid="cn-height"
            value={height} onChange={(e) => setHeight(Math.max(100, Math.min(230, +e.target.value || 0)))} />
        </label>
        <label className="flex flex-col gap-1 text-[0.8rem] text-ink-faint">
          {s.weight}
          <Input type="number" min={30} max={300} dir="ltr" className="w-24 font-mono" data-testid="cn-weight"
            value={weight} onChange={(e) => setWeight(Math.max(30, Math.min(300, +e.target.value || 0)))} />
        </label>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-[0.8rem] text-ink-faint">
          {s.activity}
          <Select className="min-w-[16rem]" data-testid="cn-activity" value={activity} onChange={(e) => setActivity(+e.target.value)}>
            {ACTIVITY.map((a) => <option key={a.id} value={a.id}>{locale === 'ar' ? a.ar : a.en}</option>)}
          </Select>
        </label>
        <label className="flex flex-col gap-1 text-[0.8rem] text-ink-faint">
          {s.goal}
          <Select className="w-40" data-testid="cn-goal" value={goal} onChange={(e) => setGoal(+e.target.value)}>
            {GOALS.map((g) => <option key={g.id} value={g.id}>{locale === 'ar' ? g.ar : g.en}</option>)}
          </Select>
        </label>
      </div>

      <Panel className="flex flex-wrap gap-x-8 gap-y-3">
        <div className="flex flex-col">
          <span className="font-body text-[0.68rem] uppercase tracking-[0.06em] text-ink-faint">{s.target}</span>
          <span className="font-display text-[clamp(1.8rem,6vw,2.5rem)] text-green-700 leading-none" data-testid="cn-target">{n(r.target)}</span>
          <span className="text-[0.8rem] text-ink-faint rtl:font-ar">{s.perDay}</span>
        </div>
        <dl className="flex flex-wrap gap-x-6 gap-y-2 text-[0.9rem] [&_dt]:text-ink-faint [&_dd]:text-ink [&_dd]:font-semibold">
          <div className="flex flex-col"><dt className="rtl:font-ar">{s.bmr}</dt><dd data-testid="cn-bmr">{n(r.bmr)}</dd></div>
          <div className="flex flex-col"><dt className="rtl:font-ar">{s.tdee}</dt><dd data-testid="cn-tdee">{n(r.tdee)}</dd></div>
          <div className="flex flex-col"><dt className="rtl:font-ar">{s.bmi}</dt><dd data-testid="cn-bmi">{r.bmi.toFixed(1)} · {s.bmiBands[r.band]}</dd></div>
        </dl>
      </Panel>

      {r.kgPerWeek > 0.01 && (
        <p className="text-[0.9rem] text-ink-soft rtl:font-ar" data-testid="cn-rate">
          {s.rate} <b>{r.kgPerWeek.toFixed(2)}</b> {s.perWeek}
        </p>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="font-body text-[0.68rem] uppercase tracking-[0.06em] text-ink-faint">{s.macros}</h2>
        <div className="flex flex-wrap gap-3" data-testid="cn-macros">
          {[[s.protein, r.protein], [s.carbs, r.carbs], [s.fat, r.fat]].map(([label, grams]) => (
            <div key={label as string} className="flex flex-col items-center border border-[color:var(--line)] rounded-md bg-[var(--surface)] px-5 py-2">
              <span className="text-[0.8rem] text-ink-faint rtl:font-ar">{label as string}</span>
              <span className="font-display text-[1.3rem] text-ink">{n(grams as number)} g</span>
            </div>
          ))}
        </div>
      </section>

      <p className="text-[0.9rem] text-ink-soft rtl:font-ar" data-testid="cn-range">
        {s.bmiRange}: <b>{r.healthyLow.toFixed(0)}–{r.healthyHigh.toFixed(0)} kg</b>
      </p>

      <Disclaimer kind="medical" locale={locale}>{s.method}</Disclaimer>
      <Button to={`/${locale}/apps/unit-converter`} className="self-start">
        <CalcIcon /> {locale === 'ar' ? 'حوّل الوحدات' : 'Convert units'}
      </Button>
    </Stack>
  )
}
