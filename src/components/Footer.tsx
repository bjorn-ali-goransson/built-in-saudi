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
        {/* Friendly data-usage line + the utility nav, spaced so neither crowds. */}
        <div className="flex flex-wrap items-baseline justify-between gap-x-10 gap-y-4">
          <p className="text-[0.92rem] text-ink-soft flex flex-wrap items-center gap-x-2 gap-y-1">
            <span>{t.footer.dataNote}:</span>
            <Link to={localePath(locale, '/privacy')} className="font-semibold text-ink-soft no-underline hover:text-green-600" data-testid="footer-privacy">{t.footer.privacy}</Link>
            <span className="text-ink-faint opacity-50" aria-hidden="true">·</span>
            <Link to={localePath(locale, '/terms')} className="font-semibold text-ink-soft no-underline hover:text-green-600" data-testid="footer-terms">{t.footer.terms}</Link>
          </p>
          <nav className="flex flex-wrap gap-x-6 gap-y-2 items-center [&_a]:no-underline [&_a]:font-semibold [&_a]:text-ink-soft [&_a]:text-[0.92rem] [&_a:hover]:text-green-600" aria-label="Footer">
            <a href="https://github.com/bjorn-ali-goransson/built-in-saudi/issues/new" target="_blank" rel="noreferrer noopener" data-testid="footer-report-issue">{t.footer.reportIssue}</a>
          </nav>
        </div>
        {/* Brand signature + copyright. */}
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1.5 pt-4 border-t border-[color:var(--line-soft)] text-[0.82rem] text-ink-faint">
          <p className="font-ar text-gold-500 text-[0.92rem]" lang="ar" dir="rtl">صُنع بعناية في المملكة العربية السعودية</p>
          <span>© {year} Built in Saudi · built-in-saudi.com</span>
        </div>
      </div>
    </footer>
  )
}
