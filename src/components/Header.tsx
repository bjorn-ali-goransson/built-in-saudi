import { Link, useLocation } from 'react-router-dom'
import { useLocale, localePath, swapLocaleInPath, setStoredLocale, localizeTool } from '../i18n'
import { getTool } from '../tools'
import { AppLauncher } from './AppLauncher'

export function Header() {
  const { locale, t } = useLocale()
  const location = useLocation()
  const other = locale === 'ar' ? 'en' : 'ar'
  const home = localePath(locale)
  const isAr = locale === 'ar'

  // "The happening" — show the current tool's name next to the logo (app-bar feel).
  const match = location.pathname.match(/\/tools\/([^/]+)/)
  const currentTool = match ? getTool(match[1]) : null
  const context = currentTool && currentTool.component ? localizeTool(currentTool, locale).name : ''

  return (
    <header className="sticky top-0 z-40 backdrop-blur-[10px] backdrop-saturate-[1.4] bg-[color-mix(in_srgb,var(--sand-50)_82%,transparent)] border-b border-[color:var(--line-soft)]">
      <div className="wrap flex items-center justify-between h-[68px] max-[560px]:h-[60px]">
        <Link to={home} className="group inline-flex items-center gap-[0.7rem] no-underline" aria-label="Built in Saudi — home">
          <span className="grid place-items-center transition-transform duration-200 drop-shadow-[0_3px_6px_rgba(11,61,46,0.22)] group-hover:rotate-[-4deg] group-hover:scale-[1.04]" aria-hidden="true">
            <svg viewBox="0 0 64 64" width="34" height="34">
              <rect width="64" height="64" rx="14" fill="var(--green-700)" />
              <path d="M32 12 L46 34 L18 34 Z" fill="none" stroke="var(--gold-400)" strokeWidth="3" strokeLinejoin="round" />
              <path d="M32 24 L39 36 L25 36 Z" fill="var(--sand-100)" />
              <rect x="18" y="40" width="28" height="3" fill="var(--green-500)" />
              <g fill="var(--gold-400)">
                <circle cx="21" cy="49" r="2.4" />
                <circle cx="32" cy="49" r="2.4" />
                <circle cx="43" cy="49" r="2.4" />
              </g>
            </svg>
          </span>
          <span className="flex flex-col leading-[1.05]">
            <span className="font-display font-semibold text-[1.16rem] text-green-700">{context || (isAr ? 'بُنِيَ في السعودية' : 'Built in Saudi')}</span>
            {!context && (
              <span className="font-ar text-[0.74rem] text-gold-500 max-[560px]:hidden" lang={isAr ? 'en' : 'ar'}>
                {isAr ? 'BUILT IN SAUDI' : 'بُنِيَ في السعودية'}
              </span>
            )}
          </span>
        </Link>

        <nav className="flex gap-[1.4rem] items-center" aria-label="Primary">
          <Link
            to={swapLocaleInPath(location.pathname, other)}
            className="lang-toggle inline-flex items-center justify-center border border-[color:var(--line)] rounded-full px-[0.9rem] py-[0.28rem] text-[0.85rem] leading-none font-semibold text-ink-soft no-underline hover:text-green-700 hover:border-[color-mix(in_srgb,var(--green-500)_40%,transparent)] hover:bg-[color-mix(in_srgb,var(--green-400)_10%,transparent)]"
            onClick={() => setStoredLocale(other)}
            lang={other}
            hrefLang={other}
          >
            {t.switchLanguage}
          </Link>
          <AppLauncher />
        </nav>
      </div>
    </header>
  )
}
