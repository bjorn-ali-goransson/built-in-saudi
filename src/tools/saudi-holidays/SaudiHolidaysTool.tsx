import { useMemo, useState } from 'react'
import { useLocale, localePath } from '../../i18n'
import { Button, Stack, Panel, Seg, SegButton, Disclaimer } from '../../components/ui'
import { formatHijri, gregorianToHijri } from '../prayer-times/islamic'
import {
  holidaysIn, nextHoliday, totalDays, daysBetween, ramadanLength, startOfDay,
  type Holiday, type HolidayKey,
} from './holidays'

const NAMES: Record<'en' | 'ar', Record<HolidayKey, string>> = {
  en: {
    foundingDay: 'Founding Day',
    eidFitr: 'Eid al-Fitr holiday',
    eidAdha: 'Eid al-Adha holiday',
    nationalDay: 'National Day',
  },
  ar: {
    foundingDay: 'يوم التأسيس',
    eidFitr: 'إجازة عيد الفطر',
    eidAdha: 'إجازة عيد الأضحى',
    nationalDay: 'اليوم الوطني',
  },
}

const STR = {
  en: {
    intro: 'The paid public holidays every worker is entitled to under Article 112, worked out for any year — with the two that move and the two that do not. Nothing is sent anywhere.',
    next: 'Next holiday', today: 'It is today.', tomorrow: 'Tomorrow.',
    inDays: (v: string) => `In ${v} days.`, running: (v: string, one: boolean) => `Running now — ${v} more day${one ? '' : 's'}.`,
    days: (v: string, one: boolean) => `${v} day${one ? '' : 's'}`,
    total: (v: string) => `${v} days of official holiday this year`,
    fixed: 'Fixed date', moves: 'Moves each year',
    weekendTitle: 'Landing on the weekend is compensated — with one exception',
    weekendBody: 'A holiday that falls on the weekly rest day is made up by the day before or after. The exception is National Day falling inside an Eid holiday: it is not compensated, because you already have the day.',
    weekendFlag: 'Falls on the weekend — compensated by the adjacent day.',
    swallowedFlag: 'Falls inside the Eid holiday — NOT compensated.',
    beforeTitle: 'The Eid al-Fitr holiday can start before Eid',
    beforeBody: (len: number) =>
      len === 30
        ? 'The rule anchors the holiday to the day after 29 Ramadan. Ramadan runs 30 days this year, so the first day off is 30 Ramadan — still a fasting day — and Eid itself is the second day of the holiday. Nearly every published list assumes otherwise.'
        : 'The rule anchors the holiday to the day after 29 Ramadan. Ramadan runs 29 days this year, so the holiday and Eid begin on the same day. In a 30-day Ramadan they do not, and the first day off is the last fasting day.',
    sightTitle: 'The entitlement is calendar-based; Eid is sighting-based',
    sightBody: 'Article 112 names the Umm al-Qura calendar, and that is what these dates are. The festival itself is announced on the moon sighting, so the actual Eid can land a day either side of the calculated date. A countdown that does not say so is claiming a certainty nobody has.',
    leaveTitle: 'A holiday inside your annual leave does not consume it',
    leaveBody: 'If a public holiday falls during annual leave, the leave is extended by that many days. It is the same days off either way, so the question is only whether they come out of your balance — and they do not.',
    sectorTitle: 'This is the private-sector minimum',
    sectorBody: 'Article 112 sets the floor a contract cannot go below. The public sector is usually given longer Eid breaks by a separate announcement, and an employer may always give more.',
    caveat: 'These are the statutory holidays computed from the Umm al-Qura calendar. The exact dates of each Eid break are announced by the authorities each year and can differ by a day from the calculated date; a longer break may be granted. Check with the Ministry of Human Resources and Social Development, and with your employer, before making travel plans on this.',
    workingDays: 'Counting working days around them: Working Days calculator',
    calendar: 'The full Hijri calendar: Islamic Calendar',
    year: 'Year',
  },
  ar: {
    intro: 'الإجازات الرسمية المدفوعة التي يستحقها كل عامل بموجب المادة ١١٢، محسوبةً لأي سنة — مع ما يتحرك منها وما لا يتحرك. ولا يُرسل شيء إلى أي مكان.',
    next: 'الإجازة القادمة', today: 'هي اليوم.', tomorrow: 'غدًا.',
    inDays: (v: string) => `بعد ${v} يومًا.`, running: (v: string, one: boolean) => `جارية الآن — بقي ${v} ${one ? 'يوم' : 'أيام'}.`,
    days: (v: string, one: boolean) => `${v} ${one ? 'يوم' : 'أيام'}`,
    total: (v: string) => `${v} يومًا من الإجازات الرسمية هذه السنة`,
    fixed: 'تاريخ ثابت', moves: 'يتغيّر كل سنة',
    weekendTitle: 'الوقوع في نهاية الأسبوع يُعوَّض — إلا في حالة واحدة',
    weekendBody: 'الإجازة التي تقع في يوم الراحة الأسبوعية تُعوَّض باليوم السابق أو التالي. والاستثناء أن يقع اليوم الوطني داخل إجازة عيد: فلا يُعوَّض، لأن اليوم عندك أصلًا.',
    weekendFlag: 'تقع في نهاية الأسبوع — تُعوَّض باليوم المجاور.',
    swallowedFlag: 'تقع داخل إجازة العيد — ولا تُعوَّض.',
    beforeTitle: 'إجازة عيد الفطر قد تبدأ قبل العيد',
    beforeBody: (len: number) =>
      len === 30
        ? 'تربط القاعدة الإجازة باليوم التالي لـ٢٩ رمضان. ورمضان هذه السنة ثلاثون يومًا، فأول أيام الإجازة هو ٣٠ رمضان — وهو يوم صيام — ويكون العيد ثاني أيامها. وأكثر القوائم المنشورة تفترض غير ذلك.'
        : 'تربط القاعدة الإجازة باليوم التالي لـ٢٩ رمضان. ورمضان هذه السنة تسعة وعشرون يومًا، فتبدأ الإجازة والعيد في اليوم نفسه. أما في رمضان الثلاثيني فلا، ويكون أول أيام الإجازة آخر أيام الصيام.',
    sightTitle: 'الاستحقاق بالتقويم، والعيد بالرؤية',
    sightBody: 'تنص المادة ١١٢ على تقويم أم القرى، وهذه التواريخ منه. أما العيد نفسه فيُعلن بالرؤية، فقد يقع قبل التاريخ المحسوب بيوم أو بعده. وعدّاد لا يقول ذلك يدّعي يقينًا لا يملكه أحد.',
    leaveTitle: 'الإجازة الرسمية داخل إجازتك السنوية لا تُحسب منها',
    leaveBody: 'إذا وقعت إجازة رسمية أثناء الإجازة السنوية مُدّت السنوية بعدد أيامها. فالأيام هي الأيام في الحالين، والسؤال فقط أتُخصم من رصيدك أم لا — ولا تُخصم.',
    sectorTitle: 'هذا هو الحد الأدنى للقطاع الخاص',
    sectorBody: 'تضع المادة ١١٢ الحد الذي لا ينزل العقد دونه. والقطاع الحكومي تُمنح له عادةً إجازات عيد أطول بإعلان منفصل، وللمنشأة أن تزيد دائمًا.',
    caveat: 'هذه الإجازات النظامية محسوبة من تقويم أم القرى. وتواريخ إجازتَي العيد تُعلنها الجهات المختصة كل سنة وقد تختلف بيوم عن التاريخ المحسوب، وقد تُمنح إجازة أطول. راجع وزارة الموارد البشرية والتنمية الاجتماعية وجهة عملك قبل حجز سفر بناءً على هذا.',
    workingDays: 'لحساب أيام العمل حولها: حاسبة أيام العمل',
    calendar: 'التقويم الهجري كاملًا: التقويم الهجري',
    year: 'السنة',
  },
}

