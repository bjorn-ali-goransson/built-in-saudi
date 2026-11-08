import type { ReactNode } from 'react'
import { Sheet, SheetActions, SheetTitle } from '../../components/ui'
import { inAppBrowser } from '../../lib/inAppBrowser'
import type { Locale } from '../../i18n'

// How to lift iPhone Lockdown Mode for this one site, step by step, each step
// with a picture of what the phone shows. The pictures are drawn (not photos):
// they take the real host name, follow both themes, and stay correct in both
// languages. The words are Apple's own (support.apple.com/105120, en + ar-sa):
// "Page Menu button" → "Website Settings…" → turn off "Lockdown Mode".
// Lockdown Mode stays on everywhere else; only this site is excluded.

const T = {
  en: {
    title: 'Turn on calls for this site',
    intro: 'Lockdown Mode is on, and it turns calls off. You can keep it on and switch it off for this site only:',
    steps: [
      { h: 'Tap the Page Menu button', p: 'It’s in the address bar, next to the address. Under the bar Safari says “Lockdown Enabled”.' },
      { h: 'Choose “Website Settings…”', p: 'Scroll down the menu if you don’t see it.' },
      { h: 'Turn off “Lockdown Mode”', p: 'The switch turns grey. This affects this site only.' },
      { h: 'Reload the page', p: 'Then open the call link again.' },
    ],
    inApp: (app: string) => `You’re inside ${app}. Open this link in Safari first — these settings are only in Safari.`,
    reload: 'Reload', close: 'Close',
    menu: 'Website Settings…', lockdown: 'Lockdown Mode', enabled: 'Lockdown Enabled',
  },
  ar: {
    title: 'شغّل المكالمات لهذا الموقع',
    intro: '«وضع التأمين» مفعّل، وهو يعطّل المكالمات. يمكنك إبقاؤه مفعّلًا وإيقافه لهذا الموقع فقط:',
    steps: [
      { h: 'اضغط «زر قائمة الصفحة»', p: 'في شريط العنوان بجانب العنوان. تحت الشريط يظهر أن وضع التأمين مفعّل.' },
      { h: 'اختر «إعدادات موقع الويب»', p: 'مرِّر القائمة لأسفل إن لم تجده.' },
      { h: 'أوقف «وضع التأمين»', p: 'يصبح المفتاح رماديًا. هذا لهذا الموقع فقط.' },
      { h: 'أعد تحميل الصفحة', p: 'ثم افتح رابط المكالمة من جديد.' },
    ],
    inApp: (app: string) => `أنت داخل ${app}. افتح الرابط في سفاري أولًا — هذه الإعدادات موجودة في سفاري فقط.`,
    reload: 'إعادة التحميل', close: 'إغلاق',
    menu: 'إعدادات موقع الويب', lockdown: 'وضع التأمين', enabled: '',
  },
}

const HL = 'var(--gold-500)' // the thing to tap
const LINE = 'color-mix(in srgb, var(--ink) 18%, transparent)'
const FAINT = 'color-mix(in srgb, var(--ink) 10%, transparent)'

// The page-menu glyph from Safari's address bar (a page with lines under it).
function MenuGlyph({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`} fill="none" stroke="var(--ink)" strokeWidth="2" strokeLinecap="round">
      <rect x="-9" y="-10" width="18" height="11" rx="2.5" />
      <path d="M-9 5 H9 M-9 9.5 H9" />
    </g>
  )
}

// Safari's reload arrow, centred on (x, y).
function Reload({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x - 9} ${y - 9}) scale(0.75)`} fill="none" stroke="var(--ink)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" /><path d="M21 3v5h-5" />
    </g>
  )
}

function Frame({ children, label }: { children: ReactNode; label: string }) {
  return (
    <svg viewBox="0 0 320 120" role="img" aria-label={label} direction="ltr"
      className="w-full h-auto rounded-md border border-[color:var(--line-soft)] bg-[color-mix(in_srgb,var(--sand-100)_45%,var(--surface))]">
      {children}
    </svg>
  )
}

function StepAddress({ host, enabled, label }: { host: string; enabled: string; label: string }) {
  return (
    <Frame label={label}>
      <rect x="16" y="22" width="288" height="44" rx="22" fill="var(--surface)" stroke={LINE} />
      {/* reload */}
      <Reload x={46} y={44} />
      <text x="160" y="49.5" textAnchor="middle" fontSize="15" fill="var(--ink)" fontFamily="system-ui, -apple-system, sans-serif">{host}</text>
      <circle cx="274" cy="44" r="17" fill="none" stroke={HL} strokeWidth="3" />
      <MenuGlyph x={274} y={45} />
      {enabled && <text x="160" y="90" textAnchor="middle" fontSize="12" fill="color-mix(in srgb, var(--ink) 55%, transparent)" fontFamily="system-ui, -apple-system, sans-serif">{enabled}</text>}
      {/* a finger tap */}
      <circle cx="286" cy="58" r="6" fill={HL} opacity="0.35" />
    </Frame>
  )
}

