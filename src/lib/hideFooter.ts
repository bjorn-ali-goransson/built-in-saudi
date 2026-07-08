// A tiny external store so a tool (e.g. the CV Generator's immersive preview)
// can ask the shared Layout to hide the site footer while it's on screen.
let hidden = false
const subs = new Set<() => void>()

export const hideFooterStore = {
  set(v: boolean) {
    if (v === hidden) return
    hidden = v
    subs.forEach((f) => f())
  },
  subscribe(f: () => void) {
    subs.add(f)
    return () => { subs.delete(f) }
  },
  get() {
    return hidden
  },
}
