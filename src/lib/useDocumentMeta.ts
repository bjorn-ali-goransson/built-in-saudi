import { useEffect } from 'react'
import { LOCALES, type Locale } from '../i18n'
import { siteMeta } from '../i18n/seo'

const ORIGIN = 'https://built-in-saudi.com'
const SUFFIX: Record<Locale, string> = { en: ' — Built in Saudi', ar: ' — بُنِيَ في السعودية' }
// Pages are served with a trailing slash (directory index); point canonical /
// hreflang at that form so they don't reference a URL that 301-redirects.
const slash = (sub: string) => `${sub}/`.replace(/\/+$/, '/')

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
  for (const l of LOCALES) add(l, `${ORIGIN}/${l}${slash(subPath)}`)
  add('x-default', `${ORIGIN}/en${slash(subPath)}`) // we lean English as the default
}

/**
 * Set title, description, canonical, og:* and hreflang alternates for a page.
 * `subPath` is like '' (home) or '/apps/qr-code'. `title`/`description` override
 * the locale defaults (used by tool pages).
 */
export function useDocumentMeta(locale: Locale, subPath = '', title?: string, description?: string) {
  useEffect(() => {
    const site = siteMeta[locale]
    const fullTitle = title ? `${title}${SUFFIX[locale]}` : site.title
    const desc = description ?? site.description
    const canonical = `${ORIGIN}/${locale}${slash(subPath)}`

    document.title = fullTitle
    setMeta('meta[name="description"]', 'content', desc)
    setMeta('link[rel="canonical"]', 'href', canonical)
    setMeta('meta[property="og:url"]', 'content', canonical)
    setMeta('meta[property="og:title"]', 'content', fullTitle)
    setMeta('meta[property="og:description"]', 'content', desc)
    setMeta('meta[property="og:locale"]', 'content', locale === 'ar' ? 'ar_SA' : 'en_US')
    // og:locale:alternate reinforces the hreflang signal for the other language
    let altMeta = document.querySelector('meta[property="og:locale:alternate"]') as HTMLMetaElement | null
    if (!altMeta) {
      altMeta = document.createElement('meta')
      altMeta.setAttribute('property', 'og:locale:alternate')
      document.head.appendChild(altMeta)
    }
    altMeta.setAttribute('content', locale === 'ar' ? 'en_US' : 'ar_SA')
    setMeta('meta[name="twitter:title"]', 'content', fullTitle)
    setMeta('meta[name="twitter:description"]', 'content', desc)
    setHreflangs(subPath)

    const isApp = subPath.startsWith('/apps/')
    const isPage = subPath !== '' && !isApp
    const homeName = locale === 'ar' ? 'الرئيسية' : 'Home'
    const cleanTitle = title || site.title
    
    let schemaData: any
    if (isApp) {
      schemaData = [
        {
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          "itemListElement": [
            { "@type": "ListItem", "position": 1, "name": homeName, "item": `${ORIGIN}/${locale}/` },
            { "@type": "ListItem", "position": 2, "name": cleanTitle, "item": canonical }
          ]
        },
        {
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          "name": cleanTitle,
          "description": desc,
          "url": canonical,
          "applicationCategory": "BrowserApplication",
          "operatingSystem": "Any"
        }
      ]
    } else if (isPage) {
      schemaData = [
        {
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          "itemListElement": [
            { "@type": "ListItem", "position": 1, "name": homeName, "item": `${ORIGIN}/${locale}/` },
            { "@type": "ListItem", "position": 2, "name": cleanTitle, "item": canonical }
          ]
        },
        {
          "@context": "https://schema.org",
          "@type": "WebPage",
          "name": cleanTitle,
          "description": desc,
          "url": canonical
        }
      ]
    } else {
      schemaData = {
        "@context": "https://schema.org",
        "@type": "WebSite",
        "name": fullTitle,
        "description": desc,
        "url": canonical
      }
    }
    
    let script = document.querySelector('script[type="application/ld+json"]')
    if (!script) {
      script = document.createElement('script')
      script.setAttribute('type', 'application/ld+json')
      document.head.appendChild(script)
    }
    script.textContent = JSON.stringify(schemaData)
  }, [locale, subPath, title, description])
}
