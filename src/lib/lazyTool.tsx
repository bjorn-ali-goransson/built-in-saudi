import { lazy, type ComponentType } from 'react'

/**
 * React.lazy for tool components, hardened against the classic stale-chunk error:
 * after a redeploy the hashed chunk filename changes, so an old tab's dynamic
 * import 404s ("Failed to fetch dynamically imported module"). We catch that at
 * the import site and reload once to pull the fresh build (guarded against loops).
 */
export function lazyTool<T extends ComponentType<unknown>>(factory: () => Promise<{ default: T }>) {
  return lazy(() =>
    factory().catch((err: unknown) => {
      if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('bis-chunk-reload') !== '1') {
        try {
          sessionStorage.setItem('bis-chunk-reload', '1')
          sessionStorage.setItem('bis-reloaded', 'update')
        } catch { /* ignore */ }
        window.location.reload()
      }
      throw err
    }),
  )
}
