import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Spinner } from '../components/ui'
import { EndCallIcon, PhoneIcon, RefreshIcon, LockIcon } from '../components/icons'
import { ringCallLink } from '../lib/callLink'
import { code6, NAME_KEY, randName, isDefaultName } from '../tools/calls/helpers'

// built-in-saudi.com/call/<code> — the public page a caller opens to ring the
// link's owner. A bare, chrome-free page (top-level route, outside the localized
// Layout) that mirrors the Calls start screen (green, random name suggestion, no
// invite/share). Pressing Call spins up a FRESH room, pushes a ring to the owner,
// then knocks into that room as a guest — the visitor WAITS until the owner admits.
const T = {
  en: {
    title: 'Start a call', blurb: 'Call the person who shared this link. They’ll get a notification to answer — this stays a private, browser-to-browser call.',
    yourName: 'Your name', call: 'Call', calling: 'Calling…', shuffle: 'Random name',
    privacy: 'Private and peer-to-peer — only the connection handshake uses our server.',
    noCode: 'This call link is invalid.', home: 'Go to Built in Saudi',
  },
  ar: {
    title: 'ابدأ مكالمة', blurb: 'اتصل بمن شارك هذا الرابط. سيصله إشعار للرد — تبقى المكالمة خاصة ومباشرة بين المتصفحين.',
    yourName: 'اسمك', call: 'اتصال', calling: 'جارٍ الاتصال…', shuffle: 'اسم عشوائي',
    privacy: 'خاصة ومباشرة بين الأجهزة — فقط مصافحة الاتصال تستخدم خادمنا.',
    noCode: 'رابط المكالمة غير صالح.', home: 'اذهب إلى Built in Saudi',
  },
}

function pickLocale(): 'en' | 'ar' {
  try { const l = localStorage.getItem('bis-locale'); if (l === 'ar' || l === 'en') return l } catch { /* */ }
  return (navigator.language || '').toLowerCase().startsWith('ar') ? 'ar' : 'en'
}

const cream = 'w-full h-12 rounded-md bg-sand-100 text-green-700 font-semibold text-[0.95rem] flex items-center justify-center gap-2 hover:bg-white disabled:opacity-60 disabled:hover:bg-sand-100 border-0 cursor-pointer transition-colors [&_svg]:w-5 [&_svg]:h-5'

export function CallLinkPage() {
  // Primary form is /call/?c=<code> (prerendered preview); /call/<code> path still
  // works for any older links.
  const { code: pathCode } = useParams()
  const code = pathCode || (() => { try { return new URLSearchParams(window.location.search).get('c') || '' } catch { return '' } })()
  const navigate = useNavigate()
  const locale = pickLocale()
  const t = T[locale]
  const stored = (() => { try { const st = localStorage.getItem(NAME_KEY); return st && !isDefaultName(st) ? st : '' } catch { return '' } })()
  const [name, setName] = useState(() => stored || randName(locale === 'ar'))
  const [calling, setCalling] = useState(false)
  const nameCustom = name.trim() !== '' && !isDefaultName(name)
  document.title = `${t.title} — Built in Saudi`

  async function call() {
    if (!code || calling) return
    setCalling(true)
    const room = code6()
    // Carry the visitor's name to the Calls tool (via sessionStorage, not the URL)
    // so it knocks without asking again. The visitor is a GUEST who waits in the
    // lobby; the ring wakes the link owner, who hosts this room and admits them.
    try { sessionStorage.setItem('bis-call-guest-name', name.trim()) } catch { /* */ }
    try { sessionStorage.setItem('bis-call-ring-code', code) } catch { /* */ } // so Rejoin can re-ring the owner
    await ringCallLink(code, room, name.trim() || 'Someone')
    navigate(`/${locale}/apps/calls?code=${room}&knock=1`)
  }

  if (!code) {
    return (
      <div className="min-h-[100dvh] bg-green-700 text-sand-100 grid place-items-center px-6" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
        <div className="flex flex-col items-center gap-3 max-w-[24rem] text-center">
          <EndCallIcon className="w-16 h-16 text-green-500" />
          <h1 className="font-display text-[1.4rem]">{t.noCode}</h1>
          <a href="https://built-in-saudi.com" className="mt-1 inline-flex items-center h-10 px-4 rounded-md bg-sand-100 text-green-700 text-[0.9rem] font-semibold no-underline hover:bg-white">{t.home}</a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-[100dvh] bg-green-700 text-sand-100 flex flex-col items-center justify-center px-6 py-14" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      <div className="w-full max-w-[22rem] flex flex-col items-center gap-5">
        <EndCallIcon className="w-24 h-24 text-green-500 shrink-0" />
        <div className="flex flex-col gap-2 text-center">
          <h1 className="font-display text-[1.5rem]">{t.title}</h1>
          <p className="text-[0.92rem] leading-relaxed text-sand-100/85">{t.blurb}</p>
        </div>
        <div className="w-full flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-[0.8rem] font-medium text-sand-100/80 ps-0.5">{t.yourName}:</span>
            <div className="relative">
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t.yourName} aria-label={t.yourName} data-testid="call-link-name"
                className="w-full h-12 rounded-md border border-sand-100/25 bg-white/10 px-3 pe-11 text-[1rem] text-sand-100 placeholder:text-sand-100/50 outline-none focus:border-sand-100/50" />
              {!nameCustom && (
                <button type="button" onClick={() => setName(randName(locale === 'ar'))} title={t.shuffle} aria-label={t.shuffle} data-testid="call-link-shuffle"
                  className="absolute inset-y-0 end-1.5 my-auto h-8 w-8 grid place-items-center rounded-md bg-transparent border-0 text-sand-100/70 hover:text-sand-100 hover:bg-white/10 cursor-pointer">
                  <RefreshIcon className="w-4 h-4" />
                </button>
              )}
            </div>
          </label>
          <button type="button" className={cream} onClick={call} disabled={calling} data-testid="call-link-call">
            {calling ? <><Spinner className="size-5" /> {t.calling}</> : <><PhoneIcon /> {t.call}</>}
          </button>
        </div>
        <p className="text-[0.78rem] text-sand-100/70 flex items-start gap-1.5"><LockIcon className="w-3.5 h-3.5 mt-0.5 shrink-0" /> <span>{t.privacy}</span></p>
      </div>
    </div>
  )
}
