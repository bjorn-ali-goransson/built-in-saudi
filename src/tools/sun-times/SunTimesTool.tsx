import { useMemo, useState } from 'react'
import { Coordinates, SunnahTimes, PrayerTimes, CalculationMethod } from 'adhan'
import { useLocale } from '../../i18n'
import { Button, Input, Select, Stack, Panel } from '../../components/ui'
import { CompassIcon, SunHorizonIcon } from '../../components/icons'
import { CITIES, DEFAULT_CITY } from '../prayer-times/cities'
import { savedPrayerLocation, geolocate } from '../../lib/prayerLocation'
import { formatHijri } from '../prayer-times/islamic'
import { solarEvents, type SunEvent } from './solar'

const STR = {
  en: {
    place: 'Place', date: 'Date', myLocation: 'Use my location',
    golden: 'Golden hour', blue: 'Blue hour',
    dayLength: 'Daylight', night: 'Astronomical night',
    events: {
      astroDawn: 'Astronomical dawn', nauticalDawn: 'Nautical dawn', civilDawn: 'Civil dawn (first light)',
      sunrise: 'Sunrise', goldenMorningEnd: 'Morning golden hour ends',
      solarNoon: 'Solar noon',
      goldenEveningStart: 'Evening golden hour starts', sunset: 'Sunset',
      civilDusk: 'Civil dusk (last light)', nauticalDusk: 'Nautical dusk', astroDusk: 'Astronomical dusk',
    } as Record<string, string>,
    photoNote: 'Golden hour is the sun between 6° above and 6° below the horizon; blue hour is 6° to 4° below. Those are the numbers photographers actually work to — not simply “an hour after sunrise”, which is wrong everywhere except the mid-latitudes in spring.',
    polar: 'At this latitude and date the sun does not cross some of these thresholds at all, so those rows are blank rather than guessed.',
    prayer: 'Prayer times for here',
  },
  ar: {
    place: 'المكان', date: 'التاريخ', myLocation: 'استخدم موقعي',
    golden: 'الساعة الذهبية', blue: 'الساعة الزرقاء',
    dayLength: 'طول النهار', night: 'الليل الفلكي',
    events: {
      astroDawn: 'الفجر الفلكي', nauticalDawn: 'الفجر البحري', civilDawn: 'الفجر المدني (أول ضوء)',
      sunrise: 'الشروق', goldenMorningEnd: 'نهاية الساعة الذهبية الصباحية',
      solarNoon: 'الظهيرة الشمسية',
      goldenEveningStart: 'بداية الساعة الذهبية المسائية', sunset: 'الغروب',
      civilDusk: 'الشفق المدني (آخر ضوء)', nauticalDusk: 'الشفق البحري', astroDusk: 'الشفق الفلكي',
    } as Record<string, string>,
    photoNote: 'الساعة الذهبية هي وجود الشمس بين ٦° فوق الأفق و٦° تحته، والزرقاء بين ٦° و٤° تحته. هذه هي الأرقام التي يعمل بها المصوّرون فعلًا — لا «ساعة بعد الشروق»، وهي خاطئة في كل مكان إلا خطوط العرض الوسطى ربيعًا.',
    polar: 'عند خط العرض والتاريخ هذين لا تعبر الشمس بعض هذه العتبات أصلًا، لذا تبقى تلك الصفوف فارغة بدل تخمينها.',
    prayer: 'أوقات الصلاة هنا',
  },
}

