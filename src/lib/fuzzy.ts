// Tiny dependency-free fuzzy matcher. Scores a query against text with an
// exact-substring fast path plus an fzf-style subsequence fallback that rewards
// consecutive runs and word-boundary hits. Returns 0 when the query's characters
// don't all appear in order.

export function fuzzyScore(query: string, text: string): number {
  const q = query.toLowerCase().trim()
  const t = text.toLowerCase()
  if (!q) return 1

  // Exact substring: strong, earlier + word-boundary weighted.
  const idx = t.indexOf(q)
  if (idx !== -1) {
    let score = 120 - Math.min(idx, 40)
    if (idx === 0 || /\W/.test(t[idx - 1])) score += 30
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
}

/** Weighted best-field score for a tool against a query. */
export function scoreTool(query: string, tool: Searchable): number {
  if (!query.trim()) return 1
  const name = fuzzyScore(query, tool.name) * 3
  const category = fuzzyScore(query, tool.category) * 1.5
  const tagline = fuzzyScore(query, tool.tagline) * 1.2
  const keyword = tool.keywords.reduce((best, k) => Math.max(best, fuzzyScore(query, k)), 0) * 2
  return Math.max(name, category, tagline, keyword)
}
