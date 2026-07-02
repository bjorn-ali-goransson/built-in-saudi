# Merge PDF

- **Slug:** `/tools/pdf-merge` · **Category:** PDF · **Priority:** Tier 1
- **Runs:** 100% client-side · **Status:** Coming soon
- **Libraries:** `pdf-lib`

## Why
A flagship "we don't upload your documents" tool. Merging is fully doable with
`pdf-lib` by copying pages between documents in-browser.

## User stories
- As a user, I want to merge multiple PDFs into one, in an order I control.
- As a user, I want to remove a file or reorder before merging.

## Inputs → Outputs
Ordered list of PDFs → single merged PDF, download.

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