const todayIso = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function SunTimesTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const saved = savedPrayerLocation()
  const [loc, setLoc] = useState(() => ({
    lat: saved?.lat ?? DEFAULT_CITY.lat,
    lng: saved?.lng ?? DEFAULT_CITY.lng,
    tz: saved?.tz ?? DEFAULT_CITY.tz,
    label: saved?.label ?? (locale === 'ar' ? DEFAULT_CITY.ar : DEFAULT_CITY.en),
  }))
  const [date, setDate] = useState(todayIso())
  const [locating, setLocating] = useState(false)

  const day = useMemo(() => {
    const [y, m, d] = date.split('-').map(Number)
    return new Date(y, (m || 1) - 1, d || 1, 12)
  }, [date])

  const events = useMemo(() => solarEvents(loc.lat, loc.lng, day), [loc.lat, loc.lng, day])

  const prayer = useMemo(
    () => new PrayerTimes(new Coordinates(loc.lat, loc.lng), day, CalculationMethod.UmmAlQura()),
    [loc.lat, loc.lng, day],
  )
  const sunnah = useMemo(() => new SunnahTimes(prayer), [prayer])

  // Times are shown in the PLACE's timezone, not the viewer's: looking up
  // Makkah's sunrise from London must show Makkah's morning, not the same
  // instant relabelled into a London hour that means nothing on the ground.
  const fmt = (d: Date | null) =>
    d ? d.toLocaleTimeString(locale === 'ar' ? 'ar-SA' : 'en-GB', {
      hour: '2-digit', minute: '2-digit', hour12: false, timeZone: loc.tz,
    }) : '—'

  const anyMissing = Object.values(events).some((v) => v === null)

  const dayLength = events.sunrise && events.sunset
    ? (events.sunset.getTime() - events.sunrise.getTime()) / 3600000
    : null

  async function useMine() {
    setLocating(true)
    const g = await geolocate()
    setLocating(false)
    if (g) setLoc({ lat: g.lat, lng: g.lng, tz: g.tz, label: locale === 'ar' ? 'موقعي' : 'My location' })
  }

  const ORDER: (keyof SunEvent)[] = [
    'astroDawn', 'nauticalDawn', 'civilDawn', 'sunrise', 'goldenMorningEnd',
    'solarNoon', 'goldenEveningStart', 'sunset', 'civilDusk', 'nauticalDusk', 'astroDusk',
  ]

  return (
    <Stack data-testid="sun-times">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-[0.8rem] text-ink-faint">
          {s.place}
          <Select className="min-w-[12rem]" data-testid="st-city"
            value={CITIES.find((c) => Math.abs(c.lat - loc.lat) < 0.01)?.id ?? ''}
            onChange={(e) => {
              const c = CITIES.find((x) => x.id === e.target.value)
              if (c) setLoc({ lat: c.lat, lng: c.lng, tz: c.tz, label: locale === 'ar' ? c.ar : c.en })
            }}>
            <option value="">{loc.label}</option>
            {CITIES.map((c) => <option key={c.id} value={c.id}>{locale === 'ar' ? c.ar : c.en}</option>)}
          </Select>
        </label>
        <label className="flex flex-col gap-1 text-[0.8rem] text-ink-faint">
          {s.date}
          <Input type="date" className="w-44" data-testid="st-date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <Button onClick={useMine} disabled={locating} data-testid="st-geo"><CompassIcon /> {s.myLocation}</Button>
      </div>

      <p className="text-[0.85rem] text-ink-faint font-mono" data-testid="st-hijri">
        {formatHijri(day, locale)} · <span data-testid="st-tz">{loc.tz}</span>
      </p>

      <Panel className="flex flex-wrap gap-x-8 gap-y-3" data-testid="st-highlights">
        <div className="flex flex-col">
          <span className="font-body text-[0.68rem] uppercase tracking-[0.06em] text-ink-faint">{s.golden}</span>
          <span className="font-mono text-[1.05rem] text-ink" data-testid="st-golden">
            {fmt(events.sunrise)}–{fmt(events.goldenMorningEnd)} · {fmt(events.goldenEveningStart)}–{fmt(events.sunset)}
          </span>
        </div>
        <div className="flex flex-col">
          <span className="font-body text-[0.68rem] uppercase tracking-[0.06em] text-ink-faint">{s.blue}</span>
          <span className="font-mono text-[1.05rem] text-ink" data-testid="st-blue">
            {fmt(events.civilDawn)}–{fmt(events.sunrise)} · {fmt(events.sunset)}–{fmt(events.civilDusk)}
          </span>
        </div>
        {dayLength !== null && (
          <div className="flex flex-col">
            <span className="font-body text-[0.68rem] uppercase tracking-[0.06em] text-ink-faint">{s.dayLength}</span>
            <span className="font-mono text-[1.05rem] text-ink" data-testid="st-daylength">
              {Math.floor(dayLength)}h {Math.round((dayLength % 1) * 60)}m
            </span>
          </div>
        )}
      </Panel>

      <div className="flex flex-col divide-y divide-[color:var(--line)] border border-[color:var(--line)] rounded-md overflow-hidden" data-testid="st-events">
        {ORDER.map((key) => (
          <div key={key} className="flex items-center gap-3 px-3 py-1.5 bg-[var(--surface)]">
            <SunHorizonIcon className="text-ink-faint flex-none" />
            <span className="text-[0.9rem] text-ink flex-1 rtl:font-ar">{s.events[key]}</span>
            <span className="font-mono text-[0.95rem] text-ink" data-testid={`st-${key}`}>{fmt(events[key])}</span>
          </div>
        ))}
      </div>

      {anyMissing && <p className="text-[0.85rem] text-gold-500 rtl:font-ar" data-testid="st-polar">{s.polar}</p>}
      <p className="text-[0.85rem] text-ink-faint rtl:font-ar">{s.photoNote}</p>

      <Panel className="flex flex-wrap gap-x-6 gap-y-1 text-[0.9rem]">
        <span className="font-body text-[0.68rem] uppercase tracking-[0.06em] text-ink-faint w-full">{s.prayer}</span>
        <span className="text-ink-faint">Fajr <b className="font-mono text-ink">{fmt(prayer.fajr)}</b></span>
        <span className="text-ink-faint">Maghrib <b className="font-mono text-ink">{fmt(prayer.maghrib)}</b></span>
        <span className="text-ink-faint">Isha <b className="font-mono text-ink">{fmt(prayer.isha)}</b></span>
        <span className="text-ink-faint">Last third <b className="font-mono text-ink">{fmt(sunnah.lastThirdOfTheNight)}</b></span>
      </Panel>

      <Button to={`/${locale}/apps/prayer-times`} className="self-start">
        {locale === 'ar' ? 'أوقات الصلاة الكاملة' : 'Full prayer times'}
      </Button>
    </Stack>
  )
}
