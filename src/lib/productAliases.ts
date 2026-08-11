// When somebody names the PRODUCT instead of the job.
//
// Held-out set #8 (`evals/untuned8.mjs`) asked, for the first time, what
// happens when a query is a brand used as a verb — `tinypng`, `docusign`,
// `bitly`, `lastpass`, `ilovepdf`. It read **46% top-1, the lowest of any
// held-out set**, with **20 of 46 returning nothing at all** — because the
// catalogue is written in the vocabulary of the FUNCTION and an enormous number
// of people name a function by the product that made it famous. It is the same
// finding as `heic` one level up: a capability nobody can name is not shipped.
//
// THE RULE, and it is the whole of the design:
//
//   **A product is listed here ONLY where this site does the same job.**
//
// `tinypng` compresses images and so do we, so the query is answered. Photoshop,
// Canva, Dropbox, Figma and Postman are NOT here and must stay unfindable —
// answering those with the nearest thing is the adware move this repo already
// refused for `photoshop` and `stopwatch`. Measured: **12 of 12** products we do
// not imitate correctly return nothing, and there is a case pinning it, without
// which this file could have grown into "match any brand anybody types".
//
// It is a FALLBACK, tried only when the query found nothing — the arrangement
// `numericIntent` and `correctQuery` use, and the reason it cannot regress a
// bench: a query that already works is never re-ranked. Measured before it was
// built: **all 20 of the misses show an EMPTY page**, so the fallback reaches
// every one of them.
//
// It maps to WORDS, not to a tool id. A brand becomes the phrase a person would
// have typed if they knew our vocabulary, and the ordinary scorer answers it —
// so a renamed or retired tool cannot leave a dangling pointer here, and a
// better-matching tool added later wins on its own merits.

/** Brand → the words that describe the job, for the scorer to answer. */
const ALIASES: Record<string, string> = {
  // scheduling
  calendly: 'booking page appointment schedule',
  doodle: 'booking page appointment schedule',

  // documents
  docusign: 'sign pdf signature',
  hellosign: 'sign pdf signature',
  ilovepdf: 'pdf merge split compress',
  smallpdf: 'pdf merge split compress',
  acrobat: 'pdf edit',

  // links
  bitly: 'short link shortener url',
  tinyurl: 'short link shortener url',

  // images
  tinypng: 'compress image smaller',
  squoosh: 'compress image smaller',
  kraken: 'compress image smaller',
  removebg: 'remove background from image',

  // developer
  regex101: 'regex tester regular expression',
  regexr: 'regex tester regular expression',
  jsonlint: 'json formatter validate',
  jsbeautifier: 'json formatter beautify',

  // language
  deepl: 'translate text',
  grammarly: 'readability writing check',
  hemingway: 'readability writing check',

  // meetings
  skype: 'video call',
  zoom: 'video call',
  'google meet': 'video call',
  webex: 'video call',

  // lists and boards
  trello: 'kanban board todo list',
  todoist: 'todo list tasks',
  notion: 'todo list notes',
  asana: 'kanban board todo list',

  // credentials
  lastpass: 'password generator strong',
  bitwarden: 'password generator strong',
  '1password': 'password generator strong',
  authy: 'two factor authenticator code totp',

  // media
  audacity: 'audio trim convert',
  handbrake: 'video trim convert',

  // forms and quizzes
  'google forms': 'quiz maker questions',
  typeform: 'quiz maker questions',

  // security
  'have i been pwned': 'password leaked breach check',
  haveibeenpwned: 'password leaked breach check',
}

/** Longest key first, so `google forms` is tried before `forms` ever could. */
const KEYS = Object.keys(ALIASES).sort((a, b) => b.split(' ').length - a.split(' ').length)

/**
 * The words behind a product name, or null.
 *
 * Matches the WHOLE normalised query, or the query with one word of scaffolding
 * either side — `zoom call`, `like tinypng`, `bitly link`. Anything looser
 * would fire on a query that merely CONTAINS a brand among several words, which
 * is exactly where the ordinary scorer has a real opinion that is not ours to
 * overrule. Done by words rather than by a built regex, because a key like
 * `remove.bg` or `1password` in a hand-built pattern is a metacharacter bug
 * waiting to happen.
 */
export function productAlias(query: string): string | null {
  const words = query.toLowerCase().replace(/[.،,]/g, '').trim().split(/\s+/).filter(Boolean)
  if (!words.length) return null
  for (const key of KEYS) {
    const k = key.split(' ')
    // The whole query, or with one word trimmed from either end (or both).
    for (const from of [0, 1]) {
      for (const to of [0, 1]) {
        const slice = words.slice(from, words.length - to)
        if (slice.length === k.length && slice.every((w, i) => w === k[i])) return ALIASES[key]
      }
    }
  }
  return null
}

/**
 * Arabic transliterations of the same products.
 *
 * Kept as their own table because they are not English words: a Latin-only
 * lookup would never see «زووم», and this site's Arabic half is not an
 * afterthought. Only products we DO the job of appear here, exactly as above.
 */
const AR_ALIASES: Record<string, string> = {
  'زووم': 'video call',
  'زوم': 'video call',
  'سكايب': 'video call',
}

/** As `productAlias`, including the Arabic spellings. */
export function productAliasAny(query: string): string | null {
  const ar = AR_ALIASES[query.trim()]
  if (ar) return ar
  return productAlias(query)
}
