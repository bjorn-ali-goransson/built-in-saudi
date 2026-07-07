import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { useLocale } from '../i18n'
import { useDocumentMeta } from '../lib/useDocumentMeta'
import { Button, Input, Textarea, Field, Stack, Panel, Pill, Sheet, SheetTitle, SheetActions, Spinner } from '../components/ui'
import { GlobeIcon, ClockIcon, EditIcon } from '../components/icons'
import { getAvailability, book, readHostSession, type HostMeta } from '../lib/bookingApi'
import { bookingHeaderStore } from '../lib/bookingHeader'
import { loadConfig, saveConfig, previewSlots, detectFirstDay } from '../tools/book-with-me/lib'

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
    booked: 'You’re booked!',
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
    booked: 'تم حجزك!',
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
  const navigate = useNavigate()

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
  const [viewMonth, setViewMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1) })
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [typeId, setTypeId] = useState<string | null>(null)
  const [alertOpen, setAlertOpen] = useState(false)
  const [heading, setHeading] = useState('')
  const [text, setText] = useState('')
  const headingRef = useRef('')
  const textRef = useRef('')
  useEffect(() => { headingRef.current = heading; textRef.current = text }, [heading, text])
  const localTz = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, [])
  const [tz, setTz] = useState(localTz) // the booker's display timezone
  const [firstDay, setFirstDay] = useState(() => detectFirstDay())
  const [cal, setCal] = useState<'greg' | 'hijri'>('greg')
  const [tzOpen, setTzOpen] = useState(false)
  const [tzq, setTzq] = useState('')
  const allTz = useMemo<string[]>(() => {
    try { return (Intl as unknown as { supportedValuesOf(k: string): string[] }).supportedValuesOf('timeZone') } catch { return [localTz] }
  }, [localTz])
  const pageTitle = host?.name ? (locale === 'ar' ? `احجز اجتماعًا مع ${host.name}` : `Book a meeting with ${host.name}`) : (heading || s.withHost)
  useDocumentMeta(locale, `/book/${code}`, pageTitle)

  useEffect(() => {
    let cancelled = false
    // Preview: render straight from the host's own saved config (same browser),
    // no backend call — works before publishing/connecting Google.
    if (preview) {
      const cfg = loadConfig()
      const sess = readHostSession()
      const first = cfg.meetingTypes[0]
      setHost({
        name: sess?.name || null,
        tz: cfg.tz,
        minutes: first?.minutes ?? cfg.meeting.minutes,
        title: first?.name ?? cfg.meeting.title,
        location: cfg.meeting.location,
        picture: sess?.picture || null,
        meetingTypes: cfg.meetingTypes,
      })
      setHeading(cfg.pageHeading || (sess?.name ? (locale === 'ar' ? `احجز اجتماعًا مع ${sess.name}` : `Book a meeting with ${sess.name}`) : s.withHost))
      setText(cfg.pageText || '')
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
        setHeading(r.host.pageHeading || (r.host.name ? `Book a meeting with ${r.host.name}` : s.withHost))
        setText(r.host.pageText || s.intro)
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

  const lc = locale === 'ar' ? 'ar-SA' : 'en-GB'
  const calOpt = cal === 'hijri' ? ({ calendar: 'islamic-umalqura' } as const) : {}
  const dayFmt = useMemo(
    () => new Intl.DateTimeFormat(lc, { weekday: 'long', day: 'numeric', month: 'long', timeZone: tz, ...calOpt }),
    [lc, tz, cal], // eslint-disable-line react-hooks/exhaustive-deps
  )
  const timeFmt = useMemo(
    () => new Intl.DateTimeFormat(lc, { hour: '2-digit', minute: '2-digit', timeZone: tz }),
    [lc, tz],
  )
  const monthFmt = useMemo(() => new Intl.DateTimeFormat(lc, { month: 'long', year: 'numeric', timeZone: tz, ...calOpt }), [lc, tz, cal]) // eslint-disable-line react-hooks/exhaustive-deps
  const dayNumFmt = useMemo(() => new Intl.DateTimeFormat(lc, { day: 'numeric', timeZone: tz, ...calOpt }), [lc, tz, cal]) // eslint-disable-line react-hooks/exhaustive-deps
  // Stable 'YYYY-MM-DD' key for the booker's chosen timezone (so slots group into
  // the right calendar day even when they view another zone).
  const dayKeyFmt = useMemo(() => new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }), [tz])

  const grouped = useMemo(() => {
    const byDay = new Map<string, number[]>()
    for (const ms of slots) {
      const key = dayKeyFmt.format(new Date(ms))
      if (!byDay.has(key)) byDay.set(key, [])
      byDay.get(key)!.push(ms)
    }
    return [...byDay.entries()]
  }, [slots, dayKeyFmt])

  const byDay = useMemo(() => new Map(grouped), [grouped])
  const availableDays = useMemo(() => new Set(grouped.map(([k]) => k)), [grouped])

  // Default to the first available day once slots arrive.
  useEffect(() => {
    if (!slots.length) return
    const first = new Date(slots[0])
    setSelectedDay(dayKeyFmt.format(first))
    setViewMonth(new Date(first.getFullYear(), first.getMonth(), 1))
  }, [slots, dayKeyFmt])

  // Meeting types (all of them in preview; one on the live page for now).
  const types = useMemo(() => {
    if (host?.meetingTypes?.length) return host.meetingTypes
    if (host) return [{ id: 'default', name: host.title, minutes: host.minutes, meet: false }]
    return []
  }, [host])
  const selType = types.find((t) => t.id === typeId) ?? types[0] ?? null

  useEffect(() => { if (types.length && !typeId) setTypeId(types[0].id) }, [types, typeId])

  // Navbar title "Book a meeting with <name>" + robots noindex (never index a booking page).
  const withName = (n: string) => (locale === 'ar' ? `احجز اجتماعًا مع ${n}` : `Book a meeting with ${n}`)
  useEffect(() => {
    bookingHeaderStore.set(host?.name ? withName(host.name) : '')
    return () => bookingHeaderStore.set('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [host, locale])
  useEffect(() => {
    const m = document.createElement('meta')
    m.name = 'robots'
    m.content = 'noindex, nofollow'
    document.head.appendChild(m)
    return () => { m.remove() }
  }, [])

  async function submit() {
    if (!code || selected == null || !name.trim() || !email.trim()) return
    setSubmitting(true)
    setGone(false)
    try {
      const r = await book({ code, startUtc: selected, name: name.trim(), email: email.trim(), note: note.trim(), typeId: selType?.id })
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

  // Persist edits to the intro heading/text (preview = same browser as host).
  function saveIntro(h: string, t: string) {
    try { const cfg = loadConfig(); saveConfig({ ...cfg, pageHeading: h, pageText: t }) } catch { /* ignore */ }
  }

  const L = locale === 'ar'
    ? { edit: 'تعديل', alertTitle: 'التنبيه الذي سيصلك', subject: 'الموضوع', someone: 'أحدهم', headPh: 'العنوان', textPh: 'نص تعريفي', greg: 'ميلادي', hijri: 'هجري', tzTitle: 'المنطقة الزمنية والتقويم', firstD: 'أول أيام الأسبوع', search: 'ابحث عن منطقة…' }
    : { edit: 'Edit', alertTitle: 'The alert you’ll receive', subject: 'Subject', someone: 'Someone', headPh: 'Heading', textPh: 'Intro text', greg: 'Gregorian', hijri: 'Hijri', tzTitle: 'Timezone & calendar', firstD: 'First day of week', search: 'Search timezones…' }
  const dayNames = useMemo(() => Array.from({ length: 7 }, (_, d) => new Intl.DateTimeFormat(lc, { weekday: 'long' }).format(new Date(2023, 0, 1 + d))), [lc])
  const tzShort = tz.split('/').pop()?.replace(/_/g, ' ') ?? tz
  const tzOffset = (z: string) => { try { return new Intl.DateTimeFormat('en-US', { timeZone: z, timeZoneName: 'shortOffset' }).formatToParts(new Date()).find((p) => p.type === 'timeZoneName')?.value ?? '' } catch { return '' } }
  const tzList = useMemo(() => { const q = tzq.trim().toLowerCase(); return q ? allTz.filter((z) => z.toLowerCase().includes(q)).slice(0, 60) : allTz.slice(0, 60) }, [allTz, tzq])

  // Month grid for the calendar (Gregorian layout; labels honour tz/first-day/calendar).
  const vy = viewMonth.getFullYear()
  const vm = viewMonth.getMonth()
  const firstWd = (new Date(vy, vm, 1).getDay() - firstDay + 7) % 7
  const daysInMonth = new Date(vy, vm + 1, 0).getDate()
  const monthCells = [...Array.from({ length: firstWd }, () => 0), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)]
  const weekdays = [...s.weekdays.slice(firstDay), ...s.weekdays.slice(0, firstDay)]
  const pad = (n: number) => String(n).padStart(2, '0')
  const cellKey = (day: number) => `${vy}-${pad(vm + 1)}-${pad(day)}`
  const thisMonth = new Date(); thisMonth.setDate(1); thisMonth.setHours(0, 0, 0, 0)
  const canPrev = new Date(vy, vm, 1).getTime() > thisMonth.getTime()
  const selTimes = selectedDay ? byDay.get(selectedDay) ?? [] : []
  const selDayLabel = selTimes.length ? dayFmt.format(new Date(selTimes[0])) : ''

  return (
    <div className="wrap py-[clamp(1.5rem,4vw,2.5rem)] max-w-[56rem] animate-[fadeUp_0.5s_ease_both]">
      {status === 'loading' && (
        <div className="flex flex-col items-center justify-center gap-4 py-24 text-ink-faint" role="status" aria-live="polite">
          <Spinner className="size-9" label={s.loading} />
          <span className="text-[0.9rem]">{s.loading}</span>
        </div>
      )}
      {status === 'not-found' && <Panel><p className="text-ink-soft">{s.notFound}</p></Panel>}
      {status === 'error' && <Panel><p className="text-ink-soft">{s.error}</p></Panel>}

      {status === 'ready' && host && (
        <Stack className={preview ? 'pb-16' : ''}>
          {/* Editable intro box — replaces the (hidden) navbar */}
          <div className="mx-[calc(50%-50vw)] w-screen max-w-[100vw] mt-[calc(clamp(1.5rem,4vw,2.5rem)*-1)] bg-green-600 text-sand-100">
            <div className="wrap py-[clamp(1.3rem,4vw,1.9rem)] max-w-[52rem] flex items-center gap-4">
              {host.picture
                ? <img src={host.picture} alt="" referrerPolicy="no-referrer" className="size-14 rounded-full object-cover flex-none border-2 border-[color-mix(in_srgb,var(--sand-100)_40%,transparent)]" />
                : <span className="grid place-items-center size-14 rounded-full bg-[color-mix(in_srgb,var(--sand-100)_18%,transparent)] font-display text-[1.5rem] font-bold flex-none" style={{ color: 'var(--sand-100)' }}>{(host.name || 'B').trim().charAt(0).toUpperCase()}</span>}
              <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                {host.name && <span className="text-[0.82rem] font-semibold opacity-90">{host.name}</span>}
                {preview
                  ? <span className="inline-flex items-baseline gap-1.5 font-display rtl:font-ar text-[clamp(1.3rem,4vw,1.8rem)] font-bold leading-tight text-sand-100">
                      <Editable initial={heading} placeholder={L.headPh} testid="edit-heading" onChange={(v) => { setHeading(v); saveIntro(v, textRef.current) }} className="" />
                      <EditIcon className="w-4 h-4 flex-none opacity-55 self-center" />
                    </span>
                  : <h1 className="font-display rtl:font-ar text-[clamp(1.3rem,4vw,1.8rem)] font-bold leading-tight" style={{ color: 'var(--sand-100)' }}>{heading}</h1>}
                {preview
                  ? <span className="inline-flex items-baseline gap-1.5 text-[0.92rem] opacity-90 text-sand-100">
                      <Editable initial={text} placeholder={L.textPh} testid="edit-text" onChange={(v) => { setText(v); saveIntro(headingRef.current, v) }} className="" />
                      <EditIcon className="w-3.5 h-3.5 flex-none opacity-55 self-center" />
                    </span>
                  : text && <p className="text-[0.92rem] opacity-90 leading-relaxed">{text}</p>}
              </div>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-[minmax(0,14rem)_1fr] md:divide-x rtl:md:divide-x-reverse divide-[color:var(--line-soft)]">
            {/* Aside: meeting types + duration */}
            <aside className="flex flex-col gap-3 md:pe-6">
              {types.length > 1 && !done ? (
                <div className="flex flex-col gap-1.5" data-testid="type-list">
                  {types.map((t) => (
                    <button key={t.id} type="button" onClick={() => setTypeId(t.id)} data-testid={`type-${t.id}`}
                      className={`flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-[0.9rem] text-start cursor-pointer transition-colors ${selType?.id === t.id ? 'border-green-600 bg-[color-mix(in_srgb,var(--green-400)_10%,transparent)] text-green-700 font-semibold' : 'border-[color:var(--line)] text-ink-soft hover:border-green-500'}`}>
                      <span className="truncate">{t.name}</span><span className="text-ink-faint text-[0.8rem] flex-none">{t.minutes}{locale === 'ar' ? 'د' : 'm'}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <h2 className="font-display text-[1.3rem] leading-tight text-ink">{selType?.name}</h2>
              )}
              {selType && <span className="inline-flex items-center gap-1.5 text-[0.9rem] text-ink-soft"><ClockIcon className="w-4 h-4" /> {selType.minutes} {s.mins}</span>}
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
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="font-display text-[1.2rem] text-ink me-auto">{s.selectDate}</h2>
                    <Pill onClick={() => setCal((c) => (c === 'greg' ? 'hijri' : 'greg'))} data-testid="cal-toggle" className="!py-[0.22rem] !px-[0.7rem] !text-[0.74rem]">{cal === 'hijri' ? L.hijri : L.greg}</Pill>
                    <Pill onClick={() => setTzOpen(true)} data-testid="tz-pill" title={s.yourTz(tz)} className="!py-[0.22rem] !px-[0.7rem] !text-[0.74rem] [&_svg]:size-3.5"><GlobeIcon /> {tzShort}</Pill>
                  </div>
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
                          {weekdays.map((d, i) => <span key={i} className="text-[0.68rem] font-semibold text-ink-faint pb-1">{d}</span>)}
                          {monthCells.map((day, i) => {
                            if (!day) return <span key={i} />
                            const key = cellKey(day)
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
                                  {cal === 'hijri' ? dayNumFmt.format(new Date(vy, vm, day)) : day}
                                </button>
                              </div>
                            )
                          })}
                        </div>
                      </div>

                      {/* Times for the selected day */}
                      <div className="flex flex-col gap-2 min-w-0">
                        {selDayLabel && <span className="text-[0.92rem] font-semibold text-ink">{selDayLabel}</span>}
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
                    disabled={submitting || !name.trim() || !email.trim()}
                    onClick={() => (preview ? setAlertOpen(true) : submit())}
                  >
                    {submitting ? s.booking : s.confirm}
                  </Button>
                </Panel>
              )}
            </div>
          </div>

          {/* Preview: edit-back bar (Edit returns to the tool). Portaled to <body>
              so an ancestor transform doesn't turn position:fixed into absolute. */}
          {preview && createPortal(
            <div className="fixed inset-x-0 bottom-0 z-[60] bg-[var(--surface)] border-t border-[color:var(--line)] shadow-[0_-6px_20px_rgba(20,30,50,0.09)] pb-[env(safe-area-inset-bottom,0px)]">
              <div className="wrap py-2.5 flex items-center gap-3">
                <Button variant="primary" data-testid="edit-back" onClick={() => navigate(`/${locale}/apps/book-me`)} className="!h-9 !py-0 !text-[0.9rem] hover:!translate-y-0"><EditIcon className="w-4 h-4" /> {L.edit}</Button>
                <span className="text-[0.8rem] text-ink-faint">{s.previewBanner}</span>
              </div>
            </div>,
            document.body,
          )}

          {/* Preview: the alert the host would receive (no emojis, type in subject) */}
          {alertOpen && (
            <Sheet onClose={() => setAlertOpen(false)} data-testid="alert-modal">
              <SheetTitle>{L.alertTitle}</SheetTitle>
              <div className="rounded-md border border-[color:var(--line)] overflow-hidden">
                <div className="bg-[color-mix(in_srgb,var(--green-400)_10%,transparent)] px-3 py-2 text-[0.82rem] border-b border-[color:var(--line-soft)]">
                  <span className="text-ink-faint">{L.subject}: </span>
                  <span className="font-semibold text-ink">New booking: {selType?.name} — {name || L.someone}</span>
                </div>
                <div className="p-3 flex flex-col gap-1.5 text-[0.88rem]">
                  <span className="text-ink"><b>{name || L.someone}</b> ({email || '—'}) booked {selType?.name}.</span>
                  {selected != null && <span className="text-ink-soft">{dayFmt.format(new Date(selected))} · {timeFmt.format(new Date(selected))}</span>}
                  {note && <span className="text-ink-faint">Note: {note}</span>}
                </div>
              </div>
              <SheetActions><Button variant="primary" onClick={() => setAlertOpen(false)}>{s.back}</Button></SheetActions>
            </Sheet>
          )}

          {/* Timezone + calendar + first-day (same picker as the edit page) */}
          {tzOpen && (
            <Sheet data-testid="tz-sheet" onClose={() => { setTzOpen(false); setTzq('') }}>
              <SheetTitle>{L.tzTitle}</SheetTitle>
              <div className="flex flex-col gap-1.5">
                <span className="text-[0.8rem] font-semibold text-ink-soft">{L.firstD}</span>
                <div className="flex gap-1" data-testid="first-day">
                  {[0, 1].map((d) => (
                    <button key={d} type="button" onClick={() => setFirstDay(d)}
                      className={`px-3 py-1.5 rounded-md border text-[0.85rem] cursor-pointer ${firstDay === d ? 'border-green-600 bg-[color-mix(in_srgb,var(--green-400)_12%,transparent)] text-green-700 font-semibold' : 'border-[color:var(--line)] text-ink-soft hover:border-green-500'}`}>{dayNames[d]}</button>
                  ))}
                </div>
              </div>
              <Input value={tzq} onChange={(e) => setTzq(e.target.value)} placeholder={L.search} data-testid="tz-search" />
              <div className="flex flex-col max-h-[40vh] overflow-y-auto -mx-1">
                {tzList.map((z) => (
                  <button key={z} type="button" onClick={() => { setTz(z); setTzOpen(false); setTzq('') }}
                    className={`flex items-center justify-between gap-3 text-start px-3 py-2 rounded-md text-[0.85rem] cursor-pointer border-0 bg-transparent ${z === tz ? 'text-green-700 font-semibold bg-[color-mix(in_srgb,var(--green-400)_10%,transparent)]' : 'text-ink-soft hover:bg-[color-mix(in_srgb,var(--ink)_5%,transparent)]'}`}>
                    <span className="truncate">{z.replace(/_/g, ' ')}</span>
                    <span className="flex-none text-[0.76rem] text-ink-faint font-mono">{tzOffset(z)}</span>
                  </button>
                ))}
              </div>
            </Sheet>
          )}
        </Stack>
      )}
    </div>
  )
}

/** An inline, auto-sizing editable text node (contentEditable) so a trailing edit
 *  icon hugs the text instead of being pushed to the row's edge. Uncontrolled
 *  after mount to keep the caret stable. */
function Editable({ initial, onChange, className, placeholder, testid }: {
  initial: string; onChange: (v: string) => void; className: string; placeholder: string; testid: string
}) {
  const ref = useRef<HTMLSpanElement>(null)
  useEffect(() => { if (ref.current) ref.current.textContent = initial /* set once */ }, []) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <span
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      role="textbox"
      spellCheck={false}
      data-testid={testid}
      data-ph={placeholder}
      onInput={(e) => onChange(e.currentTarget.textContent || '')}
      className={`outline-none empty:before:content-[attr(data-ph)] empty:before:opacity-50 ${className}`}
    />
  )
}
