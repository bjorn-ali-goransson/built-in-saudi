import { useMemo, useState } from 'react'
import { useLocale } from '../../i18n'
import { Input, Select, Stack, Panel, Disclaimer, Check } from '../../components/ui'
import { CloudIcon } from '../../components/icons'

// Baseline from body weight — ~35 ml/kg is the figure clinical nutrition uses
// for a healthy adult. Everything else is an ADDITION on top, which is the part
// most "8 glasses a day" advice misses: 8 glasses is roughly a 55kg office
// worker in a temperate climate, and says nothing useful about 40°C in Riyadh.
const ML_PER_KG = 35
const GLASS_ML = 250

type Climate = 'temperate' | 'warm' | 'hot' | 'extreme'
type Activity = 'low' | 'moderate' | 'high'

const CLIMATE: Record<Climate, { mult: number; en: string; ar: string }> = {
  temperate: { mult: 1, en: 'Mild, under 25°C', ar: 'معتدل، أقل من ٢٥°' },
  warm: { mult: 1.1, en: 'Warm, 25–32°C', ar: 'دافئ، ٢٥–٣٢°' },
  hot: { mult: 1.25, en: 'Hot, 32–40°C', ar: 'حار، ٣٢–٤٠°' },
  extreme: { mult: 1.4, en: 'Very hot, over 40°C', ar: 'شديد الحرارة، فوق ٤٠°' },
}

const ACTIVITY: Record<Activity, { addPerHour: number; en: string; ar: string }> = {
  low: { addPerHour: 0, en: 'Mostly sitting', ar: 'جالس غالبًا' },
  moderate: { addPerHour: 400, en: 'Moderate exercise', ar: 'رياضة معتدلة' },
  high: { addPerHour: 700, en: 'Hard exercise or outdoor work', ar: 'رياضة شاقة أو عمل خارجي' },
}

const STR = {
  en: {
    weight: 'Weight (kg)', climate: 'Where you are', activity: 'Activity', hours: 'Hours of it',
    outdoors: 'Working or training outdoors in the sun',
    fasting: 'I am fasting',
    target: 'A day’s water', glasses: 'glasses', litres: 'litres',
    breakdown: 'How that is made up',
    base: 'Body weight', climateAdd: 'Climate', activityAdd: 'Activity', outdoorAdd: 'Sun exposure',
    fastingTitle: 'While fasting',
    fastingNote: 'The same total, but it has to fit between iftar and suhoor. Spreading it across the evening works; drinking it all at iftar mostly does not — the kidneys pass the excess rather than storing it.',
    caveat: 'A starting point from body weight, not a prescription. Food supplies roughly a fifth of it. Heart, kidney and liver conditions change this completely, and some people are told to drink LESS — if that is you, follow your doctor over any calculator.',
    tooMuch: 'Above about 1 litre an hour the kidneys cannot keep up, and drinking far past thirst can dilute your blood sodium dangerously. Spread it out.',
    thirstNote: 'Thirst is a decent guide for most healthy adults. Pale straw-coloured urine is a better one.',
  },
  ar: {
    weight: 'الوزن (كجم)', climate: 'أين أنت', activity: 'النشاط', hours: 'عدد ساعاته',
    outdoors: 'عمل أو تمرين في الشمس',
    fasting: 'أنا صائم',
    target: 'ماء اليوم', glasses: 'كوبًا', litres: 'لتر',
    breakdown: 'كيف تكوّن هذا الرقم',
    base: 'وزن الجسم', climateAdd: 'المناخ', activityAdd: 'النشاط', outdoorAdd: 'التعرّض للشمس',
    fastingTitle: 'أثناء الصيام',
    fastingNote: 'المجموع نفسه، لكن عليه أن يتوزّع بين الإفطار والسحور. التوزيع على المساء ينفع، أما شربه كله عند الإفطار فلا غالبًا — إذ تُخرج الكلى الفائض ولا تخزّنه.',
    caveat: 'نقطة بداية من وزن الجسم، وليست وصفة. ويأتي نحو خُمس الماء من الطعام. وأمراض القلب والكلى والكبد تغيّر هذا تمامًا، وبعض الناس يُنصحون بشرب كمية أقل — فإن كنت منهم فاتبع طبيبك لا أي حاسبة.',
    tooMuch: 'فوق نحو لتر في الساعة لا تستطيع الكلى المجاراة، والإفراط بعيدًا عن العطش قد يخفّض صوديوم الدم بشكل خطير. وزّع الشرب.',
    thirstNote: 'العطش دليل جيد لمعظم البالغين الأصحاء، ولون البول الفاتح دليل أفضل.',
  },
}

