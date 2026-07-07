import { useEffect, useMemo, useState } from 'react'
import { useLocale } from '../../i18n'
import { CopyIcon, BellIcon, ExternalLinkIcon, GlobeIcon } from '../../components/icons'
import { Button, Input, Field, Stack, Seg, SegButton, Panel, Check, Pill, Sheet, SheetTitle, SheetActions } from '../../components/ui'
import { AvailabilityGrid } from './AvailabilityGrid'
import { connectGoogleUrl, saveSchedule } from '../../lib/bookingApi'
import { subscribeDevice } from '../../lib/push'
import {
  loadConfig,
  saveConfig,
  gridToWindows,
  windowsToGrid,
  BOOKING_LINK_BASE,
  TELEGRAM_BOT,
  type HostConfig,
  type Grid,
} from './lib'

const HSID_KEY = 'bis-bookwith-hsid'

interface Session {
  hsid: string
  email?: string
  name?: string
}

/** Decode our HMAC session token's (base64url) payload for display only. */
function readSession(): Session | null {
  try {
    const hsid = localStorage.getItem(HSID_KEY)
    if (!hsid) return null
    const b64 = hsid.split('.')[0].replace(/-/g, '+').replace(/_/g, '/')
    const body = JSON.parse(atob(b64.padEnd(Math.ceil(b64.length / 4) * 4, '=')))
    if (body.exp && Date.now() > body.exp) {
      localStorage.removeItem(HSID_KEY)
      return null
    }
    return { hsid, email: body.email, name: body.name }
  } catch {
    return null
  }
}

const STR = {
  en: {
    heroTitle: 'Book Me',
    intro: 'Set when you’re free, share one link, let people self-book.',
    tzTitle: 'Timezone',
    tzSearch: 'Search timezones…',
    tzShown: 'Times shown in',
    availability: 'Your availability',
    tzNote: (tz: string) => `Times are in your current timezone — ${tz}. Availability maps to your Google Calendar in this zone; visitors see and book slots in their own timezone.`,
    meeting: 'Meeting settings',
    length: 'Length',
    lengthHint: 'Each available hour is divided into sessions of this length (e.g. 30 min → two per hour; 45 min → one, with a gap).',
    min: 'min',
    gap: 'Gap between meetings',
    notice: 'Minimum notice',
    hours: 'hours',
    horizon: 'Bookable up to',
    days: 'days ahead',
    title: 'Meeting name',
    titlePh: 'e.g. Intro call, Consultation',
    titleHelp: 'What people are booking — shown on your booking page and used as the calendar event title.',
    location: 'Where it happens',
    locationPh: 'e.g. Google Meet link, phone number, address',
    locationHelp: 'Optional. Added to the calendar invite so the booker knows where to go. Leave blank to sort out later.',
    shareTitle: 'Share your booking page',
    private: 'Private',
    published: 'Published',
    publishCta: 'Publish',
    publishNote: 'Publish to activate your link — you’ll sign in with Google so we can check your calendar for conflicts and add booked meetings automatically.',
    connectedAs: (who: string) => `Connected as ${who}`,
    copy: 'Copy link',
    copied: 'Copied!',
    previewLink: 'Preview',
    save: 'Save changes',
    saving: 'Saving…',
    saved: 'Saved ✓',
    saveErr: 'Couldn’t save — try again.',
    alertsTitle: 'Booking alerts',
    alertsNote: 'Get pinged the moment someone books. Your booker always receives an email confirmation.',
    push: 'Push to this device',
    telegram: 'Telegram DM',
    email: 'Email me too',
    linkTg: 'Link my Telegram',
    pushDenied: 'Notifications are blocked in your browser settings.',
    done: 'Done',
    soon: 'Your schedule saves on this device until you publish.',
  },
  ar: {
    heroTitle: 'احجز معي',
    intro: 'حدِّد أوقات فراغك، وشارك رابطًا واحدًا، ودَع الناس يحجزون بأنفسهم.',
    tzTitle: 'المنطقة الزمنية',
    tzSearch: 'ابحث عن منطقة زمنية…',
    tzShown: 'الأوقات بتوقيت',
    availability: 'أوقات فراغك',
    tzNote: (tz: string) => `الأوقات بتوقيتك الحالي — ${tz}. تُطابَق الأوقات مع تقويم جوجل بهذا التوقيت؛ ويرى الزوار ويحجزون بتوقيتهم الخاص.`,
    meeting: 'إعدادات الاجتماع',
    length: 'المدة',
    lengthHint: 'تُقسَّم كل ساعة متاحة إلى جلسات بهذه المدة (مثلاً ٣٠ دقيقة ← جلستان في الساعة؛ ٤٥ دقيقة ← جلسة واحدة مع فاصل).',
    min: 'دقيقة',
    gap: 'فاصل بين الاجتماعات',
    notice: 'أقل مهلة للحجز',
    hours: 'ساعات',
    horizon: 'الحجز حتى',
    days: 'يومًا مقدمًا',
    title: 'اسم الاجتماع',
    titlePh: 'مثال: مكالمة تعارف، استشارة',
    titleHelp: 'ما الذي يحجزه الناس — يظهر في صفحة الحجز ويُستخدم عنوانًا لحدث التقويم.',
    location: 'أين سيُعقد',
    locationPh: 'مثال: رابط Google Meet، رقم هاتف، عنوان',
    locationHelp: 'اختياري. يُضاف إلى دعوة التقويم ليعرف الحاجز أين يذهب. اتركه فارغًا لتحديده لاحقًا.',
    shareTitle: 'شارك صفحة الحجز',
    private: 'خاص',
    published: 'منشور',
    publishCta: 'انشر',
    publishNote: 'انشر لتفعيل رابطك — ستسجّل الدخول بجوجل لنتحقق من تعارضات تقويمك ونضيف الاجتماعات المحجوزة تلقائيًا.',
    connectedAs: (who: string) => `متصل باسم ${who}`,
    copy: 'نسخ الرابط',
    copied: 'تم النسخ!',
    previewLink: 'معاينة',
    save: 'حفظ التغييرات',
    saving: 'جارٍ الحفظ…',
    saved: 'تم الحفظ ✓',
    saveErr: 'تعذّر الحفظ — حاول مرة أخرى.',
    alertsTitle: 'تنبيهات الحجز',
    alertsNote: 'تصلك تنبيهات لحظة الحجز. ويستلم الحاجز دائمًا تأكيدًا بالبريد.',
    push: 'إشعار لهذا الجهاز',
    telegram: 'رسالة تيليجرام',
    email: 'أرسل لي بريدًا أيضًا',
    linkTg: 'اربط تيليجرام',
    pushDenied: 'الإشعارات محظورة في إعدادات متصفحك.',
    done: 'تم',
    soon: 'يُحفظ جدولك على هذا الجهاز حتى تنشره.',
  },
}

