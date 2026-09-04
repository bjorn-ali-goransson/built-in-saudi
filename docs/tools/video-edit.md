# Video Editor

- **Slug:** `/apps/video-edit` · **Category:** Files · **Priority:** Tier 1
- **Runs:** 100% client-side · **Status:** Live (beta)
- **Libraries:** WebCodecs (`VideoDecoder`/`VideoEncoder`), `mp4box` for demuxing,
  `src/lib/mp4Writer.ts` for muxing. No new dependency.

## Why
The video family here could trim, take a still, extract the sound and make a GIF
— and every one of those avoids touching the picture. Cropping, joining,
captioning and hiding part of the picture all change what is *in* the frame, so
all four need the same thing: decode, redraw, encode. Building it once gives all
four.

It is the tool people go looking for when they have a recording and a platform
that wants a different shape, and the incumbents want the file uploaded first —
which is the one thing this site will not do.

## The four claims it is built on

1. **A crop is a loss, and the loss is measurable.** 16:9 → 9:16 keeps
   `(9/16) ÷ (16/9)` of the width — **31.6% of the frame**. The tool prints the
   percentage for the actual clip and lets you drag to choose what survives,
   because whatever was filmed is rarely in the middle of what is left. Every
   automatic re-framer decapitates somebody; this one asks.
2. **The caption is drawn on the page, not in the worker.** One `ImageBitmap`
   per caption, rendered with the page's own fonts, composited into every frame.
   So Arabic is shaped and run right-to-left by the browser's text engine, and
   the preview is not an approximation of the export — it is the same pixels.
3. **The sound is copied, never re-encoded.** Measured: `AudioEncoder`
   `isConfigSupported({codec:'mp4a.40.2'})` is **false in Chrome on Linux**,
   on a browser whose video encoder works perfectly. A tool that re-encoded
   audio would lose it for a whole platform.
4. **A mosaic does not survive a video.** Measured, `node evals/pixelleak.mjs`:
   the mosaic grid is fixed to the frame while the subject moves through it, so
   every frame samples the same picture on a differently-aligned grid.
   Back-projection recovers **98.6% of a pixelated number plate from 64 frames
   — 2.1 seconds at 30fps** — against 68.3% from one frame, which is what a
   blank guess scores. A **static** subject stays at 68.3% however many frames
   there are, which is the control proving the leak comes from motion. So the
   default is a solid box, and pixelate/blur say what they cost.

## User stories
- As someone posting a Reel, I want to crop a landscape recording to 9:16 and
  choose which part of the frame survives.
- As someone with two clips, I want them joined into one file without the sound
  drifting out of sync at the join.
- As someone captioning in Arabic, I want the letters to join up.
- As someone on a browser that cannot do this, I want to be told plainly rather
  than watch an export fail.

## Inputs → Outputs
One or more MP4/MOV files + a crop shape + captions + censor boxes → one
progressive MP4.

## Requirements (v1)
- [x] Several clips, reorderable and removable; joined in order.
- [x] Aspect presets (original, 9:16, 1:1, 4:5, 16:9) with a draggable, and
      keyboard-nudgeable, crop centre and a zoom.
- [x] Output size derived from the crop, never upscaled, snapped to even
      dimensions (H.264 4:2:0 has no half chroma sample to put in an odd row).
- [x] Captions with text, colour, size, a band or an outline, and a time range.
- [x] Audio copied when every clip agrees on its format; otherwise the export is
      silent and the page says so BEFORE the encode.
- [x] A capability gate naming WebCodecs/H.264, routing to `video-trim`.
- [x] Censor boxes: drag on the export preview to draw one, drag to move it,
      each with its own time range and mode. Solid by default; a warning naming
      the measured figure appears only when a recoverable mode is chosen.

## Acceptance criteria
- The exported file decodes in a real browser at the cropped size, and a two-clip
  export is the length of both.
- The kept-percentage and output size are right for a known fixture: 320×240 to
  9:16 is 42% and **134**×240 — even, from an odd 135.
- A caption darkens its row of the preview only between its `from` and `to`.
- A censor box blacks out its region and nothing else, and the box is present in
  the DECODED EXPORT — read back off the exported file, since a preview
  assertion cannot tell "drawn on screen" from "encoded into the video", and the
  whole point of a redaction is that it survives into the file somebody opens.
- `evals/mp4guard.mjs` re-parses the muxer's output with mp4box and gets every
  sample back byte for byte.

## Known limits (stated in the UI, not implied away)
- **A censor box does not follow anything.** It is a fixed rectangle for a fixed
  span, so a moving subject needs a box big enough for the whole path or several
  boxes in sequence — which the UI says, because a box that is right for one
  second and wrong for the next has published the thing it was hiding. Keyframed
  boxes that interpolate between two positions are the obvious next step and are
  deliberately not in v1.
- **A censor box can only be created with a pointer.** Its time range and mode
  are keyboard-reachable, its position is not — unlike the crop, which nudges
  with the arrow keys. Worth fixing; recorded rather than glossed.
- **Censoring hides the picture, not the sound.** The audio is copied across
  untouched, so a spoken name survives a black box over the face saying it. The
  UI states this next to the boxes.
- **The pixelleak finding does NOT transfer to a single still.** It measures
  what many differently-aligned frames give back; one frame gave back nothing.
  `image-redact`'s pixelate default is therefore not condemned by it, and should
  not be changed on the strength of it.
- **MP4/MOV in, MP4 out.** WebM and MKV are different containers; `mp4box` does
  not read them.
- **Clips whose sound is stored differently cannot be joined with sound.** The
  alternative is re-encoding audio, which is not available everywhere (above).
- **Baseline H.264**, so no B-frames. Slightly less efficient at a given
  bitrate, and it keeps decode order and presentation order identical — which is
  what makes the sample table provably right.
- **Firefox on Android has no WebCodecs at all.** That, not Safari, is why
  `VideoEncoder` is not Baseline; Safari has had it since 16.4.
