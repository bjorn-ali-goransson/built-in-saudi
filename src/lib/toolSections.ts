import { liveTools } from '../tools'
import { ADDED } from '../tools/added'
import type { Tool } from '../tools/types'
import { categoryLabel, type Locale } from '../i18n'

// Curated home sections, shared by the HomePage catalog and the AppLauncher so
// the two stay identical. The first two are hand-picked groupings that cut
// across the tools' own `category`; the rest fall back to their category order.
/**
 * The first thing a visitor sees, and it is a SAMPLE of the catalogue rather
 * than a list of favourites.
 *
 * Measured before it was changed: the old seven — an AI CV tool, a booking
 * tool, a video call, a QR generator and three Islamic tools — represented
 * **4 of 17 categories and NONE of the six largest**. Developer (26),
 * Saudi / Local (24), Text (24), Images (23), PDF (16) and Converters (14)
 * were all absent, so the opening screen of a 232-tool site taught almost
 * nothing about what it is strongest at.
 *
 * Now eight, chosen so the big families each show one: `pdf-to-word` because
 * PDF-to-Word is recorded here as the most-requested PDF task on the web,
 * `image-compressor` because making a photo smaller is the commonest thing
 * anybody asks of an image, `gosi-salary` for the Saudi wedge, `translate`
 * because on-device AI is the clearest statement of the privacy stance.
 *
 * **Developer stays out on purpose.** It is the largest family and the one
 * best served by search — `ownname.mjs` measures its tools winning their own
 * names outright, because the people who want a regex tester know it is called
 * a regex tester. The showcase is for the visitor who does not yet know what
 * to ask for.
 *
 * Dropping a tool from here does not hide it: Recommended is CONSUMED from the
 * categories, so `book-me`, `islamic-calendar` and `qibla` simply move back
 * into their own sections, and the Duʿāʾ row is untouched.
 */
const RECOMMENDED = ['ats-cv-optimizer', 'prayer-times', 'pdf-to-word', 'image-compressor',
  'gosi-salary', 'qr-code', 'translate', 'calls']
const DUA = ['istikhara', 'adhkar', 'hisn-al-muslim']
const CATEGORY_ORDER = ['Saudi / Local', 'Islamic', 'Arabic', 'Text', 'Converters', 'Calculators', 'Health', 'Time & Date',
  'Images', 'PDF', 'Files', 'Developer', 'Web', 'Generators', 'Design', 'Business', 'Communication']

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
/** How many to show, and how stale the newest may be before the row goes away. */
const NEW_COUNT = 6
const NEW_MAX_DAYS = 14

/**
 * The most recently added tools — by COUNT, not by a date window.
 *
 * Measured before choosing: additions are bursty. 63 tools landed on one day
 * and 47 on another, with single-tool days in between, so "everything from the
 * last 30 days" would show 63 tools or none depending on when you looked. The
 * newest six is stable whatever the shipping rhythm.
 *
 * **But the row disappears when the newest is more than a fortnight old.** A
 * "recently added" row over tools from last month is a lie of the cheap kind,
 * and a site that stops shipping should stop claiming to have news. That is
 * also what keeps this honest without anyone maintaining it.
 *
 * Dates come from `tools/added.ts`, generated from git — see
 * `scripts/gen-tool-dates.mjs`. A hand-typed date is a thing 216 files can
 * disagree about and nobody can check.
 */
function newlyAdded(): Tool[] {
  const dated = liveTools
    .map((t) => ({ t, when: ADDED[t.id] }))
    .filter((x): x is { t: Tool; when: string } => !!x.when)
    .sort((a, b) => b.when.localeCompare(a.when))
  if (!dated.length) return []
  const newest = Date.parse(dated[0].when)
  if (!Number.isFinite(newest)) return []
  if (Date.now() - newest > NEW_MAX_DAYS * 86400000) return []
  return dated.slice(0, NEW_COUNT).map((x) => x.t)
}

export function buildToolSections(locale: Locale, recentIds: string[] = []): ToolSection[] {
  const used = new Set<string>()
  const pick = (ids: string[]) => ids.map((id) => liveTools.find((tl) => tl.id === id)).filter((tl): tl is Tool => !!tl)
  const out: ToolSection[] = []
  const rec = pick(RECOMMENDED); rec.forEach((tl) => used.add(tl.id))
  // Neither Recently used nor Recently added is CONSUMED: both change on their
  // own, and a catalogue whose sections reshuffle because of the calendar is
  // worse than a slightly repeated tile.
  const dua = pick(DUA); dua.forEach((tl) => used.add(tl.id))
  const recent = recentIds
    .map((id) => liveTools.find((tl) => tl.id === id))
    .filter((tl): tl is Tool => !!tl)
  if (recent.length) out.push({ key: '__recent', title: locale === 'ar' ? 'استخدمتها مؤخرًا' : 'Recently used', tools: recent })
  out.push({ key: '__rec', title: locale === 'ar' ? 'موصى به' : 'Recommended', tools: rec })
  const added = newlyAdded()
  if (added.length) out.push({ key: '__new', title: locale === 'ar' ? 'أُضيفت حديثًا' : 'Recently added', tools: added })
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
