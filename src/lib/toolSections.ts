import { liveTools } from '../tools'
import { ADDED } from '../tools/added'
import { VIEWS, MEASURED } from '../tools/popularity'
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
  'word-editor', 'qr-code', 'translate', 'calls']
const DUA = ['istikhara', 'adhkar', 'hisn-al-muslim']
const CATEGORY_ORDER = ['Saudi / Local', 'Islamic', 'Arabic', 'Office', 'Text', 'Calculators',
  'Images', 'PDF', 'Files', 'Developer', 'Generators', 'Business', 'Communication']

export interface ToolSection {
  key: string
  title: string
  tools: Tool[]
  /** Demoted: on the page behind a "more" toggle rather than in the grid. */
  more?: Tool[]
}

/**
 * Demoting the tools nobody opens, by MEASUREMENT rather than by taste.
 *
 * `tools/popularity.ts` is generated from the site's own analytics. Within each
 * category the tiles are ordered by how often the tool's page was viewed, and a
 * tool viewed `DEMOTE_AT` times or fewer goes behind a "N more" toggle at the
 * foot of its section. Measured over Aug–Oct 2026: 2,664 tool pageviews, and
 * **101 of 240 tools had two or fewer** — so the catalogue spent most of its
 * screens on tiles almost nobody chose, and pushed the ones people do choose
 * further down.
 *
 * Three things a tool is NEVER demoted for:
 *
 * - **It could not have been measured.** A tool with no row was added after the
 *   counting ended, and one added within `FAIR_CHANCE_DAYS` of its end had too
 *   little time on the site for its count to mean anything. "Nobody opened it"
 *   and "nobody could have" are different statements.
 * - **It is essential** (`ESSENTIAL`, each with its reason). Some tools are the
 *   site's reason to exist or are what a visitor checks a toolbox for, and
 *   their traffic says more about a young site's audience than about them.
 * - **It would empty its section.** At least `MIN_VISIBLE` tiles stay up, or a
 *   category heading sits over a lone "more" button — a section that exists to
 *   be skipped.
 *
 * This is the HOME catalogue and the launcher only. Search ranks over the
 * registry, untouched, so a demoted tool is exactly as findable by name as it
 * was; its category page still lists it; and the registry order — which breaks
 * search ties by design — is not changed by any of this.
 */
const DEMOTE_AT = 2
const FAIR_CHANCE_DAYS = 30
const MIN_VISIBLE = 3
const ESSENTIAL = new Set<string>([
  // Every tool that stayed through the November 2026 cut earned its place by
  // being used; the no-traffic "staples" this list used to protect were the
  // ones that went. Kept as a mechanism so a genuinely essential tool can be
  // named here with its reason, rather than as a list of habits.
])

const DAY = 86400000
const measuredUntil = Date.parse(MEASURED.to)

/** True when a tool's count is a fair measurement of interest in it. */
function measurable(id: string): boolean {
  if (VIEWS[id] === undefined) return false
  const added = Date.parse(ADDED[id] ?? '')
  return Number.isFinite(added) && measuredUntil - added >= FAIR_CHANCE_DAYS * DAY
}

/** Popular first; an unmeasured tool leads, since leading is how it gets a chance. Ties keep catalogue order. */
function byViews(tools: Tool[]): Tool[] {
  const key = (t: Tool) => (VIEWS[t.id] === undefined ? Infinity : VIEWS[t.id])
  return tools.map((t, i) => ({ t, i })).sort((a, b) => key(b.t) - key(a.t) || a.i - b.i).map((x) => x.t)
}

/** Split a section into what shows and what waits behind "more". */
export function demote(tools: Tool[]): { tools: Tool[]; more: Tool[] } {
  const sorted = byViews(tools)
  const shown: Tool[] = []
  const more: Tool[] = []
  for (const t of sorted) {
    const low = measurable(t.id) && VIEWS[t.id] <= DEMOTE_AT && !ESSENTIAL.has(t.id)
    ;(low ? more : shown).push(t)
  }
  while (shown.length < MIN_VISIBLE && more.length) shown.push(more.shift()!)
  return { tools: shown, more }
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
  const grouped = catSections.filter((s) => s.tools.length > 1)
  const singles = catSections.filter((s) => s.tools.length === 1).flatMap((s) => s.tools)
  if (singles.length) grouped.push({ key: '__other', title: locale === 'ar' ? 'أخرى' : 'Other', tools: singles })
  // Only the CATEGORY sections are demoted. The curated rows above are short
  // and hand-picked, and Recently used is the visitor's own history.
  for (const sec of grouped) {
    const { tools, more } = demote(sec.tools)
    out.push(more.length ? { ...sec, tools, more } : { ...sec, tools })
  }
  return out.filter((s) => s.tools.length)
}
