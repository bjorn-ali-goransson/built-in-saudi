# Activity Schedule

- **Slug:** `/apps/activity-schedule` · **Category:** Generators · **Priority:** Tier 1
- **Runs:** 100% client-side · **Status:** Live
- **Libraries:** `qrcode` (already a dependency), `pdf-lib` via `lib/printPdf.ts`. No new dependency.

## Why

Built from a real Saudi kindergarten wall chart: a time and an activity per
day, an icon beside each so a child who cannot read yet can follow the day, any
number of sheets kept in the browser, and a share link that carries the whole
schedule — printed onto the PDF as a QR that reopens it for editing.

**There is one time axis and activities sit on it**, the way a real schedule
works. The reference sheet repeats a time column inside all five day cards —
the same value written five times, so five things that can drift apart, and
they had: `9:30 – 9:30`, `10:00 – 19:30`, a period that lost its end time.

**But the days are not locked to each other.** Assembly only on Sunday and an
early finish on Thursday are the ordinary shape of a week, so an activity
carries its own start and end and can be moved anywhere on the axis to the
quarter hour. What stops divergence happening by ACCIDENT is not a check after
the fact — it is that a dragged activity pulls to the times the other days
already use before it pulls to the raw quarter hour, so lining up is what
happens when you do nothing.

`timetable` stays the plain grid with no icons and owns `class schedule` /
«جدول أسبوعي»; the two link to each other.

## Inputs → Outputs

Title, a line under it, the days, the hours the day covers, and activities
placed on the axis → an HTML sheet, a share link, and an A4-landscape PDF.

## Requirements (v1)

- [x] One axis; within a day the activities are a SEQUENCE. Dragging one
      reorders it and the rest of the day closes up behind it, keeping the
      day's start, each activity's length and the breaks by position.
- [x] A drag into another day's column MOVES it there — one edit applied to
      both days, so the sheet never holds the lesson twice or not at all.
- [x] On TOUCH it takes a long press (400ms, cancelled by 8px of movement), so
      a finger can still scroll the sheet. A mouse drags at once. Touch runs on
      a NATIVE `{ passive: false }` listener that calls `preventDefault()`, so
      the held block takes the gesture back from the scroller — `touch-action`
      is read when the gesture begins, so setting it on the long press is too
      late, and React's own touch listeners are passive.
- [x] **No borders anywhere.** The column is the day's solid colour and each
      lesson is a white card on it, with the colour showing down both sides as a
      frame so the rounded corners blend into it.
- [x] **Nothing is edited on the sheet.** Tapping a lesson, the title, the line
      under it or the class opens a bottom DRAWER — the one place anything is
      edited. A block carries no inputs at all.
- [x] Name suggestions are fuzzy and ranked: the whole name, then its start,
      then a word inside it, then the letters in order, then a one-letter slip.
- [x] Clicking the illustrations removes them; the settings drawer offers them
      back as a BUTTON, because a checkbox that vanishes when ticked is an
      action pretending to be a setting.
- [x] Every other setting — the weekend, the day's start and end, saving,
      starting a new sheet, the saved list — is behind the ⋯ button.
- [x] A sheet opened from a link or a QR explains nothing: no intro, no
      "opened from a link" panel. They were there.
- [x] An icon withdrawn from the palette is RETIRED wherever a schedule is read
      — the icon lives on the activity, so a palette change cannot reach a
      sheet already saved or a link already handed out.
- [x] Any number of schedules in `localStorage`; draft survives a reload.
- [x] A sheet saved in either PREVIOUS shape still opens.
- [x] Share link = deflated, dictionary-compacted JSON, base64url in the hash;
      a fictional starter at `#t=sample`.
- [x] PDF with illustrated header/footer and a QR that reopens the sheet — and
      the QR is decoded out of the produced PDF by the spec, with jsQR.
- [x] Both locales, Sunday rightmost in Arabic with the axis beside it, and the
      whole sheet set in IBM Plex Sans Arabic.

## Acceptance criteria

- An arrow key moves an activity one place in its day; reordering keeps the
  day's span and every duration, and leaves the day nose to tail.
- Two activities at the same time on one day are both flagged and both visible.
- A day with no overlap reports nothing.
- Moving Thursday does not move Sunday.
- An icon chosen in one schedule appears for the same activity in the next.
- Opening the share link in a clean browser restores the sheet with no request.
- The QR in the produced PDF decodes, and the URL restores the sheet.
- A sheet written in the old per-cell shape opens with its activities on the
  axis at the times they had.

## Measurements

The share payload is dictionary-compacted and then DEFLATED, which is most of
why the QR is a printable size. Measured on real-shaped Arabic sheets:

| sheet | plain | deflated | printed QR |
|---|---|---|---|
| 24 activities a day, one name per slot | 1,674 B | **700 B** | 41mm |
| 80 activities a day, one name per slot | 4,068 B | **1,239 B** | 52mm |
| 46 a day, every one a different name | — | ~2,100 B | refused — too dense |
| 90 a day, every one a different name | — | >2,953 B | refused — past the limit |

So no realistic sheet reaches a limit. Only one where every single activity has
a different name — which no wall chart is — gets near.

Two limits that are NOT about size, both found by decoding the rendered PDF
rather than looking at it:

- **A QR drawn into the 150dpi page raster does not scan.** 2.5 pixels per
  module; a decoder needs about five. The code is embedded as its own image
  (`Overlay` in `lib/printPdf.ts`) at 8 px/module instead.
- **A module drawn at a rounded SIZE rather than between rounded BOUNDARIES
  overlaps its neighbour** — 21% at a fractional step, compounding until the
  finder patterns are the wrong shape. Both versions looked perfect on paper.

## Out of scope (v1)

- Save as an image. Asked for explicitly: the PDF is the printable artefact and
  a PNG of a wall chart is a worse version of it.
- A short link. It would mean a server, an account and a row in a database for
  a sheet about when the biscuits are — which is the whole reason the QR is
  large, and it is stated in the UI rather than worked around.
- Proportional-only reading: the axis is continuous, but the sheet still has
  to print on one A4 page, so a very long day compresses short activities.
- Dragging an activity from one day to another. Vertical only, for now.
