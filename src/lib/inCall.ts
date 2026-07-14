// A tiny cross-module flag: is the user currently in an active call? The deploy
// auto-reload (useVersionCheck) checks this so it never yanks someone out of a
// live call — the reload is deferred until the call ends (the poll keeps running).
let active = false
export const setInCall = (v: boolean) => { active = v }
export const isInCall = () => active
