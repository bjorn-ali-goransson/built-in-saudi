// Curated groups that cut ACROSS the categories.
//
// Measured with `node evals/tieprobe.mjs`. After the category offer shipped,
// **46 single-word queries still tie three ways or wider, and only 9 of them
// name a category** — the other 37 still answer with one arbitrary tool. The
// widest of those are not categories at all and never can be:
//
//   رمضان    6-way   hijri-calendar · water-intake · medicine-schedule · timesheet · islamic-calendar
//   معلم     6-way   seating-chart · attendance-sheet · worksheets · bingo-cards · word-search
//   مدرسة    4-way   the same family again
//   مقارنة   4-way   text-diff · json-diff · sheet-diff · image-diff
//
// Ramadan is a SEASON, teaching is an AUDIENCE and comparing is a VERB. Each
// picks tools out of four or five different categories, so no amount of
// recategorising reaches them — that is what makes them collections rather than
// a filing mistake.
//
// **This does not contradict "curated sections get no page."** That rule is
// about Recommended, Duʿāʾ and Recently used, and its reason is that those are
// personal or editorial and therefore a URL nobody can keep meaningful.
// «رمضان» and "teaching" are neither: they are stable, nameable and shareable,
// and «أدوات رمضان» is a query shape people type every year — exactly the
// argument that earned the categories their own pages.
//
// A PURE module with no imports, like `categorySlug.ts`, because the build-time
// prerender in `vite.config.ts` needs it and cannot pull in React.

export interface Collection {
  slug: string
  /** Tool ids, in the order they should read. Checked against the registry by
   *  `scripts/check-collections.mjs`, which also refuses a slug that collides
   *  with a category's. */
  toolIds: string[]
}

export const COLLECTIONS: Collection[] = [
  {
    slug: 'ramadan',
    toolIds: [
      'prayer-times', 'prayer-timetable', 'hijri-calendar', 'islamic-calendar',
      'khatma', 'adhkar', 'hisn-al-muslim', 'zakat-calculator', 'saudi-holidays',
      'medicine-schedule', 'water-intake', 'timesheet',
    ],
  },
  {
    slug: 'teaching',
    toolIds: [
      'worksheets', 'word-search', 'quiz-maker', 'bingo-cards', 'flashcards',
      'arabic-handwriting', 'seating-chart', 'attendance-sheet', 'certificate',
      'label-sheet', 'random-picker', 'team-maker', 'spin-wheel', 'speech-time',
    ],
  },
  {
    // Cuts across Developer, Generators, Text, Files, Images and PDF. A
    // CATEGORY was the obvious move and would have been wrong twice over:
    // moving `password-generator` out of Generators breaks the measured
    // "a bare noun goes to the tool that MAKES the thing" tie ordering, and
    // the redaction tools have a stronger format family — nobody hunts for
    // the PDF redactor anywhere but PDF. A collection says "these are all
    // privacy tools" without moving any of them.
    slug: 'security',
    toolIds: [
      'password-generator', 'password-strength', 'passphrase', 'totp',
      'file-encrypt', 'hash-generator', 'hmac', 'jwt-decoder', 'cert-decoder',
      'email-headers', 'data-anonymize', 'metadata-remove', 'image-redact',
      'pdf-redact', 'steganography',
    ],
  },
  {
    slug: 'compare',
    toolIds: ['text-diff', 'json-diff', 'sheet-diff', 'image-diff', 'date-diff'],
  },
]

const BY_SLUG = new Map(COLLECTIONS.map((c) => [c.slug, c]))

export const collectionBySlug = (slug: string): Collection | undefined =>
  BY_SLUG.get(slug.toLowerCase())
