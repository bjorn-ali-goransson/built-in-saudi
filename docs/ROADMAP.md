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
  interest. **It was re-proposed by a web sweep on 10 August 2026 and rebuilt in
  full before anything objected** — the only thing that stopped it was the
  redirect making its own page render the catalogue. `scripts/check-retired.mjs`
  now fails the build on a withdrawn id, so the next sweep is caught at the
  first build rather than at the last test.
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
| **`lib/unzip.ts`** — used by 3 tools | ~~A **.docx → text** reader~~ — **shipped** as `docx-to-text`. It was not the same shape as the EPUB one: Word splits a single word across runs, and a table row has to be assembled before it is emitted. `.pptx` is the next one, and it is genuinely the same shape as EPUB (one XML part per slide). |
| **`lib/zip.ts` `zipStore` (writes)** + the xlsx reader | ~~**CSV/table → .xlsx.**~~ **Shipped** as `csv-to-xlsx` (`lib/writeXlsx.ts`), and it needed no `sharedStrings.xml` at all — inline strings do the job with one part fewer. The real argument for it turned out not to be "the other end insists on a workbook" but that sending a CSV *damages the data*: Excel eats leading zeros and rounds long IBANs. |
| **`lib/pdfRender.ts`** (pdf.js) | The **password-protected PDF** opener from the web sweep. pdf.js decrypts given a password the user knows. |
| **`lib/builtinAi.ts`** | `detect-language` still uses a hand-rolled heuristic while the platform `LanguageDetector` is `available` with NO download on every browser that has it. Wiring it in as progressive enhancement is a small change with a real accuracy win. |

### Gaps between tools we already have

- ~~A PDF page organiser — rotate, reorder, delete pages.~~ **SHIPPED** as `pdf-organise`. Was verified missing:
  `pdf-edit` rotates *images inside* a page, not pages, and the `pdfOps` worker
  has `pageCount`/`merge`/`extract`/`burst` and no rotate. This is the most
  common thing anyone does to a PDF after merging, and we have twelve PDF tools
  without it. pdf-lib does `page.setRotation()` and reordering is a copy in a
  different order.
- ~~**OCR a scanned PDF.**~~ **Shipped** as `pdf-ocr`. The one design decision
  worth remembering: it asks the text extractor first and only OCRs the pages
  that are genuinely pictures — a page with a real text layer is copied out
  exactly, because OCR would turn a perfect copy into a guess.
- ~~**vCard → CSV.**~~ **Shipped** as `vcard-to-csv`. The inverse turned out to
  be much the harder direction: Android writes Arabic names as vCard 2.1
  quoted-printable, Apple hides half its properties behind `item1.` groups, and
  a folded line has to be rejoined before anything is parsed at all.
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

## Web sweep, 8 August 2026

Second sweep. The first one went looking for tool *categories*; this one went
looking for **rules that changed recently**, on the theory that a calculator is
only worth building when the correct answer is non-obvious and most of the
free ones are wrong. That is exactly what turned up, and it is concentrated in
the Saudi-local wedge rather than in generic utilities.

### Saudi money and work — the strongest gap, and we have none of it

1. ~~**GOSI / net salary calculator.**~~ **Shipped** as `gosi-salary`. It was
   the pick of the sweep because the rules are precise, recently changed, and
   almost universally got wrong:
   - **Two parallel systems.** Registered *before* 3 July 2024: total 21.5%
     (employer 11.75%, employee 9.75%). Registered *after*: the total rose in
     **July 2026** from 22.5% to **23.5%** (employer 12.75%, employee 10.75%).
     A calculator with one rate in it is wrong for half the workforce.
   - **The contributable wage is basic + housing ONLY**, capped at **SAR
     45,000/month**. Transport, phone, commission and bonus are excluded — this
     is the error every "just take 10% of your salary" answer makes.
   - **SANED** unemployment insurance is a further 0.75% each side.
   - **A non-Saudi employee contributes nothing**; the employer pays 2% for
     occupational hazards only. Someone on an iqama looking at a GOSI line on
     their payslip is looking at a mistake.
   Needs a `financial` Disclaimer naming GOSI as the authority.
2. **Citizen Account (حساب المواطن) estimator.** 720 SAR basic for the head of
   household, 720 additional (running to end-2026), 360 per dependent over 18
   and 216 under, tapered against household income up to a preventing limit,
   with the household counted to a reference cap of 6. Deposited on the 10th.
   Needs an `official` Disclaimer — this is an entitlement, and the estimate is
   not the decision.
3. **Saudization / Nitaqat band calculator.** Headcount ratio to band colour,
   including the **30% engineering quota from 30 June 2026**. The audience is
   every small employer in the country and the arithmetic is genuinely fiddly.
4. **Expat levy and dependent fee planner.** Monthly per-dependant cost and the
   company-ratio levy, projected over a contract.
5. **Labour-law leave and overtime calculator.** Overtime at 150%, annual leave
   21 days rising to 30, and what unused leave is worth on exit. Complements
   `end-of-service`, which stops at the gratuity.
6. **Traffic fine early-payment calculator.** Article 75 gives a standard 25%
   reduction inside the window — so the useful tool is a **deadline countdown**
   showing what it costs to be late.
7. **Real-estate transaction tax (RETT) estimator** — 5%, plus the white-land
   levy.
8. **Ejar contract reader.** Riyadh has a five-year rent freeze from September
   2025 pinned to the rent recorded at the effective date; an Ejar PDF is the
   document that settles an argument. Reading one and surfacing the dates and
   the rent is squarely on our PDF stack.
9. **Customs duty + VAT on an imported parcel.**
10. **SEC electricity bill estimator** (tiered tariff) and the water equivalent.

### Documents — the formats the new `unzip`/`writeXlsx` work makes cheap

11. ~~**`.pptx` → text/outline.**~~ **Shipped** as `pptx-to-text`. The trap was
    not the XML: it was that `slide10.xml` sorts before `slide2.xml`, so a
    naive read shuffles any deck with ten or more slides.
12. **`.docx` → Markdown**, keeping headings, lists and tables — `docx-to-text`
    already walks the structure and currently throws it away.
13. **`.eml` / `.msg` reader.** `email-headers` takes a paste; the file is what
    people actually have, and it carries the body and attachments too.
14. **Extract a ZIP in the browser.** `archive-inspector` lists entries and
    `unzip.ts` already does DEFLATE — extraction is the missing verb.
15. **Merge spreadsheets across files.** `csv-merge` exists; `readTableFile`
    already reads xlsx, so the xlsx version is nearly free.
16. **Export filled PDF form data as CSV** — `pdf-fill` knows the fields.
17. **RTF → text.**
18. **Diff two PDFs** at the text level, on `pdf-to-text` + `text-diff`.

### The one that follows directly from this week's work

19. **Searchable PDF.** `pdf-ocr` reads a scan and hands back text; writing that
    text back into the PDF as an invisible layer produces a file that is still
    the scan to look at and is **selectable and searchable** — which is what
    people actually wanted when they asked for OCR. Nothing free does this
    client-side. `images-to-pdf` + `pdf-ocr` + pdf-lib are all already here.
20. **Image → searchable PDF**, the same idea from photos of pages.

### Media and developer, lower priority

21. **Video compressor** (WebCodecs re-encode) — the honest complement to
    `video-trim`, which deliberately never re-encodes.
22. **Audio format converter** (wav ↔ opus/mp3).
23. **GIF → MP4**, the inverse of `video-gif`.
24. **On-device dictation** (Web Speech API), same stance as the built-in AI
    tools: it runs here or it does not ship.
25. **JSON ↔ YAML ↔ TOML** and **`.env` ↔ JSON**.
26. **SQL formatter.**
27. **Whole-palette contrast check** — `color-contrast` does pairs.

### What the sweep did NOT find

Searching for "tools people want that do not exist" returns listicles of tools
that do exist, and the AI-tool directories are all wrappers on somebody's API —
which is the opposite of this site's premise. The useful signal was entirely in
**recently changed local rules**, not in tool-idea lists. Worth remembering for
the next sweep: search the regulator, not the roundup.

## Code sweep, 8 August 2026

Read for capabilities already built that are one step from being a tool, and
for anything half-done.

**Shipped this round:** `pptx-to-text` (above).

**Searchable PDF — costed, and it is not free.** Writing `pdf-ocr`'s text back
into the scan as an invisible layer is the highest-value idea on either sweep,
and the parts look present (`pdf-lib` exports `TextRenderingMode.Invisible`,
`images-to-pdf` and `pdf-ocr` both exist). But pdf-lib derives a PDF's
**ToUnicode** map from a real embedded font, and embedding one needs
`@pdf-lib/fontkit`, which is not a dependency — and `public/fonts/` ships only
**Latin** IBM Plex subsets. So Arabic, which is the point here, needs a new npm
package *and* a full Arabic TTF (a subset will not do: OCR output is
open-vocabulary). English-only would work today with `StandardFonts`, but
shipping an Arabic-first site's OCR feature as English-only is the kind of
half-doing this repo avoids. **Worth building deliberately as its own piece of
work**, not squeezed into a batch.

**Two .docx readers now exist — and MEASURED, the CV one is already the right
one.** `mammoth` has been a dependency since #42 and the CV optimizer's
`extract.ts` uses `extractRawText`; `lib/docx.ts` is the dependency-free one
written for `docx-to-text`. The code sweep guessed that switching the CV
extractor to ours would improve extraction *and* drop a heavy dependency.
**`evals/docxextract.mjs` shows the opposite**, on the two-column table layout
that half of CVs use (dates left, role and bullets right):

| | `mammoth` (production) | `lib/docx.ts` |
|---|---|---|
| quantified bullets on their own line | **3** | 2 |
| role and its bullets | separate lines | **merged into one line** |

`extractRawText` emits every paragraph on its own line, which is exactly what a
résumé parser wants. Ours assembles the ROW and tab-joins the cells — correct
for a table of data, wrong for a document that merely uses a table for layout,
because it glues a role to all of its bullets. Since `impact` grades how many
bullets carry a number, the switch would have lowered the very metric we are
trying to raise. **Do not make it.** The harness needs no API key, so this
stays checkable while the evals are blocked.

**Dead machinery:** `comingSoonTools` in `src/tools/index.ts` filters for
`status: 'coming-soon'` and there are now zero such entries, so the export and
the catalogue branch that renders it are unreachable. Harmless, but it is one
of those things that quietly becomes load-bearing if left.

**Still latent, in rough order of value:** ~~extract a ZIP~~ (**done** — it was
the clearest half-done edge in the codebase: `archive-inspector` listed every
entry and could not produce one); `.docx` → Markdown
(`lib/docx.ts` already walks the structure and throws it away); `.eml`/`.msg`
reader (`email-headers` takes a paste, but the file is what people have);
merging spreadsheets across files (`readTableFile` already reads xlsx);
exporting a filled PDF form's data as CSV (`pdf-fill` knows the fields).

### Web sweep, 8 August 2026 (third pass — freelancers and small business)

Searched a domain the first two sweeps missed. The freelance work document
(`freelance.sa`) is free and issued in minutes, so there is no tool in it — but
the rules around it produced one:

- ~~**VAT registration threshold checker.**~~ **Shipped** as `vat-registration`.
  The sources name the mistake outright: founders "miscalculate by including
  exempt income or by looking only at a single calendar year rather than the
  rolling 12-month window that ZATCA actually uses."
- **Still open from this pass:** GOSI *voluntary* contributions for the
  self-employed (rules not clearly published — would need a primary source);
  ZATCA e-invoicing wave lookup (which Fatoora wave a business falls in, by
  turnover); a freelance invoice template that is ZATCA-compliant for a
  non-registered freelancer, which is a different document from the VAT invoice
  `invoice-generator` produces.

### Code sweep, 8 August 2026 (second pass)

Scanned for tools with **no e2e reference at all**: exactly one of 193,
`file-metadata`. Writing its coverage found a silent bug (compressed PDFs
showed no document info) — see CLAUDE.md. Worth repeating that scan
occasionally; it is one grep and it found the least-defended corner of the
codebase in seconds.

Also noted and NOT acted on: `Developer` is still 32 tools and the biggest
section by a distance, mixing data tools, security, web and project
scaffolding. Deferred three times now — it is a taxonomy decision about 32
tools, and unlike the Converters fix there is no single principle that
obviously settles it. Worth a human call.

### Web sweep, 8 August 2026 (fourth pass — vehicles)

- ~~**Fahes / istimara due dates.**~~ **Shipped** as `vehicle-renewal`. The
  find was not a date rule but a DEPENDENCY: the inspection gates the
  registration, so the useful output is the order, not two countdowns.
