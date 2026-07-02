import { useEffect } from 'react'
import { LOCALES, type Locale } from '../i18n'

const ORIGIN = 'https://built-in-saudi.com'

const SITE = {
  en: {
    suffix: ' — Built in Saudi',
    title: 'Built in Saudi — Free, honest online tools',
    desc: 'A growing toolbox of fast, free, privacy-first utilities — no ads, no sign-ups, nothing uploaded. Everything runs in your browser. Proudly built in Saudi Arabia.',
  },
  ar: {
    suffix: ' — بُنِيَ في السعودية',
    title: 'بُنِيَ في السعودية — أدوات مجانية وصادقة على الإنترنت',
    desc: 'صندوقُ أدواتٍ متنامٍ من الأدوات المجانية التي تحترم خصوصيتك — بلا إعلانات، وبلا تسجيل، ولا يُرفع أي شيء. كل شيء يعمل داخل متصفحك. صُنع بفخر في السعودية.',
  },
} satisfies Record<Locale, { suffix: string; title: string; desc: string }>

function setMeta(selector: string, attr: string, value: string) {
  const el = document.querySelector(selector)
  if (el) el.setAttribute(attr, value)
}

/** Add/replace the <link rel="alternate" hreflang> set for the given sub-path. */
function setHreflangs(subPath: string) {
  document.querySelectorAll('link[data-hreflang]').forEach((el) => el.remove())
  const add = (hreflang: string, href: string) => {
    const link = document.createElement('link')
    link.rel = 'alternate'
    link.hreflang = hreflang
    link.href = href
    link.setAttribute('data-hreflang', '1')
    document.head.appendChild(link)
  }
  for (const l of LOCALES) add(l, `${ORIGIN}/${l}${subPath}`)
  add('x-default', `${ORIGIN}/en${subPath}`) // we lean English as the default
}

/**
 * Set title, description, canonical, og:* and hreflang alternates for a page.
 * `subPath` is like '' (home) or '/tools/qr-code'. `title`/`description` override
 * the locale defaults (used by tool pages).
 */
export function useDocumentMeta(locale: Locale, subPath = '', title?: string, description?: string) {
  useEffect(() => {
    const site = SITE[locale]
    const fullTitle = title ? `${title}${site.suffix}` : site.title
    const desc = description ?? site.desc
    const canonical = `${ORIGIN}/${locale}${subPath}`

    document.title = fullTitle
    setMeta('meta[name="description"]', 'content', desc)
    setMeta('link[rel="canonical"]', 'href', canonical)
    setMeta('meta[property="og:url"]', 'content', canonical)
    setMeta('meta[property="og:title"]', 'content', fullTitle)
    setMeta('meta[property="og:description"]', 'content', desc)
    setMeta('meta[property="og:locale"]', 'content', locale === 'ar' ? 'ar_SA' : 'en_US')
    setHreflangs(subPath)
  }, [locale, subPath, title, description])
}