export default function WaterIntakeTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const [weight, setWeight] = useState(75)
  const [climate, setClimate] = useState<Climate>('hot')
  const [activity, setActivity] = useState<Activity>('low')
  const [hours, setHours] = useState(1)
  const [outdoors, setOutdoors] = useState(false)
  const [fasting, setFasting] = useState(false)

  const r = useMemo(() => {
    const base = weight * ML_PER_KG
    const climateAdd = base * (CLIMATE[climate].mult - 1)
    const activityAdd = ACTIVITY[activity].addPerHour * Math.max(0, hours)
    const outdoorAdd = outdoors ? 500 : 0
    const total = base + climateAdd + activityAdd + outdoorAdd
    return { base, climateAdd, activityAdd, outdoorAdd, total }
  }, [weight, climate, activity, hours, outdoors])

  const litres = r.total / 1000
  const glasses = Math.round(r.total / GLASS_ML)
  const n = (ml: number) => `${(ml / 1000).toFixed(2)} L`

  return (
    <Stack data-testid="water-intake">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-[0.8rem] text-ink-faint">
          {s.weight}
          <Input type="number" min={20} max={250} dir="ltr" className="w-24 font-mono" data-testid="wi-weight"
            value={weight} onChange={(e) => setWeight(Math.max(20, Math.min(250, +e.target.value || 0)))} />
        </label>
        <label className="flex flex-col gap-1 text-[0.8rem] text-ink-faint">
          {s.climate}
          <Select className="min-w-[12rem]" data-testid="wi-climate" value={climate} onChange={(e) => setClimate(e.target.value as Climate)}>
            {(Object.keys(CLIMATE) as Climate[]).map((k) => (
              <option key={k} value={k}>{locale === 'ar' ? CLIMATE[k].ar : CLIMATE[k].en}</option>
            ))}
          </Select>
        </label>
        <label className="flex flex-col gap-1 text-[0.8rem] text-ink-faint">
          {s.activity}
          <Select className="min-w-[12rem]" data-testid="wi-activity" value={activity} onChange={(e) => setActivity(e.target.value as Activity)}>
            {(Object.keys(ACTIVITY) as Activity[]).map((k) => (
              <option key={k} value={k}>{locale === 'ar' ? ACTIVITY[k].ar : ACTIVITY[k].en}</option>
            ))}
          </Select>
        </label>
        {activity !== 'low' && (
          <label className="flex flex-col gap-1 text-[0.8rem] text-ink-faint">
            {s.hours}
            <Input type="number" min={0} max={12} step={0.5} dir="ltr" className="w-20 font-mono" data-testid="wi-hours"
              value={hours} onChange={(e) => setHours(Math.max(0, Math.min(12, +e.target.value || 0)))} />
          </label>
        )}
      </div>

      <div className="flex flex-wrap gap-4">
        <Check>
          <input type="checkbox" checked={outdoors} data-testid="wi-outdoors" onChange={(e) => setOutdoors(e.target.checked)} /> {s.outdoors}
        </Check>
        <Check>
          <input type="checkbox" checked={fasting} data-testid="wi-fasting" onChange={(e) => setFasting(e.target.checked)} /> {s.fasting}
        </Check>
      </div>

      <Panel className="flex flex-wrap items-baseline gap-x-8 gap-y-2" data-testid="wi-result">
        <div className="flex flex-col">
          <span className="font-body text-[0.68rem] uppercase tracking-[0.06em] text-ink-faint">{s.target}</span>
          <span className="font-display text-[clamp(2rem,7vw,2.8rem)] text-green-700 leading-none" data-testid="wi-litres">
            {litres.toFixed(1)} <span className="text-[0.4em] text-ink-faint">{s.litres}</span>
          </span>
        </div>
        <span className="text-[1.1rem] text-ink-soft rtl:font-ar" data-testid="wi-glasses">
          ≈ {glasses.toLocaleString(locale === 'ar' ? 'ar' : 'en')} {s.glasses}
        </span>
      </Panel>

      <section className="flex flex-col gap-1">
        <h2 className="font-body text-[0.68rem] uppercase tracking-[0.06em] text-ink-faint">{s.breakdown}</h2>
        <dl className="flex flex-wrap gap-x-6 gap-y-1 text-[0.9rem] [&_dt]:text-ink-faint [&_dd]:text-ink [&_dd]:font-mono" data-testid="wi-breakdown">
          <div className="flex gap-2"><dt className="rtl:font-ar">{s.base}</dt><dd>{n(r.base)}</dd></div>
          {r.climateAdd > 0 && <div className="flex gap-2"><dt className="rtl:font-ar">{s.climateAdd}</dt><dd>+{n(r.climateAdd)}</dd></div>}
          {r.activityAdd > 0 && <div className="flex gap-2"><dt className="rtl:font-ar">{s.activityAdd}</dt><dd>+{n(r.activityAdd)}</dd></div>}
          {r.outdoorAdd > 0 && <div className="flex gap-2"><dt className="rtl:font-ar">{s.outdoorAdd}</dt><dd>+{n(r.outdoorAdd)}</dd></div>}
        </dl>
      </section>

      {fasting && (
        <Panel className="flex items-start gap-2" data-testid="wi-fastingnote">
          <CloudIcon className="text-ink-faint flex-none mt-0.5" />
          <div className="flex flex-col gap-0.5">
            <span className="font-body text-[0.68rem] uppercase tracking-[0.06em] text-ink-faint">{s.fastingTitle}</span>
            <span className="text-[0.88rem] text-ink-soft rtl:font-ar">{s.fastingNote}</span>
          </div>
        </Panel>
      )}

      {litres > 5 && <p className="text-[0.88rem] text-gold-500 rtl:font-ar" data-testid="wi-toomuch">{s.tooMuch}</p>}

      <Disclaimer kind="medical" locale={locale}>{s.caveat}</Disclaimer>
      <p className="text-[0.85rem] text-ink-faint rtl:font-ar">{s.thirstNote}</p>
    </Stack>
  )
}
