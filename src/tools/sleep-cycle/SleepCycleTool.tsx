import { useMemo, useState } from 'react'
import { Coordinates, CalculationMethod, PrayerTimes } from 'adhan'
import { useLocale } from '../../i18n'
import { Input, Select, Stack, Seg, SegButton, Panel, Disclaimer } from '../../components/ui'
import { MoonIcon, SunHorizonIcon } from '../../components/icons'
import { CITIES, DEFAULT_CITY } from '../prayer-times/cities'
import { savedPrayerLocation } from '../../lib/prayerLocation'

// A sleep cycle averages ~90 minutes, and waking at the end of one rather than
// in the middle of deep sleep is why people wake refreshed at 7.5 hours and
// groggy at 8. Falling asleep takes time too — the usual allowance is 15 minutes,
// and leaving it out is why "set an alarm for exactly 6 hours" does not work.
const CYCLE_MIN = 90
const FALL_ASLEEP_MIN = 15
const CYCLES = [6, 5, 4, 3]

const STR = {
  en: {
    mode: 'I want to', wake: 'wake up at', sleep: 'go to bed now',
    bedAt: 'go to bed at',
    time: 'Time', city: 'For prayer times in',
    goToBed: 'Go to bed at one of these', wakeAt: 'Wake up at one of these',
    cycles: (n: number) => `${n} cycles · ${(n * 1.5).toFixed(1)} h`,
    best: 'best',
    fajrWarn: 'This wake time is after Fajr.',
    fajrOk: 'Before Fajr',
    fajrAt: 'Fajr is at',
    allowance: `Includes ${FALL_ASLEEP_MIN} minutes to fall asleep.`,
    why: 'A cycle averages about 90 minutes. Waking at the end of one rather than in the middle of deep sleep is why 7.5 hours can leave you sharper than 8. It is an average, not your average — a chronic sleep problem is worth a doctor, not a calculator.',
    qiyam: 'Last third of the night',
    qiyamNote: 'Shown for anyone praying qiyām: it begins here and ends at Fajr.',
  },
  ar: {
    mode: 'أريد أن', wake: 'أستيقظ في', sleep: 'أنام الآن',
    bedAt: 'أنام في',
    time: 'الوقت', city: 'أوقات الصلاة في',
    goToBed: 'نم في أحد هذه الأوقات', wakeAt: 'استيقظ في أحد هذه الأوقات',
    cycles: (n: number) => `${n.toLocaleString('ar')} دورات · ${(n * 1.5).toFixed(1)} ساعة`,
    best: 'الأفضل',
    fajrWarn: 'وقت الاستيقاظ هذا بعد الفجر.',
    fajrOk: 'قبل الفجر',
    fajrAt: 'الفجر في',
    allowance: `يشمل ${FALL_ASLEEP_MIN} دقيقة للنوم.`,
    why: 'تبلغ الدورة نحو ٩٠ دقيقة في المتوسط. والاستيقاظ في نهايتها لا في وسط النوم العميق هو سبب أن ٧٫٥ ساعة قد تتركك أنشط من ٨. وهو متوسط عام لا متوسطك أنت — ومشكلة النوم المزمنة تستحق طبيبًا لا حاسبة.',
    qiyam: 'الثلث الأخير من الليل',
    qiyamNote: 'يُعرض لمن يقوم الليل: يبدأ هنا وينتهي بالفجر.',
  },
}

// Shown on the device's own clock, deliberately. Unlike Sunrise & Golden Hour
// — where you look up a place you are not standing in — this plans YOUR night,
// so the times must match the clock you will set an alarm on. The city choice
// only decides which prayer times to derive.
const fmt = (d: Date, locale: 'en' | 'ar') =>
  d.toLocaleTimeString(locale === 'ar' ? 'ar-SA' : 'en-GB', {
    hour: '2-digit', minute: '2-digit', hour12: false,
  })

