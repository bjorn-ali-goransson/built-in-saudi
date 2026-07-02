# Image Cropper

- **Slug:** `/tools/image-cropper` · **Category:** Images · **Priority:** Tier 2
- **Runs:** 100% client-side · **Status:** Coming soon
- **Libraries:** Canvas API; optional small cropper UI helper

## Why
Cropping (and fixed-ratio cropping for avatars, thumbnails, social) is a common,
high-intent task. Competitors upload your image; we crop on-device.

## User stories
- As a user, I want to drag a crop box over my image and export just that region.
- As a user, I want preset aspect ratios (1:1, 4:3, 16:9, free) and to rotate/flip.
- As a user, I want to pick output format/quality and download.

## Inputs → Outputs
An image + crop rectangle (+ optional rotation/flip) → cropped image, download.

## Requirements (v1)
- [ ] Drag-resize crop box with handles; keyboard nudge; live preview.
- [ ] Aspect-ratio presets + free-form; show output pixel dimensions.
- [ ] Rotate 90°/flip; export PNG/JPG/WebP with quality control.
- [ ] EXIF-orientation aware on load; local-only messaging.

## Acceptance criteria
- Cropping a region yields an image of exactly the selected pixel size.
- 1:1 preset constrains the box to a square; output is square.

## Out of scope (v1)
- Freehand/mask cropping, filters/adjustments (belongs in a fuller editor).
