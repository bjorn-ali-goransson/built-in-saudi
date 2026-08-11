// HELD-OUT SET #8 — written 11 August 2026, before any of it was run.
//
// Axes used so far: tool-name-ish (#1), paraphrase (#2), natural sentence (#3),
// symptom (#4), file extension (#5), Arabic morphology (#6), numeric shape
// (#7). This one is **the PRODUCT NAME used as the verb** — `calendly`,
// `docusign`, `tinypng`, `bitly`, `remove.bg` — plus **compound tasks**, where
// one sentence names two jobs.
//
// Why it is worth its own set, and why it is the axis most likely to embarrass
// us: the catalogue is written in the vocabulary of the FUNCTION, and an
// enormous number of people name a function by the product that made it famous.
// «باركود» is already recorded here as a brand-shaped word that won; nobody has
// asked the general question. It also has a property no earlier set had —
// **half the rows are expected to return NOTHING**, because this site
// deliberately does not imitate Photoshop or run a file-transfer service, and
// answering those would be the adware move. So the set measures precision and
// recall at once, which none of #1–#7 do.
//
// The compound rows are the second half: `sign a pdf and send it` names a job
// we do and a job we do not, in one sentence. The scorer has no notion of a
// conjunction, so the honest expectation is the job we CAN do.
//
// A tool pair is expected to accept EITHER member where both readings are
// honest, following the bench's array convention.
//
// Measure ONCE, fix only unambiguous defects, record the rest, mark it spent.

export const UNTUNED8 = [
  // --- products whose function we DO have -----------------------------------
  ['calendly', 'book-me'],
  ['doodle poll', 'book-me'],
  ['docusign', 'pdf-sign'],
  ['bitly', 'link-shortener'],
  ['tinyurl', 'link-shortener'],
  ['tinypng', 'image-compressor'],
  ['squoosh', 'image-compressor'],
  ['remove.bg', 'remove-background'],
  ['regex101', 'regex-tester'],
  ['jsonlint', 'json-formatter'],
  ['google translate', 'translate'],
  ['zoom call', 'calls'],
  ['skype', 'calls'],
  ['trello', ['kanban', 'todo']],
  ['todoist', ['todo', 'kanban']],
  ['notion', ['todo', 'kanban']],
  ['lastpass', 'password-generator'],
  ['1password', 'password-generator'],
  ['authy', 'totp'],
  ['google authenticator', 'totp'],
  ['audacity', ['audio-trim', 'audio-convert']],
  ['handbrake', ['video-trim', 'audio-convert']],
  ['adobe acrobat', ['pdf-edit', 'pdf-merge']],
  ['ilovepdf', ['pdf-merge', 'pdf-split', 'pdf-compress', 'pdf-to-word']],
  ['smallpdf', ['pdf-merge', 'pdf-split', 'pdf-compress', 'pdf-to-word']],
  ['grammarly', 'readability'],
  ['hemingway editor', 'readability'],
  ['google forms', 'quiz-maker'],
  ['google calendar invite', 'ics-builder'],
  ['excel to csv', 'xlsx-convert'],
  ['powerpoint to text', 'pptx-to-text'],
  ['word to markdown', 'docx-markdown'],
  ['qr monkey', 'qr-code'],
  ['have i been pwned', 'password-strength'],

  // --- Arabic, same axis ----------------------------------------------------
  ['زووم', 'calls'],
  ['حوّل اكسل إلى csv', 'xlsx-convert'],
  ['اختصار رابط مثل bitly', 'link-shortener'],

  // --- compound tasks: two jobs in one sentence -----------------------------
  ['compress a photo and change its format', ['image-compressor', 'image-format-converter']],
  ['sign a pdf and send it', 'pdf-sign'],
  ['scan a receipt and get the text', ['image-to-text', 'doc-scan']],
  ['split a pdf then merge the parts', ['pdf-split', 'pdf-merge']],
  ['remove the background and resize for instagram', ['remove-background', 'social-resize']],
  ['take a screenshot and blur a name in it', 'image-redact'],
  ['record my screen and trim the video', ['screen-recorder', 'video-trim']],
  ['turn photos into a pdf and merge with another', ['images-to-pdf', 'pdf-merge']],
  ['count the words and check how long it takes to read', ['word-counter', 'speech-time']],
]

// Products whose function this site deliberately does NOT provide. Answering
// these with the nearest thing is the adware move, and the relevance floor is
// what is supposed to stop it. Half the value of this set is here.
export const UNTUNED8_NOMATCH = [
  'photoshop',
  'canva',
  'wetransfer',
  'dropbox',
  'figma',
  'postman',
  'vlc',
  'spotify',
  'shazam',
  'mailchimp',
  'quickbooks',
  'salesforce',
]
