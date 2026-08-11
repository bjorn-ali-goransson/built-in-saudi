// Tiny dependency-free fuzzy matcher. Scores a query against text with an
// exact-substring fast path plus an fzf-style subsequence fallback that rewards
// consecutive runs and word-boundary hits. Returns 0 when the query's characters
// don't all appear in order.

/**
 * Arabic diacritics are written in names and typed by nobody.
 *
 * Measured over the catalogue: **78 of 229 tools carry a shadda or a haraka in
 * their ARABIC NAME** — «محوّل العملات», «مولّد كلمة المرور», «محرّر ملفات
 * الترجمة» — and the name is weighted triple. A person types «محول», «مولد»,
 * «محرر», so every one of those names was unreachable by the spelling actually
 * used, and the failure is invisible because the tool is still findable by some
 * other field.
 *
 * Folded on BOTH sides — query and indexed text — so it can only ever make a
 * match that was intended, never one that was not. The same judgement
 * `word-search` records for its grid: a combining mark is a mark the reader
 * cannot see and did not type.
 *
 * U+0640 (tatweel) goes too: it is a typographic stretch, not a letter.
 */
const ARABIC_MARKS = /[ً-ْٰـ]/g
export const foldArabic = (s: string): string => s.replace(ARABIC_MARKS, '')

/**
 * Lower-cased and folded, remembered.
 *
 * Measured before this existed: one full search over 233 tools took **11.4ms on
 * a desktop**, against a 16.7ms frame — so a mid-range phone, three to six
 * times slower, dropped frames on every keystroke. Almost all of it was this
 * line: the same few hundred field strings were lower-cased and run through the
 * diacritic regex again for every tool, on every query, on every keystroke.
 *
 * The strings are stable — a tool's name does not change between keystrokes —
 * so the work is done once. Keyed by CONTENT rather than by object identity
 * because `searchTools` builds a fresh `Searchable` per call, so identity would
 * never hit.
 */
const foldCache = new Map<string, string>()
function foldLower(s: string): string {
  const hit = foldCache.get(s)
  if (hit !== undefined) return hit
  const v = foldArabic(s.toLowerCase())
  // Bounded: the fields are a few hundred strings, but the QUERY goes through
  // here too and a query is whatever somebody typed. Clearing wholesale beats
  // an LRU nobody would maintain — the fields simply repopulate on the next
  // keystroke.
  if (foldCache.size > 4000) foldCache.clear()
  foldCache.set(s, v)
  return v
}

export function fuzzyScore(query: string, text: string): number {
  return scoreFolded(foldLower(query).trim(), text)
}

/**
 * The same scorer, given a query that is ALREADY folded.
 *
 * Profiled at 233 tools: keywords are 53% of a search — 14.4 per tool, so
 * ~3,350 scoring calls per keystroke — and the expense is per-CALL overhead
 * rather than the algorithm, because the query was folded, trimmed and looked
 * up again on every one of them. The query does not change between fields, so
 * it is prepared once and this takes it.
 */
function scoreFolded(q: string, text: string): number {
  const t = foldLower(text ?? '')
  if (!q) return 1

  // Exact substring: strong, earlier + word-boundary weighted.
  const idx = t.indexOf(q)
  if (idx !== -1) {
    let score = 120 - Math.min(idx, 40)
    const prev = idx === 0 ? '' : t[idx - 1]
    if (!prev || /\W/.test(prev)) score += 30
    // A match that STARTS mid-word is much weaker evidence, and it was scoring
    // almost as well as a real one: "old" is inside "Golden Hour", so the
    // sunrise tool beat the age calculator for "how old am i".
    //
    // Penalised only when the character before it is LATIN. Arabic agglutinates
    // — the definite article, و and ب all attach to the front of the word they
    // modify — so a mid-word hit there is the normal way a real match looks,
    // and penalising it would quietly wreck the Arabic half of the catalogue to
    // tidy up the English one.
    else if (!/[؀-ۿ]/.test(prev)) score *= 0.5
    // NO length/coverage bonus here, and that is a measured decision rather
    // than an omission. A one-word query often ties two tools exactly ("qr",
    // "password", "hijri"), and the obvious tie-break — prefer the tool whose
    // name the query covers more of — was tried and made things WORSE: it
    // fixed "hijri" and broke "qr" (QR Reader over QR Code) and "password"
    // (the strength checker over the generator), because a shorter name is not
    // evidence of being the more central tool. Ties fall through to the order
    // the tools are sorted in, which is the curated catalogue order — an
    // editorial judgement about which tool is primary, and a better answer
    // than any string statistic.
    return score
  }

  // Subsequence fallback.
  let ti = 0
  let qi = 0
  let streak = 0
  let score = 0
  while (ti < t.length && qi < q.length) {
    if (t[ti] === q[qi]) {
      streak += 1
      score += 1 + streak * 0.6
      if (ti === 0 || /\W/.test(t[ti - 1])) score += 2
      qi += 1
    } else {
      streak = 0
    }
    ti += 1
  }
  return qi === q.length ? score : 0
}

