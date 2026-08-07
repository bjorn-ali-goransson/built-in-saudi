import { useMemo, useState } from 'react'
import { useLocale } from '../../i18n'
import { Button, Select, Field, Check, Stack, Panel, Disclaimer } from '../../components/ui'
import { DownloadIcon } from '../../components/icons'
import { CITIES, DEFAULT_CITY } from '../prayer-times/cities'
import { savedPrayerLocation } from '../../lib/prayerLocation'
import {
  buildTimetablePdf, columnsFor, fmtTime, monthRows, withHijri,
  type PrayerKey, type TimetableOptions,
} from './timetable'

const STR = {
  en: {
    city: 'Place', month: 'Month',
    sunrise: 'Include sunrise', hour12: '12-hour clock', hijri: 'Hijri column',
    download: 'Download the month', working: 'Building…',
    preview: 'Preview',
    names: { fajr: 'Fajr', sunrise: 'Sunrise', dhuhr: 'Dhuhr', asr: 'Asr', maghrib: 'Maghrib', isha: 'Isha' } as Record<PrayerKey, string>,
    colDate: 'Date', colHijri: 'Hijri', colDay: 'Day',
    title: (m: string, y: number) => `Prayer times · ${m} ${y}`,
    method: 'Calculated with the Umm al-Qura method.',
    note: 'Times are for the place named above. Check against your local mosque.',
    disclaimer: 'Prayer times are calculated by an astronomical method — the Umm al-Qura parameters used across the Kingdom — not taken from an official published table. Minutes can differ from your local mosque, and a printed sheet cannot know about a change made after it was printed. Where the two disagree, the mosque is right.',
    friday: 'Fridays are shaded so the sheet can be read from across a room.',
    localNote: 'Computed on your device from the coordinates of the place you pick. Nothing is sent anywhere, and the sheet keeps working when it is on a wall and you are not.',
  },
  ar: {
    city: 'المكان', month: 'الشهر',
    sunrise: 'أضف الشروق', hour12: 'نظام ١٢ ساعة', hijri: 'عمود هجري',
    download: 'نزّل الشهر', working: 'جارٍ التجهيز…',
    preview: 'معاينة',
    names: { fajr: 'الفجر', sunrise: 'الشروق', dhuhr: 'الظهر', asr: 'العصر', maghrib: 'المغرب', isha: 'العشاء' } as Record<PrayerKey, string>,
    colDate: 'التاريخ', colHijri: 'هجري', colDay: 'اليوم',
    title: (m: string, y: number) => `مواقيت الصلاة · ${m} ${y}`,
    method: 'حُسبت بطريقة أم القرى.',
    note: 'المواقيت للمكان المذكور أعلاه. قابِلها بمسجد حيّك.',
    disclaimer: 'تُحسب المواقيت بطريقة فلكية — معاملات أم القرى المعمول بها في المملكة — لا تُنقل من تقويم رسمي منشور. وقد تختلف الدقائق عن مسجد حيّك، والورقة المطبوعة لا تعلم بتغيير حدث بعد طباعتها. وحين يختلفان فالمسجد هو الصواب.',
    friday: 'أيام الجمعة مظلّلة ليمكن قراءة الورقة من بعيد.',
    localNote: 'تُحسب على جهازك من إحداثيات المكان الذي تختاره. ولا يُرسل شيء إلى أي مكان، وتظل الورقة نافعة وهي على الجدار وأنت لست هناك.',
  },
}

