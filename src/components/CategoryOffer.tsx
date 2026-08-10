import { Link } from 'react-router-dom'
import { useLocale, localePath, categoryLabel } from '../i18n'
import { matchCategory } from '../lib/categoryMatch'
import { categorySlug } from '../lib/categorySlug'
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
 * Deliberately NOT part of the arrow-key result list. Those keys walk the
 * tools, and slipping a differently-shaped row into that sequence would make
 * Enter mean two things depending on where you were. It is a link, so Tab
 * reaches it.
 */
export function CategoryOffer({ query, onNavigate }: { query: string; onNavigate?: () => void }) {
  const { locale, t } = useLocale()
  const category = matchCategory(query)
  const slug = category ? categorySlug(category) : undefined
  if (!category || !slug) return null

  const count = liveTools.filter((tool) => tool.category === category).length
  if (!count) return null

  return (
    <Link
      to={localePath(locale, `/c/${slug}/`)}
      onClick={onNavigate}
      data-testid="category-offer"
      data-category={slug}
      className="mb-4 flex items-center justify-between gap-4 rounded-[var(--r-md)] border border-green-500 bg-[color-mix(in_srgb,var(--color-green-400)_8%,transparent)] px-4 py-3 no-underline transition-[background,border-color] duration-[120ms] hover:bg-[color-mix(in_srgb,var(--color-green-400)_14%,transparent)]"
    >
      <span className="flex flex-col gap-[0.15rem]">
        <span className="font-display text-[1.05rem] text-ink rtl:font-ar">
          {t.search.allIn(categoryLabel(category, locale))}
        </span>
        <span className="text-[0.85rem] text-ink-faint rtl:font-ar" data-testid="category-offer-count">
          {t.search.toolCount(count)}
        </span>
      </span>
      <span aria-hidden className="text-green-700 text-[1.2rem] rtl:rotate-180">→</span>
    </Link>
  )
}
