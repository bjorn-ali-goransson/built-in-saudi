# Images → PDF

- **Slug:** `/tools/images-to-pdf` · **Category:** PDF · **Priority:** Tier 1
- **Runs:** 100% client-side · **Status:** Coming soon
- **Libraries:** `pdf-lib` (or `jsPDF`)

## Why
Extremely high demand ("jpg to pdf"), and people convert *sensitive* documents
(IDs, contracts) — so "never uploaded" is a strong wedge. `pdf-lib` builds PDFs
in the browser.

## User stories
- As a user, I want to combine several JPG/PNG images into one PDF.
- As a user, I want to reorder pages and choose page size/orientation/margins.

## Inputs → Outputs
Images (ordered) + page settings → a single downloadable PDF.

## Requirements (v1)
- [ ] Drag-and-drop, multi-file, thumbnail reorder (drag), remove.
- [ ] Page size (A4/Letter/fit-to-image), orientation, margin, fit mode.
- [ ] Embed JPG/PNG; one image per page (v1).
- [ ] Download the generated PDF; local-only messaging.

## Acceptance criteria
- 5 mixed JPG/PNG images produce a 5-page PDF in the chosen order.
- Output opens in common viewers; images aren't distorted.

## Out of scope (v1)
- OCR/text layer, multiple images per page, HEIC input.
