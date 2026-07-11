import { Suspense, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { Navigate, Outlet, ScrollRestoration, useLocation, useParams } from 'react-router-dom'
import { hideFooterStore } from '../lib/hideFooter'
import {
  isLocale, LocaleProvider, detectLocale, getStoredLocale, dicts, type Locale,
} from '../i18n'
import { Header } from './Header'
import { Footer } from './Footer'
import { LanguageSuggestion } from './LanguageSuggestion'
import { NotificationBell } from './NotificationBell'
import { Spinner } from './ui'
import { UpdatedToast } from './UpdatedToast'
import { useVersionCheck } from '../lib/useVersionCheck'
import { clearStaleNotifications } from '../lib/push'

export function Layout() {
  const { lang } = useParams()
  const location = useLocation()

  // Unknown / missing locale → prepend the visitor's locale to the full path.
  if (!isLocale(lang)) {
    const target = getStoredLocale() ?? detectLocale()
    return <Navigate to={`/${target}${location.pathname}`} replace />
  }
  return <LocalizedLayout locale={lang} />
}

function LocalizedLayout({ locale }: { locale: Locale }) {
  const t = dicts[locale]
  const hideFooter = useSyncExternalStore(hideFooterStore.subscribe, hideFooterStore.get, hideFooterStore.get)
  useVersionCheck()

  useEffect(() => {
    document.documentElement.lang = locale
    document.documentElement.dir = t.dir
  }, [locale, t.dir])

  // Mop up stale prayer/adhkār notifications whenever the app is opened/refocused.
  useEffect(() => {
    const run = () => { if (!document.hidden) clearStaleNotifications() }
    run()
    document.addEventListener('visibilitychange', run)
    return () => document.removeEventListener('visibilitychange', run)
  }, [])

  // #debug — outline every box + an on-screen badge with overflow diagnostics
  // (which element is widest/tallest), so it's readable on mobile even if the
  // page has zoomed out to fit an over-wide element.
  const [debug, setDebug] = useState(false)
  const [dbg, setDbg] = useState({ text: '', font: 13 })
  const [hiddenCount, setHiddenCount] = useState(0)
  const hiddenRef = useRef<HTMLElement[]>([])
  // Find the element with the extreme value of a metric: width / height /
  // right-edge / bottom-edge. Right/bottom catch elements that PUSH the scroll
  // area out via position/margins without being "wide" themselves.
  const extremeEl = (metric: 'w' | 'h' | 'r' | 'b'): { el: HTMLElement | null; val: number } => {
    let el: HTMLElement | null = null, max = -Infinity
    document.querySelectorAll<HTMLElement>('body *').forEach((n) => {
      if (n.closest('[data-debug-ui]') || n.style.display === 'none') return
      const r = n.getBoundingClientRect()
      const v = metric === 'w' ? r.width : metric === 'h' ? r.height : metric === 'r' ? r.right : r.bottom
      if (v > max && v < 1e6) { max = v; el = n }
    })
    return { el, val: max }
  }
  const hide = (metric: 'w' | 'h' | 'r' | 'b') => {
    const { el } = extremeEl(metric)
    if (el) { el.style.setProperty('display', 'none', 'important'); hiddenRef.current.push(el); setHiddenCount(hiddenRef.current.length) }
  }
  const resetHidden = () => { hiddenRef.current.forEach((el) => el.style.removeProperty('display')); hiddenRef.current = []; setHiddenCount(0) }
  useEffect(() => {
    const sync = () => setDebug(window.location.hash.toLowerCase().includes('debug'))
    sync()
    window.addEventListener('hashchange', sync)
    return () => window.removeEventListener('hashchange', sync)
  }, [])
  useEffect(() => {
    if (!debug) return
    document.documentElement.setAttribute('data-debug', '')
    const label = (el: Element | null) =>
      el ? `${(el as HTMLElement).tagName}.${((el as HTMLElement).getAttribute('class') || '(none)').split(/\s+/).slice(0, 4).join('.')}`.slice(0, 60) : '—'
    const tick = () => {
      const de = document.documentElement
      let wideEl: Element | null = null, wMax = 0
      let rightEl: Element | null = null, rMax = -1e9, downEl: Element | null = null, bMax = -1e9
      document.querySelectorAll('body *').forEach((el) => {
        if ((el as HTMLElement).closest('[data-debug-ui]')) return
        const r = (el as HTMLElement).getBoundingClientRect()
        if (r.width > wMax && r.width < 1e5) { wMax = r.width; wideEl = el }
        if (r.right > rMax && r.right < 1e6) { rMax = r.right; rightEl = el }
        if (r.bottom > bMax && r.bottom < 1e6) { bMax = r.bottom; downEl = el }
      })
      document.querySelectorAll('[data-debug-wide]').forEach((el) => el.removeAttribute('data-debug-wide'))
      if (rightEl) (rightEl as HTMLElement).setAttribute('data-debug-wide', '')
      const rr = rightEl ? (rightEl as HTMLElement).getBoundingClientRect() : null
      const vv = window.visualViewport
      setDbg({
        font: Math.min(40, Math.round(12 / (vv?.scale || 1))),
        text: [
          `scale ${(vv?.scale ?? 1).toFixed(2)}  vw ${window.innerWidth}  scrollW ${de.scrollWidth}  Δ${de.scrollWidth - window.innerWidth}`,
          `vh ${window.innerHeight}  scrollH ${de.scrollHeight}`,
          `WIDEST ${Math.round(wMax)}  ${label(wideEl)}`,
          `→FAR right ${Math.round(rMax)}${rr ? ` (L ${Math.round(rr.left)} W ${Math.round(rr.width)})` : ''}`,
          `   ${label(rightEl)}`,
          `↓FAR bottom ${Math.round(bMax)}  ${label(downEl)}`,
        ].join('\n'),
      })
    }
    tick()
    const id = window.setInterval(tick, 500)
    return () => {
      window.clearInterval(id)
      document.documentElement.removeAttribute('data-debug')
      document.querySelectorAll('[data-debug-wide]').forEach((el) => el.removeAttribute('data-debug-wide'))
    }
  }, [debug])

  return (
    <LocaleProvider locale={locale}>
      <div className="flex flex-col min-h-[100dvh]">
        <a href="#main" className="absolute left-4 top-[-3rem] z-[100] bg-green-700 text-sand-100 px-[0.9rem] py-2 rounded-sm transition-[top] duration-200 focus:top-4">
          {locale === 'ar' ? 'تخطَّ إلى المحتوى' : 'Skip to content'}
        </a>
        {/* The booking page is a standalone, chrome-free view (its own intro box). */}
        {!/\/book\//.test(location.pathname) && <Header />}
        <main id="main" className="flex-1 shrink-0 basis-auto [overflow-x:clip] max-[560px]:pb-[5.5rem]">
          <Suspense fallback={<div className="wrap py-20 flex justify-center"><Spinner /></div>}>
            <Outlet />
          </Suspense>
        </main>
        {!/\/book\//.test(location.pathname) && !hideFooter && <Footer />}
        {debug && (
          <div data-debug-ui dir="ltr" style={{ fontSize: `${dbg.font}px` }} className="fixed top-1 left-1 z-[99999] flex flex-col gap-1 items-start max-w-[98vw]">
            <pre className="m-0 bg-black/90 text-lime-300 px-2 py-1 rounded leading-tight whitespace-pre-wrap break-all max-w-[92vw]">{dbg.text}{hiddenCount ? `\nhidden ${hiddenCount}` : ''}</pre>
            <div className="flex flex-wrap gap-1">
              <button type="button" onClick={() => hide('w')} className="bg-fuchsia-600 text-white px-2 py-0.5 rounded border-0 cursor-pointer font-bold">widest</button>
              <button type="button" onClick={() => hide('h')} className="bg-fuchsia-600 text-white px-2 py-0.5 rounded border-0 cursor-pointer font-bold">tallest</button>
              <button type="button" onClick={() => hide('r')} className="bg-fuchsia-600 text-white px-2 py-0.5 rounded border-0 cursor-pointer font-bold">→ far</button>
              <button type="button" onClick={() => hide('b')} className="bg-fuchsia-600 text-white px-2 py-0.5 rounded border-0 cursor-pointer font-bold">↓ far</button>
              <button type="button" onClick={resetHidden} className="bg-neutral-700 text-white px-2 py-0.5 rounded border-0 cursor-pointer">reset</button>
            </div>
          </div>
        )}
        <NotificationBell />
        <LanguageSuggestion />
        <UpdatedToast />
        <ScrollRestoration />
      </div>
    </LocaleProvider>
  )
}
