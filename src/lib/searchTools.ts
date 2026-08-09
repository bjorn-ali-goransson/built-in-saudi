import type { Tool } from '../tools/types'
import { scoreTool, aboveFloor, correctQuery, vocabulary } from './fuzzy'
import { localizeTool, type Locale } from '../i18n'

/** Built once per tool list + locale; the vocabulary is a few thousand words. */
const vocabCache = new WeakMap<Tool[], Map<Locale, Set<string>>>()

function vocabFor(list: Tool[], locale: Locale): Set<string> {
  let byLocale = vocabCache.get(list)
  if (!byLocale) { byLocale = new Map(); vocabCache.set(list, byLocale) }
  let v = byLocale.get(locale)
  if (!v) {
    v = vocabulary(list.map((tool) => {
      const l = localizeTool(tool, locale)
      return { name: tool.name, nameAr: l.name, tagline: `${l.tagline} ${tool.tagline}`, category: `${l.category} ${tool.category}`, keywords: tool.keywords }
    }))
    byLocale.set(locale, v)
  }
  return v
}

export interface Ranked {
  tools: Tool[]
  /** Set when nothing matched what was typed and a corrected spelling did. */
  correctedTo?: string
}

/**
 * As `rankTools`, but reporting a spelling correction when one was needed.
 *
 * The correction is a FALLBACK: it only runs when the normal path found nothing
 * worth showing, so no query that works today can be re-ranked by it. Measured
 * before it existed, 2 of 23 realistic mistypings returned an empty page.
 */
export function rankToolsWithCorrection(query: string, list: Tool[], locale: Locale): Ranked {
  const tools = rankTools(query, list, locale)
  if (tools.length || !query.trim()) return { tools }
  const corrected = correctQuery(query, vocabFor(list, locale))
  if (!corrected) return { tools }
  const second = rankTools(corrected, list, locale)
  // Silence beats a correction that also finds nothing — showing "results for
  // <something else>" above an empty page is worse than the empty page.
  return second.length ? { tools: second, correctedTo: corrected } : { tools }
}

/**
 * Rank a list of tools against a query, the way the UI does.
 *
 * The home catalogue and the AppLauncher each carried an identical copy of this
 * — the two surfaces are documented as having to stay identical, and a copy is
 * how they stop being. The 404 page was about to be a third.
 *
 * The LIST is an argument rather than read from the registry, because the
 * difference between the callers is real: home ranks every tool, including the
 * coming-soon ones it renders as dimmed cards, while the launcher and the 404
 * suggestions rank only what you can actually open.
 */
export function rankTools(query: string, list: Tool[], locale: Locale): Tool[] {
  if (!query.trim()) return []
  const scored = list
    .map((tool) => {
      const l = localizeTool(tool, locale)
      // Fields stay separate rather than being concatenated: joining them let a
      // subsequence run off the end of one and into the start of the next, which
      // is a match nobody meant, and it destroyed the "starts at the beginning"
      // bonus that makes an exact name win.
      return {
        tool,
        score: scoreTool(query, {
          name: tool.name,
          nameAr: l.name,
          tagline: `${l.tagline} ${tool.tagline}`,
          category: `${l.category} ${tool.category}`,
          keywords: tool.keywords,
        }),
      }
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
  // Nothing capped the list before this: a query rendered every tool that
  // matched at all — 31 cards on average, three of them worth looking at.
  return aboveFloor(scored).map((r) => r.tool)
}

/**
 * A URL slug is not a sentence.
 *
 * `pdf-merge` has to become `pdf merge` before the scorer sees it, or the whole
 * thing is one token that matches nothing. Digits are separated too, so
 * `base64` and `base-64` reach the same place.
 */
export const slugToQuery = (slug: string): string =>
  slug.replace(/[-_]+/g, ' ').replace(/(\d+)/g, ' $1 ').trim()
