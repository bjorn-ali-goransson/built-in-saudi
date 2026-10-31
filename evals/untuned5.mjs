// HELD-OUT SET #5 — written 10 August 2026, before any of it was run.
//
// Axes used so far: tool-name-ish (#1), paraphrase (#2), natural sentence (#3),
// symptom (#4). This one is **the FORMAT, named as a file extension or by the
// product it came from** — `jpg to png`, `.heic`, `xlsx to csv`, `mp4 to mp3`,
// `.vcf`.
//
// Why it is worth its own set: this site is largely a converter catalogue, and
// an extension is how people name a file when they do not know or care what
// the format is called. It is also the shortest possible query — one token,
// often three characters — so it exercises the part of the scorer where a
// substring match is nearly the whole score, and where a keyword list that
// happens to spell the format out in words rather than in extensions will
// silently miss.
//
// A converter pair is deliberately expected to accept EITHER member where both
// readings are honest (`jpg to png` is one tool here, but `.zip` is genuinely
// both the reader and the writer), following the bench's array convention.
//
// Measure ONCE, fix only unambiguous defects — a format the site handles and
// cannot be found by its own extension — record the rest, and mark it spent.

export const UNTUNED5 = [
  // --- images ---------------------------------------------------------------
  ['jpg to png', 'image-compressor'],
  ['png to jpg', 'image-compressor'],
  ['webp to jpg', 'image-compressor'],
  ['.heic', 'image-compressor'],
  ['heic to jpeg', 'image-compressor'],
  ['avif', 'image-compressor'],
  ['svg to png', 'image-compressor'],

  // --- documents -------------------------------------------------------------
  ['.docx', ['word-editor']],
  ['docx to txt', 'word-editor'],
  ['.pptx', 'powerpoint-editor'],
  ['pptx to text', 'powerpoint-editor'],
  ['md to docx', 'word-editor'],
  ['.md', ['word-editor']],
  ['pdf to jpg', 'pdf-to-images'],
  ['pdf to docx', 'pdf-to-word'],
  ['jpg to pdf', 'images-to-pdf'],

  // --- tabular and data ------------------------------------------------------
  ['.xlsx', ['excel-editor']],
  ['xlsx to csv', 'excel-editor'],
  ['csv to xlsx', 'excel-editor'],
  ['.csv', ['csv-json']],
  ['json to csv', 'csv-json'],
  ['csv to json', 'csv-json'],

  // --- audio and video -------------------------------------------------------
  ['mp4 to gif', 'video-edit'],
  ['.wav', 'audio-convert'],
  ['m4a to wav', 'audio-convert'],
  ['.srt', 'subtitle-editor'],
  ['mp4 to jpg', 'video-edit'],

  // --- archives and binaries -------------------------------------------------

  // --- developer formats -----------------------------------------------------
  ['.jwt', 'jwt-decoder'],
  ['.pem', 'cert-decoder'],

  // --- Arabic, same axis -----------------------------------------------------
  ['تحويل jpg إلى png', 'image-compressor'],
  // «open an xlsx file» — the spreadsheet editor opens it, xlsx-convert reads it out.
  ['فتح ملف xlsx', ['excel-editor']],
  ['تحويل pdf إلى صور', 'pdf-to-images'],
  ['ملف srt', 'subtitle-editor'],
]
