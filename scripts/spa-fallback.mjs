// Post-build step for GitHub Pages hosting of this SPA.
//
// 1. SPA fallback: copy index.html → 404.html so unknown paths boot the app
//    (React Router then renders the right page / redirect).
// 2. Prerender a real 200-status HTML shell for every routable, locale-prefixed
//    path so pages are crawlable/indexable:
//       /<locale>/                         (home)
//       /<locale>/tools/<slug>/            (each real tool)
//    Root "/" keeps the app shell and redirects client-side to the locale.
//
// Locales must stay in sync with LOCALES in src/i18n/index.tsx.
// Tools are auto-discovered: any folder under src/tools/ with a meta.ts.
import {
  copyFileSync, existsSync, mkdirSync, readdirSync, statSync,
} from 'node:fs'
import { join } from 'node:path'

const LOCALES = ['en', 'ar']
const dist = 'dist'
const indexHtml = join(dist, 'index.html')

if (!existsSync(indexHtml)) {
  console.error(`spa-fallback: ${indexHtml} not found — did the Vite build run?`)
  process.exit(1)
}

// 1. SPA fallback
copyFileSync(indexHtml, join(dist, '404.html'))
console.log('spa-fallback: created dist/404.html')

// Discover routable tool slugs.
const toolsDir = 'src/tools'
const slugs = readdirSync(toolsDir).filter((name) => {
  const p = join(toolsDir, name)
  return statSync(p).isDirectory() && existsSync(join(p, 'meta.ts'))
})

// 2. Per-locale prerender: home + each tool.
for (const locale of LOCALES) {
  const homeDir = join(dist, locale)
  mkdirSync(homeDir, { recursive: true })
  copyFileSync(indexHtml, join(homeDir, 'index.html'))
  console.log(`spa-fallback: prerendered dist/${locale}/index.html`)

  for (const slug of slugs) {
    const dir = join(dist, locale, 'tools', slug)
    mkdirSync(dir, { recursive: true })
    copyFileSync(indexHtml, join(dir, 'index.html'))
    console.log(`spa-fallback: prerendered dist/${locale}/tools/${slug}/index.html`)
  }
}
