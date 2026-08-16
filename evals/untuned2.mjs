// The SECOND held-out set. Nothing here may be tuned against.
//
// `untuned.mjs` was burned on 8 August 2026 — its misses were fixed, so it now
// reads 100% and measures nothing about unseen queries. Its own header says the
// next person to touch the scorer must write a fresh set before believing any
// number. This is that set.
//
// Written in one sitting against the tool LIST, before any of them was run, and
// deliberately sharing no query with either earlier list. Where a phrasing was
// close to an existing one it was changed rather than reused ("background
// remove" → "cut out the background"), because a paraphrase of a query the
// scorer was already fixed for is not held out.
//
// It exists to answer one question honestly: does indexing a tool's
// DESCRIPTION help queries nobody tuned for, or only the ones we remembered?
//
// ANSWER, 8 August 2026: neither. At weight 0.6 it left this set at exactly
// 45/50 with exactly the same five misses, while costing the tuned bench a
// fix. See the note above `Searchable` in src/lib/fuzzy.ts.
//
// STATUS: STILL HELD OUT. The five misses below were NOT fixed, deliberately —
// fixing them is what burned `untuned.mjs`, and an instrument spent on its
// first reading measures one change and then nothing. They are recorded in
// docs/ROADMAP.md instead, and the set stays usable for the next scorer change.
//
//   what does this cron mean   rank 2  cron-builder first (a deliberate rule)
//   make a certificate         rank 2  "make" is a stop word, so it is a bare
//                                      tie on "certificate" -> catalogue order
//   strong passphrase          rank 2  "Strong" is in the generator's tagline
//   is this colour readable    rank 3
//   ملف pdf إلى صور            rank 2  the direction problem again, in Arabic
export const UNTUNED2 = [
  // Everyday phrasings, English.
  ['shrink a photo for whatsapp', 'image-compressor'],
  ['cut out the background', 'remove-background'],
  ['split a restaurant bill', 'split-bill'],
  ['what does this cron mean', 'cron-explainer'],
  ['convert csv to json', 'csv-json'],
  ['find invisible characters', 'invisible-chars'],
  ['clean up a csv', 'csv-clean'],
  ['make a certificate', 'certificate'],
  ['seating plan for a wedding', 'seating-chart'],
  ['blur part of a picture', 'image-redact'],
  ['turn a photo into text art', 'image-to-ascii'],
  ['compare two texts', 'text-diff'],
  ['sort a list', 'list-tools'],
  ['strong passphrase', 'passphrase'],
  ['two factor code', 'totp'],
  ['decode a jwt', 'jwt-decoder'],
  ['convert coordinates', 'coordinates'],
  ['anonymise data', 'data-anonymize'],
  ['check a link before clicking', 'link-preview'],
  ['hide a message in a picture', 'steganography'],
  ['is this colour readable', 'color-contrast'],
  ['palette from a photo', 'color-palette'],
  ['css shadow', 'box-shadow'],
  ['easing curve', 'cubic-bezier'],
  ['lined paper to print', 'paper-generator'],
  ['quiz for my class', 'quiz-maker'],
  ['attendance register', 'attendance-sheet'],
  ['how long will i sleep', 'sleep-cycle'],
  ['blood sugar units', 'glucose-units'],
  ['when to take my medicine', 'medicine-schedule'],
  ['how loud is it', 'sound-meter'],
  ['fake names for testing', 'fake-data'],
  ['json to typescript', 'json-to-types'],
  ['curl to fetch', 'curl-convert'],
  ['hex dump', 'hex-viewer'],
  ['encrypt a file', 'file-encrypt'],
  ['fix mojibake', 'fix-encoding'],
  ['paste from word into markdown', 'paste-to-markdown'],
  ['random teams', 'team-maker'],
  ['working days between', 'working-days'],
  ['timezone meeting planner', 'timezone-planner'],
  ['what language is this', 'detect-language'],
  ['summarise this article', 'summarize'],
  ['trim a song', 'audio-trim'],
  // Arabic, written the same way — from the list, not from any miss.
  ['أضف الحركات', 'diacritize'],
  ['تصريف فعل عربي', 'arabic-verbs'],
  ['ملف pdf إلى صور', 'pdf-to-images'],
  ['حاسبة العمر', 'age-calculator'],
  ['خطة ختمة', 'khatma'],
]
