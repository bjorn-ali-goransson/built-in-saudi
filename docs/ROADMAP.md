# Built in Saudi — Tool Roadmap

The master backlog. Each tool has a spec in [`docs/tools/`](./tools/) so we can
chip them off one by one. Prioritisation weighs **demand**, **privacy wedge**
(competitors upload your files — we don't), **frontend feasibility**, and
**effort**.

**Runs** column: `client` = 100% in-browser (our default); `queue` = needs the
optional [backend worker](./BACKEND.md).

## Out of scope (deliberately excluded)
- **Interest / riba-based tools** — no loan/EMI/interest calculators or anything
  built around interest. Excluded for Islamic (Shariah) reasons.
- **Irrelevant noise** — construction-cost estimators, CGPA, arcade games, and
  similar filler seen on competitor "all-in-one" sites.
- Tools that require scraping or an API key we don't want to run (keyword
  research, AI blog/social generators) unless offered as external showcases.

## Status legend
✅ live · 📝 spec ready · 🧭 idea (spec TBD)

## Generators
| Tool | Slug | Runs | Priority | Status |
|------|------|------|----------|--------|
| Barcode / QR generator (باركود) | `/tools/qr-code` | client | — | ✅ live |
| [Password generator](./tools/password-generator.md) | `/tools/password-generator` | client | T1 | 📝 |
| [UUID generator](./tools/uuid-generator.md) | `/tools/uuid-generator` | client | T1 | 📝 |
| [Hash generator](./tools/hash-generator.md) | `/tools/hash-generator` | client | T2 | 📝 |
| Lorem Ipsum generator | `/tools/lorem-ipsum` | client | T3 | 🧭 |

## Converters & encoders
| Tool | Slug | Runs | Priority | Status |
|------|------|------|----------|--------|
| [Base64 encoder/decoder](./tools/base64.md) | `/tools/base64` | client | T1 | 📝 |
| [Unit converter](./tools/unit-converter.md) | `/tools/unit-converter` | client | T2 | 📝 |
| [Case converter](./tools/case-converter.md) | `/tools/case-converter` | client | T2 | 📝 |
| Timestamp ↔ date | `/tools/timestamp` | client | T2 | 🧭 |
| Number base converter | `/tools/number-base` | client | T3 | 🧭 |

## Images (client-side)
| Tool | Slug | Runs | Priority | Status |
|------|------|------|----------|--------|
| [Image compressor & resizer](./tools/image-compressor.md) | `/tools/image-compressor` | client | T1 | 📝 |
| [Image format converter](./tools/image-format-converter.md) | `/tools/image-format-converter` | client | T1 | 📝 |
| [Image cropper](./tools/image-cropper.md) | `/tools/image-cropper` | client | T2 | 📝 |
| Background remover | `/tools/background-remover` | queue/wasm | T4 | 🧭 |
| Image upscaler | `/tools/image-upscaler` | queue/wasm | T4 | 🧭 |

## PDF (client-side)
| Tool | Slug | Runs | Priority | Status |
|------|------|------|----------|--------|
| [Images → PDF](./tools/images-to-pdf.md) | `/tools/images-to-pdf` | client | T1 | 📝 |
| [Merge PDF](./tools/pdf-merge.md) | `/tools/pdf-merge` | client | T1 | 📝 |
| [Split PDF](./tools/pdf-split.md) | `/tools/pdf-split` | client | T1 | 📝 |
| PDF → images | `/tools/pdf-to-images` | client | T2 | 🧭 |
| PDF → text (extract) | `/tools/pdf-to-text` | client | T2 | 🧭 |
| Rotate / reorder / delete / page numbers | `/tools/pdf-organize` | client | T2 | 🧭 |
| PDF ↔ Word/Excel | `/tools/pdf-office` | queue | T4 | 🧭 |

## Text & developer
| Tool | Slug | Runs | Priority | Status |
|------|------|------|----------|--------|
| [Word & character counter](./tools/word-counter.md) | `/tools/word-counter` | client | T2 | 📝 |
| [JSON formatter](./tools/json-formatter.md) | `/tools/json-formatter` | client | T1 | 📝 |
| Regex tester | `/tools/regex-tester` | client | T2 | 🧭 |
| JWT decoder | `/tools/jwt-decoder` | client | T2 | 🧭 |
| Diff checker | `/tools/diff-checker` | client | T3 | 🧭 |
| Color picker & palettes | `/tools/color-tools` | client | T2 | 🧭 |
| Password strength checker | `/tools/password-strength` | client | T2 | 🧭 |
| Text to speech | `/tools/text-to-speech` | client | T3 | 🧭 |
| Typing speed tester | `/tools/typing-speed` | client | T3 | 🧭 |
| Number → words | `/tools/number-to-words` | client | T3 | 🧭 |
| Notepad (local, autosaved) | `/tools/notepad` | client | T3 | 🧭 |
| YouTube thumbnail downloader | `/tools/youtube-thumbnail` | client | T3 | 🧭 |

## Calculators
| Tool | Slug | Runs | Priority | Status |
|------|------|------|----------|--------|
| [Saudi VAT calculator (15%)](./tools/vat-calculator.md) | `/tools/vat-calculator` | client | T2 | 📝 |
| Zakat calculator | `/tools/zakat-calculator` | client | T2 | 🧭 |
| BMI / Age / Percentage | `/tools/calculators` | client | T3 | 🧭 |

_(No loan/EMI/interest calculators — see Out of scope.)_

## Business & invoicing
| Tool | Slug | Runs | Priority | Status |
|------|------|------|----------|--------|
| [Invoice generator (SAR, VAT, bilingual)](./tools/invoice-generator.md) | `/tools/invoice-generator` | client | T2 | 📝 |
| Payment receipt generator | `/tools/receipt-generator` | client | T3 | 🧭 |

## 🇸🇦 Saudi / local (brand wedge, low competition)
| Tool | Slug | Runs | Priority | Status |
|------|------|------|----------|--------|
| [Hijri ↔ Gregorian converter](./tools/hijri-converter.md) | `/tools/hijri-converter` | client | T2 | 📝 |
| [Saudi IBAN validator](./tools/iban-validator.md) | `/tools/iban-validator` | client | T2 | 📝 |
| [Tafqeet — amount to Arabic words (تفقيط)](./tools/tafqeet.md) | `/tools/tafqeet` | client | T2 | 📝 |
| Arabic text tools (tashkeel, numerals) | `/tools/arabic-text` | client | T3 | 🧭 |
| Saudi phone number formatter | `/tools/saudi-phone` | client | T3 | 🧭 |

## Services (needs backend)
| Tool | Slug | Runs | Priority | Status |
|------|------|------|----------|--------|
| Book a meeting (calendar) | `/book` | backend | T3 | 🧭 |

See [`BACKEND.md`](./BACKEND.md) for the queue-worker economics and confidence
scores on the `queue`/`backend` items.
