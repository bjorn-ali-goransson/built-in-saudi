import { useEffect } from 'react'
import { isInCall, onCallExit } from './inCall'

/**
 * Detect a new deploy and reload so open tabs don't break on stale, hashed
 * lazy-chunks. The build stamps <meta name="build"> in the shell and writes a
 * matching /version.json; we poll it and reload when it changes. A sessionStorage
 * flag lets a post-reload toast explain what happened.
 */
const RELOAD_TARGET = 'bis-reload-target' // the build a reload was trying to reach

export function useVersionCheck() {
  useEffect(() => {
    const current = document.querySelector('meta[name="build"]')?.getAttribute('content')
    if (!current) return

    // We already reloaded trying to reach `attempted`, yet this page STILL isn't it —
    // the shell came from the service-worker cache (a phone waking after a few idle
    // minutes fetches before the network is back, so the offline fallback wins and
    // carries the old build stamp). Reloading again would just loop on every return
    // to the tab, so stand down until the build genuinely moves. Cleared the moment
    // we're actually on the build we asked for.
    let attempted = ''
    try {
      attempted = sessionStorage.getItem(RELOAD_TARGET) || ''
      if (attempted === current) { sessionStorage.removeItem(RELOAD_TARGET); attempted = '' }
    } catch { /* ignore */ }

    let stopped = false
    // visibilitychange and focus BOTH fire when returning to a mobile tab, so an
    // unguarded check ran twice and could reload twice over. One at a time.
    let checking = false
    let reloading = false
    // `force` bypasses the in-call guard. The periodic poll never yanks someone out
    // of a live call, but returning to the tab after being away (visibility/focus)
    // does reload even mid-call — if you were away, the call is likely stale and you
    // should land on the latest version (#206).
    const check = async (force = false) => {
      if (checking || reloading) return
      checking = true
      try {
        const res = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' })
        if (!res.ok) return
        const { build, notes } = await res.json()
        if (stopped || !build || build === current) return
        if (build === attempted) return // we already reloaded for this build and got a stale shell
        if (!force && isInCall()) return // periodic poll: don't interrupt a live call
        reloading = true
        try {
          sessionStorage.setItem(RELOAD_TARGET, String(build))
          sessionStorage.setItem('bis-reloaded', 'update')
          if (notes) sessionStorage.setItem('bis-update-notes', String(notes))
        } catch { /* ignore */ }
        window.location.reload()
      } catch { /* offline / transient — ignore */ } finally { checking = false }
    }

    const id = window.setInterval(check, 60000)
    // Returning to the tab (visibility) or re-focusing the window (browser reopened /
    // alt-tabbed back) forces a check that reloads even mid-call (#206).
    const onReturn = () => { if (!document.hidden) check(true) }
    document.addEventListener('visibilitychange', onReturn)
    window.addEventListener('focus', onReturn)
    onCallExit(() => check()) // leaving a call (hang-up or Back) → apply a deferred deploy now
    return () => { stopped = true; window.clearInterval(id); document.removeEventListener('visibilitychange', onReturn); window.removeEventListener('focus', onReturn); onCallExit(() => {}) }
  }, [])
}
