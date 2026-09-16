# Image Editor

- **Slug:** `/apps/image-edit` · **Category:** Images · **Priority:** Tier 1
- **Runs:** 100% client-side · **Status:** Live
- **Libraries:** none beyond what the site already has (`lib/frameCompose.ts`,
  `lib/captionBitmap.ts`, `lib/decodeImage.ts`; canvas `toBlob` for the export)

## Why
The image family could crop, hide and caption — in three separate tools, three
uploads and three downloads. Doing two of those to one picture meant a round
trip through a file. `video-edit` had already been rebuilt into one full-screen
editor where all of it is one session on one stage, and a still picture is that
same product with less machinery: no timeline, no join, no encoder.

## User stories
- As someone posting a photo, I want to crop it to the shape a platform wants
  and see what that costs before I commit.
- As someone sharing a screenshot, I want to hide a face, a name or a plate in
  it without sending it anywhere.
- As someone making a social post, I want to put a caption on the picture and
  have Arabic join up and run the right way.
- As someone with an iPhone photo on an Android phone, I want it to open at all.

## Inputs → Outputs
One picked image (PNG, JPEG, WebP, GIF, HEIC) → a cropped, censored, captioned
PNG / JPEG / WebP, produced entirely on the device.

## Requirements (v1)
- [x] Crop: nine draggable segments, the rule-of-thirds guides they draw, a
      snap onto 9:16 / 1:1 / 4:5 / 16:9 / the source shape, and a free
      proportion when the drag settles between them.
- [x] The crop rectangle is dragged over the WHOLE picture, with what it throws
      away dimmed — not over the result, which hides the thing being decided.
- [x] Hide a region: pixelate (default), solid or blur, with what that choice
      costs stated next to it.
- [x] Caption: a box drawn with the same gesture, typed onto the picture, with
      its colour on the box and its size set by the box.
- [x] Cut a piece out with the scissors: drag a rectangle, then move, turn or
      resize it. The hole it leaves takes a fill colour. Cut mode shows the
      WHOLE picture, like crop mode, because a piece can be dragged in from
      outside the frame and its hole can be outside it too.
- [x] Add another picture with the plus: fitted to 40% of the longest side on
      arrival, never enlarged, then moved/turned/resized like a cut piece. It
      leaves NO hole — that is the one property separating the two kinds.
- [x] Output: format, quality, largest side, never upscaled.
- [x] Tilt one degree clockwise, **on by default**, as a shortcut button on the
      frame with the other tools — no explanatory copy, because the picture is
      visibly off true and that is the whole feature. Applied to the SOURCE, so
      every mode and the export show it from one place.
- [x] HEIC via `decodeImage`; no `accept` on the input and no MIME gate; a bad
      pick says why (#225, #226).

## Acceptance criteria
- The preview IS the export: one `compose` call for the stage and the file.
- The tilt shows in EVERY mode, crop included — crop mode draws the whole
  picture and does not call `compose`, which is how it missed the tilt once.
- A censor survives into the downloaded picture, measured on the file.
- A cut leaves the fill behind and an added picture does not, both measured on
  the corner pixel, with the cut as the control for the addition.
- A cut piece and an added picture both reach the exported file.
- On a phone the tool dock does not cover Back — the only way out — asserted
  with a hit test rather than a class.
- The download is thrown away the moment anything under it changes.
- The crop segments are not mirrored in Arabic.

## Out of scope (v1)
- Layer ordering, opacity and blend modes for an added picture. It goes on top
  of the picture and under the boxes and captions; anything more is a paint
  program.
- Drawing, filters, levels, healing — this is the video editor's screen for one
  frame, not a paint program.
- Automatic subject detection. The video editor follows a box somebody drew;
  the same reasoning applies here and there is no timeline to follow along.
