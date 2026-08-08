// A held-out set. NOTHING here may be tuned against.
//
// The tuned bench reached 100%, which is the number least worth believing —
// every fix in it was made while looking at it. These 50 queries were written
// against the tool LIST, in one sitting, before any of them was run, and the
// score is reported as found. If a fix raises the tuned bench and drops this
// one, the fix was overfitting and the bench was measuring my memory.
//
// When one of these fails, the honest move is to record it here as a known
// miss and fix the CAUSE if the cause generalises — not to quietly promote the
// query into the tuned set, which is how a held-out set stops being held out.
//
// STATUS: BURNED, 8 August 2026. First run scored 88% top-1 / 94% top-3 — that
// is the only real generalisation number this file will ever produce, and it is
// the one to quote. It found six defects, five of them genuine and general:
//
//   heic                  NOT FOUND    no tool indexed the word, though the site
//                                      decodes HEIC everywhere (#226)
//   حاسبة النسبة          rank 7       the BENCH was wrong — it read the top-level
//                                      nameAr field, the UI reads ar.name
//   how old am i          rank 10      "am" was not a stop word, and "old" hides
//                                      inside "Golden Hour"
//   sha256                rank 2       HMAC won on keyword position alone
//   days between two dates rank 2      the phrase was not indexed
//   webp to jpg           rank 2       ditto
//
// All six are fixed, so this set now reads 100% and measures nothing. It stays
// because the queries are still worth regression-testing; it is no longer
// evidence about unseen queries. THE NEXT PERSON TO TUNE THE SCORER MUST WRITE
// A NEW HELD-OUT SET before believing any number here.
export const UNTUNED = [
  ['split a pdf', 'pdf-split'],
  ['sign a document', 'pdf-sign'],
  ['compress pdf', 'pdf-compress'],
  ['page numbers', 'pdf-stamp'],
  ['heic', 'image-format-converter'],
  ['webp to jpg', 'image-format-converter'],
  ['color picker', 'color-tools'],
  ['lorem ipsum', 'lorem-ipsum'],
  ['base64', 'base64'],
  ['sha256', 'hash-generator'],
  ['uuid', 'uuid-generator'],
  ['markdown table', 'markdown-table'],
  ['uppercase', 'case-converter'],
  ['word count', 'text-counter'],
  ['sort lines', 'list-tools'],
  ['roll dice', 'dice-roller'],
  ['bmi', 'calorie-needs'],
  ['percentage', 'percentage-calculator'],
  ['split the bill', 'split-bill'],
  ['how old am i', 'age-calculator'],
  ['days between two dates', 'date-diff'],
  ['pomodoro', 'pomodoro'],
  ['barcode', 'barcode'],
  ['favicon', 'favicon-generator'],
  ['css gradient', 'gradient-generator'],
  ['meme', 'meme-generator'],
  ['blur a face', 'image-redact'],
  ['srt', 'subtitle-editor'],
  ['extract audio', 'video-audio'],
  ['record my screen', 'screen-recorder'],
  ['passport photo', 'passport-photo'],
  ['typing speed', 'typing-test'],
  ['kanban', 'kanban'],
  ['flashcards', 'flashcards'],
  ['unix timestamp', 'unix-timestamp'],
  ['slug', 'slugify'],
  ['gitignore', 'gitignore'],
  ['qibla direction', 'qibla'],
  ['golden hour', 'sun-times'],
  ['subnet mask', 'ip-subnet'],
  // Genuinely more than one right answer.
  ['watermark', ['pdf-stamp', 'batch-watermark']],
  ['wheel', ['spin-wheel', 'random-picker']],
  ['timer', ['stopwatch', 'countdown', 'pomodoro']],
  // Arabic, written the same way — from the list, not from the misses.
  ['تفقيط', 'tafqeet'],
  ['عداد الكلمات', 'text-counter'],
  ['ضغط pdf', 'pdf-compress'],
  ['تحويل العملات', 'currency-converter'],
  ['اختصار رابط', 'link-shortener'],
  ['حاسبة النسبة', 'percentage-calculator'],
  ['الطقس', 'weather'],
]
