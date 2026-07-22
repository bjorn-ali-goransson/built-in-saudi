import { useEffect } from 'react'
import { isInCall, onCallExit } from './inCall'

/**
 * Detect a new deploy and reload so open tabs don't break on stale, hashed
 * lazy-chunks. The build stamps <meta name="build"> in the shell and writes a
 * matching /version.json; we poll it and reload when it changes. A sessionStorage
 * flag lets a post-reload toast explain what happened.
 */
export function useVersionCheck() {
  useEffect(() => {
    const current = document.querySelector('meta[name="build"]')?.getAttribute('content')
    if (!current) return

    let stopped = false
    // `force` bypasses the in-call guard. The periodic poll never yanks someone out
    // of a live call, but returning to the tab after being away (visibility/focus)
    // does reload even mid-call — if you were away, the call is likely stale and you
    // should land on the latest version (#206).
    const check = async (force = false) => {
      try {
        const res = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' })
        if (!res.ok) return
        const { build, notes } = await res.json()
        if (!stopped && build && build !== current) {
          if (!force && isInCall()) return // periodic poll: don't interrupt a live call
          try {
            sessionStorage.setItem('bis-reloaded', 'update')
            if (notes) sessionStorage.setItem('bis-update-notes', String(notes))
          } catch { /* ignore */ }
          window.location.reload()
        }
      } catch { /* offline / transient — ignore */ }
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
