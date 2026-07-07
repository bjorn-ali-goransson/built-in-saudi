import { Link, useLocation } from 'react-router-dom'
import { useLocale, localePath, swapLocaleInPath, setStoredLocale, localizeTool } from '../i18n'
import { getTool } from '../tools'
import { AppLauncher } from './AppLauncher'
import { PalmLogo } from './PalmLogo'
import { ShareButton } from './ShareButton'

export function Header() {
  const { locale, t } = useLocale()
  const location = useLocation()
  const other = locale === 'ar' ? 'en' : 'ar'

  // The home page *is* the app menu, so the launcher is hidden there. On every
  // other page the launcher opens the menu, followed by the name: the current
  // tool's name (app-bar) on a tool page, else the site name.
  const isHome = /^\/(en|ar)\/?$/.test(location.pathname)
  const isBooking = /\/book\//.test(location.pathname)
  const match = location.pathname.match(/\/apps\/([^/]+)/)
  const currentTool = match ? getTool(match[1]) : null
  const context = isBooking
    ? locale === 'ar' ? 'احجز اجتماعًا' : 'Book a meeting'
    : currentTool && currentTool.component ? localizeTool(currentTool, locale).name : ''
  const siteName = locale === 'ar' ? 'بُنِيَ في السعودية' : 'Built in Saudi'

  return (
    <header className="sticky top-0 z-40 backdrop-blur-[10px] backdrop-saturate-[1.4] bg-[color-mix(in_srgb,var(--sand-50)_82%,transparent)] border-b border-[color:var(--line-soft)]">
      <div className="wrap flex items-center justify-between h-[68px] max-[560px]:h-[60px]">
        <div className="flex items-center gap-3 min-w-0">
          {!isHome && <AppLauncher />}
          <Link to={localePath(locale)} className="flex items-center gap-[0.5rem] font-display font-semibold text-[1.16rem] text-green-700 min-w-0 no-underline" aria-label={siteName}>
            {!context && <PalmLogo className="w-[1.5em] flex-none text-green-600" />}
            <span className="truncate">{context || siteName}</span>
          </Link>
        </div>

        <div className="flex items-center gap-2 flex-none">
          {!isHome && <ShareButton />}
          <Link
            to={swapLocaleInPath(location.pathname, other)}
            className="lang-toggle inline-flex items-center justify-center h-9 border border-[color:var(--line)] rounded-full px-[0.9rem] text-[0.85rem] leading-none font-semibold text-ink-soft no-underline hover:text-green-700 hover:border-[color-mix(in_srgb,var(--green-500)_40%,transparent)] hover:bg-[color-mix(in_srgb,var(--green-400)_10%,transparent)]"
            onClick={() => setStoredLocale(other)}
            lang={other}
            hrefLang={other}
          >
            {t.switchLanguage}
          </Link>
        </div>
      </div>
    </header>
  )
}
