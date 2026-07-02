# Saudi VAT Calculator

- **Slug:** `/tools/vat-calculator` · **Category:** Calculators · **Priority:** Tier 2
- **Runs:** 100% client-side · **Status:** Coming soon
- **Libraries:** none
- **Locale wedge:** 🇸🇦 Saudi-specific default (15% KSA VAT)

## Why
Saudi businesses and shoppers compute VAT constantly. Defaulting to the KSA rate
(15%) and Arabic-first makes this more relevant than generic global calculators —
and it reinforces the brand.

## User stories
- As a shopkeeper, I want to add VAT to a net price and see net/VAT/gross.
- As a shopper, I want to remove VAT from a gross price to find the net.
- As a user, I want to override the rate (e.g. 5% historical, 0% exempt).

## Inputs → Outputs
Amount + mode (add/remove VAT) + rate (default 15%) → net, VAT amount, gross.

## Requirements (v1)
- [ ] Add-VAT and remove-VAT (reverse) modes.
- [ ] Rate defaults to 15%, editable; presets (15%, 5%, 0%).
- [ ] Correct rounding to 2 decimals (halala); SAR formatting.
- [ ] Copy a plain breakdown; fully bilingual (AR/EN).

## Acceptance criteria
- Net 100 @15% → VAT 15, gross 115.
- Remove VAT from gross 115 @15% → net 100, VAT 15.

## Out of scope (v1)
- Multi-line invoices, e-invoicing (ZATCA/Fatoora) integration.
