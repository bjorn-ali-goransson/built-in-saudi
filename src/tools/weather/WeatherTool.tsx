import { useEffect, useMemo, useState } from 'react'
import { Coordinates, CalculationMethod, PrayerTimes } from 'adhan'
import { useLocale } from '../../i18n'
import { Button, Select, Spinner, Stack, Panel } from '../../components/ui'
import { CompassIcon, RefreshIcon } from '../../components/icons'
import { CITIES, DEFAULT_CITY } from '../prayer-times/cities'
import { savedPrayerLocation, geolocate } from '../../lib/prayerLocation'
import { formatHijri } from '../prayer-times/islamic'
import { getWeather, type Weather } from './api'
import { describe, sky, dustBand, DUST_LABEL, DUST_TONE, uvLabel } from './codes'
import { SkyIcon } from './SkyIcon'

const PRAYERS = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'] as const

const STR = {
  en: {
    city: 'Location', myLocation: 'Use my location', locating: 'Finding you…',
    feels: 'Feels like', humidity: 'Humidity', wind: 'Wind', uv: 'UV',
    dust: 'Dust & air', pm10: 'PM10', today: 'Next 24 hours', week: 'The week ahead',
    atPrayers: 'Temperature at prayer times',
    sunrise: 'Sunrise', sunset: 'Sunset',
    stale: 'Showing the last forecast saved on this device — the network did not answer.',
    failed: 'Could not load the forecast. Check your connection and try again.',
    retry: 'Try again',
    source: 'Weather data by Open-Meteo.com (CC BY 4.0). Your coordinates are rounded to about a kilometre before they are sent, and nothing else about you is.',
    names: { fajr: 'Fajr', sunrise: 'Sunrise', dhuhr: 'Dhuhr', asr: 'Asr', maghrib: 'Maghrib', isha: 'Isha' },
    days: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  },
  ar: {
    city: 'الموقع', myLocation: 'استخدم موقعي', locating: 'جارٍ تحديد موقعك…',
    feels: 'يُحس كـ', humidity: 'الرطوبة', wind: 'الرياح', uv: 'الأشعة',
    dust: 'الغبار والهواء', pm10: 'PM10', today: 'الـ٢٤ ساعة القادمة', week: 'الأسبوع القادم',
    atPrayers: 'الحرارة عند أوقات الصلاة',
    sunrise: 'الشروق', sunset: 'الغروب',
    stale: 'تُعرض آخر نشرة محفوظة على هذا الجهاز — لم تستجب الشبكة.',
    failed: 'تعذّر تحميل النشرة. تحقّق من اتصالك وأعد المحاولة.',
    retry: 'أعد المحاولة',
    source: 'بيانات الطقس من Open-Meteo.com (رخصة CC BY 4.0). تُقرَّب إحداثياتك إلى نحو كيلومتر قبل إرسالها، ولا يُرسل عنك شيء آخر.',
    names: { fajr: 'الفجر', sunrise: 'الشروق', dhuhr: 'الظهر', asr: 'العصر', maghrib: 'المغرب', isha: 'العشاء' },
    days: ['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'],
  },
}

interface Loc { lat: number; lng: number; label: string }

