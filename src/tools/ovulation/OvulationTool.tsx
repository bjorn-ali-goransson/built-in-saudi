import { useMemo, useState } from 'react'
import { buildIcsCalendar } from '../../lib/ics'
import { useLocale, localePath } from '../../i18n'
import { Button, Stack, Panel, Field, Input, Check, Disclaimer } from '../../components/ui'
import { formatHijri } from '../prayer-times/islamic'
import { calcOvulation, startOfDay, windowDays, LUTEAL_DAYS, SPERM_DAYS } from './ovulation'

/** Arabic-Indic digits for anything computed that lands in Arabic prose. */
const ar = (n: number) => n.toLocaleString('ar-SA')
const AR14 = ar(LUTEAL_DAYS)
const ARSPERM = ar(SPERM_DAYS)

const STR = {
  en: {
    intro: 'Work out the days that actually matter in a cycle — with every date in both the Gregorian and the Hijri calendar. Nothing is sent anywhere; the dates stay in your browser.',
    lmp: 'First day of your last period',
    cycle: 'Cycle length', days: 'days',
    luteal: 'Luteal phase',
    ics: 'Add to my calendar',
    icsWindow: 'Fertile window', icsOvulation: 'Ovulation expected',
    icsTest: 'A test is reliable from today',
    discreet: 'Use discreet wording', discreetLabel: 'Personal',
    icsNote: 'What will be written:',
    discreetWhy: 'A calendar is often the one thing on a screen that other people see — shared with a partner, mirrored onto a work laptop, open in a meeting. The wording is shown here before anything is downloaded, and can be reduced to a single neutral word.',
    lutealWhy: 'Ovulation to period — the near-constant half. Leave it at 14 unless a doctor has told you otherwise.',
    window: 'Fertile window', ovulation: 'Ovulation', nextPeriod: 'Next period', test: 'A test is reliable from',
    open: 'The window is open now.',
    inDays: (n: number) => (n === 1 ? 'Opens tomorrow.' : n > 0 ? `Opens in ${n} days.` : `Closed ${-n} day${n === -1 ? '' : 's'} ago.`),
    beforeTitle: 'The fertile days come BEFORE ovulation',
    beforeBody: `Sperm survive up to ${SPERM_DAYS} days and an egg about one, so the days that matter are the five before ovulation and the day itself — six in all. Waiting for the ovulation date is the commonest way to miss the window you were aiming at.`,
    day14Title: 'Ovulation is not “day 14”',
    day14Body: (cycle: string, day: string, off: string) =>
      `The ${LUTEAL_DAYS} days from ovulation to the next period are the steady half of a cycle; the first half is what varies. So ovulation falls on cycle day “length minus ${LUTEAL_DAYS}” — on your ${cycle}-day cycle, around day ${day}. A calculator that just adds ${LUTEAL_DAYS} to your last period would have you trying ${off} day${off === '1' ? '' : 's'} ${Number(day) > 14 ? 'early' : 'late'}.`,
    day14Same: `The ${LUTEAL_DAYS} days from ovulation to the next period are the steady half of a cycle. On a 28-day cycle “length minus ${LUTEAL_DAYS}” and “${LUTEAL_DAYS} days in” happen to be the same day, which is why “day 14” is repeated so often — and why it is wrong for every other cycle length.`,
    dueDate: 'If it works out: due date calculator',
    caveat: 'This is a calendar estimate from an average cycle, and cycles vary — illness, stress and travel all move ovulation. It cannot tell you whether you ovulated, only when it would be expected. For anything that matters, a doctor and an ovulation test know more than a calendar does.',
  },
  ar: {
    intro: 'اعرفي الأيام التي تهمّ فعلًا في الدورة — وكل تاريخ بالميلادي والهجري معًا. ولا يُرسل شيء إلى أي مكان؛ تبقى التواريخ في متصفحك.',
    lmp: 'أول يوم في آخر دورة',
    cycle: 'طول الدورة', days: 'يومًا',
    luteal: 'الطور الأصفري',
    ics: 'أضف إلى تقويمي',
    icsWindow: 'أيام الخصوبة', icsOvulation: 'الإباضة المتوقعة',
    icsTest: 'الاختبار موثوق من اليوم',
    discreet: 'صيغة محايدة', discreetLabel: 'خاص',
    icsNote: 'ما سيُكتب:',
    discreetWhy: 'التقويم غالبًا أكثر ما يراه الآخرون على الشاشة — مشتركًا مع شريك، أو معكوسًا على حاسب العمل، أو مفتوحًا في اجتماع. ولهذا يُعرض النص هنا قبل تنزيل أي شيء، ويمكن اختصاره إلى كلمة محايدة واحدة.',
    lutealWhy: 'من الإباضة إلى الدورة — وهو النصف شبه الثابت. اتركيه ١٤ إلا إن أخبرك الطبيب بغير ذلك.',
    window: 'نافذة الخصوبة', ovulation: 'الإباضة', nextPeriod: 'الدورة القادمة', test: 'يصحّ الاختبار من',
    open: 'النافذة مفتوحة الآن.',
    inDays: (n: number) => (n === 1 ? 'تفتح غدًا.' : n > 0 ? `تفتح بعد ${ar(n)} يومًا.` : `أُغلقت قبل ${ar(-n)} يومًا.`),
    beforeTitle: 'أيام الخصوبة قبل الإباضة لا بعدها',
    beforeBody: `تعيش الحيوانات المنوية حتى ${ARSPERM} أيام وتعيش البويضة نحو يوم، فالأيام التي تهمّ هي الخمسة السابقة للإباضة ويومها — ستة في المجموع. وانتظار يوم الإباضة أشيع سبب لتفويت النافذة المقصودة.`,
    day14Title: 'الإباضة ليست «اليوم ١٤»',
    // Every interpolated number goes through `n()`: an Arabic page that prints
    // Western digits in computed prose is the defect this repo already
    // records, and it is invisible to any test that only asserts words.
    day14Body: (cycle: string, day: string, off: string) =>
      `الأيام الـ${AR14} من الإباضة إلى الدورة القادمة هي النصف الثابت من الدورة، والنصف الأول هو المتغيّر. فتقع الإباضة في اليوم «طول الدورة ناقص ${AR14}» — أي قرب اليوم ${day} في دورتك البالغة ${cycle} يومًا. وحاسبة تكتفي بإضافة ${AR14} إلى آخر دورة كانت ستجعلك تحاولين بفارق ${off} يومًا.`,
    day14Same: `الأيام الـ${AR14} من الإباضة إلى الدورة القادمة هي النصف الثابت من الدورة. وعلى دورة من ٢٨ يومًا يتصادف أن «طول الدورة ناقص ${AR14}» و«بعد ${AR14} يومًا» هما اليوم نفسه، ولهذا يتكرر «اليوم ١٤» كثيرًا — ولهذا هو خطأ في كل طول دورة آخر.`,
    dueDate: 'إن تمّ الحمل: حاسبة موعد الولادة',
    caveat: 'هذا تقدير تقويمي من متوسط الدورة، والدورات تتغيّر — فالمرض والتوتر والسفر كلها تحرّك الإباضة. ولا تستطيع هذه الأداة إخبارك بحدوث الإباضة، بل بموعدها المتوقع فقط. وفيما يهمّ، الطبيب واختبار الإباضة أعلم من التقويم.',
  },
}

