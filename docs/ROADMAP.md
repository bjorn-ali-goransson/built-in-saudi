# Built in Saudi — Roadmap

The backlog, and an honest account of what exists. **180 tools are live.** This
file was badly stale before August 2026 — it listed shipped tools as unbuilt
ideas — so it is now organised around what is *true* rather than what was once
planned.

Prioritisation weighs **demand**, the **privacy wedge** (competitors upload your
files; we don't), **frontend feasibility**, and **effort**.

**Runs**: `client` = 100% in-browser (our default); `queue` = would need the
optional [backend worker](./BACKEND.md).

---

## What is live (August 2026)

| Category | Count | Shape of it |
|---|---|---|
| Developer | 32 | encoders, formatters, regex, JWT, cron (explain **and** build), cURL→code, URL parsing, HMAC, JSON diff, CSV clean/merge, X.509 certificates, email headers |
| Saudi / Local | 25 | prayer, Hijri, qibla, adhkar, IBAN, tafqeet, Arabic normalisation/numerals/Franco, phone, iqama expiry, weather, vehicle plates, short address, **khatma planner**, **monthly prayer timetable** |
| Text | 22 | counters, diffing, readability, anonymising, invisible characters, subtitles, character finder, **on-device translator and summariser** |
| Images | 19 | compress/convert/crop, OCR, background removal, redaction, passport photos, carousel, screenshot framing, batch watermark, colour-blindness simulator |
| Calculators | 18 | VAT, zakat, dates, coordinates, timezones, sun times, and the health cluster |
| Generators | 21 | QR, barcode, passwords, passphrases, 2FA, printable paper, labels, wheels and draws, worksheets, bingo cards, quizzes, Arabic handwriting sheets, .ics events, seating charts, attendance sheets |
| PDF | 12 | merge/split/compress/sign/fill/edit, →images, →text, booklet imposition, stamping, **true redaction** |
| Design | 10 | colour, contrast, gradients, bezier, palette-from-image, SVG optimiser |
| Files | 11 | archives, metadata, hex, encryption, audio trim/extract, video→GIF, **video trim (no re-encode)**, **xlsx→CSV/JSON**, **spreadsheet→vCard**, **spreadsheet diff** |
| Business | 5 | invoice, quotation/receipt, certificates, CV optimizer, Book Me |
| Converters, Communication, Utilities | 5 | units, base64, timestamps, Calls, QR reader |

Everything is client-side except the documented server-backed tools (Book Me,
Calls signalling, CV optimizer, link shortener, prompt analyzer, Arabic
diacritizer) — see [`BACKEND.md`](./BACKEND.md) and the Privacy page.

---

## Out of scope (deliberately excluded)

- **Interest / riba-based tools.** No loan, EMI or interest calculators.
  Excluded for Islamic (Shariah) reasons. *A `loan-calculator` was built during
  the July 2026 sweep in contradiction of this rule and was removed in August
  2026; `/apps/loan-calculator` redirects to the catalogue.* If instalment
  finance is ever wanted here it should be modelled as Murabaha or Ijara, not as
  interest.
- **Irrelevant noise** — construction-cost estimators, CGPA, arcade games, and
  the filler seen on competitor "all-in-one" sites.
- **Anything needing a scraped source or an API key we don't want to run**
  (keyword research, AI blog/social generators) unless offered as an external
  showcase.
- **A "file shredder".** It is a lie in a browser and we will not ship one.
- **Speed tests.** Bandwidth is the product, and it costs us per visitor.
- **YouTube thumbnail downloader** — off-brand, no privacy wedge, thin value.

---

## Parked, with the reason

Wanted, but blocked on something real. Do not build these casually.

| Idea | Blocked on |
|---|---|
| **On-device AI: Prompt / Writer / Rewriter / Proofreader** | Origin trial or flag only, verified in a real browser August 2026. The three **stable** APIs are shipped — see below. Revisit when these leave trial; a Proofreader would be the strongest of them. |
| **JSON ↔ YAML ↔ TOML** | Needs real parsers. Hand-rolling YAML is how you ship silently-wrong output. |
| **GOSI contributions** | Rates changed with the 2024 pension law and differ by nationality and hire date. Needs an authoritative current source, not memory. |
| **Mirath / inheritance (فرائض)** | The highest-demand Saudi wedge left, and the one most in need of scholarly sourcing and review. Same bar as `zakat` and `end-of-service`. |
| **PDF ↔ Word/Excel, ML upscaling, heavy ffmpeg** | Compute we would have to host — see [`BACKEND.md`](./BACKEND.md). |
| **ZATCA / Fatoora e-invoicing** | Needs a backend and a crypto stamp. We may decode a QR; we must never call anything "a compliant invoice". |
| **HIBP breach check** | Needs an API we would have to proxy, which puts a hash of your password through our server. |

---

## Shipped: on-device AI (August 2026)

`translate` and `summarize` use Chrome/Edge's built-in models, which run on the
device. Findings worth keeping, all verified in a real browser rather than read
off a spec — they should shape anything built on these APIs next:

- **Translator does Arabic with 54 other languages**, including Urdu, Hindi,
  Bengali, Malayalam, Tamil, Telugu, Nepali, Sinhala, Amharic, Tigrinya, Somali,
  Pashto and Farsi — nearly every language spoken at work in this country.
  **Filipino/Tagalog is the notable gap.**
- **Summarizer does NOT do Arabic** (en, es, ja, de, fr only), as input or
  output. The tool detects and refuses rather than producing confident nonsense.
- **The constructors existing proves nothing.** Playwright's Chromium exposes
  the whole API and has no models. Decide from the *answers*, not the globals.
- **`translateStreaming` is present and throws** on Edge 151, on the same
  translator whose `translate()` is perfect. Always have a batch fallback.
- **The first `create()` after a pack download can reject** with a bare "Other
  generic failures occurred" and succeed on an immediate retry.
- **`create()` needs user activation**, even when availability says the pack is
  present — so live-as-you-type must never be the thing that creates the model.
- **Capability queries can hang.** They are timed out; a browser that will not
  say whether it can do something cannot do it.

---

## Next, ranked

The July–August 2026 list is finished — print goods, passphrase, image
finishing, the Saudi remainder, sound, and the classroom set all shipped, plus
the two AI tools above.

**Top of the list now:**

~~1. Arabic handwriting practice sheets~~ — shipped, and it does the four
positional forms with joiners rather than the deprecated presentation block.
~~2. Excel (.xlsx) → CSV / JSON~~ — shipped, on a new dependency-free
`lib/unzip.ts` that also opens the door to .docx/.pptx/.epub.

~~3. Quran khatma planner~~ — shipped. Built on exactly one piece of reference
data (the page each juz opens on in the 604-page Madani mushaf), stated in the
UI, because a plan quoting pages from an edition you do not own is worse than no
plan. **No surah/ayah division on purpose**: that needs a verified table of 114
starting pages, and half-remembered reference data has no place in a tool people
use for worship.

**Nothing is queued above the backlog now.** Pick from it, or from a fresh look
at what people search for.

---

## Backlog

Not ranked against each other — a supply of candidates, so that choosing is
never limited by what happens to be written down. Each line says why it would
earn a slot. **`client` unless noted.**

### Classroom and family

| Idea | Why it earns a slot |
|---|---|
| Times-table charts and drills | Trivial next to `worksheets`, and constantly searched for. |
| Name tags / desk plates | The `label-sheet` chassis with bigger type and correct Arabic shaping. |
| Weekly reward charts | `certificate` exists; the weekly version is a different, smaller thing. |
| Reading log / homework diary | Printable weekly grid, seeded so a reprint matches. |
| Flashcard printing | `flashcards` is on-screen only; the print path is its own tool. |

### Saudi and local

| Idea | Why it earns a slot |
|---|---|
| Electricity bill estimator (SEC tariff) | A real money question. Needs `<Disclaimer kind="financial">` **and a printed tariff-as-of date**, or it rots silently. |
| Fuel / trip cost calculator | Same shape — let the user set the price rather than baking in a number that goes stale. |
| Arabic contract and letter templates | Bilingual printable forms; pairs with `quotation` and `invoice`. |
| Hijri event countdown (print + share) | Ramadan, Hajj, National Day; all the date machinery is here. |
| Arabic name transliteration helper | The passport-spelling Ahmad/Ahmed problem, with the plate letter table as precedent. |
| Iqama fee / traffic fine reference | Reference tables only, clearly dated. **Never** a live lookup — that needs an API we should not proxy. |

### Files and formats

| Idea | Why it earns a slot |
|---|---|
| EPUB → text / metadata | A zip of XHTML, and the zip library is already here. |
| SQLite file inspector | `sql.js` is a real dependency — weigh it — but "what is in this .db" has no private alternative. |
| Split a large CSV by size or column | The complement to `csv-merge`. |

### Developer

| Idea | Why it earns a slot |
|---|---|
| `.env` ↔ JSON ↔ shell export | Small, constant, and hand-edited by everyone today. |
| Chmod / umask calculator | Tiny, evergreen, purely arithmetic. |
| Webhook payload formatter | Paste a payload, get a typed shape; `json-to-types` adjacent. |
| Regex → plain English | The inverse of `regex-tester`, and much harder to find free. |

### Text and language

| Idea | Why it earns a slot |
|---|---|
| Proofreader (on-device) | Blocked on the API leaving origin trial; the strongest of the remaining AI ones. |
| Arabic → Franco (reverse) | `franco-arabic` only goes one way today. |
| Tashkeel remover / normaliser | `arabic-normalize` may already cover it — check before building. |
| Text-to-speech read-aloud | Speech synthesis is on-device; no export, so scope it as read-aloud only. |
| Speech-to-text | **Do not build.** Verified August 2026: no on-device recognition, so the audio goes to a cloud service. That is the one thing this site does not do. |

### Images and media

| Idea | Why it earns a slot |
|---|---|
| Progressive MP4 muxer for `video-trim` | The trimmer ships with fragmented output (a moof+mdat per sample). It plays, but a real muxer would make friendlier files. |
| Video convert / re-encode | The trimmer copies samples; changing codec or size needs WebCodecs encode, which is a different tool with different honesty problems. |
| Remove silence from audio | Web Audio, sits beside `audio-trim`; podcast editors pay for this. |
| Collage / contact sheet | Print chassis plus image decoding, both already here. |
| Polaroid frame / device mockup | The last two items of the old "image finishing" batch. |

### Not a tool, and possibly worth more than the next ten

At 168 tools, **discoverability is the constraint, not supply**. A visitor who
cannot find the right app has the same experience as one for whom it was never
built. Worth its own piece of work: search ranking, a "what do you need?" entry
point, and grouping that survives another fifty tools.

---

## Conventions when adding a tool

See [`CLAUDE.md`](../CLAUDE.md) for the full checklist. The three easiest to
forget:

- **Add its EN/AR entry to `src/i18n/seo.ts` and both locale URLs to
  `public/sitemap.xml`**, or the page is never prerendered or indexed.
- **Anything estimating money, health, an entitlement or an official deadline
  renders `<Disclaimer kind={…}>`** — `e2e/disclaimers.spec.ts` fails the build
  otherwise.
- **A tool holding an uploaded file calls `setWorkInProgress`**, or a deploy can
  reload over the user's work.

Per-tool specs live in [`docs/tools/`](./tools/). The many small single-purpose
utilities are built straight from the checklist; write a spec when the tool is
substantial.
