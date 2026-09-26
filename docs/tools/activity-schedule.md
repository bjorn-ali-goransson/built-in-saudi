# Activity Schedule

- **Slug:** `/apps/activity-schedule` · **Category:** Generators · **Priority:** Tier 1
- **Runs:** 100% client-side · **Status:** Live
- **Libraries:** `qrcode` (already a dependency), `pdf-lib` via `lib/printPdf.ts`. No new dependency.

## Why

Built from a real Saudi kindergarten wall chart: a time and an activity per day,
an icon beside each activity so a child who cannot yet read can still follow the
day. Every maker of those sheets is a template you retype each term, and the
Arabic half of the category is essentially unserved.

Three things that sheet could not do for itself, and this does:

1. **Keep its own times straight.** The reference sheet had four rows where one
   day had drifted from the rest — `9:30 – 9:30`, `10:00 – 19:30`, a period that
   lost its end time. Nobody proof-reads a wall chart column by column.
2. **Remember what an activity is called and what it looks like.** Not within
   one sheet — across every sheet, so next term is built from last term's words.
3. **Be handed to somebody else without being retyped.** The share link carries
   the schedule itself; the printed PDF carries that link as a QR.

`timetable` stays the plain grid with no icons and owns `class schedule` /
«جدول أسبوعي»; the two link to each other.

## Inputs → Outputs

Title, a line under it, the days, and a grid of cells (time + icon + free-text
activity) → an HTML sheet, a share link, and an A4-landscape PDF.

## Requirements (v1)

- [x] Time lives on the CELL, so a row can disagree with itself and be told so.
- [x] `rowConsensus` needs a clear majority — a 2-2 split suggests nothing.
- [x] Malformed ranges (backwards, zero-length) caught with no row to compare to.
- [x] Per-cell "Match", per-row "Line up row", and a whole-sheet "Line up every row".
- [x] A time typed once spreads down its row, in either typing order, while the
      row still agrees — so the check is rarely needed in the first place.
- [x] Icon: remembered by folded name first, guessed from the words second,
      never guessed over a choice.
- [x] Activity box opens its suggestions on FOCUS, drawn from every saved sheet.
- [x] Any number of schedules in `localStorage`; draft survives a reload unsaved.
- [x] Share link = deflated, dictionary-compacted JSON, base64url in the hash.
- [x] PDF with illustrated header/footer and a QR that reopens the sheet — and
      the QR is decoded out of the produced PDF by the spec, with jsQR.
- [x] Both locales, with Sunday the rightmost card in Arabic.

## Acceptance criteria

- A row where one day drifted names the time the rest of the row uses, and the
  days that agree are not flagged.
- A 2-2 split flags nothing.
- An icon chosen in one schedule appears for the same activity in the next.
- Opening the share link in a clean browser restores the sheet with no request.
- A normal 24-row Arabic sheet still gets a QR; a pathological one is refused
  with the reason, and the PDF still prints either way.
- The QR in the produced PDF decodes, and the URL it yields restores the sheet
  in a clean browser.

## Measurements

The share payload is dictionary-compacted and then DEFLATED, which is most of
why the QR is a printable size. Measured on real-shaped Arabic sheets
(`scripts/gen-schedule-art.mjs` is the art; the size probe is in the commit
that added this tool):

| sheet | plain | deflated | QR | printed |
|---|---|---|---|---|
| 8 rows, one activity per row | 851 B | **479 B** | 77 modules | 36mm |
| 24 rows, one activity per row | 1,674 B | **700 B** | 89 modules | 41mm |
| 80 rows, one activity per row | 4,068 B | **1,239 B** | 117 modules | 52mm |
| 40 rows, every cell different | 9,923 B | 2,092 B | 153 modules | refused — too dense |
| 80 rows, every cell different | 19,903 B | 3,824 B | — | refused — past 2,953 B |

So no realistic sheet reaches a limit: even eighty rows fits inside the 60mm
the page allows. Only a sheet where every single cell differs — which no wall
chart is — gets near, and it takes forty rows of it. Before compression a
sixteen-row sheet needed 54mm and a twenty-four-row one was already refused.

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
- Per-day different row counts, and times as pickers rather than free text.
