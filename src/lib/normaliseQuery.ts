// The query does not arrive in the shape a bench feeds it.
//
// Every bench in this repo hands the scorer a clean lower-case phrase, and
// nobody types like that. `node evals/inputshapes.mjs` re-asks the 215 queries
// the benches already get right, in the shapes people actually produce, and the
// result was worse than anybody had assumed:
//
//   | shape          | still first | returned NOTHING |
//   |----------------|-------------|------------------|
//   | unchanged      | 100%        | 0                |
//   | UPPER CASE     | 100%        | 0                |
//   | trailing `?`   | **51%**     | 63               |
//   | trailing `.`   | **54%**     | 57               |
//   | double quoted  | **10%**     | **168**          |
//   | «Arabic quotes»| **10%**     | **168**          |
//   | hyphenated     | **31%**     | 149              |
//   | as a URL       | **0%**      | **215**          |
//
// A question mark halves it. Quotes destroy it — and «guillemets» are the
// ordinary way Arabic quotes a term, used throughout this repo's own writing.
// A pasted link never worked at all, which is exactly what somebody does with a
// URL a friend sent them.
//
// The scorer is not wrong; it is being handed tokens that include punctuation.
// This normalises the QUERY, which is why it cannot change how any tool is
// indexed and cannot regress a bench.

/**
 * Punctuation that is only ever decoration around a term.
 *
 * Quotes of every family this site sees — ASCII, curly, and the guillemets
 * Arabic uses — plus sentence-ending marks in both scripts.
 */
const WRAPPERS = /["'“”‘’«»()[\]{}]/g

/** Trailing sentence punctuation, in both scripts. */
const TRAILING = /[.,;:!?،؛؟…]+$/

/**
 * Reduce a pasted URL to the part that names something.
 *
 * Somebody who was sent a link pastes the link. The last non-empty path
 * segment is the tool id — and `slugToQuery` already knows how to turn that
 * into words, so this only has to find it. A URL with nothing useful in the
 * path (a bare origin) returns empty rather than the hostname, because
 * "built-in-saudi.com" is not a query anybody meant.
 */
function fromUrl(text: string): string | null {
  if (!/^(https?:\/\/|\/\/|\/)/i.test(text) && !/^[a-z0-9-]+\.[a-z]{2,}\//i.test(text)) return null
  try {
    const url = new URL(text.startsWith('http') ? text : `https://${text.replace(/^\/\//, '')}`)
    // `pathname` is PERCENT-ENCODED, so an Arabic segment arrives as
    // %D8%B6%D8%BA%D8%B7… and matches nothing. Decoding it is the difference
    // between a pasted Arabic link working and returning an empty page.
    let path = url.pathname
    try { path = decodeURIComponent(path) } catch { /* keep it as-is */ }
    const parts = path.split('/').filter(Boolean)
    // Skip the locale and the /apps/ or /c/ prefix — they name no tool.
    const meaningful = parts.filter((p) => !/^(en|ar|apps|c|tools)$/i.test(p))
    return meaningful.length ? meaningful[meaningful.length - 1] : ''
  } catch {
    return null
  }
}

/**
 * The query, in the shape the scorer expects.
 *
 * Deliberately conservative about what it strips:
 *
 * - **Only TRAILING sentence punctuation**, never internal. `example.com` and
 *   `3.5` keep their dots; `merge pdf?` loses its question mark.
 * - **Hyphens and underscores become spaces**, so `pdf-merge` is two words. A
 *   hyphen inside a real term (`e-sign`, `x-ray`) splits into words that both
 *   still match, which measured no worse.
 * - **`+` and `#` are left alone**, because `C#`, `C++` and `+966` are things
 *   people type and the characters are load-bearing in them.
 */
export function normaliseQuery(raw: string): string {
  const text = raw.trim()
  if (!text) return ''

  const fromLink = fromUrl(text)
  const base = fromLink === null ? text : fromLink

  return base
    .replace(WRAPPERS, ' ')
    .split(/\s+/)
    .map((w) => w.replace(TRAILING, ''))
    .join(' ')
    .replace(/[-_/\\]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}