/**
 * Results scoring less than this share of the BEST result are dropped.
 *
 * At 202 tools a query returned **31 tools on average** and neither the home
 * catalogue nor the launcher capped the list, so "pdf merge" rendered thirty-one
 * cards with three worth looking at. Measured over the bench (`evals/floorprobe.mjs`):
 * 31.3 results on average become 5.0, and **no bench answer leaves the top 3**.
 *
 * Relative, not absolute, and that was measured rather than assumed. An absolute
 * floor cannot work here: the best hit for a query the site CANNOT serve scores
 * 232 ("my bank balance" → the loan settlement tool) while the worst genuinely
 * correct answer scores 128 ("blur a face" → the image redactor). There is no
 * threshold between them, so any absolute cut deletes a right answer.
 *
 * A relative floor keeps ties, which is what makes it safe for a BROAD query:
 * `pdf` keeps 17 of 31 and `image` 27 of 32 — the family survives and the tail
 * goes. It is 25% because 35% starts trimming those families while 15% buys
 * nothing over 25% on them.
 *
 * **What this does NOT do**, and the probe is explicit about it: it does not
 * make an unanswerable query return nothing. `order pizza` still leads with the
 * screen recorder. That is a semantic problem — "book" means two things — and no
 * score threshold can fix it.
 */
export const RELEVANCE_FLOOR = 0.25

/**
 * A floor in absolute score as well, because the relative one cannot help when
 * EVERYTHING scores badly. "buy bitcoin" tops out at 9 and kept all ten of its
 * rows, since a quarter of 9 is 2 — the list is uniformly terrible, so nothing
 * stands out to measure the rest against.
 *
 * 50 is **free, by measurement**: across all 169 benched queries the number of
 * real result rows is unchanged (598), while junk rows fall from 84 to 27 and
 * the unanswerable queries that honestly return NOTHING go from 5 to 7 of 15.
 * The lowest-scoring genuinely correct answer anywhere in the benches is 128
 * ("blur a face" → the image redactor), so this sits 2.5x below it. 80 and 100
 * cut more junk and start removing real rows; 120 is too near that 128 to be
 * worth the two extra empty states.
 */
export const MIN_SCORE = 50

/** Drop results far below the best one. Input must already be sorted, best first. */
export function aboveFloor<T extends { score: number }>(sorted: T[]): T[] {
  const top = sorted[0]?.score ?? 0
  if (top <= 0) return sorted
  const floor = Math.max(top * RELEVANCE_FLOOR, MIN_SCORE)
  return sorted.filter((x) => x.score >= floor)
}

/**
 * The DESCRIPTION is deliberately not a field here. Tried and rejected on
 * measurement, 8 August 2026, at weight 0.6 — below every other field:
 *
 *   tuned bench    122/122 -> 121/122
 *   held out #1     50/50  ->  50/50
 *   held out #2     45/50  ->  45/50, the SAME five misses
 *
 * So it cost a hard-won fix and bought nothing across a hundred held-out
 * queries. What it broke is instructive: `ضغط صورة` went to the PDF compressor,
 * because that tool's description is full of compression vocabulary — exactly
 * the failure the coverage multiplier was introduced to stop. A description
 * explains a tool to a reader; it is not a list of the words that mean it, and
 * indexing prose adds far more noise than signal.
 *
 * Put the words people type in `keywords`. That is what the field is for.
 */
export interface Searchable {
  name: string
  tagline: string
  category: string
  keywords: string[]
  /** The Arabic display name, when the tool has one. */
  nameAr?: string
}

