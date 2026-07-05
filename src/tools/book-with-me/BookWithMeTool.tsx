import { useEffect, useMemo, useState } from 'react'
import { useLocale } from '../../i18n'
import { CopyIcon } from '../../components/icons'
import { Button, Input, Field, Stack, Seg, SegButton, Panel, Check } from '../../components/ui'
import { AvailabilityGrid } from './AvailabilityGrid'
import { connectGoogleUrl, saveSchedule } from '../../lib/bookingApi'
import {
  loadConfig,
  saveConfig,
  gridToWindows,
  windowsToGrid,
  BOOKING_LINK_BASE,
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
    intro: 'Set when you’re free, share one link, let people self-book. Your schedule is saved on this device.',
    availability: 'Your weekly availability',
    meeting: 'Meeting settings',
    length: 'Length',
    min: 'min',
    gap: 'Gap between meetings',
    notice: 'Minimum notice',
    hours: 'hours',
    horizon: 'Bookable up to',
    days: 'days ahead',
    title: 'Meeting title',
    titlePh: 'Intro call',
    location: 'Location / link',
    locationPh: 'Google Meet, phone, address…',
    share: 'Your booking link',
    shareNote: 'Goes live once publishing is enabled. Anyone with the link can pick an open slot — no account needed.',
    copy: 'Copy link',
    copied: 'Copied!',
    notify: 'Notify me when someone books',
    push: 'Push to this device',
    telegram: 'Telegram DM',
    email: 'Email',
    notifyNote: 'Push and Telegram activate after the backend deploy; email confirmations are on by default.',
    soon: 'Availability & settings save on this device until you publish.',
    publish: 'Publish & connect Google Calendar',
    publishNote: 'Connect once to sign in, check your real calendar for conflicts, and auto-add booked meetings. Your link goes live immediately.',
    connectedAs: (who: string) => `Connected as ${who}`,
    published: 'Published',
    save: 'Save changes',
    saving: 'Saving…',
    saved: 'Saved ✓',
    saveErr: 'Couldn’t save — try again.',
  },
  ar: {
    intro: 'حدِّد أوقات فراغك، وشارك رابطًا واحدًا، ودَع الناس يحجزون بأنفسهم. جدولك محفوظ على هذا الجهاز.',
    availability: 'أوقات فراغك الأسبوعية',
    meeting: 'إعدادات الاجتماع',
    length: 'المدة',
    min: 'دقيقة',
    gap: 'فاصل بين الاجتماعات',
    notice: 'أقل مهلة للحجز',
    hours: 'ساعات',
    horizon: 'الحجز حتى',
    days: 'يومًا مقدمًا',
    title: 'عنوان الاجتماع',
    titlePh: 'مكالمة تعارف',
    location: 'المكان / الرابط',
    locationPh: 'Google Meet، هاتف، عنوان…',
    share: 'رابط الحجز الخاص بك',
    shareNote: 'يعمل بعد تفعيل النشر. أي شخص لديه الرابط يختار وقتًا متاحًا — دون حساب.',
    copy: 'نسخ الرابط',
    copied: 'تم النسخ!',
    notify: 'نبّهني عند الحجز',
    push: 'إشعار لهذا الجهاز',
    telegram: 'رسالة تيليجرام',
    email: 'بريد إلكتروني',
    notifyNote: 'الإشعارات وتيليجرام تُفعَّل بعد نشر الخادم؛ تأكيدات البريد مفعّلة افتراضيًا.',
    soon: 'تُحفظ الأوقات والإعدادات على هذا الجهاز حتى تنشرها.',
    publish: 'انشر واربط تقويم جوجل',
    publishNote: 'اربط مرة واحدة لتسجيل الدخول، والتحقق من تعارضات تقويمك الحقيقي، وإضافة الاجتماعات المحجوزة تلقائيًا. يعمل رابطك فورًا.',
    connectedAs: (who: string) => `متصل باسم ${who}`,
    published: 'منشور',
    save: 'حفظ التغييرات',
    saving: 'جارٍ الحفظ…',
    saved: 'تم الحفظ ✓',
    saveErr: 'تعذّر الحفظ — حاول مرة أخرى.',
  },
}

