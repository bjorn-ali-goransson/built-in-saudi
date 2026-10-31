// HELD-OUT SET #7 — written 11 August 2026, before any of it was run.
//
// Axes so far: tool-name-ish (#1), paraphrase (#2), natural sentence (#3),
// symptom (#4), file extension (#5), Arabic morphology (#6). This one is **the
// query carrying a NUMBER** — a size, a rate, a percentage, a count, a
// dimension.
//
// Two reasons it deserves its own set. First, it is how people specify what
// they want when they already know the answer's shape: nobody types "resize an
// image", they type "1080x1080". Second, numbers are exactly where the query
// normaliser has deliberate carve-outs — `3.5`, `+966` and `C#` keep their
// characters on purpose — so this is the axis most likely to catch a
// normalisation rule that went one step too far.
//
// A row may name several tools where the reading is honestly ambiguous: a
// dimension names both the resizer and the aspect-ratio calculator, and neither
// is wrong.
//
// Measure ONCE. Fix only unambiguous defects — a tool below the relevance floor
// for a number that is plainly its own subject — record the rest, mark it spent.

export const UNTUNED7 = [
  // --- dimensions and sizes -------------------------------------------------
  ['resize to 800px wide', 'image-compressor'],
  ['make it under 2mb', 'image-compressor'],
  ['compress pdf under 5mb', 'pdf-compress'],

  // --- rates and money -------------------------------------------------------
  ['100 usd to sar', 'currency-converter'],
  ['2.5% zakat', 'zakat-calculator'],
  ['split a bill 3 ways', 'split-bill'],

  // --- counts, spans and repeats --------------------------------------------
  ['every 5 minutes cron', ['cron-builder']],
  ['25 minute timer', ['stopwatch', 'stopwatch']],
  ['how many days between two dates', 'date-diff'],

  // --- technical numbers ------------------------------------------------------
  ['base 16', 'base-converter'],
  ['128 bit uuid', 'uuid-generator'],
  ['+966 number', 'saudi-phone'],

  // --- health and body ---------------------------------------------------------

  // --- Arabic, same axis -------------------------------------------------------
  ['تحويل 100 دولار', 'currency-converter'],
  ['زكاة 2.5%', 'zakat-calculator'],
]