const LENGTHS = [15, 30, 45, 60]

// Full IANA zone list where available, else a sensible fallback.
const TZS: string[] = (() => {
  try {
    const sv = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf
    if (sv) return sv('timeZone')
  } catch { /* older browsers */ }
  return ['Asia/Riyadh', 'Asia/Dubai', 'Africa/Cairo', 'Europe/London', 'Europe/Istanbul', 'America/New_York', 'America/Los_Angeles', 'Asia/Karachi', 'Asia/Kolkata', 'Asia/Tokyo', 'Australia/Sydney', 'UTC']
})()

/** "Asia/Riyadh (GMT+3)" — the IANA zone plus its current offset. */
function tzLabel(tz: string): string {
  try {
    const parts = new Intl.DateTimeFormat('en', { timeZone: tz, timeZoneName: 'shortOffset' }).formatToParts(new Date())
    const off = parts.find((p) => p.type === 'timeZoneName')?.value
    return off ? `${tz} (${off})` : tz
  } catch {
    return tz
  }
}

/** Compact pill label: "Riyadh · GMT+3". */
function shortTz(tz: string): string {
  const city = tz.split('/').pop()?.replace(/_/g, ' ') || tz
  try {
    const parts = new Intl.DateTimeFormat('en', { timeZone: tz, timeZoneName: 'shortOffset' }).formatToParts(new Date())
    const off = parts.find((p) => p.type === 'timeZoneName')?.value
    return off ? `${city} · ${off}` : city
  } catch {
    return city
  }
}

