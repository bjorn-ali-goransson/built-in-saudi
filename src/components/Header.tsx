import { Link, useLocation } from 'react-router-dom'
import { useLocale, swapLocaleInPath, setStoredLocale, localizeTool } from '../i18n'
import { getTool } from '../tools'
import { AppLauncher } from './AppLauncher'

export function Header() {
  const { locale, t } = useLocale()
  const location = useLocation()
  const other = locale === 'ar' ? 'en' : 'ar'

  // App-bar title: the current tool's name (the logo was removed — the launcher
  // opens the app menu, which is the same as the home page).
  const match = location.pathname.match(/\/tools\/([^/]+)/)
  const currentTool = match ? getTool(match[1]) : null
  const context = currentTool && currentTool.component ? localizeTool(currentTool, locale).name : ''

  return (
    <header className="sticky top-0 z-40 backdrop-blur-[10px] backdrop-saturate-[1.4] bg-[color-mix(in_srgb,var(--sand-50)_82%,transparent)] border-b border-[color:var(--line-soft)]">
      <div className="wrap flex items-center justify-between h-[68px] max-[560px]:h-[60px]">
        <div className="flex items-center gap-3 min-w-0">
          <AppLauncher />
          {context && <span className="font-display font-semibold text-[1.16rem] text-green-700 truncate">{context}</span>}
        </div>

        <Link
          to={swapLocaleInPath(location.pathname, other)}
          className="lang-toggle inline-flex items-center justify-center border border-[color:var(--line)] rounded-full px-[0.9rem] py-[0.28rem] text-[0.85rem] leading-none font-semibold text-ink-soft no-underline hover:text-green-700 hover:border-[color-mix(in_srgb,var(--green-500)_40%,transparent)] hover:bg-[color-mix(in_srgb,var(--green-400)_10%,transparent)]"
          onClick={() => setStoredLocale(other)}
          lang={other}
          hrefLang={other}
        >
          {t.switchLanguage}
        </Link>
      </div>
    </header>
  )
}
