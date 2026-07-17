import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { createPortal } from 'react-dom'
import { useLocale } from '../../i18n'
import { BellIcon, ExternalLinkIcon, GlobeIcon, ShareIcon, GripIcon } from '../../components/icons'
import { Button, Input, Stack, Check, Pill, Sheet, SheetTitle, SheetActions } from '../../components/ui'
import { AvailabilityGrid, type GridHandle } from './AvailabilityGrid'
import { connectGoogleUrl, saveSchedule, deleteHost, hostStatus, getConfig } from '../../lib/bookingApi'
import { subscribeDevice } from '../../lib/push'
import {
  loadConfig,
  saveConfig,
  clearConfig,
  gridToWindows,
  windowsToGrid,
  BOOKING_LINK_BASE,
  TELEGRAM_BOT,
  makeCode,
  type HostConfig,
  type Grid,
  type MeetingType,
  type MeetingConfig,
  type AvailWindow,
} from './lib'

const HSID_KEY = 'bis-bookwith-hsid'

interface Session {
  hsid: string
  email?: string
  name?: string
  cal?: boolean // whether the host granted Google Calendar access
}

/** Decode our HMAC session token's (base64url) payload for display only. */
function readSession(): Session | null {
  try {
    const hsid = localStorage.getItem(HSID_KEY)
    if (!hsid) return null
    const b64 = hsid.split('.')[0].replace(/-/g, '+').replace(/_/g, '/')
    const bin = atob(b64.padEnd(Math.ceil(b64.length / 4) * 4, '='))
    // Decode as UTF-8 (atob gives Latin-1) so names like "Björn" aren't mangled.
    const body = JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0))))
    if (body.exp && Date.now() > body.exp) {
      localStorage.removeItem(HSID_KEY)
      return null
    }
    return { hsid, email: body.email, name: body.name, cal: body.cal }
  } catch {
    return null
  }
}

type ConfigLike = Partial<Pick<HostConfig, 'tz' | 'firstDay' | 'pageHeading' | 'pageText' | 'meeting' | 'meetingTypes' | 'availability' | 'notify'>>

/** Normalised, order-stable serialization of the schedule-relevant config, so a
 *  local copy and the saved backend copy can be compared for drift. */
function serializeCfg(c: ConfigLike | null | undefined): string {
  if (!c) return ''
  const m = (c.meeting || {}) as MeetingConfig
  const n = c.notify || { push: false, telegram: false, email: false }
  return JSON.stringify({
    tz: c.tz || '',
    firstDay: c.firstDay ?? 0,
    pageHeading: c.pageHeading || '',
    pageText: c.pageText || '',
    meeting: { minutes: m.minutes, gapMinutes: m.gapMinutes, bufferBefore: m.bufferBefore, bufferAfter: m.bufferAfter, horizonDays: m.horizonDays, minNoticeHours: m.minNoticeHours, title: m.title, location: m.location || '' },
    meetingTypes: (c.meetingTypes || []).map((t: MeetingType) => ({ id: t.id, name: t.name, minutes: t.minutes, meet: !!t.meet })),
    availability: (c.availability || []).map((w: AvailWindow) => ({ day: w.day, start: w.start, end: w.end })),
    notify: { push: !!n.push, telegram: !!n.telegram, email: !!n.email },
  })
}