- **Still open from this pass:** traffic-fine early-payment countdown (Article
  75's 25% reduction — needs the exact window length from a primary source);
  vehicle insurance renewal; driving-licence renewal periods, which differ by
  age band.

### Web sweep, 8 August 2026 (fifth pass — housing)

- ~~**Rent freeze / renewal rules.**~~ **Shipped** as `rent-rules`. As with the
  vehicle tool, the find was not the headline rule but the exception to it: a
  pre-decree escalation clause survives the freeze, so the signing date decides
  the answer.
- **Still open:** REDF / Sakani eligibility (means-tested and detailed — would
  need a primary source); a rent-to-income affordability check; an Ejar contract
  reader, which is the PDF-stack idea from the second sweep and still stands.

### Code sweep, 8 August 2026 (third pass)

Scanned for **claims the codebase makes that nothing checks** — the same shape
as the two previous finds (a guard that needed an API key, a guard that was
circular). The biggest by far: 109 tools state that files never leave the
browser, and the claim was untested. `e2e/privacy.spec.ts` now tests it, and
proves it can fail.

Still latent: `.docx` → Markdown; an `.eml`/`.msg` reader; merging spreadsheets
across files; exporting a filled PDF form's data as CSV; the searchable PDF
(costed in the first code sweep — needs `@pdf-lib/fontkit` and a full Arabic
TTF); and `comingSoonTools`, which filters for a status no tool has any more.

### Web sweep, 8 August 2026 (sixth pass — consumer finance)

- ~~**Early settlement calculator.**~~ **Shipped** as `early-settlement`. The
  SAMA rule is precise: outstanding balance plus the term cost for the three
  months following, on a declining balance, rest waived.
- **Rejected on the same sweep: a "how much can I borrow" DBR calculator.** The
  33% personal-loan cap and 25% for pensioners are well established, but every
  source hedges the mortgage figure — "typically", "varies by lender", 45–55%.
  A confident number there would be wrong for many readers on a question where
  being wrong costs them, so it is not built. Same standard that kept the
  Citizen Account taper and the traffic-fine window unbuilt.

### Web sweep, 8 August 2026 (seventh pass — labour law)

- ~~**Leave and overtime calculator.**~~ **Shipped** as `leave-overtime`, which
  was idea #5 from the very first sweep. Same pattern as the vehicle and rent
  tools: the value is in the asymmetry and the cliff, not the arithmetic.
- **Still open:** unused-leave encashment on exit — the entitlement was not
  confirmed by the sources read, so the tool shows what a day of leave is worth
  without asserting a right to be paid for it. Worth a primary source before
  going further.

### Web sweep, 8 August 2026 (eighth pass — travel and residency)

- ~~**Exit/re-entry visa fee.**~~ **Shipped** as `exit-reentry`. Third tool in a
  row where the find was a *dependency or a step*, not the arithmetic: the fee
  steps every 30 days, and the iqama gates the visa.
- **Still open:** final exit rules and their timing; the Muqeem/Absher status
  checks (they need an account, so nothing to compute); dependant fee planning,
  which overlaps the levy idea from the first sweep.

### Measured gap, 8 August 2026

- ~~**A stopwatch.**~~ **Shipped** as `stopwatch`, with a countdown timer in the
  same tool. Found by measuring untuned queries rather than by asking what was
  missing, and deliberately not solved by adding the word to another tool's
  keywords — which would have made the query succeed and the user fail.

### Web sweep, 8 August 2026 (ninth pass — utilities)

- ~~**Electricity bill estimator.**~~ **Shipped** as `electricity-bill`. Closes
  idea #10 from the second sweep. The find was a *misconception* rather than a
  rule: people believe crossing 6,000 kWh reprices the whole bill.
- **Still open:** the water tariff, which is banded by consumption in a similar
  way but whose published schedule was not confirmed by the sources read.

### Web sweep, 8 August 2026 (tenth pass — education)

- ~~**Weighted admission score.**~~ **Shipped** as `admission-score`. The test
  that decided it: a rule "varies" in two different ways, and only one of them
  disqualifies a tool. A varying THRESHOLD we would have to guess (the DBR cap)
  does; a varying INPUT the user can look up (the university's weighting) does
  not.
- **Still open:** admission cut-offs by university and year, which are exactly
  the sort of thing that would need a maintained dataset and would go stale
  silently — the reason it is not built.

### Discoverability pass, 8 August 2026 (held-out measurement)

The tuned search bench said 100%; a **held-out set of 50 queries** written off
the tool list said **88% top-1 / 94% top-3**. That gap is the point — see the
search section of CLAUDE.md for the six defects it found and the rules they
produced. Both sets now read 100%, and `evals/untuned.mjs` is marked BURNED.

Still open, and worth doing before the next tuning round:

- **Write a fresh held-out set.** The existing one no longer measures anything.
  Fifty queries, off the tool list, run once, reported as found.
- ~~**A bad query returns junk rather than nothing.**~~ **Measured and partly
  fixed.** `aboveFloor` cuts below 25% of the top hit or an absolute 50: real
  result lists go from 31 to 5 on average with no bench answer leaving the top
  3, and 7 of 15 unanswerable queries now return nothing. **Still open:** the
  other 8 return a plausible-looking wrong answer (`order pizza` → the screen
  recorder, `book a flight` → Book Me). That is semantic, not a threshold
  problem — an empty-state that says "nothing here does that" would need to know
  the query is unanswerable, which the score cannot tell it.
- **Sweep the catalogue for keywords describing what a tool tolerates.** Two
  were found by accident (`scan` on the PDF organiser, `resize` on the cropper).
  There is no reason to think those were the only two, and each one silently
  costs another tool its own query.
- **Sweep for capabilities with no word.** HEIC was indexed nowhere despite
  being a headline feature. Workers, Arabic shaping and the ZIP reader are the
  obvious next candidates to check.

### CV evals, 8 August 2026 — the lever, sized without a key

`OPENAI_KEY` is still refused (401, key ending `q6UA`), so nothing judged can be
re-measured. The named lever — "how many real numbers we get out of the
candidate" — is a property of the INPUT, so it was sized anyway
(`node evals/roleimpact.mjs`).

**42.1% of roles in the 32-CV corpus already carry a figure.** The recorded next
experiment (scale the improve loop's question budget with the role count) was
therefore aimed at the smaller and more expensive half of the opportunity:

- targeting today's 4 questions at roles that LACK a figure: 66.7% → 77.8% of
  them asked about, +9 roles, no extra questions for the candidate;
- enlarging the budget: at most 18 roles beyond that, and only by asking more.

Next, in order, when a working key exists:

1. **Target the gaps prompt at unquantified roles** (identify them from the CV
   rather than leaving the model to notice), then judge `impact` before/after.
2. **Only then** consider a larger budget, capped — nobody answers twelve
   questions.
3. Re-run `evals/perfect.mjs` and `evals/gameable.mjs` to confirm the 1–5 scale
   has not compressed while all of this was untestable.

### Web sweep, 8 August 2026 (eleventh pass)

- ~~**Iqama renewal cost.**~~ **Shipped** as `iqama-fees`. Heavily searched, and
  every incumbent calculator prints a work-permit levy figure that the published
  sources disagree about. Ours refuses to, and says who owes it instead.
- **Open a password-protected PDF.** Still the strongest unbuilt idea and still
  blocked on the same thing: pdf.js decrypts with a password the user knows, but
  nothing in our stack re-emits a decrypted PDF **with its text layer**.
  Rasterising someone's payslip damages it, and OCRing it back would replace
  perfect text with a guess — which `pdf-ocr` already refuses to do on principle.
  The honest versions are "get the text out" and "get the pages out", both
  clearly labelled; the lossless version needs `qpdf-wasm`. **Verify the pdf-lib
  `ignoreEncryption` route before assuming** — it parses the structure but does
  not decrypt streams, so it is expected to produce a broken file.
- ~~**Flatten a PDF.**~~ **Refuted by the code sweep:** `pdf-fill` already has a
  "Lock fields (flatten)" checkbox, so this is not a gap between our own tools.
  A standalone version would only serve someone who filled the form elsewhere —
  a much weaker case than the web sweep recorded.
- **Compare two PDFs.** We have `text-diff`, `json-diff` and `sheet-diff`, plus
  `pdf-to-text` — and no PDF diff. Assembling the three is most of the work.
- **Declined: the 2026 skill-based work permit classification.** It sorts expats
  into skill bands, and the mapping is a maintained lookup table that would go
  stale silently. Same test that rejected the debt-burden calculator.
- **Declined: Musaned domestic worker package costs.** SAR 8,000–21,000
  depending on nationality and agency — a range we would have to invent a point
  inside. The domestic-worker LEVY (first four exempt, then SAR 800/month) is a
  clean rule but applies to very few households.

### Code sweep, 8 August 2026

- ~~**Table tools read their input three different ways.**~~ Fixed. See the
  `lib/tableFile.ts` section of CLAUDE.md.
- **`csv-json` has its own private `parseCsv`.** It is the only CSV tool not
  using `lib/csv`, so quoting and embedded-newline handling can drift from every
  other one. Converting it is not a one-liner — it is a ⇄ tool with its own text
  pipeline and no file input — but it is the last inconsistency in this family.
- **Sweep the privacy `CASES` list against a grep, not against memory.**
  `csv-merge` had always taken a file and was never listed. That is the second
  time this list has been found short.

### CV evals, 8 August 2026 (second pass) — the unit mismatch

`OPENAI_KEY` still 401. Measured without it (`node evals/roleimpact.mjs`):

**`impact` grades bullets; the improve loop asks about roles; a role holds 9.9
claim-like lines.** So a perfect run of the loop moves the graded quantity by
5.8pp (11.2% → 17.0%) while moving role coverage by 57.9pp (42.1% → 100%). The
loop is not underperforming — it is measured in the wrong unit, which explains
the +0.38 already recorded.

Revised order for when a key exists:

1. **Change the `impact` anchor to grade per-ROLE coverage** — does every role
   carry at least one concrete, attributable number? — rather than per-line
   density. Judge before/after. This also removes an incentive toward the
   padding failure mode that `evals/gameable.mjs` exists to catch, since a
   density target is precisely what rewards inventing a percentage per bullet.
2. **Then** target the question budget at unquantified roles (+11.1pp coverage,
   no extra questions), as measured in the first pass.
3. Only after both, consider enlarging the budget.
4. Re-run `perfect.mjs` and `gameable.mjs` — the scale has been untestable for a
   while and both guard against it compressing.

### Web sweep, 8 August 2026 (twelfth pass)

- ~~**Audio converter.**~~ **Shipped** as `audio-convert`. Found from outside:
  every privacy-first converter site lists audio and we had none, while the
  decode and WAV-encode halves had been sitting in `lib/` behind three other
  tools.
- **Declined: health insurance cost.** It is a genuine dependency — no valid
  policy means no iqama renewal and no school enrolment, the same shape as
  Fahes gating the istimara — but the premium is a 1,200–8,000 SAR range that
  varies by class, age and plan. That is a number we would have to invent a
  point inside, which is the test that also rejected the Musaned packages.
- **Open a password-protected PDF — worth one more look.** A competitor
  advertises client-side PDF *unlocking*, which is evidence the lossless route
  exists rather than proof. Before building: verify what pdf.js `saveDocument`
  emits for an encrypted document, and price `qpdf-wasm`.
- **Work the `UNVERIFIED` list in `scripts/check-privacy-coverage.mjs` down.**
  First batch done: 17 proved → **31 proved, 32 remaining**. The rest need
  fixtures the spec does not build yet — a video (video-trim, video-gif,
  video-audio), an SVG, an xlsx with a dynamic token, a PEM — or sit behind an
  interaction like the two that needed `reveal`. `image-to-text` and `pdf-ocr`
  pull the OCR models, so they will be slow and belong in their own pass.

### Catalogue shape, 8 August 2026

Now measured by `node evals/catalogshape.mjs` rather than counted once and
forgotten. `Saudi / Local` had grown to 31 (1.6x the median) and is back to 18,
with `Islamic` and `Arabic` split out on the principle that neither is a Saudi
administrative matter.

Still open:

- **`Developer` at 25** is the largest section again, and splitting it further
  remains genuinely undecided — there is no single principle that settles data
  vs security vs scaffolding the way "a file converter belongs in Converters"
  settled the last one. Do not split it just to flatten the histogram.
- **`weather` is filed under `Saudi / Local` and is not a Saudi tool.** It is
  the last obvious miscategorisation, and it has nowhere good to go: `Utilities`
  exists in the label map but has no other member, and a one-tool section is
  pooled into "Other" anyway. Left alone deliberately.
- **`Business` has 3 tools.** Small enough to be worth asking whether it earns a
  heading, but not wrong.

### CV evals, 8 August 2026 (third pass) — a real bug, no key needed

`OPENAI_KEY` still 401. Looked instead at the deterministic logic in the same
pipeline and found the worst bug of the three passes: an improve pass could
**delete a section of the candidate's CV**. See the patch note in CLAUDE.md.

Still open:

- ~~**The client-side half of that guard has no end-to-end test.**~~ Done, but
  not where expected: the merge moved to `src/lib/cvPatch.ts` and `patchcheck`
  now checks both halves, because a react-pdf canvas cannot be asserted on.
  `e2e/cv-improve.spec.ts` mocks the flow and covers the review dialog, the
  before/after radar and the improve budget.
- The prompt experiments from passes one and two remain blocked on a key, in
  this order: grade `impact` per-ROLE rather than per-line; then target the
  question budget at unquantified roles; then consider enlarging it.

### Web sweep, 8 August 2026 (thirteenth pass) — the PDF unlock question, settled

The recorded question was whether client-side PDF unlocking is feasible. Answer:
**the lossless version is not, without a new dependency** — `pdf-lib`'s
`ignoreEncryption` parses structure and leaves streams encrypted, and only
`qpdf-wasm` or sPDF.js (which overrides pdf-lib internals) would re-emit a
decrypted file with its text layer.

But the question was the wrong one. **pdf.js already decrypts given the
password**, and `pdf-to-text` had been detecting encryption and giving up since
its first version. No new tool and no dependency — see the note in CLAUDE.md.

Next, in order:

- **`pdf-to-images` and `pdf-ocr` take a password the same way.** Both are
  pdf.js; the change is the one just made to `extract.ts`.
- **The pdf-lib tools cannot open an encrypted PDF at all** (merge, split,
  stamp, organise, booklet, redact, fill, sign). They currently fail with a
  generic message. They should name the cause and route to `pdf-to-text`, the
  same way `pdf-ocr` routes a text-layer PDF away from OCR.
- **Lossless unlock stays parked.** Revisit only if `qpdf-wasm` proves small and
  maintained; the bar is the one HEIC cleared, not lower.

### Code sweep, 8 August 2026 (second pass)

- ~~**`pdf-ocr` takes a password.**~~ Done, for free — it shares
  `pdf-to-text`'s extractor. The prompt is now `components/ui/PdfPassword.tsx`.
- **Saudi rule tools are badged beta**, enforced by
  `scripts/check-saudi-beta.mjs` and shown on the tool page rather than only as
  an unlabelled dot in the catalogue.
- **Still open:** `pdf-to-images` (two pdf.js call sites) and the eight pdf-lib
  tools, which need a byte sniff for `/Encrypt` and a route to `pdf-to-text`
  rather than a generic failure.

### Discoverability, 8 August 2026 (second pass) — the dead ends

Search is saturated on both benches, so this looked at the other reachable
surface: the related-tools row. 81 of 203 pages (40%) had none. Filling from the
tool's own category takes that to 0 without touching the threshold — see the
related-tools note in CLAUDE.md, and `node evals/relatedcheck.mjs`.

Still open in discoverability:

- ~~**The scorer does not index a tool's `description`.**~~ **Tried and
  rejected on measurement** — it cost a tuned-bench fix and changed neither
  held-out set. See the note above `Searchable` in `src/lib/fuzzy.ts`.
- **`Developer` at 25** remains the largest section and remains deliberately
  unsplit.

### CV evals, 8 August 2026 (fourth pass) — coverage, not prompts

Key still 401. Closed the last recorded deterministic gap: the client half of
the patch guard, plus a mocked generate → review → improve flow.

Still open, and still needing a key, in this order:

1. Grade `impact` per-ROLE rather than per-line density.
2. Target the question budget at unquantified roles.
3. Only then consider enlarging the budget.
4. Re-run `perfect.mjs` and `gameable.mjs`; the 1–5 scale has been untestable
   for a while and both exist to catch it compressing.

### Web sweep, 8 August 2026 (fourteenth pass)

- ~~**Take a still out of a video.**~~ **Shipped** as `video-frames`. The video
  family had trim, GIF and audio-extract and no way to get one picture out.
- **Video compression is now feasible client-side, and is the biggest unbuilt
  tool these sweeps have found.** WebCodecs (`VideoDecoder`/`VideoEncoder`) is
  in Chrome 94+ and Firefox 130+, encoding runs on the GPU, and we already carry
  mp4box for the container. It is a substantial build, so it is written down
  rather than half-started:
  - **Safari has no `VideoEncoder`.** The tool must detect and say so plainly,
    the way `ModelGate` does for the on-device AI — not fail obscurely on an
    iPhone.
  - Audio has to be re-encoded too; check whether `AudioEncoder` offers AAC or
    only Opus, because the answer decides the output container.
  - `mp4box.addSample` writes a moof+mdat per sample (a *fragmented* MP4, ~2%
    overhead, no seek index — already recorded under `video-trim`). A compressor
    is the point at which a progressive muxer stops being optional.
- **Declined: the school calendar.** MOE dates are a maintained dataset that
  changes yearly and private schools differ by a few days — the same test that
  rejected the skill-band table.

### Code sweep, 8 August 2026 (third pass)

- ~~**`pdf-to-images` takes a password.**~~ Done, at both pdf.js call sites.
- ~~**The pdf-lib tools fail generically on an encrypted PDF.**~~ They now
  distinguish encrypted from unreadable and route to `pdf-to-text`.
- ~~**`pdf-merge` and `pdf-organise` have the copy and never render it.**~~
  Both now distinguish and route (9 Aug 2026). `pdf-merge` reads
  `PdfOps.lastFailure`; `pdf-organise` reads pdf.js's `PasswordException`,
  because it renders thumbnails before pdf-lib is involved — and it deliberately
  does not offer to take the password, since pdf-lib still could not write the
  result and the offer would fail at save.
- ~~**Six tools load pdf-lib directly and never see `why`.**~~ Done (9 Aug
  2026), and it was seven with `pdf-edit`. The sniff lifted to
  `src/lib/pdfFailure.ts` and the wording to `components/ui/PdfFailureNote.tsx`;
  the worker imports the same helper, so the two cannot disagree. Writing the
  spec found that the helper knew about pdf-lib and not pdf.js, and that four
  tools discarded a wrongly-picked file in silence.
- ~~**`csv-json` carries its own private `parseCsv`.**~~ Fixed — it was
  mishandling a BOM and assuming a comma.

### Web sweep, 9 August 2026 — and the gap was already inside the site

Swept the open web for tool ideas we do not have. The generic directories
("221+ free browser tools", "no-signup roundups") are noise — they list the same
converters we already ship. Three specific gaps came out of it:

1. **EPUB ↔ Markdown.** A live searched category with dedicated browser tools
   (`ePub2Markdown`, `file2markdown`, several "best EPUB to Markdown" listicles).
   We had the answer already and it was **wrong** — see the `epub-text` section
   in CLAUDE.md. Fixed this iteration, at the cost of no new code.
2. **Markdown → EPUB.** The inverse, and genuinely unbuilt. `zip.ts` writes
   store-only archives and an EPUB's `mimetype` entry MUST be stored and first,
   so the writer we have is exactly the writer this needs; `buildXlsx` is the
   precedent for hand-writing an XML-in-a-zip format. It needs a Markdown→HTML
   converter, which the repo does not have in that direction. **Genuine
   differentiator: an RTL Arabic EPUB**, which the incumbents do not produce.
3. **Spectrogram / waveform view of an audio file.** `lib/audio.ts` already
   decodes, and `AnalyserNode` is the platform's own FFT. `sound-meter` and
   `tuner` do this live; nothing does it for a file.

Deliberately NOT taken from the sweep:

- **Text to speech with an MP3 download.** `speechSynthesis` is on-device and
  free, but its output cannot be captured to a file in any browser — the tools
  advertising a download are server-side. Shipping playback only, under a name
  people search expecting a download, would be the adware move.

### An unreproduced flake in the privacy guard (9 Aug 2026)

`pdf-to-text: the file never leaves the browser` failed once inside a loaded
batch and passed in three subsequent runs, including two full re-runs of the
same batch — so the message was never captured and the cause is NOT diagnosed.
Recorded rather than guessed at.

~~The one suspicious thing in that spec is `await page.waitForTimeout(1500)`.~~
Replaced (9 Aug 2026) with a wait on the tool actually READING the file, plus a
short settle window — and the read is now asserted, so a vacuous case fails.
Measured before changing it: 2 of 68 cases had never opened the file at all
(`pdf-stamp`, which reads only when stamping, and `file-encrypt`, which needs a
password first). Both now carry an `act`.

The original flake was never reproduced, so this is not claimed as its fix — it
is a fix for the property that made the flake plausible.

### Code sweep, 10 August 2026 — who bypasses the image decoder

`decodeImage` is the documented single entry point for reading an image,
because it is the only thing that handles HEIC. Grepping for direct
`createImageBitmap` calls found five, and **two were real bugs**: `images-to-pdf`
and `steganography` both used the decoder to ACCEPT a file and something else to
USE it, so an iPhone photo got in and then failed. Fixed, with a spec that drives
the real HEIC fixture to the download and is verified to fail without either fix.

The other three are legitimate — `qr-reader` on a video frame, `pdf-compress` on
a rendered PDF page, `heicDecode`/`imageEncode.worker` inside the decoder itself.

**Worth a guard rather than a sweep?** Probably not: the legitimate uses
outnumber the illegitimate ones and no regex separates "the user's file" from "a
frame we just drew". The rule is now written down in sharper terms instead —
every path that touches the user's bytes, not just the one that greets them.

### Web sweep #9, 9 August 2026 — home and property

464 calculators on one site, and almost all of them commodity arithmetic. One
had a real local angle:

- **AC sizing** — SHIPPED as `ac-size`. Every incumbent assumes a temperate
  climate and undersizes a Gulf room by about a factor of three.
- **Paint, tile, flooring quantity** — pure geometry with no local variation, so
  we would be the 465th. Skipped.
- **Mortgage** — needs a rate, and the local interest is the REDF subsidy and
  SAMA's rules rather than the amortisation formula. Would need the
  corroboration treatment; a real candidate, but a bigger one than it looks.

### Re-measuring the browse depth (9 Aug 2026)

The 7.4/9.6-screen figure that justified the jump bar was taken at 207 tools and
three curated rows. Retaken at 217 tools and four:

| | then | now |
|---|---|---|
| desktop (1280x900) | 7.4 screens | **7.9** |
| mobile (390x844) | 9.6 screens | **10.3** |
| sections | 16 | 17 |
| jump bar visible / total width (mobile) | — | **355 / 1417px** |

The depth growth is expected and the bar absorbs it. The new finding is the last
row: the bar itself now hides three quarters of its chips on a phone, with no
affordance. **FIXED** — see the `SectionNav` notes in CLAUDE.md.

**A measurement taken once is a measurement about the past.** This one had been
quoted for a week as though it were current.

### Code sweep, 9 August 2026 — exports nothing references

A sweep for exported symbols with no caller. **The first version of the sweep
was wrong and would have reported a dozen false positives**: it excluded the
defining file, so every function a module's own hook calls looked dead.
Comparing total references instead gives seven, and three of them are real:

- **`recentTools.clearRecent`** — written the day recents shipped and never
  called. **FIXED**: the Recently used row can be cleared.
- **`cvApi.refineCv`** — `cv-refine` still serves `polish`, `elaborate` and
  `shorten`, each with its own quota counter in Firestore, and **no UI reaches
  any of them**; the only live caller of that endpoint is `improveCv`. Kept
  rather than deleted, with the situation written at the function: the server
  half is deployed, so a client that cannot reach it is one file from being
  fixed while a deleted one loses the contract. If it is ruled out for good, the
  counters in `functions/cv.js` should go too.
- **`decodeImage.disposeImageDecoder`** — its own comment says "call when a tool
  unmounts" and nothing does, so the HEIC wasm worker (~1.4MB) outlives the tool
  that created it. Not fixed here: terminating on unmount means re-instantiating
  the wasm on the next HEIC, and which trade is right needs measuring rather
  than guessing.

The rest are redundant helpers (`contacts.hasContact` duplicates a check that is
inlined at its one would-be call site) and are left alone.

### Web sweep #8, 9 August 2026 — the health calculators

The most crowded category swept so far: 124 calculators on one site, 71 on
another, all with the same list. Against ours (calorie needs, water intake,
sleep cycle, glucose units, medicine schedule, due date):

- **Ovulation / fertile window** — SHIPPED as `ovulation`, with the two
  corrections the category gets wrong.
- **BMI** — deliberately not built yet. It is the single most commoditised
  calculator on the web and a famously poor individual measure. The only version
  worth shipping reports **waist-to-height** alongside it and says which is more
  informative, which is a different tool from the 124 out there.
- **TDEE / macros** — `calorie-needs` already answers the calorie half; macros
  would be an addition to it rather than a tool.
- **Body fat from tape measurements, blood-pressure category** — both are
  clinical thresholds that move with guidance, so both would need the
  corroboration rule and a beta badge before they could ship.

### The catalogue had no notion of "new" (9 Aug 2026)

216 tools, ten of them shipped in a single day, and no way for a returning
visitor to see what changed — the registry carried no added-date at all, so
"new" was not merely unsurfaced but underivable.

It turned out to be derivable exactly: `git log --diff-filter=A` on each
`meta.ts` is the commit that shipped the tool. `scripts/gen-tool-dates.mjs`
writes `src/tools/added.ts` from one traversal, and the build fails if a live
tool is missing from it.

**Still open on this:** the tool PAGE says nothing about age either. A "new"
badge on a tool card is the obvious companion and was left out deliberately —
the catalogue row answers "what changed", and a badge on 63 tiles from one day
would answer nothing.

### Code sweep, 9 August 2026 — auditing the network mocks, and the last audio gap

Last iteration found that `page.route` cannot intercept a fetch the service
worker handles. The obvious follow-up was: **is any other spec mocking
vacuously?** Audited all four files that mock, and no:

- `public/sw.js` returns early for `url.origin !== self.location.origin`, so
  every CROSS-origin mock (open-meteo, the currency CDN, the Cloud Functions
  backend) bypasses the SW entirely and `page.route` works.
- `/version.json` is explicitly excluded from the SW for deploy detection.
- `calls.spec.ts` already uses `context.route`.
- And the third-party mocks assert mocked VALUES (3.75, 41.2, a fixed date), so
  a mock that failed to serve would fail the test rather than pass it.

Only the same-origin `/__hibp/` path was ever at risk, which is exactly the one
that broke. Recorded so the next person mocking a same-origin URL does not lose
the afternoon.

Then took the last unexploited capability in `lib/audio.ts`: **SHIPPED**
`audio-spectrum`.

### Web sweep #7, 9 August 2026 — the privacy tools

Our own territory, and mostly already ours: metadata stripping, EXIF scrubbing,
PDF redaction and file encryption are all crowded categories we already ship.
The sweep's honest answer was that the one real gap was **not a new tool** but a
missing capability in an existing one:

- **"Has this password leaked?"** — added to `password-strength` via HIBP's
  k-anonymous range API. Not a separate tool: "is this password good?" is one
  question, and answering half of it in two places would be worse.
- **Disk/file cleaners, breach-monitoring services** — need OS access or an
  account. Out of scope by construction.

### Web sweep #6, 9 August 2026 — the automotive calculators

A whole cottage industry (CalculatorCove, CarCalculator, Numeraty, WiserWork,
AutoCalcHub, Calculover) plus several Arabic ones. Against our catalogue:

- **Fuel / trip cost** — SHIPPED as `fuel-cost`, with the unit conversion and
  the 95-vs-91 answer the incumbents leave out.
- **Car loan / lease vs buy** — needs a rate the user must supply anyway, and
  `early-settlement` already owns the SAMA rule that makes the local version
  interesting. Low value.
- **Depreciation, EV charging cost** — both need market data we would have to
  invent or fetch. Out.
- **Tyre size comparison** — pure arithmetic on a sidewall code, genuinely
  unbuilt, and small. A reasonable candidate next time.

### Web sweep #5, 9 August 2026 — university students

Every student-tools site publishes the same handful. Against our catalogue:

- **GPA calculator** — SHIPPED as `gpa-calculator`, with the Saudi 5.00 scale
  and an honest conversion to 4.00 that no incumbent does.
- **Citation generator (APA/MLA/Chicago)** — repeatedly named and genuinely
  unbuilt. Large surface (source types × styles) where the whole value is
  correctness, and Arabic sources raise a transliteration question nobody has
  answered well. Worth doing properly or not at all.
- **Reading level checker** — we have `readability`.
- **Flashcards, Pomodoro, study timer** — we have all three.
- **Final-grade / weighted-grade calculator** ("what do I need in the final?")
  — small, and a natural companion to `gpa-calculator`.

### Web sweep #4, 9 August 2026 — freelancers and small business

The freelancer tooling market is almost all SaaS with accounts (Wave, Zoho,
Ramp) and therefore not our shape. One thing in it is:

- **Time card calculator** — a whole cottage industry of free single-purpose
  sites, and we had nothing. **SHIPPED** as `timesheet`, with the overnight
  shift, the decimal conversion and the Ramadan six-hour day that the generic
  ones miss.
- **Receipt scanner** — needs OCR (which we have) plus field extraction, which
  is a model, not a regex. Out of scope client-side for now.
- **Expense tracker / bookkeeping** — needs storage and an account. Backend.

### Web sweep #3, 9 August 2026 — the teacher-tools market

We are half in this market already (worksheets, bingo cards, quizzes,
flashcards, seating charts, attendance sheets, certificates, labels, random
picker, team maker, timers). What every free classroom site ships and we did
not:

- **Word search** — SHIPPED as `word-search`, with the Arabic handling no
  incumbent offers.
- **Rubric maker** — repeatedly named across the market ("Top 12 free rubric
  creators"). A criteria x levels grid with descriptors and points, printable
  through `lib/printPdf.ts`. The obvious next one from this sweep.
- **Exit ticket** — a small printable slip; probably a variant of the worksheet
  machinery rather than its own tool.
- **Grade calculator** — weighted marks. Close to `admission-score` and
  `percentage-calculator`; only worth it if the weighting UI is the point.

### Code sweep, 9 August 2026 — a writer with one caller, and a missing parser

The site could write a real `.docx` and exactly one tool did. The gap was not
the writer but **a Markdown parser**, which is now `src/lib/markdown.ts` and
unlocks three tools rather than one:

- **Markdown to Word** — SHIPPED as `markdown-docx`.
- ~~**Markdown to EPUB**~~ — SHIPPED as `markdown-epub` (9 Aug 2026), including
  the RTL Arabic no incumbent offers: page-progression-direction as well as
  `dir`, so the pages turn the right way and not only the text.
- **Markdown to PDF** — examined and NOT built, because the obvious route is a
  quiet quality loss. `lib/printPdf.ts` composes on a canvas, which shapes
  Arabic correctly and produces a PDF of IMAGES: no selectable text, no
  copy-paste, nothing machine-readable — the exact property `pdfguard` exists to
  protect on the CV. pdf-lib gives selectable text and cannot shape Arabic. So a
  naive tool would silently hand Arabic users a raster and English users a text
  PDF. Worth doing only with that fork stated in the UI, or with a shaper.
- ~~**`writeDocx` could emit a real numbering part.**~~ Done 9 Aug 2026, and the
  pinned test flipped exactly as designed. Lists now round-trip. What remains is
  smaller and belongs to the READER: mammoth merges two adjacent ordered lists,
  which the spec now records with the byte-level evidence that our writer gives
  each list its own `numId` and a `startOverride`.

Recorded, not fixed: `src/tools/cv-generator/docx.ts` keeps a private CRC32 and
stored-ZIP writer that duplicates `lib/zip.ts`. Left alone on purpose — it is
guarded by `evals/docxguard.mjs` and sits behind the document a candidate sends
to an employer, so the duplication is cheaper than the risk.

### Web sweep #2, 9 August 2026 — the Arabic tool sites

The English "free online tools" directories are a dead end: they list the
converters we already ship. Sweeping the **Arabic** tool sites we actually
compete with was worth far more, because they serve a different everyday need:

- **حاسبة الحمل (pregnancy due date)** is on 3arabhub, hesaby AND alarabictools
  and was on none of our 207. **SHIPPED** as `due-date`.
- **أسعار الذهب (daily gold prices)** is on most of them and needs a live feed,
  so it is a backend question — parked in `docs/BACKEND.md` territory rather
  than built.
- Everything else they list (age, date difference, zakat, currency, prayer
  times, VAT) we already have, several of them better.

Also swept and NOT taken:

- **HAR file viewer.** Well validated (every incumbent already claims
  client-side) and therefore crowded, and a waterfall UI is a large build for no
  differentiator. The interesting inverse — a HAR *sanitiser* that strips
  cookies and auth headers before you send one to support — is the better idea
  and is closer to `data-anonymize`.
- **GeoJSON viewer.** Drawing the geometry with no basemap is honest and
  client-side; fetching tiles is a third-party request in a privacy-first tool.
  Worth building only if the no-basemap version is genuinely useful.
- **EXIF GPS on a map** — already done. `file-metadata` decodes GPS and links
  out to OpenStreetMap rather than embedding tiles.

### Browsing was 7.4 screens with no jump — measured and fixed (9 Aug 2026)

Search has been benched to saturation (tuned 100%, held-out #1 98%, #2 90%,
Arabic 100%), and the browse path had no instrument at all. Reading section
offsets out of a real render:

| | desktop 1280x900 | mobile 390x844 |
|---|---|---|
| page height | 6623px — **7.4 screens** | 8093px — **9.6 screens** |
| last section starts at | screen 7 | **screen 9** |
| ways to jump to a section | none | none |

`SectionNav` docks a chip row under the header on both the home catalogue and
the launcher. After: one tap from the very bottom, heading lands at y=124/102
(clear of both sticky bars), 0px horizontal page overflow at either size.

~~**Still open on discoverability:** the catalogue has no per-category PAGE.~~
Done 9 Aug 2026 at `/{locale}/c/<slug>/` — 15 categories x 2 locales, each with
its own written description, prerendered, in the sitemap, linked from the
catalogue's section headings and from each other.

~~**Still open after that:** nothing links a tool page to its own category.~~
Done 9 Aug 2026. Measured before: **0 of 418 prerendered tool pages** linked to
a category, so the 30 category pages were reachable only from one another.
After: 418/418, plus the home crawlable block; pages linking a category page
went **30 → 450**.

**Category page ordering was examined and left alone.** Registry order is not
arbitrary — this file records it as the editorial judgement about which tool is
primary, and it is what breaks search ties by design. Re-sorting a category page
alphabetically would throw that away for no measured gain.

**Done instead (9 Aug 2026):** a wrong URL now suggests the tool it meant.
Measured with `node evals/slugprobe.mjs` BEFORE building it — 92% correct top
hit over 42 realistic slugs, 95% within three, 4 of 5 unanswerable slugs
correctly silent.

~~**Still open on discoverability:** the scorer has no edit distance.~~ Added
9 Aug 2026 as a fallback (`correctQuery`), measured: mistyped queries returning
an empty page 2 -> 0, top-1 74% -> 78%, all four benches unchanged.

~~**Still open:** the fallback fixes the empty page, not the mis-RANKED typo.~~
Done 9 Aug 2026, and it did get the before/after treatment: mistyped top-1
78% → 87%, all four benches unchanged, and `evals/correctioncheck.mjs` added
because the benches structurally cannot see a layer above the scorer.

**Still open, and small:** three typo cases remain, none of them a scorer
problem. `calender` reaches the ICS builder before the Hijri calendar (a genuine
ambiguity — the bench row may be the wrong half); `excel to csv converter` is a
direction ambiguity, not a typo; and «ضغط صوره» is a four-character Arabic word,
below the correction threshold that exists to stop «قهوة» becoming «قوة».

**Second unreproduced load flake (9 Aug 2026):** `not-found.spec.ts`'s bad
category slug case failed once inside a loaded batch and passed alone and on a
full re-run of the same batch, so the message was never captured. Not diagnosed,
and not attributed to the typo work — that path does not touch the 404 page.

### Rejected: a mechanical sweep for the Arabic plural trap (9 Aug 2026)

Three tools have now been caught with an Arabic name that does not CONTAIN the
word a person types — `فاتورة` (the name was the plural `الفواتير`), `ترجمة`
(the agent noun `المترجم`), `كلمة مرور` (the plural `كلمات المرور`). All three
were found by accident, by a held-out query happening to cover them, so the
obvious move was a harness that sweeps all 241 Arabic names for the pattern.

**It was built, measured across three tightenings, and deleted.** It could not
separate signal from noise at any of them:

| version | rule | "misses" | verdict |
|---|---|---|---|
| v1 | strip `ات`/`ين`, does the singular still find the tool | 98 / 241 | noise — the dual rule invented non-words (`تبا` from `التباين`) |
| v2 | drop `ين`, strip the `و`, report only rank 3+ | 25 | dominated by `ملفة`, which is not a word: the singular of `ملفات` is the masculine `ملف` |
| v3 | generate both candidate singulars, findable by either passes | 11 | almost all `ملف` ranking 3rd for tools whose names contain "files" — which is CORRECT for a generic word |

The reason is structural rather than a bug in the rules: **Arabic plurals are
mostly broken, and a broken plural is not derivable from its singular by any
suffix rule.** The one plural that IS derivable by suffix (the sound feminine
`ات`) yields, in this catalogue, generic words like "file" and "image" whose
third place is the right answer. A harness whose every finding needs a human to
overturn it is not a guard.

**What actually catches this class of defect is a held-out query set**, which is
what caught all three. Write one rather than reaching for a sweep.

### Held-out set #2, 8 August 2026 — baseline and known misses

`evals/untuned2.mjs`: 50 fresh queries, **90% top-1 / 100% top-3 / 0
unfindable**. Deliberately NOT fixed, so the set stays a measuring instrument
rather than being spent on its first reading. Fix them only alongside writing
set #3:

- `what does this cron mean` → cron-builder first. That IS the documented rule
  for a bare noun, but this query is not a bare noun; "mean" carries the intent
  and matches nothing.
- `make a certificate` → the SSL decoder wins. `make` is a stop word, so this is
  a bare tie on "certificate" resolved by catalogue order — and the site's own
  rule says a bare noun goes to the tool that MAKES the thing, which would put
  the generator first.
- `strong passphrase` → the password generator wins on "Strong" in its tagline.
- `is this colour readable` → the contrast checker is third.
- `ملف pdf إلى صور` → images-to-pdf wins. The direction problem again, in
  Arabic: the fix that worked for the vCard pair was indexing the directional
  phrase, and neither PDF tool does.

### CV evals, 8 August 2026 (fifth pass) — the untested export

Key still 401. `evals/docxguard.mjs` now guards the exported Word file, which
had no test of any kind despite being one of three documents the tool gives a
candidate. Six gates in `evals/check.mjs`.

Nothing new is open on the deterministic side of the CV pipeline. The prompt
experiments still need a key, unchanged in priority:

1. Grade `impact` per-ROLE rather than per-line density.
2. Target the question budget at unquantified roles.
3. Only then consider enlarging it.
4. Re-run `perfect.mjs` and `gameable.mjs`.

### Web sweep, 8 August 2026 (fifteenth pass)

- ~~**Which ZATCA e-invoicing wave am I in?**~~ **Shipped** as `zatca-wave`.
  Waves 23 (>750k, 31 Mar 2026), 24 (>375k, 30 Jun 2026) and 25 (>187.5k, 1 Feb
  2027), verified against two independent sources for 23 and 24; wave 25 has one
  source and is noted as the most recent announcement.
- **This tool WILL date.** When wave 26 is announced, add it to `WAVES` and move
  the SOURCES date. The "no announced wave reaches you yet" branch is written so
  that a business below the lowest threshold is told "not yet", never "never".
- **Waves 1–22 stay unenumerated** until their thresholds can be verified. Do
  not fill them in from a blog table.

### Code sweep, 8 August 2026 (fourth pass)

The privacy guard is at **57 proved of 66**. The seven left each need something
the spec cannot do yet, and are worth naming rather than leaving as a number:

- `image-format-converter` — its file input has no enclosing testid at all, so
  it needs one adding to the product.
- `image-to-text` and `pdf-ocr`'s OCR path pull the tesseract models; they will
  be slow and belong in a pass of their own.
- `sheet-diff` builds its testid dynamically per side.
- `svg-editor` — the only testid near its input is `svg-clear`.
- `xlsx-convert` and `zatca-qr` — `zq-camera` is the camera input, not the file
  one; find the right testid rather than guessing.

### Discoverability, 8 August 2026 (third pass)

- **Both spellings now indexed** across 13 tools. 8 of 12 -ise/-ize variants
  missed before, 5 returning nothing; 0 of 12 after.
- **The dead-term caveat is rejected on measurement** — see the note in
  CLAUDE.md. Do not revisit it without a different signal; the subsequence
  fallback means "matched nothing" almost never happens.
- **Still open:** the five known misses on held-out set #2, deliberately unfixed
  so the set stays a measuring instrument; `Developer` at 25, deliberately
  unsplit; and `weather` filed under `Saudi / Local` with nowhere better to go.

### Web sweep, 8 August 2026 (sixteenth pass)

- ~~**Accessibility checker.**~~ **Shipped** as `a11y-check`, paste-HTML rather
  than fetch-a-URL, because fetching someone else's page needs a server and this
  site does not have one for it.
- **Deliberately not attempted:** the WCAG 2.2 criteria that need layout —
  Target Size, Focus Appearance, Dragging Movements. They are not in the markup,
  and guessing them from HTML would be the false-certificate failure the tool
  exists to avoid.
- **Worth considering later:** the same checks over an uploaded `.html` file
  rather than a paste, which would need a row in the privacy `CASES` list.

### Code sweep, 8 August 2026 (fifth pass) — the privacy list is empty

**64 of 66 file-taking tools proved, 0 unproved**, the other 2 declared as
sending data by design. Product principle #1 is now tested on every page that
claims it.

Three inputs needed a `data-testid` added (`svg-file`, `qr-logo-file`, and
earlier `ps-file`/`p2i-file`); everything else was reachable through the
dropzone that wraps it.

Still open elsewhere:

- `csv-json` carries its own private `parseCsv` rather than `lib/csv`.
- `pdf-merge` and `pdf-organise` have the encrypted-vs-unreadable copy but only
  `pdf-split` renders the route to `pdf-to-text`; six more tools load pdf-lib
  directly and never see the reason at all.
- The five known misses on held-out set #2, deliberately unfixed.

### Discoverability, 8 August 2026 (fourth pass) — the harness was lying

Nine tools shipped since the catalogue and related-row properties were measured,
so both were re-run rather than assumed. The catalogue is unchanged (Developer
still the largest at 25, deliberately). The related-row harness reported **77
dead ends** — and was wrong: it kept a copy of the selection logic that predated
the category fill.

Fixed by extracting `src/lib/relatedPick.ts` so the harness calls production.
**The remaining mirrors are worth auditing the same way:** `evals/lib/extract.mjs`
mirrors `extract.ts` and `evals/lib/cvText.mjs` mirrors `functions/cvText.js`.
Both have a check that they still agree; `relatedcheck` had none, which is why
it drifted silently.

### Web sweep, 8 August 2026 (seventeenth pass)

No new tool. The sweep found something better: an EXISTING tool giving a
materially wrong answer. `end-of-service` implemented Articles 84 and 85 and not
Article 87, so it under-reported the award for every resignation the law treats
as a termination. Fixed, with sources.

- **Worth auditing the other rule tools the same way**: each encodes the rule it
  was built for, and the question is what sits NEXT to that rule in the statute.
  `leave-overtime` (annual leave, notice, overtime) and `exit-reentry` are the
  obvious candidates.
- **Declined again: browser-native PDF annotation.** Chrome shipped markup and
  signing in Feb 2026, and we already have `pdf-sign` and `pdf-edit`. Nothing to
  add.

### Code sweep, 8 August 2026 (sixth pass)

`csv-json` was the last CSV tool not using `lib/csv`, and the duplication had
already cost correctness — see the note in CLAUDE.md.

Still open:

- `pdf-merge` and `pdf-organise` carry the encrypted-vs-unreadable copy but only
  `pdf-split` renders the route to `pdf-to-text`; six more tools load pdf-lib
  directly and never see the reason at all.
- Audit the remaining rule tools for the statute sitting NEXT to the one they
  encode, as `end-of-service` needed: `leave-overtime` and `exit-reentry` first.
- The five known misses on held-out set #2, deliberately unfixed.

### Discoverability, 9 August 2026 — measuring the Arabic half

The three benches were 10–16% Arabic. `evals/untunedar.mjs` fixes that: 41
Arabic phrasings, first run **90% top-1 / 98% top-3 / 0 unfindable**, the same
as English.

- Two real defects found (a plural tool name, a missing keyword), two rows
  ambiguous, one row simply wrong. Partly burned as a result — write a new
  Arabic set before believing a number from it about unseen queries.
- **Worth doing next: sweep every tool's Arabic NAME for the same plural trap.**
  Three have now been caught one at a time (فاتورة, ترجمة, كلمات المرور) and
  there is no reason to think they are the last. A script could list every
  `nameAr` whose head noun is plural where the tool's own keywords use the
  singular.

### Web sweep, 9 August 2026 (eighteenth pass)

- ~~**Compare two images.**~~ **Shipped** as `image-diff`. The gap was in our own
  diff family: text, JSON and spreadsheets were covered and images were not.
- **DECLINED: the traffic black-points calculator.** The interesting half — when
  do points clear — is contested between sources. One says a full Hijri year
  after your last violation, another says they reset at the Hijri new year.
  Those give different answers, and by the `iqama-fees` rule a contested figure
  does not get encoded. What is uncontested (24 points, 3/6/12-month escalation)
  is too thin to be a tool. Revisit only with an official MOI/Absher source.


### Discoverability, 10 August 2026 — the other half of the palette

`useResultKeys` gives both search surfaces arrow-key navigation. Enter already
opened the top result; **choosing the second one still meant reaching for the
mouse**, which is exactly what an ambiguous query needs — and this repo has
measured several ambiguous queries («باركود», `ebook`, `calendar`).

- Extracted to a hook at **two** callers rather than the usual three, because
  home and the launcher are documented as having to behave identically.
- The highlight resets on every new result list, so a further keystroke can
  never leave Enter aimed at a row that has scrolled out of the list.
- Covered by `e2e/result-keys.spec.ts`, which asserts the OLD contract
  (bare Enter opens the top result) still holds — the behaviour being added must
  not quietly replace the one that was already there.

Still open from the pass before: sweep every tool's Arabic name for the plural
trap, which has now been caught three times one at a time.

### Web sweep, 10 August 2026 (nineteenth pass)

- ~~**Words to speaking time.**~~ **Shipped** as `speech-time`. The category is
  large — at least eight sites whose entire domain is that one calculator — and
  every one applies an English words-per-minute rate to any script. Arabic
  reads at 138 wpm against English's 228 on the standardized international
  test (IReST, 436 readers, 17 languages), a 73% difference. **It found the
  same bug in our own `text-counter`**, which had used a hardcoded 200 wpm in
  both locales since it was written.
- **DECLINED for now: an AI token / API cost calculator.** It appears in the
  trending lists, and the arithmetic is trivial, but the whole value is the
  per-model price table — which changes without notice, is published in half a
  dozen incompatible shapes, and would be wrong within weeks with nobody
  maintaining it. That is the `iqama-fees` situation without even the
  consolation of naming who owes the money. Revisit only with a maintained
  source.
- **Still unbuilt from earlier sweeps:** BMI + waist-to-height, citation
  generator, rubric maker, tyre size comparison, HAR sanitiser, GeoJSON viewer.
- **Worth a look next:** the "intermittent fasting" calculator that shows up in
  the trending lists is interesting HERE for a reason it is not elsewhere —
  Ramadan and the Monday/Thursday sunnah fasts are the same arithmetic against
  a Hijri calendar and prayer times we already compute. `medicine-schedule`
  already spreads doses across the fasting window, so half the machinery exists.

### Code sweep, 10 August 2026 (nineteenth pass)

Swept for exports nothing references, for facts written down more than once, and
for capability with no page in front of it.

- ~~**The official holidays.**~~ **Shipped** as `saudi-holidays`. Umm al-Qura
  conversion, an events table and a dead `upcomingEvents()` were all in place
  while «الإجازات الرسمية» returned NOTHING and «كم باقي على العيد» returned the
  vehicle-registration tool.
- **Fixed on the way past:** the six Islamic events existed in three copies;
  `gen-tool-dates.mjs` stamped an uncommitted tool with the UTC date, i.e.
  yesterday in Riyadh; and `recently-added.spec.ts` asserted the row holds
  everything sharing the newest date, which is a date window — the opposite of
  the documented contract, and it broke the first time one tool shipped alone.
- **Still open, recorded rather than built:**
  - `zip.ts` writes STORE-only while `unzip.ts` already uses
    `DecompressionStream('deflate-raw')`. Its mirror, `CompressionStream`, would
    make a real compressed-ZIP writer free of any dependency — which is what a
    "create a ZIP" tool would need to be worth having.
  - `buildIcs` is single-event and EventInput-shaped, so the holidays tool has
    no "add to calendar". Extracting a `buildIcsCalendar(events[])` that
    `buildIcs` delegates to is the second-caller move this repo prefers.
  - `disposeImageDecoder`, `cvApi.refineCv`, `dms.threadWith`/`countsByContact`,
    `contacts.hasContact`, `voiceNotes.delVoiceBlob` and
    `book-with-me/lib.enumerateDaySlots` are all still unreferenced.
  - Six pdf-lib tools still bypass `PdfOps`.

### Discoverability, 10 August 2026 — how often is the top result a coin toss?

`evals/tieprobe.mjs` is the new instrument, and it answers a question the repo
had assumed rather than measured. Ties are rare and mostly right on real
queries (12/272, none wider than two) and catastrophic on generic ones: 161 of
1,522 single-word keywords tie, 45 three-way or wider, «حاسبة» eighteen ways.

Answered with a category offer rather than a tie-break, measured by
`evals/categoryprobe.mjs` at 35/35 fired and 0 false positives across benched
queries, tool names and the unanswerable set.

Still open, and now quantified rather than suspected:

- **`رمضان` and `معلم` are 6-way ties with NO category to offer.** Ramadan
  cross-cuts Islamic, health and work tools; «معلم» (teacher) cross-cuts six
  teaching tools filed under Generators, Files and Text. Those are real
  families the category tree does not name — a curated cross-cutting collection
  (the way `RECOMMENDED` and `DUA` already work) would answer them, and unlike
  a category it cannot be a page, for the reason recorded above.
- The one own-name miss is still `barcode`'s Arabic name losing to `qr-code`,
  which is expected and documented.

### Web sweep, 10 August 2026 (twentieth pass)

- ~~**PDF to Word.**~~ **Shipped** as `pdf-to-word`, and it was the biggest gap
  on the site: the most-requested PDF task on the web, ~2M conversions a day,
  with under 15% of them avoiding a server upload. Both halves already existed —
  pdf.js extraction and `lib/writeDocx.ts` — so what was missing was the
  structure inference between them.
- **Reverted on measurement:** a build step copying pdf.js's 800KB of substitute
  fonts to our own origin. The pdf.js warning naming `standardFontDataUrl` was
  true and not the cause; `getOperatorList()` was.
- **Worth measuring separately:** whether the tools that RENDER pages
  (`pdf-to-images`, and the thumbnails in `pdf-organise`/`pdf-edit`/`pdf-fill`/
  `pdf-sign`) substitute a wrong face for standard-14 PDFs today. That is the
  case the font copy would genuinely serve, and no defect has been measured
  there — so it stays unbuilt rather than shipped on a hunch.
- **Recorded flake:** one `calls.spec.ts` case failed once under full-suite load
  and passed on an immediate clean re-run. Not reproduced, not "fixed".

### Code sweep, 10 August 2026 (twenty-first pass)

- ~~**`zip.ts` cannot compress.**~~ **Done.** `CompressionStream('deflate-raw')`
  is the exact mirror of what `unzip.ts` already reads with, so it cost no
  dependency. Measured first (`evals/zipsize.mjs`): OOXML 97.9%, SVG 85.8%, CSV
  83.0%, and already-compressed payloads ~5% — so it is per entry, keeping
  whichever is smaller. A real 300-heading `.docx` download went 137,994 → 4,641
  bytes.
- **Found on the way:** the writer never set general-purpose bit 11, so an
  Arabic entry name was liable to be read as CP437 — mojibake, on a bilingual
  site, in tools that name entries after the user's own file.
- **Deliberately NOT migrated:** the image and PDF bundlers (`batch-watermark`,
  `carousel-split`, `pdf-split`, `pdf-to-images`, `social-resize`,
  `video-frames`) stay on `zipStore`. Measured at ~5%, so switching them is
  churn plus a wasted deflate pass over megabytes.
- **Still open:** a "create a ZIP" tool is now cheap and would complete the pair
  with `archive-inspector`, which reads and extracts and has no counterpart.
  `buildIcs` is still single-event, so `saudi-holidays` has no "add to calendar".

### Discoverability, 10 August 2026 (second pass) — the ties a category cannot answer

Re-measured after the category offer: 46 wide ties, 9 covered. The three widest
uncovered ones were a season, an audience and a verb, so they became curated
**collections** sharing the `/c/` route. Coverage 9 → 15 of 46, benches
unchanged, 236 → 242 prerendered pages.

Still uncovered, and now listed rather than suspected:

- **Families that could become collections** — `تصدير`/export (6-way), `مستند`
  (5-way), `مسح`/scan (4-way), `remove` (3-way), `audio` and `video` (3-way
  each), `meeting`/`اجتماع` (3-way). Each is a real family; none has been
  measured as worth a page yet, and shipping a dozen thin collections would
  dilute the ones that earned theirs.
- **Genuinely ambiguous words no grouping fixes** — `حر` (free / hot), `نسخ`
  (copy / version), `مشاركة` (share / participation), `تحليل` (analysis). The
  scorer cannot separate these and neither can a collection; recorded so nobody
  re-measures them expecting a fix.

### Web sweep, 10 August 2026 (twenty-second pass)

Two negative findings and one guard; no tool shipped, deliberately.

- **The sweep re-proposed an EXCLUDED tool and I built it.** A personal-finance
  calculator: high search volume, a genuine local insight (a quoted flat rate is
  close to half the APR SAMA defines), primary sources with article numbers.
  All true, and all irrelevant — loan/EMI/interest calculators are out of scope
  for Shariah reasons and one had already been withdrawn for it in July.
  Withdrawn again; `scripts/check-retired.mjs` added and verified to fail.
- **WebCodecs is NOT universally available, whatever the blogs say.** A 2026
  post claims it "ships in every major browser", which would make three of our
  documented limits stale — `video-trim`'s fragmented output, `video-frames`
  saying frame-exact needs `VideoDecoder` "which Safari does not have", and
  `audio-convert` shipping WAV because MP3 would need a real encoder. MDN says
  `VideoDecoder` is **"not Baseline — does not work in some of the most
  widely-used browsers."** Sources disagree, so nothing was changed. Re-check
  against MDN's compatibility table, not a blog, before revisiting any of them.
- **Worth keeping from the research anyway:** SAMA's Consumer Financing
  Regulations Article 11(3) independently corroborates the three-month cap that
  `early-settlement` already encodes, read from the primary source rather than a
  summary. Also confirmed there: Article 14(5) caps a consumer finance at five
  years, and Article 14(1) at 33.33% of gross salary (25% of a pension) — figures
  a future Murabaha/Ijara tool would need, recorded so the research is not lost
  with the tool that should not have used it.

### Code sweep, 10 August 2026 (twenty-third pass)

- ~~**`buildIcs` is single-event, so the dated tools cannot export.**~~ **Done.**
  It had one caller against six tools that compute a date worth a reminder.
  Moved to `src/lib/ics.ts`, gained `buildIcsCalendar`, and wired into
  `id-expiry`, `vehicle-renewal` and `saudi-holidays`.
- **Still open, in rough order of value:**
  - `medicine-schedule`, `due-date`, `ovulation` and `exit-reentry` also compute
    dates and could export now that the writer is general. Not done here because
    each needs its own judgement about what the reminder should SAY, and a
    calendar entry that says the wrong thing about medication is worse than none.
  - A "create a ZIP" tool, now that `zip.ts` compresses. It completes the pair
    with `archive-inspector`, which reads and extracts and has no counterpart,
    and there is an honest angle: a ZIP password is not encryption, and
    `file-encrypt` is the tool that actually is.
  - Six pdf-lib tools still bypass `PdfOps`.
  - Unreferenced exports remain: `disposeImageDecoder`, `cvApi.refineCv`,
    `dms.threadWith`/`countsByContact`, `contacts.hasContact`,
    `voiceNotes.delVoiceBlob`, `book-with-me/lib.enumerateDaySlots`.

### Discoverability, 10 August 2026 (third pass) — the catalogue's shape again

`evals/catalogshape.mjs` had not been run in a while and found Calculators at
27, 1.8x the median. Split into Health (7) and Time & Date (9); Calculators 11.
A security COLLECTION rather than a category, because each of its 15 tools is
already filed where people hunt for it.

- **Developer stays at 25 (2.1x the median), deliberately.** Encoding, data,
  security, scheduling, scaffolding and networking is six groups of one to
  eight; no single principle settles it, and six thin sections are worse than
  one thick one. Re-tested this pass and the answer has not changed.
- **Business is the smallest at 3** and is coherent; left alone.
- **Fixed on the way:** `evals/lib/tools.mjs` kept a hand-copied Arabic category
  map that fell back to the English label, so every Arabic measurement over a
  newly added category was wrong. It sweeps the labels out of the source now and
  throws rather than falling back.
- **Still open:** 30 of 46 wide ties have no group to offer. The remaining
  families (`تصدير`, `مستند`, `مسح`, `remove`, `audio`, `video`, `meeting`) are
  real but thin; four words (`حر`, `نسخ`, `مشاركة`, `تحليل`) are genuinely
  ambiguous and no grouping fixes them.

### Web sweep, 10 August 2026 (twenty-fourth pass)

Method changed: instead of reading "best free tools 2026" prose, a 661-tool
catalogue was fetched and **diffed against our inventory**. That is repeatable
and produces candidates rather than adjectives.

- ~~**Image ↔ Base64 / data URI.**~~ **Shipped** as `image-base64`.
- **Already covered, checked rather than assumed:** add page numbers to PDF and
  rotate PDF (`pdf-stamp`, `pdf-organise`), sort/dedupe lines (`list-tools`),
  XML and CSS formatting (`json-formatter`), tip calculator (`split-bill`).
- **Excluded by the standing rules:** loan, mortgage, annuity, compound
  interest, retirement, savings-goal and ROI calculators (riba); AI subtitle and
  translation tools, live weather/earthquake/wildfire maps and "private AI chat"
  (need a key or a scraped source).
- **Genuine remaining gaps, none built yet:** YAML ↔ JSON (needs a parser and
  YAML is deceptively hard — anchors, multi-line, implicit typing); SQL
  formatter; Markdown → HTML (we already have the parser, so it is cheap);
  CSS grid generator; text-to-speech and speech-to-text via the Web Speech API,
  where the honest question is which Arabic voices actually exist on a device;
  a document scanner; audio/video speed changer; GIF → frames.

### Code sweep, 10 August 2026 (twenty-fifth pass)

- ~~**`lib/markdown.ts` had no HTML renderer.**~~ **Shipped** as `markdown-html`
  on `lib/blocksToHtml.ts`. The parser could reach .docx and .epub and not the
  one format everybody wants, while `htmlToMd.ts` had gone the other way for
  months.
- **Measured and recorded rather than forced:** `html to markdown` reaches the
  new tool before its inverse, because the gap is name weight and the phrase is
  already indexed on both. Keywords moved it 0.0 points. Mitigated with a
  reciprocal link rather than by renaming a shipped tool.
- **Still open, unchanged:** a "create a ZIP" tool; `medicine-schedule`,
  `due-date`, `ovulation` and `exit-reentry` could export ICS now the writer is
  general, but each needs its own judgement about what the reminder should SAY;
  six pdf-lib tools bypass `PdfOps`; six unreferenced exports.
- **`blocksToHtml` also unlocks a Markdown preview inside `markdown-docx` and
  `markdown-epub`**, which currently show only an outline. Not done here —
  worth its own pass so the preview is judged on its own.

### Discoverability, 10 August 2026 (fourth pass) — a third held-out set

Written because the first two were spent. **73% top-1 / 86% top-3 on its first
reading**, over 51 conversational queries — the honest generalisation number for
natural-sentence search, and well below what the earlier, more tool-name-ish
sets first read. Fixing what it found took it to 86% / 96% with every other
bench unchanged.

- **Set #3 is now burned.** Write `untuned4.mjs` before believing any future
  number.
- **Recorded, not fixed** (fixing these is what burns a set, and each is a
  genuine ambiguity rather than a defect): `turn a pdf into a document i can
  edit` → `pdf-edit` first, which is a fair reading; «حوّل ماركداون إلى صفحة»
  ties three markdown converters; `stick two spreadsheets together` is idiomatic
  English no vocabulary list would carry; «جدول مواقيت الصلاة للطباعة» and
  `how many days off` put the primary tool first and the right one second;
  «كم باقي على موعد» is genuinely ambiguous («موعد» = appointment or due date);
  «تشكيل النص» is a direction ambiguity the order-blind scorer cannot see, the
  same shape as `html to markdown`.
- **Related tools re-measured at 223 tools:** 0 dead ends, 222 full rows of
  four. No drift since the fill shipped.

### Web sweep, 10 August 2026 (twenty-sixth pass)

Second catalogue diffed (a ~1000-tool directory), same method as last pass.

- ~~**Print size / DPI.**~~ **Shipped** as `print-size`. The gap was not the
  arithmetic but the framing: every incumbent hard-codes 300 DPI and makes you
  type the pixel dimensions. This derives the 300 from one arcminute of acuity
  at arm's length and therefore also derives 44 PPI at two metres.
- **Excluded by the standing rules, and there were a lot:** the entire Finance
  and Real Estate sections (amortization, compound and simple interest,
  mortgage, IRR, NPV, ROI, rent-vs-buy, cap rate — riba); every AI tool and the
  network section (whois, DNS, ping, port checks) which need a server; Games,
  Mystic and Nostalgia as off-brand; the YouTube thumbnail downloader and the
  website speed test, both already named in the exclusions.
- **Genuine gaps still unbuilt, in rough order of appeal:** chmod calculator;
  HTML entity encoder; IEEE-754 / two's-complement viewer; statistics
  (mean/median/SD); number-to-words in English, which would pair with `tafqeet`;
  Punycode/IDN — interesting here because Arabic domain names are real;
  clothing and shoe size converters; recipe scaler and oven-temperature
  converter; a citation formatter; PDF page resize.

### Code sweep, 10 August 2026 (twenty-seventh pass)

Swept for exports with no callers and for lib modules with exactly one caller —
the shape that found `lib/ics.ts` and `lib/markdown.ts` before.

- ~~**Nothing creates a ZIP.**~~ **Shipped** as `zip-create`, the other half of
  `archive-inspector`, on the compression that landed two passes ago.
- ~~**`buildEmail` has no caller.**~~ **Wired.** A QR could open a blank email
  and not a filled-in one; the fields and their translations already existed.
- **Still unreferenced, and now listed for the fourth time:**
  `disposeImageDecoder`, `cvApi.refineCv`, `dms.threadWith`/`countsByContact`,
  `contacts.hasContact`, `voiceNotes.delVoiceBlob`,
  `book-with-me/lib.enumerateDaySlots`, `prayer-timetable.hijriMonthOf`,
  `pdf-to-text.joinPages`, `qr-code.buildEmail`'s neighbours are now gone.
  Most are call-feature leftovers; a pass that either wires or deletes them is
  overdue.
- **Still open:** `blocksToHtml` would give `markdown-docx` and `markdown-epub`
  a live preview instead of an outline; four dated tools could export ICS; six
  pdf-lib tools bypass `PdfOps`.

### Discoverability, 10 August 2026 (fifth pass) — converters and their directions

`evals/directions.mjs` is the new instrument, built because the same defect had
been found four times one query at a time. **24/24 own direction, 12/12
opposite** after the one fix it found.

- **The pairing has to be DECLARED.** Pairing by name reported a clean 6/6 while
  missing the only broken pair, because "Paste Markdown" does not say what it
  converts from. `Tool.inverse` closes that; `scripts/check-inverses.mjs` keeps
  it reciprocal.
- **`Paste Markdown` is now `HTML to Markdown`** — the rename declined last pass,
  taken once it was measured rather than probed.
- **Still open:** «تشكيل النص» remains a 3.7-point loss to `arabic-normalize`,
  whose «إزالة التشكيل» keyword contains «التشكيل». Both tools genuinely concern
  tashkeel in opposite directions and the scorer cannot see direction; recorded
  in `twinprobe`'s default cases so it stays visible.
- **`evals/twinprobe.mjs` rewritten** on the shared loader — it had carried a
  full second copy, stale for the two newest categories.

### Web sweep, 10 August 2026 (twenty-eighth pass)

New axis: instead of diffing a tool catalogue, sweep what CHANGED in Saudi rules
for individuals in 2026. That produces rules rather than utilities, which is the
half of this site the catalogue diffs cannot reach.

- ~~**Sponsorship transfer.**~~ **Shipped** as `sponsorship-transfer`.
- **Also surfaced, not built:** the five-year physical iqama (a card change, no
  arithmetic); skill-based work-permit classes (the employer's concern, and the
  bands are not published in a form to encode); the emergency visa extension
  window that closed in April 2026 (dated, so a tool would be stale on arrival);
  24-hour trading licences at up to SAR 100,000 a year (a business licence, not
  an individual's calculation).
- **Worth re-checking later:** amended labour fines were announced but the
  schedule is not published in a form that could be encoded without guessing,
  and a fines table that goes stale is worse than none.

### Code sweep, 10 August 2026 (twenty-ninth pass)

The "wire or delete the unreferenced exports" pass, recorded as overdue on four
previous sweeps. Eighteen of them; sorting rather than bulk-deleting was the
point.

- **Two were bugs**: `hashPrefix` existed to close a vacuous assertion nobody
  wrote, and `disposeImageDecoder` meant the HEIC wasm worker outlived every
  tool that used it.
- **One was a duplicate**: `pdf-to-text` reimplemented `joinPages` verbatim.
- **Fifteen were dead weight**, and deleting them exposed two more dead helpers
  that the exports had been keeping alive.
- **`refineCv`'s knowledge is kept as a comment**: the `cv-refine` endpoint is
  deployed with kinds polish/elaborate/shorten and has never had a UI. If that
  feature is designed, the client is ten lines.
- **Still open:** `blocksToHtml` would give `markdown-docx` and `markdown-epub`
  a live preview; four dated tools could export ICS; six pdf-lib tools bypass
  `PdfOps`.

### Discoverability, 10 August 2026 (sixth pass) — the shape of the query

`evals/inputshapes.mjs` re-asks the 215 queries the benches already get right,
in the shapes people actually type. Nine shapes; five of them were badly broken
and none had ever been measured.

- **Worst first:** a pasted URL never worked (0%, all 215 returned nothing);
  quotes — including the guillemets Arabic normally uses — left 168 of 215
  returning nothing; a trailing question mark halved accuracy.
- **All nine now read 100%**, with every other instrument unchanged, because the
  normaliser touches the query and never the index.
- **Still open:** the category offer takes the raw query rather than the
  normalised one. Its own normaliser strips punctuation so quotes are handled,
  but a pasted category URL will not match. Small, and worth doing when
  `CategoryOffer` is next touched.

### Web sweep, 10 August 2026 (thirtieth pass)

Untried vertical: what people calculate when buying online from abroad.

- ~~**Customs duty and import VAT.**~~ **Shipped** as `import-duty`. The
  category exists elsewhere; the misconceptions are the tool — "duty-free" being
  read as "tax-free", postage counting toward the threshold, and the two rates
  not adding to 20%.
- **Deliberately not built into it:** an HS-code tariff table. Thousands of
  lines, revised in late 2025, and wrong-for-one-line is worse than a pointer to
  ZATCA's Integrated Tariff.
- **Worth a later look, same vertical:** a shipping-forwarder comparison would
  need live rates (an API we will not run); a duty-drawback/return-refund
  explainer needs a rule that could not be corroborated in this pass.

## Code sweep, 10 August 2026 — coverage shape

`node evals/coverageshape.mjs` ranks live tools by lines of tool code per
assertion-bearing e2e case. `prayer-times` was the thin end (929 lines, 1 case)
and now has a real spec; it found no product bug, which is an honest result.

**Next thinnest, in order** — each is a candidate for the same treatment, and
the `file-metadata` precedent says one of them is probably hiding something:

- `hajj-umrah` — 567 lines, 1 case
- `pdf-sign` — 511 lines, 1 case
- `adhkar` — 485 lines, 1 case
- `pdf-fill` — 455 lines, 1 case
- `ats-cv-optimizer` — 2202 lines, 5 cases

Two things the instrument surfaced in passing, neither yet acted on:

- **Four specs still drive the legacy `/tools/<id>` path**, which 301-redirects
  on every navigation (`app.spec.ts`, `pdf-compress`, `pdf-edit`, `pdf-sign`).
  Harmless, but it is a redirect paid on every run.
- **`prow-<key>` is not unique when the timeline is expanded.** The circular
  window renders ten rows with "show more", which spans two days and repeats
  every prayer key — so a strict-mode locator would match twice. Nothing user
  facing; it does mean an expanded timeline cannot be asserted per row as it
  stands.

## Held-out set #4 (10 August 2026) — the symptom, not the tool

`evals/untuned4.mjs`. First reading **62% top-1 / 66% top-3**, the widest gap
any held-out set has reported (sets #1–#3 read 88 / 90 / 73%), because all three
of those describe the TOOL and this one describes the PROBLEM.

Fixed: the seven tools that scored BELOW the relevance floor for their own
defining symptom, plus «بي دي اف» across all fifteen PDF tools. **74% / 80%**
after. **The set is now SPENT — quote 62%.**

**The twelve NEAR misses were deliberately left**, so the set retains some
signal. They are ordering debates rather than unfindable capabilities, and each
is a candidate if a future pass wants them:

| query | wanted | rank |
|---|---|---|
| my pdf is too big to email | `pdf-compress` | 6 (behind `pdf-to-word`) |
| the photo is too heavy to upload | `image-compressor` | 6 (behind `print-size`) |
| my phone photos are heic and will not open | `image-format-converter` | 6 |
| what type of file is this | `file-metadata` | 2 (behind `file-encrypt`) |
| what changed between these two versions | `text-diff` | behind `sheet-diff` |
| the api gave me a token i cannot read | `jwt-decoder` | 4 |
| my colours do not pass accessibility | `color-contrast` | behind `a11y-check` |
| which days am i most likely to conceive | `ovulation` | 2 |
| what time should i go to bed | `sleep-cycle` | 9 |

**Write set #5 on a fresh axis before believing any future search number.**
Axes used so far: tool-name-ish (#1), paraphrase (#2), natural sentence (#3),
symptom (#4). Untried: the query that names a competitor's product, and the
query typed by somebody who has the wrong mental model of the format.

## Web sweep, 10 August 2026

Axes tried: "is there a tool that…" phrasing, the most-searched calculator
categories of 2026, and what people upload private documents to do.

**Shipped: `token-counter` (AI Token Counter).** The AI-token-cost category is
live and growing and we had nothing in it. Every incumbent ESTIMATES with
"characters ÷ 4", which is an English rule: measured, it overstates English
prose by 45% and understates source code by 31%, and Arabic ran at 1.41
chars/token on cl100k against English's 5.67 — roughly four times the cost for
the same meaning. o200k took Arabic to 3.80, a 2.7x improvement.

**Confirmed already covered**, so not built: Words-to-Minutes (`speech-time`),
GPA conversion (`gpa-calculator`), road-trip fuel cost (`fuel-cost`).

**Seen and NOT taken, with reasons:**

- **Intermittent-fasting window planner.** Plausible and client-side, but it is
  a health regimen rather than a calculation, and `medicine-schedule` already
  owns "spread doses across a fasting window" for the case that matters here.
  Revisit only with a real wedge.
- **Organic CTR calculator.** SEO filler; the "irrelevant noise" exclusion.
- **A general file converter in the Vert mould** (image/audio/video/document in
  one box). We already ship the individual converters; the missing piece is
  video transcoding, which needs ffmpeg-wasm at ~30MB. That is a separate
  decision about weight, not a tool idea — parked.
- **Secure document sharing / data rooms.** Needs a backend and an account;
  `docs/BACKEND.md` territory.

**Recorded ambiguity:** a bare `token` leads with `token-counter` and puts
`jwt-decoder` second. Both readings are real ("how many tokens is my prompt" and
"decode this JWT"), the qualified queries each go to the right tool, and no
bench moved — so it is left alone rather than tuned.

## Code sweep, 10 August 2026 (second)

**Fixed: the category offer did not recognise a pasted category URL.**
`normaliseQuery` had been wired into `searchTools` and not into
`CategoryOffer`, so results and offer could disagree about one query.
`evals/offershapes.mjs` measured it and mostly refuted the worry — `matchGroup`
folds case and punctuation itself, so seven of eight shapes fired either way at
23/23. The pasted URL was 0/23, and it is the link the category pages exist to
be shared at. Now 23/23 with precision unchanged.

**A dead-export sweep was attempted and its output must NOT be acted on.** It
reported 114 unreferenced exports; both spot-checks were false positives
(`removeCall`/`clearHistory` are called by the hook in their own file;
`fuzzyScore` by a bench through the compiled copy). Cross-file string matching
measures **over-exported**, not **dead**. To be worth anything it needs a real
reference analysis — the TypeScript language service, or at minimum a check of
whether the identifier is used anywhere other than its own definition and
export. Until then the 114 is noise.

**Still open from earlier sweeps, unchanged:**

- **Six pdf-lib tools run on the main thread** (`pdf-compress`, `pdf-fill`,
  `pdf-sign`, `pdf-stamp`, `pdf-booklet`, `pdf-redact`) while only
  `pdf-merge`/`pdf-organise`/`pdf-split` use the `PdfOps` worker (#154).
- **`blocksToHtml` could give `markdown-docx`/`markdown-epub` a live preview**
  rather than an outline — the renderer exists and neither tool calls it.
- **Four dated tools could export ICS** (`medicine-schedule`, `due-date`,
  `ovulation`, `exit-reentry`); each needs its own judgement about what the
  reminder should actually say.
- **Thin e2e coverage**, next in order: `hajj-umrah` (567 lines, 1 case),
  `pdf-sign` (511), `adhkar` (485), `pdf-fill` (455).

## Held-out set #5 (10 August 2026) — the format, by its extension

`evals/untuned5.mjs`. First reading **54% top-1 / 68% top-3 with 8 queries
returning nothing** — the worst of any held-out set. One mechanism: a leading
dot makes the query longer than the indexed word, so `.epub`, `.vcf` and
`.pptx` found nothing on a site that reads all three. **80% / 92% after, 1
not-found.** The set is now SPENT — quote 54%.

**Catalogue shape re-measured at 228 tools** and no action taken: 16 sections,
median 13, largest `Developer` at 26 (2.0x). The documented judgement stands —
encoding, data, security, scheduling, scaffolding and networking is six groups
of one to eight and no single principle settles it.

### The strongest unbuilt idea in search: use `Tool.inverse` in the scorer

Three of set #5's ten near misses are one thing — the converter that goes the
WRONG WAY wins, by 1–4%:

| query | wins | should be |
|---|---|---|
| `jpg to pdf` | `pdf-to-images` 360.9 | `images-to-pdf` 356.3 |
| `xlsx to csv` | `csv-to-xlsx` 371.3 | `xlsx-convert` 361.5 |
| `jpg to png` | `images-to-pdf` 288.8 | `image-format-converter` 277.2 |

Word order is discarded on purpose, so a converter and its inverse are the same
query to the scorer and the margin between them is noise. **`Tool.inverse` is
already declared on twelve pairs and the scorer never reads it** — it feeds only
`evals/directions.mjs`. Breaking a near-tie between two declared inverses in
favour of the one whose name matches the direction is the principled fix.

Two cautions for whoever builds it: it must be a TIE-BREAK, not a re-ranking, or
it can regress a bench; and `image-format-converter` declares no inverse at all,
so the third row above needs a declaration before it can be helped.

### Remaining near misses, left as retained signal

`svg to png` (rank 7), `.exe what is inside` (16), `فتح ملف xlsx` (4),
`.wav` (2, behind `zatca-wave`). And `avif` correctly finds nothing — the site
does not handle it.

## Web sweep, 10 August 2026 (second)

Axis: what the PLATFORM can now do that nobody has built a tool around — chosen
because this site prefers platform APIs to libraries, and because no earlier
sweep used it.

**Parked with a trigger: Writer, Rewriter and Proofreader.** Chrome's on-device
AI family has grown past Translator / Language Detector / Summarizer, and a
proofreader that never uploads your text is squarely this site's pitch —
`builtinAi.ts` and `ModelGate` would carry it with no new infrastructure. But
**Writer and Rewriter are in ORIGIN TRIAL and Proofreader is early-preview
only**, so for essentially every visitor the constructor does not exist. We
already record that "the constructors existing proves nothing" and that a tool
must decide from what `availability()` answers — a tool that answers "this
browser cannot run it" for ~100% of visitors is not a tool.
**Trigger: build when Writer/Rewriter reach stable, as Summarizer did in 138.**

**The biggest remaining hole in the converter catalogue: Word → PDF.** We ship
`pdf-to-word`, recorded here as the most-requested PDF task on the web, and not
its equally-requested inverse. Everything needed exists — `mammoth` for
docx→HTML, `lib/markdown.ts`'s `Block[]` shape, react-pdf already a dependency.

**The blocker was how to draw the page, and it is now measured**
(`node evals/rtlpdf.mjs`): react-pdf carries a **real Arabic text layer**, so
the converter should be built on it rather than on `printPdf.ts`'s canvas
route, which would emit a document with no selectable text. What is still
unverified is the VISUAL shaping — the eval says so rather than concluding it.

Before building, decide two things: **which Arabic font to bundle** (the site's
IBM Plex Sans Arabic is a web font; react-pdf needs a TTF, and `public/fonts/`
carries Latin subsets only), and **how much of a .docx to honour** — the
`pdf-to-word` precedent is to state the limits in the UI rather than imply a
faithful reproduction.

**Nothing shipped this iteration**, deliberately: a half-built document
converter is worse than none, and the feasibility answer is what the next build
needs.

## Word → PDF: built, measured, WITHDRAWN before shipping (10 August 2026)

The previous sweep recorded this as the largest hole in the converter catalogue
and reported react-pdf as able to carry an Arabic text layer. **That reading was
wrong** — the test sentence contained no lam-alef — and the tool built on it has
been withdrawn rather than shipped. See CLAUDE.md for the measurements.

What was built and removed: `src/tools/docx-pdf/` (mammoth → `htmlToMd` →
`parseMarkdown` → a react-pdf document), a 43KB-per-weight IBM Plex Sans Arabic
subset in `public/fonts/`, an 8-case spec that read every assertion back out of
the produced PDF with pdf.js, and a privacy-guard entry. **Six of seven content
cases passed; the Arabic one failed and that was the whole point of the tool.**

**Do not rebuild this without first making `node evals/rtlpdf.mjs` report
usable.** It is the gate, it needs no API key, and it now fails for the right
reason.

Three things worth keeping from the attempt:

- **The pipeline itself is correct and cost nothing new.** docx → `Block[]` is
  two existing tools composed, and every document writer here already speaks
  `Block[]`. Whoever solves the text layer inherits a working converter.
- **English alone is not enough to ship on.** It was tempting — the English
  path is clean — but a converter that silently scrambles Arabic is wrong
  output on a bilingual site, not a stated limit.
- **`pdf-to-word` still has no declared `inverse`**, because its counterpart
  does not exist. `check-inverses.mjs` refuses a one-sided declaration, so both
  sides land together when it does.

## Direction tie-break shipped (10 August 2026)

`lib/searchDirection.ts`. The item recorded as "the strongest unbuilt idea in
search" is built: `Tool.inverse` was declared on twelve pairs and read only by
the harness, so a converter and its inverse were decided by a 1–3% margin that
means nothing.

Fires on **2 of 387** benched queries and **0 of 456** tool names. Set #5
80% → 84%; every other bench unchanged. Verified to fail.

**Still open on the same theme:** `image-format-converter` declares no inverse,
because it has none — it converts among image formats rather than in one
direction. So `jpg to png` (rank 2, behind `images-to-pdf`) cannot be helped by
this mechanism and needs a different one, if it needs one at all.

**Held-out sets #1, #3, #4 and #5 are all spent.** #2 remains usable as a
regression check at 46/50. Axes used: tool-name-ish, paraphrase, natural
sentence, symptom, file extension. **Write set #6 on a fresh axis before
believing any future search number** — untried: the query that names a
competitor's product, and the query typed by somebody with the wrong mental
model of the format ("convert word to excel").

## Web sweep, 10 August 2026 (third)

Axes tried: what people pay a subscription for that could run offline (thin —
one nugget, a meeting-cost calculator, not built), and what CHANGED in Saudi
rules for individuals, which is the axis that produced `sponsorship-transfer`
and `import-duty` and produced again here.

**Shipped: `traffic-fine`.** Article 75's 25% reduction is a chain of windows
rather than a deadline — 30 days to object then 15 to pay, in series, and a
90-day Absher extension that carries the discount only 30 days further. Both
misreadings cost real money and neither is stated plainly anywhere we found.

**Seen and not taken:** a meeting-cost calculator (thin, and closer to the
"irrelevant noise" exclusion than to anything this site does well); traffic
fine LOOKUP, which needs Absher and is `docs/BACKEND.md` territory; and the
black-points system, which is a real rule but whose thresholds we could not
corroborate to the standard `iqama-fees` sets — worth revisiting if a
citable source turns up.

## Code sweep, 11 August 2026 — undriven UI

New instrument: `node evals/untested-ui.mjs`, the inverse of `coverageshape`.
A `data-testid` exists to be driven, so one no spec references is UI nobody
exercises. **988 of 2877 (34%) are undriven.**

Covered this pass: `pdf-to-word`'s scanned-PDF branch. No product bug — but
proving the spec could fail exposed that `looksScanned` was computed in TWO
extractors with nothing tying them together; both now call `lib/pdfScan.ts`.

**The queue, largest undriven surface first.** Each is a candidate, and the
useful filter is "is this a behavioural branch or a styling option?":

| tool | testids | undriven |
|---|---|---|
| `calls` | 168 | 77 |
| `book-me` | 32 | 28 |
| `prayer-times` | 29 | 22 |
| `svg-editor` | 31 | 16 |
| `ats-cv-optimizer` | 36 | 15 |
| `markdown-html` | 22 | 12 |
| `video-gif` | 15 | 12 |

`book-me` is the standout by proportion: its spec drives the OAuth round-trip
and almost nothing else, so the availability grid, meeting types and the
reconnect path are all unexercised — and it has a real backend behind it.

**Still open from earlier sweeps:** six pdf-lib tools on the main thread;
`blocksToHtml` unused by the two Markdown writers; four dated tools that could
export ICS; the dead-export sweep needing a real reference analysis.

## Held-out set #6 (11 August 2026) — Arabic morphology

`evals/untuned6.mjs`, 44 queries. First reading **64% top-1**, the lowest of any
set; **77% / 91% after**, with its one unanswerable query gone. Two query-side
fixes: `stripArabicPrefixes` (vocabulary-guarded) and `foldArabic`.

New instrument: `node evals/undiacritic.mjs` — every tool must win its own
Arabic name typed WITHOUT the marks, and win **on** the name rather than in
spite of it. **24/79 → 78/79.** Derived from the registry, so it cannot go
stale.

**Set #6 is SPENT — quote 64%.** Remaining misses, left as retained signal, are
all metadata rather than mechanism: the summarizer does not index the imperative
«اختصر» (rank 14), `pdf-split` does not index «اقسم» (8), `pdf-sign` is beaten
on «موقّع pdf» (6) and «وقّع المستند» (5) by the PDF family, and «شهادة تقدير»
loses to the electricity bill on «شهادة».

**Every held-out set is now spent except #2** (46/50, still usable as a
regression check). Axes used: tool-name-ish, paraphrase, natural sentence,
symptom, file extension, Arabic morphology. Untried: the query naming a
competitor's product, and the query typed with the wrong mental model of the
format.

## Web sweep, 11 August 2026 — assistive reading

Axis: assistive/accessibility, untried before. The market is mostly browser
EXTENSIONS, which is not our model — but one thread was checkable and the repo
had already half-discovered it.

**Shipped: `readable-text`.** Every reading guide says to increase letter
spacing; that is Latin advice, and Arabic is cursive so it breaks the word. The
codebase already carried `rtl:tracking-normal` in 16 places without the rule
being written anywhere.

**Seen and not taken:** OpenDyslexic-style font substitution (needs a font we do
not have a licence to bundle, and there is no Arabic equivalent); text
simplification (needs an LLM — the on-device Rewriter is still origin-trial, see
the parked entry); screen masks and page-wide reading modes (extension
territory, not a page tool); text-to-speech, which is one `speechSynthesis` call
and worth revisiting only with an honest voice-availability gate like
`ModelGate`.

## Code sweep, 11 August 2026 — the dated tools that could not remind you

`lib/ics.ts` now has SEVEN callers. `ovulation` exports the fertile window as a
range (the DTEND-exclusive case) with optional discreet wording; `due-date`
exports the 37–42 week window as well as the date, window first, because a lone
dated entry is what makes a due date read as an appointment.

Closed from the backlog. Deliberately not wired, with reasons:
`medicine-schedule` needs TIMED events and `buildIcsCalendar` is all-day by
design; `exit-reentry`'s useful reminder is the iqama expiry, already exported
by `id-expiry`.

**Still open:** six pdf-lib tools on the main thread; `blocksToHtml` unused by
the two Markdown writers; the dead-export sweep needing a real reference
analysis; and the undriven-UI queue (`book-me` 28 of 32 is the standout).

## Held-out set #7 (11 August 2026) — the query that IS a number

`evals/untuned7.mjs`, 42 queries. First reading **79% top-1 with SIX returning
nothing** — `1080x1080`, `20% of 250`, `utc+3`, `2mb`. **90% / 1 not-found
after**, via `lib/numericIntent.ts`, which runs only on an empty result.

**Set #7 is SPENT — quote 79%.** Remaining misses, all metadata rather than
mechanism: `make it under 2mb` still misses `image-compressor` (which indexes
no byte units, and the query matched enough junk that the shape fallback never
fired); `base 16` goes to `base64`; `resize to 800px wide` and «مقاس 1080» rank
2 behind `social-resize` and `print-size`.

**Every held-out set is now spent except #2** (46/50). Axes used: tool-name-ish,
paraphrase, natural sentence, symptom, file extension, Arabic morphology,
numeric. Untried: the competitor product name (mostly a NOMATCH measurement,
since this site deliberately refuses to stuff a brand into a tool), and the
compound task ("merge these and add page numbers").

## Web sweep, 11 August 2026 — what a BUSINESS must work out

Every earlier Saudi sweep mined what an individual must do. **Shipped
`cr-renewal`**: the commercial register has a window on each side of expiry and
the 90 days after is not an extension — fines run from expiry and the commercial
identity can be cancelled past it.

**Seen and not taken:** the renewal FEE (published as SAR 200/100 and quoted in
practice from 200 to 5,000, because the Chamber subscription is banded and the
municipal licence is per square metre by zone — the `iqama-fees` refusal);
Nitaqat/Saudization bands, whose thresholds vary by sector and size and could
not be corroborated to this repo's standard; and municipal (Balady) licence
fees, for the same reason.

**Follow-up worth doing:** `id-expiry` tracks seven document kinds and **every
one is personal**. A business owner's commercial registration, municipal licence
and Chamber subscription are absent from the one tool built for "what runs out
next". Adding them is small; the lead times are the substance.

## Code sweep, 11 August 2026 — the hub with no links

`id-expiry` tracked seven document kinds, all personal, and linked to NOTHING.
Added the business documents (commercial register and municipal licence at a
90-day lead, Chamber subscription at 30) and a per-kind link to the tool that
owns the rule — only where one exists, with a case asserting a passport gets no
invented link.

**Still open:** six pdf-lib tools on the main thread; `blocksToHtml` unused by
the two Markdown writers; the dead-export sweep needing a real reference
analysis; and the undriven-UI queue, where `book-me` (28 of 32 testids never
driven, with a real backend behind it) remains the standout.

## Discoverability, 11 August 2026 — the incoming question

New instrument: `node evals/inbound.mjs`. `relatedcheck` measured OUTGOING dead
ends; nothing measured which tools are pointed AT. **31 of 231 (13%) had no
inbound edge at all**, including the whole on-device AI trio and most of the
recent Saudi tools. **Now 0**, via 22 new clusters for families the lexical
scorer cannot see. Median inbound is 3.

**Worth keeping in mind:** a cluster is symmetric, so adding one to serve tool A
rewrites tool B's row too. That regression was caught by an existing spec and
now has its own case.

## Web sweep, 11 August 2026 — comparing two PDFs

Axis: life events. Moving-cost calculators were rejected (they depend on quotes
and market rates nobody can stand behind — the `iqama-fees` refusal), and
probation turned out to be covered already by `leave-overtime`. What the sweep
did surface is that we shipped FIVE diff tools — date, image, json, sheet,
text — and not the one the market wants most and every incumbent uploads.

**Shipped `pdf-diff`.** Text-aligned rather than pixel-compared, two-level LCS,
page attribution, scan detection routed to OCR.

**Candidate build guard:** `evals/inbound.mjs` should probably become a
`scripts/check-*.mjs` so a new tool cannot silently orphan another one — adding
`pdf-diff` orphaned `json-to-types`. It needs the compiled `relatedPick`, which
the plain-node guards do not currently do, so it is recorded rather than built.

## Code sweep, 11 August 2026 — the orphan check became a gate

`scripts/check-orphans.mjs` is in `prebuild` and verified to fail. The measured
property regressed twice in one session, which is the test for whether something
should be enforced rather than remembered.

Its first version wrote its own tool sweep and reported 13 orphans where the
eval reported 0 — the shared-loader lesson, now applying to `scripts/` too.

**Still open:** six pdf-lib tools on the main thread; `blocksToHtml` unused by
the two Markdown writers; the dead-export sweep needing real reference analysis;
`book-me` (28 of 32 testids never driven, with a real backend behind it).

## Discoverability, 11 August 2026 — the first screen

The Recommended row represented **4 of 17 categories and none of the six
largest**. Rebalanced to **8 of 17**, with five of the six largest showing one
tool each. Developer stays out deliberately — it is the family best served by
search, and the showcase is for the visitor who does not yet know what to ask
for.

The relevance floor was re-measured at 232 tools (it was tuned at 202) and did
NOT need changing: raising the absolute floor from 50 to 80 halves the junk rows
and costs 37 real ones. A clean negative result, recorded so nobody re-derives
it.

**Still untried as a held-out axis:** the competitor product name (mostly a
NOMATCH measurement, since this site refuses to stuff brands into tools) and the
compound task ("merge these and add page numbers").

## Web sweep, 11 August 2026 — what people download APPS for

A different source from every earlier sweep, which looked at websites. It points
at device capabilities this site barely uses.

**Shipped `doc-scan`.** Projective straightening with hand-placed,
keyboard-nudgeable corners, plus the clean-up that is the actual size win.

**Seen and not taken:** automatic edge detection (it fails silently, which is
the one thing the tool refuses); a spirit level and protractor via
DeviceOrientation (real app-store categories, but closer to the "irrelevant
noise" exclusion than to anything this site does); multi-page capture, which
`images-to-pdf` already covers and the tool links to.

## WITHDRAWN: a rendered preview for `markdown-docx` / `markdown-epub`

Recorded as "still open" in five places across this file, and it is **not open —
it contradicts a decision already made and commented in the code**:

> The outline is the honest preview: it shows what the writer UNDERSTOOD, which
> is the thing that can be wrong — a rendered imitation of Word would look right
> and prove nothing.

That is the same failure `check-retired.mjs` exists for: a decision that lives
only in a code comment is a decision the backlog re-proposes. A `blocksToHtml`
preview would render the Markdown as HTML, which is a preview of the HTML
CONVERTER, not of the Word writer — the two agree in every case except the ones
that matter, because what can go wrong in `writeDocx` is a heading that is not a
real heading or a list that is not a real list, and both look correct rendered.

**If a richer preview is ever wanted, the honest version is to show the OOXML
the writer produced**, not a rendering of something else.

Ignore the four earlier "still open" lines above; this entry supersedes them.

## Discoverability, 11 August 2026 — the cost of a keystroke

Never measured before: one search over 233 tools was **11.4ms** against a 16.7ms
frame, so a mid-range phone dropped frames while typing. Keywords were 53% of
it, and the cost was per-call overhead rather than the algorithm.

**11.42ms → 4.68ms** by remembering the folded fields and folding the query once
per tool. All eight benches byte-identical.

**Still open if it ever needs to go further:** the remaining time is spread
evenly across ~3,350 scoring calls per search, so the next real win is fewer
CALLS — an inverted index over the keywords — which is a much larger change with
real regression risk, and 4.7ms does not justify it yet.

## Web sweep, 11 August 2026 — the self-employed

Axis: the vertical between employees and companies. **Shipped `retirement-age`**
— the 2024 Social Insurance Law means the retirement age is no longer 60 for
anybody, and almost every source still says 60.

**Seen and not taken:** the freelance document (وثيقة العمل الحر) — free to
issue and procedural, so there is nothing to calculate; and freelancer GOSI,
whose contribution rate is described everywhere as "higher, because they bear
both shares" with no figure anybody publishes — the `iqama-fees` refusal.

**Recorded for whoever revisits it:** if GOSI's ladder (age on 3 July 2024 →
standard retirement age) ever becomes citable, `retire.ts` is written to take it
— `standardAge` is already nullable for exactly that reason.

## Code sweep, 11 August 2026 — pdf-lib off the main thread, one tool of six

Measured at last: 100 pages cost 249ms of blocked main thread on a desktop, so
0.75–1.5s on a phone. `pdf-booklet` moved into a worker; it was chosen because
`impose.ts` is pure pdf-lib.

**The remaining five need `OffscreenCanvas` first.** `pdf-stamp` (watermark),
`pdf-sign` (signature image), `pdf-redact` (rasterises), `pdf-compress`
(re-encodes images) and `pdf-fill` all draw through a canvas, and
`lib/textImage.ts` is shared with `label-sheet`, `certificate` and others — so
converting it is a change with its own blast radius. That is the next step, and
it is now a measured one rather than a convention appeal.

The move found a real pre-existing bug: a completely blank page could not be
imposed and was reported as "could not be read as a PDF". Fixed and pinned.

## Discoverability, 11 August 2026 — the 404 had no typo correction

Re-measured `slugprobe` at 234 tools (tuned at 211): unchanged at 92% / 95% — a
second tuned surface holding its number, recorded as a negative.

But it exposed that `NotFoundPage` called `rankTools` while home and the
launcher call `rankToolsWithCorrection`, so the one surface reached BY a wrong
URL had no typo correction. **92% -> 95% top-1, 95% -> 97% top-3.**

A probe row was wrong too: `calcualtor` expected silence while sitting under
"Typos" beside `pdf-mrege`, which expects resolution. It now lists the set of
calculators, since which one wins is arbitrary and the page shows three.

**Remaining slug misses, both documented and unchanged:** `pdf-splitter` (the
`-er` suffix) and `iqama` (genuinely ambiguous between `iqama-fees` and
`id-expiry`, and the right one is in the top three).

## Web sweep, 11 August 2026 — the week the school year starts

Seasonal axis. **Shipped `timetable`**: Sunday-first, and in Arabic the columns
reverse rather than only the labels — including in the printed PDF, since a
canvas has no reading direction to inherit.

**Also fixed in passing:** «جدول مواعيد الصلاة» was going to `vehicle-renewal`,
whose «موعد» keyword outranked `prayer-timetable`'s «مواقيت» — the
singular/plural trap again. The prayer sheet now indexes the phrase people type.

**Seen and not taken:** static template galleries (the incumbents), and a
school-supplies budget calculator (thin, and closer to the noise exclusion).

## Code sweep, 11 August 2026 — the orphan cause, not the symptom

Two of the three tools shipped after `check-orphans` went in orphaned an
existing tool, each patched by hand. The cause was the category filler running
in catalogue order, so every tool filled from the top of its category: **17 of
235 with no inbound edge from the related rows alone, and 79 pairs showing an
identical row.** Rotating the start by the tool's own position gives **0 and 0**,
with the most-linked tool dropping from 21 inbound to 11.

`evals/inbound.mjs` now reports the identical-pair count as well, because an
e2e for this was written twice and could not fail either time — the property is
a shape of the whole graph, not of a page.

**The hand-written clusters added earlier are kept**: they encode real families
the scorer cannot see (the on-device AI trio, the Saudi rule tools), and are now
belt-and-braces rather than load-bearing.

## Discoverability, 11 August 2026 — the business owner's family query

Re-measured the catalogue at 235: `Saudi / Local` is back to 25 (it was split at
31 once) and `Developer` holds at 26, 2.0x the median. **Neither was split.**

Developer's documented judgement stands. Saudi / Local looked like the obvious
candidate — send the tax and registration tools to `Business`, the smallest
section — but that contradicts the rule the earlier split turned on: those tools
ARE Saudi administrative matters. What cuts across is the AUDIENCE, so it is a
collection: **`new-business`**, measured from «بدء مشروع» returning nothing at
all.

**Still open:** `Developer` at 26 and the four-subject shape of `Saudi / Local`
are both recorded rather than forced, for the same reason as before — no single
principle settles either without doing damage elsewhere.
