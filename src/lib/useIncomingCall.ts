import { useEffect } from 'react'
import { isInCall } from './inCall'

// When the service worker signals an incoming "call me" ring (see public/sw.js),
// take the user to the incoming-call screen from ANYWHERE on the site — not just
// when the Calls tool happens to be open. Skipped if they're already in a live
// call or already on a ring screen.
export function useIncomingCall() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    const onMsg = (e: MessageEvent) => {
      const d = e.data as { type?: string; url?: string } | null
      if (!d || d.type !== 'bis-incoming-call' || typeof d.url !== 'string') return
      if (isInCall()) return // don't yank someone out of an active call
      try { if (new URLSearchParams(window.location.search).has('ring')) return } catch { /* */ }
      try { window.location.assign(d.url) } catch { /* */ }
    }
    navigator.serviceWorker.addEventListener('message', onMsg)
    return () => navigator.serviceWorker.removeEventListener('message', onMsg)
  }, [])
}
