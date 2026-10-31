# Merge PDF

- **Slug:** `/apps/pdf-merge` · **Category:** PDF · **Priority:** Tier 1
- **Runs:** 100% client-side · **Status:** Live
- **Libraries:** `pdf-lib`

## Why
A flagship "we don't upload your documents" tool. Merging is fully doable with
`pdf-lib` by copying pages between documents in-browser.

Since November 2026 it is also where Images to PDF and Organise PDF Pages went:
one screen of pages from any mix of PDFs and pictures.

## User stories
- As a user, I want to merge multiple PDFs into one, in an order I control.
- As a user, I want to add photos or scans as pages.
- As a user, I want to turn, reorder and remove individual pages before saving.

## Inputs → Outputs
PDFs and pictures (JPG, PNG, HEIC, WebP…) → one PDF, download. Pictures go on a
page their own size, or on A4 / Letter with a margin.

## Requirements (v1)
- [ ] Multi-file drop; list with drag-reorder and remove.
- [ ] Merge via `PDFDocument.copyPages` across inputs.
- [ ] Preserve page sizes; show total page count.
- [ ] Download merged file; local-only messaging.

## Acceptance criteria
- Two PDFs (3 + 2 pages) merge into a 5-page PDF in the specified order.
- Encrypted/locked PDFs surface a clear, friendly error.

## Out of scope (v1)
- Page-range selection per file (that's the Split/Organize tool), bookmarks.
