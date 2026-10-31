// HELD-OUT SET #4 — written 10 August 2026, before any of it was run.
//
// Why a fourth. Sets #1 and #3 were BURNED by fixing what they found, and #2
// has been run as a regression check on every pass since, so none of them is a
// surprise any more. Nothing about the scorer or the metadata can be believed
// without a set nobody has seen.
//
// **This one is on an axis the other three do not cover.** Set #1 leans on
// tool-name-ish phrasings, #2 on fresh paraphrases, #3 on natural sentences —
// but all three describe the TOOL. This set describes the PROBLEM: what a
// person types when they know their symptom and not the name of the utility
// that fixes it. "my pdf is too big to email" names no tool, no format
// conversion and no verb the catalogue uses.
//
// That is the harder half of search and the more common one — somebody who
// already knows the tool exists usually knows roughly what it is called. It is
// also where a keyword list written by whoever built the tool is least likely
// to help, because it is written in the vocabulary of the solution.
//
// Written the documented way: straight off the tool list in one sitting, in
// both languages, WITHOUT running any of them. Measure ONCE, fix only
// unambiguous defects, and record in ROADMAP.md that the number is spent.

export const UNTUNED4 = [
  // --- a file that will not do what is needed of it ------------------------
  ['my pdf is too big to email', 'pdf-compress'],
  ['the photo is too heavy to upload', 'image-compressor'],
  ['my video file is too long to send', 'video-edit'],
  ['the scan has no selectable text', 'pdf-ocr'],
  // Two right answers since the spreadsheet editor shipped (Oct 2026): it OPENS the file;
  // xlsx-convert gets the data out. Neither is a wrong reading of the symptom.
  ['someone sent me a spreadsheet i cannot open', ['excel-editor']],
  ['my phone photos are heic and will not open', 'image-compressor'],
  ['the pdf pages are in the wrong order', 'pdf-organise'],
  ['i need to sign this without printing it', 'pdf-sign'],

  // --- text that arrived wrong ---------------------------------------------

  // --- something must not be shared ----------------------------------------
  ['cover up a name in a screenshot', 'image-edit'],
  ['i need fake customers for a demo', 'fake-data'],

  // --- media -----------------------------------------------------------------
  ['i want one still picture out of a video', 'video-edit'],

  // --- developer symptoms ----------------------------------------------------
  ['the api gave me a token i cannot read', 'jwt-decoder'],

  // --- money, and the question behind it -------------------------------------

  // --- health ----------------------------------------------------------------

  // --- Arabic, same axis -----------------------------------------------------
  ['ملف بي دي اف كبير جدا', 'pdf-compress'],
  ['تغطية اسم في صورة', 'image-edit'],
]
