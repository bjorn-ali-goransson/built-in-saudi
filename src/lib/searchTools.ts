import type { Tool } from '../tools/types'
import { normaliseQuery } from './normaliseQuery'
import { preferDirection } from './searchDirection'
import { numericIntent } from './numericIntent'
import { scoreTool, aboveFloor, correctQuery, stripArabicPrefixes, vocabulary } from './fuzzy'
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
/**
 * How much better the corrected query must score before it is preferred over
 * results the typed query DID find.
 *
 * Measured: where a typo genuinely misled, the corrected query scores about
 * twice as well — `pdf mrege` finds `pdf-edit` at 224 and `pdf merge` finds
 * `pdf-merge` at 444; `passowrd generator` finds `meme-generator` at 190 and
 * the corrected query finds the right tool at 450. Where the typed query was
 * fine, there is no correction to compare against at all, because every term is
 * in the vocabulary. 1.5 sits well below both gaps and well above noise.
 */
const CORRECTION_RATIO = 1.5

export function rankToolsWithCorrection(raw: string, list: Tool[], locale: Locale): Ranked {
  // Normalised HERE rather than in each caller, so home, the launcher and the
  // 404 suggestions cannot drift apart on it — the same reason the ranking
  // itself lives in this file.
  const normalised = normaliseQuery(raw)
  if (!normalised.trim()) return { tools: [] }
  // Arabic particles agglutinate to the front of the word, so the query can
  // CONTAIN the indexed term rather than equal it. Stripped only onto a word
  // the catalogue knows, which is what stops it mangling «كتاب».
  const query = stripArabicPrefixes(normalised, vocabFor(list, locale))
  const asTyped = scoreList(query, list, locale)
  // When the query IS the number — `1080x1080`, `20% of 250`, `utc+3` — the
  // scorer has no words to match and returns nothing. Tried ONLY on an empty
  // result, so a query that already found something is never re-ranked and no
  // bench can move.
  if (!asTyped.length) {
    const shaped = numericIntent(query)
    if (shaped) {
      const byShape = scoreList(shaped, list, locale)
      if (byShape.length) return { tools: byShape.map((r) => r.tool) }
    }
  }
  const corrected = correctQuery(query, vocabFor(list, locale))
  // A query whose every word the catalogue knows has nothing to correct, which
  // is why a correctly spelled query can never be re-ranked by this.
  if (!corrected) return { tools: asTyped.map((r) => r.tool) }

  const second = scoreList(corrected, list, locale)
  // Silence beats a correction that also finds nothing — showing "results for
  // <something else>" above an empty page is worse than the empty page.
  if (!second.length) return { tools: asTyped.map((r) => r.tool) }
  if (!asTyped.length) return { tools: second.map((r) => r.tool), correctedTo: corrected }

  // Both found something. Prefer the correction only when it is decisively
  // better — a typo that still matched something plausible is the case where a
  // small edge means nothing.
  if (second[0].score < asTyped[0].score * CORRECTION_RATIO) {
    return { tools: asTyped.map((r) => r.tool) }
  }
  // Same tool at the top either way — the site indexes both -ise and -ize
  // spellings on purpose, so "summarise" already finds the summarizer. Leave
  // the typed query's results ALONE rather than merely hiding the notice:
  // re-ranking everything below a result that was already right is a change
  // with no upside, and the whole point of this path is that it cannot touch a
  // query that worked.
  if (second[0].tool.id === asTyped[0].tool.id) return { tools: asTyped.map((r) => r.tool) }
  return { tools: second.map((r) => r.tool), correctedTo: corrected }
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
function scoreList(query: string, list: Tool[], locale: Locale): { tool: Tool; score: number }[] {
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
  // A converter and its inverse are the same query to the scorer, because word
  // order is discarded on purpose. This is the ONLY place that word order is
  // allowed to matter, and only to break a tie between two tools that declare
  // each other. Applied after the floor, so it can never resurrect a tool the
  // floor cut.
  const shown = aboveFloor(scored)
  const reordered = preferDirection(
    query,
    shown.map((r) => ({
      id: r.tool.id,
      names: [r.tool.name, localizeTool(r.tool, locale).name],
      inverse: r.tool.inverse,
      score: r.score,
      r,
    })),
  )
  return reordered.map((x) => x.r)
}

export function rankTools(raw: string, list: Tool[], locale: Locale): Tool[] {
  const normalised = normaliseQuery(raw)
  if (!normalised.trim()) return []
  // Both entry points strip, or the 404 suggestions and the launcher would
  // disagree with home about what an Arabic query says — the drift this file
  // exists to prevent.
  const query = stripArabicPrefixes(normalised, vocabFor(list, locale))
  const scored = scoreList(query, list, locale)
  if (!scored.length) {
    const shaped = numericIntent(query)
    if (shaped) return scoreList(shaped, list, locale).map((r) => r.tool)
  }
  return scored.map((r) => r.tool)
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
