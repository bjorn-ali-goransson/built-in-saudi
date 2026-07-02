# Image Compressor & Resizer

- **Slug:** `/tools/image-compressor` · **Category:** Images · **Priority:** Tier 1
- **Runs:** 100% client-side · **Status:** Coming soon
- **Libraries:** Canvas API (`createImageBitmap`, `canvas.toBlob`); optional `browser-image-compression`

## Why
**Flagship privacy tool.** The ad-driven competitors (vexatool, tinywow, etc.)
*upload your photos to their servers*. We compress/resize entirely in the
browser — the image never leaves the device. That's a materially safer product.

## User stories
- As a user, I want to drop JPG/PNG/WebP images and shrink their file size.
- As a user, I want to resize by max width/height or percentage.
- As a user, I want a before/after size comparison and to download results.

## Inputs → Outputs
One or more images + quality slider + optional max dimensions → compressed images
+ per-file original→new size and % saved; download individually or as a batch.

## Requirements (v1)
- [ ] Drag-and-drop + file picker; multiple files.
- [ ] Quality slider (re-encode via `canvas.toBlob`, JPEG/WebP quality).
- [ ] Optional resize (max W/H keeping aspect ratio, or % scale).
- [ ] Show original vs new size and savings %; preview thumbnails.
- [ ] Download each, or "download all" (zip via `client-zip`/`fflate` if batched).
- [ ] Strong, explicit "processed locally — nothing uploaded" messaging.

## Acceptance criteria
- A 4 MB JPEG visibly shrinks with a chosen quality; output opens correctly.
- Aspect ratio preserved on resize; EXIF orientation respected.
- No network requests carry image data (verify in devtools).

## Out of scope (v1)
- HEIC input (needs a decoder lib — fast follow), AVIF encode, bulk >~50 files.