interface Field { text: string; weight: number }

function fieldsOf(tool: Searchable): Field[] {
  return [
    { text: tool.name, weight: 3 },
    // Without this an Arabic query could only ever match a keyword, so a tool
    // whose Arabic name is exactly what was typed ranked below one that merely
    // listed the word.
    { text: tool.nameAr ?? '', weight: 3 },
    { text: tool.category, weight: 1.5 },
    { text: tool.tagline, weight: 1.2 },
    // The long `description` is deliberately NOT indexed, and that was measured
    // rather than assumed — see the note above `Searchable`.
  ]
}

/** Best score for one term across a tool's fields, keywords included. */
function bestField(term: string, tool: Searchable): number {
  // Folded ONCE for the whole tool rather than inside every field and every
  // keyword: that is ~15 calls per tool and the fold-and-trim was being redone
  // on each of them.
  const q = foldLower(term).trim()
  let best = 0
  for (const f of fieldsOf(tool)) {
    if (!f.text) continue
    best = Math.max(best, scoreFolded(q, f.text) * f.weight)
  }
  // Keywords are scored one at a time rather than as a joined string: a
  // subsequence spanning the end of one keyword and the start of the next is
  // not a match anybody meant.
  //
  // Earlier keywords count for slightly more. Whoever wrote the meta listed the
  // most central words first, and without this a query like "xlsx" ties across
  // every tool that merely mentions it and the winner is whichever sorted first.
  tool.keywords.forEach((k, i) => {
    const positional = 2 - Math.min(i, 8) * 0.05
    best = Math.max(best, scoreFolded(q, k) * positional)
  })
  return best
}

/**
 * Words that carry no intent in a search for a tool.
 *
 * They matter because every term has to match something: "is my password good"
 * found NOTHING before this, since no tool contains "is", and one dead term
 * killed the entire query. Dropping them is not a nicety — it is the difference
 * between a sentence working and returning an empty page.
 */
const STOP = new Set([
  'a', 'an', 'the', 'my', 'me', 'is', 'are', 'to', 'for', 'of', 'in', 'on', 'from',
  'with', 'and', 'or', 'do', 'i', 'can', 'get', 'make', 'it', 'this', 'that',
  // Interrogatives. `how` was here from the start and the rest were not, so
  // "when is ramadan" spent half its coverage on a word no tool contains and
  // returned the water-intake calculator.
  'how', 'what', 'when', 'where', 'why', 'which', 'who',
  // The rest of the copula. `is` and `are` were here from the start and `am`
  // was not, which is the whole of why "how old am i" ranked the age calculator
  // TENTH: `how` and `i` dropped out, `old` matched, and `am` — two letters that
  // are a subsequence of half the catalogue — spent the other half of the
  // query's coverage on noise. A stop list that stops one person of a verb and
  // not another is not a stop list.
  'am', 'was', 'were', 'be', 'been', 'does', 'did',
  'في', 'من', 'الى', 'إلى', 'على', 'عن', 'كيف', 'هل', 'ال',
  'ما', 'هو', 'هي', 'متى', 'اين', 'أين', 'كم',
])

/**
 * Strip the Arabic definite article.
 *
 * A person searching types `الزكاة`; the tool's keyword is `زكاة`. The query is
 * the LONGER string, so neither the substring path nor the subsequence path can
 * bridge it — the match fails silently and in the direction nobody thinks to
 * check. Measured: "كيف احسب الزكاة" returned the VAT registration tool.
 *
 * Only stripped when something is left worth matching, so `ال` alone (already a
 * stop word) and short words like `الي` are not mangled.
 */
function stripAl(term: string): string {
  return /^ال.{2,}/.test(term) ? term.slice(2) : term
}

function terms(query: string): string[] {
  const all = foldArabic(query.toLowerCase().trim()).split(/\s+/).filter(Boolean).map(stripAl)
  const kept = all.filter((t) => !STOP.has(t))
  // If someone searched for nothing but stop words, they still meant something
  // by them — fall back rather than matching everything.
  return kept.length ? kept : all
}

