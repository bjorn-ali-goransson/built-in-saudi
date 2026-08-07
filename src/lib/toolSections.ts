import { liveTools } from '../tools'
import type { Tool } from '../tools/types'
import { categoryLabel, type Locale } from '../i18n'

// Curated home sections, shared by the HomePage catalog and the AppLauncher so
// the two stay identical. The first two are hand-picked groupings that cut
// across the tools' own `category`; the rest fall back to their category order.
const RECOMMENDED = ['ats-cv-optimizer', 'book-me', 'calls', 'qr-code', 'prayer-times', 'islamic-calendar', 'qibla']
const DUA = ['istikhara', 'adhkar', 'hisn-al-muslim']
const CATEGORY_ORDER = ['Saudi / Local', 'Text', 'Converters', 'Calculators', 'Images', 'PDF', 'Files', 'Developer', 'Generators', 'Design', 'Business', 'Communication']

export interface ToolSection {
  key: string
  title: string
  tools: Tool[]
}

/**
 * Ordered, de-duplicated sections for the default (non-search) app catalog.
 *
 * `recentIds` prepends a shortcut row of the tools this person actually opened.
 * Unlike Recommended and Duʿāʾ, a recent tool is NOT consumed — it still
 * appears under its own category. Recents change as you use the site, and a
 * catalogue whose sections reshuffle because of what you opened yesterday is
 * worse than a slightly repeated tile.
 */
export function buildToolSections(locale: Locale, recentIds: string[] = []): ToolSection[] {
  const used = new Set<string>()
  const pick = (ids: string[]) => ids.map((id) => liveTools.find((tl) => tl.id === id)).filter((tl): tl is Tool => !!tl)
  const out: ToolSection[] = []
  const rec = pick(RECOMMENDED); rec.forEach((tl) => used.add(tl.id))
  const dua = pick(DUA); dua.forEach((tl) => used.add(tl.id))
  const recent = recentIds
    .map((id) => liveTools.find((tl) => tl.id === id))
    .filter((tl): tl is Tool => !!tl)
  if (recent.length) out.push({ key: '__recent', title: locale === 'ar' ? 'استخدمتها مؤخرًا' : 'Recently used', tools: recent })
  out.push({ key: '__rec', title: locale === 'ar' ? 'موصى به' : 'Recommended', tools: rec })
  out.push({ key: '__dua', title: locale === 'ar' ? 'دعاء وذكر' : 'Duʿāʾ & Dhikr', tools: dua })
  const cats = [...CATEGORY_ORDER, ...liveTools.map((tl) => tl.category).filter((c) => !CATEGORY_ORDER.includes(c))]
  const catSections: ToolSection[] = []
  for (const cat of cats) {
    const inCat = liveTools.filter((tl) => !used.has(tl.id) && tl.category === cat)
    if (!inCat.length) continue
    inCat.forEach((tl) => used.add(tl.id))
    catSections.push({ key: cat, title: categoryLabel(cat, locale), tools: inCat })
  }
  // A category with a single app doesn't earn its own heading — pool into "Other".
  out.push(...catSections.filter((s) => s.tools.length > 1))
  const singles = catSections.filter((s) => s.tools.length === 1).flatMap((s) => s.tools)
  if (singles.length) out.push({ key: '__other', title: locale === 'ar' ? 'أخرى' : 'Other', tools: singles })
  return out.filter((s) => s.tools.length)
}