export default function BookWithMeTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const [cfg, setCfg] = useState<HostConfig>(() => loadConfig())
  const [grid, setGrid] = useState<Grid>(() => windowsToGrid(cfg.availability))
  const [copied, setCopied] = useState(false)
  const [session, setSession] = useState<Session | null>(null)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [alertsOpen, setAlertsOpen] = useState(false)
  const [pushDenied, setPushDenied] = useState(false)
  const [tzOpen, setTzOpen] = useState(false)
  const [tzq, setTzq] = useState('')
  // Bigger section heading (a div, not h2, to dodge the unlayered-base rule).
  const H = 'font-display rtl:font-ar text-[1.2rem] font-semibold text-ink leading-tight'

  // On return from the Google OAuth callback the dashboard URL carries
  // #hsid=<session>&code=<hostCode>. Capture it, then clear the hash.
  useEffect(() => {
    const hash = window.location.hash
    if (hash.startsWith('#hsid=')) {
      const p = new URLSearchParams(hash.slice(1))
      const hsid = p.get('hsid')
      const code = p.get('code')
      if (hsid) localStorage.setItem(HSID_KEY, hsid)
      if (code) setCfg((c) => ({ ...c, code }))
      history.replaceState(null, '', window.location.pathname + window.location.search)
    }
    setSession(readSession())
  }, [])

  // Persist locally whenever config changes.
  useEffect(() => {
    saveConfig(cfg)
  }, [cfg])

  const link = `${BOOKING_LINK_BASE}/${cfg.code}`

  function updateGrid(next: Grid) {
    setGrid(next)
    setCfg((c) => ({ ...c, availability: gridToWindows(next) }))
  }

  function setMeeting<K extends keyof HostConfig['meeting']>(key: K, val: HostConfig['meeting'][K]) {
    setCfg((c) => ({ ...c, meeting: { ...c.meeting, [key]: val } }))
  }

  const isCustomLength = useMemo(() => !LENGTHS.includes(cfg.meeting.minutes), [cfg.meeting.minutes])

  async function publish() {
    if (!session) {
      // Full-page redirect to Google (sign-in + calendar). Returns to this page
      // with the #hsid session, handled by the effect above.
      window.location.href = connectGoogleUrl(cfg.code, locale)
      return
    }
    setSaveState('saving')
    try {
      await saveSchedule({
        hsid: session.hsid,
        code: cfg.code,
        tz: cfg.tz,
        meeting: cfg.meeting,
        availability: cfg.availability,
        notify: cfg.notify,
        pushSub: cfg.pushSub,
      })
      setSaveState('saved')
      setTimeout(() => setSaveState('idle'), 2000)
    } catch {
      setSaveState('error')
    }
  }

  async function togglePush(on: boolean) {
    if (!on) {
      setCfg((c) => ({ ...c, notify: { ...c.notify, push: false } }))
      return
    }
    const sub = await subscribeDevice()
    if (!sub) {
      setPushDenied(true)
      return
    }
    setPushDenied(false)
    const pushSub = sub.toJSON()
    setCfg((c) => ({ ...c, notify: { ...c.notify, push: true }, pushSub }))
    if (session) {
      saveSchedule({ hsid: session.hsid, code: cfg.code, notify: { ...cfg.notify, push: true }, pushSub }).catch(() => {})
    }
  }

  function setChannel(key: 'telegram' | 'email', on: boolean) {
    setCfg((c) => ({ ...c, notify: { ...c.notify, [key]: on } }))
  }

  function openPreview() {
    window.open(`/${locale}/book/${cfg.code}?preview=1`, '_blank', 'noopener')
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* ignore */
    }
  }

  return (
    <Stack data-testid="book-with-me">
      {/* Intro hero — Publish (white) + Preview (text link), inside the box */}
      <div className="mx-[calc(50%-50vw)] w-screen max-w-[100vw] mt-[calc(clamp(1.5rem,4vw,2.5rem)*-1)] bg-green-600 text-sand-100">
        <div className="wrap py-[clamp(1.3rem,4vw,1.8rem)] flex flex-col gap-3 max-w-[44rem]">
          <div className="flex flex-col gap-1">
            <h1 className="font-display rtl:font-ar text-[clamp(1.4rem,4vw,1.9rem)] font-bold leading-tight" style={{ color: 'var(--sand-100)' }}>{s.heroTitle}</h1>
            <p className="text-[0.95rem] leading-relaxed opacity-90">{s.intro}</p>
          </div>
          <div className="flex items-center gap-4">
            <button type="button" onClick={publish} data-testid="publish-hero"
              className="rounded-md bg-white text-green-700 px-4 py-2.5 text-[0.9rem] font-semibold border-0 cursor-pointer hover:bg-sand-100">{s.publishCta}</button>
            <button type="button" onClick={openPreview} data-testid="preview-hero"
              className="self-center inline-flex items-center gap-1.5 bg-transparent border-0 text-sand-100 underline text-[0.9rem] font-semibold cursor-pointer">{s.previewLink} <ExternalLinkIcon className="w-4 h-4" /></button>
          </div>
        </div>
      </div>

      {/* 1 · Availability painter — no well; big heading; timezone pill + modal */}
      <div className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div role="heading" aria-level={2} className={H}>{s.availability}</div>
          <Pill className="!py-[0.22rem] !px-[0.7rem] !text-[0.74rem]" onClick={() => setTzOpen(true)} data-testid="tz-pill" title={s.tzNote(tzLabel(cfg.tz))}><GlobeIcon /> {shortTz(cfg.tz)}</Pill>
        </div>
        <AvailabilityGrid grid={grid} onChange={updateGrid} locale={locale} />
      </div>

      {/* 2 · Meeting settings — no well, big heading */}
      <div className="flex flex-col gap-4">
        <div role="heading" aria-level={2} className={H}>{s.meeting}</div>

        <div className="flex flex-col gap-2">
          <span className="text-[0.82rem] font-semibold text-ink-soft">{s.length}</span>
          <div className="flex flex-wrap items-center gap-2">
            <Seg role="group">
              {LENGTHS.map((n) => (
                <SegButton
                  key={n}
                  active={cfg.meeting.minutes === n}
                  data-testid={`length-${n}`}
                  onClick={() => setMeeting('minutes', n)}
                >
                  {n} {s.min}
                </SegButton>
              ))}
            </Seg>
            <Input
              className="font-mono w-24"
              type="number"
              min="5"
              step="5"
              aria-label={s.length}
              value={isCustomLength ? cfg.meeting.minutes : ''}
              placeholder="…"
              onChange={(e) => setMeeting('minutes', Math.max(5, Number(e.target.value) || 5))}
            />
          </div>
          <span className="text-[0.78rem] text-ink-faint">{s.lengthHint}</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field label={`${s.gap} (${s.min})`}>
            <Input className="font-mono" type="number" min="0" step="5" value={cfg.meeting.gapMinutes}
              data-testid="gap"
              onChange={(e) => setMeeting('gapMinutes', Math.max(0, Number(e.target.value) || 0))} />
          </Field>
          <Field label={`${s.notice} (${s.hours})`}>
            <Input className="font-mono" type="number" min="0" value={cfg.meeting.minNoticeHours}
              onChange={(e) => setMeeting('minNoticeHours', Math.max(0, Number(e.target.value) || 0))} />
          </Field>
          <Field label={`${s.horizon} (${s.days})`}>
            <Input className="font-mono" type="number" min="1" value={cfg.meeting.horizonDays}
              onChange={(e) => setMeeting('horizonDays', Math.max(1, Number(e.target.value) || 1))} />
          </Field>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label={s.title}>
            <span className="text-[0.78rem] text-ink-faint">{s.titleHelp}</span>
            <Input value={cfg.meeting.title} placeholder={s.titlePh}
              onChange={(e) => setMeeting('title', e.target.value)} />
          </Field>
          <Field label={s.location}>
            <span className="text-[0.78rem] text-ink-faint">{s.locationHelp}</span>
            <Input value={cfg.meeting.location} placeholder={s.locationPh}
              onChange={(e) => setMeeting('location', e.target.value)} />
          </Field>
        </div>
      </div>

      {/* 3 · Publish & share — after the schedule, Google-Docs style */}
      <Panel>
        <div className="flex items-center justify-between gap-3">
          <span className="text-[0.82rem] font-semibold text-ink-soft tracking-[0.01em]">{s.shareTitle}</span>
          <span
            data-testid="publish-status"
            className={`inline-flex items-center gap-1.5 text-[0.78rem] font-semibold px-2.5 py-1 rounded-full ${
              session
                ? 'bg-[color-mix(in_srgb,var(--green-400)_18%,transparent)] text-green-700'
                : 'bg-[color-mix(in_srgb,var(--sand-100)_60%,transparent)] text-ink-faint'
            }`}
          >
            {session && <span className="size-1.5 rounded-full bg-green-600" />}
            {session ? s.published : s.private}
          </span>
        </div>

        {session ? (
          <>
            <span className="text-[0.82rem] text-ink-faint">{s.connectedAs(session.email || session.name || '')}</span>
            <div className="flex flex-wrap gap-2">
              <Input className="font-mono grow min-w-0 text-[0.85rem]" readOnly value={link}
                data-testid="booking-link" onFocus={(e) => e.currentTarget.select()} />
              <Button variant="primary" onClick={copyLink} data-testid="copy-link">
                <CopyIcon /> {copied ? s.copied : s.copy}
              </Button>
            </div>
            <div className="flex items-center gap-2">
              {saveState === 'error' && <span className="text-[0.82rem] text-gold-500">{s.saveErr}</span>}
              <Button variant="primary" onClick={publish} disabled={saveState === 'saving'} data-testid="save-schedule">
                {saveState === 'saving' ? s.saving : saveState === 'saved' ? s.saved : s.save}
              </Button>
            </div>
          </>
        ) : (
          <p className="text-[0.82rem] text-ink-faint">{s.publishNote}</p>
        )}
      </Panel>

      {/* 4 · Booking alerts — a pill that opens a settings sheet */}
      <div className="flex items-center gap-2">
        <Pill data-testid="alerts-pill" onClick={() => setAlertsOpen(true)}>
          <BellIcon /> {s.alertsTitle}
        </Pill>
      </div>

      <p className="text-[0.82rem] text-ink-faint">{s.soon}</p>

      {alertsOpen && (
        <Sheet data-testid="alerts-sheet" onClose={() => setAlertsOpen(false)}>
          <SheetTitle>{s.alertsTitle}</SheetTitle>
          <Stack className="!gap-3">
            <div className="flex flex-col gap-1">
              <Check>
                <input type="checkbox" checked={cfg.notify.push} onChange={(e) => togglePush(e.target.checked)} />
                {s.push}
              </Check>
              {pushDenied && <span className="text-[0.8rem] text-gold-500 ms-7">{s.pushDenied}</span>}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Check>
                <input type="checkbox" checked={cfg.notify.telegram} onChange={(e) => setChannel('telegram', e.target.checked)} />
                {s.telegram}
              </Check>
              {cfg.notify.telegram && (
                <Button href={`https://t.me/${TELEGRAM_BOT}?start=${cfg.code}`} target="_blank" rel="noopener noreferrer" data-testid="link-telegram">
                  {s.linkTg}
                </Button>
              )}
            </div>
            <Check>
              <input type="checkbox" checked={cfg.notify.email} onChange={(e) => setChannel('email', e.target.checked)} />
              {s.email}
            </Check>
            <p className="text-[0.8rem] text-ink-faint">{s.alertsNote}</p>
          </Stack>
          <SheetActions>
            <Button variant="primary" onClick={() => setAlertsOpen(false)}>{s.done}</Button>
          </SheetActions>
        </Sheet>
      )}

      {tzOpen && (
        <Sheet data-testid="tz-sheet" onClose={() => { setTzOpen(false); setTzq('') }}>
          <SheetTitle>{s.tzTitle}</SheetTitle>
          <Input autoFocus placeholder={s.tzSearch} value={tzq} onChange={(e) => setTzq(e.target.value)} data-testid="tz-search" />
          <div className="overflow-y-auto mt-2 flex flex-col gap-0.5 min-h-0">
            {TZS.filter((z) => z.toLowerCase().includes(tzq.trim().toLowerCase())).slice(0, 250).map((z) => (
              <button key={z} type="button" data-testid={`tz-opt-${z}`}
                onClick={() => { setCfg((c) => ({ ...c, tz: z })); setTzOpen(false); setTzq('') }}
                className={`text-start px-3 py-2 rounded-md text-[0.9rem] cursor-pointer hover:bg-[color-mix(in_srgb,var(--green-400)_10%,transparent)] ${z === cfg.tz ? 'text-green-700 font-semibold' : 'text-ink-soft'}`}>
                {z.replace(/_/g, ' ')}
              </button>
            ))}
          </div>
        </Sheet>
      )}
    </Stack>
  )
}