export default function SaudiHolidaysTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const names = NAMES[locale]
  const today = useMemo(() => startOfDay(new Date()), [])
  const [year, setYear] = useState(today.getFullYear())

  const list = useMemo(() => holidaysIn(year), [year])
  const next = useMemo(() => nextHoliday(today), [today])

  const n = (v: number) => v.toLocaleString(locale === 'ar' ? 'ar-SA' : 'en-US')
  const g = (d: Date) => d.toLocaleDateString(locale === 'ar' ? 'ar-SA-u-ca-gregory' : 'en-GB',
    { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  // Ramadan's length decides whether the Eid al-Fitr holiday opens on a fasting
  // day, so the panel is written for the year on screen rather than in general.
  const fitr = list.find((h) => h.key === 'eidFitr')
  const ramLen = fitr ? ramadanLength(gregorianToHijri(fitr.start).y) : 29

  const away = next ? daysBetween(today, next.start) : 0
  const left = next ? next.days - daysBetween(next.start, today) : 0

  const span = (h: Holiday) => {
    const end = new Date(h.start.getFullYear(), h.start.getMonth(), h.start.getDate() + h.days - 1)
    return h.days === 1 ? g(h.start) : `${g(h.start)} — ${g(end)}`
  }

  return (
    <Stack data-testid="saudi-holidays">
      <p className="text-[0.95rem] text-ink-soft rtl:font-ar">{s.intro}</p>

      {next && (
        <Panel className="gap-1">
          <div className="text-[0.7rem] uppercase tracking-[0.05em] text-ink-faint rtl:font-ar">{s.next}</div>
          <div className="font-display text-[1.6rem] text-green-700 rtl:font-ar" data-testid="sh-next">{names[next.key]}</div>
          <div className="text-[0.95rem] text-ink" data-testid="sh-next-when">
            {away > 1 ? s.inDays(n(away)) : away === 1 ? s.tomorrow : left > 1 ? s.running(n(left), left === 1) : s.today}
          </div>
          <div className="text-[0.9rem] text-ink-soft">{span(next)}</div>
          <div className="text-[0.88rem] text-ink-faint rtl:font-ar">{formatHijri(next.start, locale)}</div>
        </Panel>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Seg>
          {[year - 1, year, year + 1].map((y) => (
            <SegButton key={y} active={y === year} data-testid={`sh-year-${y}`} onClick={() => setYear(y)}>{n(y)}</SegButton>
          ))}
        </Seg>
        <span className="text-[0.88rem] text-ink-faint rtl:font-ar" data-testid="sh-total">{s.total(n(totalDays(list)))}</span>
      </div>

      <div className="flex flex-col gap-2" data-testid="sh-list">
        {list.map((h) => (
          <Panel key={`${h.key}-${h.start.toDateString()}`} className="gap-1" data-testid={`sh-${h.key}`}>
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="font-display text-[1.15rem] text-ink rtl:font-ar">{names[h.key]}</span>
              <span className="font-mono text-[0.82rem] text-green-700">{s.days(n(h.days), h.days === 1)}</span>
              <span className="text-[0.72rem] uppercase tracking-[0.05em] text-ink-faint rtl:font-ar">
                {h.fixed ? s.fixed : s.moves}
              </span>
            </div>
            <div className="text-[0.92rem] text-ink-soft">{span(h)}</div>
            <div className="text-[0.86rem] text-ink-faint rtl:font-ar">{formatHijri(h.start, locale)}</div>
            {h.swallowed && (
              <div className="text-[0.86rem] text-gold-500 rtl:font-ar" data-testid={`sh-swallowed-${h.key}`}>{s.swallowedFlag}</div>
            )}
            {h.onWeekend && !h.swallowed && (
              <div className="text-[0.86rem] text-gold-500 rtl:font-ar" data-testid={`sh-weekend-${h.key}`}>{s.weekendFlag}</div>
            )}
          </Panel>
        ))}
      </div>

      {/* The four things the published lists get wrong, in the order they bite. */}
      <Panel className="gap-1">
        <div role="heading" aria-level={2} className="font-display text-[1.05rem] text-ink rtl:font-ar">{s.beforeTitle}</div>
        <p className="text-[0.9rem] text-ink-soft rtl:font-ar" data-testid="sh-before">{s.beforeBody(ramLen)}</p>
      </Panel>

      <Panel className="gap-1">
        <div role="heading" aria-level={2} className="font-display text-[1.05rem] text-ink rtl:font-ar">{s.sightTitle}</div>
        <p className="text-[0.9rem] text-ink-soft rtl:font-ar" data-testid="sh-sighting">{s.sightBody}</p>
      </Panel>

      <Panel className="gap-1">
        <div role="heading" aria-level={2} className="font-display text-[1.05rem] text-ink rtl:font-ar">{s.weekendTitle}</div>
        <p className="text-[0.9rem] text-ink-soft rtl:font-ar" data-testid="sh-weekend-rule">{s.weekendBody}</p>
      </Panel>

      <Panel className="gap-1">
        <div role="heading" aria-level={2} className="font-display text-[1.05rem] text-ink rtl:font-ar">{s.leaveTitle}</div>
        <p className="text-[0.9rem] text-ink-soft rtl:font-ar" data-testid="sh-leave">{s.leaveBody}</p>
      </Panel>

      <Panel className="gap-1">
        <div role="heading" aria-level={2} className="font-display text-[1.05rem] text-ink rtl:font-ar">{s.sectorTitle}</div>
        <p className="text-[0.9rem] text-ink-soft rtl:font-ar" data-testid="sh-sector">{s.sectorBody}</p>
      </Panel>

      <div className="flex flex-wrap gap-2">
        <Button className="px-3 py-1" to={localePath(locale, '/apps/working-days')} data-testid="sh-working-days">{s.workingDays}</Button>
        <Button className="px-3 py-1" to={localePath(locale, '/apps/islamic-calendar')} data-testid="sh-calendar">{s.calendar}</Button>
      </div>

      <Disclaimer kind="official" locale={locale}>{s.caveat}</Disclaimer>
    </Stack>
  )
}
