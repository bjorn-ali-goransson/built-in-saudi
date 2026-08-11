import { Link } from 'react-router-dom'
import { useLocale, localePath } from '../i18n'
import { COLLECTIONS } from '../lib/collections'
import { collectionSeo } from '../i18n/seo'
import { liveTools } from '../tools'

/**
 * The groups the category tree cannot name, shown to somebody who is browsing.
 *
 * Measured 11 August 2026, a week after the collections shipped: the rendered
 * catalogue referenced them **nowhere**. `CategoryOffer` is the only component
 * that knows they exist, and it fires only when a query happens to name one —
 * so «رمضان», teaching, security, comparing and starting a business were
 * reachable by typing the right word, by a crawler reading the prerendered
 * block, or by landing on another group page. **A group whose existence can
 * only be learned by naming it is a group nobody learns about**, which is the
 * same argument that earned the collections their pages in the first place.
 *
 * It sits at the FOOT of the catalogue rather than in `SectionNav`. That bar
 * jumps to a heading on this page; a collection is a different page. One
 * control with two meanings is worse than two controls.
 */
export function CollectionRow() {
  const { locale } = useLocale()

  const rows = COLLECTIONS
    .map((c) => {
      const seo = collectionSeo.find((x) => x.slug === c.slug)
      // A collection's tool list is hand-written and checked against the
      // registry by `scripts/check-collections.mjs`; count only what is live so
      // the number cannot outlive a retired tool.
      const count = c.toolIds.filter((id) => liveTools.some((t) => t.id === id)).length
      return seo && count ? { slug: c.slug, name: seo[locale].name, count } : null
    })
    .filter((r): r is { slug: string; name: string; count: number } => r !== null)

  if (!rows.length) return null

  return (
    <div className="mt-14 pt-8 border-t border-[color:var(--line-soft)]" data-testid="collection-row">
      <div role="heading" aria-level={2}
        className="font-body text-[0.68rem] uppercase tracking-[0.06em] text-ink-faint mb-3 rtl:font-ar rtl:tracking-normal">
        {locale === 'ar' ? 'مجموعات تمتد عبر الأقسام' : 'Groups that cut across'}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {rows.map((r) => (
          <Link
            key={r.slug}
            to={localePath(locale, `/c/${r.slug}`)}
            data-testid={`collection-link-${r.slug}`}
            className="flex items-baseline gap-1.5 rounded-md border border-[color:var(--line)] bg-[var(--surface)] px-[0.7rem] py-[0.3rem] text-[0.82rem] text-ink-soft no-underline hover:border-[color-mix(in_srgb,var(--green-500)_35%,transparent)] hover:text-ink rtl:font-ar"
          >
            {r.name}
            <span className="text-[0.72rem] text-ink-faint tabular-nums">{r.count}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
