import { useCallback, useEffect, useState, type KeyboardEvent } from 'react'
import type { Tool } from '../tools/types'

/**
 * Arrow-key navigation of search results, shared by the home catalogue and the
 * AppLauncher.
 *
 * Enter-opens-the-top-result already existed and this file already records why:
 * without it you type and then reach for the mouse, which is the half of a
 * command palette that makes it worth having. **The arrows are the other half.**
 * Until now, choosing the SECOND result meant reaching for the mouse anyway —
 * and the second result is exactly what an ambiguous query needs. This repo has
 * measured several: «باركود» means both a QR code and a barcode in Saudi usage,
 * `ebook` means the reader or the writer, `calendar` means the ICS builder or
 * the Hijri one. On those the right answer is a keystroke away or a mouse away,
 * and the difference is the whole point of the box.
 *
 * Extracted rather than written twice even though there are only two callers.
 * The usual rule here is to extract on the third, but these two surfaces are
 * documented as having to behave identically, and a copy is precisely how they
 * stop — which is the same argument that moved the ranking into
 * `searchTools.ts`.
 */
export function useResultKeys(results: Tool[], open: (tool: Tool) => void) {
  const [active, setActive] = useState(0)

  // A new result list means the old index means nothing. Without this, typing
  // one more letter can leave the highlight on row 5 of a list that now has
  // two — and Enter then opens something the reader never looked at.
  useEffect(() => { setActive(0) }, [results])

  const onKeyDown = useCallback((e: KeyboardEvent) => {
    if (!results.length) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((i) => (i + 1) % results.length)
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => (i - 1 + results.length) % results.length)
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      // Clamped rather than trusted: the list can shrink between a keystroke
      // and the render that follows it.
      open(results[Math.min(active, results.length - 1)])
    }
  }, [results, active, open])

  return { active, onKeyDown }
}