const LENGTHS = [15, 30, 45, 60]

export default function BookWithMeTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const [cfg, setCfg] = useState<HostConfig>(() => loadConfig())
  const [grid, setGrid] = useState<Grid>(() => windowsToGrid(cfg.availability))
  const [copied, setCopied] = useState(false)
  const [session, setSession] = useState<Session | null>(null)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

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
      })
      setSaveState('saved')
      setTimeout(() => setSaveState('idle'), 2000)
    } catch {
      setSaveState('error')
    }
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
      <p className="text-[0.95rem] text-ink-soft">{s.intro}</p>

      {/* Publish / connect Google */}
      <Panel>
        {session ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-col gap-0.5">
              <span className="inline-flex items-center gap-2 text-[0.9rem] font-semibold text-green-700">
                <span className="size-2 rounded-full bg-green-600" /> {s.published}
              </span>
              <span className="text-[0.82rem] text-ink-faint">{s.connectedAs(session.email || session.name || '')}</span>
            </div>
            <div className="flex items-center gap-2">
              {saveState === 'error' && <span className="text-[0.82rem] text-gold-500">{s.saveErr}</span>}
              <Button variant="primary" onClick={publish} disabled={saveState === 'saving'} data-testid="save-schedule">
                {saveState === 'saving' ? s.saving : saveState === 'saved' ? s.saved : s.save}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <Button variant="primary" className="self-start" onClick={publish} data-testid="connect-google">
              {s.publish}
            </Button>
            <p className="text-[0.82rem] text-ink-faint">{s.publishNote}</p>
          </div>
        )}
      </Panel>

      {/* Availability painter — the centerpiece */}
      <Panel>
        <span className="text-[0.82rem] font-semibold text-ink-soft tracking-[0.01em]">{s.availability}</span>
        <AvailabilityGrid grid={grid} onChange={updateGrid} locale={locale} />
      </Panel>

      {/* Meeting settings */}
      <Panel>
        <span className="text-[0.82rem] font-semibold text-ink-soft tracking-[0.01em]">{s.meeting}</span>

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
            <Input value={cfg.meeting.title} placeholder={s.titlePh}
              onChange={(e) => setMeeting('title', e.target.value)} />
          </Field>
          <Field label={s.location}>
            <Input value={cfg.meeting.location} placeholder={s.locationPh}
              onChange={(e) => setMeeting('location', e.target.value)} />
          </Field>
        </div>
      </Panel>

      {/* Share link */}
      <Panel>
        <span className="text-[0.82rem] font-semibold text-ink-soft tracking-[0.01em]">{s.share}</span>
        <div className="flex flex-wrap gap-2">
          <Input className="font-mono grow min-w-0 text-[0.85rem]" readOnly value={link}
            data-testid="booking-link" onFocus={(e) => e.currentTarget.select()} />
          <Button variant="primary" onClick={copyLink} data-testid="copy-link">
            <CopyIcon /> {copied ? s.copied : s.copy}
          </Button>
        </div>
        <p className="text-[0.82rem] text-ink-faint">{s.shareNote}</p>
      </Panel>

      {/* Notifications */}
      <Panel>
        <span className="text-[0.82rem] font-semibold text-ink-soft tracking-[0.01em]">{s.notify}</span>
        <div className="flex flex-col gap-2">
          <Check>
            <input type="checkbox" checked={cfg.notify.push}
              onChange={(e) => setCfg((c) => ({ ...c, notify: { ...c.notify, push: e.target.checked } }))} />
            {s.push}
          </Check>
          <Check>
            <input type="checkbox" checked={cfg.notify.telegram}
              onChange={(e) => setCfg((c) => ({ ...c, notify: { ...c.notify, telegram: e.target.checked } }))} />
            {s.telegram}
          </Check>
          <Check>
            <input type="checkbox" checked={cfg.notify.email}
              onChange={(e) => setCfg((c) => ({ ...c, notify: { ...c.notify, email: e.target.checked } }))} />
            {s.email}
          </Check>
        </div>
        <p className="text-[0.82rem] text-ink-faint">{s.notifyNote}</p>
      </Panel>

      <p className="text-[0.82rem] text-ink-faint">{s.soon}</p>
    </Stack>
  )
}
