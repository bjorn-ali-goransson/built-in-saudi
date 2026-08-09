import { useMemo, useState } from 'react'
import { useLocale, localePath } from '../../i18n'
import { Button, Stack, Panel, Field, Input, Check } from '../../components/ui'
import { BASE_PER_M2, BTU_PER_TON, calcAc, isOversized } from './ac'

const STR = {
  en: {
    intro: 'Work out the cooling a room needs here, not in a temperate country — the American rule of thumb is about a third of what a 45°C summer asks for. Nothing is sent anywhere.',
    area: 'Floor area (m²)', ceiling: 'Ceiling height (m)', people: 'People in the room',
    sunny: 'Direct sun on a wall or window', topFloor: 'Top floor, under the roof', kitchen: 'It is a kitchen',
    need: 'The room needs', buy: 'Buy this size', tons: 'tons',
    parts: {
      base: (n: number) => `${n} m² at ${BASE_PER_M2} BTU/h per m²`,
      ceiling: 'Extra ceiling height',
      sun: 'Direct sun (+15%)',
      roof: 'Top floor (+10%)',
      people: 'Extra occupants',
      kitchen: 'Kitchen heat',
    } as Record<string, string | ((n: number) => string)>,
    working: 'How that adds up',
    tonNote: `Air conditioners are sold in “tons” here and in BTU/h elsewhere. One ton is ${BTU_PER_TON.toLocaleString('en')} BTU/h — it is a unit of cooling, nothing to do with weight.`,
    overTitle: 'Bigger is not safer',
    overBody: (over: number) =>
      `The nearest size you can buy is ${over.toFixed(0)}% above what the room needs, which is worth knowing rather than ignoring. An oversized unit reaches the set point quickly and stops, so it never runs long enough to pull moisture out of the air — the room ends up cold and clammy instead of comfortable, and the compressor wears from starting and stopping. On the coast, where the humidity is, that is the difference between a room that feels right and one that does not.`,
    overOk: 'The nearest size you can buy is a close fit, which is what you want — an oversized unit short-cycles and never runs long enough to dehumidify.',
    honestTitle: 'This is a sanity check, not a load calculation',
    honestBody: 'A real answer accounts for wall construction, glazing, orientation, air leakage and everything running inside the room — the work an HVAC engineer does. This is the arithmetic that tells you whether a quote is in the right range, and it is not the same thing.',
    bill: 'What it costs to run: electricity bill',
  },
  ar: {
    intro: 'احسب التبريد الذي تحتاجه الغرفة هنا لا في بلد معتدل — فالقاعدة الأمريكية الشائعة نحو ثلث ما يتطلبه صيف بـ٤٥ درجة. ولا يُرسل شيء إلى أي مكان.',
    area: 'المساحة (م²)', ceiling: 'ارتفاع السقف (م)', people: 'عدد الأشخاص',
    sunny: 'شمس مباشرة على جدار أو نافذة', topFloor: 'الدور العلوي تحت السطح', kitchen: 'الغرفة مطبخ',
    need: 'تحتاج الغرفة', buy: 'اشترِ هذا المقاس', tons: 'طن',
    parts: {
      base: (n: number) => `${n} م² بمعدل ${BASE_PER_M2} وحدة/ساعة لكل م²`,
      ceiling: 'ارتفاع سقف إضافي',
      sun: 'شمس مباشرة (+١٥٪)',
      roof: 'الدور العلوي (+١٠٪)',
      people: 'أشخاص إضافيون',
      kitchen: 'حرارة المطبخ',
    } as Record<string, string | ((n: number) => string)>,
    working: 'كيف يتكوّن الرقم',
    tonNote: `تُباع المكيفات هنا بالـ«طن» وفي غيرها بوحدات BTU. والطن الواحد ${BTU_PER_TON.toLocaleString('ar')} وحدة/ساعة — وهو وحدة تبريد لا علاقة له بالوزن.`,
    overTitle: 'الأكبر ليس أأمن',
    overBody: (over: number) =>
      `أقرب مقاس متاح يزيد ${over.toFixed(0)}٪ عمّا تحتاجه الغرفة، وهذا ما يستحق أن يُعرف لا أن يُتجاهل. فالمكيّف الأكبر من الحاجة يبلغ درجة الضبط سريعًا ثم يتوقف، فلا يعمل مدة كافية لسحب الرطوبة — فتصير الغرفة باردة رطبة لا مريحة، ويتآكل الضاغط من كثرة التشغيل والإيقاف. وعلى الساحل حيث الرطوبة، هذا هو الفرق بين غرفة مريحة وأخرى ليست كذلك.`,
    overOk: 'أقرب مقاس متاح قريب من الحاجة، وهذا هو المطلوب — فالمكيّف الأكبر من الحاجة يتوقف سريعًا ولا يعمل مدة كافية لسحب الرطوبة.',
    honestTitle: 'هذا فحص تقريبي لا حساب أحمال',
    honestBody: 'الجواب الحقيقي يراعي مواد الجدران والزجاج والاتجاه وتسرّب الهواء وكل ما يعمل داخل الغرفة — وهو عمل مهندس تكييف. أما هذا فحساب يخبرك إن كان العرض في النطاق الصحيح، وليس الشيء نفسه.',
    bill: 'كم يكلّف تشغيله: فاتورة الكهرباء',
  },
}

