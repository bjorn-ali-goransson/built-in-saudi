import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { execSync } from 'node:child_process'
import { en } from './src/i18n/en'
import { ar } from './src/i18n/ar'
import { siteMeta, liveToolSeo, staticPageSeo, type ToolSeo } from './src/i18n/seo'

const ORIGIN = 'https://built-in-saudi.com'
const LOCALES = ['en', 'ar'] as const
type Loc = (typeof LOCALES)[number]
const dicts = { en, ar }
const suffix: Record<Loc, string> = { en: ' — Built in Saudi', ar: ' — بُنِيَ في السعودية' }

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const escAttr = (s: string) => esc(s).replace(/"/g, '&quot;')

// Trailing slash: pages are served as directory index.html, so GitHub Pages
// 301-redirects the no-slash form to the slash form. Point every canonical /
// og:url / hreflang / internal link at the slash form so crawlers land on a 200
// directly (no redirect hop).
const slash = (sub: string) => `${sub}/`.replace(/\/+$/, '/')

function hreflangs(sub: string): string {
  const links = LOCALES.map((l) => `<link rel="alternate" hreflang="${l}" href="${ORIGIN}/${l}${slash(sub)}" />`)
  links.push(`<link rel="alternate" hreflang="x-default" href="${ORIGIN}/en${slash(sub)}" />`)
  return links.join('')
}

interface Head { locale: Loc; dir: string; title: string; desc: string; canonical: string; sub: string; type: 'WebSite' | 'WebApplication' | 'WebPage' }

// Replace a meta tag's content regardless of attribute order or line wrapping
// (index.html wraps some tags across lines, which a single-line regex misses —
// that silently left every page with the default description).
function setContent(html: string, matchAttr: string, value: string): string {
  const re = new RegExp(`(<meta\\s+${matchAttr}\\s+content=")[^"]*(")`, 'i')
  return re.test(html) ? html.replace(re, `$1${escAttr(value)}$2`) : html
}

function applyHead(html: string, h: Head): string {
  const homeName = h.locale === 'ar' ? 'الرئيسية' : 'Home'
  const cleanTitle = h.title.split(' — ')[0]
  
  let schemaData: any
  if (h.type === 'WebApplication') {
    schemaData = [
      {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": [
          { "@type": "ListItem", "position": 1, "name": homeName, "item": `${ORIGIN}/${h.locale}/` },
          { "@type": "ListItem", "position": 2, "name": cleanTitle, "item": h.canonical }
        ]
      },
      {
        "@context": "https://schema.org",
        "@type": "SoftwareApplication",
        "name": cleanTitle,
        "description": h.desc,
        "url": h.canonical,
        "applicationCategory": "BrowserApplication",
        "operatingSystem": "Any"
      }
    ]
  } else if (h.type === 'WebPage') {
    schemaData = [
      {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": [
          { "@type": "ListItem", "position": 1, "name": homeName, "item": `${ORIGIN}/${h.locale}/` },
          { "@type": "ListItem", "position": 2, "name": cleanTitle, "item": h.canonical }
        ]
      },
      {
        "@context": "https://schema.org",
        "@type": "WebPage",
        "name": cleanTitle,
        "description": h.desc,
        "url": h.canonical
      }
    ]
  } else {
    schemaData = {
      "@context": "https://schema.org",
      "@type": "WebSite",
      "name": h.title,
      "description": h.desc,
      "url": h.canonical
    }
  }

  const ldJson = `<script type="application/ld+json">${JSON.stringify(schemaData)}</script>`

  html = html
    .replace(/<html[^>]*>/, `<html lang="${h.locale}" dir="${h.dir}" translate="no">`)
    .replace(/<title>[^<]*<\/title>/, `<title>${esc(h.title)}</title>`)
    .replace(/(<link rel="canonical" href=")[^"]*(")/, `$1${h.canonical}$2`)
    .replace(/(<meta property="og:url" content=")[^"]*(")/, `$1${h.canonical}$2`)
    .replace(/<meta property="og:locale" content="[^"]*"/, `<meta property="og:locale" content="${h.locale === 'ar' ? 'ar_SA' : 'en_US'}"`)
    .replace(/<\/head>/, `<meta property="og:locale:alternate" content="${h.locale === 'ar' ? 'en_US' : 'ar_SA'}" />${ldJson}${hreflangs(h.sub)}</head>`)
  html = setContent(html, 'name="description"', h.desc)
  html = setContent(html, 'property="og:title"', h.title)
  html = setContent(html, 'property="og:description"', h.desc)
  html = setContent(html, 'name="twitter:title"', h.title)
  html = setContent(html, 'name="twitter:description"', h.desc)
  return html
}

// Inject crawlable content into #root, but `hidden` so it never paints (avoids a
// flash of unstyled content). The text stays in the HTML source for crawlers,
// and React's createRoot replaces the whole block on mount.
function injectContent(html: string, content: string): string {
  return html.replace('<div id="root"></div>', `<div id="root"><div data-ssr hidden>${content}</div></div>`)
}

function homeContent(locale: Loc): string {
  const t = dicts[locale]
  const items = liveToolSeo
    .map((tool) => {
      const ts = tool[locale]
      return `<li><a href="/${locale}/apps/${tool.id}/">${esc(ts.name)}</a> — ${esc(ts.description)}</li>`
    })
    .join('')
  // Home is app-list-only (the hero copy was removed); keep a single H1 for SEO.
  return `<main><h1>${esc(t.hero.title1)} ${esc(t.hero.title2)}</h1><ul>${items}</ul></main>`
}

// A tool page's crawlable block: H1 + description, an H2, and a full cross-link
// list of the other tools. The cross-links mean no tool page is reachable from
// the homepage alone (kills the "orphan / 1 internal link" problem) and lifts
// the on-page word count / internal-link density that thin utility pages lack.
function toolContent(locale: Loc, tool: ToolSeo): string {
  const t = dicts[locale]
  const ts = tool[locale]
  const tr = t.toolPage.trust

  let html = `<main><nav><a href="/${locale}/">${esc(t.toolPage.breadcrumb)}</a> / ${esc(ts.name)}</nav>`
    + `<h1>${esc(ts.name)}</h1><p>${esc(ts.description)}</p>`

  if (ts.howItWorks && ts.howItWorks.length > 0) {
    html += `<h2>${esc(t.toolPage.howItWorks)}</h2><ol>` + ts.howItWorks.map((s) => `<li>${esc(s)}</li>`).join('') + `</ol>`
  }
  if (ts.features && ts.features.length > 0) {
    html += `<h2>${esc(t.toolPage.features)}</h2><ul>` + ts.features.map((s) => `<li>${esc(s)}</li>`).join('') + `</ul>`
  }
  if (ts.faq && ts.faq.length > 0) {
    html += `<h2>${esc(t.toolPage.faq)}</h2>` + ts.faq.map((item) => `<h3>${esc(item.q)}</h3><p>${esc(item.a)}</p>`).join('')
  }

  html += `<h2>${esc(tr.title)}</h2>`
    + `<h3>${esc(tr.clientSideTitle)}</h3><p>${esc(tr.clientSideDesc)}</p>`
    + `<h3>${esc(tr.freeTitle)}</h3><p>${esc(tr.freeDesc)}</p>`
    + `<h3>${esc(tr.privacyTitle)}</h3><p>${esc(tr.privacyDesc)}</p>`

  return html + `</main>`
}

/**
 * Build-time prerender: writes a localized static HTML shell for each route with
 * correct <head> (title/description/canonical/hreflang/og) + a crawlable content
 * block. No SSR framework, no hydration — createRoot replaces the block on mount.
 * Tools listed in src/i18n/seo.ts are prerendered; add a tool there when it ships.
 */
function prerenderPlugin(): Plugin {
  return {
    name: 'bis-prerender',
    apply: 'build',
    closeBundle() {
      const dist = 'dist'
      // Stamp a build id so open tabs can detect a new deploy (see useVersionCheck).
      const build = String(Date.now())
      // Extract a user-facing "what changed" note from the latest commit: a
      // `Changelog: …` trailer if present, else the commit subject line.
      let notes = ''
      try {
        const msg = execSync('git log -1 --pretty=%B', { encoding: 'utf8' })
        // Take everything after `Changelog:` up to the first blank line (so a
        // wrapped changelog isn't cut mid-sentence), else the commit subject.
        const ci = msg.search(/^Changelog:/im)
        const raw = ci >= 0
          ? msg.slice(msg.indexOf(':', ci) + 1).split(/\n[ \t]*\n/)[0]
          : msg.split('\n')[0]
        notes = raw.replace(/\s+/g, ' ').trim().slice(0, 180)
      } catch { /* no git in this environment — leave notes empty */ }
      let shell = readFileSync(join(dist, 'index.html'), 'utf8')
      shell = shell.replace('</head>', `<meta name="build" content="${build}" /></head>`)
      writeFileSync(join(dist, 'version.json'), JSON.stringify({ build, notes }))

      writeFileSync(join(dist, '404.html'), shell) // SPA fallback

      const write = (routeDir: string, html: string) => {
        const dir = join(dist, routeDir)
        mkdirSync(dir, { recursive: true })
        writeFileSync(join(dir, 'index.html'), html)
      }

      for (const locale of LOCALES) {
        const dir = dicts[locale].dir
        const site = siteMeta[locale]

        let home = applyHead(shell, { locale, dir, title: site.title, desc: site.description, canonical: `${ORIGIN}/${locale}/`, sub: '', type: 'WebSite' })
        home = injectContent(home, homeContent(locale))
        write(locale, home)

        for (const tool of liveToolSeo) {
          const ts = tool[locale]
          const sub = `/apps/${tool.id}`
          let page = applyHead(shell, { locale, dir, title: `${ts.name}${suffix[locale]}`, desc: ts.description, canonical: `${ORIGIN}/${locale}${sub}/`, sub, type: 'WebApplication' })
          page = injectContent(page, toolContent(locale, tool))
          write(`${locale}${sub}`, page)
        }

        // Standalone pages (privacy, terms) — real 200 HTML with head + a
        // crawlable content block; React renders the full page on mount.
        for (const page of staticPageSeo) {
          const ps = page[locale]
          const sub = `/${page.id}`
          let html = applyHead(shell, { locale, dir, title: `${ps.name}${suffix[locale]}`, desc: ps.description, canonical: `${ORIGIN}/${locale}${sub}/`, sub, type: 'WebPage' })
          html = injectContent(html, `<main><h1>${esc(ps.name)}</h1><p>${esc(ps.description)}</p></main>`)
          write(`${locale}${sub}`, html)
        }
      }

      // Root shell: English-default head + hreflang + language links (it redirects client-side).
      let root = applyHead(shell, { locale: 'en', dir: 'ltr', title: siteMeta.en.title, desc: siteMeta.en.description, canonical: `${ORIGIN}/en/`, sub: '', type: 'WebSite' })
      root = injectContent(root, `<main><h1>${esc(siteMeta.en.title)}</h1><p><a href="/en">English</a> · <a href="/ar">العربية</a></p></main>`)
      writeFileSync(join(dist, 'index.html'), root)

      console.log(`bis-prerender: localized static HTML for ${LOCALES.join(', ')} × ${liveToolSeo.length + staticPageSeo.length + 1} pages`)
    },
  }
}

// Custom domain serves from root, so base is '/'.
export default defineConfig({
  plugins: [tailwindcss(), react(), prerenderPlugin()],
  base: '/',
  build: { target: 'es2020', sourcemap: false },
})
