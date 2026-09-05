# Video Stabilizer

- **Slug:** `/apps/video-stabilize` · **Category:** Files · **Priority:** Tier 1
- **Runs:** 100% client-side · **Status:** Live
- **Libraries:** WebCodecs (`VideoDecoder`/`VideoEncoder`), `mp4box` for demuxing,
  `src/lib/mp4Writer.ts` for muxing, `src/lib/mp4Encode.ts` for the shared encode
  facts. **No new dependency, and no motion library** — the estimator is a
  hundred lines of pyramid search in `motion.ts`.

## Why a separate app

`video-edit` crops, joins, captions and hides. Every one of those is a decision
somebody makes *on the picture*, which is why that tool is a full-screen editor
with its controls on the frame. Stabilising is not: it is one measurement, one
choice about how hard, and one number saying what that costs. Putting it behind
a fifth mode in an editor would have hidden it from everyone who arrives with a
shaky clip and no interest in cropping — and search says they arrive with the
symptom (`my video is shaky`), not with the remedy.

The market reason is the usual one: every stabiliser on the web wants the file
uploaded first.

## The three claims it is built on

1. **Stabilising costs picture, and the amount is a property of YOUR clip.**
   Sliding a frame back under the output rectangle slides its far edge out, so
   every stabiliser crops. Almost none of them says by how much, and the ones
   that do make you pick a percentage *before* you know what you needed.
   `requiredZoom` derives it in closed form from the measured corrections, so
   the figure on screen is a measurement rather than a default.
2. **A smoothed path is not a still camera.** Holding the picture still fights a
   deliberate pan as hard as it fights a wobble, and the result lurches back
   every time you stop moving. What is removed is the difference between where
   the camera went and where it was heading.
3. **The clip is measured once.** Gentle, medium and strong re-price instantly,
   because changing the smoothing is three array passes over three numbers a
   frame — not a second decode. That is what lets the trade be shown live
   instead of being a setting you commit to and wait for.

## How the movement is measured (`motion.ts`)

Pure, with **no runtime imports**, so `evals/shakeprobe.mjs` compiles it
standalone with tsc and calls the real thing — the `relatedPick.ts` /
`cvPatch.ts` arrangement, for the reason this repo has recorded five times.

- A 4×4 grid of tiles, matched coarse-to-fine down a three-level pyramid, with a
  parabola fit for the sub-pixel part. The frames are looked at ~320px wide, so
  the sub-pixel step is what keeps the estimate usable on 1080p.
- **Tiles with no detail are rejected** — sky, a wall, a blown-out window — and
  the surviving displacements are filtered against their own **median** before a
  rigid transform is fitted. That is what stops a person walking through a
  locked-off shot dragging the camera estimate after them.
- **Rigid — rotation and translation — and nothing more.** A scale term reads
  every zoom or forward step as shake and fights it; more parameters against a
  noisy tile field mostly buys a wobblier estimate.
- The per-frame steps are **composed**, not summed. Summing `dx` and `rot`
  separately is what every stabiliser tutorial does and it is only right while
  the total rotation stays near zero.

## What `evals/shakeprobe.mjs` measures

Synthetic camera path, so the answer is known. No API key, no fixture file.

| | |
|---|---|
| per-step translation error | **0.05 / 0.07 px** |
| per-step rotation error | **0.027°** |
| accumulated drift over 48 frames | **0.63 px** |
| a still camera reported as moving | **0.0001 px** |
| a moving subject at 17% of the frame | **0.009 px** — rejected |
| a moving subject at 31% of the frame | **9.8 px** — followed |
| a frame with no detail | 0 tiles, reported as unmeasured |

**The subject sweep is the load-bearing control**, and where it breaks is a
property of the median rather than a bug: past half the tiles the subject *is*
the majority and no amount of rejection can know which half is the room.
Verified to fail — dropping the median rejection reddens the subject case,
dropping the detail floor reddens the flat one.

## Fixtures

`e2e/fixtures/shaky.mp4` (`scripts/make-shaky-mp4.mjs`, run once, committed).
**The steady fixture cannot test this tool at all**: run against `sample.mp4`
the stabiliser corrects by nothing, crops by nothing, and passes every assertion
having measured nothing. The synthetic clip carries a slow **sway** — which a
gentle setting leaves alone and a strong one fights, so "steadying harder costs
more picture" is a difference a test can see — a fast **wobble**, and one bright
**marker** at a fixed place in the world, so a case can ask whether the picture
actually stopped moving instead of trusting the panel's percentage. Measured on
it: the marker wanders about four times as far in the original.

The frames are encoded by a real browser (Node has no H.264 encoder) and muxed
by our own writer, which is only acceptable because `evals/mp4guard.mjs` proves
that writer against mp4box.

## Stated limits

In the UI, not implied away:

- **No rolling-shutter correction.** Whole frames are moved and turned, so the
  diagonal jelly a phone sensor puts into a hard shake stays.
- **Motion blur is not undone**, and taking the movement out usually makes it
  easier to see rather than harder.
- **It steadies the camera, not the subject.** There is no tracking.
- A shake bigger than the margin a crop can buy back is named as such rather
  than silently half-corrected.

## Follow-ups

- **A scene cut** is currently absorbed as a large measured motion. Detecting it
  (a collapse in surviving tiles, or a residual far outside the run of frames
  around it) and resetting the path there would stop one cut smearing its
  correction across the frames either side of it.
- **Rolling shutter** needs a per-row model, which is a different estimator, not
  a parameter on this one.
