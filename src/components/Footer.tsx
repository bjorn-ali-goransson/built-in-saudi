import { Link } from 'react-router-dom'
import { SaduDivider } from './SaduDivider'
import { useLocale, localePath } from '../i18n'

export function Footer() {
  const { locale, t } = useLocale()
  const year = new Date().getFullYear()
  return (
    <footer className="shrink-0 pt-[1.4rem] pb-[1.6rem] max-[560px]:pb-[calc(2rem+env(safe-area-inset-bottom))] border-t border-[color:var(--line-soft)] bg-[color-mix(in_srgb,var(--sand-100)_50%,transparent)]">
      <SaduDivider className="text-gold-400 opacity-60 mb-4" />
      <div className="wrap flex items-center justify-between gap-[1.2rem] flex-wrap">
        <div>
          <p className="font-ar text-gold-500 mt-[0.6rem] text-[0.92rem]" lang="ar">
            صُنع بعناية في المملكة العربية السعودية
          </p>
        </div>
        <nav className="flex gap-[1.3rem] items-start [&_a]:no-underline [&_a]:font-semibold [&_a]:text-ink-soft [&_a]:text-[0.92rem] [&_a:hover]:text-green-600" aria-label="Footer">
          <Link to={localePath(locale)} data-testid="footer-all-tools">{t.footer.allTools}</Link>
          <a href="https://github.com/bjorn-ali-goransson/built-in-saudi" target="_blank" rel="noreferrer noopener" data-testid="footer-github">
            {t.footer.github}
          </a>
          <a
            href="https://github.com/bjorn-ali-goransson/built-in-saudi/issues/new"
            target="_blank"
            rel="noreferrer noopener"
            data-testid="footer-report-issue"
          >
            {t.footer.reportIssue}
          </a>
        </nav>
      </div>
      <div className="wrap flex items-center gap-[0.6rem] mt-[1.8rem] text-[0.82rem] text-ink-faint font-mono">
        <span>© {year} Built in Saudi</span>
        <span className="opacity-50">·</span>
        <span>built-in-saudi.com</span>
      </div>
    </footer>
  )
}
