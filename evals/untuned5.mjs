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
  ['jpg to png', 'image-format-converter'],
  ['png to jpg', 'image-format-converter'],
  ['webp to jpg', 'image-format-converter'],
  ['.heic', 'image-format-converter'],
  ['heic to jpeg', 'image-format-converter'],
  ['avif', 'image-format-converter'],
  ['.svg', ['svg-editor', 'svg-optimise']],
  ['svg to png', 'image-format-converter'],
  ['.ico', 'favicon-generator'],

  // --- documents -------------------------------------------------------------
  ['.docx', ['docx-to-text', 'docx-markdown']],
  ['docx to txt', 'docx-to-text'],
  ['.pptx', 'pptx-to-text'],
  ['pptx to text', 'pptx-to-text'],
  ['.epub', ['epub-text', 'markdown-epub']],
  ['epub to txt', 'epub-text'],
  ['md to docx', 'markdown-docx'],
  ['.md', ['markdown-html', 'markdown-docx', 'paste-to-markdown']],
  ['pdf to jpg', 'pdf-to-images'],
  ['pdf to docx', 'pdf-to-word'],
  ['jpg to pdf', 'images-to-pdf'],

  // --- tabular and data ------------------------------------------------------
  ['.xlsx', ['xlsx-convert', 'csv-to-xlsx']],
  ['xlsx to csv', 'xlsx-convert'],
  ['csv to xlsx', 'csv-to-xlsx'],
  ['.csv', ['csv-clean', 'csv-json', 'csv-split']],
  ['json to csv', 'csv-json'],
  ['csv to json', 'csv-json'],
  ['.vcf', 'vcard-to-csv'],
  ['vcf to csv', 'vcard-to-csv'],
  ['.ics', 'ics-builder'],

  // --- audio and video -------------------------------------------------------
  ['mp4 to mp3', 'video-audio'],
  ['mp4 to gif', 'video-gif'],
  ['.wav', 'audio-convert'],
  ['m4a to wav', 'audio-convert'],
  ['.srt', 'subtitle-editor'],
  ['mp4 to jpg', 'video-frames'],

  // --- archives and binaries -------------------------------------------------
  ['.zip', ['archive-inspector', 'zip-create']],
  ['open a .zip', 'archive-inspector'],
  ['make a .zip', 'zip-create'],
  ['.exe what is inside', 'hex-viewer'],

  // --- developer formats -----------------------------------------------------
  ['.json pretty', 'json-formatter'],
  ['.jwt', 'jwt-decoder'],
  ['.pem', 'cert-decoder'],
  ['base64 to png', 'image-base64'],
  ['png to base64', 'image-base64'],

  // --- Arabic, same axis -----------------------------------------------------
  ['تحويل jpg إلى png', 'image-format-converter'],
  ['فتح ملف xlsx', 'xlsx-convert'],
  ['تحويل pdf إلى صور', 'pdf-to-images'],
  ['ملف vcf', 'vcard-to-csv'],
  ['تحويل mp4 إلى mp3', 'video-audio'],
  ['ملف srt', 'subtitle-editor'],
]
