import { useEffect } from 'react'
import { isInCall } from './inCall'

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
    const check = async () => {
      try {
        const res = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' })
        if (!res.ok) return
        const { build, notes } = await res.json()
        if (!stopped && build && build !== current) {
          if (isInCall()) return // don't yank someone out of a live call — retry next poll
          try {
            sessionStorage.setItem('bis-reloaded', 'update')
            if (notes) sessionStorage.setItem('bis-update-notes', String(notes))
          } catch { /* ignore */ }
          window.location.reload()
        }
      } catch { /* offline / transient — ignore */ }
    }

    const id = window.setInterval(check, 60000)
    const onVisible = () => { if (!document.hidden) check() }
    document.addEventListener('visibilitychange', onVisible)
    return () => { stopped = true; window.clearInterval(id); document.removeEventListener('visibilitychange', onVisible) }
  }, [])
}
