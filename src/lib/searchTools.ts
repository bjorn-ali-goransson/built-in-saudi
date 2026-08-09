import type { Tool } from '../tools/types'
import { scoreTool, aboveFloor } from './fuzzy'
import { localizeTool, type Locale } from '../i18n'

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