const STR = {
  en: {
    heroTitle: 'Free calendar booking service',
    intro: 'Provides a custom page for your customers to agree on a meeting time.',
    tzTitle: 'Timezone',
    firstDayLabel: 'First day of week',
    tzSearch: 'Search timezones…',
    tzShown: 'Times shown in',
    totalSlots: 'Total slots',
    availability: 'Your availability',
    tzNote: (tz: string) => `Times are in your current timezone — ${tz}. Availability maps to your Google Calendar in this zone; visitors see and book slots in their own timezone.`,
    meetingTypes: 'Type of meeting',
    addType: 'Add meeting type',
    add: 'Add',
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
    unverified: 'Google will warn that this app isn’t verified — our review is still in progress. Choose Advanced → Continue to carry on. We only read when you’re busy and add your booked meetings.',
    calWarn: 'Google Calendar isn’t connected, so your existing events won’t block booking times and new bookings won’t be added to your calendar. Reconnect and allow Calendar access.',
    reconnectExpired: 'Your Google connection has expired or was revoked — your booking page won’t work until you reconnect.',
    reconnect: 'Reconnect Calendar',
    syncConflict: 'The changes on this device differ from your saved booking page. Which version should we keep?',
    keepLocal: 'Keep my changes',
    useServer: 'Use saved version',
    saveError: 'Couldn’t save your changes to your live page — they aren’t published yet.',
    retry: 'Retry',
    openPage: 'Open page',
    unpublish: 'Unpublish',
    deletePage: 'Delete page',
    deleteTitle: 'Delete this booking page?',
    deleteBody: 'This permanently removes your booking link and every booking made through it. This can’t be undone.',
    deleteConfirm: 'Delete page',
    cancel: 'Cancel',
    alerts: 'Alerts',
    save: 'Save changes',
    saving: 'Saving…',
    saved: 'Saved ✓',
    saveErr: 'Couldn’t save — try again.',
    alertsTitle: 'Booking alerts',
    alertsNote: 'Get pinged the moment someone books. Your booker always receives an email confirmation.',
    shareDisabled: 'Publish your page first, then you can share the link.',
    emailPrev: 'Preview of your alert',
    emailNew: 'New booking',
    emailSample: 'Sara A.',
    emailAddr: 'sara.a@gmail.com',
    emailBooked: 'booked',
    emailWhenLabel: 'When',
    emailWhen: 'Sunday · 14:00–14:45',
    emailMeet: 'Google Meet link included',
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
    intro: 'صفحة مخصّصة يتّفق من خلالها عملاؤك على وقت الاجتماع.',
    tzTitle: 'المنطقة الزمنية',
    firstDayLabel: 'أول أيام الأسبوع',
    tzSearch: 'ابحث عن منطقة زمنية…',
    tzShown: 'الأوقات بتوقيت',
    totalSlots: 'إجمالي المواعيد',
    availability: 'أوقات فراغك',
    tzNote: (tz: string) => `الأوقات بتوقيتك الحالي — ${tz}. تُطابَق الأوقات مع تقويم جوجل بهذا التوقيت؛ ويرى الزوار ويحجزون بتوقيتهم الخاص.`,
    meetingTypes: 'نوع الاجتماع',
    addType: 'أضف نوع اجتماع',
    add: 'أضف',
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
    unverified: 'سيحذّرك جوجل من أن هذا التطبيق لم يُوثَّق بعد — المراجعة ما زالت جارية. اختر «خيارات متقدمة» ثم «متابعة» للمواصلة. نقرأ فقط أوقات انشغالك ونضيف اجتماعاتك المحجوزة.',
    calWarn: 'تقويم Google غير مربوط، لذا لن تحجب مواعيدك الحالية أوقات الحجز ولن تُضاف الحجوزات الجديدة إلى تقويمك. أعد الربط واسمح بالوصول إلى التقويم.',
    reconnectExpired: 'انتهت صلاحية ربط Google أو تم إلغاؤه — لن تعمل صفحة الحجز حتى تعيد الربط.',
    reconnect: 'إعادة ربط التقويم',
    syncConflict: 'تختلف التغييرات على هذا الجهاز عن صفحة الحجز المحفوظة. أي نسخة نُبقي؟',
    keepLocal: 'أبقِ تغييراتي',
    useServer: 'استخدم النسخة المحفوظة',
    saveError: 'تعذّر حفظ تغييراتك على صفحتك المنشورة — لم تُنشر بعد.',
    retry: 'إعادة المحاولة',
    openPage: 'افتح الصفحة',
    unpublish: 'إلغاء النشر',
    deletePage: 'احذف الصفحة',
    deleteTitle: 'حذف صفحة الحجز؟',
    deleteBody: 'يحذف هذا رابط الحجز وكل الحجوزات التي تمّت عبره نهائيًا. لا يمكن التراجع.',
    deleteConfirm: 'احذف الصفحة',
    cancel: 'إلغاء',
    alerts: 'التنبيهات',
    save: 'حفظ التغييرات',
    saving: 'جارٍ الحفظ…',
    saved: 'تم الحفظ ✓',
    saveErr: 'تعذّر الحفظ — حاول مرة أخرى.',
    alertsTitle: 'تنبيهات الحجز',
    alertsNote: 'تصلك تنبيهات لحظة الحجز. ويستلم الحاجز دائمًا تأكيدًا بالبريد.',
    shareDisabled: 'انشر صفحتك أولاً، ثم يمكنك مشاركة الرابط.',
    emailPrev: 'معاينة التنبيه',
    emailNew: 'حجز جديد',
    emailSample: 'سارة أ.',
    emailAddr: 'sara.a@gmail.com',
    emailBooked: 'حجزت',
    emailWhenLabel: 'الوقت',
    emailWhen: 'الأحد · ١٤:٠٠–١٤:٤٥',
    emailMeet: 'يتضمّن رابط Google Meet',
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
  const [session, setSession] = useState<Session | null>(null)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [alertsOpen, setAlertsOpen] = useState(false)
  const [pushDenied, setPushDenied] = useState(false)
  const [tzOpen, setTzOpen] = useState(false)
  const [tzq, setTzq] = useState('')
  const [pubMenu, setPubMenu] = useState(false)
  const [delOpen, setDelOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [tokenStatus, setTokenStatus] = useState<'unknown' | 'ok' | 'nocal' | 'disconnected'>('unknown')
  const [syncState, setSyncState] = useState<'loading' | 'ok' | 'conflict'>('ok')
  const [serverCfg, setServerCfg] = useState<ConfigLike | null>(null)
  const savedSnapshotRef = useRef('')
  const [dragId, setDragId] = useState<string | null>(null)
  const gridApi = useRef<GridHandle>(null)
  const totalSlots = grid.reduce((sum, col) => sum + col.filter(Boolean).length, 0)
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

  // Verify the stored Google token whenever we have a session — is it still
  // connected and does it actually have Calendar access?
  useEffect(() => {
    if (!session) { setTokenStatus('unknown'); return }
    let cancelled = false
    hostStatus(session.hsid)
      .then((r) => { if (!cancelled) setTokenStatus(r.connected ? (r.calendar ? 'ok' : 'nocal') : 'disconnected') })
      .catch(() => { /* leave as unknown on network error */ })
    return () => { cancelled = true }
  }, [session])

  // Persist locally whenever config changes.
  useEffect(() => {
    saveConfig(cfg)
  }, [cfg])

  // On login, compare the local copy against the SAVED backend config. The
  // backend is the source of truth — if the local copy drifts, surface a conflict
  // and let the host choose, rather than silently overwriting a good save.
  useEffect(() => {
    if (!session) { setSyncState('ok'); savedSnapshotRef.current = ''; return }
    let cancelled = false
    setSyncState('loading')
    getConfig(session.hsid)
      .then((r) => {
        if (cancelled) return
        const server = r.config as ConfigLike | null
        const hasServer = !!(server && Array.isArray(server.availability) && (server.availability.length > 0 || server.meeting))
        if (!hasServer) {
          // Nothing meaningful saved yet — adopt local; it'll push on first change.
          savedSnapshotRef.current = ''
          setSyncState('ok')
          return
        }
        const serverSer = serializeCfg(server)
        savedSnapshotRef.current = serverSer // don't auto-push until resolved
        if (serverSer === serializeCfg(cfg)) {
          setSyncState('ok')
        } else {
          setServerCfg(server)
          setSyncState('conflict')
        }
      })
      .catch(() => { if (!cancelled) { savedSnapshotRef.current = serializeCfg(cfg); setSyncState('ok') } })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session])

  // Persist to the backend when logged in, in sync, and the config actually
  // changed from the last successful save (debounced). Save failures surface.
  const pushTimer = useRef<number | null>(null)
  useEffect(() => {
    if (!session || syncState !== 'ok') return
    const cur = serializeCfg(cfg)
    if (cur === savedSnapshotRef.current) return
    if (pushTimer.current) clearTimeout(pushTimer.current)
    const payload = {
      hsid: session.hsid, code: cfg.code, tz: cfg.tz, firstDay: cfg.firstDay,
      pageHeading: cfg.pageHeading, pageText: cfg.pageText, meeting: cfg.meeting,
      meetingTypes: cfg.meetingTypes, availability: cfg.availability, notify: cfg.notify, pushSub: cfg.pushSub,
    }
    pushTimer.current = window.setTimeout(() => {
      setSaveState('saving')
      saveSchedule(payload)
        .then(() => { savedSnapshotRef.current = cur; setSaveState('saved'); setTimeout(() => setSaveState('idle'), 1500) })
        .catch(() => setSaveState('error'))
    }, 700)
    return () => { if (pushTimer.current) clearTimeout(pushTimer.current) }
  }, [cfg, session, syncState])

  // Conflict resolution + manual retry.
  function keepLocal() { setSyncState('ok') } // auto-save then pushes local over the saved copy
  function useServer() {
    if (!serverCfg) return
    const applied: HostConfig = {
      ...cfg,
      tz: serverCfg.tz || cfg.tz,
      firstDay: serverCfg.firstDay ?? cfg.firstDay,
      pageHeading: serverCfg.pageHeading ?? '',
      pageText: serverCfg.pageText ?? '',
      meeting: serverCfg.meeting || cfg.meeting,
      meetingTypes: serverCfg.meetingTypes?.length ? serverCfg.meetingTypes : cfg.meetingTypes,
      availability: serverCfg.availability || [],
      notify: serverCfg.notify ? { push: !!serverCfg.notify.push, telegram: !!serverCfg.notify.telegram, email: !!serverCfg.notify.email } : cfg.notify,
    }
    setCfg(applied)
    setGrid(windowsToGrid(applied.availability))
    savedSnapshotRef.current = serializeCfg(applied)
    setSyncState('ok')
  }
  function retrySave() {
    if (!session) return
    const cur = serializeCfg(cfg)
    setSaveState('saving')
    saveSchedule({
      hsid: session.hsid, code: cfg.code, tz: cfg.tz, firstDay: cfg.firstDay,
      pageHeading: cfg.pageHeading, pageText: cfg.pageText, meeting: cfg.meeting,
      meetingTypes: cfg.meetingTypes, availability: cfg.availability, notify: cfg.notify, pushSub: cfg.pushSub,
    })
      .then(() => { savedSnapshotRef.current = cur; setSaveState('saved'); setTimeout(() => setSaveState('idle'), 1500) })
      .catch(() => setSaveState('error'))
  }

  const link = `${BOOKING_LINK_BASE}/${cfg.code}`

  function updateGrid(next: Grid) {
    setGrid(next)
    setCfg((c) => ({ ...c, availability: gridToWindows(next) }))
  }


  // Meeting types — the primary (first) mirrors into `meeting` for the backend.
  function setTypes(next: MeetingType[]) {
    setCfg((c) => ({ ...c, meetingTypes: next, meeting: { ...c.meeting, minutes: next[0]?.minutes ?? 45, title: next[0]?.name ?? 'Meeting' } }))
  }
  const addType = () => {
    const names = locale === 'ar'
      ? ['اجتماع', 'استشارة', 'مكالمة', 'جلسة', 'مقابلة']
      : ['Meeting', 'Consultation', 'Call', 'Session', 'Interview']
    const name = names[cfg.meetingTypes.length] || names[0]
    setTypes([...cfg.meetingTypes, { id: makeCode(), name, minutes: 30, meet: true }])
  }
  const removeType = (id: string) => { if (cfg.meetingTypes.length > 1) setTypes(cfg.meetingTypes.filter((t) => t.id !== id)) }
  const editType = (id: string, patch: Partial<MeetingType>) => setTypes(cfg.meetingTypes.map((t) => (t.id === id ? { ...t, ...patch } : t)))
  // Pointer-based live reorder (works on touch + desktop; no HTML5 DnD).
  const reorderId = useRef<string | null>(null)
  const startReorder = (e: ReactPointerEvent, id: string) => {
    reorderId.current = id
    setDragId(id)
    ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
  }
  const onReorderMove = (e: ReactPointerEvent) => {
    if (!reorderId.current) return
    const over = (document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null)?.closest('[data-mtid]')?.getAttribute('data-mtid')
    if (!over || over === reorderId.current) return
    const arr = cfg.meetingTypes.slice()
    const from = arr.findIndex((t) => t.id === reorderId.current)
    const to = arr.findIndex((t) => t.id === over)
    if (from < 0 || to < 0 || from === to) return
    const [moved] = arr.splice(from, 1)
    arr.splice(to, 0, moved)
    setTypes(arr)
  }
  const endReorder = (e: ReactPointerEvent) => {
    reorderId.current = null
    setDragId(null)
    ;(e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId)
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
        firstDay: cfg.firstDay,
        pageHeading: cfg.pageHeading,
        pageText: cfg.pageText,
        meeting: cfg.meeting,
        meetingTypes: cfg.meetingTypes,
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
    // Same tab (not a new window); the preview page has an Edit button back here.
    window.location.href = `/${locale}/book/${cfg.code}?preview=1`
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link)
    } catch {
      /* ignore */
    }
  }

  // Open the live booking page (and push any pending edits in the background).
  function openLive() {
    window.open(link, '_blank', 'noopener')
    if (session) publish()
  }
  // Sign out on this device: drop the session AND the locally cached schedule, so
  // the editor resets to a clean slate instead of reloading the previous host's
  // data. (The published page stays live server-side; sign back in to manage it.)
  function unpublish() {
    localStorage.removeItem(HSID_KEY)
    clearConfig()
    setCfg(loadConfig())
    setSession(null)
    setPubMenu(false)
  }
  async function deletePage() {
    if (!session) return
    setDeleting(true)
    try {
      await deleteHost(session.hsid)
      localStorage.removeItem(HSID_KEY)
      clearConfig()
      setCfg(loadConfig())
      setSession(null)
      setDelOpen(false)
    } catch {
      setSaveState('error')
    } finally {
      setDeleting(false)
    }
  }

  const menuItem = 'flex items-center gap-2 w-full text-start px-4 py-2.5 text-[0.9rem] hover:bg-[color-mix(in_srgb,var(--green-400)_10%,transparent)] border-0 bg-transparent cursor-pointer whitespace-nowrap'

  return (
    <Stack data-testid="book-with-me">
      {/* Intro hero — Publish (white) + Preview (text link), inside the box */}
      <div className="mx-[calc(50%-50vw)] w-screen max-w-[100vw] mt-[calc(clamp(1.5rem,4vw,2.5rem)*-1)] bg-green-600 text-sand-100">
        <div className="wrap py-[clamp(1.3rem,4vw,1.8rem)] flex flex-col gap-3 max-w-[44rem]">
          <h1 className="font-display rtl:font-ar text-[clamp(1.4rem,4vw,1.9rem)] font-bold leading-tight" style={{ color: 'var(--sand-100)' }}>{s.heroTitle}</h1>
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span className="text-[0.82rem] font-semibold opacity-90">{s.meetingTypes}</span>
              <button type="button" onClick={addType} data-testid="add-type"
                className="inline-flex items-center gap-1 rounded-full bg-transparent border border-[color-mix(in_srgb,var(--sand-100)_45%,transparent)] text-sand-100 px-2.5 py-[0.15rem] text-[0.75rem] font-semibold cursor-pointer hover:bg-[color-mix(in_srgb,var(--sand-100)_16%,transparent)]">＋ {s.add}</button>
            </div>
            {cfg.meetingTypes.map((t, i) => {
              const many = cfg.meetingTypes.length > 1
              return (
                <div key={t.id} data-mtid={t.id} data-testid={`mtype-${i}`}
                  className={`flex flex-wrap items-center gap-2 rounded transition-opacity ${dragId === t.id ? 'opacity-50' : ''}`}>
                  {many && (
                    <span aria-label="reorder" onPointerDown={(e) => startReorder(e, t.id)} onPointerMove={onReorderMove} onPointerUp={endReorder} onPointerCancel={endReorder}
                      className="self-start mt-2 cursor-grab active:cursor-grabbing text-sand-100/70 hover:text-sand-100 touch-none select-none [&_svg]:size-4">
                      <GripIcon />
                    </span>
                  )}
                  <input value={t.name} onChange={(e) => editType(t.id, { name: e.target.value })} aria-label={s.meetingTypes}
                    className="w-full max-w-[200px] rounded bg-white text-ink px-2.5 h-8 py-0 text-[0.82rem] border-0 outline-none box-border" />
                  <select value={t.minutes} onChange={(e) => editType(t.id, { minutes: Number(e.target.value) })} aria-label={s.length}
                    className="rounded bg-white text-ink px-2 h-8 py-0 text-[0.82rem] border-0 outline-none cursor-pointer box-border">
                    {[15, 30, 45, 60, 90].map((m) => <option key={m} value={m}>{m} {s.min}</option>)}
                  </select>
                  <label className="inline-flex items-center gap-1.5 text-[0.82rem] cursor-pointer"><input type="checkbox" checked={t.meet} onChange={(e) => editType(t.id, { meet: e.target.checked })} /> {s.meet}</label>
                  {many && (
                    <button type="button" aria-label="remove" onClick={() => removeType(t.id)}
                      className="self-start mt-2 ms-auto bg-transparent border-0 cursor-pointer text-sand-100/80 hover:text-sand-100 text-[1.05rem] leading-none px-1">✕</button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Until Google's brand + scope review clears, the consent screen shows an
          "unverified app" interstitial. Warn first so it reads as expected, not
          as something broken. */}
      {!session && (
        <div className="flex items-center gap-3 flex-wrap border-s-[3px] border-gold-500 bg-[color-mix(in_srgb,var(--color-gold-400)_14%,transparent)] ps-3 pe-3 py-2.5 rounded-e-md" data-testid="unverified-warning">
          <span className="text-[0.85rem] text-ink leading-snug flex-1 min-w-[14rem]">{s.unverified}</span>
        </div>
      )}

      {session && (tokenStatus === 'nocal' || tokenStatus === 'disconnected') && (
        <div className="flex items-center gap-3 flex-wrap border-s-[3px] border-gold-500 bg-[color-mix(in_srgb,var(--color-gold-400)_14%,transparent)] ps-3 pe-3 py-2.5 rounded-e-md" data-testid="cal-warning">
          <span className="text-[0.85rem] text-ink leading-snug flex-1 min-w-[14rem]">{tokenStatus === 'disconnected' ? s.reconnectExpired : s.calWarn}</span>
          <button type="button" data-testid="reconnect-cal" onClick={() => { window.location.href = connectGoogleUrl(cfg.code, locale) }}
            className="flex-none inline-flex items-center h-8 px-3 rounded-md bg-gold-500 text-white text-[0.82rem] font-semibold border-0 cursor-pointer hover:bg-gold-400">{s.reconnect}</button>
        </div>
      )}

      {syncState === 'conflict' && (
        <div className="flex items-center gap-3 flex-wrap border-s-[3px] border-gold-500 bg-[color-mix(in_srgb,var(--color-gold-400)_14%,transparent)] ps-3 pe-3 py-2.5 rounded-e-md" data-testid="sync-conflict">
          <span className="text-[0.85rem] text-ink leading-snug flex-1 min-w-[14rem]">{s.syncConflict}</span>
          <button type="button" data-testid="keep-local" onClick={keepLocal}
            className="flex-none inline-flex items-center h-8 px-3 rounded-md bg-green-600 text-sand-100 text-[0.82rem] font-semibold border-0 cursor-pointer hover:bg-green-700">{s.keepLocal}</button>
          <button type="button" data-testid="use-server" onClick={useServer}
            className="flex-none inline-flex items-center h-8 px-3 rounded-md bg-transparent text-ink-soft text-[0.82rem] font-semibold border border-[color:var(--line)] cursor-pointer hover:border-green-500">{s.useServer}</button>
        </div>
      )}

      {session && syncState === 'ok' && saveState === 'error' && (
        <div className="flex items-center gap-3 flex-wrap border-s-[3px] border-gold-500 bg-[color-mix(in_srgb,var(--color-gold-400)_14%,transparent)] ps-3 pe-3 py-2.5 rounded-e-md" data-testid="save-error">
          <span className="text-[0.85rem] text-ink leading-snug flex-1 min-w-[14rem]">{s.saveError}</span>
          <button type="button" data-testid="retry-save" onClick={retrySave}
            className="flex-none inline-flex items-center h-8 px-3 rounded-md bg-gold-500 text-white text-[0.82rem] font-semibold border-0 cursor-pointer hover:bg-gold-400">{s.retry}</button>
        </div>
      )}

      {/* 1 · Availability painter — no well; big heading; timezone pill + modal */}
      <div className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2.5 flex-wrap">
            <div role="heading" aria-level={2} className={H}>{s.availability}</div>
            <Pill className="!py-[0.22rem] !px-[0.7rem] !text-[0.74rem]" onClick={() => gridApi.current?.scrollToFirst()} data-testid="total-slots">{s.totalSlots}: {totalSlots}</Pill>
          </div>
          <Pill className="!py-[0.22rem] !px-[0.7rem] !text-[0.74rem] [&_svg]:size-3.5" onClick={() => setTzOpen(true)} data-testid="tz-pill" title={s.tzNote(tzLabel(cfg.tz))}><GlobeIcon /> {shortTz(cfg.tz)}</Pill>
        </div>
        <AvailabilityGrid ref={gridApi} grid={grid} onChange={updateGrid} locale={locale} firstDay={cfg.firstDay ?? 0} />
      </div>

      {saveState === 'error' && <p className="text-[0.82rem] text-gold-500">{s.saveErr}</p>}

      {/* Sticky publish bar — portaled to <body> so ToolPage's fadeUp transform
          doesn't trap the fixed positioning (that broke sticky on desktop). */}
      {createPortal(
        <div className="fixed inset-x-0 bottom-0 z-40 bg-[var(--surface)] border-t border-[color:var(--line)] shadow-[0_-6px_20px_rgba(20,30,50,0.09)] pb-[env(safe-area-inset-bottom,0px)]">
          <div className="wrap py-2.5 flex items-center gap-2">
            {session ? (
              <>
                <div className="relative flex items-stretch rounded-md shadow-[var(--shadow-sm)]">
                  <Button variant="primary" onClick={openLive} data-testid="open-page" className="!h-9 !py-0 !rounded-e-none !text-[0.9rem] !shadow-none hover:!translate-y-0 hover:!shadow-none">{s.openPage} <ExternalLinkIcon className="w-4 h-4" /></Button>
                  <button type="button" aria-label="menu" aria-expanded={pubMenu} onClick={() => setPubMenu((v) => !v)}
                    className="inline-flex items-center rounded-e-md bg-green-700 text-sand-100 px-2.5 border-0 border-s border-[color:color-mix(in_srgb,var(--sand-100)_30%,transparent)] hover:bg-green-600 cursor-pointer">▾</button>
                  {pubMenu && (
                    <div className="absolute bottom-full start-0 mb-1.5 bg-[var(--surface)] border border-[color:var(--line)] rounded-md shadow-[var(--shadow-md)] overflow-hidden min-w-[11rem]">
                      <button type="button" data-testid="unpublish" onClick={unpublish} className={`${menuItem} text-ink-soft`}>✕ {s.unpublish}</button>
                      <button type="button" data-testid="delete-page" onClick={() => { setPubMenu(false); setDelOpen(true) }} className={`${menuItem} text-gold-500 border-t border-[color:var(--line-soft)]`}>🗑 {s.deletePage}</button>
                    </div>
                  )}
                </div>
                <button type="button" onClick={shareLink} data-testid="share-link" aria-label={s.share} title={s.share}
                  className="inline-flex items-center justify-center size-9 rounded-md border border-[color:var(--line)] bg-[var(--surface)] text-ink-soft cursor-pointer hover:border-green-500 hover:text-green-700 [&_svg]:size-5"><ShareIcon /></button>
              </>
            ) : (
              <>
                <Button variant="primary" onClick={publish} disabled={saveState === 'saving'} data-testid="save-schedule" className="!h-9 !py-0 !text-[0.9rem] hover:!translate-y-0">{saveState === 'saving' ? s.saving : s.publishCta}</Button>
                <Button variant="default" onClick={openPreview} data-testid="preview-link" className="!h-9 !py-0 !text-[0.9rem] hover:!translate-y-0">{s.previewLink}</Button>
              </>
            )}
            <Pill className="ms-auto inline-flex items-center !h-9 !py-0 !text-[0.9rem] [&_svg]:size-4" data-testid="alerts-pill" onClick={() => setAlertsOpen(true)}><BellIcon /> {s.alerts}</Pill>
          </div>
        </div>,
        document.body,
      )}

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

            {/* Mirrors the real host alert (push / Telegram / email) sent on a booking. */}
            {(() => {
              const type = cfg.meetingTypes[0]?.name || 'Meeting'
              const bookedLine = locale === 'ar'
                ? `${s.emailBooked} ${s.emailSample} (${s.emailAddr}) — ${type}`
                : `${s.emailSample} (${s.emailAddr}) ${s.emailBooked} ${type}.`
              return (
                <div className="rounded-md border border-[color:var(--line)] overflow-hidden">
                  <div className="bg-[color-mix(in_srgb,var(--green-400)_10%,transparent)] px-3 py-1.5 text-[0.68rem] font-semibold uppercase tracking-[0.1em] text-ink-faint border-b border-[color:var(--line-soft)]">{s.emailPrev}</div>
                  <div className="p-3 flex flex-col gap-1.5">
                    <span className="font-display rtl:font-ar text-[1.05rem] text-green-700">{s.emailNew}: {type} — {s.emailSample}</span>
                    <span className="text-[0.9rem] text-ink">{bookedLine}</span>
                    <span className="text-[0.85rem] text-ink-soft"><strong>{s.emailWhenLabel}:</strong> {s.emailWhen}</span>
                    {cfg.meetingTypes[0]?.meet && <span className="text-[0.78rem] text-ink-faint">{s.emailMeet}</span>}
                  </div>
                </div>
              )
            })()}
          </Stack>
          <SheetActions>
            <Button variant="primary" onClick={() => setAlertsOpen(false)}>{s.done}</Button>
          </SheetActions>
        </Sheet>
      )}

      {tzOpen && (
        <Sheet data-testid="tz-sheet" onClose={() => { setTzOpen(false); setTzq('') }}>
          <SheetTitle>{s.tzTitle}</SheetTitle>
          <label className="flex flex-col gap-1 mb-3">
            <span className="text-[0.82rem] font-semibold text-ink-soft">{s.firstDayLabel}</span>
            <select value={cfg.firstDay ?? 0} onChange={(e) => setCfg((c) => ({ ...c, firstDay: Number(e.target.value) }))} data-testid="first-day"
              className="rounded-md border border-[color:var(--line)] bg-[var(--surface)] text-ink px-3 py-2 text-[0.9rem] cursor-pointer">
              {(locale === 'ar' ? ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'] : ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']).map((name, d) => <option key={d} value={d}>{name}</option>)}
            </select>
          </label>
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

      {delOpen && (
        <Sheet data-testid="delete-sheet" onClose={() => setDelOpen(false)}>
          <SheetTitle>{s.deleteTitle}</SheetTitle>
          <p className="text-[0.9rem] text-ink-soft leading-relaxed">{s.deleteBody}</p>
          <SheetActions>
            <Button onClick={() => setDelOpen(false)}>{s.cancel}</Button>
            <Button variant="primary" data-testid="delete-confirm" disabled={deleting} onClick={deletePage} className="!bg-gold-500 !border-gold-500 hover:!bg-gold-400">{deleting ? '…' : s.deleteConfirm}</Button>
          </SheetActions>
        </Sheet>
      )}
    </Stack>
  )
}
