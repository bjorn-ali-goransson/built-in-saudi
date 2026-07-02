import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { execSync } from 'node:child_process'
import { en } from './src/i18n/en'
import { ar } from './src/i18n/ar'
import { siteMeta, liveToolSeo, type ToolSeo } from './src/i18n/seo'

const ORIGIN = 'https://built-in-saudi.com'
const LOCALES = ['en', 'ar'] as const
type Loc = (typeof LOCALES)[number]
const dicts = { en, ar }
const suffix: Record<Loc, string> = { en: ' — Built in Saudi', ar: ' — بُنِيَ في السعودية' }

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const escAttr = (s: string) => esc(s).replace(/"/g, '&quot;')

function hreflangs(sub: string): string {
  const links = LOCALES.map((l) => `<link rel="alternate" hreflang="${l}" href="${ORIGIN}/${l}${sub}" />`)
  links.push(`<link rel="alternate" hreflang="x-default" href="${ORIGIN}/en${sub}" />`)
  return links.join('')
}

interface Head { locale: Loc; dir: string; title: string; desc: string; canonical: string; sub: string }

function applyHead(html: string, h: Head): string {
  return html
    .replace(/<html[^>]*>/, `<html lang="${h.locale}" dir="${h.dir}" translate="no">`)
    .replace(/<title>[^<]*<\/title>/, `<title>${esc(h.title)}</title>`)
    .replace(/(<meta name="description" content=")[^"]*(")/, `$1${escAttr(h.desc)}$2`)
    .replace(/(<link rel="canonical" href=")[^"]*(")/, `$1${h.canonical}$2`)
    .replace(/(<meta property="og:title" content=")[^"]*(")/, `$1${escAttr(h.title)}$2`)
    .replace(/(<meta property="og:description" content=")[^"]*(")/, `$1${escAttr(h.desc)}$2`)
    .replace(/(<meta property="og:url" content=")[^"]*(")/, `$1${h.canonical}$2`)
    .replace(/(<meta property="og:locale" content=")[^"]*(")/, `$1${h.locale === 'ar' ? 'ar_SA' : 'en_US'}$2`)
    .replace(/<\/head>/, `${hreflangs(h.sub)}</head>`)
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
      return `<li><a href="/${locale}/tools/${tool.id}">${esc(ts.name)}</a> — ${esc(ts.description)}</li>`
    })
    .join('')
  return `<main><p>${esc(t.hero.kicker)}</p><h1>${esc(t.hero.title1)} ${esc(t.hero.title2)}</h1>`
    + `<p>${esc(t.hero.lede)}</p><h2>${esc(t.catalog.title)}</h2><ul>${items}</ul></main>`
}

function toolContent(locale: Loc, tool: ToolSeo): string {
  const t = dicts[locale]
  const ts = tool[locale]
  return `<main><nav><a href="/${locale}">${esc(t.toolPage.breadcrumb)}</a> / ${esc(ts.name)}</nav>`
    + `<h1>${esc(ts.name)}</h1><p>${esc(ts.description)}</p></main>`
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
        const m = msg.match(/^Changelog:\s*(.+)$/im)
        notes = (m ? m[1] : msg.split('\n')[0]).trim().slice(0, 180)
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

        let home = applyHead(shell, { locale, dir, title: site.title, desc: site.description, canonical: `${ORIGIN}/${locale}`, sub: '' })
        home = injectContent(home, homeContent(locale))
        write(locale, home)

        for (const tool of liveToolSeo) {
          const ts = tool[locale]
          const sub = `/tools/${tool.id}`
          let page = applyHead(shell, { locale, dir, title: `${ts.name}${suffix[locale]}`, desc: ts.description, canonical: `${ORIGIN}/${locale}${sub}`, sub })
          page = injectContent(page, toolContent(locale, tool))
          write(`${locale}${sub}`, page)
        }
      }

      // Root shell: English-default head + hreflang + language links (it redirects client-side).
      let root = applyHead(shell, { locale: 'en', dir: 'ltr', title: siteMeta.en.title, desc: siteMeta.en.description, canonical: `${ORIGIN}/en`, sub: '' })
      root = injectContent(root, `<main><h1>${esc(siteMeta.en.title)}</h1><p><a href="/en">English</a> · <a href="/ar">العربية</a></p></main>`)
      writeFileSync(join(dist, 'index.html'), root)

      console.log(`bis-prerender: localized static HTML for ${LOCALES.join(', ')} × ${liveToolSeo.length + 1} pages`)
    },
  }
}

// Custom domain serves from root, so base is '/'.
export default defineConfig({
  plugins: [react(), prerenderPlugin()],
  base: '/',
  build: { target: 'es2020', sourcemap: false },
})
