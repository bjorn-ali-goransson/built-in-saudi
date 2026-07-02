# Saudi IBAN Validator & Formatter

- **Slug:** `/tools/iban-validator` · **Category:** Saudi / Local · **Priority:** Tier 2
- **Runs:** 100% client-side · **Status:** Coming soon
- **Libraries:** none (ISO 7064 mod-97 check implemented directly)
- **Locale wedge:** 🇸🇦 Saudi-first, useful for anyone entering bank details

## Why
People paste IBANs into transfer forms and typos cost real money. A local
validator (no data sent anywhere) that knows the Saudi format (SA + 22 digits)
is genuinely useful and on-brand.

## User stories
- As a user, I want to check whether an IBAN is structurally valid.
- As a user, I want it pretty-printed in groups of four.
- As a user, I want to know the bank from the Saudi bank code.

## Inputs → Outputs
An IBAN string → valid/invalid (mod-97), normalised + grouped display, and (for
SA) the identified bank.

## Requirements (v1)
- [ ] ISO 13616 structure check + ISO 7064 mod-97 checksum.
- [ ] Saudi-specific: enforce `SA` + length 24, extract 2-digit bank code.
- [ ] Map Saudi bank codes → bank names (bundled table).
- [ ] Format in groups of 4; copy; clear validity indicator.

## Acceptance criteria
- A valid SA IBAN passes; flipping one digit fails the checksum.
- Bank code resolves to the correct bank name for major Saudi banks.

## Out of scope (v1)
- Full global bank directory, account-number (BBAN) sub-validation per country.
