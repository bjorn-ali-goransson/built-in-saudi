import { useMemo, useState } from 'react'
import { useLocale } from '../../i18n'
import { Stack, Panel, Field, Input, Select, Check, Seg, SegButton, Disclaimer } from '../../components/ui'
import { breakEvenPercent, calcTrip, PRICES, toL100, type Unit } from './fuel'

// Distances people actually drive here. A trip calculator whose first act is to
// ask for a number nobody knows is a calculator nobody finishes.
const ROUTES: { key: string; km: number }[] = [
  { key: 'riyadhMakkah', km: 870 },
  { key: 'riyadhJeddah', km: 950 },
  { key: 'jeddahMadinah', km: 420 },
  { key: 'riyadhDammam', km: 400 },
  { key: 'makkahMadinah', km: 450 },
  { key: 'riyadhAbha', km: 900 },
]

const STR = {
  en: {
    intro: 'Work out what a drive costs in fuel — in whatever unit your car shows, not just the one the spec sheet uses. Nothing is sent anywhere.',
    distance: 'Distance (km)', route: 'Or pick a route',
    pickRoute: 'Choose…',
    routes: {
      riyadhMakkah: 'Riyadh → Makkah', riyadhJeddah: 'Riyadh → Jeddah',
      jeddahMadinah: 'Jeddah → Madinah', riyadhDammam: 'Riyadh → Dammam',
      makkahMadinah: 'Makkah → Madinah', riyadhAbha: 'Riyadh → Abha',
    } as Record<string, string>,
    consumption: 'Consumption', unit: 'Unit',
    units: { l100: 'L / 100 km', kmpl: 'km per litre', mpgUs: 'MPG (US)', mpgUk: 'MPG (Imperial)' } as Record<Unit, string>,
    unitNote: 'A dashboard here usually shows km per litre, a spec sheet shows L/100 km, and an imported car shows MPG — in two different gallons, a fifth apart. Pick what your car actually shows.',
    grade: 'Fuel', price: 'Price per litre',
    returnTrip: 'Return trip', people: 'Sharing between',
    cost: 'Fuel for the trip', litres: 'Litres', perKm: 'Per km', perPerson: 'Each',
    asL100: 'That is',
    worth: 'Is 95 worth it?',
    worthBody: (pct: number) =>
      `95 costs ${pct.toFixed(1)}% more per litre than 91, so it only pays for itself if your car goes at least ${pct.toFixed(1)}% further on a litre of it. Most engines built for 91 gain nothing from a higher octane — they do not advance the timing to use it — so for them the extra is simply spent. If your manual REQUIRES 95, you are not choosing; run 95.`,
    caveat: 'Fuel prices here are the published regulated retail prices and are reviewed periodically, so check the pump or Aramco before relying on the figure. Real consumption depends on speed, air conditioning, load and traffic, and is usually worse than the sticker.',
  },
  ar: {
    intro: 'احسب تكلفة وقود رحلتك — بالوحدة التي تعرضها سيارتك، لا بوحدة النشرة الفنية وحدها. ولا يُرسل شيء إلى أي مكان.',
    distance: 'المسافة (كم)', route: 'أو اختر رحلة',
    pickRoute: 'اختر…',
    routes: {
      riyadhMakkah: 'الرياض ← مكة', riyadhJeddah: 'الرياض ← جدة',
      jeddahMadinah: 'جدة ← المدينة', riyadhDammam: 'الرياض ← الدمام',
      makkahMadinah: 'مكة ← المدينة', riyadhAbha: 'الرياض ← أبها',
    } as Record<string, string>,
    consumption: 'الاستهلاك', unit: 'الوحدة',
    units: { l100: 'لتر / ١٠٠ كم', kmpl: 'كم لكل لتر', mpgUs: 'ميل/جالون (أمريكي)', mpgUk: 'ميل/جالون (إمبراطوري)' } as Record<Unit, string>,
    unitNote: 'تعرض لوحة العدادات هنا عادةً «كم لكل لتر»، وتعرض النشرة الفنية «لتر/١٠٠ كم»، وتعرض السيارة المستوردة «ميل لكل جالون» — بجالونين مختلفين بينهما الخُمس. اختر ما تعرضه سيارتك فعلًا.',
    grade: 'الوقود', price: 'سعر اللتر',
    returnTrip: 'ذهابًا وإيابًا', people: 'التقسيم على',
    cost: 'وقود الرحلة', litres: 'لترات', perKm: 'لكل كم', perPerson: 'لكل شخص',
    asL100: 'أي',
    worth: 'هل ٩٥ يستحق؟',
    worthBody: (pct: number) =>
      `يزيد سعر ٩٥ عن ٩١ بنسبة ${pct.toFixed(1)}٪ للتر، فلا يستحق إلا إذا قطعت سيارتك باللتر مسافة أطول بـ${pct.toFixed(1)}٪ على الأقل. ومعظم المحركات المصممة لـ٩١ لا تستفيد من أوكتان أعلى — إذ لا تقدّم التوقيت للاستفادة منه — فتذهب الزيادة سدى. أما إن كان دليل سيارتك يوجب ٩٥ فلا خيار لك؛ استخدم ٩٥.`,
    caveat: 'أسعار الوقود هنا هي الأسعار النظامية المعلنة وتُراجع دوريًا، فتحقّق من المحطة أو من أرامكو قبل الاعتماد على الرقم. والاستهلاك الفعلي يعتمد على السرعة والتكييف والحمولة والزحام، وهو عادةً أسوأ من الرقم المعلن.',
  },
}

