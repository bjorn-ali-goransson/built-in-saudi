// When the query names a whole FAMILY, offer the family.
//
// Measured with `node evals/tieprobe.mjs`, which asked something nobody had
// asked before: how often is the top result decided by a coin toss? Ties
// falling through to catalogue order is deliberate and documented — an
// editorial judgement about which of two tools is primary — and on the benched
// queries it is rare (4.4%, 0 three-way) and almost always right: `qr` goes to
// the generator, `password` to the generator.
//
// It falls apart on a **generic** word. Over the 1,522 single-word keywords in
// the catalogue, 161 tie and 45 are three-way or wider:
//
//   حاسبة (calculator)              18-way tie
//   image                            7-way
//   arabic · رمضان · معلم · تصدير    6-way
//   word                             5-way
//   generator                        4-way
//
// Eighteen tools scoring identically is not an editorial judgement about which
// is primary. It is eighteen tools that contain one word, and the catalogue
// order between them carries no meaning — so the site answered «حاسبة» with one
// arbitrary calculator out of twenty.
//
// **The fix is a product answer, not a scoring one.** A coverage/name-length
// tie-break was already tried and rejected on measurement, and it could not
// have helped here anyway: those tools really are equally good matches for that
// word. What somebody typing «حاسبة» wants is the CATEGORY — and this site has
// had a page per category for a while, reachable only from the catalogue's own
// section headings and from each other.
//
// So a query that NAMES a category offers the category page above the results.
// The results themselves are untouched: this is an offer, not a re-ranking,
// which is why it cannot regress any bench.

/**
 * The words people actually type for each category.
 *
 * Written out rather than derived from the label, for a reason this repo has
 * now hit three times: **the Arabic label is a plural and the query is a
 * singular.** «حاسبة» is neither a substring nor a subsequence of the label
 * «حاسبات» — the ة is simply not in it — so matching the label alone fires on
 * none of the queries this exists for. English has the same problem in the
 * other direction (`calculator` against `Calculators`), milder and still real.
 *
 * Deliberately NOT a synonym dump. This card sits ABOVE real results, so a
 * loose term costs more than a missing one.
 */
const CATEGORY_TERMS: Record<string, string[]> = {
  Calculators: ['calculator', 'calc', 'maths', 'math', 'حاسبة', 'حاسبات', 'حساب', 'حاسبه'],
  Health: ['health', 'medical', 'fitness', 'صحة', 'صحي', 'طبي', 'لياقة'],
  'Time & Date': ['time', 'date', 'clock', 'وقت', 'زمن', 'تاريخ', 'ساعة'],
  Images: ['image', 'photo', 'picture', 'pic', 'صورة', 'صور', 'صوره'],
  PDF: ['pdf'],
  Text: ['text', 'نص', 'نصوص', 'كتابة'],
  Arabic: ['arabic', 'عربي', 'عربية', 'اللغة العربية', 'لغة عربية'],
  Islamic: ['islamic', 'islam', 'muslim', 'إسلامي', 'إسلامية', 'إسلاميات', 'مسلم'],
  'Saudi / Local': ['saudi', 'saudi arabia', 'ksa', 'سعودي', 'سعودية', 'السعودية'],
  Developer: ['developer', 'programming', 'programmer', 'مطور', 'مطورين', 'برمجة', 'مبرمج'],
  Web: ['web', 'website', 'ويب', 'موقع'],
  Design: ['design', 'designer', 'تصميم', 'مصمم'],
  Converters: ['converter', 'convert', 'محول', 'محولات', 'تحويل'],
  Generators: ['generator', 'generate', 'مولد', 'مولدات', 'توليد'],
  Files: ['file', 'ملف', 'ملفات'],
  Business: ['business', 'accounting', 'أعمال', 'محاسبة'],
  Communication: ['communication', 'تواصل', 'اتصال'],
  Utilities: ['utility', 'أداة'],
}