export default function PrayerTimetableTool() {
  const { locale } = useLocale()
  const s = STR[locale]

  const saved = useMemo(() => savedPrayerLocation(), [])
  const [cityId, setCityId] = useState(DEFAULT_CITY.id)
  const now = useMemo(() => new Date(), [])
  const [ym, setYm] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`)
  const [includeSunrise, setIncludeSunrise] = useState(true)
  const [hour12, setHour12] = useState(false)
  const [hijriColumn, setHijriColumn] = useState(true)
  const [busy, setBusy] = useState(false)

  const city = CITIES.find((c) => c.id === cityId) ?? DEFAULT_CITY
  const [year, month] = ym.split('-').map(Number)

  const o: TimetableOptions = useMemo(() => ({
    // A location already chosen in the Prayer Times app is honoured, so the two
    // never disagree about where "here" is.
    lat: cityId === 'saved' && saved ? saved.lat : city.lat,
    lng: cityId === 'saved' && saved ? saved.lng : city.lng,
    tz: cityId === 'saved' && saved ? saved.tz : city.tz,
    place: cityId === 'saved' && saved ? (saved.label ?? 'My location') : (locale === 'ar' ? city.ar : city.en),
    year: year || now.getFullYear(),
    month: (month || now.getMonth() + 1) - 1,
    includeSunrise, hour12, hijriColumn,
  }), [cityId, city, saved, year, month, includeSunrise, hour12, hijriColumn, locale, now])

  const rows = useMemo(() => withHijri(monthRows(o), locale), [o, locale])
  const cols = columnsFor(o)
  const monthName = useMemo(
    () => new Date(o.year, o.month, 1).toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en-GB', { month: 'long' }),
    [o.year, o.month, locale],
  )

  async function download() {
    setBusy(true)
    try {
      const blob = await buildTimetablePdf(rows, o, locale, {
        title: s.title(monthName, o.year),
        day: s.colDay, date: s.colDate, hijri: s.colHijri,
        names: s.names, note: s.note, method: s.method,
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `prayer-times-${ym}.pdf`
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 4000)
    } finally { setBusy(false) }
  }

  return (
    <Stack data-testid="prayer-timetable">
      <Panel>
        <div className="grid gap-3 grid-cols-2 min-[620px]:grid-cols-3">
          <Field label={s.city}>
            <Select value={cityId} data-testid="pt-city" onChange={(e) => setCityId(e.target.value)}>
              {saved && <option value="saved">{saved.label ?? 'My location'}</option>}
              {CITIES.map((c) => <option key={c.id} value={c.id}>{locale === 'ar' ? c.ar : c.en}</option>)}
            </Select>
          </Field>
          <Field label={s.month}>
            <input type="month" value={ym} data-testid="pt-month"
              className="rounded-md border border-[color:var(--line)] bg-[var(--surface)] px-3 py-2 text-[0.95rem] text-ink"
              onChange={(e) => setYm(e.target.value)} />
          </Field>
          <div className="flex items-end">
            <Button variant="primary" onClick={download} disabled={busy} data-testid="pt-download">
              <DownloadIcon /> {busy ? s.working : s.download}
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap gap-4">
          <Check><input type="checkbox" checked={includeSunrise} data-testid="pt-sunrise" onChange={(e) => setIncludeSunrise(e.target.checked)} /> {s.sunrise}</Check>
          <Check><input type="checkbox" checked={hour12} data-testid="pt-hour12" onChange={(e) => setHour12(e.target.checked)} /> {s.hour12}</Check>
          <Check><input type="checkbox" checked={hijriColumn} data-testid="pt-hijri" onChange={(e) => setHijriColumn(e.target.checked)} /> {s.hijri}</Check>
        </div>
      </Panel>

      <section className="flex flex-col gap-2">
        <div className="flex items-center gap-3 flex-wrap">
          <h2 className="font-body text-[0.68rem] uppercase tracking-[0.06em] text-ink-faint">{s.preview}</h2>
          <span className="text-[0.85rem] text-ink" data-testid="pt-heading">{s.title(monthName, o.year)}</span>
          <span className="text-[0.85rem] text-ink-faint" data-testid="pt-place">{o.place}</span>
        </div>
        <div className="overflow-x-auto border border-[color:var(--line)] rounded-md bg-[var(--surface)]">
          <table className="w-full text-[0.82rem] border-collapse" data-testid="pt-table">
            <thead>
              <tr className="text-ink-faint text-[0.7rem] uppercase tracking-[0.05em]">
                <th className="text-start px-2 py-2 font-body">{s.colDate}</th>
                {hijriColumn && <th className="text-start px-2 py-2 font-body">{s.colHijri}</th>}
                {cols.map((k) => <th key={k} className="text-center px-2 py-2 font-body" data-testid={`pt-col-${k}`}>{s.names[k]}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} data-testid={`pt-row-${r.date.getDate()}`}
                  className={`border-t border-[color:var(--line-soft)] ${r.date.getDay() === 5 ? 'bg-[color-mix(in_srgb,var(--color-green-400)_10%,transparent)]' : ''}`}>
                  <td className="px-2 py-1 whitespace-nowrap text-ink">
                    {r.date.getDate()} <span className="text-ink-faint">{r.date.toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en-GB', { weekday: 'short' })}</span>
                  </td>
                  {hijriColumn && <td className="px-2 py-1 whitespace-nowrap text-ink-faint" data-testid={`pt-hijri-${r.date.getDate()}`}>{r.hijri}</td>}
                  {cols.map((k) => (
                    <td key={k} className="px-2 py-1 text-center font-mono text-ink whitespace-nowrap" data-testid={`pt-${k}-${r.date.getDate()}`}>
                      {fmtTime(r.times[k], o.tz, hour12)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[0.82rem] text-ink-faint rtl:font-ar">{s.friday}</p>
      </section>

      <Disclaimer kind="religious" locale={locale}>{s.disclaimer}</Disclaimer>

      <Panel><p className="text-[0.85rem] text-ink-soft rtl:font-ar">{s.localNote}</p></Panel>
    </Stack>
  )
}