export default function WeatherTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const [loc, setLoc] = useState<Loc>(() => {
    const saved = savedPrayerLocation()
    if (saved) {
      const city = CITIES.find((c) => Math.abs(c.lat - saved.lat) < 0.01 && Math.abs(c.lng - saved.lng) < 0.01)
      return { lat: saved.lat, lng: saved.lng, label: city ? city[locale === 'ar' ? 'ar' : 'en'] : (saved.label || '') }
    }
    return { lat: DEFAULT_CITY.lat, lng: DEFAULT_CITY.lng, label: DEFAULT_CITY[locale === 'ar' ? 'ar' : 'en'] }
  })
  const [data, setData] = useState<(Weather & { stale: boolean }) | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [locating, setLocating] = useState(false)
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    let cancelled = false
    setState('loading')
    getWeather(loc.lat, loc.lng)
      .then((w) => { if (!cancelled) { setData(w); setState('ready') } })
      .catch(() => { if (!cancelled) setState('error') })
    return () => { cancelled = true }
  }, [loc.lat, loc.lng, nonce])

  async function useMyLocation() {
    setLocating(true)
    const g = await geolocate()
    setLocating(false)
    if (g) setLoc({ lat: g.lat, lng: g.lng, label: locale === 'ar' ? 'موقعي' : 'My location' })
  }

  // Prayer times are computed on-device, as everywhere else on the site; only
  // the forecast comes over the network.
  const prayerTemps = useMemo(() => {
    if (!data) return []
    const times = new PrayerTimes(new Coordinates(loc.lat, loc.lng), new Date(), CalculationMethod.UmmAlQura())
    // Open-Meteo's hourly stamps are already local to the forecast location and
    // carry no offset, so their hour must be compared against the prayer time's
    // hour IN THAT ZONE — not the viewer's, which is a different number whenever
    // you look up a city you are not standing in.
    const hourThere = (d: Date) => Number(new Intl.DateTimeFormat('en-US', {
      timeZone: data.timezone, hour: '2-digit', hour12: false,
    }).format(d)) % 24
    return PRAYERS.map((p) => {
      const when = times[p] as Date
      const target = hourThere(when)
      const hour = data.hourly.find((h) => Number(h.t.slice(11, 13)) === target)
      return { key: p, when, temp: hour?.temp ?? null, code: hour?.code ?? null }
    })
  }, [data, loc.lat, loc.lng])

  const band = dustBand(data?.air.pm10 ?? null)
  const fmtTime = (d: Date | string, zoned = false) =>
    new Date(d).toLocaleTimeString(locale === 'ar' ? 'ar-SA' : 'en-GB', {
      hour: '2-digit', minute: '2-digit', hour12: false,
      // Hourly stamps are already local to the place; only real instants
      // (the prayer times) need converting into its zone.
      ...(zoned && data ? { timeZone: data.timezone } : {}),
    })
  const temp = (n: number) => `${Math.round(n)}°`

  return (
    <Stack data-testid="weather">
      <div className="flex flex-wrap items-center gap-2">
        <Select
          className="max-w-[16rem]"
          data-testid="wx-city"
          value={CITIES.find((c) => Math.abs(c.lat - loc.lat) < 0.01 && Math.abs(c.lng - loc.lng) < 0.01)?.id ?? ''}
          onChange={(e) => {
            const c = CITIES.find((x) => x.id === e.target.value)
            if (c) setLoc({ lat: c.lat, lng: c.lng, label: locale === 'ar' ? c.ar : c.en })
          }}
        >
          <option value="">{loc.label || s.city}</option>
          {CITIES.map((c) => <option key={c.id} value={c.id}>{locale === 'ar' ? c.ar : c.en}</option>)}
        </Select>
        <Button onClick={useMyLocation} disabled={locating} data-testid="wx-geo">
          <CompassIcon /> {locating ? s.locating : s.myLocation}
        </Button>
        {state === 'ready' && (
          <Button className="px-3" onClick={() => setNonce((n) => n + 1)} aria-label={s.retry} data-testid="wx-refresh"><RefreshIcon /></Button>
        )}
      </div>

      {state === 'loading' && <Spinner className="size-6" />}
      {state === 'error' && (
        <Panel className="flex flex-col gap-2 items-start">
          <p className="text-[0.95rem] text-ink-soft rtl:font-ar" data-testid="wx-error">{s.failed}</p>
          <Button onClick={() => setNonce((n) => n + 1)}>{s.retry}</Button>
        </Panel>
      )}

      {data && state === 'ready' && (
        <>
          {data.stale && <p className="text-[0.85rem] text-gold-500 rtl:font-ar" data-testid="wx-stale">{s.stale}</p>}

          <Panel className="flex flex-wrap items-center gap-x-6 gap-y-3" data-testid="wx-current">
            <div className="flex items-center gap-3">
              <SkyIcon sky={sky(data.current.code)} day={data.current.isDay} className="size-12 text-green-600" />
              <div className="flex flex-col">
                <span className="font-display text-[clamp(2rem,7vw,2.8rem)] leading-none text-ink" data-testid="wx-temp">{temp(data.current.temp)}</span>
                <span className="text-[0.95rem] text-ink-soft rtl:font-ar" data-testid="wx-desc">{describe(data.current.code, locale)}</span>
              </div>
            </div>
            <dl className="flex flex-wrap gap-x-5 gap-y-1 text-[0.9rem] [&_dt]:text-ink-faint [&_dd]:text-ink [&_dd]:font-semibold">
              <div className="flex gap-1.5"><dt className="rtl:font-ar">{s.feels}</dt><dd>{temp(data.current.feels)}</dd></div>
              <div className="flex gap-1.5"><dt className="rtl:font-ar">{s.humidity}</dt><dd>{Math.round(data.current.humidity)}%</dd></div>
              <div className="flex gap-1.5"><dt className="rtl:font-ar">{s.wind}</dt><dd>{Math.round(data.current.wind)} km/h</dd></div>
              {data.daily[0] && (
                <div className="flex gap-1.5"><dt className="rtl:font-ar">{s.uv}</dt><dd>{Math.round(data.daily[0].uv)} · {uvLabel(data.daily[0].uv, locale)}</dd></div>
              )}
            </dl>
          </Panel>

          {band && (
            <Panel className="flex flex-wrap items-center gap-x-5 gap-y-2" data-testid="wx-dust">
              <span className="font-body text-[0.68rem] uppercase tracking-[0.06em] text-ink-faint">{s.dust}</span>
              <span className={`text-[1.05rem] rtl:font-ar ${DUST_TONE[band]}`} data-testid="wx-dust-band">{DUST_LABEL[band][locale]}</span>
              <span className="font-mono text-[0.85rem] text-ink-faint">{s.pm10} {Math.round(data.air.pm10!)} µg/m³</span>
            </Panel>
          )}

          <section className="flex flex-col gap-2">
            <h2 className="font-body text-[0.68rem] uppercase tracking-[0.06em] text-ink-faint">{s.atPrayers}</h2>
            <div className="grid grid-cols-3 min-[560px]:grid-cols-6 gap-2" data-testid="wx-prayers">
              {prayerTemps.map((p) => (
                <div key={p.key} className="flex flex-col items-center gap-0.5 border border-[color:var(--line)] rounded-md bg-[var(--surface)] py-2">
                  <span className="text-[0.78rem] text-ink-faint rtl:font-ar">{s.names[p.key]}</span>
                  <span className="font-mono text-[0.78rem] text-ink-faint">{fmtTime(p.when, true)}</span>
                  <span className="font-display text-[1.15rem] text-ink">{p.temp === null ? '—' : temp(p.temp)}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="font-body text-[0.68rem] uppercase tracking-[0.06em] text-ink-faint">{s.today}</h2>
            <div className="flex gap-2 overflow-x-auto pb-1" data-testid="wx-hourly">
              {data.hourly.map((h) => (
                <div key={h.t} className="flex flex-col items-center gap-1 min-w-[3.6rem] border border-[color:var(--line)] rounded-md bg-[var(--surface)] py-2">
                  <span className="font-mono text-[0.75rem] text-ink-faint">{fmtTime(h.t)}</span>
                  <SkyIcon sky={sky(h.code)} day className="size-5 text-ink-soft" />
                  <span className="text-[0.9rem] font-semibold text-ink">{temp(h.temp)}</span>
                  {h.rain > 20 && <span className="text-[0.7rem] text-green-700">{h.rain}%</span>}
                </div>
              ))}
            </div>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="font-body text-[0.68rem] uppercase tracking-[0.06em] text-ink-faint">{s.week}</h2>
            <div className="flex flex-col divide-y divide-[color:var(--line)] border border-[color:var(--line)] rounded-md overflow-hidden" data-testid="wx-daily">
              {data.daily.map((d) => {
                const date = new Date(d.date)
                return (
                  <div key={d.date} className="flex items-center gap-3 px-3 py-2 bg-[var(--surface)]">
                    <span className="text-[0.9rem] text-ink w-14 rtl:font-ar">{s.days[date.getDay()]}</span>
                    <span className="font-mono text-[0.72rem] text-ink-faint w-24 hidden min-[520px]:inline">{formatHijri(date, locale)}</span>
                    <SkyIcon sky={sky(d.code)} day className="size-5 text-ink-soft flex-none" />
                    <span className="text-[0.88rem] text-ink-soft flex-1 rtl:font-ar truncate">{describe(d.code, locale)}</span>
                    {d.rain > 20 && <span className="text-[0.78rem] text-green-700">{d.rain}%</span>}
                    <span className="font-mono text-[0.9rem] text-ink-faint">{temp(d.min)}</span>
                    <span className="font-mono text-[0.9rem] text-ink font-semibold">{temp(d.max)}</span>
                  </div>
                )
              })}
            </div>
          </section>

          <p className="text-[0.8rem] text-ink-faint rtl:font-ar">{s.source}</p>
        </>
      )}
    </Stack>
  )
}
