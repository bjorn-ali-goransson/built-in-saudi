import { useEffect, useMemo, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { useLocale } from '../i18n'
import { useDocumentMeta } from '../lib/useDocumentMeta'
import { Button, Input, Textarea, Field, Stack, Panel, Pill } from '../components/ui'
import { GlobeIcon, ClockIcon } from '../components/icons'
import { getAvailability, book, type HostMeta } from '../lib/bookingApi'
import { loadConfig, previewSlots } from '../tools/book-with-me/lib'

const STR = {
  en: {
    loading: 'Loading availability…',
    notFound: 'This booking link doesn’t exist.',
    error: 'Couldn’t load availability. Please try again.',
    withMe: (n: string) => `Book a meeting with ${n}`,
    withHost: 'Book a meeting',
    mins: 'min',
    yourTz: (tz: string) => `Times shown in your timezone (${tz})`,
    none: 'No open times in the coming weeks. Check back soon.',
    pick: 'Pick a time',
    selectDate: 'Select a date & time',
    weekdays: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    name: 'Your name',
    email: 'Your email',
    note: 'Anything to share? (optional)',
    confirm: 'Confirm booking',
    back: 'Back',
    booking: 'Booking…',
    booked: 'You’re booked! 🎉',
    bookedBody: 'A confirmation with a calendar invite is on its way to your email.',
    gone: 'That slot was just taken. Please pick another.',
    at: 'at',
    intro: 'Pick a time that works for you — you’ll get a calendar invite by email.',
    previewBanner: 'Preview — this is exactly what visitors see. Bookings are disabled here.',
    previewDisabled: 'Disabled in preview',
    dismiss: 'Dismiss',
  },
  ar: {
    loading: 'جارٍ تحميل الأوقات…',
    notFound: 'رابط الحجز هذا غير موجود.',
    error: 'تعذّر تحميل الأوقات. حاول مرة أخرى.',
    withMe: (n: string) => `احجز اجتماعًا مع ${n}`,
    withHost: 'احجز اجتماعًا',
    mins: 'دقيقة',
    yourTz: (tz: string) => `الأوقات معروضة بتوقيتك (${tz})`,
    none: 'لا أوقات متاحة في الأسابيع القادمة. عُد قريبًا.',
    pick: 'اختر وقتًا',
    selectDate: 'اختر التاريخ والوقت',
    weekdays: ['أحد', 'إثن', 'ثلا', 'أرب', 'خمي', 'جمع', 'سبت'],
    name: 'اسمك',
    email: 'بريدك الإلكتروني',
    note: 'شيء تودّ مشاركته؟ (اختياري)',
    confirm: 'تأكيد الحجز',
    back: 'رجوع',
    booking: 'جارٍ الحجز…',
    booked: 'تم حجزك! 🎉',
    bookedBody: 'رسالة تأكيد مع دعوة تقويم في طريقها إلى بريدك.',
    gone: 'حُجز هذا الوقت للتو. اختر وقتًا آخر.',
    at: 'الساعة',
    intro: 'اختر وقتًا يناسبك — ستصلك دعوة تقويم عبر البريد.',
    previewBanner: 'معاينة — هذا تمامًا ما يراه الزوار. الحجز معطّل هنا.',
    previewDisabled: 'معطّل في المعاينة',
    dismiss: 'إغلاق',
  },
}

type Status = 'loading' | 'ready' | 'not-found' | 'error'

export function BookingPage() {
  const { code } = useParams()
  const [searchParams] = useSearchParams()
  const preview = searchParams.get('preview') === '1'
  const { locale } = useLocale()
  const s = STR[locale]
  useDocumentMeta(locale, `/book/${code}`)

  const [status, setStatus] = useState<Status>('loading')
  const [host, setHost] = useState<HostMeta | null>(null)
  const [slots, setSlots] = useState<number[]>([])
  const [selected, setSelected] = useState<number | null>(null)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [gone, setGone] = useState(false)
  const [bannerOpen, setBannerOpen] = useState(true)
  const [viewMonth, setViewMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1) })
  const [selectedDay, setSelectedDay] = useState<string | null>(null)

  const localTz = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, [])

  useEffect(() => {
    let cancelled = false
    // Preview: render straight from the host's own saved config (same browser),
    // no backend call — works before publishing/connecting Google.
    if (preview) {
      const cfg = loadConfig()
      setHost({ name: null, tz: cfg.tz, minutes: cfg.meeting.minutes, title: cfg.meeting.title, location: cfg.meeting.location })
      setSlots(previewSlots(cfg))
      setStatus('ready')
      return
    }
    if (!code) return
    setStatus('loading')
    getAvailability(code)
      .then((r) => {
        if (cancelled) return
        setHost(r.host)
        setSlots(r.slots)
        setStatus('ready')
      })
      .catch((e) => {
        if (cancelled) return
        setStatus(e.message === 'not-found' ? 'not-found' : 'error')
      })
    return () => {
      cancelled = true
    }
  }, [code, preview])

  const dayFmt = useMemo(
    () => new Intl.DateTimeFormat(locale === 'ar' ? 'ar-SA' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long' }),
    [locale],
  )
  const timeFmt = useMemo(
    () => new Intl.DateTimeFormat(locale === 'ar' ? 'ar-SA' : 'en-GB', { hour: '2-digit', minute: '2-digit' }),
    [locale],
  )

  // Group slots by the booker's local calendar day.
  const grouped = useMemo(() => {
    const byDay = new Map<string, number[]>()
    for (const ms of slots) {
      const key = new Date(ms).toDateString()
      if (!byDay.has(key)) byDay.set(key, [])
      byDay.get(key)!.push(ms)
    }
    return [...byDay.entries()]
  }, [slots])

  const byDay = useMemo(() => new Map(grouped), [grouped])
  const availableDays = useMemo(() => new Set(grouped.map(([k]) => k)), [grouped])
  const monthFmt = useMemo(() => new Intl.DateTimeFormat(locale === 'ar' ? 'ar-SA' : 'en-GB', { month: 'long', year: 'numeric' }), [locale])

  // Default to the first available day once slots arrive.
  useEffect(() => {
    if (!slots.length) return
    const first = new Date(slots[0])
    setSelectedDay(first.toDateString())
    setViewMonth(new Date(first.getFullYear(), first.getMonth(), 1))
  }, [slots])

  async function submit() {
    if (!code || selected == null || !name.trim() || !email.trim()) return
    setSubmitting(true)
    setGone(false)
    try {
      const r = await book({ code, startUtc: selected, name: name.trim(), email: email.trim(), note: note.trim() })
      if (r.conflict) {
        // Slot taken — drop it and bounce back to the list.
        setSlots((prev) => prev.filter((x) => x !== selected))
        setSelected(null)
        setGone(true)
      } else if (r.ok) {
        setDone(true)
      }
    } catch {
      setGone(false)
      setStatus('error')
    } finally {
      setSubmitting(false)
    }
  }

  // Month grid for the calendar.
  const vy = viewMonth.getFullYear()
  const vm = viewMonth.getMonth()
  const firstWd = new Date(vy, vm, 1).getDay()
  const daysInMonth = new Date(vy, vm + 1, 0).getDate()
  const monthCells = [...Array.from({ length: firstWd }, () => 0), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)]
  const thisMonth = new Date(); thisMonth.setDate(1); thisMonth.setHours(0, 0, 0, 0)
  const canPrev = new Date(vy, vm, 1).getTime() > thisMonth.getTime()
  const selTimes = selectedDay ? byDay.get(selectedDay) ?? [] : []

  return (
    <div className="wrap py-[clamp(1.5rem,4vw,2.5rem)] max-w-[56rem] animate-[fadeUp_0.5s_ease_both]">
      {status === 'loading' && <p className="text-ink-faint">{s.loading}</p>}
      {status === 'not-found' && <Panel><p className="text-ink-soft">{s.notFound}</p></Panel>}
      {status === 'error' && <Panel><p className="text-ink-soft">{s.error}</p></Panel>}

      {status === 'ready' && host && (
        <Stack>
          {preview && bannerOpen && (
            <div className="flex items-center gap-2 border-s-2 border-gold-400 bg-[color-mix(in_srgb,var(--color-gold-400)_12%,transparent)] ps-3 pe-2 py-2 text-[0.85rem] text-ink-soft" role="status" data-testid="preview-banner">
              <span className="flex-1">{s.previewBanner}</span>
              <button type="button" aria-label={s.dismiss} onClick={() => setBannerOpen(false)} data-testid="dismiss-banner"
                className="flex-none grid place-items-center size-6 rounded-md text-ink-faint hover:bg-[color-mix(in_srgb,var(--ink)_8%,transparent)] border-0 bg-transparent cursor-pointer">✕</button>
            </div>
          )}

          <div className="grid gap-6 md:grid-cols-[minmax(0,14rem)_1fr] md:divide-x rtl:md:divide-x-reverse divide-[color:var(--line-soft)]">
            {/* Calendly-style aside: avatar + who + what */}
            <aside className="flex flex-col gap-3 md:pe-6">
              <span className="grid place-items-center size-12 rounded-full bg-green-600 text-sand-100 font-display text-[1.3rem] font-bold" aria-hidden="true">
                {(host.name || 'B').trim().charAt(0).toUpperCase()}
              </span>
              {host.name && <span className="text-[0.9rem] font-semibold text-ink-soft">{host.name}</span>}
              <h1 className="font-display text-[1.4rem] leading-tight text-ink">{host.title}</h1>
              <span className="inline-flex items-center gap-1.5 text-[0.9rem] text-ink-soft"><ClockIcon className="w-4 h-4" /> {host.minutes} {s.mins}</span>
              {host.location && <span className="text-[0.85rem] text-ink-faint">{host.location}</span>}
            </aside>

            <div className="min-w-0 md:ps-6">
              {done ? (
                <Panel data-testid="booking-done">
                  <h2 className="font-display text-[1.4rem] text-green-700">{s.booked}</h2>
                  <p className="text-ink-soft">{s.bookedBody}</p>
                  <p className="text-ink-faint text-[0.9rem]">
                    {selected != null && `${dayFmt.format(new Date(selected))} ${s.at} ${timeFmt.format(new Date(selected))}`}
                  </p>
                </Panel>
              ) : selected == null ? (
                <div className="flex flex-col gap-4">
                  <h2 className="font-display text-[1.2rem] text-ink">{s.selectDate}</h2>
                  {gone && <p className="text-[0.9rem] text-gold-500" role="status">{s.gone}</p>}
                  {grouped.length === 0 ? (
                    <Panel><p className="text-ink-soft">{s.none}</p></Panel>
                  ) : (
                    <div className="grid gap-6 sm:grid-cols-[minmax(0,17rem)_minmax(0,1fr)]">
                      {/* Month calendar */}
                      <div className="flex flex-col gap-3">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-ink">{monthFmt.format(viewMonth)}</span>
                          <div className="flex gap-1 [&_button]:size-8 [&_button]:grid [&_button]:place-items-center [&_button]:rounded-full [&_button]:border-0 [&_button]:bg-transparent [&_button]:text-ink-soft [&_button]:cursor-pointer [&_button:hover]:bg-[color-mix(in_srgb,var(--ink)_6%,transparent)] [&_button:disabled]:opacity-30 [&_button:disabled]:cursor-default">
                            <button type="button" aria-label="prev month" disabled={!canPrev} onClick={() => setViewMonth(new Date(vy, vm - 1, 1))}>‹</button>
                            <button type="button" aria-label="next month" onClick={() => setViewMonth(new Date(vy, vm + 1, 1))}>›</button>
                          </div>
                        </div>
                        <div className="grid grid-cols-7 gap-y-1 text-center">
                          {s.weekdays.map((d, i) => <span key={i} className="text-[0.68rem] font-semibold text-ink-faint pb-1">{d}</span>)}
                          {monthCells.map((day, i) => {
                            if (!day) return <span key={i} />
                            const key = new Date(vy, vm, day).toDateString()
                            const avail = availableDays.has(key)
                            const isSel = selectedDay === key
                            return (
                              <div key={i} className="grid place-items-center py-0.5">
                                <button type="button" disabled={!avail} data-testid={avail ? 'cal-day' : undefined} onClick={() => setSelectedDay(key)}
                                  className={`size-9 grid place-items-center rounded-full text-[0.85rem] transition-colors ${
                                    isSel ? 'bg-green-600 text-sand-100 font-bold'
                                      : avail ? 'bg-[color-mix(in_srgb,var(--green-400)_16%,transparent)] text-green-700 font-semibold cursor-pointer hover:bg-[color-mix(in_srgb,var(--green-400)_28%,transparent)]'
                                        : 'text-ink-faint/45 cursor-default'
                                  }`}>
                                  {day}
                                </button>
                              </div>
                            )
                          })}
                        </div>
                        <Pill className="self-start !cursor-default" title={s.yourTz(localTz)}><GlobeIcon /> {localTz}</Pill>
                      </div>

                      {/* Times for the selected day */}
                      <div className="flex flex-col gap-2 min-w-0">
                        {selectedDay && <span className="text-[0.92rem] font-semibold text-ink">{dayFmt.format(new Date(selectedDay))}</span>}
                        <div className="flex flex-col gap-2 md:max-h-[26rem] md:overflow-y-auto md:pe-1">
                          {selTimes.length === 0
                            ? <p className="text-ink-faint text-[0.9rem]">{s.none}</p>
                            : selTimes.map((ms) => (
                              <button key={ms} data-testid="slot" onClick={() => { setSelected(ms); setGone(false) }}
                                className="w-full text-center font-semibold text-[0.95rem] px-4 py-3 rounded-md border border-[color:var(--line)] bg-[var(--surface)] text-green-700 hover:border-green-600 hover:bg-[color-mix(in_srgb,var(--green-400)_6%,transparent)] transition-colors">
                                {timeFmt.format(new Date(ms))}
                              </button>
                            ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <Panel>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-ink">
                      {dayFmt.format(new Date(selected))} · {timeFmt.format(new Date(selected))}
                    </span>
                    <Button onClick={() => setSelected(null)}>{s.back}</Button>
                  </div>
                  <Field label={s.name}>
                    <Input value={name} data-testid="booker-name" onChange={(e) => setName(e.target.value)} autoFocus />
                  </Field>
                  <Field label={s.email}>
                    <Input type="email" value={email} data-testid="booker-email" onChange={(e) => setEmail(e.target.value)} />
                  </Field>
                  <Field label={s.note}>
                    <Textarea value={note} onChange={(e) => setNote(e.target.value)} />
                  </Field>
                  <Button
                    variant="primary"
                    data-testid="confirm-booking"
                    disabled={preview || submitting || !name.trim() || !email.trim()}
                    onClick={submit}
                  >
                    {preview ? s.previewDisabled : submitting ? s.booking : s.confirm}
                  </Button>
                </Panel>
              )}
            </div>
          </div>
        </Stack>
      )}
    </div>
  )
}
