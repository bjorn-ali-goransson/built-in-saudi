import { Link } from 'react-router-dom'
import { SaduDivider } from './SaduDivider'
import { useLocale, localePath } from '../i18n'

export function Footer() {
  const { locale, t } = useLocale()
  const year = new Date().getFullYear()
  return (
    <footer className="shrink-0 pt-[1.4rem] pb-[1.6rem] max-[560px]:pb-[calc(2rem+env(safe-area-inset-bottom))] border-t border-[color:var(--line-soft)] bg-[color-mix(in_srgb,var(--sand-100)_50%,transparent)]">
      <SaduDivider className="text-gold-400 opacity-60 mb-6" />
      <div className="wrap flex flex-col gap-5">
        {/* Friendly, plain-language data-usage line. */}
        <p className="text-[0.92rem] text-ink-soft flex flex-wrap items-center gap-x-2 gap-y-1">
          <span>{t.footer.dataNote}:</span>
          <Link to={localePath(locale, '/privacy')} className="font-semibold text-ink-soft no-underline hover:text-green-600" data-testid="footer-privacy">{t.footer.privacy}</Link>
          <span className="text-ink-faint opacity-50" aria-hidden="true">·</span>
          <Link to={localePath(locale, '/terms')} className="font-semibold text-ink-soft no-underline hover:text-green-600" data-testid="footer-terms">{t.footer.terms}</Link>
        </p>
        {/* Brand signature + copyright (with a discreet GitHub link). */}
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1.5 pt-4 border-t border-[color:var(--line-soft)] text-[0.82rem] text-ink-faint">
          <p className="font-ar text-gold-500 text-[0.92rem]" lang="ar" dir="rtl">صُنع بعناية في المملكة العربية السعودية</p>
          <span className="flex items-center gap-x-2">
            <span>© {year} Built in Saudi · built-in-saudi.com</span>
            <span className="opacity-50" aria-hidden="true">·</span>
            <a href="https://github.com/bjorn-ali-goransson/built-in-saudi" target="_blank" rel="noreferrer noopener" className="no-underline hover:text-green-600" data-testid="footer-github">{t.footer.github}</a>
          </span>
        </div>
      </div>
    </footer>
  )
}
