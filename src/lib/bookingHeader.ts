// A tiny external store so the (async-loaded) booking page can set the navbar
// title shown by the shared Header. Empty string → Header shows its default.
let title = ''
const subs = new Set<() => void>()

export const bookingHeaderStore = {
  set(v: string) {
    if (v === title) return
    title = v
    subs.forEach((f) => f())
  },
  subscribe(f: () => void) {
    subs.add(f)
    return () => { subs.delete(f) }
  },
  get() {
    return title
  },
}
