import { useMemo, useState } from 'react'
import { Coordinates, CalculationMethod, PrayerTimes } from 'adhan'
import { useLocale } from '../../i18n'
import { Input, Select, Stack, Panel, Disclaimer, Check, Button } from '../../components/ui'
import { CopyIcon, MosqueIcon } from '../../components/icons'
import { CITIES, DEFAULT_CITY } from '../prayer-times/cities'
import { savedPrayerLocation } from '../../lib/prayerLocation'

// Spacing doses evenly is the easy part. The useful part here is that during
// Ramadan a "three times a day" medicine has to fit between Maghrib and Fajr,
// which is a window of ~10 hours rather than 24 — and people quietly skip doses
// or take them too close together rather than ask. This lays the window out.

const FREQUENCIES = [1, 2, 3, 4] as const

const STR = {
  en: {
    doses: 'Doses per day', wake: 'Usual waking hour', city: 'Prayer times in',
    fasting: 'I am fasting (schedule between iftar and suhoor)',
    withFood: 'Take with food',
    schedule: 'Suggested times', gap: 'Gap',
    hours: 'h',
    windowTitle: 'Your window tonight',
    iftar: 'Iftar (Maghrib)', suhoor: 'Suhoor ends (Fajr)',
    windowLength: 'That is a window of',
    tooTight: 'Four doses will not space comfortably inside the fasting window. A doctor can often switch you to a longer-acting form for Ramadan — ask before you start skipping doses or doubling up.',
    nearPrayer: 'near',
    copy: 'Copy the schedule', copied: 'Copied!',
    caveat: 'This spaces doses evenly; it does not know your medicine. Some must be taken with food, some on an empty stomach, some at a fixed hour regardless. Never change when or whether you take something because of this page — ask the pharmacist who dispensed it, and ask specifically about Ramadan before it starts.',
    fastingNote: 'Injections, eye drops and things absorbed through the skin are treated differently from swallowed medicine in the rulings on fasting, and scholars differ. If a medicine cannot wait until iftar, ask both a doctor and someone qualified to advise on the ruling.',
  },
  ar: {
    doses: 'الجرعات في اليوم', wake: 'ساعة الاستيقاظ عادةً', city: 'أوقات الصلاة في',
    fasting: 'أنا صائم (وزّع الجرعات بين الإفطار والسحور)',
    withFood: 'تُؤخذ مع الطعام',
    schedule: 'الأوقات المقترحة', gap: 'الفاصل',
    hours: 'س',
    windowTitle: 'نافذتك الليلة',
    iftar: 'الإفطار (المغرب)', suhoor: 'نهاية السحور (الفجر)',
    windowLength: 'وهي نافذة مقدارها',
    tooTight: 'أربع جرعات لن تتباعد بشكل مريح داخل نافذة الصيام. وكثيرًا ما يستطيع الطبيب تحويلك إلى صيغة طويلة المفعول في رمضان — اسأله قبل أن تبدأ بتفويت الجرعات أو مضاعفتها.',
    nearPrayer: 'قرب',
    copy: 'انسخ الجدول', copied: 'تم النسخ!',
    caveat: 'توزّع هذه الأداة الجرعات بالتساوي، وهي لا تعرف دواءك. فبعض الأدوية تُؤخذ مع الطعام وبعضها على معدة فارغة وبعضها في ساعة محددة مهما كان. لا تغيّر موعد دوائك أو تتركه بسبب هذه الصفحة — اسأل الصيدلي الذي صرفه لك، واسأل تحديدًا عن رمضان قبل دخوله.',
    fastingNote: 'الحقن وقطرة العين وما يُمتص عبر الجلد تختلف أحكامها عن الدواء المبتلَع في مسائل الصيام، وقد اختلف أهل العلم. وإن كان الدواء لا يحتمل التأخير إلى الإفطار فاسأل الطبيب وأهل العلم معًا.',
  },
}

