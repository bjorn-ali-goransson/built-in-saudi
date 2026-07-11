import { Suspense, useEffect, useState, useSyncExternalStore } from 'react'
import { Navigate, Outlet, ScrollRestoration, useLocation, useParams } from 'react-router-dom'
import { hideFooterStore } from '../lib/hideFooter'
import {
  isLocale, LocaleProvider, detectLocale, getStoredLocale, dicts, type Locale,
} from '../i18n'
import { Header } from './Header'
import { Footer } from './Footer'
import { LanguageSuggestion } from './LanguageSuggestion'
import { NotificationBell } from './NotificationBell'
import { Spinner } from './ui'
import { UpdatedToast } from './UpdatedToast'
import { useVersionCheck } from '../lib/useVersionCheck'
import { clearStaleNotifications } from '../lib/push'

export function Layout() {
  const { lang } = useParams()
  const location = useLocation()

  // Unknown / missing locale → prepend the visitor's locale to the full path.
  if (!isLocale(lang)) {
    const target = getStoredLocale() ?? detectLocale()
    return <Navigate to={`/${target}${location.pathname}`} replace />
  }
  return <LocalizedLayout locale={lang} />
}

function LocalizedLayout({ locale }: { locale: Locale }) {
  const t = dicts[locale]
  const hideFooter = useSyncExternalStore(hideFooterStore.subscribe, hideFooterStore.get, hideFooterStore.get)
  useVersionCheck()

  useEffect(() => {
    document.documentElement.lang = locale
    document.documentElement.dir = t.dir
  }, [locale, t.dir])

  // Mop up stale prayer/adhkār notifications whenever the app is opened/refocused.
  useEffect(() => {
    const run = () => { if (!document.hidden) clearStaleNotifications() }
    run()
    document.addEventListener('visibilitychange', run)
    return () => document.removeEventListener('visibilitychange', run)
  }, [])

  // #debug — outline every box + an on-screen badge with overflow diagnostics
  // (which element is widest/tallest), so it's readable on mobile even if the
  // page has zoomed out to fit an over-wide element.
  const [debug, setDebug] = useState(false)
  const [dbg, setDbg] = useState({ text: '', font: 13 })
  useEffect(() => {
    const sync = () => setDebug(window.location.hash.toLowerCase().includes('debug'))
    sync()
    window.addEventListener('hashchange', sync)
    return () => window.removeEventListener('hashchange', sync)
  }, [])
  useEffect(() => {
    if (!debug) return
    document.documentElement.setAttribute('data-debug', '')
    const label = (el: Element | null) =>
      el ? `${(el as HTMLElement).tagName}.${((el as HTMLElement).getAttribute('class') || '(none)').split(/\s+/).slice(0, 3).join('.')}`.slice(0, 46) : '—'
    const tick = () => {
      const de = document.documentElement
      let wideEl: Element | null = null, wMax = 0, tallEl: Element | null = null, hMax = 0
      document.querySelectorAll('body *').forEach((el) => {
        const r = (el as HTMLElement).getBoundingClientRect()
        if (r.width > wMax && r.width < 1e5) { wMax = r.width; wideEl = el }
        if (r.height > hMax && r.height < 1e5) { hMax = r.height; tallEl = el }
      })
      document.querySelectorAll('[data-debug-wide]').forEach((el) => el.removeAttribute('data-debug-wide'))
      if (wideEl) (wideEl as HTMLElement).setAttribute('data-debug-wide', '')
      const vv = window.visualViewport
      setDbg({
        font: Math.min(48, Math.round(13 / (vv?.scale || 1))),
        text: [
          `scale ${(vv?.scale ?? 1).toFixed(2)}  vw ${window.innerWidth}  scrollW ${de.scrollWidth}  Δ${de.scrollWidth - window.innerWidth}`,
          `vh ${window.innerHeight}  scrollH ${de.scrollHeight}  Δ${de.scrollHeight - window.innerHeight}`,
          `WIDEST ${Math.round(wMax)}px  ${label(wideEl)}`,
          `tallest ${Math.round(hMax)}px  ${label(tallEl)}`,
        ].join('\n'),
      })
    }
    tick()
    const id = window.setInterval(tick, 500)
    return () => {
      window.clearInterval(id)
      document.documentElement.removeAttribute('data-debug')
      document.querySelectorAll('[data-debug-wide]').forEach((el) => el.removeAttribute('data-debug-wide'))
    }
  }, [debug])

  return (
    <LocaleProvider locale={locale}>
      <div className="flex flex-col min-h-[100dvh]">
        <a href="#main" className="absolute left-4 top-[-3rem] z-[100] bg-green-700 text-sand-100 px-[0.9rem] py-2 rounded-sm transition-[top] duration-200 focus:top-4">
          {locale === 'ar' ? 'تخطَّ إلى المحتوى' : 'Skip to content'}
        </a>
        {/* The booking page is a standalone, chrome-free view (its own intro box). */}
        {!/\/book\//.test(location.pathname) && <Header />}
        <main id="main" className="flex-1 shrink-0 basis-auto [overflow-x:clip] max-[560px]:pb-[5.5rem]">
          <Suspense fallback={<div className="wrap py-20 flex justify-center"><Spinner /></div>}>
            <Outlet />
          </Suspense>
        </main>
        {!/\/book\//.test(location.pathname) && !hideFooter && <Footer />}
        {debug && (
          <pre style={{ fontSize: `${dbg.font}px` }} className="fixed top-1 left-1 z-[99999] m-0 bg-black/90 text-lime-300 px-2 py-1 rounded leading-tight whitespace-pre pointer-events-none max-w-[98vw] overflow-hidden" dir="ltr">{dbg.text}</pre>
        )}
        <NotificationBell />
        <LanguageSuggestion />
        <UpdatedToast />
        <ScrollRestoration />
      </div>
    </LocaleProvider>
  )
}
