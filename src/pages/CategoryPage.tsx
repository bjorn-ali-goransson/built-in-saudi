import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { liveTools, tools } from '../tools'
import { ToolGrid } from '../components/ToolCatalog'
import { categoryFromSlug } from '../lib/categorySlug'
import { categorySeo } from '../i18n/seo'
import { useDocumentMeta } from '../lib/useDocumentMeta'
import { useLocale, localePath, categoryLabel } from '../i18n'
import { NotFoundPage } from './NotFoundPage'

/**
 * A landing page for one category, at /<locale>/c/<slug>/.
 *
 * The catalogue's sections were an in-page jump and nothing else: a category
 * could not be linked to, shared, or landed on from a search engine. "Free PDF
 * tools" is the shape of query people type, and the only page this site had to
 * answer it was the home page, which lists all 207 and is therefore about
 * nothing in particular.
 *
 * Every one of these is prerendered in both locales with its own title and
 * description (`categorySeo`), and each links to all the others, so the set is
 * crawlable from any member as well as from the catalogue's section headings.
 */
export function CategoryPage() {
  const { locale } = useLocale()
  const { slug = '' } = useParams()
  const category = categoryFromSlug(slug)
  const seo = categorySeo.find((c) => c.slug === slug.toLowerCase())

  // Hooks must run before any early return, so the meta is computed for a bad
  // slug too and simply never rendered.
  useDocumentMeta(
    locale,
    `/c/${slug.toLowerCase()}`,
    seo?.[locale].name,
    seo?.[locale].description,
  )

  const inCategory = useMemo(
    () => (category ? liveTools.filter((t) => t.category === category) : []),
    [category],
  )
  const indexOf = useMemo(() => new Map(tools.map((t, i) => [t.id, i])), [])

  // An unknown slug is a 404, not an empty page pretending to be a category.
  if (!category || !seo || !inCategory.length) return <NotFoundPage />

  const s = seo[locale]
  const others = categorySeo.filter((c) => c.slug !== seo.slug)

  return (
    <section className="wrap pt-[clamp(1.2rem,4vw,2rem)] pb-[clamp(3rem,8vw,5.5rem)]" data-testid="category-page" data-category={category}>
      <nav className="mb-4 text-[0.85rem] text-ink-faint">
        <Link to={localePath(locale)} className="text-ink-soft no-underline hover:underline rtl:font-ar">
          {locale === 'ar' ? 'كل الأدوات' : 'All tools'}
        </Link>
        <span className="mx-2" aria-hidden="true">/</span>
        <span className="rtl:font-ar">{categoryLabel(category, locale)}</span>
      </nav>

      <h1 className="font-display text-[clamp(1.6rem,4vw,2.3rem)] text-ink mb-2 rtl:font-ar" data-testid="category-title">{s.name}</h1>
      <p className="text-[1rem] text-ink-soft max-w-[62ch] mb-2 rtl:font-ar">{s.description}</p>
      <p className="text-[0.85rem] text-ink-faint mb-7 rtl:font-ar" data-testid="category-count">
        {locale === 'ar' ? `${inCategory.length} أداة` : `${inCategory.length} tool${inCategory.length === 1 ? '' : 's'}`}
      </p>

      <ToolGrid tools={inCategory} indexOf={(id) => indexOf.get(id) ?? 0} />

      {/* Every category links to every other one. Fifteen pages that each link
          only back to home is fifteen leaves; this makes the set a graph a
          crawler can walk from any member. */}
      <div className="mt-12" data-testid="category-others">
        <div role="heading" aria-level={2} className="font-body text-[0.8rem] font-medium tracking-[0.02em] text-ink-faint mb-3 rtl:font-ar">
          {locale === 'ar' ? 'فئات أخرى' : 'Other categories'}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {others.map((c) => (
            <Link
              key={c.slug}
              to={localePath(locale, `/c/${c.slug}`)}
              data-testid={`category-link-${c.slug}`}
              className="rounded-md border border-[color:var(--line)] bg-[var(--surface)] px-[0.7rem] py-[0.3rem] text-[0.82rem] text-ink-soft no-underline hover:border-[color-mix(in_srgb,var(--green-500)_35%,transparent)] hover:text-ink rtl:font-ar"
            >
              {categoryLabel(c.category, locale)}
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
