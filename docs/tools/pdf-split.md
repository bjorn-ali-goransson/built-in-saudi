# Split PDF

- **Slug:** `/tools/pdf-split` · **Category:** PDF · **Priority:** Tier 1
- **Runs:** 100% client-side · **Status:** Coming soon
- **Libraries:** `pdf-lib` (+ `pdf.js` for page thumbnails, optional)

## Why
Pairs with Merge as the other half of the "PDF toolkit". High demand; strong
privacy wedge. `pdf-lib` extracts pages into new documents client-side.

## User stories
- As a user, I want to extract a page range into a new PDF.
- As a user, I want to split every N pages, or split into single pages (zip).

## Inputs → Outputs
A PDF + split mode (range / every-N / each-page) → one or more PDFs; download
(zip when multiple).

## Requirements (v1)
- [ ] Load a PDF, show page count (optional thumbnails via pdf.js).
- [ ] Modes: custom range (e.g. `2-5,8`), fixed interval, burst-to-singles.
- [ ] Produce output PDFs via `copyPages`; zip multiple with `fflate`/`client-zip`.
- [ ] Download; local-only messaging.

## Acceptance criteria
- Range `2-4` from a 10-page PDF yields a 3-page PDF (pages 2–4).
- Burst mode on a 3-page PDF yields a zip of 3 single-page PDFs.

## Out of scope (v1)
- Reordering/rotating (that's PDF Organize), password removal.
