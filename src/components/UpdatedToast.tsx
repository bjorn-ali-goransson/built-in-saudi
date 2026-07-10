import { useEffect, useState } from 'react'
import { useLocale } from '../i18n'

const MSG = {
  en: 'Updated',
  ar: 'تم التحديث',
}

const LAST_BUILD_KEY = 'bis-last-build'

/**
 * Shows a brief "what changed" toast after a new deploy. Two triggers:
 *  1. an auto-reload from useVersionCheck (post-reload sessionStorage flag), or
 *  2. a *fresh* visit onto a build newer than the last one we saw — even without
 *     a reload — by comparing <meta name="build"> to a localStorage record.
 */
export function UpdatedToast() {
  const { locale } = useLocale()
  const [show, setShow] = useState(false)
  const [notes, setNotes] = useState('')

  useEffect(() => {
    const build = document.querySelector('meta[name="build"]')?.getAttribute('content') || ''

    // (1) Post-reload flow from useVersionCheck.
    let reloaded = false
    let sessionNotes = ''
    try {
      reloaded = sessionStorage.getItem('bis-reloaded') != null
      sessionNotes = sessionStorage.getItem('bis-update-notes') || ''
      sessionStorage.removeItem('bis-reloaded')
      sessionStorage.removeItem('bis-chunk-reload')
      sessionStorage.removeItem('bis-update-notes')
    } catch { /* ignore */ }

    // (2) Fresh visit onto a newer build than the last one we recorded.
    let lastBuild = ''
    try { lastBuild = localStorage.getItem(LAST_BUILD_KEY) || '' } catch { /* ignore */ }
    const freshUpdate = !!build && !!lastBuild && lastBuild !== build
    try { if (build) localStorage.setItem(LAST_BUILD_KEY, build) } catch { /* ignore */ }

    if (reloaded) {
      setNotes(sessionNotes)
      setShow(true)
    } else if (freshUpdate) {
      setShow(true)
      // Notes come from version.json, which matches this build on a fresh load.
      fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => { if (d && d.notes) setNotes(String(d.notes)) })
        .catch(() => { /* offline / transient — show the plain toast */ })
    }
  }, [])

  useEffect(() => {
    if (!show) return
    const id = window.setTimeout(() => setShow(false), notes ? 7000 : 4000)
    return () => window.clearTimeout(id)
  }, [show, notes])

  if (!show) return null
  return (
    <div className="fixed top-[84px] inset-x-0 mx-auto z-[70] w-fit max-w-[min(92vw,460px)] bg-green-700 text-sand-100 py-[0.6rem] px-[1.1rem] rounded-md shadow-lg text-[0.9rem] animate-[fadeUp_0.3s_ease_both] flex flex-col items-center gap-[0.15rem] text-center border-[1.5px] border-white/90" role="status" data-testid="updated-toast">
      <strong className="font-body text-[0.66rem] uppercase tracking-[0.09em] opacity-80">{MSG[locale]}</strong>
      {notes && <span className="text-[0.9rem] leading-[1.35]">{notes}</span>}
    </div>
  )
}