/**
 * The same, for the curated COLLECTIONS that cut across the categories
 * (`lib/collections.ts`).
 *
 * Measured: after the category offer shipped, 46 single-word queries still tied
 * three ways or wider and only 9 named a category. The widest of the rest are
 * these — a season, an audience and a verb, each picking tools out of four or
 * five different categories, so no recategorising could ever reach them.
 */
const COLLECTION_TERMS: Record<string, string[]> = {
  ramadan: ['ramadan', 'ramadhan', 'رمضان', 'رمضانية', 'صيام', 'صوم'],
  teaching: ['teacher', 'teaching', 'school', 'classroom', 'معلم', 'معلمة', 'مدرس', 'مدرسة', 'تعليم', 'فصل دراسي'],
  compare: ['compare', 'comparison', 'diff', 'difference', 'مقارنة', 'قارن', 'الفرق', 'فرق'],
  security: ['security', 'privacy', 'secure', 'encryption', 'أمان', 'خصوصية', 'تشفير', 'حماية'],
  // Deliberately NOT «سجل تجاري» or «فاتورة»: those name one tool, and the
  // offer's whole value is that it appears only when somebody asked for a
  // family. These are the phrasings that name the audience.
  'new-business': [
    'starting a business', 'start a business', 'new business', 'small business',
    'freelance', 'freelancer', 'self employed', 'entrepreneur',
    'بدء مشروع', 'مشروع تجاري', 'نشاط تجاري', 'منشأة', 'رواد الأعمال',
    'عمل حر', 'صاحب عمل', 'مشروع صغير',
  ],
}

/** Words that decorate a category query without changing which one it is. */
const NOISE = new Set([
  'free', 'online', 'tool', 'tools', 'app', 'apps', 'best',
  'مجاني', 'مجانية', 'أداة', 'أدوات', 'تطبيق', 'تطبيقات', 'اونلاين', 'أونلاين',
])

/**
 * Reduce a query or a term to the form the two are compared in.
 *
 * A DETERMINISTIC normalise-and-compare rather than a fuzzy threshold, and that
 * is the deliberate choice. Precision is what matters for a card printed above
 * the real results: a threshold that lets «حاسبة» through also lets something
 * close to it through, and "close to a category name" is exactly the query that
 * meant one specific tool. This can only fire on a query that IS a category
 * name, which is checkable by reading it.
 */
function normalise(s: string): string {
  const words = s
    .toLowerCase()
    .replace(/[ً-ْـ]/g, '') // harakat and tatweel
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean)
    // The Arabic definite article, so «الحاسبة» reaches «حاسبة». Only on a word
    // long enough that stripping two letters leaves a word.
    .map((w) => (w.startsWith('ال') && w.length > 4 ? w.slice(2) : w))
    // English plural. Not `es`/`ies`: over-stemming turns a tool name into a
    // category term, which is the failure this whole module is built to avoid.
    .map((w) => (/[a-z]{4,}s$/.test(w) && !w.endsWith('ss') ? w.slice(0, -1) : w))
    .filter((w) => !NOISE.has(w))
  return words.join(' ')
}

export interface GroupHit {
  /** A category NAME (`'PDF'`) or a collection SLUG. */
  key: string
  kind: 'category' | 'collection'
}

const INDEX = new Map<string, GroupHit>()
const index = (terms: Record<string, string[]>, kind: GroupHit['kind']) => {
  for (const [key, list] of Object.entries(terms)) {
    for (const t of list) {
      const k = normalise(t)
      // First writer wins, so a term shared by two groups keeps the one that
      // declared it — and a collision is visible in these tables rather than
      // decided at runtime.
      if (k && !INDEX.has(k)) INDEX.set(k, { key, kind })
    }
  }
}
// Categories first, so a category name always beats a collection term.
index(CATEGORY_TERMS, 'category')
index(COLLECTION_TERMS, 'collection')

/**
 * The group the query names — a category or a curated collection — or null.
 *
 * One, not several: a row of cards is the catalogue again, and the point is to
 * answer a broad query with the single grouping that fits it.
 */
export function matchGroup(query: string): GroupHit | null {
  return INDEX.get(normalise(query)) ?? null
}