export default function SleepCycleTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const saved = savedPrayerLocation()
  const [cityId, setCityId] = useState(() => {
    const c = CITIES.find((x) => saved && Math.abs(x.lat - saved.lat) < 0.01)
    return c?.id ?? DEFAULT_CITY.id
  })
  const [mode, setMode] = useState<'wake' | 'now' | 'bed'>('wake')
  const [target, setTarget] = useState('06:00')

  const city = CITIES.find((c) => c.id === cityId) ?? DEFAULT_CITY

  const prayer = useMemo(
    () => new PrayerTimes(new Coordinates(city.lat, city.lng), new Date(), CalculationMethod.UmmAlQura()),
    [city],
  )

  const times = useMemo(() => {
    const base = new Date()
    if (mode !== 'now') {
      const [h, m] = target.split(':').map(Number)
      base.setHours(h || 0, m || 0, 0, 0)
      // A wake time earlier than now means tomorrow morning.
      if (mode === 'wake' && base.getTime() <= Date.now()) base.setDate(base.getDate() + 1)
    }
    return CYCLES.map((n) => {
      const delta = (n * CYCLE_MIN + FALL_ASLEEP_MIN) * 60000
      // Working back from a wake time gives bedtimes; forward gives wake times.
      const at = new Date(mode === 'wake' ? base.getTime() - delta : base.getTime() + delta)
      return { cycles: n, at }
    })
  }, [mode, target])

  // The last third of the night, for anyone praying qiyām — computed from
  // Maghrib to Fajr, which is how it is defined.
  const lastThird = useMemo(() => {
    const maghrib = prayer.maghrib.getTime()
    const fajr = prayer.fajr.getTime() + (prayer.fajr < prayer.maghrib ? 86400000 : 0)
    return new Date(maghrib + ((fajr - maghrib) * 2) / 3)
  }, [prayer])

  return (
    <Stack data-testid="sleep-cycle">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <span className="text-[0.8rem] text-ink-faint">{s.mode}</span>
          <Seg>
            <SegButton active={mode === 'wake'} data-testid="sc-mode-wake" onClick={() => setMode('wake')}>{s.wake}</SegButton>
            <SegButton active={mode === 'now'} data-testid="sc-mode-now" onClick={() => setMode('now')}>{s.sleep}</SegButton>
            <SegButton active={mode === 'bed'} data-testid="sc-mode-bed" onClick={() => setMode('bed')}>{s.bedAt}</SegButton>
          </Seg>
        </div>
        {mode !== 'now' && (
          <label className="flex flex-col gap-1 text-[0.8rem] text-ink-faint">
            {s.time}
            <Input type="time" className="w-32 font-mono" data-testid="sc-time"
              value={target} onChange={(e) => setTarget(e.target.value)} />
          </label>
        )}
        <label className="flex flex-col gap-1 text-[0.8rem] text-ink-faint">
          {s.city}
          <Select className="min-w-[10rem]" data-testid="sc-city" value={cityId} onChange={(e) => setCityId(e.target.value)}>
            {CITIES.map((c) => <option key={c.id} value={c.id}>{locale === 'ar' ? c.ar : c.en}</option>)}
          </Select>
        </label>
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="font-body text-[0.68rem] uppercase tracking-[0.06em] text-ink-faint">
          {mode === 'wake' ? s.goToBed : s.wakeAt}
        </h2>
        <div className="grid gap-2 grid-cols-1 min-[560px]:grid-cols-2" data-testid="sc-times">
          {times.map((t, i) => {
            // A wake time after Fajr is worth flagging here — most people using
            // this in Saudi want to be up before it, not after.
            const afterFajr = mode !== 'wake' && t.at.getHours() >= prayer.fajr.getHours() && t.at > prayer.fajr
            return (
              <div key={t.cycles} data-testid={`sc-slot-${t.cycles}`}
                className={`flex items-center gap-3 border rounded-md px-3 py-2.5 ${i === 0 ? 'border-green-600 bg-[color-mix(in_srgb,var(--color-green-400)_10%,transparent)]' : 'border-[color:var(--line)] bg-[var(--surface)]'}`}>
                <MoonIcon className="text-ink-faint flex-none" />
                <span className="font-display text-[1.4rem] text-ink font-mono">{fmt(t.at, locale)}</span>
                <span className="text-[0.82rem] text-ink-faint flex-1 rtl:font-ar">{s.cycles(t.cycles)}</span>
                {i === 0 && <span className="text-[0.72rem] uppercase tracking-[0.06em] text-green-700">{s.best}</span>}
                {afterFajr && <span className="text-[0.72rem] text-gold-500 rtl:font-ar">{s.fajrWarn}</span>}
              </div>
            )
          })}
        </div>
        <p className="text-[0.82rem] text-ink-faint rtl:font-ar">{s.allowance}</p>
      </section>

      <Panel className="flex flex-wrap gap-x-8 gap-y-2">
        <div className="flex flex-col">
          <span className="font-body text-[0.68rem] uppercase tracking-[0.06em] text-ink-faint">{s.fajrAt}</span>
          <span className="font-mono text-[1.1rem] text-ink" data-testid="sc-fajr">{fmt(prayer.fajr, locale)}</span>
        </div>
        <div className="flex flex-col">
          <span className="font-body text-[0.68rem] uppercase tracking-[0.06em] text-ink-faint flex items-center gap-1.5">
            <SunHorizonIcon /> {s.qiyam}
          </span>
          <span className="font-mono text-[1.1rem] text-ink" data-testid="sc-qiyam">{fmt(lastThird, locale)}</span>
          <span className="text-[0.78rem] text-ink-faint rtl:font-ar">{s.qiyamNote}</span>
        </div>
      </Panel>

      <Disclaimer kind="medical" locale={locale} tone="quiet">{s.why}</Disclaimer>
    </Stack>
  )
}
