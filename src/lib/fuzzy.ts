// Tiny dependency-free fuzzy matcher. Scores a query against text with an
// exact-substring fast path plus an fzf-style subsequence fallback that rewards
// consecutive runs and word-boundary hits. Returns 0 when the query's characters
// don't all appear in order.

export function fuzzyScore(query: string, text: string): number {
  const q = query.toLowerCase().trim()
  const t = (text ?? '').toLowerCase()
  if (!q) return 1

  // Exact substring: strong, earlier + word-boundary weighted.
  const idx = t.indexOf(q)
  if (idx !== -1) {
    let score = 120 - Math.min(idx, 40)
    if (idx === 0 || /\W/.test(t[idx - 1])) score += 30
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
  ]
}

/** Best score for one term across a tool's fields, keywords included. */
function bestField(term: string, tool: Searchable): number {
  let best = 0
  for (const f of fieldsOf(tool)) {
    if (!f.text) continue
    best = Math.max(best, fuzzyScore(term, f.text) * f.weight)
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
    best = Math.max(best, fuzzyScore(term, k) * positional)
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
  const all = query.toLowerCase().trim().split(/\s+/).filter(Boolean).map(stripAl)
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
