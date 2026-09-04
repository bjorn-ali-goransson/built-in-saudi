# Video Editor

- **Slug:** `/apps/video-edit` · **Category:** Files · **Priority:** Tier 1
- **Runs:** 100% client-side · **Status:** Live (beta)
- **Libraries:** WebCodecs (`VideoDecoder`/`VideoEncoder`), `mp4box` for demuxing,
  `src/lib/mp4Writer.ts` for muxing. No new dependency.

## Why
The video family here could trim, take a still, extract the sound and make a GIF
— and every one of those avoids touching the picture. Cropping, joining and
captioning all change what is *in* the frame, so all three need the same thing:
decode, redraw, encode. Building it once gives all three.

It is the tool people go looking for when they have a recording and a platform
that wants a different shape, and the incumbents want the file uploaded first —
which is the one thing this site will not do.

## The three claims it is built on

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

## User stories
- As someone posting a Reel, I want to crop a landscape recording to 9:16 and
  choose which part of the frame survives.
- As someone with two clips, I want them joined into one file without the sound
  drifting out of sync at the join.
- As someone captioning in Arabic, I want the letters to join up.
- As someone on a browser that cannot do this, I want to be told plainly rather
  than watch an export fail.

## Inputs → Outputs
One or more MP4/MOV files + a crop shape + captions → one progressive MP4.

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

## Acceptance criteria
- The exported file decodes in a real browser at the cropped size, and a two-clip
  export is the length of both.
- The kept-percentage and output size are right for a known fixture: 320×240 to
  9:16 is 42% and **134**×240 — even, from an odd 135.
- A caption darkens its row of the preview only between its `from` and `to`.
- `evals/mp4guard.mjs` re-parses the muxer's output with mp4box and gets every
  sample back byte for byte.

## Known limits (stated in the UI, not implied away)
- **MP4/MOV in, MP4 out.** WebM and MKV are different containers; `mp4box` does
  not read them.
- **Clips whose sound is stored differently cannot be joined with sound.** The
  alternative is re-encoding audio, which is not available everywhere (above).
- **Baseline H.264**, so no B-frames. Slightly less efficient at a given
  bitrate, and it keeps decode order and presentation order identical — which is
  what makes the sample table provably right.
- **Firefox on Android has no WebCodecs at all.** That, not Safari, is why
  `VideoEncoder` is not Baseline; Safari has had it since 16.4.
