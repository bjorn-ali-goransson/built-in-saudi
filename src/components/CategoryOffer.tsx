import { Link } from 'react-router-dom'
import { useLocale, localePath, categoryLabel } from '../i18n'
import { matchGroup } from '../lib/categoryMatch'
import { normaliseQuery } from '../lib/normaliseQuery'
import { categorySlug } from '../lib/categorySlug'
import { collectionBySlug } from '../lib/collections'
import { collectionSeo } from '../i18n/seo'
import { liveTools } from '../tools'

/**
 * "You asked for a family — here is the family."
 *
 * Shown above the results when the query IS a category name. `tieprobe`
 * measured the problem: «حاسبة» is an 18-way tie between tools that all
 * contain the word, so the site answered it with one arbitrary calculator out
 * of twenty. The results are left exactly as they were — this is an offer, not
 * a re-ranking, which is why it cannot regress a bench.
 *
 * The query is normalised HERE rather than by the callers, so home and the
 * launcher cannot drift apart on it — the same argument that put
 * `normaliseQuery` inside `searchTools`'s entry points rather than at its two
 * call sites. `matchGroup` already folds case and punctuation itself, so this
 * buys exactly one shape, measured in `evals/offershapes.mjs`: a PASTED URL.
 * `built-in-saudi.com/en/c/pdf/` is the link a category page exists to be
 * shared at, and it was the one query naming a category that the offer did not
 * recognise.
 *
 * Deliberately NOT part of the arrow-key result list. Those keys walk the
 * tools, and slipping a differently-shaped row into that sequence would make
 * Enter mean two things depending on where you were. It is a link, so Tab
 * reaches it.
 */
export function CategoryOffer({ query, onNavigate }: { query: string; onNavigate?: () => void }) {
  const { locale, t } = useLocale()
  const hit = matchGroup(normaliseQuery(query))
  if (!hit) return null

  // A category is derived from the registry; a collection is curated, so its
  // count is of the tools that are actually live rather than of the list.
  const slug = hit.kind === 'category' ? categorySlug(hit.key) : hit.key
  const label = hit.kind === 'category'
    ? categoryLabel(hit.key, locale)
    : collectionSeo.find((c) => c.slug === hit.key)?.[locale].name
  const count = hit.kind === 'category'
    ? liveTools.filter((tool) => tool.category === hit.key).length
    : (collectionBySlug(hit.key)?.toolIds.filter((id) => liveTools.some((t) => t.id === id)).length ?? 0)
  if (!slug || !label || !count) return null

  return (
    <Link
      to={localePath(locale, `/c/${slug}/`)}
      onClick={onNavigate}
      data-testid="category-offer"
      data-category={slug}
      data-kind={hit.kind}
      className="mb-4 flex items-center justify-between gap-4 rounded-[var(--r-md)] border border-green-500 bg-[color-mix(in_srgb,var(--color-green-400)_8%,transparent)] px-4 py-3 no-underline transition-[background,border-color] duration-[120ms] hover:bg-[color-mix(in_srgb,var(--color-green-400)_14%,transparent)]"
    >
      <span className="flex flex-col gap-[0.15rem]">
        <span className="font-display text-[1.05rem] text-ink rtl:font-ar">
          {t.search.allIn(label)}
        </span>
        <span className="text-[0.85rem] text-ink-faint rtl:font-ar" data-testid="category-offer-count">
          {t.search.toolCount(count)}
        </span>
      </span>
      <span aria-hidden className="text-green-700 text-[1.2rem] rtl:rotate-180">→</span>
    </Link>
  )
}