function StepMenu({ text, label }: { text: string; label: string }) {
  return (
    <Frame label={label}>
      <rect x="60" y="8" width="200" height="104" rx="14" fill="var(--surface)" stroke={LINE} />
      {[22, 44].map((y) => <g key={y}><rect x="76" y={y} width="16" height="12" rx="3" fill={FAINT} /><rect x="100" y={y + 2} width={y === 22 ? 110 : 84} height="8" rx="4" fill={FAINT} /></g>)}
      <rect x="66" y="64" width="188" height="30" rx="8" fill="color-mix(in srgb, var(--gold-500) 14%, transparent)" stroke={HL} strokeWidth="2" />
      {/* gear */}
      <g transform="translate(84 79)" fill="none" stroke="var(--ink)" strokeWidth="1.8">
        <circle r="3" /><circle r="6.5" strokeDasharray="3 2.1" />
      </g>
      <text x="100" y="83.5" fontSize="13.5" fill="var(--ink)" fontFamily="system-ui, -apple-system, sans-serif">{text}</text>
      <rect x="76" y="100" width="16" height="8" rx="3" fill={FAINT} /><rect x="100" y="100" width="70" height="8" rx="4" fill={FAINT} />
    </Frame>
  )
}

function StepToggle({ text, label }: { text: string; label: string }) {
  return (
    <Frame label={label}>
      <rect x="20" y="34" width="280" height="52" rx="12" fill="var(--surface)" stroke={LINE} />
      <text x="38" y="64.5" fontSize="14.5" fill="var(--ink)" fontFamily="system-ui, -apple-system, sans-serif">{text}</text>
      {/* on → off: the switch as it is now, and as it should be */}
      <rect x="196" y="47" width="40" height="25" rx="12.5" fill="#34c759" opacity="0.45" />
      <circle cx="223.5" cy="59.5" r="10.5" fill="#fff" opacity="0.8" />
      <path d="M242 59.5 h10 m-4 -4 l4 4 l-4 4" fill="none" stroke="var(--ink)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="256" y="47" width="40" height="25" rx="12.5" fill="#d1d1d6" stroke={HL} strokeWidth="2.5" />
      <circle cx="268.5" cy="59.5" r="10.5" fill="#fff" />
    </Frame>
  )
}

function StepReload({ label }: { label: string }) {
  return (
    <Frame label={label}>
      <rect x="16" y="38" width="288" height="44" rx="22" fill="var(--surface)" stroke={LINE} />
      <circle cx="46" cy="60" r="17" fill="none" stroke={HL} strokeWidth="3" />
      <Reload x={46} y={60} />
      <rect x="110" y="56" width="100" height="8" rx="4" fill={FAINT} />
    </Frame>
  )
}

export function LockdownHelp({ locale, onClose }: { locale: Locale; onClose: () => void }) {
  const t = T[locale === 'ar' ? 'ar' : 'en']
  const host = typeof window !== 'undefined' ? window.location.host : ''
  const app = inAppBrowser()
  const pics = [
    <StepAddress key="a" host={host} enabled={t.enabled} label={t.steps[0].h} />,
    <StepMenu key="m" text={t.menu} label={t.steps[1].h} />,
    <StepToggle key="t" text={t.lockdown} label={t.steps[2].h} />,
    <StepReload key="r" label={t.steps[3].h} />,
  ]
  return (
    <Sheet onClose={onClose} data-testid="lockdown-help">
      <SheetTitle>{t.title}</SheetTitle>
      {app && <p role="note" data-testid="lockdown-inapp" className="border-s-[3px] border-[color:var(--gold-500)] bg-[color-mix(in_srgb,var(--gold-400)_12%,transparent)] ps-3 pe-3 py-2.5 rounded-e-md text-[0.88rem] text-ink">{t.inApp(app)}</p>}
      <p className="text-[0.92rem] text-ink-soft leading-relaxed">{t.intro}</p>
      <ol className="flex flex-col gap-4 m-0 p-0 list-none">
        {t.steps.map((st, i) => (
          <li key={i} className="flex flex-col gap-2" data-testid="lockdown-step">
            <div className="flex items-baseline gap-2">
              <span className="flex-none grid place-items-center size-6 rounded-full bg-[var(--green-600)] text-[var(--paper)] text-[0.8rem] font-semibold">{(i + 1).toLocaleString(locale === 'ar' ? 'ar-SA' : 'en')}</span>
              <div>
                <p className="font-semibold text-ink text-[0.95rem] m-0">{st.h}</p>
                <p className="text-ink-soft text-[0.85rem] m-0 leading-snug">{st.p}</p>
              </div>
            </div>
            {pics[i]}
          </li>
        ))}
      </ol>
      <SheetActions>
        <button type="button" onClick={onClose} className="h-11 rounded-md border border-[color:var(--line)] bg-transparent text-ink font-semibold cursor-pointer">{t.close}</button>
        <button type="button" onClick={() => window.location.reload()} data-testid="lockdown-reload" className="h-11 rounded-md border-0 bg-[var(--green-600)] text-[var(--paper)] font-semibold cursor-pointer">{t.reload}</button>
      </SheetActions>
    </Sheet>
  )
}
