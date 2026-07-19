import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Spinner } from '../components/ui'
import { PhoneIcon } from '../components/icons'
import { ringCallLink } from '../lib/callLink'
import { code6, HOST_KEY, NAME_KEY } from '../tools/calls/helpers'

// built-in-saudi.com/call/<code> — the public page a caller opens to ring the
// link's owner. A bare, chrome-free page (top-level route, outside the localized
// Layout). Pressing Call spins up a FRESH room, pushes a ring to the owner, then
// drops the caller into that room as the host (auto-admitting whoever answers).
const T = {
  en: {
    title: 'Start a call', blurb: 'Call the person who shared this link. They’ll get a notification to answer — this stays a private, browser-to-browser call.',
    yourName: 'Your name', call: 'Call', calling: 'Calling…',
    noCode: 'This call link is invalid.', home: 'Go to Built in Saudi',
  },
  ar: {
    title: 'ابدأ مكالمة', blurb: 'اتصل بمن شارك هذا الرابط. سيصله إشعار للرد — تبقى المكالمة خاصة ومباشرة بين المتصفحين.',
    yourName: 'اسمك', call: 'اتصال', calling: 'جارٍ الاتصال…',
    noCode: 'رابط المكالمة غير صالح.', home: 'اذهب إلى Built in Saudi',
  },
}

function pickLocale(): 'en' | 'ar' {
  try { const l = localStorage.getItem('bis-locale'); if (l === 'ar' || l === 'en') return l } catch { /* */ }
  return (navigator.language || '').toLowerCase().startsWith('ar') ? 'ar' : 'en'
}

export function CallLinkPage() {
  const { code } = useParams()
  const navigate = useNavigate()
  const locale = pickLocale()
  const t = T[locale]
  const stored = (() => { try { return localStorage.getItem(NAME_KEY) || '' } catch { return '' } })()
  const [name, setName] = useState(stored)
  const [calling, setCalling] = useState(false)
  document.title = `${t.title} — Built in Saudi`

  async function call() {
    if (!code || calling) return
    setCalling(true)
    const room = code6()
    // Mark this browser as the room's host so the Calls tool resumes as host (not a
    // guest) — the caller runs the meeting and auto-admits whoever answers the ring.
    try { localStorage.setItem(HOST_KEY, room) } catch { /* */ }
    await ringCallLink(code, room, name.trim() || 'Someone')
    navigate(`/${locale}/apps/calls/join?code=${room}&autoadmit=1`)
  }

  return (
    <div className="min-h-[100dvh] grid place-items-center bg-[var(--sand-50)] px-6" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      {!code ? (
        <div className="flex flex-col items-center gap-3 max-w-[28rem] text-center">
          <h1 className="font-display text-[1.4rem] text-ink">{t.noCode}</h1>
          <a href="https://built-in-saudi.com" className="mt-1 inline-flex items-center h-9 px-4 rounded-md bg-green-600 text-sand-100 text-[0.9rem] font-semibold no-underline hover:bg-green-700">{t.home}</a>
        </div>
      ) : (
        <div className="w-full max-w-[22rem] flex flex-col items-center gap-5 text-center">
          <span className="grid place-items-center w-14 h-14 rounded-full bg-green-600 text-sand-100 [&_svg]:w-6 [&_svg]:h-6"><PhoneIcon /></span>
          <div className="flex flex-col gap-2">
            <h1 className="font-display text-[1.5rem] text-ink">{t.title}</h1>
            <p className="text-[0.92rem] leading-relaxed text-ink-soft">{t.blurb}</p>
          </div>
          <label className="w-full flex flex-col gap-1 text-start">
            <span className="text-[0.8rem] font-medium text-ink-soft ps-0.5">{t.yourName}:</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t.yourName} aria-label={t.yourName} data-testid="call-link-name"
              className="h-12 rounded-md border border-[color:var(--line)] bg-[var(--surface)] px-3 text-[1rem] text-ink outline-none focus:border-green-500" />
          </label>
          <button type="button" onClick={call} disabled={calling} data-testid="call-link-call"
            className="w-full h-12 rounded-md bg-green-600 text-sand-100 font-semibold text-[1rem] flex items-center justify-center gap-2 hover:bg-green-700 border-0 cursor-pointer disabled:opacity-70 [&_svg]:w-5 [&_svg]:h-5">
            {calling ? <><Spinner className="size-5" /> {t.calling}</> : <><PhoneIcon /> {t.call}</>}
          </button>
        </div>
      )}
    </div>
  )
}
