// A tiny cross-module flag: is the user currently in an active call? The deploy
// auto-reload (useVersionCheck) checks this so it never yanks someone out of a
// live call — and runs an immediate check the moment the call ends (so a deploy
// deferred during the call applies right away, on hang-up or Back).
let active = false
let onExit: (() => void) | null = null
export const setInCall = (v: boolean) => { const was = active; active = v; if (was && !v) onExit?.() }
export const isInCall = () => active
export const onCallExit = (fn: () => void) => { onExit = fn }
