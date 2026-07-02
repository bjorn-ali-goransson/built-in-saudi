import { Link } from 'react-router-dom'
import { SaduDivider } from './SaduDivider'
import { useLocale, localePath } from '../i18n'

export function Footer() {
  const { locale, t } = useLocale()
  const year = new Date().getFullYear()
  return (
    <footer className="site-footer">
      <SaduDivider className="sadu--footer" />
      <div className="wrap site-footer__inner">
        <div className="site-footer__col">
          <p className="site-footer__ethos">{t.footer.ethos}</p>
          <p className="site-footer__made" lang="ar">
            صُنع بعناية في المملكة العربية السعودية
          </p>
        </div>
        <nav className="site-footer__links" aria-label="Footer">
          <Link to={localePath(locale)}>{t.footer.allTools}</Link>
          <a href="https://github.com/bjorn-ali-goransson/built-in-saudi" target="_blank" rel="noreferrer noopener">
            {t.footer.github}
          </a>
        </nav>
      </div>
      <div className="wrap site-footer__base">
        <span>© {year} Built in Saudi</span>
        <span className="site-footer__dot">·</span>
        <span>built-in-saudi.com</span>
      </div>
    </footer>
  )
}
