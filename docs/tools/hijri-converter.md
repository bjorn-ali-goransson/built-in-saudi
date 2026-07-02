# Hijri ↔ Gregorian Converter

- **Slug:** `/tools/hijri-converter` · **Category:** Saudi / Local · **Priority:** Tier 2
- **Runs:** 100% client-side · **Status:** Coming soon
- **Libraries:** `Intl.DateTimeFormat` with `islamic-umalqura` calendar (native)
- **Locale wedge:** 🇸🇦 High Saudi relevance, weak/adware competition

## Why
Saudi Arabia runs on the Umm al-Qura Hijri calendar; converting dates is an
everyday need (documents, birthdays, official forms). The browser's `Intl`
supports `islamic-umalqura` natively — no heavy library required.

## User stories
- As a user, I want to convert a Gregorian date to Hijri (Umm al-Qura) and back.
- As a user, I want to see today's date in both calendars.
- As a user, I want Arabic month names and Arabic-Indic numerals option.

## Inputs → Outputs
A date in either calendar → the equivalent in the other, formatted in AR/EN.

## Requirements (v1)
- [ ] Gregorian → Hijri using `islamic-umalqura`.
- [ ] Hijri → Gregorian (pick Hijri Y/M/D via selects).
- [ ] "Today" shown in both; weekday name.
- [ ] Arabic + English month names; Arabic-Indic numeral toggle (٠١٢٣…).

## Acceptance criteria
- A known reference date matches Umm al-Qura (e.g. 2000-01-01 → 24/09/1420 AH).
- Round-trips (G→H→G) return the original date.

## Out of scope (v1)
- Other Islamic calendar variants, date arithmetic/duration between dates.
