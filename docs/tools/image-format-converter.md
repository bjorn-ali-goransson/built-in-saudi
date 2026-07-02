# Image Format Converter

- **Slug:** `/tools/image-format-converter` · **Category:** Images · **Priority:** Tier 1
- **Runs:** 100% client-side · **Status:** Coming soon
- **Libraries:** Canvas API (`canvas.toBlob`); HEIC needs `heic2any` (fast follow)

## Why
"PNG to JPG", "WebP to PNG" are massive search terms and classic adware bait.
Canvas can do PNG/JPG/WebP conversions entirely client-side.

## User stories
- As a user, I want to convert an image between PNG, JPG and WebP.
- As a user, I want to set JPG/WebP quality and keep/flatten transparency.

## Inputs → Outputs
Image(s) + target format + quality (for lossy) → converted image(s), download.

## Requirements (v1)
- [ ] Convert among PNG ↔ JPG ↔ WebP via Canvas.
- [ ] Quality control for JPG/WebP; background fill when flattening PNG→JPG.
- [ ] Batch support; download individually or zipped.
- [ ] Local-only messaging.

## Acceptance criteria
- PNG with transparency → JPG produces a correctly-filled (non-black) background.
- WebP → PNG round-trips without visible artefacts at quality 1.0.

## Out of scope (v1)
- HEIC/AVIF input (fast follow with a decoder), SVG rasterisation, ICO.
