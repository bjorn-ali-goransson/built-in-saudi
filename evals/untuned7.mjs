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
  ['1080x1080', ['social-resize', 'aspect-ratio']],
  ['1920x1080', ['aspect-ratio', 'social-resize']],
  ['16:9', 'aspect-ratio'],
  ['300 dpi', 'print-size'],
  ['a4 paper', 'paper-generator'],
  ['resize to 800px wide', 'image-compressor'],
  ['make it under 2mb', 'image-compressor'],
  ['compress pdf under 5mb', 'pdf-compress'],

  // --- rates and money -------------------------------------------------------
  ['15% vat', 'vat-calculator'],
  ['20% of 250', 'percentage-calculator'],
  ['100 usd to sar', 'currency-converter'],
  ['2.5% zakat', 'zakat-calculator'],
  ['6000 kwh bill', 'electricity-bill'],
  ['9.75% gosi', 'gosi-salary'],
  ['split a bill 3 ways', 'split-bill'],
  ['sar 1000 customs', 'import-duty'],

  // --- counts, spans and repeats --------------------------------------------
  ['split every 10 pages', 'pdf-split'],
  ['every 5 minutes cron', ['cron-builder', 'cron-explainer']],
  ['25 minute timer', ['pomodoro', 'stopwatch']],
  ['how many days between two dates', 'date-diff'],
  ['30 days notice', 'leave-overtime'],
  ['21 days annual leave', 'leave-overtime'],
  ['1000 words how long to read', 'speech-time'],
  ['8 hour shift overtime', 'timesheet'],

  // --- technical numbers ------------------------------------------------------
  ['sha-512', 'hash-generator'],
  ['base 16', 'base-converter'],
  ['/24 subnet', 'ip-subnet'],
  ['utc+3', 'timezone-planner'],
  ['unix time 1700000000', 'unix-timestamp'],
  ['base64', 'base64'],
  ['128 bit uuid', 'uuid-generator'],
  ['+966 number', 'saudi-phone'],

  // --- health and body ---------------------------------------------------------
  ['bmi 25', 'calorie-needs'],
  ['8 glasses of water', 'water-intake'],
  ['7.5 mmol', 'glucose-units'],
  ['28 day cycle', ['ovulation', 'due-date']],

  // --- Arabic, same axis -------------------------------------------------------
  ['ضريبة 15%', 'vat-calculator'],
  ['كم 20% من 250', 'percentage-calculator'],
  ['تحويل 100 دولار', 'currency-converter'],
  ['زكاة 2.5%', 'zakat-calculator'],
  ['مقاس 1080', ['social-resize', 'aspect-ratio']],
  ['30 يوم إشعار', 'leave-overtime'],
]