export default function FuelCostTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const [km, setKm] = useState('870')
  const [consumption, setConsumption] = useState('12')
  const [unit, setUnit] = useState<Unit>('kmpl')
  const [grade, setGrade] = useState<'p91' | 'p95' | 'other'>('p91')
  const [price, setPrice] = useState(String(PRICES.p91))
  const [returnTrip, setReturnTrip] = useState(false)
  const [people, setPeople] = useState('1')

  const pickGrade = (g: 'p91' | 'p95' | 'other') => {
    setGrade(g)
    if (g !== 'other') setPrice(String(PRICES[g]))
  }

  const r = useMemo(() => calcTrip({
    km: Number(km) || 0,
    consumption: Number(consumption) || 0,
    unit,
    price: Number(price) || 0,
    returnTrip,
    people: Math.max(1, Number(people) || 1),
  }), [km, consumption, unit, price, returnTrip, people])

  const money = (n: number) => n.toLocaleString(locale === 'ar' ? 'ar-SA' : 'en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const nn = (n: number, d = 1) => n.toLocaleString(locale === 'ar' ? 'ar-SA' : 'en-US', { minimumFractionDigits: d, maximumFractionDigits: d })
  const breakEven = breakEvenPercent(PRICES.p91, PRICES.p95)

  return (
    <Stack data-testid="fuel-cost">
      <p className="text-[0.95rem] text-ink-soft rtl:font-ar">{s.intro}</p>

      <div className="flex flex-wrap items-end gap-3">
        <Field label={s.distance}>
          <Input type="number" min={0} className="w-[8rem]" value={km} data-testid="fc-km" onChange={(e) => setKm(e.target.value)} />
        </Field>
        <Field label={s.route}>
          <Select className="min-w-[11rem]" data-testid="fc-route" value="" onChange={(e) => { const rt = ROUTES.find((x) => x.key === e.target.value); if (rt) setKm(String(rt.km)) }}>
            <option value="">{s.pickRoute}</option>
            {ROUTES.map((rt) => <option key={rt.key} value={rt.key}>{s.routes[rt.key]}</option>)}
          </Select>
        </Field>
        <Check><input type="checkbox" checked={returnTrip} data-testid="fc-return" onChange={(e) => setReturnTrip(e.target.checked)} /> {s.returnTrip}</Check>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <Field label={s.consumption}>
          <Input type="number" min={0} step="0.1" className="w-[7rem]" value={consumption} data-testid="fc-consumption" onChange={(e) => setConsumption(e.target.value)} />
        </Field>
        <Field label={s.unit}>
          <Select className="min-w-[10rem]" value={unit} data-testid="fc-unit" onChange={(e) => setUnit(e.target.value as Unit)}>
            {(['kmpl', 'l100', 'mpgUs', 'mpgUk'] as Unit[]).map((u) => <option key={u} value={u}>{s.units[u]}</option>)}
          </Select>
        </Field>
        <Field label={s.people}>
          <Input type="number" min={1} className="w-[6rem]" value={people} data-testid="fc-people" onChange={(e) => setPeople(e.target.value)} />
        </Field>
      </div>
      <Panel><p className="text-[0.85rem] text-ink-soft rtl:font-ar" data-testid="fc-unit-note">{s.unitNote}</p></Panel>

      <div className="flex flex-wrap items-end gap-3">
        <Field label={s.grade}>
          <Seg data-testid="fc-grade">
            <SegButton active={grade === 'p91'} onClick={() => pickGrade('p91')} data-testid="fc-91">91</SegButton>
            <SegButton active={grade === 'p95'} onClick={() => pickGrade('p95')} data-testid="fc-95">95</SegButton>
            <SegButton active={grade === 'other'} onClick={() => pickGrade('other')} data-testid="fc-other">…</SegButton>
          </Seg>
        </Field>
        <Field label={s.price}>
          <Input type="number" min={0} step="0.01" className="w-[7rem]" value={price} data-testid="fc-price" onChange={(e) => { setPrice(e.target.value); setGrade('other') }} />
        </Field>
      </div>

      <Panel className="gap-2">
        <div className="flex flex-wrap gap-x-8 gap-y-3">
          <div>
            <div className="text-[0.7rem] uppercase tracking-[0.05em] text-ink-faint rtl:font-ar">{s.cost}</div>
            <div className="font-mono text-[1.8rem] font-semibold text-green-700" data-testid="fc-cost">{money(r.cost)}</div>
          </div>
          <div>
            <div className="text-[0.7rem] uppercase tracking-[0.05em] text-ink-faint rtl:font-ar">{s.litres}</div>
            <div className="font-mono text-[1.2rem] text-ink" data-testid="fc-litres">{nn(r.litres)}</div>
          </div>
          <div>
            <div className="text-[0.7rem] uppercase tracking-[0.05em] text-ink-faint rtl:font-ar">{s.perKm}</div>
            <div className="font-mono text-[1.2rem] text-ink-soft" data-testid="fc-per-km">{money(r.perKm)}</div>
          </div>
          {Number(people) > 1 && (
            <div>
              <div className="text-[0.7rem] uppercase tracking-[0.05em] text-ink-faint rtl:font-ar">{s.perPerson}</div>
              <div className="font-mono text-[1.2rem] text-green-700" data-testid="fc-per-person">{money(r.perPerson)}</div>
            </div>
          )}
        </div>
        {/* The conversion is shown, not just applied — a driver who entered
            km/L should be able to see the L/100km the arithmetic used. */}
        <p className="text-[0.85rem] text-ink-faint font-mono" data-testid="fc-as-l100">
          {s.asL100} {nn(toL100(Number(consumption) || 0, unit), 2)} L/100km · {r.km} km
        </p>
      </Panel>

      <Panel className="gap-1">
        <div role="heading" aria-level={2} className="text-[0.7rem] uppercase tracking-[0.05em] text-ink-faint rtl:font-ar">{s.worth}</div>
        <p className="text-[0.9rem] text-ink-soft rtl:font-ar" data-testid="fc-95-worth">{s.worthBody(breakEven)}</p>
      </Panel>

      <Disclaimer kind="financial" locale={locale}>{s.caveat}</Disclaimer>
    </Stack>
  )
}
