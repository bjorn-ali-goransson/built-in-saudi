# Built in Saudi — Roadmap

The backlog, and an honest account of what exists. **149 tools are live.** This
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
| Developer | 30 | encoders, formatters, regex, JWT, cron (explain **and** build), cURL→code, URL parsing, HMAC, JSON diff, CSV clean/merge |
| Saudi / Local | 21 | prayer, Hijri, qibla, adhkar, IBAN, tafqeet, Arabic normalisation/numerals/Franco, phone, iqama expiry, weather |
| Text | 20 | counters, diffing, readability, anonymising, invisible characters, subtitles, character finder |
| Images | 18 | compress/convert/crop, OCR, background removal, redaction, passport photos, carousel, screenshot framing |
| Calculators | 16 | VAT, zakat, dates, coordinates, timezones, sun times, and the health cluster |
| Generators | 10 | QR, barcode, passwords, 2FA, printable paper, wheels and draws |
| PDF | 10 | merge/split/compress/sign/fill/edit, →images, →text, **true redaction** |
| Design | 8 | colour, contrast, gradients, bezier, palette-from-image |
| Files | 7 | archives, metadata, hex, encryption, audio trim/extract, video→GIF |
| Business | 4 | invoice, quotation/receipt, CV optimizer, Book Me |
| Converters, Communication | 4 | units, base64, timestamps, Calls |

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
| **Video trim / convert** | Needs a real MP4 demuxer + muxer (`mp4box.js`, or WebCodecs plumbing). The dependency-free alternative — MediaRecorder realtime capture — is *worse than nothing*: a 10-minute clip takes 10 minutes and silently becomes WebM. Video→GIF shipped because a GIF is short by nature. |
| **On-device AI** (Chrome's built-in Gemini Nano: Summarizer, Translator, Proofreader, Prompt) | The most interesting item left — it would let us ship AI tools with **no backend and no privacy asterisk**. Chrome-only progressive enhancement; needs a session with a real browser to verify the API surface rather than code written blind. |
| **JSON ↔ YAML ↔ TOML** | Needs real parsers. Hand-rolling YAML is how you ship silently-wrong output. |
| **GOSI contributions** | Rates changed with the 2024 pension law and differ by nationality and hire date. Needs an authoritative current source, not memory. |
| **Mirath / inheritance (فرائض)** | The highest-demand Saudi wedge left, and the one most in need of scholarly sourcing and review. Same bar as `zakat` and `end-of-service`. |
| **PDF ↔ Word/Excel, ML upscaling, heavy ffmpeg** | Compute we would have to host — see [`BACKEND.md`](./BACKEND.md). |
| **ZATCA / Fatoora e-invoicing** | Needs a backend and a crypto stamp. We may decode a QR; we must never call anything "a compliant invoice". |
| **HIBP breach check** | Needs an API we would have to proxy, which puts a hash of your password through our server. |

---

## Next, ranked

Dep-free and correctness-safe, so they can be built to the same bar as the rest:

1. **Print & paper goods** — booklet imposition (n-up), PDF page numbering and
   watermarking, Avery-style label sheets, certificates. `pdf-lib` is already a
   dependency and `paper-generator` proved the pattern.
2. **Passphrase generator** (diceware, with an Arabic wordlist) — distinct from
   the character-based password generator, and better advice.
3. **Image finishing** — batch watermark, collage, polaroid frame, device
   mockup, SVG optimiser, colour-blindness simulator.
4. **Saudi remainder** — vehicle plate Arabic↔Latin, national short-address
   format validator.
5. **Sound** — metronome, tuner, BPM tap, sound meter. Web Audio, no deps.
6. **Classroom** — printable worksheets, bingo cards, quiz maker.

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
