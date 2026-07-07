import { useEffect, useMemo, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { useLocale } from '../i18n'
import { useDocumentMeta } from '../lib/useDocumentMeta'
import { Button, Input, Textarea, Field, Stack, Panel, Pill } from '../components/ui'
import { GlobeIcon } from '../components/icons'
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

  return (
    <div className="wrap py-[clamp(1.5rem,4vw,2.5rem)] max-w-[46rem] animate-[fadeUp_0.5s_ease_both]">
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

          <div className="grid gap-6 md:grid-cols-[minmax(0,15rem)_1fr]">
            {/* Calendly-style aside: who + what + timezone */}
            <aside className="flex flex-col gap-2.5 md:sticky md:top-24 md:self-start">
              {host.name && <span className="text-[0.85rem] font-semibold text-ink-soft">{host.name}</span>}
              <div className="flex flex-wrap items-center gap-2">
                <Pill>{host.title}</Pill>
                <span className="font-mono text-[0.85rem] text-ink-soft">{host.minutes} {s.mins}</span>
              </div>
              {host.location && <span className="text-[0.85rem] text-ink-faint">{host.location}</span>}
              <p className="text-[0.9rem] text-ink-soft leading-relaxed">{s.intro}</p>
              <Pill className="self-start !cursor-default" title={s.yourTz(localTz)}><GlobeIcon /> {localTz}</Pill>
            </aside>

            <div className="min-w-0">
              {done ? (
                <Panel data-testid="booking-done">
                  <h2 className="font-display text-[1.4rem] text-green-700">{s.booked}</h2>
                  <p className="text-ink-soft">{s.bookedBody}</p>
                  <p className="text-ink-faint text-[0.9rem]">
                    {selected != null && `${dayFmt.format(new Date(selected))} ${s.at} ${timeFmt.format(new Date(selected))}`}
                  </p>
                </Panel>
              ) : selected == null ? (
                <>
                  {gone && <p className="text-[0.9rem] text-gold-500 mb-2" role="status">{s.gone}</p>}
                  {grouped.length === 0 ? (
                    <Panel><p className="text-ink-soft">{s.none}</p></Panel>
                  ) : (
                    <Stack>
                      {grouped.map(([key, times]) => (
                        <div key={key} className="flex flex-col gap-2">
                          <h2 className="text-[0.95rem] font-semibold text-ink">{dayFmt.format(new Date(times[0]))}</h2>
                          <div className="flex flex-wrap gap-2">
                            {times.map((ms) => (
                              <button
                                key={ms}
                                data-testid="slot"
                                onClick={() => { setSelected(ms); setGone(false) }}
                                className="font-mono text-[0.9rem] px-3 py-2 rounded-md border border-[color:var(--line)] bg-[var(--surface)] text-ink-soft hover:border-green-600 hover:text-green-700 hover:bg-[color-mix(in_srgb,var(--green-400)_8%,transparent)] transition-colors"
                              >
                                {timeFmt.format(new Date(ms))}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </Stack>
                  )}
                </>
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
