// What a model actually charges you for, and why the usual estimate is wrong.
//
// MEASURED HERE, not read off a blog post. Run the numbers yourself with the
// real tokenizer and you get the table below — one paragraph of ordinary prose
// on the same subject, written in each language, plus a snippet of JavaScript:
//
//   |            | chars/token (o200k) | chars/token (cl100k) |
//   |------------|---------------------|----------------------|
//   | English    | 5.80                | 5.67                 |
//   | **Arabic** | **3.80**            | **1.41**             |
//   | code       | 2.71                | 2.71                 |
//
// THREE THINGS FOLLOW, and every token counter on the web gets at least one of
// them wrong because it estimates instead of tokenizing:
//
// 1. **"Characters ÷ 4" is not a rule, it is an English rule.** On that
//    English paragraph it says 64 tokens where the answer is 44 — it
//    **overestimates by 45%**. On the code it says 31 where the answer is 45,
//    **underestimating by 31%**. It is wrong in both directions depending on
//    what you paste, which is the worst property an estimate can have.
//
// 2. **Arabic used to cost four times as much per character as English.** At
//    1.41 chars/token on cl100k, the same meaning in Arabic was billed roughly
//    4x what it was in English, and it filled a context window four times
//    faster. That is a tax on writing in Arabic that nobody putting a "chars ÷
//    4" widget on a page could have told you about.
//
// 3. **The newer tokenizer largely fixed it: 1.41 -> 3.80 chars/token, a 2.7x
//    improvement**, while English barely moved (5.67 -> 5.80). So for Arabic —
//    and only for Arabic — the choice of model changes the bill far more than
//    the choice of wording does. That is worth being able to check, and this is
//    the only way to check it.
//
// DELIBERATELY NOT INCLUDED: a table of model prices. They change every few
// months and are different per provider, per tier and per direction (input
// costs less than output). Printing one would put a number on the page that
// nobody can stand behind, which is the mistake `iqama-fees` records. The
// price is an INPUT here — read it off your provider's page, where it is
// current by definition.

/** The estimate everybody uses, and which this tool exists to check. */
export const RULE_OF_THUMB_CHARS_PER_TOKEN = 4

export const ENCODINGS = [
  {
    id: 'o200k' as const,
    label: 'o200k_base',
    /** Named as families rather than as a fixed model list, which would date. */
    en: 'GPT-4o and newer',
    ar: 'جي بي تي-4o وما بعده',
  },
  {
    id: 'cl100k' as const,
    label: 'cl100k_base',
    en: 'GPT-4 and GPT-3.5',
    ar: 'جي بي تي-4 و3.5',
  },
]

export type Encoding = (typeof ENCODINGS)[number]['id']

/** What the rule of thumb would have claimed for this text. */
export const ruleOfThumb = (chars: number) =>
  Math.ceil(chars / RULE_OF_THUMB_CHARS_PER_TOKEN)

/**
 * How wrong the rule of thumb is, as a signed percentage of the true count.
 *
 * Positive means it OVERSTATES — which is the English case, and the reason
 * people are surprised their bill is lower than they budgeted. Negative means
 * it understates, which is the Arabic and code case and the expensive one.
 */
export function ruleError(chars: number, tokens: number): number | null {
  if (!tokens) return null
  return ((ruleOfThumb(chars) - tokens) / tokens) * 100
}

/**
 * Cost from a price the reader supplies, per million tokens.
 *
 * Returns null when no price has been given, so the UI can say nothing rather
 * than showing a confident zero.
 */
export function costOf(tokens: number, pricePerMillion: number | null): number | null {
  if (pricePerMillion === null || !Number.isFinite(pricePerMillion)) return null
  return (tokens / 1_000_000) * pricePerMillion
}

/** True when the text is mostly Arabic — decides whether to lead with the
 *  tokenizer comparison, which only matters for a non-Latin script. */
export function isMostlyArabic(text: string): boolean {
  let arabic = 0
  let letters = 0
  for (const ch of text) {
    const c = ch.codePointAt(0)!
    const isArabic = (c >= 0x0600 && c <= 0x06ff) || (c >= 0x0750 && c <= 0x077f)
    const isLatin = (c >= 0x41 && c <= 0x5a) || (c >= 0x61 && c <= 0x7a)
    if (isArabic) arabic++
    if (isArabic || isLatin) letters++
  }
  return letters > 0 && arabic / letters > 0.4
}
