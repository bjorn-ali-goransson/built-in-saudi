import { Suspense, useEffect, useSyncExternalStore } from 'react'
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
import { useIncomingCall } from '../lib/useIncomingCall'
import { clearStaleNotifications } from '../lib/push'

export function Layout() {
  const { lang } = useParams()
  const location = useLocation()

  // Unknown / missing locale → prepend the visitor's locale to the full path.
  // Keep the query string + hash: locale-less deep links (the "call me" ring
  // /apps/calls/join?code=…&ring=1, booking links, etc.) carry state there, and
  // dropping it silently breaks the incoming-call screen.
  if (!isLocale(lang)) {
    const target = getStoredLocale() ?? detectLocale()
    return <Navigate to={`/${target}${location.pathname}${location.search}${location.hash}`} replace />
  }
  return <LocalizedLayout locale={lang} />
}

function LocalizedLayout({ locale }: { locale: Locale }) {
  const t = dicts[locale]
  const hideFooter = useSyncExternalStore(hideFooterStore.subscribe, hideFooterStore.get, hideFooterStore.get)
  useVersionCheck()
  useIncomingCall() // ring from anywhere on the site → the incoming-call screen

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
        <NotificationBell />
        <LanguageSuggestion />
        <UpdatedToast />
        <ScrollRestoration />
      </div>
    </LocaleProvider>
  )
}
