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
