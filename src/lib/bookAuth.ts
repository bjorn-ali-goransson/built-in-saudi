// Whether the Book Me host is signed in, as an external store (#233).
//
// The Header used to read `localStorage.getItem('bis-bookwith-hsid')` inline during
// render. A plain localStorage read isn't reactive, so after the OAuth round-trip the
// tool had a session but the Header never re-rendered — leaving "Log in" on screen
// until a full reload. The tool now pushes its session state here and the Header
// subscribes, exactly as the CV Generator already does via cvHeader.ts.
export type BookAuth = { active: boolean; signedIn: boolean }

let state: BookAuth = { active: false, signedIn: false }
const subs = new Set<() => void>()

export const bookAuthStore = {
  set(v: BookAuth) {
    // Skip identical writes so subscribers don't re-render on every tool render.
    if (v.active === state.active && v.signedIn === state.signedIn) return
    state = v
    subs.forEach((f) => f())
  },
  subscribe(f: () => void) {
    subs.add(f)
    return () => { subs.delete(f) }
  },
  get() {
    return state
  },
}
