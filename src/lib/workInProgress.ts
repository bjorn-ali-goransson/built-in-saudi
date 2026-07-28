// "This tool is holding work the user would lose on reload" (#228).
//
// The deploy auto-reload exists so a stale tab doesn't break on hashed chunks, but
// reloading over an uploaded photo or a half-filled form destroys work the user
// can't get back. File objects can't be serialised to sessionStorage, so preserving
// arbitrary state across a reload isn't solvable in general — the honest answer is
// to NOT reload, and offer the update instead.
//
// Same shape as `inCall.ts`, which already guards live calls; this generalises it to
// any tool holding something.
const holders = new Set<string>()
const listeners = new Set<(busy: boolean) => void>()

function emit() {
  const busy = holders.size > 0
  for (const fn of listeners) fn(busy)
}

/** Mark (or clear) this tool as holding unsaved work. `key` should be stable per
 *  tool so remounting doesn't leak a holder. */
export function setWorkInProgress(key: string, holding: boolean) {
  const had = holders.has(key)
  if (holding) holders.add(key); else holders.delete(key)
  if (had !== holding) emit()
}

export const hasWorkInProgress = () => holders.size > 0

export function onWorkInProgressChange(fn: (busy: boolean) => void): () => void {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}
