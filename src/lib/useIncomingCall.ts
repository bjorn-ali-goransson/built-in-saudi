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
      if (!d) return
      // A caller gave up before being answered — the SW has queued the missed
      // call; let whoever is showing the list (and a now-pointless ringing
      // screen) react to it.
      if (d.type === 'bis-missed-call') { try { window.dispatchEvent(new Event('bis-call-missed')) } catch { /* */ } return }
      // A direct message from a contact arrived — the SW has queued it; let whoever
      // is showing threads pick it up.
      if (d.type === 'bis-dm') { try { window.dispatchEvent(new Event('bis-dm')) } catch { /* */ } return }
      if (d.type !== 'bis-incoming-call' || typeof d.url !== 'string') return
      // Already in a call → don't yank them out. Hand the ring to the live Calls UI
      // (a "someone's calling, you're busy" banner) instead of dropping it silently.
      if (isInCall()) { try { window.dispatchEvent(new CustomEvent('bis-incoming-ring', { detail: { url: d.url } })) } catch { /* */ } return }
      try { if (new URLSearchParams(window.location.search).has('ring')) return } catch { /* */ }
      try { window.location.assign(d.url) } catch { /* */ }
    }
    navigator.serviceWorker.addEventListener('message', onMsg)
    return () => navigator.serviceWorker.removeEventListener('message', onMsg)
  }, [])
}
