import { useEffect, useState } from 'react'
import { isInCall, onCallExit } from './inCall'
import { hasWorkInProgress, onWorkInProgressChange } from './workInProgress'

/**
 * Detect a new deploy and reload so open tabs don't break on stale, hashed
 * lazy-chunks. The build stamps <meta name="build"> in the shell and writes a
 * matching /version.json; we poll it and reload when it changes. A sessionStorage
 * flag lets a post-reload toast explain what happened.
 *
 * Reloading is never worth destroying work (#228). If a tool is holding an uploaded
 * file, a decoded image or a filled form, we do NOT reload — File objects can't be
 * serialised, so there is no honest way to restore them afterwards. Instead the new
 * build is offered and the user reloads when they're ready.
 */
const RELOAD_TARGET = 'bis-reload-target' // the build a reload was trying to reach

/** What the shell should be showing while the check runs / a reload is imminent. */
export type UpdateState =
  | { phase: 'idle' }
  /** The check is taking long enough that the user shouldn't keep typing. */
  | { phase: 'checking' }
  /** Reloading now — block input so nothing is typed into a doomed page. */
  | { phase: 'reloading' }
  /** A new build exists but work is in progress; the user decides when. */
  | { phase: 'offered'; notes: string; apply: () => void }

// The check answers in ~330ms in practice, so this rarely fires — but on a slow
// network the user should be told rather than left wondering.
const SLOW_MS = 500

export function useVersionCheck(): UpdateState {
  const [state, setState] = useState<UpdateState>({ phase: 'idle' })

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
    // A trigger that arrives mid-check is remembered, not dropped. The check in
    // flight was started BEFORE the newer build was published, so it answers
    // "nothing new" and the user's return-to-tab is silently lost — they then
    // wait out the 60s poll on a stale shell.
    let queued: false | { force: boolean } = false
    let reloading = false
    let pendingBuild = ''  // a build we've deferred because work is in progress

    const applyReload = (build: string, notes: string) => {
      reloading = true
      setState({ phase: 'reloading' })
      try {
        sessionStorage.setItem(RELOAD_TARGET, String(build))
        sessionStorage.setItem('bis-reloaded', 'update')
        if (notes) sessionStorage.setItem('bis-update-notes', String(notes))
      } catch { /* ignore */ }
      // One frame, so the blocking overlay actually paints before the tab goes.
      requestAnimationFrame(() => window.location.reload())
    }

    // `force` bypasses the in-call guard. The periodic poll never yanks someone out
    // of a live call, but returning to the tab after being away (visibility/focus)
    // does reload even mid-call — if you were away, the call is likely stale and you
    // should land on the latest version (#206).
    const check = async (force = false) => {
      if (reloading) return
      if (checking) { queued = { force: force || (queued ? queued.force : false) }; return }
      checking = true
      // Only show the blocking "checking" state if it's actually slow; a normal
      // ~330ms check should be invisible.
      const slow = window.setTimeout(() => { if (!reloading) setState({ phase: 'checking' }) }, SLOW_MS)
      try {
        const res = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' })
        if (!res.ok) return
        const { build, notes } = await res.json()
        if (stopped || !build || build === current) return
        if (build === attempted) return // we already reloaded for this build and got a stale shell
        if (!force && isInCall()) return // periodic poll: don't interrupt a live call
        // Work in progress → offer it, never take it. An uploaded file or a filled
        // form cannot be restored after a reload, so the user chooses the moment.
        if (hasWorkInProgress()) {
          pendingBuild = String(build)
          setState({ phase: 'offered', notes: String(notes || ''), apply: () => applyReload(String(build), String(notes || '')) })
          return
        }
        applyReload(String(build), String(notes || ''))
      } catch { /* offline / transient — ignore */ } finally {
        window.clearTimeout(slow)
        checking = false
        // Don't clobber an offer or an in-flight reload.
        setState((s) => (s.phase === 'checking' ? { phase: 'idle' } : s))
        if (queued && !stopped && !reloading) {
          const again = queued
          queued = false
          void check(again.force)
        }
      }
    }

    const id = window.setInterval(check, 60000)
    // Returning to the tab (visibility) or re-focusing the window (browser reopened /
    // alt-tabbed back) forces a check that reloads even mid-call (#206).
    const onReturn = () => { if (!document.hidden) check(true) }
    document.addEventListener('visibilitychange', onReturn)
    window.addEventListener('focus', onReturn)
    onCallExit(() => check()) // leaving a call (hang-up or Back) → apply a deferred deploy now
    // The moment the user's work is done, a deferred update can go in by itself.
    const offWork = onWorkInProgressChange((busy) => {
      if (!busy && pendingBuild && !reloading) check(true)
    })
    return () => {
      stopped = true
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', onReturn)
      window.removeEventListener('focus', onReturn)
      onCallExit(() => {})
      offWork()
    }
  }, [])

  return state
}
