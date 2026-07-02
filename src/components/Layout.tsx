import { Suspense, useEffect } from 'react'
import { Navigate, Outlet, ScrollRestoration, useLocation, useParams } from 'react-router-dom'
import {
  isLocale, LocaleProvider, detectLocale, getStoredLocale, dicts, type Locale,
} from '../i18n'
import { Header } from './Header'
import { Footer } from './Footer'
import { LanguageSuggestion } from './LanguageSuggestion'
import { NotificationBell } from './NotificationBell'

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

  useEffect(() => {
    document.documentElement.lang = locale
    document.documentElement.dir = t.dir
  }, [locale, t.dir])

  return (
    <LocaleProvider locale={locale}>
      <div className="app-shell">
        <a href="#main" className="skip-link">
          {locale === 'ar' ? 'تخطَّ إلى المحتوى' : 'Skip to content'}
        </a>
        <Header />
        <main id="main" className="app-main">
          <Suspense fallback={<div className="wrap route-fallback">…</div>}>
            <Outlet />
          </Suspense>
        </main>
        <Footer />
        <NotificationBell />
        <LanguageSuggestion />
        <ScrollRestoration />
      </div>
    </LocaleProvider>
  )
}
