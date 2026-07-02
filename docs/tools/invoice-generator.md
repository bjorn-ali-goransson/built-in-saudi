# Invoice Generator

- **Slug:** `/tools/invoice-generator` · **Category:** Business · **Priority:** Tier 2
- **Runs:** 100% client-side · **Status:** Coming soon
- **Libraries:** `pdf-lib` or `jsPDF` (client-side PDF); no server
- **Locale wedge:** 🇸🇦 SAR + 15% VAT + bilingual (AR/EN) by default

## Why
Small businesses and freelancers need quick, clean invoices. Competitors put
this behind sign-ups/ads and generate on their servers (your client data
leaves). Ours builds the PDF in-browser, defaults to SAR + KSA VAT, and can
print Arabic — a real Saudi-business fit and a strong privacy story.

## User stories
- As a freelancer, I want to fill seller/buyer details, line items (qty × price),
  and get a polished PDF invoice.
- As a Saudi business, I want VAT (15%) computed and shown, totals in SAR, and
  an option to show the amount in Arabic words (links to Tafqeet logic).
- As a user, I want to save/reuse my seller details locally.

## Inputs → Outputs
Seller + buyer info, invoice no./date, line items, VAT rate, notes → a
downloadable (and printable) PDF invoice; totals computed live.

## Requirements (v1)
- [ ] Line items with qty, unit price, per-line + grand totals.
- [ ] VAT rate (default 15%), subtotal / VAT / total in SAR.
- [ ] Bilingual labels (AR/EN), RTL-aware layout; logo upload (local only).
- [ ] Generate PDF client-side; also a clean print stylesheet.
- [ ] Persist seller profile in `localStorage`; nothing uploaded.
- [ ] Optional "amount in words" (Arabic via Tafqeet).

## Acceptance criteria
- 2 line items compute correct subtotal, 15% VAT, and total.
- PDF opens correctly with Arabic text rendering (embed an Arabic font).
- Reload restores the saved seller profile.

## Out of scope (v1)
- ZATCA/Fatoora e-invoicing XML + cryptographic stamp (future, likely needs
  backend), multi-currency tax logic, client CRM.
