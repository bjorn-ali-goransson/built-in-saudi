# Tafqeet — Amount to Arabic Words (تفقيط)

- **Slug:** `/tools/tafqeet` · **Category:** Saudi / Local · **Priority:** Tier 2
- **Runs:** 100% client-side · **Status:** Coming soon
- **Libraries:** none (custom Arabic number-spelling)
- **Locale wedge:** 🇸🇦 Genuinely Saudi/Arab; used on every invoice & cheque

## Why
"تفقيط" — writing a monetary amount in Arabic words — is required on invoices,
cheques and contracts across Saudi/the Gulf. It's fiddly Arabic grammar
(gender, dual, tens) that people get wrong. A correct, free, local tool is
distinctly on-brand and has little quality competition.

## User stories
- As an accountant, I want to convert `1250.75` SAR into correct Arabic words.
- As a user, I want to pick the currency (SAR default) so it reads
  "ريال" + "هللة" (or other currencies' major/minor units).
- As a user, I want to copy the phrase for pasting into an invoice.

## Inputs → Outputs
Amount (integer + fractional) + currency → grammatically-correct Arabic words,
e.g. `فقط ألف ومئتان وخمسون ريالاً وخمس وسبعون هللة لا غير`.

## Requirements (v1)
- [ ] Spell integers 0–999,999,999+ in correct Arabic (units, tens, hundreds,
      thousands, millions) with proper gender/dual forms.
- [ ] Handle the fractional part (halalas) and the "فقط … لا غير" framing.
- [ ] Currency presets: SAR (ريال/هللة), plus USD/AED/EGP etc.
- [ ] Copy button; live update; Arabic-Indic numeral display option.

## Acceptance criteria
- `100` SAR → "فقط مئة ريال لا غير".
- `1250.75` → includes "ألف ومئتان وخمسون ريالاً" and "خمس وسبعون هللة".
- Edge cases (0, 2/dual, 11–19, exact hundreds/thousands) read correctly.

## Out of scope (v1)
- English number-to-words (separate `/tools/number-to-words`), legal contract
  templating.