const iso = (d: Date) => {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export default function OvulationTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const [date, setDate] = useState(() => iso(new Date(Date.now() - 10 * 86400000)))
  const [cycle, setCycle] = useState(28)
  const [luteal, setLuteal] = useState(LUTEAL_DAYS)

  const lmp = useMemo(() => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
    return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null
  }, [date])

  const r = useMemo(() => (lmp ? calcOvulation(lmp, cycle, luteal) : null), [lmp, cycle, luteal])
  const [discreet, setDiscreet] = useState(false)
  const isoLocal = (d: Date) => {
    const p = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
  }
  const label = (text: string) => (discreet ? s.discreetLabel : text)
  function downloadIcs() {
    if (!r) return
    const ics = buildIcsCalendar('ovulation', [
      // A RANGE, and `buildIcsCalendar` makes DTEND exclusive for us — the
      // fertile window is six days and a calendar that showed five would be
      // wrong on the day that matters most.
      { summary: label(s.icsWindow), date: isoLocal(r.fertileFrom), endDate: isoLocal(r.fertileTo), alarmDays: 1 },
      { summary: label(s.icsOvulation), date: isoLocal(r.ovulation) },
      { summary: label(s.icsTest), date: isoLocal(r.testFrom) },
    ])
    const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }))
    const a = document.createElement('a')
    a.href = url
    a.download = 'ovulation.ics'
    a.click()
    URL.revokeObjectURL(url)
  }

  const g = (d: Date) => d.toLocaleDateString(locale === 'ar' ? 'ar-SA-u-ca-gregory' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
  const short = (d: Date) => d.toLocaleDateString(locale === 'ar' ? 'ar-SA-u-ca-gregory' : 'en-GB', { day: 'numeric', month: 'short' })

  // Which day OF THE CYCLE ovulation falls on — the number people compare
  // against the "day 14" they were told.
  const num = (n: number) => (locale === 'ar' ? ar(n) : String(n))
  const cycleDay = r && lmp ? Math.round((startOfDay(r.ovulation).getTime() - startOfDay(lmp).getTime()) / 86400000) + 1 : 0

  return (
    <Stack data-testid="ovulation">
      <p className="text-[0.95rem] text-ink-soft rtl:font-ar">{s.intro}</p>

      <div className="flex flex-wrap items-end gap-4">
        <Field label={s.lmp}>
          <Input type="date" value={date} data-testid="ov-date" onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label={`${s.cycle} — ${cycle} ${s.days}`}>
          <input type="range" min={20} max={45} value={cycle} data-testid="ov-cycle"
            className="w-[12rem] accent-green-600" onChange={(e) => setCycle(Number(e.target.value))} />
        </Field>
        <Field label={`${s.luteal} — ${luteal}`}>
          <input type="range" min={10} max={16} value={luteal} data-testid="ov-luteal"
            className="w-[8rem] accent-green-600" onChange={(e) => setLuteal(Number(e.target.value))} />
        </Field>
      </div>
      <p className="text-[0.8rem] text-ink-faint rtl:font-ar" data-testid="ov-luteal-why">{s.lutealWhy}</p>

      {r && (
        <>
          <Panel className="gap-1">
            <div className="text-[0.7rem] uppercase tracking-[0.05em] text-ink-faint rtl:font-ar">{s.window}</div>
            <div className="font-display text-[1.5rem] text-green-700" data-testid="ov-window">
              {short(r.fertileFrom)} – {g(r.fertileTo)}
            </div>
            <div className="text-[0.9rem] text-ink-soft rtl:font-ar" data-testid="ov-window-hijri">
              {formatHijri(r.fertileFrom, locale)} — {formatHijri(r.fertileTo, locale)}
            </div>
            <div className="text-[0.9rem] text-ink-faint mt-1 rtl:font-ar" data-testid="ov-when">
              {r.inWindow ? s.open : s.inDays(r.daysToFertile)}
            </div>
          </Panel>

          {/* The six days listed out: a range is a number, and a list is
              something you can put in a calendar. */}
          <div className="flex flex-wrap gap-1.5" data-testid="ov-days">
            {windowDays(r).map((d, i, all) => (
              <span key={d.toISOString()}
                className={`rounded-md border px-[0.6rem] py-[0.25rem] text-[0.85rem] ${
                  i === all.length - 1
                    ? 'border-green-700 bg-green-600 text-[color:var(--primary-ink)]'
                    : 'border-[color:var(--line)] bg-[var(--surface)] text-ink-soft'
                }`}>{short(d)}</span>
            ))}
          </div>

          <Panel className="gap-2">
            <div className="flex flex-wrap gap-x-8 gap-y-3">
              <div>
                <div className="text-[0.7rem] uppercase tracking-[0.05em] text-ink-faint rtl:font-ar">{s.ovulation}</div>
                <div className="font-mono text-[1.1rem] text-ink" data-testid="ov-ovulation">{g(r.ovulation)}</div>
              </div>
              <div>
                <div className="text-[0.7rem] uppercase tracking-[0.05em] text-ink-faint rtl:font-ar">{s.nextPeriod}</div>
                <div className="font-mono text-[1.1rem] text-ink" data-testid="ov-next">{g(r.nextPeriod)}</div>
              </div>
              <div>
                <div className="text-[0.7rem] uppercase tracking-[0.05em] text-ink-faint rtl:font-ar">{s.test}</div>
                <div className="font-mono text-[1.1rem] text-ink-soft" data-testid="ov-test">{g(r.testFrom)}</div>
              </div>
            </div>
          </Panel>

          <Panel className="gap-1">
            <div role="heading" aria-level={2} className="font-display text-[1.05rem] text-ink rtl:font-ar">{s.beforeTitle}</div>
            <p className="text-[0.9rem] text-ink-soft rtl:font-ar" data-testid="ov-before">{s.beforeBody}</p>
          </Panel>

          <Panel className="gap-1">
            <div role="heading" aria-level={2} className="font-display text-[1.05rem] text-ink rtl:font-ar">{s.day14Title}</div>
            <p className="text-[0.9rem] text-ink-soft rtl:font-ar" data-testid="ov-day14">
              {cycleDay === 14
                ? s.day14Same
                : s.day14Body(num(cycle), num(cycleDay), num(Math.abs(cycleDay - 14)))}
            </p>
          </Panel>

          <Button className="self-start px-3 py-1" to={localePath(locale, '/apps/due-date')} data-testid="ov-due-date">{s.dueDate}</Button>
        </>
      )}

      {r && (
        <Panel className="gap-2">
          <Check>
            <input type="checkbox" checked={discreet} data-testid="ov-discreet"
              onChange={(e) => setDiscreet(e.target.checked)} />
            {s.discreet}
          </Check>
          <p className="text-[0.85rem] text-ink-faint rtl:font-ar" data-testid="ov-ics-preview">
            {s.icsNote} {label(s.icsWindow)}
          </p>
          <p className="text-[0.8rem] text-ink-faint rtl:font-ar">{s.discreetWhy}</p>
          <Button className="self-start px-3 py-1" onClick={downloadIcs} data-testid="ov-ics">{s.ics}</Button>
        </Panel>
      )}

      <Disclaimer kind="medical" locale={locale}>{s.caveat}</Disclaimer>
    </Stack>
  )
}