/**
 * Weighted best-field score for a tool against a query.
 *
 * Scored two ways, and the better one wins:
 *
 * 1. **The whole query against one field.** This is what catches an exact name.
 * 2. **Every term separately, all of which must match something.** This is the
 *    one that matters: measured over a bench of real queries, 14 of 68 returned
 *    NOTHING before it existed — "pdf merge" cannot match the tool called
 *    "Merge PDFs", because the space has to appear in the same field in the same
 *    order. Word order is not something a person typing into a search box owes
 *    anybody.
 *
 * Requiring every term to match (rather than any) keeps the second path from
 * turning the results into everything-that-shares-a-word.
 */
export function scoreTool(query: string, tool: Searchable): number {
  if (!query.trim()) return 1

  const whole = bestField(query, tool)

  const list = terms(query)
  // One surviving term is where the stop-word filtering EARNS its place, and
  // it used to be where the filtering was thrown away: this returned `whole`,
  // the score of the full query with the stop words still in it. So "make a
  // qr" was matched as the literal string "make a qr" and found NOTHING, while
  // a bare "qr" ranked the QR generator first. Same for "my iqama". Measured
  // over 32 untuned queries, this was 2 of the 4 that returned nothing at all.
  if (list.length < 2) return Math.max(whole, list.length === 1 ? bestField(list[0], tool) : 0)

  let sum = 0
  let matched = 0
  for (const term of list) {
    const s = bestField(term, tool)
    if (s > 0) { sum += s; matched += 1 }
  }
  if (!matched) return whole
  // Averaged over the terms that MATCHED, then scaled by how many of them did.
  //
  // Demanding every term match sounds rigorous and empties the page: "is my
  // password good" has no tool containing "good", and one unknown word used to
  // take the whole query down with it. Scaling instead means a tool matching
  // both words still beats one matching a single word, without the query
  // failing outright over a word nobody could have indexed.
  // Coverage is a real multiplier, not a nudge. Measured: "ضغط صورة" (compress
  // image) ranked the PDF compressor first, because its name matches the word
  // "compress" outright (a field hit at triple weight) while the image
  // compressor merely matched both words well. Matching everything the person
  // typed has to beat matching half of it emphatically, or a strong hit on one
  // word drowns out the word that disambiguated it.
  const coverage = matched / list.length
  return Math.max(whole * coverage, (sum / matched) * coverage * (0.75 + 0.25 * coverage))
}

/* ------------------------------------------------------------------------- *
 * Typos
 *
 * The scorer is substring, subsequence and prefix work: it has no notion of a
 * transposed pair or a dropped letter, and a search box sees those constantly.
 *
 * Measured before this existed (`node evals/typoprobe.mjs`, 23 realistic
 * mistypings of queries the benches already agree on): **74% still found the
 * right tool first, and 2 returned NOTHING AT ALL** — `calender` and
 * `tiemsheet`, each one letter away from a tool we have. A search box that
 * answers a one-letter slip with an empty page is a dead end.
 *
 * The correction is deliberately a FALLBACK, not a scoring change. It runs only
 * when the normal path found nothing worth showing, so it is strictly additive:
 * no query that works today can be re-ranked by it, which is why all four
 * benches are unchanged by construction rather than by luck.
 * ------------------------------------------------------------------------- */

/**
 * Damerau-Levenshtein, capped.
 *
 * Bounded at `max` and bailing out early: the vocabulary is a few thousand
 * tokens and this runs per term, so an uncapped full-matrix distance would be
 * the slowest thing in the search path for no benefit — anything further than
 * two edits away is not a typo, it is a different word.
 */
export function editDistance(a: string, b: string, max = 2): number {
  if (a === b) return 0
  if (Math.abs(a.length - b.length) > max) return max + 1
  let prev2: number[] = []
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const row = [i]
    let best = i
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      let v = Math.min(row[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost)
      // The transposition case — `mrege` for `merge` is ONE mistake to a person
      // and two to plain Levenshtein, and transposition is the commonest typo
      // there is.
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        v = Math.min(v, prev2[j - 2] + cost)
      }
      row.push(v)
      if (v < best) best = v
    }
    if (best > max) return max + 1
    prev2 = prev
    prev = row
  }
  return prev[b.length]
}