export default function AcSizeTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const [area, setArea] = useState('20')
  const [ceiling, setCeiling] = useState('2.8')
  const [people, setPeople] = useState('2')
  const [sunny, setSunny] = useState(false)
  const [topFloor, setTopFloor] = useState(false)
  const [kitchen, setKitchen] = useState(false)

  const r = useMemo(() => calcAc({
    areaM2: Number(area) || 0,
    ceilingM: Number(ceiling) || 2.8,
    people: Number(people) || 0,
    sunny, topFloor, kitchen,
  }), [area, ceiling, people, sunny, topFloor, kitchen])

  const n = (v: number, d = 0) => v.toLocaleString(locale === 'ar' ? 'ar-SA' : 'en-US', { minimumFractionDigits: d, maximumFractionDigits: d })
  const label = (key: string) => {
    const p = s.parts[key]
    return typeof p === 'function' ? p(Number(area) || 0) : p
  }

  return (
    <Stack data-testid="ac-size">
      <p className="text-[0.95rem] text-ink-soft rtl:font-ar">{s.intro}</p>

      <div className="flex flex-wrap items-end gap-3">
        <Field label={s.area}>
          <Input type="number" min={1} className="w-[7rem]" value={area} data-testid="ac-area" onChange={(e) => setArea(e.target.value)} />
        </Field>
        <Field label={s.ceiling}>
          <Input type="number" min={2} step="0.1" className="w-[7rem]" value={ceiling} data-testid="ac-ceiling" onChange={(e) => setCeiling(e.target.value)} />
        </Field>
        <Field label={s.people}>
          <Input type="number" min={0} className="w-[6rem]" value={people} data-testid="ac-people" onChange={(e) => setPeople(e.target.value)} />
        </Field>
      </div>
      <div className="flex flex-wrap gap-4">
        <Check><input type="checkbox" checked={sunny} data-testid="ac-sunny" onChange={(e) => setSunny(e.target.checked)} /> {s.sunny}</Check>
        <Check><input type="checkbox" checked={topFloor} data-testid="ac-top" onChange={(e) => setTopFloor(e.target.checked)} /> {s.topFloor}</Check>
        <Check><input type="checkbox" checked={kitchen} data-testid="ac-kitchen" onChange={(e) => setKitchen(e.target.checked)} /> {s.kitchen}</Check>
      </div>

      <Panel className="gap-2">
        <div className="flex flex-wrap gap-x-10 gap-y-3">
          <div>
            <div className="text-[0.7rem] uppercase tracking-[0.05em] text-ink-faint rtl:font-ar">{s.need}</div>
            <div className="font-mono text-[1.5rem] text-ink" data-testid="ac-need">{n(r.btu)} BTU/h</div>
            <div className="font-mono text-[0.9rem] text-ink-faint" data-testid="ac-need-tons">{n(r.tons, 2)} {s.tons}</div>
          </div>
          <div>
            <div className="text-[0.7rem] uppercase tracking-[0.05em] text-ink-faint rtl:font-ar">{s.buy}</div>
            <div className="font-mono text-[1.8rem] font-semibold text-green-700" data-testid="ac-unit">{n(r.unit)} BTU/h</div>
            <div className="font-mono text-[0.9rem] text-ink-faint" data-testid="ac-unit-tons">{n(r.unitTons, 1)} {s.tons}</div>
          </div>
        </div>
      </Panel>

      {/* The working, so the answer can be argued with rather than believed. */}
      <Panel className="gap-2">
        <div role="heading" aria-level={2} className="text-[0.7rem] uppercase tracking-[0.05em] text-ink-faint rtl:font-ar">{s.working}</div>
        <table className="text-[0.88rem]" data-testid="ac-working">
          <tbody>
            {r.parts.map((p) => (
              <tr key={p.key} className="border-t border-[color:var(--line-soft)] first:border-0" data-testid={`ac-part-${p.key}`}>
                <td className="py-[0.25rem] pe-6 text-ink-soft rtl:font-ar">{label(p.key)}</td>
                <td className="py-[0.25rem] font-mono text-ink whitespace-nowrap">+{n(p.btu)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-[0.82rem] text-ink-faint rtl:font-ar" data-testid="ac-ton-note">{s.tonNote}</p>
      </Panel>

      <Panel className={isOversized(r) ? 'gap-1 border-gold-500' : 'gap-1'}>
        <div role="heading" aria-level={2} className="font-display text-[1.05rem] text-ink rtl:font-ar">{s.overTitle}</div>
        <p className="text-[0.9rem] text-ink-soft rtl:font-ar" data-testid="ac-oversize">
          {isOversized(r) ? s.overBody(r.overBy) : s.overOk}
        </p>
      </Panel>

      {/* No <Disclaimer>: this estimates neither money, health, an entitlement
          nor an official deadline, and the five kinds mean something precisely
          because they are not stretched to cover everything. The honest caveat
          is stated in its own words instead. */}
      <Panel className="gap-1">
        <div role="heading" aria-level={2} className="font-display text-[1.05rem] text-ink rtl:font-ar">{s.honestTitle}</div>
        <p className="text-[0.9rem] text-ink-soft rtl:font-ar" data-testid="ac-honest">{s.honestBody}</p>
      </Panel>

      <Button className="self-start px-3 py-1" to={localePath(locale, '/apps/electricity-bill')} data-testid="ac-bill">{s.bill}</Button>
    </Stack>
  )
}
