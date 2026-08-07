# Built in Saudi — Roadmap

The backlog, and an honest account of what exists. **186 tools are live.** This
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
| Saudi / Local | 27 | prayer, Hijri, qibla, adhkar, IBAN, tafqeet, Arabic normalisation/numerals/Franco, phone, iqama expiry, weather, vehicle plates, short address, **khatma planner**, **monthly prayer timetable**, **name spelling**, **invoice QR reader** |
| Text | 22 | counters, diffing, readability, anonymising, invisible characters, subtitles, character finder, **on-device translator and summariser** |
| Images | 19 | compress/convert/crop, OCR, background removal, redaction, passport photos, carousel, screenshot framing, batch watermark, colour-blindness simulator |
| Calculators | 18 | VAT, zakat, dates, coordinates, timezones, sun times, and the health cluster |
| Generators | 21 | QR, barcode, passwords, passphrases, 2FA, printable paper, labels, wheels and draws, worksheets, bingo cards, quizzes, Arabic handwriting sheets, .ics events, seating charts, attendance sheets |
| PDF | 13 | merge/split/compress/sign/fill/edit, →images, →text, booklet imposition, stamping, **page organiser**, **true redaction** |
| Design | 10 | colour, contrast, gradients, bezier, palette-from-image, SVG optimiser |
| Files | 14 | archives, metadata, hex, encryption, audio trim/extract, video→GIF, **video trim (no re-encode)**, **xlsx→CSV/JSON**, **spreadsheet→vCard**, **spreadsheet diff**, **remove silence**, **EPUB→text**, **CSV split** |
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

## Web sweep, 7 August 2026

What a fresh look at the open web turned up. Recorded including the dead ends,
so the next sweep does not repeat them.

**Worth building:**

| Idea | Why, and what makes it hard |
|---|---|
| ~~ZATCA invoice QR decoder~~ **SHIPPED** as `zatca-qr`. | E-invoicing became mandatory in mid-2026 for any business over SAR 375k, so every till receipt in the country now carries a QR. It is TLV (tag-length-value) plus base64: tags 1–5 are seller name, VAT number, ISO timestamp, total with VAT, and VAT amount. Decoding it is **explicitly allowed by our own out-of-scope rule** — we may decode a QR, we must never call anything "a compliant invoice" — and it is entirely client-side on top of the QR reader we already have. The trap is that the length byte counts UTF-8 BYTES, so an Arabic seller name breaks any decoder that counts characters. |
| **Password-protected PDF** | Payslips and bank statements arrive encrypted, and "unlock my payslip" tools are exactly the sites you must never hand a payslip to. pdf.js decrypts with a password the user already knows, so opening one and getting the text or the pages out is honest and feasible. **Caveat to disclose loudly:** rebuilding a *decrypted PDF that keeps its text* needs something like qpdf-wasm; rendering pages to images loses the text layer, and a tool that quietly rasterises someone's payslip has damaged it. |

**Checked and not worth it:** the 2026 web-platform baseline (zstd content encoding,
Trusted Types, the Navigation API, `shape()`, container-query changes) is
infrastructure rather than capability — none of it unlocks a tool we could not
already build. Worth re-checking only when something like HTML-in-Canvas is
broadly available, which would matter to the print tools.

**A note on method:** "best free online tools 2026" style queries returned pure
SEO filler in every variation tried. The productive queries were about a
specific *obligation* (ZATCA) and a specific *fear* (uploading a payslip).
Search for what people are forced to do and what they are afraid to hand over,
not for lists of tools.

## Code sweep, 7 August 2026

Read for what the codebase already knows how to do but does not offer, and for
the gaps between tools that only show up when you list them all out. Every claim
below was checked against the source, not assumed.

### Capabilities built and under-used

| Already here | What it would unlock |
|---|---|
| **`lib/unzip.ts`** — used by 2 tools | A **.docx → text** reader is the same shape as the EPUB one: a zip of XML, walk `word/document.xml`, honour block elements. Word documents are the format people most often need text out of, and it is the one big office format we still cannot open. `.pptx` after it. |
| **`lib/zip.ts` `zipStore` (writes)** + the xlsx reader | **CSV/table → .xlsx.** We read xlsx and write only CSV, so the loop is one-way. Writing one means `sharedStrings.xml` + a sheet + a content-types file, zipped — all of which we now have the parts for. Closes a gap people hit whenever the thing on the other end insists on a real workbook. |
| **`lib/pdfRender.ts`** (pdf.js) | The **password-protected PDF** opener from the web sweep. pdf.js decrypts given a password the user knows. |
| **`lib/builtinAi.ts`** | `detect-language` still uses a hand-rolled heuristic while the platform `LanguageDetector` is `available` with NO download on every browser that has it. Wiring it in as progressive enhancement is a small change with a real accuracy win. |

### Gaps between tools we already have

- ~~A PDF page organiser — rotate, reorder, delete pages.~~ **SHIPPED** as `pdf-organise`. Was verified missing:
  `pdf-edit` rotates *images inside* a page, not pages, and the `pdfOps` worker
  has `pageCount`/`merge`/`extract`/`burst` and no rotate. This is the most
  common thing anyone does to a PDF after merging, and we have twelve PDF tools
  without it. pdf-lib does `page.setRotation()` and reordering is a copy in a
  different order.
- **OCR a scanned PDF.** We have `pdf-to-images` and we have `image-to-text`,
  and not the combination — so a scanned, stamped document, which is most
  official paper in this country, cannot be turned into text in one step.
- **vCard → CSV.** `csv-vcard` goes one way only. The reverse is how you get a
  phone's contacts into a spreadsheet.
- **ZATCA invoice QR** extends `qr-reader` — see the web sweep above.

### Discoverability faults found while reading (fixed in this pass)

- **`Utilities` held exactly one tool.** A one-tool category costs a heading and
  a section break to show a single item, and it sorted to the end because it was
  not in `CATEGORY_ORDER` either. `qr-reader` decodes an image, so it moved to
  Images and the category is gone.
- **`Communication` was falling off the end of the order** for the same reason.
  It is a deliberate one-tool section — Calls is its own thing — so it is now
  placed explicitly rather than by accident.
- Still uneven, and worth a decision rather than a drive-by edit: `Calculators`
  (18) has become a grab-bag holding `sound-meter`, `bpm-tap`, `pomodoro` and
  `countdown`, none of which calculate anything; and `base-converter` sits in
  Developer while `unit-converter` sits in Converters.

### Nothing half-done

Grepped for `TODO`, `FIXME`, `HACK`, "for now", "not yet". The only hits are
descriptive comments and one honest disclaimer in `pdf-edit` about what it
cannot do. For a codebase this size that is worth noting as a finding in itself.

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
| Iqama fee / traffic fine reference | Reference tables only, clearly dated. **Never** a live lookup — that needs an API we should not proxy. |

### Files and formats

| Idea | Why it earns a slot |
|---|---|
| SQLite file inspector | `sql.js` is a real dependency — weigh it — but "what is in this .db" has no private alternative. |

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
