import { useEffect, useState } from 'react'
import { useLocale } from '../../i18n'
import { CopyIcon, BellIcon, ExternalLinkIcon, GlobeIcon, ShareIcon } from '../../components/icons'
import { Button, Input, Stack, Check, Pill, Sheet, SheetTitle, SheetActions } from '../../components/ui'
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
  makeCode,
  type HostConfig,
  type Grid,
  type MeetingType,
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
    heroTitle: 'Free calendar booking service',
    intro: 'Provides a shareable link for your customers to agree on a meeting time.',
    tzTitle: 'Timezone',
    tzSearch: 'Search timezones…',
    tzShown: 'Times shown in',
    availability: 'Your availability',
    tzNote: (tz: string) => `Times are in your current timezone — ${tz}. Availability maps to your Google Calendar in this zone; visitors see and book slots in their own timezone.`,
    meetingTypes: 'Meeting types',
    addType: 'Add meeting type',
    meet: 'Google Meet',
    share: 'Share',
    fineHint: 'One booking per painted hour · bookable up to 30 days ahead · 4h minimum notice.',
    whereTitle: 'Where it happens',
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
    heroTitle: 'خدمة حجز مواعيد مجانية',
    intro: 'رابط قابل للمشاركة يتّفق من خلاله عملاؤك على وقت الاجتماع.',
    tzTitle: 'المنطقة الزمنية',
    tzSearch: 'ابحث عن منطقة زمنية…',
    tzShown: 'الأوقات بتوقيت',
    availability: 'أوقات فراغك',
    tzNote: (tz: string) => `الأوقات بتوقيتك الحالي — ${tz}. تُطابَق الأوقات مع تقويم جوجل بهذا التوقيت؛ ويرى الزوار ويحجزون بتوقيتهم الخاص.`,
    meetingTypes: 'أنواع الاجتماعات',
    addType: 'أضف نوع اجتماع',
    meet: 'Google Meet',
    share: 'مشاركة',
    fineHint: 'حجز واحد لكل ساعة مرسومة · الحجز حتى ٣٠ يومًا مقدمًا · بمهلة ٤ ساعات على الأقل.',
    whereTitle: 'أين سيُعقد',
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
  const [pubMenu, setPubMenu] = useState(false)
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

  // Meeting types — the primary (first) mirrors into `meeting` for the backend.
  function setTypes(next: MeetingType[]) {
    setCfg((c) => ({ ...c, meetingTypes: next, meeting: { ...c.meeting, minutes: next[0]?.minutes ?? 45, title: next[0]?.name ?? 'Meeting' } }))
  }
  const addType = () => setTypes([...cfg.meetingTypes, { id: makeCode(), name: locale === 'ar' ? 'اجتماع' : 'Meeting', minutes: 30, meet: false }])
  const removeType = (id: string) => { if (cfg.meetingTypes.length > 1) setTypes(cfg.meetingTypes.filter((t) => t.id !== id)) }
  const editType = (id: string, patch: Partial<MeetingType>) => setTypes(cfg.meetingTypes.map((t) => (t.id === id ? { ...t, ...patch } : t)))
  const moveType = (i: number, dir: number) => {
    const arr = cfg.meetingTypes.slice()
    const j = i + dir
    if (j < 0 || j >= arr.length) return
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
    setTypes(arr)
  }
  async function shareLink() {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try { await navigator.share({ title: cfg.meetingTypes[0]?.name || 'Book Me', url: link }) } catch { /* cancelled */ }
    } else copyLink()
  }


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
    <Stack data-testid="book-with-me" className="pb-24">
      {/* Intro hero — Publish (white) + Preview (text link), inside the box */}
      <div className="mx-[calc(50%-50vw)] w-screen max-w-[100vw] mt-[calc(clamp(1.5rem,4vw,2.5rem)*-1)] bg-green-600 text-sand-100">
        <div className="wrap py-[clamp(1.3rem,4vw,1.8rem)] flex flex-col gap-3 max-w-[44rem]">
          <div className="flex flex-col gap-1">
            <h1 className="font-display rtl:font-ar text-[clamp(1.4rem,4vw,1.9rem)] font-bold leading-tight" style={{ color: 'var(--sand-100)' }}>{s.heroTitle}</h1>
            <p className="text-[0.95rem] leading-relaxed opacity-90">{s.intro}</p>
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-[0.82rem] font-semibold opacity-90">{s.meetingTypes}</span>
            {cfg.meetingTypes.map((t, i) => (
              <div key={t.id} className="flex flex-wrap items-center gap-2 rounded-md bg-[color-mix(in_srgb,var(--sand-100)_14%,transparent)] p-2" data-testid={`mtype-${i}`}>
                <input value={t.name} onChange={(e) => editType(t.id, { name: e.target.value })} aria-label={s.meetingTypes}
                  className="grow min-w-[8rem] rounded bg-white text-ink px-2.5 py-1.5 text-[0.9rem] border-0 outline-none" />
                <select value={t.minutes} onChange={(e) => editType(t.id, { minutes: Number(e.target.value) })} aria-label={s.length}
                  className="rounded bg-white text-ink px-2 py-1.5 text-[0.9rem] border-0 outline-none cursor-pointer">
                  {[15, 30, 45, 60, 90].map((m) => <option key={m} value={m}>{m} {s.min}</option>)}
                </select>
                <label className="inline-flex items-center gap-1.5 text-[0.82rem] cursor-pointer"><input type="checkbox" checked={t.meet} onChange={(e) => editType(t.id, { meet: e.target.checked })} /> {s.meet}</label>
                <div className="flex items-center gap-1 ms-auto [&>button]:size-7 [&>button]:grid [&>button]:place-items-center [&>button]:rounded [&>button]:border-0 [&>button]:cursor-pointer [&>button]:text-sand-100 [&>button]:bg-[color-mix(in_srgb,var(--sand-100)_18%,transparent)] [&>button:disabled]:opacity-40">
                  <button type="button" aria-label="move up" onClick={() => moveType(i, -1)} disabled={i === 0}>↑</button>
                  <button type="button" aria-label="move down" onClick={() => moveType(i, 1)} disabled={i === cfg.meetingTypes.length - 1}>↓</button>
                  <button type="button" aria-label="remove" onClick={() => removeType(t.id)} disabled={cfg.meetingTypes.length <= 1}>✕</button>
                </div>
              </div>
            ))}
            <button type="button" onClick={addType} data-testid="add-type"
              className="self-start inline-flex items-center gap-1.5 rounded-md border border-[color-mix(in_srgb,var(--sand-100)_45%,transparent)] bg-transparent text-sand-100 px-3 py-1.5 text-[0.85rem] font-semibold cursor-pointer hover:bg-[color-mix(in_srgb,var(--sand-100)_16%,transparent)]">＋ {s.addType}</button>
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

      {/* 2 · Where it happens + fine print — no well */}
      <div className="flex flex-col gap-2">
        <div role="heading" aria-level={2} className={H}>{s.whereTitle}</div>
        <span className="text-[0.78rem] text-ink-faint">{s.locationHelp}</span>
        <Input value={cfg.meeting.location} placeholder={s.locationPh} data-testid="location"
          onChange={(e) => setMeeting('location', e.target.value)} />
        <p className="text-[0.78rem] text-ink-faint mt-1">{s.fineHint}</p>
        {saveState === 'error' && <span className="text-[0.82rem] text-gold-500">{s.saveErr}</span>}
      </div>

      {/* Sticky publish bar: Publish (▾ Preview / Copy), Share icon, Alerts pill */}
      <div className="fixed inset-x-0 bottom-0 z-40 bg-[var(--surface)] border-t border-[color:var(--line)] shadow-[0_-6px_20px_rgba(20,30,50,0.09)] max-[560px]:pb-[env(safe-area-inset-bottom,0px)]">
        <div className="wrap py-2.5 flex items-center gap-2">
          <div className="relative flex items-stretch rounded-md shadow-[var(--shadow-sm)]">
            <Button variant="primary" onClick={publish} disabled={saveState === 'saving'} data-testid="save-schedule" className="!rounded-e-none">
              {session ? (saveState === 'saving' ? s.saving : saveState === 'saved' ? s.saved : s.save) : s.publishCta}
            </Button>
            <button type="button" aria-label={s.previewLink} aria-expanded={pubMenu} onClick={() => setPubMenu((v) => !v)}
              className="inline-flex items-center rounded-e-md bg-green-700 text-sand-100 px-2.5 border-0 border-s border-[color:color-mix(in_srgb,var(--sand-100)_30%,transparent)] hover:bg-green-600 cursor-pointer">▾</button>
            {pubMenu && (
              <div className="absolute bottom-full start-0 mb-1.5 bg-[var(--surface)] border border-[color:var(--line)] rounded-md shadow-[var(--shadow-md)] overflow-hidden min-w-[11rem]">
                <button type="button" data-testid="preview-link" onClick={() => { openPreview(); setPubMenu(false) }} className="flex items-center gap-2 w-full text-start px-4 py-2.5 text-[0.88rem] text-ink-soft hover:bg-[color-mix(in_srgb,var(--green-400)_10%,transparent)] border-0 bg-transparent cursor-pointer whitespace-nowrap"><ExternalLinkIcon className="w-4 h-4" /> {s.previewLink}</button>
                <button type="button" data-testid="copy-link" onClick={() => { copyLink(); setPubMenu(false) }} className="flex items-center gap-2 w-full text-start px-4 py-2.5 text-[0.88rem] text-ink-soft hover:bg-[color-mix(in_srgb,var(--green-400)_10%,transparent)] border-0 border-t border-[color:var(--line-soft)] bg-transparent cursor-pointer whitespace-nowrap"><CopyIcon /> {copied ? s.copied : s.copy}</button>
              </div>
            )}
          </div>
          <button type="button" onClick={shareLink} data-testid="share-link" aria-label={s.share} title={s.share}
            className="inline-flex items-center justify-center size-10 rounded-md border border-[color:var(--line)] bg-[var(--surface)] text-ink-soft hover:border-green-500 hover:text-green-700 cursor-pointer [&_svg]:size-5"><ShareIcon /></button>
          <Pill className="ms-auto" data-testid="alerts-pill" onClick={() => setAlertsOpen(true)}><BellIcon /> {s.alertsTitle}</Pill>
        </div>
      </div>

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