/** Every distinct word in a tool's searchable fields, for the correction pass. */
export function vocabulary(tools: Searchable[]): Set<string> {
  const out = new Set<string>()
  const add = (s: string | undefined) => {
    if (!s) return
    for (const w of foldArabic(s.toLowerCase()).split(/[^\p{L}\p{N}]+/u)) if (w.length > 2) out.add(w)
  }
  for (const t of tools) {
    add(t.name); add(t.nameAr); add(t.tagline); add(t.category)
    for (const k of t.keywords ?? []) add(k)
  }
  return out
}

/**
 * Rewrite a query's unknown words to the nearest word the catalogue knows.
 *
 * A term already in the vocabulary is never touched — correcting a word
 * somebody spelled right is how a search box starts arguing with people. One
 * edit for a short word, two for a long one, because two edits on a five-letter
 * word reaches half the dictionary.
 *
 * **Nothing shorter than five characters is corrected**, and that number was
 * measured rather than picked. At four, the Arabic «قهوة» (coffee) — a query
 * this site genuinely cannot serve — is one deletion from «قوة» (strength) and
 * was answered with the password strength checker at 450. Arabic words are
 * short and dense, so a single edit reaches a great many of them. At five, that
 * false correction is gone and every true correction in `typoprobe` survives,
 * because a real typo is nearly always in a longer word.
 *
 * **And exactly ONE edit, never two.** Measured across every correction the
 * probes exercise: `mrege`→`merge`, `passowrd`→`password`, `calender`→
 * `calendar`, `tiemsheet`→`timesheet` and a dozen more are all distance 1. The
 * only distance-2 correction found anywhere was «الهمزات» (hamzas) → «العملات»
 * (currencies), which sent an Arabic-normalisation query to the currency
 * converter — a real word we do not index, bent into one we do. Two edits is
 * not a typo, it is a different word.
 */
/**
 * Arabic attaches its particles to the FRONT of the word.
 *
 * `stripAl` handles the definite article and nothing else, but «و» (and), «ب»
 * (with), «ل» (for), «ك» (as) and «ف» (so) all agglutinate too, and they stack:
 * «وللإيجار» is و + لل + إيجار. The query then contains the indexed word rather
 * than equalling it, and the match fails in the direction nobody checks — the
 * same shape as «الزكاة» reaching for «زكاة», and as `.heic` reaching for
 * `heic`.
 *
 * Held-out set #6 measured it: «وللإيجار» returned NOTHING on a site with a
 * rent-rules tool, «بالهجري» and «كمستند وورد» both missed.
 *
 * **The strip only applies when what is left is a word the catalogue already
 * knows.** That guard is what makes it safe: Arabic light stemming is
 * notorious for mangling words that merely begin with a particle letter
 * («كتاب» is not ك + تاب), and a strip that has to land on an indexed term
 * cannot invent a match. It also lets the same rule handle the imperative alef
 * — «اضغط» → «ضغط» — without any special case, and without touching «اسم»,
 * whose remainder is in no vocabulary.
 */
const AR_PREFIX = /^(?:و|ف)?(?:لل|بال|كال|فال|وال|ال|ب|ل|ك)?/

export function stripArabicPrefixes(query: string, vocab: Set<string>): string {
  return query.split(/\s+/).map((word) => {
    if (!/[؀-ۿ]/.test(word) || vocab.has(word)) return word
    // Longest strip first, so «وللإيجار» loses both particles rather than one.
    const candidates: string[] = []
    const m = AR_PREFIX.exec(word)
    if (m && m[0]) candidates.push(word.slice(m[0].length))
    if (/^ا/.test(word)) candidates.push(word.slice(1))
    for (const c of candidates) {
      if (c.length >= 3 && vocab.has(c)) return c
    }
    return word
  }).join(' ')
}

export function correctQuery(query: string, vocab: Set<string>): string | null {
  const words = foldArabic(query.toLowerCase().trim()).split(/\s+/).filter(Boolean)
  let changed = false
  const out = words.map((w) => {
    if (w.length < 5 || vocab.has(w)) return w
    const max = 1
    let best: string | null = null
    let bestD = max + 1
    for (const v of vocab) {
      const d = editDistance(w, v, max)
      if (d < bestD) { bestD = d; best = v; if (d === 1) break }
    }
    if (best && bestD <= max) { changed = true; return best }
    return w
  })
  return changed ? out.join(' ') : null
}