// The device's own clock: this is the schedule you will actually follow, so it
// has to match the watch on your wrist. The city only selects prayer times.
const fmt = (d: Date, locale: 'en' | 'ar') =>
  d.toLocaleTimeString(locale === 'ar' ? 'ar-SA' : 'en-GB', {
    hour: '2-digit', minute: '2-digit', hour12: false,
  })

export default function MedicineScheduleTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const saved = savedPrayerLocation()
  const [cityId, setCityId] = useState(() =>
    CITIES.find((x) => saved && Math.abs(x.lat - saved.lat) < 0.01)?.id ?? DEFAULT_CITY.id)
  const [doses, setDoses] = useState<number>(3)
  const [wake, setWake] = useState('07:00')
  const [fasting, setFasting] = useState(false)
  const [copied, setCopied] = useState(false)

  const city = CITIES.find((c) => c.id === cityId) ?? DEFAULT_CITY
  const prayer = useMemo(
    () => new PrayerTimes(new Coordinates(city.lat, city.lng), new Date(), CalculationMethod.UmmAlQura()),
    [city],
  )

  // Fasting: spread across Maghrib → next Fajr. Otherwise: across the waking day.
  const times = useMemo(() => {
    if (fasting) {
      const start = prayer.maghrib.getTime()
      let end = prayer.fajr.getTime()
      if (end <= start) end += 86400000
      // Doses sit inside the window with a margin at each end, so the first is
      // not literally at the call to Maghrib and the last not at Fajr exactly.
      const margin = 20 * 60000
      const from = start + margin
      const to = end - margin
      const step = doses > 1 ? (to - from) / (doses - 1) : 0
      return Array.from({ length: doses }, (_, i) => new Date(from + step * i))
    }
    const [h, m] = wake.split(':').map(Number)
    const base = new Date()
    base.setHours(h || 7, m || 0, 0, 0)
    // A waking day of ~16 hours, doses spread across it.
    const span = 16 * 3600000
    const step = doses > 1 ? span / (doses - 1) : 0
    return Array.from({ length: doses }, (_, i) => new Date(base.getTime() + step * i))
  }, [fasting, doses, wake, prayer])

  const windowMs = useMemo(() => {
    const start = prayer.maghrib.getTime()
    let end = prayer.fajr.getTime()
    if (end <= start) end += 86400000
    return end - start
  }, [prayer])

  const gapHours = doses > 1
    ? (times[times.length - 1].getTime() - times[0].getTime()) / 3600000 / (doses - 1)
    : 0

  const tooTight = fasting && doses >= 4 && gapHours < 3

  // Name the nearest prayer to each dose — an easier anchor to remember than a
  // clock time, and the reason people actually keep to a schedule.
  const anchors: [string, Date][] = [
    [locale === 'ar' ? 'الفجر' : 'Fajr', prayer.fajr],
    [locale === 'ar' ? 'الظهر' : 'Dhuhr', prayer.dhuhr],
    [locale === 'ar' ? 'العصر' : 'Asr', prayer.asr],
    [locale === 'ar' ? 'المغرب' : 'Maghrib', prayer.maghrib],
    [locale === 'ar' ? 'العشاء' : 'Isha', prayer.isha],
  ]
  const nearest = (d: Date) => {
    let best = anchors[0]
    let bestDiff = Infinity
    for (const a of anchors) {
      const diff = Math.abs(a[1].getTime() - d.getTime())
      if (diff < bestDiff) { bestDiff = diff; best = a }
    }
    return bestDiff <= 45 * 60000 ? best[0] : null
  }

  const asText = times.map((t, i) => `${i + 1}. ${fmt(t, locale)}`).join('\n')
  async function copy() {
    try { await navigator.clipboard.writeText(asText); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch { /* ignore */ }
  }

  return (
    <Stack data-testid="medicine-schedule">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-[0.8rem] text-ink-faint">
          {s.doses}
          <Select className="w-24" data-testid="ms-doses" value={doses} onChange={(e) => setDoses(+e.target.value)}>
            {FREQUENCIES.map((f) => <option key={f} value={f}>{f}</option>)}
          </Select>
        </label>
        {!fasting && (
          <label className="flex flex-col gap-1 text-[0.8rem] text-ink-faint">
            {s.wake}
            <Input type="time" className="w-32 font-mono" data-testid="ms-wake" value={wake} onChange={(e) => setWake(e.target.value)} />
          </label>
        )}
        <label className="flex flex-col gap-1 text-[0.8rem] text-ink-faint">
          {s.city}
          <Select className="min-w-[10rem]" data-testid="ms-city" value={cityId} onChange={(e) => setCityId(e.target.value)}>
            {CITIES.map((c) => <option key={c.id} value={c.id}>{locale === 'ar' ? c.ar : c.en}</option>)}
          </Select>
        </label>
      </div>

      <Check>
        <input type="checkbox" checked={fasting} data-testid="ms-fasting" onChange={(e) => setFasting(e.target.checked)} /> {s.fasting}
      </Check>

      {fasting && (
        <Panel className="flex flex-wrap gap-x-8 gap-y-2" data-testid="ms-window">
          <div className="flex flex-col">
            <span className="font-body text-[0.68rem] uppercase tracking-[0.06em] text-ink-faint">{s.iftar}</span>
            <span className="font-mono text-[1.05rem] text-ink" data-testid="ms-iftar">{fmt(prayer.maghrib, locale)}</span>
          </div>
          <div className="flex flex-col">
            <span className="font-body text-[0.68rem] uppercase tracking-[0.06em] text-ink-faint">{s.suhoor}</span>
            <span className="font-mono text-[1.05rem] text-ink" data-testid="ms-suhoor">{fmt(prayer.fajr, locale)}</span>
          </div>
          <div className="flex flex-col">
            <span className="font-body text-[0.68rem] uppercase tracking-[0.06em] text-ink-faint">{s.windowLength}</span>
            <span className="font-mono text-[1.05rem] text-ink" data-testid="ms-windowlen">{(windowMs / 3600000).toFixed(1)} {s.hours}</span>
          </div>
        </Panel>
      )}

      <section className="flex flex-col gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <h2 className="font-body text-[0.68rem] uppercase tracking-[0.06em] text-ink-faint flex-1">{s.schedule}</h2>
          <span className="text-[0.85rem] text-ink-faint" data-testid="ms-gap">{s.gap} {gapHours.toFixed(1)} {s.hours}</span>
          <Button className="px-3 py-1" onClick={copy} data-testid="ms-copy"><CopyIcon /> {copied ? s.copied : s.copy}</Button>
        </div>
        <div className="flex flex-col gap-2" data-testid="ms-times">
          {times.map((t, i) => {
            const anchor = nearest(t)
            return (
              <div key={i} className="flex items-center gap-3 border border-[color:var(--line)] rounded-md bg-[var(--surface)] px-3 py-2.5">
                <span className="font-mono text-[0.8rem] text-ink-faint w-6">{i + 1}</span>
                <span className="font-display text-[1.4rem] text-ink font-mono" data-testid={`ms-time-${i}`}>{fmt(t, locale)}</span>
                {anchor && (
                  <span className="flex items-center gap-1.5 text-[0.82rem] text-ink-faint rtl:font-ar">
                    <MosqueIcon /> {s.nearPrayer} {anchor}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      </section>

      {tooTight && <p className="text-[0.9rem] text-gold-500 rtl:font-ar" data-testid="ms-tootight">{s.tooTight}</p>}

      <Disclaimer kind="medical" locale={locale}>{s.caveat}</Disclaimer>
      {fasting && (
        <Disclaimer kind="religious" locale={locale} tone="quiet">{s.fastingNote}</Disclaimer>
      )}
    </Stack>
  )
}
